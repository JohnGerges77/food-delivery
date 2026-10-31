import mongoose from 'mongoose';
import RestaurantSchema from '../models/Restaurant.js';
import UserSchema from '../models/User.js';
import AuditSchema from '../models/PlatformAudit.js';
import { hashPassword, validatePassword } from '../security/password.js';
import { currencyFractionDigits } from './ownerProducts.js';

export class InvalidAdminInput extends Error {}
export class AdminConflict extends Error {}
export class AdminNotFound extends Error {}
const THEMES = ['savora-classic', 'savora-aqua', 'savora-cafe', 'savora-luxury'];
function theme(value) {
  if (typeof value !== 'string' || !THEMES.includes(value)) throw new InvalidAdminInput();
  return value;
}

function models(connection) {
  if (connection?.readyState !== 1) throw new Error('Database unavailable');
  return {
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
    User: connection.models.User ?? connection.model('User', UserSchema.schema),
    Audit: connection.models.PlatformAudit ?? connection.model('PlatformAudit', AuditSchema.schema),
  };
}
function plain(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key));
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\x00-\x1f\x7f]/.test(value)) throw new InvalidAdminInput();
  return value.trim();
}
function validateCreation(body) {
  if (!plain(body, ['restaurant', 'owner']) ||
      !plain(body.restaurant, ['name', 'slug', 'currency', 'description', 'storefrontTheme']) ||
      !plain(body.owner, ['name', 'email', 'password'])) throw new InvalidAdminInput();
  const restaurant = {
    name: text(body.restaurant.name, 120),
    slug: text(body.restaurant.slug, 100).toLowerCase(),
    currency: text(body.restaurant.currency, 3).toUpperCase(),
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurant.slug)) throw new InvalidAdminInput();
  try {
    if (!Intl.supportedValuesOf('currency').includes(restaurant.currency)) throw new Error();
    currencyFractionDigits(restaurant.currency);
  } catch { throw new InvalidAdminInput(); }
  if (body.restaurant.description !== undefined) {
    restaurant.description = text(body.restaurant.description, 1000);
  }
  if (body.restaurant.storefrontTheme !== undefined) {
    restaurant.storefrontTheme = theme(body.restaurant.storefrontTheme);
  }
  const owner = { name: text(body.owner.name, 120),
    email: text(body.owner.email, 254).toLowerCase() };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email)) throw new InvalidAdminInput();
  try { validatePassword(body.owner.password); } catch { throw new InvalidAdminInput(); }
  return { restaurant, owner, password: body.owner.password };
}
export function serializeAdminRestaurant(restaurant, owner = null) {
  return { id: String(restaurant._id), name: restaurant.name, slug: restaurant.slug,
    currency: restaurant.currency, description: restaurant.description ?? null,
    storefrontTheme: restaurant.storefrontTheme ?? 'savora-classic',
    status: restaurant.status ?? 'active', createdAt: restaurant.createdAt,
    updatedAt: restaurant.updatedAt,
    owner: owner ? { id: String(owner._id), name: owner.name,
      email: owner.email, isActive: owner.isActive } : null };
}

export async function createPlatformRestaurant(connection, adminId, body) {
  const input = validateCreation(body);
  const { Restaurant, User, Audit } = models(connection);
  // Unique indexes are verified before writes and never dropped by this path.
  await Restaurant.createIndexes();
  await User.createIndexes();
  await Audit.createIndexes();
  const passwordHash = await hashPassword(input.password);
  const restaurant = new Restaurant(input.restaurant);
  const owner = new User({ restaurantId: restaurant._id, ...input.owner, passwordHash });
  try { await restaurant.validate(); await owner.validate(); }
  catch { throw new InvalidAdminInput(); }
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      await restaurant.save({ session });
      await owner.save({ session });
      await Audit.create([{ adminId, action: 'restaurant.created',
        restaurantId: restaurant._id, details: { slug: restaurant.slug,
          ownerEmail: owner.email, storefrontTheme: restaurant.storefrontTheme } }], { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern ?? {})[0];
      throw new AdminConflict(key === 'slug' ? 'Restaurant slug already exists' :
        key === 'email' ? 'Owner email already exists' : 'Unique value already exists');
    }
    throw error;
  } finally { await session.endSession(); }
  return serializeAdminRestaurant(restaurant, owner);
}

export function parseAdminListQuery(query) {
  if (!plain(query, ['page', 'limit', 'search'])) throw new InvalidAdminInput();
  const numeric = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d{0,3}$/.test(value) || Number(value) > maximum) {
      throw new InvalidAdminInput();
    }
    return Number(value);
  };
  const page = numeric(query.page, 1, 1000);
  const limit = numeric(query.limit, 20, 50);
  const search = query.search === undefined || query.search === '' ? '' : text(query.search, 100);
  return { page, limit, search };
}
export async function listPlatformRestaurants(connection, query) {
  const { Restaurant, User } = models(connection);
  const { page, limit, search } = parseAdminListQuery(query);
  const filter = search ? { $or: [
    { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    { slug: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
  ] } : {};
  const [restaurants, total] = await Promise.all([
    Restaurant.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Restaurant.countDocuments(filter),
  ]);
  const owners = await User.find({ restaurantId: { $in: restaurants.map((r) => r._id) },
    role: 'owner' }).select('_id restaurantId name email isActive');
  const byRestaurant = new Map(owners.map((owner) => [String(owner.restaurantId), owner]));
  return { restaurants: restaurants.map((restaurant) => serializeAdminRestaurant(
    restaurant, byRestaurant.get(String(restaurant._id)))), page, limit, total };
}
export async function getPlatformRestaurant(connection, id) {
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) throw new InvalidAdminInput();
  const { Restaurant, User } = models(connection);
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw new AdminNotFound();
  const owner = await User.findOne({ restaurantId: restaurant._id, role: 'owner' })
    .select('_id restaurantId name email isActive');
  return serializeAdminRestaurant(restaurant, owner);
}
export async function platformOverview(connection) {
  const { Restaurant } = models(connection);
  const [total, suspended] = await Promise.all([
    Restaurant.countDocuments(), Restaurant.countDocuments({ status: 'suspended' }),
  ]);
  return { total, suspended, active: total - suspended };
}
export async function changeRestaurantStatus(connection, adminId, id, status) {
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id) ||
      !['active', 'suspended'].includes(status)) throw new InvalidAdminInput();
  const { Restaurant, Audit } = models(connection);
  await Audit.createIndexes();
  const session = await connection.startSession();
  let restaurant;
  try {
    await session.withTransaction(async () => {
      restaurant = await Restaurant.findOneAndUpdate({ _id: id,
        status: status === 'active' ? 'suspended' : { $ne: 'suspended' } }, { $set: { status } },
      { returnDocument: 'after', session });
      if (!restaurant) {
        if (await Restaurant.exists({ _id: id }).session(session)) throw new AdminConflict('Status already set');
        throw new AdminNotFound();
      }
      await Audit.create([{ adminId, restaurantId: restaurant._id,
        action: status === 'active' ? 'restaurant.activated' : 'restaurant.suspended',
        details: { from: status === 'active' ? 'suspended' : 'active', to: status } }],
      { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  const { User } = models(connection);
  const owner = await User.findOne({ restaurantId: restaurant._id, role: 'owner' })
    .select('_id restaurantId name email isActive');
  return serializeAdminRestaurant(restaurant, owner);
}

export async function changeRestaurantTheme(connection, adminId, id, value) {
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) throw new InvalidAdminInput();
  const next = theme(value);
  const { Restaurant, User, Audit } = models(connection);
  await Audit.createIndexes();
  const session = await connection.startSession();
  let restaurant;
  try {
    await session.withTransaction(async () => {
      const current = await Restaurant.findById(id).session(session);
      if (!current) throw new AdminNotFound();
      const previous = current.storefrontTheme ?? 'savora-classic';
      if (previous === next) throw new AdminConflict('Theme already set');
      restaurant = await Restaurant.findOneAndUpdate({ _id: id,
        ...(previous === 'savora-classic' ? { $or: [
          { storefrontTheme: 'savora-classic' }, { storefrontTheme: { $exists: false } },
        ] } : { storefrontTheme: previous }) },
      { $set: { storefrontTheme: next } }, { returnDocument: 'after', session, runValidators: true });
      if (!restaurant) throw new AdminConflict('Theme changed');
      await Audit.create([{ adminId, restaurantId: restaurant._id,
        action: 'restaurant.theme_changed', details: { from: previous, to: next } }], { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  const owner = await User.findOne({ restaurantId: restaurant._id, role: 'owner' })
    .select('_id restaurantId name email isActive');
  return serializeAdminRestaurant(restaurant, owner);
}
