import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import OrderSchema from '../src/models/Order.js';
import { provisionRestaurantOwner } from '../src/services/provisionRestaurantOwner.js';

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

test('complete owner and guest API journey on savora_test', async () => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24);
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000,
  });
  const provisions = [];
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
    for (const Model of [OwnerSession, Category, Product, Order]) await Model.createIndexes();

    const suffix = randomUUID().replaceAll('-', '');
    async function provision(label) {
      const result = await provisionRestaurantOwner({
        restaurant: { name: `Journey ${label}`, slug: `it-journey-${label}-${suffix}`,
          currency: 'EGP' },
        owner: { name: `Journey owner ${label}`,
          email: `it-journey-${label}-${suffix}@example.test` },
        password: `Journey-${suffix}-Password!`,
      }, { connection });
      provisions.push(result);
      return result;
    }
    const a = await provision('a');
    const b = await provision('b');
    const origin = 'https://dashboard.example.test';
    server = createApp({ connection, allowedOrigins: origin,
      secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function api(path, { method = 'GET', body, headers = {} } = {}) {
      return fetch(`${base}${path}`, { method, headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    async function json(response, status) {
      assert.equal(response.status, status);
      return response.json();
    }
    async function login(email) {
      const response = await api('/api/auth/login', { method: 'POST',
        body: { email, password: `Journey-${suffix}-Password!` },
        headers: { Origin: origin, 'X-Savora-CSRF': '1' } });
      const result = await json(response, 200);
      const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0]);
      const csrf = cookies.find((value) => value.startsWith('savora_owner_csrf='))?.split('=')[1];
      assert.match(csrf, /^[0-9a-f]{64}$/);
      return { result, cookie: cookies.join('; '), csrf };
    }
    const ownerA = await login(a.ownerEmail);
    const ownerB = await login(b.ownerEmail);
    const own = (owner, mutation = false) => ({ Cookie: owner.cookie,
      ...(mutation ? { Origin: origin, 'X-Savora-CSRF': owner.csrf } : {}) });
    assert.equal(ownerA.result.restaurant.id, String(a.restaurantId));
    assert.equal((await json(await api('/api/auth/me',
      { headers: own(ownerA) }), 200)).restaurant.id, String(a.restaurantId));
    assert.equal((await json(await api('/api/auth/csrf', { headers: {
      ...own(ownerA), Origin: origin } }), 200)).csrfToken, ownerA.csrf);
    assert.equal((await api('/api/auth/csrf', { headers: {
      ...own(ownerA), Origin: 'https://untrusted.example.test' } })).status, 403);

    const settings = await json(await api('/api/owner/restaurant', {
      method: 'PATCH', headers: own(ownerA, true),
      body: { description: 'Journey storefront', deliverySettings: {
        deliveryFee: 5, minimumOrder: 20, deliveryAvailable: true },
      socialLinks: { whatsapp: 'https://wa.me/201001234567' } },
    }), 200);
    assert.equal(settings.restaurant.deliverySettings.deliveryFee, 5);
    const category = (await json(await api('/api/owner/categories', {
      method: 'POST', headers: own(ownerA, true),
      body: { name: 'Meals', slug: `it-journey-meals-${suffix}` },
    }), 201)).category;
    const product = (await json(await api('/api/owner/products', {
      method: 'POST', headers: own(ownerA, true),
      body: { name: 'Journey meal', slug: `it-journey-meal-${suffix}`,
        categoryId: category.id, price: 12.5, isAvailable: true },
    }), 201)).product;
    const publicCategories = await json(await api(
      `/api/public/restaurants/${a.slug}/categories`), 200);
    const publicProducts = await json(await api(
      `/api/public/restaurants/${a.slug}/products`), 200);
    assert.ok(publicCategories.categories.some((row) => row.id === category.id));
    assert.ok(publicProducts.products.some((row) => row.id === product.id));

    const checkoutBody = (method) => ({ customerName: 'Journey guest',
      customerPhone: '+201001234567', deliveryAddress: '12 Test Street',
      city: 'Cairo', submissionMethod: method,
      items: [{ productId: product.id, quantity: 2 }] });
    const checkout = (method, key) => api(
      `/api/public/restaurants/${a.slug}/orders`, { method: 'POST',
        headers: { 'Idempotency-Key': key }, body: checkoutBody(method) });
    const directKey = randomUUID();
    const direct = await json(await checkout('direct', directKey), 201);
    const replay = await json(await checkout('direct', directKey), 200);
    assert.deepEqual(replay, direct);
    const whatsapp = await json(await checkout('whatsapp', randomUUID()), 201);
    assert.equal(whatsapp.whatsapp.messageSent, false);
    assert.match(whatsapp.whatsapp.url, /^https:\/\/wa\.me\//);
    assert.equal(await Order.countDocuments({ restaurantId: a.restaurantId }), 2);
    const savedDirect = await Order.findOne({ restaurantId: a.restaurantId,
      orderNumber: direct.order.orderNumber });
    const savedWhatsapp = await Order.findOne({ restaurantId: a.restaurantId,
      orderNumber: whatsapp.order.orderNumber });
    assert.ok(savedDirect && savedWhatsapp);
    assert.equal(savedDirect.items[0].unitPrice, 12.5);
    assert.equal(savedDirect.total, 30);
    const list = await json(await api('/api/owner/orders',
      { headers: own(ownerA) }), 200);
    assert.ok(list.orders.some((row) => row.id === String(savedDirect._id)));
    assert.ok(list.orders.some((row) => row.id === String(savedWhatsapp._id)));
    const updated = await json(await api(
      `/api/owner/orders/${savedDirect._id}/status`, { method: 'PATCH',
        headers: own(ownerA, true), body: { status: 'delivered' } }), 200);
    assert.equal(updated.order.status, 'delivered');
    assert.ok((await Order.findById(savedDirect._id)).deliveredAt);
    const today = new Date().toISOString().slice(0, 10);
    const range = `?from=${today}&to=${today}`;
    for (const route of ['overview', 'trends', 'top-products', 'breakdowns', 'activity']) {
      const result = await json(await api(`/api/owner/stats/${route}${range}`,
        { headers: own(ownerA) }), 200);
      assert.equal(result.currency, 'EGP');
      if (route === 'overview') {
        assert.equal(result.totalOrders.current, 2);
        assert.equal(result.deliveredOrderValue.current, 30);
        assert.equal(result.pendingOrders.current, 1);
      }
      if (route === 'top-products') assert.equal(result.products[0].quantitySold, 2);
      if (route === 'activity') assert.equal(result.totalOrders, 2);
    }
    assert.equal((await api(`/api/owner/orders/${savedDirect._id}`,
      { headers: own(ownerB) })).status, 404);
    assert.equal((await api(`/api/owner/products/${product.id}`,
      { headers: own(ownerB) })).status, 404);
    assert.equal((await json(await api(`/api/owner/stats/overview${range}`,
      { headers: own(ownerB) }), 200)).totalOrders.current, 0);
    assert.equal((await api(`/api/owner/products/${product.id}`, {
      method: 'PATCH', headers: own(ownerB, true), body: { name: 'Stolen' },
    })).status, 404);
    assert.equal((await api('/api/auth/logout', { method: 'POST',
      headers: own(ownerA, true) })).status, 204);
    assert.equal((await api('/api/auth/me', { headers: own(ownerA) })).status, 401);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1 && connection.name === 'savora_test' &&
        connection.db.databaseName === 'savora_test') {
      for (const tenant of provisions) {
        for (const [name, filter] of [
          ['OwnerSession', { userId: tenant.ownerId }],
          ['Order', { restaurantId: tenant.restaurantId }],
          ['Product', { restaurantId: tenant.restaurantId }],
          ['Category', { restaurantId: tenant.restaurantId }],
        ]) {
          const Model = connection.models[name];
          const ids = await Model.find(filter).select('_id').lean();
          for (const { _id } of ids) await Model.deleteOne({ _id });
        }
        await connection.models.User.deleteOne({ _id: tenant.ownerId });
        await connection.models.Restaurant.deleteOne({ _id: tenant.restaurantId });
      }
    }
    await connection.close();
  }
});
