import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import OrderSchema from '../models/Order.js';
import ProductSchema from '../models/Product.js';
import CategorySchema from '../models/Category.js';
import RestaurantSchema from '../models/Restaurant.js';
import { withCategoryReferenceTransaction } from './categoryReference.js';
import { currencyFractionDigits } from './ownerProducts.js';
import { PublicRestaurantNotFound, resolvePublicRestaurant } from './publicMenu.js';
import { restaurantWhatsAppTarget } from './whatsappOrdering.js';

export class InvalidCheckout extends Error {}
export class CheckoutConflict extends Error {}
export class CheckoutUnavailable extends Error {}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const KEY = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_MONEY = 1_000_000;
const MAX_ITEMS = 10;
const MAX_QUANTITY = 99;
const MAX_TOTAL_QUANTITY = 100;
const FIELDS = new Set(['customerName', 'customerPhone', 'customerEmail',
  'deliveryAddress', 'city', 'notes', 'submissionMethod', 'items']);
const ITEM_FIELDS = new Set(['productId', 'variantId', 'quantity', 'notes']);
const BETA_FIELDS = new Set(['submissionMethod', 'items']);
const BETA_ITEM_FIELDS = new Set(['productId', 'variantId', 'quantity']);

function invalid() { throw new InvalidCheckout(); }
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function onlyKeys(value, allowed) {
  if (!plain(value)) invalid();
  for (const key of Object.keys(value)) {
    if (!allowed.has(key) || key.includes('.') || key.startsWith('$') ||
        ['__proto__', 'constructor', 'prototype'].includes(key)) invalid();
  }
}
function cleanText(value, limit, required = true) {
  if (typeof value !== 'string' || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) invalid();
  const cleaned = value.trim();
  if (required && !cleaned) invalid();
  return cleaned;
}

export function betaCheckoutBody(body) {
  onlyKeys(body, BETA_FIELDS);
  if (!['direct', 'whatsapp'].includes(body.submissionMethod) || !Array.isArray(body.items) ||
      !body.items.length || body.items.length > MAX_ITEMS) invalid();
  for (const item of body.items) onlyKeys(item, BETA_ITEM_FIELDS);
  return { submissionMethod: body.submissionMethod, items: body.items, customerName: 'Savora Beta Test Guest',
    customerPhone: '+12025550100', deliveryAddress: 'Synthetic order, no fulfillment', city: 'Beta Test City' };
}

export function parseCheckout(body, key) {
  if (typeof key !== 'string' || !KEY.test(key)) invalid();
  onlyKeys(body, FIELDS);
  const customerName = cleanText(body.customerName, 100);
  const customerPhone = cleanText(body.customerPhone, 30);
  if (!/^\+?[0-9][0-9 ()-]{6,28}$/.test(customerPhone)) invalid();
  const deliveryAddress = cleanText(body.deliveryAddress, 240);
  const city = cleanText(body.city, 100);
  const emailText = body.customerEmail === undefined ? undefined :
    cleanText(body.customerEmail, 254, false).toLowerCase();
  const customerEmail = emailText || undefined;
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) invalid();
  const notes = body.notes === undefined ? undefined : cleanText(body.notes, 500, false);
  if (!['direct', 'whatsapp'].includes(body.submissionMethod)) invalid();
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > MAX_ITEMS) invalid();
  const seen = new Set();
  let quantityCount = 0;
  const items = body.items.map((item) => {
    onlyKeys(item, ITEM_FIELDS);
    if (typeof item.productId !== 'string' || !OBJECT_ID.test(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        item.quantity > MAX_QUANTITY) invalid();
    const productId = item.productId.toLowerCase();
    if (item.variantId !== undefined && (typeof item.variantId !== 'string' || !OBJECT_ID.test(item.variantId))) invalid();
    const identity = `${productId}:${item.variantId?.toLowerCase() ?? ''}`;
    if (seen.has(identity)) invalid();
    seen.add(identity);
    quantityCount += item.quantity;
    if (quantityCount > MAX_TOTAL_QUANTITY) invalid();
    return { productId, quantity: item.quantity,
      ...(item.variantId === undefined ? {} : { variantId: item.variantId.toLowerCase() }),
      ...(item.notes === undefined ? {} : { notes: cleanText(item.notes, 200, false) }) };
  });
  return { customerName, customerPhone, deliveryAddress, city,
    ...(customerEmail === undefined ? {} : { customerEmail }),
    ...(notes === undefined ? {} : { notes }), submissionMethod: body.submissionMethod, items };
}

export function moneyToMinor(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      value < 0 || value > MAX_MONEY || !Number.isInteger(digits) ||
      digits < 0 || digits > 3) throw new CheckoutUnavailable();
  const decimal = String(value);
  if (!(digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`)).test(decimal)) {
    throw new CheckoutUnavailable();
  }
  const [whole, fraction = ''] = decimal.split('.');
  return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
}

function currencyDigits(currency) {
  try {
    const digits = currencyFractionDigits(currency);
    if (!Number.isInteger(digits) || digits < 0 || digits > 3) throw new Error();
    return digits;
  } catch { throw new CheckoutUnavailable(); }
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function modelsFor(connection) {
  if (connection?.readyState !== 1) throw new Error('Database unavailable');
  return {
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
    Product: connection.models.Product ?? connection.model('Product', ProductSchema.schema),
    Category: connection.models.Category ?? connection.model('Category', CategorySchema.schema),
    Order: connection.models.Order ?? connection.model('Order', OrderSchema.schema),
  };
}

function confirmation(order, currency) {
  return { orderNumber: order.orderNumber, status: order.status,
    submissionMethod: order.submissionMethod, currency, subtotal: order.subtotal,
    deliveryFee: order.deliveryFee, total: order.total, savedInSavora: true };
}

export function buildWhatsAppUrl(order, target, currency, restaurantName = '', { beta = false } = {}) {
  const safe = (value, length = 240) => {
    const chars = Array.from(String(value).toWellFormed().replace(/[\x00-\x1f\x7f]/g, ' '));
    return chars.length > length ? chars.slice(0, length - 1).join('') + '…' : chars.join('');
  };
  const digits = currencyDigits(currency);
  const money = (amount) => `${Number(amount).toFixed(digits)} ${currency}`;
  const header = [
    ...(beta ? ['TEST ORDER — no payment or fulfillment.', 'طلب تجريبي فقط. لا دفع ولا تنفيذ للطلب.'] : []),
    safe(restaurantName, 45), `Order ${safe(order.orderNumber, 40)}`,
  ];
  const totals = [`Subtotal: ${money(order.subtotal)}`, `Delivery: ${money(order.deliveryFee)}`,
    `Total: ${money(order.total)}`];
  const itemLines = (length, includeNotes) => order.items.map(item => {
    const variant = item.variantName ? ` (${safe(item.variantName, length)})` : '';
    const notes = includeNotes && item.notes ? ` (${safe(item.notes)})` : '';
    return `${item.quantity} x ${safe(item.name, length)}${variant} @ ${money(item.unitPrice)} = ${money(item.quantity * item.unitPrice)}${notes}`;
  });
  let message = [...header, ...itemLines(70, !beta), ...totals].join('\n');
  // Keep every item and its variant within the handoff budget, even for long Unicode names.
  if (encodeURIComponent(message).length > 3500) {
    message = [...header, ...itemLines(8, false), ...totals].join('\n');
  }
  if (!beta) {
    const details = [`Name: ${safe(order.customerName)}`, `Phone: ${safe(order.customerPhone)}`,
      `Address: ${safe(order.deliveryAddress)}, ${safe(order.city)}`,
      ...(order.notes ? [`Notes: ${safe(order.notes)}`] : [])];
    const withDetails = [message, ...details].join('\n');
    if (encodeURIComponent(withDetails).length <= 3500) message = withDetails;
  }
  return `${target}?text=${encodeURIComponent(message)}`;
}

function resultFor(order, restaurant, target, beta) {
  const result = { order: confirmation(order, restaurant.currency) };
  if (order.submissionMethod === 'whatsapp') {
    result.whatsapp = {
      url: target && order.whatsappTarget === target
        ? buildWhatsAppUrl(order, target, restaurant.currency, restaurant.name, { beta }) : null,
      messageSent: false,
    };
  }
  return result;
}

export async function createGuestOrder(connection, slug, body, idempotencyKey, { betaWhatsAppTargets } = {}) {
  const input = parseCheckout(body, idempotencyKey);
  const restaurant = await resolvePublicRestaurant(connection, slug);
  const { Restaurant, Product, Category, Order } = modelsFor(connection);
  const keyHash = digest(idempotencyKey);
  const requestHash = digest(JSON.stringify(input));
  const lookup = { restaurantId: restaurant._id, idempotencyKeyHash: keyHash };
  async function existing() {
    const order = await Order.findOne(lookup).select('+idempotencyRequestHash +whatsappTarget');
    if (!order) return null;
    if (order.idempotencyRequestHash !== requestHash) throw new CheckoutConflict();
    const current = order.submissionMethod === 'whatsapp' ? await resolvePublicRestaurant(connection, slug) : restaurant;
    return resultFor(order, current, restaurantWhatsAppTarget(current, betaWhatsAppTargets), Boolean(betaWhatsAppTargets));
  }
  const replay = await existing();
  if (replay) return { ...replay, replayed: true };

  try {
    const saved = await withCategoryReferenceTransaction(connection, async (session) => {
      // Write the tenant row in the same transaction so suspension and checkout
      // cannot both commit against an earlier active snapshot.
      const currentRestaurant = await Restaurant.findOneAndUpdate({ _id: restaurant._id,
        status: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { returnDocument: 'after' })
        .select('_id name slug currency deliverySettings socialLinks')
        .session(session).lean();
      if (!currentRestaurant) throw new PublicRestaurantNotFound();
      const digits = currencyDigits(currentRestaurant.currency);
      const scale = 10 ** digits;
      const feeMinor = moneyToMinor(currentRestaurant.deliverySettings?.deliveryFee ?? 0, digits);
      const minimumMinor = moneyToMinor(currentRestaurant.deliverySettings?.minimumOrder ?? 0, digits);
      if (currentRestaurant.deliverySettings?.deliveryAvailable === false) {
        throw new CheckoutUnavailable();
      }
      const target = input.submissionMethod === 'whatsapp' ?
        restaurantWhatsAppTarget(currentRestaurant, betaWhatsAppTargets) : null;
      if (input.submissionMethod === 'whatsapp' && !target) throw new CheckoutUnavailable();
      // Every attempt reads current product/category state and writes each selected Product.
      const snapshots = [];
      let subtotalMinor = 0;
      for (const item of input.items) {
        const product = await Product.findOneAndUpdate({ _id: item.productId,
          restaurantId: restaurant._id, isAvailable: true },
        { $inc: { orderReferenceRevision: 1 } },
        { session, returnDocument: 'after', timestamps: false });
        if (!product) throw new CheckoutUnavailable();
        const category = await Category.findOneAndUpdate({ _id: product.categoryId,
          restaurantId: restaurant._id, isActive: true },
        { $inc: { referenceRevision: 1 } },
        { session, returnDocument: 'after', timestamps: false, projection: { _id: 1 } });
        if (!category) throw new CheckoutUnavailable();
        const variant = product.variants?.length ? product.variants.find((v) => String(v._id) === item.variantId && v.isAvailable) : null;
        if (product.variants?.length ? !variant : item.variantId !== undefined) throw new CheckoutUnavailable();
        const priceMinor = moneyToMinor(variant ? variant.price : product.price, digits);
        subtotalMinor += priceMinor * item.quantity;
        snapshots.push({ productId: product._id, name: product.name,
          unitPrice: priceMinor / scale, quantity: item.quantity,
          ...(variant ? { variantId: variant._id, variantName: variant.name } : {}),
          ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
          ...(item.notes ? { notes: item.notes } : {}) });
      }
      if (subtotalMinor < minimumMinor) throw new CheckoutUnavailable();
      const [saved] = await Order.create([{ restaurantId: restaurant._id,
        ...input, items: snapshots, subtotal: subtotalMinor / scale,
        deliveryFee: feeMinor / scale, total: (subtotalMinor + feeMinor) / scale,
        orderNumber: `SV-${randomBytes(12).toString('hex').toUpperCase()}`,
        source: 'website', status: 'pending', idempotencyKeyHash: keyHash,
        idempotencyRequestHash: requestHash,
        ...(target ? { whatsappTarget: target } : {}) }], { session });
      return { order: saved, restaurant: currentRestaurant, target };
    });
    return { ...resultFor(saved.order, saved.restaurant, saved.target, Boolean(betaWhatsAppTargets)), replayed: false };
  } catch (error) {
    if (error.code === 11000) {
      const recovered = await existing();
      if (recovered) return { ...recovered, replayed: true };
    }
    throw error;
  }
}
