import mongoose from 'mongoose';
import { touchOwnedCategory, withCategoryReferenceTransaction } from './categoryReference.js';
import { validOwnerImageUrl } from './ownerCategories.js';
import { createOwnerTenantScope, ownerListFilter, OwnerResourceNotFound } from './ownerTenant.js';
import { managedMediaId } from './ownerMedia.js';
import MediaAssetSchema from '../models/MediaAsset.js';

export class InvalidProductInput extends Error {
  constructor() { super('Invalid product input'); }
}

export class ProductConflict extends Error {
  constructor(message) { super(message); }
}

const EDITABLE_FIELDS = new Set([
  'name', 'slug', 'categoryId', 'description', 'price', 'oldPrice', 'imageUrl',
  'images', 'isAvailable', 'isFeatured', 'preparationTime', 'calories',
]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_PRICE = 1_000_000;

function invalid() { throw new InvalidProductInput(); }

export function currencyFractionDigits(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits;
}

function validMoney(value, fractionDigits) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      value < 0 || value > MAX_PRICE) return false;
  const decimal = String(value);
  return (fractionDigits === 0 ? /^\d+$/ :
    new RegExp(`^\\d+(?:\\.\\d{1,${fractionDigits}})?$`)).test(decimal);
}

export function parseProductInput(body, { create = false, currency = 'EGP' } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body) ||
      Object.getPrototypeOf(body) !== Object.prototype || !Object.keys(body).length) invalid();
  if (create && ['name', 'slug', 'categoryId', 'price'].some((key) => !Object.hasOwn(body, key))) {
    invalid();
  }
  const fractionDigits = currencyFractionDigits(currency);
  const input = Object.create(null);
  for (const [key, value] of Object.entries(body)) {
    if (!EDITABLE_FIELDS.has(key)) invalid();
    if (key === 'name') {
      if (typeof value !== 'string' || !value.trim() || value.length > 120) invalid();
    } else if (key === 'slug') {
      if (typeof value !== 'string') invalid();
      const normalized = value.trim().toLowerCase();
      if (normalized.length > 120 || !SLUG.test(normalized)) invalid();
      input.slug = normalized;
      continue;
    } else if (key === 'categoryId') {
      if (typeof value !== 'string' || !OBJECT_ID.test(value)) invalid();
    } else if (key === 'price' || key === 'oldPrice') {
      if (!(key === 'oldPrice' && value === null) && !validMoney(value, fractionDigits)) invalid();
    } else if (key === 'description') {
      if (typeof value !== 'string' || value.length > 2048) invalid();
    } else if (key === 'imageUrl') {
      if (typeof value !== 'string' || value.length > 2048 ||
          !validOwnerImageUrl(value.trim())) invalid();
      if (value.startsWith('/api/public/restaurants/') &&
          (create || !managedMediaId(value))) invalid();
    } else if (key === 'images') {
      if (!Array.isArray(value) || value.length > 10 || value.some((url) =>
        typeof url !== 'string' || url.length > 2048 || !validOwnerImageUrl(url.trim()) ||
        (url.startsWith('/api/public/restaurants/') &&
          (create || !managedMediaId(url))))) invalid();
    } else if (key === 'isAvailable' || key === 'isFeatured') {
      if (typeof value !== 'boolean') invalid();
    } else if (key === 'preparationTime') {
      if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 10_080)) invalid();
    } else if (key === 'calories') {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) ||
          value < 0 || value > 100_000)) invalid();
    }
    input[key] = value;
  }
  return input;
}

export function parseProductListQuery(query) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) invalid();
  for (const key of Object.keys(query)) {
    if (!['page', 'limit', 'sort', 'categoryId', 'isAvailable', 'isFeatured'].includes(key)) invalid();
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (query.page !== undefined &&
      (typeof query.page !== 'string' || !/^[1-9]\d{0,3}$/.test(query.page))) invalid();
  if (query.limit !== undefined &&
      (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit))) invalid();
  if (page > 1000 || limit > 100) invalid();
  const sort = query.sort ?? '-createdAt';
  if (!['name', '-name', 'price', '-price', 'createdAt', '-createdAt'].includes(sort)) invalid();
  const filters = Object.create(null);
  if (query.categoryId !== undefined) {
    if (typeof query.categoryId !== 'string' || !OBJECT_ID.test(query.categoryId)) invalid();
    filters.categoryId = new mongoose.Types.ObjectId(query.categoryId);
  }
  for (const field of ['isAvailable', 'isFeatured']) {
    if (query[field] !== undefined) {
      if (!['true', 'false'].includes(query[field])) invalid();
      filters[field] = query[field] === 'true';
    }
  }
  return { page, limit, sort, filters };
}

export function serializeOwnerProduct(product) {
  return {
    id: String(product._id), name: product.name, slug: product.slug,
    categoryId: String(product.categoryId), description: product.description ?? null,
    price: product.price, oldPrice: product.oldPrice ?? null,
    imageUrl: product.imageUrl ?? null, images: Array.from(product.images ?? []),
    isAvailable: product.isAvailable, isFeatured: product.isFeatured,
    preparationTime: product.preparationTime ?? null, calories: product.calories ?? null,
  };
}

function modelsFor(connection, auth) {
  const scope = createOwnerTenantScope(connection, auth);
  return { scope, Product: connection.models.Product,
    Category: connection.models.Category, Order: connection.models.Order };
}

function mapWriteError(error) {
  if (error.code === 11000) throw new ProductConflict('Product slug already exists');
  if (error.name === 'ValidationError' || error.name === 'CastError') invalid();
  throw error;
}

export async function listOwnerProducts(connection, auth, query) {
  const { page, limit, sort, filters } = parseProductListQuery(query);
  const { scope, Product } = modelsFor(connection, auth);
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const criteria = ownerListFilter(auth, filters);
  const [products, total] = await Promise.all([
    scope.products.find(filters).sort({ [field]: descending ? -1 : 1, _id: 1 })
      .skip((page - 1) * limit).limit(limit),
    Product.countDocuments(criteria),
  ]);
  return { products: products.map(serializeOwnerProduct),
    pagination: { page, limit, total, hasNext: page * limit < total } };
}

export async function getOwnerProduct(connection, auth, id) {
  const { scope } = modelsFor(connection, auth);
  const product = await scope.products.findById(id);
  if (!product) throw new OwnerResourceNotFound();
  return product;
}

export async function createOwnerProduct(connection, auth, body) {
  const input = parseProductInput(body, { create: true, currency: auth.restaurant.currency });
  const { Product, Category } = modelsFor(connection, auth);
  try {
    return await withCategoryReferenceTransaction(connection, async (session) => {
      await touchOwnedCategory(Category, auth, input.categoryId, session);
      const product = new Product({ ...input, restaurantId: auth.restaurantId });
      await product.validate();
      await product.save({ session });
      return product;
    });
  } catch (error) { mapWriteError(error); }
}

export async function patchOwnerProduct(connection, auth, id, body) {
  const input = parseProductInput(body, { currency: auth.restaurant.currency });
  const { scope, Product, Category } = modelsFor(connection, auth);
  async function update(session) {
    const current = await scope.products.findById(id).session(session);
    if (!current) throw new OwnerResourceNotFound();
    if (Object.hasOwn(input, 'imageUrl') &&
        (managedMediaId(input.imageUrl) || managedMediaId(current.imageUrl)) &&
        input.imageUrl !== current.imageUrl) invalid();
    if (Object.hasOwn(input, 'images')) {
      const managed = (urls) => urls.filter(managedMediaId).sort();
      if (JSON.stringify(managed(input.images)) !==
          JSON.stringify(managed(current.images ?? []))) invalid();
    }
    if (Object.hasOwn(input, 'categoryId')) {
      await touchOwnedCategory(Category, auth, input.categoryId, session);
    }
    const oldImageUrl = current.imageUrl ?? null;
    const oldImages = Array.from(current.images ?? []);
    for (const [key, value] of Object.entries(input)) current.set(key, value);
    await current.validate();
    const filter = scope.products.idFilter(id);
    if (Object.hasOwn(input, 'imageUrl')) filter.imageUrl = oldImageUrl;
    if (Object.hasOwn(input, 'images')) filter.images = oldImages;
    const updated = await Product.findOneAndUpdate(filter,
      { $set: input }, { session, returnDocument: 'after', runValidators: true });
    if (!updated) throw new ProductConflict('Product changed; reload and retry');
    return updated;
  }
  try {
    return Object.hasOwn(input, 'categoryId')
      ? await withCategoryReferenceTransaction(connection, update)
      : await update(null);
  } catch (error) { mapWriteError(error); }
}

export async function deleteOwnerProduct(connection, auth, id) {
  const { scope, Product, Order } = modelsFor(connection, auth);
  await withCategoryReferenceTransaction(connection, async (session) => {
    const deleted = await Product.findOneAndDelete(scope.products.idFilter(id), { session });
    if (!deleted) throw new OwnerResourceNotFound();
    if (await Order.exists({ 'items.productId': deleted._id }).session(session)) {
      throw new ProductConflict('Product has orders; mark it unavailable instead');
    }
    if (managedMediaId(deleted.imageUrl) || deleted.images?.some(managedMediaId)) {
      const MediaAsset = connection.models.MediaAsset ??
        connection.model('MediaAsset', MediaAssetSchema.schema);
      await MediaAsset.updateMany({ restaurantId: auth.restaurantId,
        targetKind: { $in: ['product', 'gallery'] }, targetId: deleted._id, status: 'active' },
      { $set: { status: 'retired' } }, { session });
    }
  });
}
