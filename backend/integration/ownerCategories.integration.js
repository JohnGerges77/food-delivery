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
    assert.equal([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'), false);
  } catch {
    throw new Error('MONGODB_TEST_URI failed test database safety checks');
  }
  return value;
}

test('owner Category CRUD on savora_test', async (t) => {
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
    for (const Model of [Restaurant, User, OwnerSession, Category, Product]) {
      created.set(Model.modelName, []);
    }
    await Category.createIndexes();
    assert.ok((await Category.collection.listIndexes().toArray()).some((index) =>
      index.unique && index.key.restaurantId === 1 && index.key.slug === 1));

    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      created.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    async function sessionFor(user, expiresAt = new Date(Date.now() + 600_000)) {
      const raw = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      await fixture(OwnerSession, { userId: user._id, tokenHash: tokenHash(raw),
        csrfTokenHash: tokenHash(csrf), expiresAt });
      return { csrf, cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}` };
    }
    const suffix = randomUUID().replaceAll('-', '');
    const tenants = [];
    for (const letter of ['a', 'b']) {
      const restaurant = await fixture(Restaurant, {
        name: `Categories ${letter}`, slug: `it-categories-${letter}-${suffix}`, currency: 'EGP',
      });
      const user = await fixture(User, { restaurantId: restaurant._id,
        name: `Owner ${letter}`, email: `it-categories-${letter}-${suffix}@example.test`,
        passwordHash: 'test-only-hash' });
      tenants.push({ restaurant, user, session: await sessionFor(user) });
    }

    server = createApp({ connection, allowedOrigins: origin, secureCookies: true })
      .listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/categories`;
    const request = (session, method, path = '', body, options = {}) => fetch(`${base}${path}`, {
      method,
      headers: { ...(session ? { Cookie: session.cookie } : {}),
        ...(method !== 'GET' ? { Origin: options.origin ?? origin,
          'X-Savora-CSRF': options.csrf ?? session?.csrf ?? '' } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
    async function createCategory(session, data) {
      const response = await request(session, 'POST', '', data);
      assert.equal(response.status, 201);
      const { category } = await response.json();
      created.get('Category').push(new mongoose.Types.ObjectId(category.id));
      return category;
    }

    await t.test('missing, invalid, and expired sessions return 401', async () => {
      assert.equal((await request(null, 'GET')).status, 401);
      assert.equal((await request(null, 'POST', '', { name: 'A', slug: 'a' })).status, 401);
      const invalid = await request({ cookie: `savora_owner_session=${'a'.repeat(64)}` }, 'GET');
      assert.equal(invalid.status, 401);
      assert.ok(invalid.headers.getSetCookie().some((cookie) => cookie.includes('Max-Age=0')));
      const expired = await sessionFor(tenants[0].user, new Date(Date.now() - 1000));
      assert.equal((await request(expired, 'GET')).status, 401);
    });

    await t.test('owner creates, reads, patches, lists and deletes a category', async () => {
      const owner = tenants[0];
      const category = await createCategory(owner.session, {
        name: '  Burgers  ', slug: `  BURGERS-${suffix.toUpperCase()}  `,
        description: 'Fresh', imageUrl: '/home2.webp', sortOrder: 4, isActive: true,
      });
      assert.equal(category.name, 'Burgers');
      assert.equal(category.slug, `burgers-${suffix}`);
      assert.deepEqual(Object.keys(category), [
        'id', 'name', 'slug', 'description', 'imageUrl', 'sortOrder', 'isActive',
      ]);
      assert.doesNotMatch(JSON.stringify(category), /passwordHash|tokenHash|restaurantId|credentials/);
      const read = await request(owner.session, 'GET', `/${category.id}`);
      assert.equal(read.status, 200);
      assert.deepEqual((await read.json()).category, category);
      const update = await request(owner.session, 'PATCH', `/${category.id}`,
        { name: 'New burgers', isActive: false });
      assert.equal(update.status, 200);
      const updated = (await update.json()).category;
      assert.equal(updated.name, 'New burgers');
      assert.equal(updated.slug, category.slug);
      assert.equal(updated.description, 'Fresh');
      assert.equal(updated.imageUrl, '/home2.webp');
      assert.equal(updated.sortOrder, 4);
      assert.equal(updated.isActive, false);
      const list = await request(owner.session, 'GET', '?page=1&limit=10');
      assert.equal(list.status, 200);
      assert.ok((await list.json()).categories.some((item) => item.id === category.id));
      const deletion = await request(owner.session, 'DELETE', `/${category.id}`);
      assert.equal(deletion.status, 204);
      assert.equal((await request(owner.session, 'GET', `/${category.id}`)).status, 404);
      assert.equal(await Category.countDocuments({ _id: category.id }), 0);
    });

    await t.test('tenant scoped uniqueness and cross-tenant 404s', async () => {
      const [a, b] = tenants;
      const slug = `shared-${suffix}`;
      const own = await createCategory(a.session, { name: 'A shared', slug });
      const duplicate = await request(a.session, 'POST', '', { name: 'Duplicate', slug });
      assert.equal(duplicate.status, 409);
      assert.deepEqual(await duplicate.json(), { error: 'Category slug already exists' });
      const another = await createCategory(a.session,
        { name: 'Another A', slug: `another-${suffix}` });
      const duplicateUpdate = await request(a.session, 'PATCH', `/${another.id}`, { slug });
      assert.equal(duplicateUpdate.status, 409);
      assert.equal((await Category.findById(another.id)).slug, `another-${suffix}`);
      const foreign = await createCategory(b.session, { name: 'B shared', slug });
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const response = await request(a.session, method, `/${foreign.id}`,
          method === 'PATCH' ? { name: 'Cross-tenant change' } : undefined);
        assert.equal(response.status, 404);
        if (method !== 'DELETE') assert.deepEqual(await response.json(), { error: 'Not found' });
      }
      const forgedRead = await request(a.session, 'GET',
        `/${own.id}?restaurantId=${b.restaurant._id}`,
        undefined, { headers: { restaurantId: String(b.restaurant._id), role: 'owner' } });
      assert.equal((await forgedRead.json()).category.id, own.id);
      const forgedWrite = await request(a.session, 'PATCH',
        `/${own.id}?restaurantId=${b.restaurant._id}`,
        { name: 'Still A' }, { headers: { restaurantId: String(b.restaurant._id) } });
      assert.equal(forgedWrite.status, 200);
      assert.equal((await forgedWrite.json()).category.id, own.id);
      assert.equal((await Category.findById(foreign.id)).name, 'B shared');
      assert.equal((await Category.findById(own.id)).restaurantId.toString(),
        String(a.restaurant._id));
      const forgedBody = await request(a.session, 'POST', '',
        { name: 'Forged', slug: `forged-${suffix}`, restaurantId: b.restaurant._id });
      assert.equal(forgedBody.status, 400);
    });

    await t.test('Origin and CSRF guards block every mutation', async () => {
      const owner = tenants[0];
      const own = await createCategory(owner.session,
        { name: 'Protected', slug: `protected-${suffix}` });
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        const path = method === 'POST' ? '' : `/${own.id}`;
        const body = method === 'DELETE' ? undefined : { name: 'Blocked', slug: `blocked-${suffix}` };
        assert.equal((await request(owner.session, method, path, body,
          { origin: 'https://other.example.test' })).status, 403);
        assert.equal((await request(owner.session, method, path, body,
          { csrf: 'b'.repeat(64) })).status, 403);
      }
      assert.equal((await Category.findById(own.id)).name, 'Protected');
      const preflight = await fetch(base, { method: 'OPTIONS', headers: {
        Origin: origin, 'Access-Control-Request-Method': 'DELETE',
      } });
      assert.equal(preflight.status, 204);
      assert.match(preflight.headers.get('access-control-allow-methods'), /DELETE/);
    });

    await t.test('invalid IDs, fields, values, and list queries fail safely', async () => {
      const owner = tenants[0];
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const response = await request(owner.session, method, '/invalid-id',
          method === 'PATCH' ? { name: 'Nope' } : undefined);
        assert.equal(response.status, 404);
      }
      const unknownId = new mongoose.Types.ObjectId();
      assert.equal((await request(owner.session, 'GET', `/${unknownId}`)).status, 404);
      const own = await createCategory(owner.session,
        { name: 'Validation', slug: `validation-${suffix}` });
      for (const body of [
        {}, { name: 'Only name' }, { name: '   ', slug: `bad-${suffix}` },
        { name: 'Bad', slug: 'bad slug' }, { _id: own.id },
        { restaurantId: String(tenants[1].restaurant._id) },
        { createdAt: new Date().toISOString() }, { $set: { name: 'Bad' } },
        { 'name.first': 'Bad' }, JSON.parse('{"__proto__":{"polluted":true}}'),
        { imageUrl: 'javascript:alert(1)' }, { sortOrder: -1 },
        { sortOrder: '5' }, { isActive: 'false' },
      ]) {
        assert.equal((await request(owner.session, 'POST', '', body)).status, 400,
          JSON.stringify(body));
      }
      for (const body of [
        {}, { restaurantId: String(tenants[1].restaurant._id) },
        { unknown: true }, { $set: { name: 'Bad' } }, { slug: 'bad slug' },
        { name: { $ne: null } }, { sortOrder: 1.5 },
      ]) {
        assert.equal((await request(owner.session, 'PATCH', `/${own.id}`, body)).status, 400,
          JSON.stringify(body));
      }
      assert.equal((await request(owner.session, 'POST', '', '{')).status, 400);
      assert.equal((await request(owner.session, 'POST', '',
        { name: 'Too big', slug: 'too-big', description: 'x'.repeat(9000) })).status, 413);
      for (const query of ['?restaurantId=x', '?page=0', '?page=1001',
        '?limit=101', '?sort=name', '?sort=sortOrder&sort=-sortOrder']) {
        assert.equal((await request(owner.session, 'GET', query)).status, 400, query);
      }
      assert.equal((await Category.findById(own.id)).name, 'Validation');
      assert.equal({}.polluted, undefined);
    });

    await t.test('pagination has stable sortOrder and id tie breaks', async () => {
      const owner = tenants[0];
      for (const [index, sortOrder] of [2, 1, 1, 3].entries()) {
        await createCategory(owner.session, { name: `Page ${index}`,
          slug: `page-${index}-${suffix}`, sortOrder });
      }
      const all = await request(owner.session, 'GET', '?limit=100');
      assert.equal(all.status, 200);
      const full = await all.json();
      assert.equal(full.pagination.page, 1);
      assert.equal(full.pagination.limit, 100);
      assert.ok(full.categories.every((item) =>
        !String(item.name).startsWith('B shared')));
      const ordered = [...full.categories].sort((left, right) =>
        left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
      assert.deepEqual(full.categories.map((item) => item.id), ordered.map((item) => item.id));
      const first = await (await request(owner.session, 'GET', '?page=1&limit=2')).json();
      const second = await (await request(owner.session, 'GET', '?page=2&limit=2')).json();
      assert.deepEqual([...first.categories, ...second.categories].map((item) => item.id),
        full.categories.slice(0, 4).map((item) => item.id));
      assert.equal(first.pagination.total, full.categories.length);
      assert.equal(first.pagination.hasNext, true);
      const descending = await (await request(owner.session, 'GET',
        '?sort=-sortOrder&limit=100')).json();
      const expectedDescending = [...full.categories].sort((left, right) =>
        right.sortOrder - left.sortOrder || left.id.localeCompare(right.id));
      assert.deepEqual(descending.categories.map((item) => item.id),
        expectedDescending.map((item) => item.id));
    });

    await t.test('product references block deletion, even when unavailable', async () => {
      const owner = tenants[0];
      const category = await createCategory(owner.session,
        { name: 'In use', slug: `in-use-${suffix}` });
      const product = await fixture(Product, { restaurantId: owner.restaurant._id,
        categoryId: category.id, name: 'Unavailable', slug: `unavailable-${suffix}`,
        price: 10, isAvailable: false });
      const blocked = await request(owner.session, 'DELETE', `/${category.id}`);
      assert.equal(blocked.status, 409);
      assert.deepEqual(await blocked.json(),
        { error: 'Category has products; deactivate it instead' });
      assert.ok(await Category.findById(category.id));
      assert.ok(await Product.findById(product._id));
      const inactive = await request(owner.session, 'PATCH', `/${category.id}`,
        { isActive: false });
      assert.equal(inactive.status, 200);
      assert.equal((await inactive.json()).category.isActive, false);
      await Product.deleteOne({ _id: product._id });
      const inconsistent = await fixture(Product, { restaurantId: tenants[1].restaurant._id,
        categoryId: category.id, name: 'Inconsistent reference',
        slug: `inconsistent-${suffix}`, price: 10 });
      assert.equal((await request(owner.session, 'DELETE', `/${category.id}`)).status, 409);
      await Product.deleteOne({ _id: inconsistent._id });
      assert.equal((await request(owner.session, 'DELETE', `/${category.id}`)).status, 204);
      assert.equal(await Category.countDocuments({ _id: category.id }), 0);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      for (const name of ['OwnerSession', 'Product', 'Category', 'User', 'Restaurant']) {
        const Model = connection.models[name];
        for (const _id of created.get(name) ?? []) await Model.deleteOne({ _id });
      }
    }
    await connection.close();
  }
});
