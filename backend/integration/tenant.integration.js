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
import { authenticateOwner, tokenHash } from '../src/services/ownerAuth.js';
import { createOwnerTenantScope, OwnerResourceNotFound } from '../src/services/ownerTenant.js';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  try {
    const parsed = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol));
    assert.equal(decodeURIComponent(parsed.username), 'savora_test_user');
    assert.equal(parsed.pathname, '/savora_test');
    assert.equal([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'), false);
  } catch {
    throw new Error('MONGODB_TEST_URI failed test database safety checks');
  }
  return value;
}

test('owner tenant isolation on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const created = new Map();
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
    const models = [Restaurant, User, OwnerSession, Category, Product, Order];
    for (const Model of models) created.set(Model.modelName, []);

    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      created.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    async function sessionFor(user, expiresAt = new Date(Date.now() + 60_000)) {
      const raw = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      const session = await fixture(OwnerSession, {
        userId: user._id, tokenHash: tokenHash(raw),
        csrfTokenHash: tokenHash(csrf), expiresAt,
      });
      return { raw, csrf, session,
        cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}` };
    }

    const suffix = randomUUID().replaceAll('-', '');
    const tenants = [];
    for (const letter of ['a', 'b']) {
      const restaurant = await fixture(Restaurant, {
        name: `Tenant ${letter}`, slug: `it-tenant-${letter}-${suffix}`, currency: 'EGP',
        description: `Description ${letter}`,
        deliverySettings: { deliveryFee: 3, minimumOrder: 12, deliveryAvailable: true },
        socialLinks: { instagram: `https://instagram.com/tenant${letter}` },
        branding: { brandName: `Brand ${letter}`, primaryColor: '#abc' },
      });
      const user = await fixture(User, {
        restaurantId: restaurant._id, name: `Owner ${letter}`,
        email: `it-tenant-${letter}-${suffix}@example.test`, passwordHash: 'test-only-hash',
      });
      const category = await fixture(Category, {
        restaurantId: restaurant._id, name: `Category ${letter}`,
        slug: `category-${letter}-${suffix}`,
      });
      const product = await fixture(Product, {
        restaurantId: restaurant._id, categoryId: category._id,
        name: `Product ${letter}`, slug: `product-${letter}-${suffix}`, price: 10,
      });
      const order = await fixture(Order, {
        restaurantId: restaurant._id, orderNumber: `IT-${letter}-${suffix}`,
        customerName: 'Test Guest', customerPhone: '+201000000000',
        deliveryAddress: '12 Test Street', city: 'Cairo',
        items: [{ productId: product._id, name: 'Snapshot', unitPrice: 10, quantity: 1 }],
        subtotal: 10, total: 10, submissionMethod: 'direct',
        trackingTokenHash: 'internal-test-hash',
      });
      const session = await sessionFor(user);
      tenants.push({ restaurant, user, category, product, order, session });
    }

    server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test',
      secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/owner/restaurant`;
    const getRestaurant = (cookie, query = '', headers = {}) => fetch(`${url}${query}`, {
      headers: { Cookie: cookie, ...headers },
    });
    const patchRestaurant = (session, body, { requestOrigin = 'https://dashboard.example.test',
      csrf = session?.csrf, query = '', headers = {} } = {}) => fetch(`${url}${query}`, {
      method: 'PATCH',
      headers: { ...(session ? { Cookie: session.cookie } : {}), Origin: requestOrigin,
        'X-Savora-CSRF': csrf ?? '', 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    await t.test('missing, expired, and revoked sessions return 401', async () => {
      assert.equal((await fetch(url)).status, 401);
      const expired = await sessionFor(tenants[0].user, new Date(Date.now() - 1000));
      const expiredResponse = await getRestaurant(expired.cookie);
      assert.equal(expiredResponse.status, 401);
      assert.ok(expiredResponse.headers.getSetCookie().some((value) => value.includes('Max-Age=0')));
      const revoked = await sessionFor(tenants[0].user);
      await OwnerSession.deleteOne({ _id: revoked.session._id });
      assert.equal((await getRestaurant(revoked.cookie)).status, 401);
      assert.equal((await patchRestaurant(expired, { name: 'Expired' })).status, 401);
      assert.equal((await patchRestaurant(revoked, { name: 'Revoked' })).status, 401);
    });

    await t.test('each owner sees only their restaurant despite forged tenant inputs', async () => {
      for (const [index, tenant] of tenants.entries()) {
        const other = tenants[1 - index];
        const response = await getRestaurant(tenant.session.cookie,
          `?restaurantId=${other.restaurant._id}&userId=${other.user._id}&role=owner`, {
            restaurantId: String(other.restaurant._id),
            userId: String(other.user._id), role: 'owner',
          });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.restaurant.id, String(tenant.restaurant._id));
        assert.equal(body.restaurant.slug, tenant.restaurant.slug);
        assert.equal(body.restaurant.description, `Description ${index === 0 ? 'a' : 'b'}`);
        assert.equal(body.restaurant.deliverySettings.minimumOrder, 12);
        assert.equal(body.restaurant.branding.primaryColor, '#abc');
        assert.doesNotMatch(JSON.stringify(body),
          /passwordHash|trackingTokenHash|tokenHash|csrfTokenHash|credentials|internal-test-hash/);
      }
    });

    await t.test('PATCH edits only the authenticated restaurant and preserves nested settings', async () => {
      const ownerA = tenants[0];
      const ownerB = tenants[1];
      const response = await patchRestaurant(ownerA.session, {
        name: 'Updated A', contactEmail: 'OWNER@EXAMPLE.TEST',
        logoUrl: 'https://example.test/logo.png',
        deliverySettings: { deliveryFee: 7, deliveryAvailable: false },
        socialLinks: { whatsapp: 'https://wa.me/201000000000' },
        branding: { primaryColor: '#123456' },
      }, { query: `?restaurantId=${ownerB.restaurant._id}&userId=${ownerB.user._id}&role=owner`,
        headers: { restaurantId: String(ownerB.restaurant._id),
          userId: String(ownerB.user._id), role: 'owner' } });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.restaurant.id, String(ownerA.restaurant._id));
      assert.equal(result.restaurant.name, 'Updated A');
      assert.equal(result.restaurant.contactEmail, 'owner@example.test');
      assert.equal(result.restaurant.deliverySettings.deliveryFee, 7);
      assert.equal(result.restaurant.deliverySettings.minimumOrder, 12);
      assert.equal(result.restaurant.deliverySettings.deliveryAvailable, false);
      assert.equal(result.restaurant.socialLinks.instagram, 'https://instagram.com/tenanta');
      assert.equal(result.restaurant.branding.brandName, 'Brand a');
      assert.equal(result.restaurant.branding.primaryColor, '#123456');
      assert.doesNotMatch(JSON.stringify(result),
        /passwordHash|trackingTokenHash|tokenHash|csrfTokenHash|credentials|internal-test-hash/);
      const persistedA = await Restaurant.findById(ownerA.restaurant._id);
      const persistedB = await Restaurant.findById(ownerB.restaurant._id);
      assert.equal(persistedA.name, 'Updated A');
      assert.equal(persistedA.deliverySettings.minimumOrder, 12);
      assert.equal(persistedB.name, 'Tenant b');
      assert.equal(persistedB.deliverySettings.deliveryFee, 3);
      const readB = await getRestaurant(ownerB.session.cookie);
      assert.equal((await readB.json()).restaurant.name, 'Tenant b');
      const updateB = await patchRestaurant(ownerB.session, { openingHours: '9 AM - 9 PM' });
      assert.equal(updateB.status, 200);
      assert.equal((await updateB.json()).restaurant.openingHours, '9 AM - 9 PM');
      assert.equal((await Restaurant.findById(ownerA.restaurant._id)).openingHours, undefined);
    });

    await t.test('PATCH requires session, trusted Origin, and session-bound CSRF', async () => {
      assert.equal((await patchRestaurant(null, { name: 'No session' })).status, 401);
      const ownerA = tenants[0];
      assert.equal((await patchRestaurant(ownerA.session, { name: 'Bad origin' },
        { requestOrigin: 'https://other.example.test' })).status, 403);
      assert.equal((await patchRestaurant(ownerA.session, { name: 'Bad CSRF' },
        { csrf: 'a'.repeat(64) })).status, 403);
      assert.equal((await Restaurant.findById(ownerA.restaurant._id)).name, 'Updated A');
      const preflight = await fetch(url, { method: 'OPTIONS', headers: {
        Origin: 'https://dashboard.example.test', 'Access-Control-Request-Method': 'PATCH',
      } });
      assert.equal(preflight.status, 204);
      assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
    });

    await t.test('PATCH rejects immutable, unknown, operator, malformed and invalid values', async () => {
      const ownerA = tenants[0];
      for (const body of [
        { _id: String(tenants[1].restaurant._id) }, { slug: 'changed-slug' },
        { status: 'suspended' }, { currency: 'USD' },
        { restaurantId: String(tenants[1].restaurant._id) },
        { unknown: true }, { $set: { name: 'Injected' } },
        { 'deliverySettings.minimumOrder': 1 },
        { deliverySettings: { $set: { deliveryFee: 1 } } },
        JSON.parse('{"__proto__":{"polluted":true}}'),
        { deliverySettings: { deliveryFee: -2 } },
        { deliverySettings: { deliveryFee: '2' } },
        { socialLinks: { facebook: 'javascript:alert(1)' } },
        { branding: { primaryColor: 'orange' } },
        { contactEmail: 'invalid' }, { name: '  ' },
      ]) {
        const response = await patchRestaurant(ownerA.session, body);
        assert.equal(response.status, 400, JSON.stringify(body));
        assert.deepEqual(await response.json(), { error: 'Invalid restaurant settings' });
      }
      const malformed = await patchRestaurant(ownerA.session, '{');
      assert.equal(malformed.status, 400);
      const oversized = await patchRestaurant(ownerA.session, { description: 'x'.repeat(9000) });
      assert.equal(oversized.status, 413);
      assert.equal((await Restaurant.findById(ownerA.restaurant._id)).name, 'Updated A');
      assert.equal({}.polluted, undefined);
    });

    await t.test('inactive owner and suspended restaurant are rejected on existing sessions', async () => {
      const tenant = tenants[0];
      try {
        await User.updateOne({ _id: tenant.user._id }, { $set: { isActive: false } });
        assert.equal((await getRestaurant(tenant.session.cookie)).status, 401);
      } finally {
        await User.updateOne({ _id: tenant.user._id }, { $set: { isActive: true } });
      }
      const nextSession = await sessionFor(tenant.user);
      try {
        await Restaurant.updateOne({ _id: tenant.restaurant._id },
          { $set: { status: 'suspended' } });
        assert.equal((await getRestaurant(nextSession.cookie)).status, 401);
      } finally {
        await Restaurant.updateOne({ _id: tenant.restaurant._id },
          { $set: { status: 'active' } });
      }
    });

    await t.test('Category, Product, and Order reads and writes stay inside owner A tenant', async () => {
      const ownerASession = await sessionFor(tenants[0].user);
      const verified = await authenticateOwner(connection, ownerASession.raw);
      assert.deepEqual(JSON.parse(JSON.stringify(verified)), {
        userId: String(tenants[0].user._id),
        restaurantId: String(tenants[0].restaurant._id),
      });
      const scopeA = createOwnerTenantScope(connection, verified);
      const own = tenants[0];
      const foreign = tenants[1];
      for (const [scope, Model, ownDoc, foreignDoc, field] of [
        [scopeA.categories, Category, own.category, foreign.category, 'name'],
        [scopeA.products, Product, own.product, foreign.product, 'name'],
        [scopeA.orders, Order, own.order, foreign.order, 'status'],
      ]) {
        assert.equal(String((await scope.findById(ownDoc._id))._id), String(ownDoc._id));
        assert.equal(await scope.findById(foreignDoc._id), null);
        assert.equal((await scope.find({ restaurantId: foreign.restaurant._id })).length, 0);
        const original = foreignDoc[field];
        const replacement = field === 'status' ? 'cancelled' : 'Unauthorized change';
        const write = await Model.updateOne(scope.idFilter(foreignDoc._id),
          { $set: { [field]: replacement } });
        assert.equal(write.matchedCount, 0);
        assert.equal((await Model.findById(foreignDoc._id))[field], original);
      }
    });

    await t.test('foreign Category and Product references fail with non-disclosing 404', async () => {
      const ownerASession = await sessionFor(tenants[0].user);
      const verified = await authenticateOwner(connection, ownerASession.raw);
      const scopeA = createOwnerTenantScope(connection, verified);
      assert.equal(String((await scopeA.requireCategory(tenants[0].category._id))._id),
        String(tenants[0].category._id));
      assert.equal(String((await scopeA.requireProduct(tenants[0].product._id))._id),
        String(tenants[0].product._id));
      for (const check of [
        () => scopeA.requireCategory(tenants[1].category._id),
        () => scopeA.requireProduct(tenants[1].product._id),
        () => scopeA.requireCategory('invalid'),
      ]) {
        await assert.rejects(check, (error) =>
          error instanceof OwnerResourceNotFound && error.status === 404 &&
          error.message === 'Not found');
      }
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      for (const name of ['OwnerSession', 'Order', 'Product', 'Category', 'User', 'Restaurant']) {
        const Model = connection.models[name];
        for (const _id of created.get(name) ?? []) await Model.deleteOne({ _id });
      }
    }
    await connection.close();
  }
});
