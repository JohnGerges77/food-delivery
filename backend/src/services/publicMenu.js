import mongoose from 'mongoose';
import RestaurantSchema from '../models/Restaurant.js';
import CategorySchema from '../models/Category.js';
import ProductSchema from '../models/Product.js';

export class InvalidPublicRequest extends Error {
  constructor() { super('Invalid public request'); }
}

export class PublicRestaurantNotFound extends Error {
  constructor() { super('Not found'); }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function invalid() { throw new InvalidPublicRequest(); }

export function normalizePublicSlug(value) {
  if (typeof value !== 'string' || value.length > 255) invalid();
  const slug = value.trim().toLowerCase();
  if (!SLUG.test(slug)) invalid();
  return slug;
}

function pagination(query, allowed, defaultLimit) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) invalid();
  for (const key of Object.keys(query)) if (!allowed.includes(key)) invalid();
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (query.page !== undefined &&
      (typeof query.page !== 'string' || !/^[1-9]\d{0,3}$/.test(query.page))) invalid();
  if (query.limit !== undefined &&
      (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit))) invalid();
  if (page > 1000 || limit > 100) invalid();
  return { page, limit };
}

export function parsePublicCategoriesQuery(query) {
  return pagination(query, ['page', 'limit'], 50);
}

export function parsePublicProductsQuery(query) {
  const { page, limit } = pagination(query,
    ['page', 'limit', 'categoryId', 'isFeatured', 'sort'], 20);
  const filters = Object.create(null);
  if (query.categoryId !== undefined) {
    if (typeof query.categoryId !== 'string' || !OBJECT_ID.test(query.categoryId)) invalid();
    filters.categoryId = new mongoose.Types.ObjectId(query.categoryId);
  }
  if (query.isFeatured !== undefined) {
    if (!['true', 'false'].includes(query.isFeatured)) invalid();
    filters.isFeatured = query.isFeatured === 'true';
  }
  const sort = query.sort ?? 'name';
  if (!['name', '-name', 'price', '-price', 'createdAt', '-createdAt'].includes(sort)) invalid();
  return { page, limit, sort, filters };
}

export function serializePublicRestaurant(restaurant) {
  return {
    name: restaurant.name, slug: restaurant.slug,
    storefrontTheme: restaurant.storefrontTheme ?? 'savora-classic',
    description: restaurant.description ?? null, logoUrl: restaurant.logoUrl ?? null,
    currency: restaurant.currency, phone: restaurant.phone ?? null,
    contactEmail: restaurant.contactEmail ?? null, address: restaurant.address ?? null,
    openingHours: restaurant.openingHours ?? null,
    deliverySettings: {
      deliveryFee: restaurant.deliverySettings?.deliveryFee ?? null,
      minimumOrder: restaurant.deliverySettings?.minimumOrder ?? null,
      estimatedDeliveryTime: restaurant.deliverySettings?.estimatedDeliveryTime ?? null,
      deliveryAvailable: restaurant.deliverySettings?.deliveryAvailable ?? true,
    },
    socialLinks: {
      facebook: restaurant.socialLinks?.facebook ?? null,
      instagram: restaurant.socialLinks?.instagram ?? null,
      whatsapp: restaurant.socialLinks?.whatsapp ?? null,
    },
    branding: {
      brandName: restaurant.branding?.brandName ?? null,
      primaryColor: restaurant.branding?.primaryColor ?? null,
    },
  };
}

export function serializePublicCategory(category) {
  return {
    id: String(category._id), name: category.name, slug: category.slug,
    description: category.description ?? null, imageUrl: category.imageUrl ?? null,
    sortOrder: category.sortOrder,
  };
}

export function serializePublicProduct(product) {
  return {
    id: String(product._id), categoryId: String(product.categoryId),
    name: product.name, slug: product.slug,
    description: product.description ?? null, price: product.price,
    oldPrice: product.oldPrice ?? null, imageUrl: product.imageUrl ?? null,
    images: Array.from(product.images ?? []), isFeatured: product.isFeatured,
    preparationTime: product.preparationTime ?? null, calories: product.calories ?? null,
  };
}

function modelsFor(connection) {
  if (!connection || connection.readyState !== 1) throw new Error('Database unavailable');
  return {
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
    Category: connection.models.Category ?? connection.model('Category', CategorySchema.schema),
    Product: connection.models.Product ?? connection.model('Product', ProductSchema.schema),
  };
}

export async function resolvePublicRestaurant(connection, slug) {
  const normalized = normalizePublicSlug(slug);
  const { Restaurant } = modelsFor(connection);
  const restaurant = await Restaurant.findOne({ slug: normalized, status: { $ne: 'suspended' } })
    .select('_id name slug storefrontTheme description logoUrl currency phone contactEmail address openingHours deliverySettings socialLinks branding')
    .lean();
  if (!restaurant) throw new PublicRestaurantNotFound();
  return restaurant;
}

export async function listPublicCategories(connection, restaurant, query) {
  const { page, limit } = parsePublicCategoriesQuery(query);
  const { Category } = modelsFor(connection);
  const criteria = { restaurantId: restaurant._id, isActive: true };
  const [categories, total] = await Promise.all([
    Category.find(criteria).select('_id name slug description imageUrl sortOrder')
      .sort({ sortOrder: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Category.countDocuments(criteria),
  ]);
  return { categories: categories.map(serializePublicCategory),
    pagination: { page, limit, total, hasNext: page * limit < total } };
}

export async function listPublicProducts(connection, restaurant, query) {
  const { page, limit, sort, filters } = parsePublicProductsQuery(query);
  const { Category, Product } = modelsFor(connection);
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const [result] = await Product.aggregate([
    { $match: { restaurantId: restaurant._id, isAvailable: true, ...filters } },
    { $lookup: { from: Category.collection.name, localField: 'categoryId',
      foreignField: '_id', as: 'visibleCategory' } },
    { $match: { visibleCategory: { $elemMatch: {
      restaurantId: restaurant._id, isActive: true,
    } } } },
    { $project: { categoryId: 1, name: 1, slug: 1, description: 1,
      price: 1, oldPrice: 1, imageUrl: 1, images: 1, isFeatured: 1,
      preparationTime: 1, calories: 1, createdAt: 1 } },
    { $facet: {
      products: [
        { $sort: { [field]: descending ? -1 : 1, _id: 1 } },
        { $skip: (page - 1) * limit }, { $limit: limit },
      ],
      count: [{ $count: 'value' }],
    } },
  ]).option({ maxTimeMS: 5000 });
  const total = result.count[0]?.value ?? 0;
  return { currency: restaurant.currency, products: result.products.map(serializePublicProduct),
    pagination: { page, limit, total, hasNext: page * limit < total } };
}
