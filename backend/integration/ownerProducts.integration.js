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

test('owner Product CRUD on savora_test', async (t) => {
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
    for (const Model of [Restaurant, User, OwnerSession, Category, Product, Order]) {
      created.set(Model.modelName, []);
    }
    await Category.createIndexes();
    await Product.createIndexes();
    assert.ok((await Product.collection.listIndexes().toArray()).some((index) =>
      index.unique && index.key.restaurantId === 1 && index.key.slug === 1));

    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      created.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    async function sessionFor(user, expiresAt = new Date(Date.now() + 900_000)) {
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
        name: `Products ${letter}`, slug: `it-products-${letter}-${suffix}`, currency: 'EGP',
      });
      const user = await fixture(User, { restaurantId: restaurant._id,
        name: `Owner ${letter}`, email: `it-products-${letter}-${suffix}@example.test`,
        passwordHash: 'test-only-hash' });
      const category = await fixture(Category, { restaurantId: restaurant._id,
        name: `Category ${letter}`, slug: `it-products-category-${letter}-${suffix}` });
      tenants.push({ restaurant, user, category, session: await sessionFor(user) });
    }

    server = createApp({ connection, allowedOrigins: origin, secureCookies: true })
      .listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner`;
    const request = (session, method, path, body, options = {}) => fetch(`${base}${path}`, {
      method,
      headers: { ...(session ? { Cookie: session.cookie } : {}),
        ...(method !== 'GET' ? { Origin: options.origin ?? origin,
          'X-Savora-CSRF': options.csrf ?? session?.csrf ?? '' } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
    async function createProduct(tenant, data) {
      const response = await request(tenant.session, 'POST', '/products', {
        name: 'Test product', slug: `product-${randomUUID().replaceAll('-', '')}`,
        categoryId: String(tenant.category._id), price: 12.34, ...data,
      });
      assert.equal(response.status, 201);
      const { product } = await response.json();
      created.get('Product').push(new mongoose.Types.ObjectId(product.id));
      return product;
    }

    await t.test('missing, invalid, and expired sessions return 401', async () => {
      assert.equal((await request(null, 'GET', '/products')).status, 401);
      assert.equal((await request(null, 'POST', '/products', {})).status, 401);
      const invalid = await request({ cookie: `savora_owner_session=${'a'.repeat(64)}` },
        'GET', '/products');
      assert.equal(invalid.status, 401);
      assert.ok(invalid.headers.getSetCookie().some((cookie) => cookie.includes('Max-Age=0')));
      const expired = await sessionFor(tenants[0].user, new Date(Date.now() - 1000));
      assert.equal((await request(expired, 'GET', '/products')).status, 401);
    });

    await t.test('owner creates, reads, patches, lists, and deletes own Product', async () => {
      const owner = tenants[0];
      const product = await createProduct(owner, {
        name: '  Burger  ', slug: `  BURGER-${suffix.toUpperCase()}  `,
        description: 'Fresh', price: 18.5, oldPrice: 20,
        imageUrl: '/home2.webp', images: ['/home2.webp'],
        isAvailable: true, isFeatured: true, preparationTime: 16, calories: 920,
      });
      assert.equal(product.name, 'Burger');
      assert.equal(product.slug, `burger-${suffix}`);
      assert.equal(product.categoryId, String(owner.category._id));
      assert.deepEqual(Object.keys(product), ['id', 'name', 'slug', 'categoryId',
        'description', 'price', 'oldPrice', 'imageUrl', 'images', 'isAvailable',
        'isFeatured', 'preparationTime', 'calories']);
      assert.doesNotMatch(JSON.stringify(product),
        /restaurantId|passwordHash|tokenHash|trackingTokenHash|credentials/);
      const read = await request(owner.session, 'GET', `/products/${product.id}`);
      assert.equal(read.status, 200);
      assert.deepEqual((await read.json()).product, product);
      const update = await request(owner.session, 'PATCH', `/products/${product.id}`,
        { name: 'New burger', price: 19.25, oldPrice: null, isAvailable: false });
      assert.equal(update.status, 200);
      const updated = (await update.json()).product;
      assert.equal(updated.name, 'New burger');
      assert.equal(updated.slug, product.slug);
      assert.equal(updated.description, 'Fresh');
      assert.equal(updated.price, 19.25);
      assert.equal(updated.oldPrice, null);
      assert.deepEqual(updated.images, ['/home2.webp']);
      const listing = await request(owner.session, 'GET', '/products?limit=100');
      assert.equal(listing.status, 200);
      assert.ok((await listing.json()).products.some((item) => item.id === product.id));
      assert.equal((await request(owner.session, 'DELETE', `/products/${product.id}`)).status, 204);
      assert.equal((await request(owner.session, 'GET', `/products/${product.id}`)).status, 404);
      assert.ok(await Category.findById(owner.category._id));
    });

    await t.test('category ownership is checked on create and reassignment', async () => {
      const [a, b] = tenants;
      const missing = new mongoose.Types.ObjectId();
      for (const categoryId of [String(b.category._id), String(missing)]) {
        const rejected = await request(a.session, 'POST', '/products', {
          name: 'Rejected', slug: `rejected-${randomUUID().replaceAll('-', '')}`,
          categoryId, price: 1,
        });
        assert.equal(rejected.status, 404);
        assert.deepEqual(await rejected.json(), { error: 'Not found' });
      }
      const own = await createProduct(a, { name: 'Own category' });
      for (const categoryId of [String(b.category._id), String(missing)]) {
        const rejected = await request(a.session, 'PATCH', `/products/${own.id}`,
          { categoryId });
        assert.equal(rejected.status, 404);
        assert.equal((await Product.findById(own.id)).categoryId.toString(),
          String(a.category._id));
      }
      const disabled = await fixture(Category, { restaurantId: a.restaurant._id,
        name: 'Disabled', slug: `disabled-${suffix}`, isActive: false });
      const draft = await createProduct(a, { name: 'Draft in disabled category',
        categoryId: String(disabled._id), isAvailable: false });
      assert.equal(draft.categoryId, String(disabled._id));
      const moved = await request(a.session, 'PATCH', `/products/${own.id}`,
        { categoryId: String(disabled._id) });
      assert.equal(moved.status, 200);
      assert.equal((await moved.json()).product.categoryId, String(disabled._id));
      const blocked = await request(a.session, 'DELETE', `/categories/${disabled._id}`);
      assert.equal(blocked.status, 409);
    });

    await t.test('tenant slug uniqueness and foreign Product access are isolated', async () => {
      const [a, b] = tenants;
      const slug = `shared-${suffix}`;
      const own = await createProduct(a, { slug, name: 'A shared' });
      const duplicate = await request(a.session, 'POST', '/products', {
        name: 'Duplicate', slug, categoryId: String(a.category._id), price: 1,
      });
      assert.equal(duplicate.status, 409);
      assert.deepEqual(await duplicate.json(), { error: 'Product slug already exists' });
      const another = await createProduct(a, { slug: `another-${suffix}` });
      assert.equal((await request(a.session, 'PATCH', `/products/${another.id}`,
        { slug })).status, 409);
      const foreign = await createProduct(b, { slug, name: 'B shared' });
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const response = await request(a.session, method, `/products/${foreign.id}`,
          method === 'PATCH' ? { name: 'Forbidden' } : undefined);
        assert.equal(response.status, 404);
        if (method !== 'DELETE') assert.deepEqual(await response.json(), { error: 'Not found' });
      }
      const forged = await request(a.session, 'PATCH',
        `/products/${own.id}?restaurantId=${b.restaurant._id}`,
        { name: 'Still A' }, { headers: { restaurantId: String(b.restaurant._id), role: 'owner' } });
      assert.equal(forged.status, 200);
      assert.equal((await forged.json()).product.id, own.id);
      assert.equal((await Product.findById(foreign.id)).name, 'B shared');
      assert.equal((await Product.findById(own.id)).restaurantId.toString(),
        String(a.restaurant._id));
    });

    await t.test('Origin and CSRF guards block every Product mutation', async () => {
      const owner = tenants[0];
      const product = await createProduct(owner, { name: 'Protected' });
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        const path = method === 'POST' ? '/products' : `/products/${product.id}`;
        const body = method === 'DELETE' ? undefined : { name: 'Blocked' };
        assert.equal((await request(owner.session, method, path, body,
          { origin: 'https://other.example.test' })).status, 403);
        assert.equal((await request(owner.session, method, path, body,
          { csrf: 'b'.repeat(64) })).status, 403);
      }
      assert.equal((await Product.findById(product.id)).name, 'Protected');
    });

    await t.test('invalid IDs, payloads, prices and filters fail safely', async () => {
      const owner = tenants[0];
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        assert.equal((await request(owner.session, method, '/products/invalid-id',
          method === 'PATCH' ? { name: 'Nope' } : undefined)).status, 404);
      }
      const own = await createProduct(owner, { name: 'Validation' });
      const required = { name: 'Valid', slug: `valid-${suffix}`,
        categoryId: String(owner.category._id), price: 1 };
      for (const body of [
        {}, { name: 'Only name' }, { ...required, restaurantId: String(tenants[1].restaurant._id) },
        { ...required, _id: own.id }, { ...required, createdAt: 'x' },
        { ...required, $set: { price: 1 } }, { ...required, 'price.value': 1 },
        { ...required, slug: 'bad slug' }, { ...required, categoryId: 'bad-id' },
        { ...required, price: -1 }, { ...required, price: 12.345 },
        { ...required, price: 1_000_000.01 },
        { ...required, imageUrl: 'javascript:alert(1)' },
        { ...required, images: ['data:image/png;base64,aa'] },
        { ...required, isFeatured: 'true' },
        JSON.parse('{"__proto__":{"polluted":true}}'),
      ]) {
        assert.equal((await request(owner.session, 'POST', '/products', body)).status, 400,
          JSON.stringify(body));
      }
      for (const body of [{}, { restaurantId: String(tenants[1].restaurant._id) },
        { $set: { price: 1 } }, { 'price.value': 1 }, { oldPrice: 1.001 },
        { preparationTime: 1.5 }, { calories: -1 }, { images: {} }]) {
        assert.equal((await request(owner.session, 'PATCH', `/products/${own.id}`, body)).status,
          400, JSON.stringify(body));
      }
      assert.equal((await request(owner.session, 'POST', '/products', '{')).status, 400);
      assert.equal((await request(owner.session, 'POST', '/products',
        { ...required, description: 'x'.repeat(17_000) })).status, 413);
      for (const query of ['?restaurantId=x', '?page=0', '?limit=101', '?sort=restaurantId',
        '?categoryId=bad-id', '?isAvailable=1', '?isFeatured=true&isFeatured=false']) {
        assert.equal((await request(owner.session, 'GET', `/products${query}`)).status,
          400, query);
      }
      assert.equal((await Product.findById(own.id)).name, 'Validation');
      assert.equal({}.polluted, undefined);
    });

    await t.test('listing filters, sorts, paginates and excludes another tenant', async () => {
      const [a, b] = tenants;
      const otherCategory = await fixture(Category, { restaurantId: a.restaurant._id,
        name: 'Second category', slug: `second-${suffix}` });
      const first = await createProduct(a, { name: 'Alpha', price: 3,
        categoryId: String(a.category._id), isAvailable: true, isFeatured: false });
      const second = await createProduct(a, { name: 'Beta', price: 2,
        categoryId: String(a.category._id), isAvailable: false, isFeatured: true });
      const third = await createProduct(a, { name: 'Gamma', price: 3,
        categoryId: String(otherCategory._id), isAvailable: true, isFeatured: true });
      await createProduct(b, { name: 'Foreign', price: 0 });
      const filter = await request(a.session, 'GET',
        `/products?categoryId=${a.category._id}&isAvailable=false&isFeatured=true`);
      assert.equal(filter.status, 200);
      assert.deepEqual((await filter.json()).products.map((item) => item.id), [second.id]);
      const list = await request(a.session, 'GET', '/products?sort=price&limit=100');
      assert.equal(list.status, 200);
      const all = await list.json();
      assert.ok(all.products.some((item) => item.id === first.id));
      assert.ok(all.products.some((item) => item.id === third.id));
      assert.ok(all.products.every((item) => item.name !== 'Foreign'));
      const expected = [...all.products].sort((left, right) =>
        left.price - right.price || left.id.localeCompare(right.id));
      assert.deepEqual(all.products.map((item) => item.id), expected.map((item) => item.id));
      const page1 = await (await request(a.session, 'GET', '/products?sort=price&limit=2')).json();
      const page2 = await (await request(a.session, 'GET',
        '/products?sort=price&limit=2&page=2')).json();
      assert.deepEqual([...page1.products, ...page2.products].map((item) => item.id),
        all.products.slice(0, 4).map((item) => item.id));
      assert.equal(page1.pagination.total, all.products.length);
      assert.equal(page1.pagination.hasNext, true);
    });

    await t.test('historical Order snapshots block hard deletion without cascading', async () => {
      const owner = tenants[0];
      const product = await createProduct(owner, { name: 'Ordered', price: 10 });
      const order = await fixture(Order, { restaurantId: owner.restaurant._id,
        orderNumber: `IT-ORDER-${suffix}`, customerName: 'Test Guest',
        customerPhone: '+201000000000', deliveryAddress: '12 Test Street', city: 'Cairo',
        items: [{ productId: product.id, name: 'Ordered snapshot', unitPrice: 10, quantity: 1 }],
        subtotal: 10, total: 10, submissionMethod: 'direct' });
      const rejected = await request(owner.session, 'DELETE', `/products/${product.id}`);
      assert.equal(rejected.status, 409);
      assert.deepEqual(await rejected.json(),
        { error: 'Product has orders; mark it unavailable instead' });
      assert.ok(await Product.findById(product.id));
      const unavailable = await request(owner.session, 'PATCH', `/products/${product.id}`,
        { isAvailable: false });
      assert.equal(unavailable.status, 200);
      assert.equal((await unavailable.json()).product.isAvailable, false);
      assert.equal((await Order.findById(order._id)).items[0].name, 'Ordered snapshot');
      await Order.deleteOne({ _id: order._id });
      assert.equal((await request(owner.session, 'DELETE', `/products/${product.id}`)).status, 204);
      assert.ok(await Category.findById(owner.category._id));
    });

    await t.test('concurrent Product create and Category delete never leave an orphan', async () => {
      const owner = tenants[0];
      for (let index = 0; index < 5; index++) {
        const category = await fixture(Category, { restaurantId: owner.restaurant._id,
          name: `Race ${index}`, slug: `race-${index}-${suffix}` });
        const slug = `race-product-${index}-${suffix}`;
        const [create, deletion] = await Promise.all([
          request(owner.session, 'POST', '/products', { name: 'Racing product', slug,
            categoryId: String(category._id), price: 1 }),
          request(owner.session, 'DELETE', `/categories/${category._id}`),
        ]);
        const product = await Product.findOne({ restaurantId: owner.restaurant._id, slug });
        if (product) created.get('Product').push(product._id);
        const categoryExists = Boolean(await Category.findById(category._id));
        assert.equal(Boolean(product), categoryExists);
        if (product) {
          assert.equal(create.status, 201);
          assert.equal(deletion.status, 409);
          assert.equal(String(product.categoryId), String(category._id));
        } else {
          assert.equal(create.status, 404);
          assert.equal(deletion.status, 204);
        }
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
