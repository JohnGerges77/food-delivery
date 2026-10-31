import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import OrderSchema from '../src/models/Order.js';
import { tokenHash } from '../src/services/ownerAuth.js';

const origin = 'https://dashboard.example.test';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  try {
    const parsed = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol));
    assert.equal(decodeURIComponent(parsed.username), 'savora_test_user');
    assert.equal(parsed.pathname, '/savora_test');
    assert.equal([...parsed.searchParams.keys()].some((key) =>
      key.toLowerCase() === 'dbname'), false);
  } catch { throw new Error('MONGODB_TEST_URI failed test database safety checks'); }
  return value;
}

test('owner Order management on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24,
    'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const created = new Map([['Order', []], ['OwnerSession', []],
    ['User', []], ['Restaurant', []]]);
  let server;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const OwnerSession = connection.model('OwnerSession', OwnerSessionSchema.schema);
    const Order = connection.model('Order', OrderSchema.schema);
    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      created.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    async function sessionFor(user, expiresAt = new Date(Date.now() + 900_000)) {
      const raw = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      const document = await fixture(OwnerSession, { userId: user._id,
        tokenHash: tokenHash(raw), csrfTokenHash: tokenHash(csrf), expiresAt });
      return { document, csrf,
        cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}` };
    }
    const suffix = randomUUID().replaceAll('-', '');
    const tenants = [];
    for (const letter of ['a', 'b']) {
      const restaurant = await fixture(Restaurant, { name: `Orders ${letter}`,
        slug: `it-orders-${letter}-${suffix}`, currency: 'EGP' });
      const user = await fixture(User, { restaurantId: restaurant._id,
        name: `Owner ${letter}`, email: `it-orders-${letter}-${suffix}@example.test`,
        passwordHash: 'test-only-hash' });
      tenants.push({ restaurant, user, session: await sessionFor(user) });
    }
    const [a, b] = tenants;
    const productId = new mongoose.Types.ObjectId();
    async function orderFor(tenant, method, extra = {}) {
      return fixture(Order, { restaurantId: tenant.restaurant._id,
        orderNumber: `IT-ORDER-${randomUUID().replaceAll('-', '')}`,
        customerName: 'Mona', customerPhone: '+201001234567',
        customerEmail: 'mona@example.test', deliveryAddress: '12 Nile Street',
        city: 'Cairo', items: [{ productId, name: 'Snapshot burger',
          unitPrice: 12.34, quantity: 2, imageUrl: '/burger.webp', notes: 'No onions' }],
        subtotal: 24.68, deliveryFee: 7.5, total: 32.18,
        submissionMethod: method, source: 'website', status: 'pending',
        notes: 'Ring bell', trackingTokenHash: 'private-tracking-hash',
        idempotencyKeyHash: randomBytes(32).toString('hex'),
        idempotencyRequestHash: 'private-request-hash',
        ...(method === 'whatsapp' ? { whatsappTarget: 'https://wa.me/201001234567' } : {}),
        ...extra });
    }
    const direct = await orderFor(a, 'direct');
    const whatsapp = await orderFor(a, 'whatsapp');
    const old = await orderFor(a, 'direct');
    const race = await orderFor(a, 'direct');
    const foreign = await orderFor(b, 'whatsapp');
    const sameTime = new Date('2026-10-01T12:00:00.000Z');
    for (const order of [direct, whatsapp]) {
      await Order.collection.updateOne({ _id: order._id },
        { $set: { createdAt: sameTime } });
    }
    await Order.collection.updateOne({ _id: old._id },
      { $set: { createdAt: new Date('2026-09-15T12:00:00.000Z') } });

    server = createApp({ connection, allowedOrigins: origin, secureCookies: true })
      .listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/orders`;
    const get = (session, path = '', headers = {}) => fetch(`${base}${path}`, {
      headers: { ...(session ? { Cookie: session.cookie } : {}), ...headers },
    });
    const patch = (session, id, body, { requestOrigin = origin,
      csrf = session?.csrf, headers = {} } = {}) => fetch(`${base}/${id}/status`, {
      method: 'PATCH', headers: {
        ...(session ? { Cookie: session.cookie } : {}), Origin: requestOrigin,
        'X-Savora-CSRF': csrf ?? '', 'Content-Type': 'application/json', ...headers,
      }, body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    await t.test('missing, expired and revoked sessions return 401', async () => {
      assert.equal((await get(null)).status, 401);
      assert.equal((await get(null, `/${direct._id}`)).status, 401);
      assert.equal((await patch(null, direct._id, { status: 'preparing' })).status, 401);
      const expired = await sessionFor(a.user, new Date(Date.now() - 1000));
      assert.equal((await get(expired)).status, 401);
      const revoked = await sessionFor(a.user);
      await OwnerSession.deleteOne({ _id: revoked.document._id });
      assert.equal((await get(revoked)).status, 401);
    });

    await t.test('each owner lists only own direct and WhatsApp orders', async () => {
      const response = await get(a.session);
      assert.equal(response.status, 200);
      const { orders, pagination } = await response.json();
      assert.equal(pagination.total, 4);
      assert.equal(pagination.hasNext, false);
      assert.deepEqual(new Set(orders.map((order) => order.id)),
        new Set([direct, whatsapp, old, race].map((order) => String(order._id))));
      assert.deepEqual(new Set(orders.map((order) => order.submissionMethod)),
        new Set(['direct', 'whatsapp']));
      assert.equal(orders.some((order) => order.id === String(foreign._id)), false);
      assert.equal((await (await get(b.session)).json()).pagination.total, 1);
      assert.equal((await get(a.session, `?restaurantId=${b.restaurant._id}`)).status, 400);
      assert.equal((await get(a.session, '', { restaurantId: String(b.restaurant._id),
        userId: String(b.user._id), role: 'owner' })).status, 200);
    });

    await t.test('details retain snapshots and disclose private data only to owning tenant', async () => {
      const response = await get(a.session, `/${whatsapp._id}`);
      assert.equal(response.status, 200);
      const { order } = await response.json();
      assert.equal(order.customerEmail, 'mona@example.test');
      assert.equal(order.items[0].name, 'Snapshot burger');
      assert.equal(order.items[0].unitPrice, 12.34);
      assert.equal(order.items[0].quantity, 2);
      assert.equal(order.items[0].notes, 'No onions');
      assert.equal(order.total, 32.18);
      assert.equal(order.deliveredAt, null);
      assert.deepEqual(Object.keys(order), ['id', 'orderNumber', 'customerName',
        'customerPhone', 'customerEmail', 'deliveryAddress', 'city', 'items',
        'subtotal', 'deliveryFee', 'total', 'status', 'source', 'submissionMethod',
        'notes', 'createdAt', 'updatedAt', 'deliveredAt']);
      assert.doesNotMatch(JSON.stringify(order),
        /restaurantId|trackingTokenHash|idempotencyKeyHash|idempotencyRequestHash|whatsappTarget|passwordHash|__v/);
      const missing = new mongoose.Types.ObjectId();
      for (const id of [foreign._id, missing]) {
        const result = await get(a.session, `/${id}`);
        assert.equal(result.status, 404);
        assert.deepEqual(await result.json(), { error: 'Not found' });
        const update = await patch(a.session, id, { status: 'delivered' });
        assert.equal(update.status, 404);
        assert.deepEqual(await update.json(), { error: 'Not found' });
      }
      assert.equal((await Order.findById(foreign._id)).status, 'pending');
    });

    await t.test('pagination, exact number, status, method and UTC date filters work', async () => {
      const page1 = await (await get(a.session, '?limit=2')).json();
      const page2 = await (await get(a.session, '?limit=2&page=2')).json();
      assert.equal(page1.pagination.total, 4);
      assert.equal(page1.pagination.hasNext, true);
      assert.equal(page2.pagination.hasNext, false);
      const all = [...page1.orders, ...page2.orders];
      assert.equal(new Set(all.map((order) => order.id)).size, 4);
      assert.deepEqual(all.map((order) => order.id), [...all].sort((left, right) =>
        new Date(right.createdAt) - new Date(left.createdAt) ||
        right.id.localeCompare(left.id)).map((order) => order.id));
      const september = await (await get(a.session,
        '?from=2026-09-01&to=2026-09-30')).json();
      assert.deepEqual(september.orders.map((order) => order.id), [String(old._id)]);
      const method = await (await get(a.session, '?submissionMethod=whatsapp')).json();
      assert.deepEqual(method.orders.map((order) => order.id), [String(whatsapp._id)]);
      const number = await (await get(a.session,
        `?orderNumber=${direct.orderNumber}`)).json();
      assert.deepEqual(number.orders.map((order) => order.id), [String(direct._id)]);
      const status = await (await get(a.session, '?status=pending')).json();
      assert.equal(status.pagination.total, 4);
      const grouped = await (await get(a.session, '?statusGroup=pending&limit=2')).json();
      assert.equal(grouped.pagination.total, 4);
      assert.equal(grouped.orders.length, 2);
      for (const query of ['?page=0', '?limit=101', '?status=unknown',
        '?statusGroup=preparing', '?status=pending&statusGroup=pending',
        '?submissionMethod=other', '?from=2026-02-30',
        '?from=2026-10-03&to=2026-10-02', '?sort=total', '?%24where=1',
        '?status=pending&status=cancelled', '?orderNumber=%24ne']) {
        assert.equal((await get(a.session, query)).status, 400, query);
      }
    });

    let legacy;
    await t.test('legacy in-progress orders group before pagination and finish directly', async () => {
      legacy = await orderFor(a, 'direct', { status: 'ready' });
      const preparing = await orderFor(a, 'direct', { status: 'preparing' });
      const outForDelivery = await orderFor(a, 'whatsapp', { status: 'out-for-delivery' });
      const grouped = await (await get(a.session, '?statusGroup=pending&limit=2')).json();
      assert.equal(grouped.pagination.total, 7);
      assert.equal(grouped.orders.length, 2);
      assert.equal((await (await get(a.session, '?status=pending')).json()).pagination.total, 4);
      assert.equal((await (await get(a.session, `/${legacy._id}`)).json()).order.status, 'ready');
      assert.equal((await (await get(a.session, `/${preparing._id}`)).json()).order.status,
        'preparing');
      const response = await patch(a.session, legacy._id, { status: 'delivered' });
      assert.equal(response.status, 200);
      assert.ok((await response.json()).order.deliveredAt);
      assert.equal((await Order.findById(legacy._id)).status, 'delivered');
      assert.equal((await patch(a.session, outForDelivery._id,
        { status: 'cancelled' })).status, 200);
      assert.equal((await Order.findById(outForDelivery._id)).deliveredAt, undefined);
    });

    await t.test('Origin, CSRF and strict payload guards protect status changes', async () => {
      assert.equal((await patch(a.session, direct._id, { status: 'preparing' },
        { requestOrigin: 'https://storefront.example.test' })).status, 403);
      assert.equal((await patch(a.session, direct._id, { status: 'preparing' },
        { csrf: 'f'.repeat(64) })).status, 403);
      for (const body of [{}, { status: 'unknown' }, { status: 'preparing', total: 1 },
        { status: 'preparing', items: [] },
        { status: 'preparing', deliveredAt: new Date() },
        { status: 'preparing', restaurantId: String(b.restaurant._id) },
        { status: 'preparing', 'items.0.unitPrice': 1 },
        { $set: { status: 'preparing' } },
        JSON.parse('{"__proto__":{"polluted":true}}'), '{']) {
        assert.equal((await patch(a.session, direct._id, body)).status, 400);
      }
      assert.equal((await patch(a.session, direct._id,
        { status: 'preparing', notes: 'x'.repeat(2000) })).status, 413);
      const unchanged = await Order.findById(direct._id);
      assert.equal(unchanged.status, 'pending');
      assert.equal(unchanged.total, 32.18);
      assert.equal(unchanged.items[0].unitPrice, 12.34);
      assert.equal(unchanged.deliveredAt, undefined);
    });

    await t.test('direct delivery sets deliveredAt once; cancellation is terminal', async () => {
      assert.equal((await patch(a.session, direct._id,
        { status: 'ready' })).status, 400);
      const response = await patch(a.session, direct._id, { status: 'delivered' });
      assert.equal(response.status, 200);
      const { order } = await response.json();
      assert.equal(order.status, 'delivered');
      assert.ok(order.deliveredAt);
      const delivered = await Order.findById(direct._id);
      assert.equal(delivered.items[0].unitPrice, 12.34);
      assert.equal(delivered.total, 32.18);
      assert.ok(delivered.deliveredAt instanceof Date);
      assert.equal((await patch(a.session, direct._id,
        { status: 'cancelled' })).status, 409);
      assert.equal((await patch(a.session, old._id,
        { status: 'cancelled' })).status, 200);
      assert.equal((await Order.findById(old._id)).deliveredAt, undefined);
      assert.equal((await patch(a.session, old._id,
        { status: 'delivered' })).status, 409);
      const deliveredRead = await (await get(a.session, `/${direct._id}`)).json();
      assert.equal(deliveredRead.order.deliveredAt, delivered.deliveredAt.toISOString());
      const filtered = await (await get(a.session, '?status=delivered')).json();
      assert.deepEqual(new Set(filtered.orders.map((order) => order.id)),
        new Set([String(direct._id), String(legacy._id)]));
    });

    await t.test('concurrent status updates have one winner and no lost update', async () => {
      const [first, second] = await Promise.all([
        patch(a.session, race._id, { status: 'delivered' }),
        patch(a.session, race._id, { status: 'cancelled' }),
      ]);
      assert.deepEqual([first.status, second.status].sort(), [200, 409]);
      const stored = await Order.findById(race._id);
      assert.ok(['delivered', 'cancelled'].includes(stored.status));
      assert.equal(Boolean(stored.deliveredAt), stored.status === 'delivered');
      assert.equal(stored.items[0].unitPrice, 12.34);
      assert.equal(stored.total, 32.18);
      assert.equal((await patch(a.session, race._id,
        { status: stored.status === 'delivered' ? 'cancelled' : 'delivered' })).status, 409);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1 && connection.name === 'savora_test' &&
        connection.db.databaseName === 'savora_test') {
      for (const name of ['Order', 'OwnerSession', 'User', 'Restaurant']) {
        for (const _id of created.get(name)) {
          await connection.models[name].deleteOne({ _id });
        }
      }
    }
    await connection.close();
  }
});
