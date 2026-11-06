import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';

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
  } catch {
    throw new Error('MONGODB_TEST_URI failed test database safety checks');
  }
  return value;
}

test('public restaurant and menu API on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24,
    'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const created = new Map([['Product', []], ['Category', []], ['Restaurant', []]]);
  let server;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const Category = connection.model('Category', CategorySchema.schema);
    const Product = connection.model('Product', ProductSchema.schema);
    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      created.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }

    const suffix = randomUUID().replaceAll('-', '');
    const a = await fixture(Restaurant, { name: 'Public A', slug: `it-public-a-${suffix}`,
      currency: 'EGP', description: 'Open for guests',
      contactEmail: 'storefront@example.test', phone: '+201000000000',
      deliverySettings: { deliveryFee: 12.5, minimumOrder: 25,
        estimatedDeliveryTime: '30 minutes', deliveryAvailable: true },
      branding: { brandName: 'A', primaryColor: '#123456' } });
    const b = await fixture(Restaurant, { name: 'Public B', slug: `it-public-b-${suffix}`,
      currency: 'USD', storefrontTheme: 'savora-aqua' });
    const suspended = await fixture(Restaurant, { name: 'Suspended',
      slug: `it-public-suspended-${suffix}`, currency: 'EGP', status: 'suspended' });
    const empty = await fixture(Restaurant, { name: 'Empty',
      slug: `it-public-empty-${suffix}`, currency: 'EGP' });
    await connection.collection('restaurants').updateOne({ _id: empty._id },
      { $unset: { storefrontTheme: '' } });
    const aCategory = await fixture(Category, { restaurantId: a._id, name: 'Meals',
      slug: `meals-${suffix}`, sortOrder: 1 });
    const aSecond = await fixture(Category, { restaurantId: a._id, name: 'Drinks',
      slug: `drinks-${suffix}`, sortOrder: 1 });
    const inactive = await fixture(Category, { restaurantId: a._id, name: 'Hidden',
      slug: `hidden-${suffix}`, isActive: false });
    const bCategory = await fixture(Category, { restaurantId: b._id, name: 'Foreign',
      slug: `foreign-${suffix}` });
    const visible1 = await fixture(Product, { restaurantId: a._id,
      categoryId: aCategory._id, name: 'Alpha', slug: `alpha-${suffix}`,
      price: 12.34, isFeatured: true });
    const visible2 = await fixture(Product, { restaurantId: a._id,
      categoryId: aSecond._id, name: 'Beta', slug: `beta-${suffix}`,
      price: 12.34 });
    const visible3 = await fixture(Product, { restaurantId: a._id,
      categoryId: aCategory._id, name: 'Gamma', slug: `gamma-${suffix}`,
      price: 20 });
    await fixture(Product, { restaurantId: a._id, categoryId: aCategory._id,
      name: 'Unavailable', slug: `unavailable-${suffix}`, price: 1,
      isAvailable: false });
    await fixture(Product, { restaurantId: a._id, categoryId: inactive._id,
      name: 'Inactive category', slug: `inactive-${suffix}`, price: 1 });
    await fixture(Product, { restaurantId: a._id, categoryId: bCategory._id,
      name: 'Foreign category', slug: `foreign-category-${suffix}`, price: 1 });
    await fixture(Product, { restaurantId: a._id,
      categoryId: new mongoose.Types.ObjectId(), name: 'Orphan',
      slug: `orphan-${suffix}`, price: 1 });
    await fixture(Product, { restaurantId: b._id, categoryId: bCategory._id,
      name: 'B product', slug: `b-product-${suffix}`, price: 1 });
    await fixture(Product, { restaurantId: suspended._id, categoryId: aCategory._id,
      name: 'Suspended product', slug: `suspended-${suffix}`, price: 1 });

    server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test' })
      .listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const publicUrl = (slug, path = '') =>
      `${base}/api/public/restaurants/${slug}${path}`;
    const get = (slug, path = '', headers = {}) => fetch(publicUrl(slug, path), { headers });

    await t.test('active restaurant is public, with safe metadata and guest CORS', async () => {
      const response = await get(a.slug.toUpperCase(), '', {
        Origin: 'https://arbitrary-storefront.example.test' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
      assert.equal(response.headers.get('set-cookie'), null);
      const { restaurant } = await response.json();
      assert.deepEqual(Object.keys(restaurant), ['name', 'slug', 'storefrontTheme', 'heroProduct',
        'heroProductSelected', 'description', 'logoUrl',
        'currency', 'phone', 'contactEmail', 'address', 'openingHours',
        'deliverySettings', 'socialLinks', 'branding']);
      assert.equal(restaurant.slug, a.slug);
      assert.equal(restaurant.storefrontTheme, 'savora-classic');
      assert.equal(restaurant.currency, 'EGP');
      assert.equal(restaurant.contactEmail, 'storefront@example.test');
      assert.equal(restaurant.deliverySettings.deliveryFee, 12.5);
      assert.doesNotMatch(JSON.stringify(restaurant),
        /_id|restaurantId|ownerId|passwordHash|tokenHash|trackingTokenHash|"status"|__v/);
    });

    await t.test('suspended and missing restaurants have the same 404', async () => {
      const missing = `it-public-missing-${suffix}`;
      for (const slug of [suspended.slug, missing]) {
        for (const path of ['', '/categories', '/products']) {
          const response = await get(slug, path);
          assert.equal(response.status, 404);
          assert.deepEqual(await response.json(), { error: 'Not found' });
        }
      }
    });
    await t.test('theme resolves per tenant and a legacy tenant stays Classic', async () => {
      assert.equal((await (await get(b.slug)).json()).restaurant.storefrontTheme, 'savora-aqua');
      assert.equal((await (await get(empty.slug)).json()).restaurant.storefrontTheme,
        'savora-classic');
      assert.equal((await (await get(a.slug)).json()).restaurant.storefrontTheme,
        'savora-classic');
    });

    await t.test('categories stay active, tenant-scoped, ordered and paginated', async () => {
      const response = await get(a.slug, '/categories?limit=1');
      assert.equal(response.status, 200);
      const first = await response.json();
      assert.equal(first.pagination.total, 2);
      assert.equal(first.pagination.hasNext, true);
      assert.equal(first.categories.length, 1);
      assert.deepEqual(Object.keys(first.categories[0]),
        ['id', 'name', 'slug', 'description', 'imageUrl', 'sortOrder']);
      const second = await (await get(a.slug, '/categories?limit=1&page=2')).json();
      assert.deepEqual([...first.categories, ...second.categories].map((item) => item.id),
        [aCategory, aSecond].map((item) => String(item._id)).sort());
      assert.equal(second.pagination.hasNext, false);
      assert.doesNotMatch(JSON.stringify({ first, second }),
        /restaurantId|referenceRevision|isActive|passwordHash|tokenHash|__v/);
      const foreign = await (await get(b.slug, '/categories')).json();
      assert.deepEqual(foreign.categories.map((item) => item.id), [String(bCategory._id)]);
    });

    await t.test('products require an active category in the same tenant', async () => {
      const response = await get(a.slug, '/products?sort=price&limit=2');
      assert.equal(response.status, 200);
      const first = await response.json();
      assert.equal(first.currency, 'EGP');
      assert.equal(first.pagination.total, 3);
      assert.equal(first.pagination.hasNext, true);
      const second = await (await get(a.slug, '/products?sort=price&limit=2&page=2')).json();
      assert.deepEqual([...first.products, ...second.products].map((item) => item.id),
        [visible1, visible2, visible3].map((item) => String(item._id)));
      assert.equal(first.products[0].price, 12.34);
      assert.equal(first.products[1].price, 12.34);
      assert.deepEqual(Object.keys(first.products[0]), ['id', 'categoryId', 'name', 'slug',
        'description', 'price', 'oldPrice', 'imageUrl', 'images', 'isFeatured',
        'preparationTime', 'calories']);
      assert.doesNotMatch(JSON.stringify({ first, second }),
        /restaurantId|visibleCategory|isAvailable|passwordHash|tokenHash|__v/);
      const featured = await (await get(a.slug, '/products?isFeatured=true')).json();
      assert.deepEqual(featured.products.map((item) => item.id), [String(visible1._id)]);
      const category = await (await get(a.slug,
        `/products?categoryId=${aCategory._id}&sort=-price`)).json();
      assert.deepEqual(category.products.map((item) => item.id),
        [String(visible3._id), String(visible1._id)]);
      const foreign = await (await get(b.slug, '/products')).json();
      assert.deepEqual(foreign.products.map((item) => item.name), ['B product']);
    });

    await t.test('empty menus and invalid or forged inputs fail safely', async () => {
      const categories = await (await get(empty.slug, '/categories')).json();
      assert.deepEqual(categories.categories, []);
      assert.equal(categories.pagination.total, 0);
      const products = await (await get(empty.slug, '/products')).json();
      assert.deepEqual(products.products, []);
      assert.equal(products.currency, 'EGP');
      assert.equal(products.pagination.total, 0);
      for (const slug of ['bad%20slug', '%24gt', 'a'.repeat(256)]) {
        assert.equal((await get(slug)).status, 400);
      }
      for (const path of ['/categories?restaurantId=forged',
        '/products?restaurantId=forged', '/products?limit=101', '/products?page=0',
        '/products?sort=restaurantId', '/products?categoryId=bad',
        '/products?isFeatured=true&isFeatured=false', '/products?%24where=1']) {
        assert.equal((await get(a.slug, path)).status, 400, path);
      }
      const ownerPreflight = await fetch(`${base}/api/owner/restaurant`, {
        method: 'OPTIONS', headers: { Origin: 'https://arbitrary-storefront.example.test',
          'Access-Control-Request-Method': 'GET' },
      });
      assert.equal(ownerPreflight.status, 403);
      assert.equal(ownerPreflight.headers.get('access-control-allow-origin'), null);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      for (const name of ['Product', 'Category', 'Restaurant']) {
        for (const _id of created.get(name)) {
          await connection.models[name].deleteOne({ _id });
        }
      }
    }
    await connection.close();
  }
});
