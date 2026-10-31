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

test('owner analytics on savora_test', async (t) => {
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
    await Order.createIndexes();
    assert.ok((await Order.collection.listIndexes().toArray()).some((index) =>
      index.key.restaurantId === 1 && index.key.deliveredAt === -1 &&
      index.partialFilterExpression?.status === 'delivered'));
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
      return { document, cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}` };
    }
    const suffix = randomUUID().replaceAll('-', '');
    const tenants = [];
    for (const letter of ['a', 'b', 'empty']) {
      const restaurant = await fixture(Restaurant, { name: `Analytics ${letter}`,
        slug: `it-analytics-${letter}-${suffix}`, currency: 'EGP' });
      const user = await fixture(User, { restaurantId: restaurant._id,
        name: `Owner ${letter}`, email: `it-analytics-${letter}-${suffix}@example.test`,
        passwordHash: 'test-only-hash' });
      tenants.push({ restaurant, user, session: await sessionFor(user) });
    }
    const [a, b, empty] = tenants;
    const p1 = new mongoose.Types.ObjectId();
    const p2 = new mongoose.Types.ObjectId();
    const item = (productId, name, unitPrice, quantity) =>
      ({ productId, name, unitPrice, quantity });
    async function orderFor(tenant, { createdAt, deliveredAt, status,
      method = 'direct', items, subtotal, fee = 0, total }) {
      const order = await fixture(Order, {
        restaurantId: tenant.restaurant._id,
        orderNumber: `IT-ANALYTICS-${randomUUID().replaceAll('-', '')}`,
        customerName: 'Private Guest', customerPhone: '+201001234567',
        customerEmail: 'private@example.test', deliveryAddress: 'Private Address',
        city: 'Cairo', items, subtotal, deliveryFee: fee, total,
        status, submissionMethod: method,
        trackingTokenHash: 'private-tracking-hash',
        idempotencyKeyHash: randomBytes(32).toString('hex'),
      });
      await Order.collection.updateOne({ _id: order._id },
        { $set: { createdAt: new Date(createdAt),
          ...(deliveredAt ? { deliveredAt: new Date(deliveredAt) } : {}) } });
      return order;
    }
    await orderFor(a, { createdAt: '2026-01-01T00:00:00.000Z',
      deliveredAt: '2026-01-02T00:00:00.000Z', status: 'delivered',
      items: [item(p1, 'Old P1', 0.1, 2), item(p2, 'P2', 0.8, 1)],
      subtotal: 1, fee: 0.1, total: 1.1 });
    await orderFor(a, { createdAt: '2026-01-02T18:00:00.000Z',
      status: 'pending', method: 'whatsapp',
      items: [item(p1, 'Draft', 999, 1)], subtotal: 999, total: 999 });
    await orderFor(a, { createdAt: '2026-01-02T18:30:00.000Z',
      status: 'cancelled', items: [item(p1, 'Cancelled', 999, 1)],
      subtotal: 999, total: 999 });
    await orderFor(a, { createdAt: '2025-12-31T12:00:00.000Z',
      deliveredAt: '2026-01-04T12:00:00.000Z', status: 'delivered',
      method: 'whatsapp', items: [item(p1, 'New P1', 0.1, 3)],
      subtotal: 0.3, fee: 0.1, total: 0.4 });
    await orderFor(a, { createdAt: '2025-12-30T12:00:00.000Z',
      deliveredAt: '2025-12-31T12:00:00.000Z', status: 'delivered',
      items: [item(p1, 'Earlier P1', 0.9, 1)],
      subtotal: 0.9, fee: 0.1, total: 1 });
    await orderFor(a, { createdAt: '2025-12-25T00:00:00.000Z',
      status: 'cancelled', items: [item(p2, 'Old cancelled', 1, 1)],
      subtotal: 1, total: 1 });
    await orderFor(a, { createdAt: '2026-01-07T23:59:59.999Z',
      status: 'preparing', items: [item(p1, 'Preparing', 1, 1)],
      subtotal: 1, total: 1 });
    await orderFor(a, { createdAt: '2026-01-08T00:00:00.000Z',
      status: 'pending', items: [item(p1, 'After', 1, 1)],
      subtotal: 1, total: 1 });
    await orderFor(b, { createdAt: '2026-01-02T18:00:00.000Z',
      deliveredAt: '2026-01-03T00:00:00.000Z', status: 'delivered',
      items: [item(p1, 'Private B product', 5000, 1)],
      subtotal: 5000, total: 5000 });

    server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test',
      secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/stats`;
    const range = '?from=2026-01-01&to=2026-01-07';
    const get = (session, endpoint, query = range, headers = {}) =>
      fetch(`${base}/${endpoint}${query}`, { headers: {
        ...(session ? { Cookie: session.cookie } : {}), ...headers,
      } });
    const body = async (session, endpoint, query = range) => {
      const response = await get(session, endpoint, query);
      assert.equal(response.status, 200, `${endpoint} ${query}`);
      return response.json();
    };

    await t.test('sessions, tenant scope and query whitelist protect all endpoints', async () => {
      const expired = await sessionFor(a.user, new Date(Date.now() - 1000));
      const revoked = await sessionFor(a.user);
      await OwnerSession.deleteOne({ _id: revoked.document._id });
      for (const endpoint of ['overview', 'trends', 'top-products',
        'breakdowns', 'activity']) {
        assert.equal((await get(null, endpoint)).status, 401);
        assert.equal((await get(expired, endpoint)).status, 401);
        assert.equal((await get(revoked, endpoint)).status, 401);
        assert.equal((await get(a.session, endpoint,
          `${range}&restaurantId=${b.restaurant._id}`)).status, 400);
        assert.equal((await get(a.session, endpoint, `${range}&%24where=1`)).status, 400);
        const own = await body(a.session, endpoint);
        assert.equal(own.currency, 'EGP');
        assert.equal(own.period, 'custom');
        assert.equal(own.from, '2026-01-01T00:00:00.000Z');
        assert.equal(own.toExclusive, '2026-01-08T00:00:00.000Z');
        assert.doesNotMatch(JSON.stringify(own),
          /Private Guest|private@example|Private Address|private-tracking-hash|restaurantId|idempotencyKeyHash/);
      }
      const forged = await get(a.session, 'overview', range, {
        restaurantId: String(b.restaurant._id), userId: String(b.user._id), role: 'owner',
      });
      assert.equal(forged.status, 200);
      assert.equal((await forged.json()).totalOrders.current, 4);
      assert.equal((await body(b.session, 'overview')).totalOrders.current, 1);
    });

    await t.test('overview separates created statuses from deliveredAt money', async () => {
      const data = await body(a.session, 'overview');
      assert.equal(data.totalOrders.current, 4);
      assert.equal(data.totalOrders.previous, 3);
      assert.equal(data.totalOrders.absoluteChange, 1);
      assert.equal(data.deliveredOrders.current, 1);
      assert.equal(data.pendingOrders.current, 2);
      assert.equal(data.cancelledOrders.current, 1);
      assert.equal('preparingOrders' in data, false);
      assert.equal(data.ordersDeliveredInPeriod.current, 2);
      assert.equal(data.deliveredOrderValue.current, 1.5);
      assert.equal(data.deliveredOrderValue.previous, 1);
      assert.equal(data.deliveredOrderValue.absoluteChange, 0.5);
      assert.equal(data.deliveredSubtotal.current, 1.3);
      assert.equal(data.deliveredDeliveryFees.current, 0.2);
      assert.equal(data.averageDeliveredOrderValue.current, 0.75);
      assert.equal(data.cancellationRate.current, 25);
      assert.equal(data.deliveryCompletionRate.current, 25);
      assert.equal(data.sparklines.totalOrders.length, 7);
      assert.equal(data.sparklines.deliveredOrderValue.length, 7);
      assert.equal(data.insights.currentCancellationProportion, 25);
      assert.doesNotMatch(JSON.stringify(data), /NaN|Infinity/);
    });

    await t.test('trends are chronological, zero-filled and use deliveredAt', async () => {
      const data = await body(a.session, 'trends');
      assert.equal(data.series.length, 7);
      assert.equal(data.previousSeries.length, 7);
      assert.deepEqual(data.series.map((entry) => entry.date),
        ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
          '2026-01-05', '2026-01-06', '2026-01-07']);
      assert.deepEqual(data.series.map((entry) => entry.ordersCreated), [1, 2, 0, 0, 0, 0, 1]);
      assert.deepEqual(data.series.map((entry) => entry.ordersDelivered), [0, 1, 0, 1, 0, 0, 0]);
      assert.deepEqual(data.series.map((entry) => entry.deliveredOrderValue),
        [0, 1.1, 0, 0.4, 0, 0, 0]);
      assert.equal(data.series[2].averageDeliveredOrderValue, 0);
      assert.equal(data.previousSeries.reduce((sum, row) =>
        sum + row.ordersCreated, 0), 3);
      const weekly = await body(a.session, 'trends',
        '?from=2026-01-01&to=2026-03-31');
      assert.equal(weekly.granularity, 'week');
      assert.equal(weekly.series[0].bucketStart, '2025-12-29T00:00:00.000Z');
      assert.equal(weekly.series[0].ordersCreated, 3);
      const monthly = await body(a.session, 'trends',
        '?from=2025-12-15&to=2026-07-01');
      assert.equal(monthly.granularity, 'month');
      assert.equal(monthly.series[0].bucketStart, '2025-12-01T00:00:00.000Z');
    });

    await t.test('breakdowns use current statuses of orders created in range', async () => {
      const data = await body(a.session, 'breakdowns');
      assert.equal(data.totalOrders, 4);
      assert.deepEqual(data.submissionMethods.map((row) => row.count), [3, 1]);
      assert.deepEqual(data.submissionMethods.map((row) => row.percentage), [75, 25]);
      assert.deepEqual(data.statuses.map((row) => row.count), [2, 1, 1]);
      assert.deepEqual(data.statuses.map((row) => row.percentage), [50, 25, 25]);
      assert.equal(data.statuses.find((row) => row.key === 'delivered').percentage, 25);
    });

    await t.test('top products use delivered snapshots and deterministic ranking', async () => {
      const byQuantity = await body(a.session, 'top-products');
      assert.equal(byQuantity.rankBy, 'quantitySold');
      assert.deepEqual(byQuantity.products.map((row) => row.productId),
        [String(p1), String(p2)]);
      assert.equal(byQuantity.products[0].productName, 'New P1');
      assert.equal(byQuantity.products[0].quantitySold, 5);
      assert.equal(byQuantity.products[0].deliveredItemValue, 0.5);
      assert.equal(byQuantity.products[1].deliveredItemValue, 0.8);
      assert.equal(byQuantity.products[0].rank, 1);
      assert.equal(byQuantity.mostFrequentlyOrderedProduct.productId, String(p1));
      const byValue = await body(a.session, 'top-products',
        `${range}&rankBy=deliveredItemValue&limit=10`);
      assert.deepEqual(byValue.products.map((row) => row.productId),
        [String(p2), String(p1)]);
      assert.equal(byValue.mostFrequentlyOrderedProduct.productId, String(p1));
      for (const query of [`${range}&limit=100`, `${range}&rankBy=profit`,
        `${range}&sort=total`]) {
        assert.equal((await get(a.session, 'top-products', query)).status, 400);
      }
    });

    await t.test('activity is a zero-filled UTC 7 by 24 matrix', async () => {
      const data = await body(a.session, 'activity');
      assert.equal(data.cells.length, 168);
      assert.equal(data.totalOrders, 4);
      assert.deepEqual(data.cells.find((cell) => cell.weekday === 4 && cell.hour === 18),
        { weekday: 4, hour: 18, orders: 2 });
      assert.equal(data.cells.filter((cell) => cell.orders === 0).length, 165);
      assert.deepEqual(data.insights.busiestWeekday, { weekday: 4, orders: 2 });
      assert.deepEqual(data.insights.busiestHour, { hour: 18, orders: 2 });
      assert.deepEqual(data.insights.highestActivityCell,
        { weekday: 4, hour: 18, orders: 2 });
    });

    await t.test('presets and empty tenant return bounded, safe data', async () => {
      for (const [preset, granularity, expectedLength] of [
        ['7d', 'day', 7], ['30d', 'day', 30], ['6m', 'week', null],
        ['12m', 'month', 12],
      ]) {
        const trends = await body(empty.session, 'trends', `?period=${preset}`);
        assert.equal(trends.granularity, granularity);
        if (expectedLength) assert.equal(trends.series.length, expectedLength);
        assert.ok(trends.series.every((entry) => entry.ordersCreated === 0 &&
          entry.deliveredOrderValue === 0));
      }
      const overview = await body(empty.session, 'overview');
      assert.equal(overview.totalOrders.current, 0);
      assert.equal(overview.deliveredOrderValue.current, 0);
      assert.equal(overview.totalOrders.percentageChange, null);
      assert.equal(overview.averageDeliveredOrderValue.current, 0);
      const breakdowns = await body(empty.session, 'breakdowns');
      assert.ok(breakdowns.statuses.every((row) => row.count === 0 &&
        row.percentage === 0));
      const products = await body(empty.session, 'top-products');
      assert.deepEqual(products.products, []);
      assert.equal(products.mostFrequentlyOrderedProduct, null);
      const activity = await body(empty.session, 'activity');
      assert.equal(activity.totalOrders, 0);
      assert.equal(activity.insights.busiestHour, null);
      assert.equal(activity.insights.highestActivityCell, null);
      for (const query of ['?period=unknown', '?period=7d&from=2026-01-01',
        '?from=2026-02-30&to=2026-03-01', '?from=2025-01-01&to=2026-01-02',
        '?period=7d&period=30d']) {
        assert.equal((await get(empty.session, 'overview', query)).status, 400);
      }
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
