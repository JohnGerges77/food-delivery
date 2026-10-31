import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import Category from '../src/models/Category.js';
import { withCategoryReferenceTransaction } from '../src/services/categoryReference.js';
import { InvalidProductInput, currencyFractionDigits, parseProductInput,
  parseProductListQuery, serializeOwnerProduct } from '../src/services/ownerProducts.js';

test('Product input has a strict editable whitelist and explicit slug normalization', () => {
  const categoryId = String(new mongoose.Types.ObjectId());
  const parsed = parseProductInput({ name: '  Burger  ', slug: '  BIG-BURGER  ',
    categoryId, price: 12.5, oldPrice: null, imageUrl: '/home2.webp',
    images: ['/home2.webp', 'https://example.test/image.webp'],
    isAvailable: false, isFeatured: true, preparationTime: 15, calories: 850 },
  { create: true, currency: 'EGP' });
  assert.deepEqual({ ...parsed }, { name: '  Burger  ', slug: 'big-burger',
    categoryId, price: 12.5, oldPrice: null, imageUrl: '/home2.webp',
    images: ['/home2.webp', 'https://example.test/image.webp'],
    isAvailable: false, isFeatured: true, preparationTime: 15, calories: 850 });
  assert.deepEqual({ ...parseProductInput({ name: 'New name' }) }, { name: 'New name' });
});

test('Product prices use currency minor units and reject excessive precision', () => {
  assert.equal(currencyFractionDigits('EGP'), 2);
  assert.equal(currencyFractionDigits('JPY'), 0);
  assert.equal(currencyFractionDigits('KWD'), 3);
  assert.deepEqual({ ...parseProductInput({ price: 12.34, oldPrice: 15.5 }) },
    { price: 12.34, oldPrice: 15.5 });
  assert.deepEqual({ ...parseProductInput({ price: 12.345 }, { currency: 'KWD' }) },
    { price: 12.345 });
  for (const value of [-1, NaN, Infinity, -Infinity, 1_000_000.01,
    12.345, 0.30000000000000004, 1e-7, '12.34', null]) {
    assert.throws(() => parseProductInput({ price: value }), InvalidProductInput);
  }
  assert.throws(() => parseProductInput({ price: 12.5 }, { currency: 'JPY' }),
    InvalidProductInput);
  assert.throws(() => parseProductInput({ oldPrice: 12.345 }), InvalidProductInput);
});

test('Product input rejects identifiers, operators, dotted keys and malformed fields', () => {
  const categoryId = String(new mongoose.Types.ObjectId());
  for (const body of [
    {}, { name: 'Only name' }, { name: 'A', slug: 'a', price: 1 },
    { name: 'A', slug: 'a', categoryId, price: 1, restaurantId: categoryId },
    { _id: categoryId }, { createdAt: 'x' }, { userId: categoryId },
    { $set: { price: 1 } }, { 'price.value': 1 },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    { name: { $ne: null } }, { slug: 'bad slug' },
    { categoryId: 'bad-id' }, { images: [null] }, { images: ['data:image/png;base64,aa'] },
    { images: Array(11).fill('/image.webp') }, { imageUrl: '//other.test/image' },
    { isAvailable: 'false' }, { isFeatured: 1 },
    { preparationTime: 1.5 }, { preparationTime: -1 },
    { calories: -1 }, { calories: Infinity },
  ]) {
    assert.throws(() => parseProductInput(body, { create: true }), InvalidProductInput);
  }
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseProductInput({}), InvalidProductInput);
});

test('Product list query bounds pagination and validates filters and sorting', () => {
  const categoryId = String(new mongoose.Types.ObjectId());
  const parsed = parseProductListQuery({ page: '2', limit: '10', sort: '-price',
    categoryId, isAvailable: 'false', isFeatured: 'true' });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.sort, '-price');
  assert.equal(String(parsed.filters.categoryId), categoryId);
  assert.equal(parsed.filters.isAvailable, false);
  assert.equal(parsed.filters.isFeatured, true);
  for (const query of [
    { restaurantId: categoryId }, { '$where': 'true' }, { page: '0' },
    { page: '1001' }, { limit: '101' }, { page: ['1', '2'] },
    { categoryId: 'bad-id' }, { isAvailable: '1' },
    { isFeatured: ['true', 'false'] }, { sort: 'restaurantId' },
  ]) {
    assert.throws(() => parseProductListQuery(query), InvalidProductInput);
  }
});

test('Product DTO excludes tenant and internal fields', () => {
  const id = new mongoose.Types.ObjectId();
  const dto = serializeOwnerProduct({ _id: id, categoryId: id, name: 'A',
    slug: 'a', price: 1, images: [], isAvailable: true, isFeatured: false,
    restaurantId: id, trackingTokenHash: 'secret', passwordHash: 'secret' });
  assert.deepEqual(Object.keys(dto), ['id', 'name', 'slug', 'categoryId',
    'description', 'price', 'oldPrice', 'imageUrl', 'images', 'isAvailable',
    'isFeatured', 'preparationTime', 'calories']);
  assert.doesNotMatch(JSON.stringify(dto), /secret|restaurantId|passwordHash/);
  assert.equal(Category.schema.path('referenceRevision').options.select, false);
});

function fakeSession({ commitErrors = [] } = {}) {
  let active = false;
  return {
    commits: 0, aborts: 0, ends: 0,
    startTransaction() { active = true; },
    inTransaction() { return active; },
    async commitTransaction() {
      this.commits++;
      const error = commitErrors.shift();
      if (error) throw error;
      active = false;
    },
    async abortTransaction() { this.aborts++; active = false; },
    async endSession() { this.ends++; },
  };
}

function labeledError(label) {
  return { hasErrorLabel: (candidate) => candidate === label };
}

test('category transaction retries transient aborts at most three times', async () => {
  const sessions = [];
  const connection = { async startSession() {
    const session = fakeSession(); sessions.push(session); return session;
  } };
  let calls = 0;
  const result = await withCategoryReferenceTransaction(connection, async () => {
    calls++;
    if (calls < 3) throw labeledError('TransientTransactionError');
    return 'committed';
  });
  assert.equal(result, 'committed');
  assert.equal(calls, 3);
  assert.equal(sessions.length, 3);
  assert.equal(sessions[0].aborts, 1);
  assert.equal(sessions[1].aborts, 1);
  await assert.rejects(() => withCategoryReferenceTransaction(connection,
    async () => { throw labeledError('TransientTransactionError'); }));
  assert.equal(sessions.length, 6);
});

test('uncertain commit retries the same transaction without repeating work', async () => {
  const session = fakeSession({ commitErrors: [labeledError('UnknownTransactionCommitResult')] });
  let calls = 0;
  const result = await withCategoryReferenceTransaction({ startSession: async () => session },
    async () => { calls++; return 'once'; });
  assert.equal(result, 'once');
  assert.equal(calls, 1);
  assert.equal(session.commits, 2);
  assert.equal(session.ends, 1);
});

test('Product routes require a verified owner session', async () => {
  const app = createApp({ allowedOrigins: 'http://localhost:3000' });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/products`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/${new mongoose.Types.ObjectId()}`)).status, 401);
    assert.equal((await fetch(base, { method: 'POST', headers: {
      Origin: 'http://localhost:3000', 'X-Savora-CSRF': 'a'.repeat(64),
      'Content-Type': 'application/json',
    }, body: JSON.stringify({ name: 'A', slug: 'a', categoryId: 'x', price: 1 }) })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
