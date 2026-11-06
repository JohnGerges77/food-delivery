import RestaurantSchema from '../models/Restaurant.js';
import ProductSchema from '../models/Product.js';
import CategorySchema from '../models/Category.js';
import { isVerifiedOwnerContext } from './ownerAuth.js';
import { OwnerResourceNotFound } from './ownerTenant.js';

export class InvalidRestaurantSettings extends Error {
  constructor() {
    super('Invalid restaurant settings');
  }
}

const fields = Object.freeze({
  name: 'requiredText', description: 'text', logoUrl: 'webUrl',
  heroProductId: 'heroProduct',
  phone: 'text', contactEmail: 'text', address: 'text', openingHours: 'text',
  deliverySettings: Object.freeze({
    deliveryFee: 'amount', minimumOrder: 'amount',
    estimatedDeliveryTime: 'text', deliveryAvailable: 'boolean',
  }),
  socialLinks: Object.freeze({ facebook: 'webUrl', instagram: 'webUrl', whatsapp: 'webUrl' }),
  branding: Object.freeze({ brandName: 'text', primaryColor: 'text' }),
});

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function validKey(key, allowed) {
  return Object.hasOwn(allowed, key) && !key.startsWith('$') && !key.includes('.') &&
    !['__proto__', 'prototype', 'constructor'].includes(key);
}

function validWebUrl(value) {
  if (value === '') return true;
  if (/^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/[0-9a-f]{24}\/large$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function validValue(value, kind) {
  if (kind === 'heroProduct') return value === null ||
    (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value));
  if (kind === 'amount') return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (kind === 'boolean') return typeof value === 'boolean';
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (kind === 'requiredText' && !value.trim()) return false;
  if (kind === 'webUrl' && !validWebUrl(value.trim())) return false;
  return true;
}

export function parseRestaurantSettingsPatch(body) {
  if (!plainObject(body) || Object.keys(body).length === 0) throw new InvalidRestaurantSettings();
  const updates = Object.create(null);
  for (const [key, value] of Object.entries(body)) {
    if (!validKey(key, fields)) throw new InvalidRestaurantSettings();
    const rule = fields[key];
    if (typeof rule === 'string') {
      if (!validValue(value, rule)) throw new InvalidRestaurantSettings();
      updates[key] = value;
      continue;
    }
    if (!plainObject(value) || Object.keys(value).length === 0) {
      throw new InvalidRestaurantSettings();
    }
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (!validKey(nestedKey, rule) || !validValue(nestedValue, rule[nestedKey])) {
        throw new InvalidRestaurantSettings();
      }
      updates[`${key}.${nestedKey}`] = nestedValue;
    }
  }
  return updates;
}

function ownerRestaurantModel(connection, auth) {
  if (!isVerifiedOwnerContext(auth)) throw new Error('Verified owner context is required');
  if (!connection || connection.readyState !== 1) throw new Error('Database unavailable');
  return connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema);
}

export async function getOwnerRestaurant(connection, auth) {
  const Restaurant = ownerRestaurantModel(connection, auth);
  const restaurant = await Restaurant.findOne({ _id: auth.restaurantId,
    status: { $ne: 'suspended' } });
  if (!restaurant) throw new OwnerResourceNotFound();
  return restaurant;
}

export async function assertHeroProductEligible(Product, Category, restaurantId, productId) {
  const product = await Product.findOne({ _id: productId,
    restaurantId, isAvailable: true }).select('categoryId').lean();
  if (!product || !await Category.exists({ _id: product.categoryId,
    restaurantId, isActive: true })) throw new InvalidRestaurantSettings();
}

export async function patchOwnerRestaurant(connection, auth, body) {
  const updates = parseRestaurantSettingsPatch(body);
  const Restaurant = ownerRestaurantModel(connection, auth);
  if (Object.hasOwn(updates, 'heroProductId') && updates.heroProductId !== null) {
    const Product = connection.models.Product ?? connection.model('Product', ProductSchema.schema);
    const Category = connection.models.Category ?? connection.model('Category', CategorySchema.schema);
    await assertHeroProductEligible(Product, Category, auth.restaurantId, updates.heroProductId);
  }
  const restaurant = await getOwnerRestaurant(connection, auth);
  if (Object.hasOwn(updates, 'logoUrl') &&
      (updates.logoUrl.startsWith('/api/public/restaurants/') ||
       restaurant.logoUrl?.startsWith('/api/public/restaurants/')) &&
      updates.logoUrl !== restaurant.logoUrl) throw new InvalidRestaurantSettings();
  const oldLogoUrl = restaurant.logoUrl ?? null;
  for (const [path, value] of Object.entries(updates)) restaurant.set(path, value);
  try {
    await restaurant.validate();
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      throw new InvalidRestaurantSettings();
    }
    throw error;
  }
  let updated;
  try {
    updated = await Restaurant.findOneAndUpdate(
      { _id: auth.restaurantId, status: { $ne: 'suspended' },
        ...(Object.hasOwn(updates, 'logoUrl') ? { logoUrl: oldLogoUrl } : {}) },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    );
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      throw new InvalidRestaurantSettings();
    }
    throw error;
  }
  if (!updated) throw new OwnerResourceNotFound();
  return updated;
}
