import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { InvalidCategoryInput, parseCategoryInput, parseCategoryListQuery,
  serializeOwnerCategory } from '../src/services/ownerCategories.js';
import { getOwnerCategory } from '../src/services/ownerCategories.js';

test('category payloads normalize explicit slugs and retain only editable fields', () => {
  const input = parseCategoryInput({ name: '  Burgers  ', slug: '  BURGERS-AND-FRIES  ',
    description: 'Fresh', imageUrl: '/home2.webp', sortOrder: 0, isActive: false },
  { create: true });
  assert.deepEqual({ ...input }, { name: '  Burgers  ', slug: 'burgers-and-fries',
    description: 'Fresh', imageUrl: '/home2.webp', sortOrder: 0, isActive: false });
  assert.deepEqual({ ...parseCategoryInput({ name: 'New name' }) }, { name: 'New name' });
  assert.deepEqual({ ...parseCategoryInput({ imageUrl: 'https://example.test/photo.webp' }) },
    { imageUrl: 'https://example.test/photo.webp' });
});

test('category payloads reject missing, immutable, operator, dotted, and nested fields', () => {
  for (const body of [
    {}, { name: 'Only name' }, { slug: 'only-slug' }, { name: 'A', slug: 'a', _id: 'x' },
    { restaurantId: 'x' }, { userId: 'x' }, { createdAt: 'x' },
    { unknown: true }, { $set: { name: 'x' } }, { 'name.first': 'x' },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    { name: { $ne: null } }, { imageUrl: ['https://example.test'] },
  ]) {
    assert.throws(() => parseCategoryInput(body, { create: true }), InvalidCategoryInput);
  }
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseCategoryInput({}), InvalidCategoryInput);
});

test('category values are checked before Mongoose casting', () => {
  for (const body of [
    { name: '   ' }, { name: 'x'.repeat(121) }, { slug: 'bad slug' },
    { slug: '-bad' }, { slug: 'a'.repeat(121) },
    { description: 'x'.repeat(2049) }, { imageUrl: 'javascript:alert(1)' },
    { imageUrl: '//other.test/image' }, { imageUrl: '/a/../b' },
    { imageUrl: 'https://user:pass@example.test/image' },
    { sortOrder: -1 }, { sortOrder: 1.5 }, { sortOrder: '1' },
    { sortOrder: 1_000_001 }, { isActive: 'false' },
  ]) {
    assert.throws(() => parseCategoryInput(body), InvalidCategoryInput);
  }
});

test('category list query uses bounded pages and whitelisted sorting', () => {
  assert.deepEqual(parseCategoryListQuery({}), { page: 1, limit: 20, sort: 'sortOrder' });
  assert.deepEqual(parseCategoryListQuery({ page: '2', limit: '10', sort: '-sortOrder' }),
    { page: 2, limit: 10, sort: '-sortOrder' });
  for (const query of [
    { restaurantId: 'x' }, { '$where': 'true' }, { page: '0' }, { page: '1001' },
    { page: ['1', '2'] }, { page: '1.5' }, { limit: '101' },
    { limit: '0' }, { sort: 'name' }, { sort: { $ne: 'x' } },
  ]) {
    assert.throws(() => parseCategoryListQuery(query), InvalidCategoryInput);
  }
});

test('category DTO has only the requested safe fields', () => {
  const category = { _id: new mongoose.Types.ObjectId(), name: 'A', slug: 'a',
    sortOrder: 0, isActive: true, restaurantId: 'secret', passwordHash: 'secret',
    trackingTokenHash: 'secret', credentials: { password: 'secret' } };
  const dto = serializeOwnerCategory(category);
  assert.deepEqual(Object.keys(dto), [
    'id', 'name', 'slug', 'description', 'imageUrl', 'sortOrder', 'isActive',
  ]);
  assert.doesNotMatch(JSON.stringify(dto), /secret|passwordHash|restaurantId|credentials/);
});

test('category service rejects caller-constructed auth context', async () => {
  await assert.rejects(() => getOwnerCategory(null, { restaurantId: new mongoose.Types.ObjectId() },
    new mongoose.Types.ObjectId()), /Verified owner context/);
});

test('category routes reject missing sessions before reads or writes', async () => {
  const app = createApp({ allowedOrigins: 'http://localhost:3000' });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/categories`;
    for (const path of ['', `/${new mongoose.Types.ObjectId()}`]) {
      assert.equal((await fetch(`${base}${path}`)).status, 401);
    }
    const response = await fetch(base, { method: 'POST', headers: {
      Origin: 'http://localhost:3000', 'X-Savora-CSRF': 'a'.repeat(64),
      'Content-Type': 'application/json',
    }, body: JSON.stringify({ name: 'Forged', slug: 'forged' }) });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
