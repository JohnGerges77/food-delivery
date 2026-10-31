import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
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

test('secure guest checkout on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24,
    'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const ids = new Map();
  let server;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const OwnerSession = connection.model('OwnerSession', OwnerSessionSchema.schema);
    const Category = connection.model('Category', CategorySchema.schema);
    const Product = connection.model('Product', ProductSchema.schema);
    const Order = connection.model('Order', OrderSchema.schema);
    for (const model of [Restaurant, User, OwnerSession, Category, Product, Order]) {
      ids.set(model.modelName, []);
    }
    await Order.createIndexes();
    assert.ok((await Order.collection.listIndexes().toArray()).some((index) =>
      index.unique && index.key.restaurantId === 1 && index.key.idempotencyKeyHash === 1));
    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      ids.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    const suffix = randomUUID().replaceAll('-', '');
    const a = await fixture(Restaurant, { name: 'Checkout A',
      slug: `it-checkout-a-${suffix}`, currency: 'EGP',
      socialLinks: { whatsapp: 'https://wa.me/201001234567' },
      deliverySettings: { deliveryAvailable: true, deliveryFee: 7.5, minimumOrder: 20 } });
    const b = await fixture(Restaurant, { name: 'Checkout B',
      slug: `it-checkout-b-${suffix}`, currency: 'EGP' });
    const suspended = await fixture(Restaurant, { name: 'Suspended',
      slug: `it-checkout-s-${suffix}`, currency: 'EGP', status: 'suspended' });
    const category = await fixture(Category, { restaurantId: a._id,
      name: 'Meals', slug: `it-checkout-meals-${suffix}` });
    const inactive = await fixture(Category, { restaurantId: a._id,
      name: 'Hidden', slug: `it-checkout-hidden-${suffix}`, isActive: false });
    const foreignCategory = await fixture(Category, { restaurantId: b._id,
      name: 'Foreign', slug: `it-checkout-foreign-${suffix}` });
    async function product(data = {}) {
      return fixture(Product, { restaurantId: a._id, categoryId: category._id,
        name: 'Burger', slug: `it-checkout-${randomUUID().replaceAll('-', '')}`,
        price: 12.34, imageUrl: '/burger.webp', ...data });
    }
    const main = await product();
    const unavailable = await product({ isAvailable: false });
    const hidden = await product({ categoryId: inactive._id });
    const foreign = await fixture(Product, { restaurantId: b._id,
      categoryId: foreignCategory._id, name: 'Foreign',
      slug: `it-checkout-burger-${suffix}`, price: 1 });
    const bOrderable = await fixture(Product, { restaurantId: b._id,
      categoryId: foreignCategory._id, name: 'B meal',
      slug: `it-checkout-b-meal-${suffix}`, price: 25 });
    const badCategory = await product({ categoryId: foreignCategory._id });
    const owner = await fixture(User, { restaurantId: a._id, name: 'Owner',
      email: `it-checkout-${suffix}@example.test`, passwordHash: 'test-only-hash' });
    const raw = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    await fixture(OwnerSession, { userId: owner._id, tokenHash: tokenHash(raw),
      csrfTokenHash: tokenHash(csrf), expiresAt: new Date(Date.now() + 900_000) });

    server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test',
      secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const body = (productId = main._id, method = 'direct') => ({
      customerName: 'Mona', customerPhone: '+201001234567',
      customerEmail: 'mona@example.test', deliveryAddress: '12 Nile Street',
      city: 'Cairo', notes: 'Ring bell', submissionMethod: method,
      items: [{ productId: String(productId), quantity: 2, notes: 'No onions' }],
    });
    const post = (slug, payload, key = randomUUID()) => fetch(
      `${base}/api/public/restaurants/${slug}/orders`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload) });
    const ownerDelete = (id) => fetch(`${base}/api/owner/products/${id}`, {
      method: 'DELETE', headers: { Cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}`,
        Origin: 'https://dashboard.example.test', 'X-Savora-CSRF': csrf },
    });

    await t.test('direct checkout saves trusted snapshots and survives product repricing', async () => {
      const response = await post(a.slug, body());
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('set-cookie'), null);
      const result = await response.json();
      assert.equal(result.order.savedInSavora, true);
      assert.equal(result.order.status, 'pending');
      assert.equal(result.order.subtotal, 24.68);
      assert.equal(result.order.deliveryFee, 7.5);
      assert.equal(result.order.total, 32.18);
      assert.match(result.order.orderNumber, /^SV-[0-9A-F]{24}$/);
      assert.equal(result.whatsapp, undefined);
      assert.ok(!JSON.stringify(result).includes('mona@example.test'));
      const saved = await Order.findOne({ restaurantId: a._id,
        orderNumber: result.order.orderNumber });
      assert.equal(saved.source, 'website');
      assert.equal(String(saved.restaurantId), String(a._id));
      assert.equal(saved.items[0].name, 'Burger');
      assert.equal(saved.items[0].unitPrice, 12.34);
      assert.equal(saved.items[0].imageUrl, '/burger.webp');
      assert.equal(saved.items[0].notes, 'No onions');
      await Product.updateOne({ _id: main._id }, { $set: { price: 99, name: 'Changed' } });
      const unchanged = await Order.findById(saved._id);
      assert.equal(unchanged.items[0].name, 'Burger');
      assert.equal(unchanged.items[0].unitPrice, 12.34);
      await Product.updateOne({ _id: main._id }, { $set: { price: 12.34, name: 'Burger' } });
    });

    await t.test('WhatsApp handoff follows persistence and replay recovers one order', async () => {
      const key = randomUUID();
      const request = body(main._id, 'whatsapp');
      const first = await post(a.slug, request, key);
      assert.equal(first.status, 201);
      const data = await first.json();
      assert.equal(data.whatsapp.messageSent, false);
      assert.match(data.whatsapp.url, /^https:\/\/wa\.me\/201001234567\?text=/);
      assert.ok(await Order.exists({ restaurantId: a._id,
        orderNumber: data.order.orderNumber }));
      const second = await post(a.slug, { ...request, customerName: ' Mona ' }, key);
      assert.equal(second.status, 200);
      assert.deepEqual(await second.json(), data);
      assert.equal((await post(a.slug, { ...request, notes: 'Different' }, key)).status, 409);
      assert.equal(await Order.countDocuments({ restaurantId: a._id,
        orderNumber: data.order.orderNumber }), 1);
      const sameKeyOtherTenant = await post(b.slug, body(bOrderable._id, 'direct'), key);
      assert.equal(sameKeyOtherTenant.status, 201);
      assert.notEqual((await sameKeyOtherTenant.json()).order.orderNumber,
        data.order.orderNumber);
    });

    await t.test('concurrent identical retries produce one order and unique numbers', async () => {
      const key = randomUUID();
      const item = await product({ price: 25 });
      const [left, right] = await Promise.all([
        post(a.slug, body(item._id), key), post(a.slug, body(item._id), key),
      ]);
      assert.deepEqual([left.status, right.status].sort(), [200, 201]);
      const [one, two] = await Promise.all([left.json(), right.json()]);
      assert.equal(one.order.orderNumber, two.order.orderNumber);
      assert.equal(await Order.countDocuments({ restaurantId: a._id,
        orderNumber: one.order.orderNumber }), 1);
      const numbers = await Order.distinct('orderNumber', { restaurantId: a._id });
      assert.equal(numbers.length, await Order.countDocuments({ restaurantId: a._id }));
    });

    await t.test('untrusted and unavailable checkout attempts never save an order', async () => {
      const before = await Order.countDocuments({ restaurantId: a._id });
      for (const [slug, payload, status] of [
        [suspended.slug, body(), 404], ['missing-restaurant', body(), 404],
        [a.slug, body(unavailable._id), 409], [a.slug, body(hidden._id), 409],
        [a.slug, body(foreign._id), 409], [a.slug, body(badCategory._id), 409],
        [a.slug, { ...body(), total: 1 }, 400],
        [a.slug, { ...body(), items: [{ productId: String(main._id), quantity: 0 }] }, 400],
        [a.slug, { ...body(), items: [{ productId: 'bad', quantity: 1 }] }, 400],
        [a.slug, '{', 400],
      ]) assert.equal((await post(slug, payload)).status, status);
      assert.equal(await Order.countDocuments({ restaurantId: a._id }), before);
      await Restaurant.updateOne({ _id: a._id }, { $set: { 'deliverySettings.minimumOrder': 50 } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.minimumOrder': 20, 'deliverySettings.deliveryAvailable': false } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryAvailable': true } });
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryFee': 1.234 } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryFee': 7.5 } });
      assert.equal((await post(b.slug, body(bOrderable._id, 'whatsapp'))).status, 409);
    });

    await t.test('checkout and owner hard delete cannot leave an orphan', async () => {
      for (let i = 0; i < 4; i++) {
        const item = await product({ price: 25 });
        const [checkout, deletion] = await Promise.all([
          post(a.slug, body(item._id)), ownerDelete(item._id),
        ]);
        const exists = Boolean(await Product.exists({ _id: item._id }));
        const saved = Boolean(await Order.exists({ 'items.productId': item._id }));
        assert.equal(saved && !exists, false);
        if (checkout.status === 201) {
          assert.equal(exists, true);
          assert.equal(deletion.status, 409);
        } else {
          assert.equal(deletion.status, 204);
          assert.equal(checkout.status, 409);
        }
      }
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      await connection.models.Order.deleteMany({ restaurantId: { $in: ids.get('Restaurant') } });
      for (const name of ['OwnerSession', 'Product', 'Category', 'User', 'Restaurant']) {
        for (const _id of ids.get(name) ?? []) {
          await connection.models[name].deleteOne({ _id });
        }
      }
    }
    await connection.close();
  }
});
