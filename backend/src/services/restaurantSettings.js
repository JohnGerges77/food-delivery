import RestaurantSchema from '../models/Restaurant.js';
import ProductSchema from '../models/Product.js';
import CategorySchema from '../models/Category.js';
import { isVerifiedOwnerContext } from './ownerAuth.js';
import { OwnerResourceNotFound } from './ownerTenant.js';
import { allowedWhatsAppTarget, normalizeWhatsAppNumber } from './whatsappOrdering.js';

export class InvalidRestaurantSettings extends Error {
  constructor() {
    super('Invalid restaurant settings');
  }
}

const fields = Object.freeze({
  name: 'requiredText', description: 'text', logoUrl: 'webUrl', aboutImageUrl: 'externalUrl',
  heroProductId: 'heroProduct', heroImageUrl: 'externalUrl',
  phone: 'text', contactEmail: 'text', address: 'text', openingHours: 'text',
  deliverySettings: Object.freeze({
    deliveryFee: 'amount', minimumOrder: 'amount',
    estimatedDeliveryTime: 'text', deliveryAvailable: 'boolean', whatsappOrderingEnabled: 'boolean',
  }),
  socialLinks: Object.freeze({ facebook: 'webUrl', instagram: 'webUrl', whatsapp: 'whatsapp' }),
  branding: Object.freeze({ brandName: 'text', primaryColor: 'hexColor' }),
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
  if (kind === 'hexColor') return !value.trim() || /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
  if (kind === 'whatsapp') return !value.trim() || normalizeWhatsAppNumber(value) !== null;
  if (kind === 'webUrl' && !validWebUrl(value.trim())) return false;
  if (kind === 'externalUrl' && value.trim() &&
      (!validWebUrl(value.trim()) || value.trim().startsWith('/'))) return false;
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
      updates[`${key}.${nestedKey}`] = rule[nestedKey] === 'whatsapp'
        ? normalizeWhatsAppNumber(nestedValue) ?? '' : nestedValue;
    }
  }
  return updates;
}

function ownerRestaurantModel(connection, auth) {
  if (!isVerifiedOwnerContext(auth)) throw new Error('Verified owner context is required');
  if (!connection || connection.readyState !== 1) throw new Error('Database unavailable');
  return connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema);
}

export async function getOwnerRestaurant(connection, auth, { session } = {}) {
  const Restaurant = ownerRestaurantModel(connection, auth);
  const restaurant = await Restaurant.findOne({ _id: auth.restaurantId,
    status: { $ne: 'suspended' } }).session(session);
  if (!restaurant) throw new OwnerResourceNotFound();
  return restaurant;
}

export async function assertHeroProductEligible(Product, Category, restaurantId, productId, { session } = {}) {
  const product = await Product.findOne({ _id: productId,
    restaurantId, isAvailable: true }, null, { session }).select('categoryId').lean();
  if (!product || !await Category.exists({ _id: product.categoryId,
    restaurantId, isActive: true }, { session })) throw new InvalidRestaurantSettings();
}

export async function patchOwnerRestaurant(connection, auth, body, { session, betaWhatsAppTargets } = {}) {
  const updates = parseRestaurantSettingsPatch(body);
  const Restaurant = ownerRestaurantModel(connection, auth);
  if (Object.hasOwn(updates, 'heroProductId') && updates.heroProductId !== null) {
    const Product = connection.models.Product ?? connection.model('Product', ProductSchema.schema);
    const Category = connection.models.Category ?? connection.model('Category', CategorySchema.schema);
    await assertHeroProductEligible(Product, Category, auth.restaurantId, updates.heroProductId, { session });
  }
  const restaurant = await getOwnerRestaurant(connection, auth, { session });
  const numberPath = 'socialLinks.whatsapp';
  const enabledPath = 'deliverySettings.whatsappOrderingEnabled';
  const changesNumber = Object.hasOwn(updates, numberPath);
  const previousNumber = restaurant.socialLinks?.whatsapp ?? null;
  const numberCondition = {};
  if (changesNumber || Object.hasOwn(updates, enabledPath)) {
    if (updates[numberPath] === '' && !Object.hasOwn(updates, enabledPath)) updates[enabledPath] = false;
    const enabled = updates[enabledPath] ?? (restaurant.deliverySettings?.whatsappOrderingEnabled === true);
    const target = changesNumber ? updates[numberPath] : previousNumber;
    if (enabled && !allowedWhatsAppTarget(restaurant.slug, target, betaWhatsAppTargets)) {
      throw new InvalidRestaurantSettings();
    }
    // A concurrent request clearing the number must win before an enable-only save can use it.
    if (enabled && !changesNumber) numberCondition[numberPath] = previousNumber;
    if (betaWhatsAppTargets && changesNumber && !Object.hasOwn(updates, enabledPath)) {
      numberCondition[enabledPath] = enabled ? true : { $in: [null, false] };
    }
  }
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
        ...numberCondition,
        ...(Object.hasOwn(updates, 'logoUrl') ? { logoUrl: oldLogoUrl } : {}) },
      { $set: updates },
      { returnDocument: 'after', runValidators: true, session },
    );
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      throw new InvalidRestaurantSettings();
    }
    throw error;
  }
  if (!updated && Object.keys(numberCondition).length) throw new InvalidRestaurantSettings();
  if (!updated) throw new OwnerResourceNotFound();
  return updated;
}
