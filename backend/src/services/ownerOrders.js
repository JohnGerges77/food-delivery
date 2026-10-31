import { createOwnerTenantScope, ownerListFilter, OwnerResourceNotFound } from './ownerTenant.js';

export class InvalidOrderInput extends Error {
  constructor() { super('Invalid order input'); }
}

export class OrderStatusConflict extends Error {
  constructor() { super('Order status conflict'); }
}

const TRANSITIONS = Object.freeze({
  pending: ['delivered', 'cancelled'],
  preparing: ['delivered', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  'out-for-delivery': ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
});
export const PENDING_ORDER_STATUSES = Object.freeze([
  'pending', 'preparing', 'ready', 'out-for-delivery',
]);
const ORDER_FIELDS = '_id orderNumber customerName customerPhone customerEmail ' +
  'deliveryAddress city items subtotal deliveryFee total status source ' +
  'submissionMethod notes createdAt updatedAt deliveredAt';

function invalid() { throw new InvalidOrderInput(); }

function utcDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid();
  return date;
}

export function parseOwnerOrderQuery(query) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) invalid();
  for (const key of Object.keys(query)) {
    if (!['page', 'limit', 'status', 'statusGroup', 'submissionMethod', 'from', 'to',
      'orderNumber'].includes(key)) invalid();
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (query.page !== undefined &&
      (typeof query.page !== 'string' || !/^[1-9]\d{0,3}$/.test(query.page))) invalid();
  if (query.limit !== undefined &&
      (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit))) invalid();
  if (page > 1000 || limit > 100) invalid();
  const filters = Object.create(null);
  if (query.status !== undefined) {
    if (query.statusGroup !== undefined) invalid();
    if (typeof query.status !== 'string' || !Object.hasOwn(TRANSITIONS, query.status)) invalid();
    filters.status = query.status;
  }
  if (query.statusGroup !== undefined) {
    if (!['pending', 'delivered', 'cancelled'].includes(query.statusGroup) ||
        typeof query.statusGroup !== 'string') invalid();
    filters.status = query.statusGroup === 'pending'
      ? { $in: [...PENDING_ORDER_STATUSES] } : query.statusGroup;
  }
  if (query.submissionMethod !== undefined) {
    if (!['direct', 'whatsapp'].includes(query.submissionMethod)) invalid();
    filters.submissionMethod = query.submissionMethod;
  }
  if (query.orderNumber !== undefined) {
    if (typeof query.orderNumber !== 'string' ||
        !/^[A-Za-z0-9-]{1,100}$/.test(query.orderNumber)) invalid();
    filters.orderNumber = query.orderNumber;
  }
  if (query.from !== undefined || query.to !== undefined) {
    const from = query.from === undefined ? undefined : utcDay(query.from);
    const to = query.to === undefined ? undefined : utcDay(query.to);
    if (from && to && from > to) invalid();
    filters.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: new Date(to.getTime() + 86_400_000) } : {}),
    };
  }
  return { page, limit, filters };
}

export function parseOrderStatus(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body) ||
      Object.getPrototypeOf(body) !== Object.prototype ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'status') ||
      typeof body.status !== 'string' ||
      !['delivered', 'cancelled'].includes(body.status)) invalid();
  return body.status;
}

export function serializeOwnerOrder(order) {
  return {
    id: String(order._id), orderNumber: order.orderNumber,
    customerName: order.customerName, customerPhone: order.customerPhone,
    customerEmail: order.customerEmail ?? null,
    deliveryAddress: order.deliveryAddress, city: order.city,
    items: order.items.map((item) => ({
      productId: String(item.productId), name: item.name,
      unitPrice: item.unitPrice, quantity: item.quantity,
      imageUrl: item.imageUrl ?? null, notes: item.notes ?? null,
    })),
    subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total,
    status: order.status, source: order.source,
    submissionMethod: order.submissionMethod, notes: order.notes ?? null,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
    deliveredAt: order.deliveredAt ?? null,
  };
}

export async function listOwnerOrders(connection, auth, query) {
  const { page, limit, filters } = parseOwnerOrderQuery(query);
  const scope = createOwnerTenantScope(connection, auth);
  const Order = connection.models.Order;
  const [orders, total] = await Promise.all([
    scope.orders.find(filters).select(ORDER_FIELDS).sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(ownerListFilter(auth, filters)),
  ]);
  return { orders: orders.map(serializeOwnerOrder),
    pagination: { page, limit, total, hasNext: page * limit < total } };
}

export async function getOwnerOrder(connection, auth, id) {
  const scope = createOwnerTenantScope(connection, auth);
  const order = await scope.orders.findById(id).select(ORDER_FIELDS).lean();
  if (!order) throw new OwnerResourceNotFound();
  return serializeOwnerOrder(order);
}

export async function patchOwnerOrderStatus(connection, auth, id, body) {
  const nextStatus = parseOrderStatus(body);
  const scope = createOwnerTenantScope(connection, auth);
  const Order = connection.models.Order;
  const current = await scope.orders.findById(id).select('_id status').lean();
  if (!current) throw new OwnerResourceNotFound();
  if (!TRANSITIONS[current.status]?.includes(nextStatus)) throw new OrderStatusConflict();
  const updated = await Order.findOneAndUpdate(
    { ...scope.orders.idFilter(id), status: current.status },
    { $set: { status: nextStatus,
      ...(nextStatus === 'delivered' ? { deliveredAt: new Date() } : {}) } },
    { returnDocument: 'after', runValidators: true },
  ).select(ORDER_FIELDS).lean();
  if (!updated) {
    if (!await scope.orders.findById(id).select('_id').lean()) {
      throw new OwnerResourceNotFound();
    }
    throw new OrderStatusConflict();
  }
  return serializeOwnerOrder(updated);
}
