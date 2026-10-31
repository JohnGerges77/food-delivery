import { createOwnerTenantScope, ownerListFilter, OwnerResourceNotFound } from './ownerTenant.js';
import { touchOwnedCategory, withCategoryReferenceTransaction } from './categoryReference.js';

export class InvalidCategoryInput extends Error {
  constructor() { super('Invalid category input'); }
}

export class CategoryConflict extends Error {
  constructor(message) { super(message); }
}

const EDITABLE_FIELDS = new Set([
  'name', 'slug', 'description', 'imageUrl', 'sortOrder', 'isActive',
]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invalid() { throw new InvalidCategoryInput(); }

export function validOwnerImageUrl(value) {
  if (value === '') return true;
  if (value.startsWith('/')) {
    return !value.startsWith('//') && !/[\\\s\x00-\x1f]/.test(value) &&
      !value.split(/[/?#]/).includes('..');
  }
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname) &&
      !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function parseCategoryInput(body, { create = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body) ||
      Object.getPrototypeOf(body) !== Object.prototype || !Object.keys(body).length) invalid();
  if (create && (!Object.hasOwn(body, 'name') || !Object.hasOwn(body, 'slug'))) invalid();
  const input = Object.create(null);
  for (const [key, value] of Object.entries(body)) {
    if (!EDITABLE_FIELDS.has(key)) invalid();
    if (key === 'isActive') {
      if (typeof value !== 'boolean') invalid();
    } else if (key === 'sortOrder') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) ||
          value < 0 || value > 1_000_000) invalid();
    } else if (typeof value !== 'string') {
      invalid();
    } else if (key === 'name') {
      if (!value.trim() || value.length > 120) invalid();
    } else if (key === 'slug') {
      const normalized = value.trim().toLowerCase();
      if (normalized.length > 120 || !SLUG.test(normalized)) invalid();
      input.slug = normalized;
      continue;
    } else if (key === 'description') {
      if (value.length > 2048) invalid();
    } else if (key === 'imageUrl') {
      if (value.length > 2048 || !validOwnerImageUrl(value.trim())) invalid();
    }
    input[key] = value;
  }
  return input;
}

export function parseCategoryListQuery(query) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) invalid();
  for (const key of Object.keys(query)) {
    if (!['page', 'limit', 'sort'].includes(key)) invalid();
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (query.page !== undefined &&
      (typeof query.page !== 'string' || !/^[1-9]\d{0,3}$/.test(query.page))) invalid();
  if (query.limit !== undefined &&
      (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit))) invalid();
  if (page > 1000 || limit > 100) invalid();
  const sort = query.sort ?? 'sortOrder';
  if (!['sortOrder', '-sortOrder'].includes(sort)) invalid();
  return { page, limit, sort };
}

export function serializeOwnerCategory(category) {
  return {
    id: String(category._id), name: category.name, slug: category.slug,
    description: category.description ?? null, imageUrl: category.imageUrl ?? null,
    sortOrder: category.sortOrder, isActive: category.isActive,
  };
}

function modelsFor(connection, auth) {
  const scope = createOwnerTenantScope(connection, auth);
  return { scope, Category: connection.models.Category, Product: connection.models.Product };
}

function mapWriteError(error) {
  if (error.code === 11000) throw new CategoryConflict('Category slug already exists');
  if (error.name === 'ValidationError' || error.name === 'CastError') invalid();
  throw error;
}

export async function listOwnerCategories(connection, auth, query) {
  const { page, limit, sort } = parseCategoryListQuery(query);
  const { scope, Category } = modelsFor(connection, auth);
  const direction = sort === '-sortOrder' ? -1 : 1;
  const [categories, total] = await Promise.all([
    scope.categories.find().sort({ sortOrder: direction, _id: 1 })
      .skip((page - 1) * limit).limit(limit),
    Category.countDocuments(ownerListFilter(auth)),
  ]);
  return { categories: categories.map(serializeOwnerCategory),
    pagination: { page, limit, total, hasNext: page * limit < total } };
}

export async function getOwnerCategory(connection, auth, id) {
  const { scope } = modelsFor(connection, auth);
  const category = await scope.categories.findById(id);
  if (!category) throw new OwnerResourceNotFound();
  return category;
}

export async function createOwnerCategory(connection, auth, body) {
  const input = parseCategoryInput(body, { create: true });
  const { Category } = modelsFor(connection, auth);
  const category = new Category({ ...input, restaurantId: auth.restaurantId });
  try {
    await category.validate();
    await category.save();
  } catch (error) { mapWriteError(error); }
  return category;
}

export async function patchOwnerCategory(connection, auth, id, body) {
  const input = parseCategoryInput(body);
  const { scope, Category } = modelsFor(connection, auth);
  const current = await getOwnerCategory(connection, auth, id);
  for (const [key, value] of Object.entries(input)) current.set(key, value);
  try {
    await current.validate();
    const updated = await Category.findOneAndUpdate(scope.categories.idFilter(id),
      { $set: input }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new OwnerResourceNotFound();
    return updated;
  } catch (error) {
    if (error instanceof OwnerResourceNotFound) throw error;
    mapWriteError(error);
  }
}

export async function deleteOwnerCategory(connection, auth, id) {
  const { scope, Category, Product } = modelsFor(connection, auth);
  await withCategoryReferenceTransaction(connection, async (session) => {
    const category = await touchOwnedCategory(Category, auth, id, session);
    // Inspect every product, including unavailable products and inconsistent cross-tenant refs.
    if (await Product.exists({ categoryId: category._id }).session(session)) {
      throw new CategoryConflict('Category has products; deactivate it instead');
    }
    const deleted = await Category.findOneAndDelete(scope.categories.idFilter(id), { session });
    if (!deleted) throw new OwnerResourceNotFound();
  });
}
