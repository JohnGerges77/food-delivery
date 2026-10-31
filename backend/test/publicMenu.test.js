import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { InvalidPublicRequest, normalizePublicSlug, parsePublicCategoriesQuery,
  parsePublicProductsQuery, serializePublicCategory, serializePublicProduct,
  serializePublicRestaurant } from '../src/services/publicMenu.js';

test('public slug normalization and query validation are strict and bounded', () => {
  assert.equal(normalizePublicSlug('  GOOD-CAFE  '), 'good-cafe');
  for (const slug of ['', 'bad slug', 'bad.slug', '$gt', 'a'.repeat(256), {}]) {
    assert.throws(() => normalizePublicSlug(slug), InvalidPublicRequest);
  }
  assert.deepEqual(parsePublicCategoriesQuery({}), { page: 1, limit: 50 });
  assert.deepEqual(parsePublicProductsQuery({}).sort, 'name');
  assert.equal(parsePublicProductsQuery({ categoryId: 'a'.repeat(24) })
    .filters.categoryId.toString(), 'a'.repeat(24));
  assert.equal(parsePublicProductsQuery({ isFeatured: 'false' }).filters.isFeatured, false);
  for (const query of [{ page: '0' }, { page: '1001' }, { limit: '101' },
    { limit: ['1', '2'] }, { restaurantId: 'a' }, { '$where': '1' }]) {
    assert.throws(() => parsePublicCategoriesQuery(query), InvalidPublicRequest);
    assert.throws(() => parsePublicProductsQuery(query), InvalidPublicRequest);
  }
  for (const query of [{ sort: 'restaurantId' }, { categoryId: 'invalid' },
    { isFeatured: '1' }, { isFeatured: ['true', 'false'] }]) {
    assert.throws(() => parsePublicProductsQuery(query), InvalidPublicRequest);
  }
});

test('public serializers preserve prices and expose explicit safe fields', () => {
  const sensitive = { passwordHash: 'secret', tokenHash: 'secret',
    trackingTokenHash: 'secret', restaurantId: 'private', status: 'active' };
  const restaurant = serializePublicRestaurant({ ...sensitive, name: 'Cafe',
    slug: 'cafe', currency: 'EGP', contactEmail: 'hello@example.test' });
  const category = serializePublicCategory({ ...sensitive, _id: 'category-id',
    name: 'Meals', slug: 'meals', sortOrder: 0 });
  const product = serializePublicProduct({ ...sensitive, _id: 'product-id',
    categoryId: 'category-id', name: 'Lunch', slug: 'lunch', price: 12.34 });
  assert.equal(product.price, 12.34);
  assert.equal(restaurant.currency, 'EGP');
  assert.equal(restaurant.storefrontTheme, 'savora-classic');
  assert.equal(restaurant.contactEmail, 'hello@example.test');
  assert.equal(category.id, 'category-id');
  assert.doesNotMatch(JSON.stringify({ restaurant, category, product }),
    /passwordHash|tokenHash|trackingTokenHash|restaurantId|"status"/);
});

test('public CORS is non-credentialed and does not change owner CORS', async () => {
  const server = createApp({ allowedOrigins: 'https://dashboard.example.test' })
    .listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { Origin: 'https://storefront.example.test',
      'Access-Control-Request-Method': 'GET' };
    const publicPreflight = await fetch(`${base}/api/public/restaurants/cafe/products`,
      { method: 'OPTIONS', headers });
    assert.equal(publicPreflight.status, 204);
    assert.equal(publicPreflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(publicPreflight.headers.get('access-control-allow-credentials'), null);
    const ownerPreflight = await fetch(`${base}/api/owner/restaurant`,
      { method: 'OPTIONS', headers });
    assert.equal(ownerPreflight.status, 403);
    assert.equal(ownerPreflight.headers.get('access-control-allow-origin'), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
