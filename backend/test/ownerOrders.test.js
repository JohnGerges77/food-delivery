import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { InvalidOrderInput, parseOrderStatus, parseOwnerOrderQuery,
  serializeOwnerOrder, PENDING_ORDER_STATUSES } from '../src/services/ownerOrders.js';

test('owner Order filters are whitelisted, bounded and use UTC calendar days', () => {
  const parsed = parseOwnerOrderQuery({ page: '2', limit: '10', status: 'pending',
    submissionMethod: 'whatsapp', from: '2026-10-01', to: '2026-10-02',
    orderNumber: 'SV-1234' });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.filters.status, 'pending');
  assert.deepEqual(parseOwnerOrderQuery({ statusGroup: 'pending' }).filters.status,
    { $in: [...PENDING_ORDER_STATUSES] });
  assert.equal(parseOwnerOrderQuery({ statusGroup: 'delivered' }).filters.status,
    'delivered');
  assert.equal(parsed.filters.submissionMethod, 'whatsapp');
  assert.equal(parsed.filters.orderNumber, 'SV-1234');
  assert.equal(parsed.filters.createdAt.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(parsed.filters.createdAt.$lt.toISOString(), '2026-10-03T00:00:00.000Z');
  assert.deepEqual(parseOwnerOrderQuery({}).page, 1);
  for (const query of [{ page: '0' }, { page: '1001' }, { limit: '101' },
    { page: ['1', '2'] }, { status: { $ne: 'pending' } }, { status: 'created' },
    { statusGroup: 'preparing' }, { status: 'pending', statusGroup: 'pending' },
    { submissionMethod: 'other' }, { orderNumber: '.*' },
    { from: '2026-02-30' }, { to: '2026-99-01' },
    { from: '2026-10-03', to: '2026-10-02' },
    { restaurantId: 'forged' }, { sort: 'total' }, { $where: '1' }]) {
    assert.throws(() => parseOwnerOrderQuery(query), InvalidOrderInput);
  }
});

test('status body accepts only one known status field', () => {
  assert.equal(parseOrderStatus({ status: 'delivered' }), 'delivered');
  assert.equal(parseOrderStatus({ status: 'cancelled' }), 'cancelled');
  for (const body of [{}, { status: 'unknown' }, { status: 1 },
    { status: 'preparing' }, { status: 'ready' }, { status: 'out-for-delivery' },
    { status: { $ne: 'pending' } }, { status: 'preparing', total: 1 },
    { status: 'preparing', deliveredAt: new Date() },
    { status: 'preparing', 'items.0.name': 'Changed' },
    { $set: { status: 'ready' } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    [], null]) {
    assert.throws(() => parseOrderStatus(body), InvalidOrderInput);
  }
  assert.equal({}.polluted, undefined);
});

test('owner Order DTO includes stored snapshots and excludes private fields', () => {
  const id = new mongoose.Types.ObjectId();
  const createdAt = new Date('2026-10-01T12:00:00.000Z');
  const order = serializeOwnerOrder({ _id: id, restaurantId: id,
    orderNumber: 'SV-123', customerName: 'Mona', customerPhone: '+201001234567',
    deliveryAddress: '12 Nile Street', city: 'Cairo',
    items: [{ productId: id, name: 'Burger', unitPrice: 12.34, quantity: 2,
      notes: 'No onions', trackingTokenHash: 'secret' }],
    subtotal: 24.68, deliveryFee: 7.5, total: 32.18, status: 'pending',
    source: 'website', submissionMethod: 'whatsapp', createdAt,
    updatedAt: createdAt, trackingTokenHash: 'secret',
    idempotencyKeyHash: 'secret', idempotencyRequestHash: 'secret',
    whatsappTarget: 'secret', __v: 1 });
  assert.equal(order.items[0].unitPrice, 12.34);
  assert.equal(order.customerEmail, null);
  assert.equal(order.deliveredAt, null);
  assert.deepEqual(Object.keys(order), ['id', 'orderNumber', 'customerName',
    'customerPhone', 'customerEmail', 'deliveryAddress', 'city', 'items',
    'subtotal', 'deliveryFee', 'total', 'status', 'source', 'submissionMethod',
    'notes', 'createdAt', 'updatedAt', 'deliveredAt']);
  assert.doesNotMatch(JSON.stringify(order),
    /restaurantId|trackingTokenHash|idempotency|whatsappTarget|__v|secret/);
});

test('owner Order routes require a verified session', async () => {
  const server = createApp({ allowedOrigins: 'https://dashboard.example.test' })
    .listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/orders`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/${new mongoose.Types.ObjectId()}`)).status, 401);
    assert.equal((await fetch(`${base}/${new mongoose.Types.ObjectId()}/status`, {
      method: 'PATCH', headers: { Origin: 'https://dashboard.example.test' },
    })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
