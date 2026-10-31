import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Category from '../src/models/Category.js';

const categoryData = () => ({
  restaurantId: new mongoose.Types.ObjectId(),
  name: 'Burgers',
  slug: 'burgers',
  description: 'Freshly made burgers',
  imageUrl: '/home2.webp',
});

async function validationError(document) {
  try {
    await document.validate();
    return null;
  } catch (error) {
    assert.equal(error.name, 'ValidationError');
    return error;
  }
}

test('valid Category passes offline validation', async () => {
  const category = new Category(categoryData());
  await assert.doesNotReject(category.validate());
  assert.equal(category.imageUrl, '/home2.webp');
});

test('missing restaurantId fails validation', async () => {
  const category = new Category({ ...categoryData(), restaurantId: undefined });
  assert.ok((await validationError(category)).errors.restaurantId);
});

test('invalid restaurantId fails casting', async () => {
  const category = new Category({ ...categoryData(), restaurantId: 'invalid-id' });
  assert.equal((await validationError(category)).errors.restaurantId.name, 'CastError');
});

test('missing name fails validation', async () => {
  const category = new Category({ ...categoryData(), name: undefined });
  assert.ok((await validationError(category)).errors.name);
});

test('whitespace-only name fails validation', async () => {
  const category = new Category({ ...categoryData(), name: '   ' });
  assert.ok((await validationError(category)).errors.name);
});

test('missing slug fails validation', async () => {
  const category = new Category({ ...categoryData(), slug: undefined });
  assert.ok((await validationError(category)).errors.slug);
});

test('slug is trimmed and lowercased', async () => {
  const category = new Category({ ...categoryData(), slug: '  BURGERS-AND-FRIES  ' });
  assert.equal(category.slug, 'burgers-and-fries');
  await assert.doesNotReject(category.validate());
});

test('invalid slug formats fail validation', async () => {
  assert.equal(
    Category.schema.path('slug').options.match[0].source,
    '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  );
  for (const slug of ['bad slug', '-burgers', 'burgers-', 'burgers--fries', 'burgers_fries']) {
    const category = new Category({ ...categoryData(), slug });
    assert.ok((await validationError(category)).errors.slug);
  }
});

test('description and imageUrl are optional and trimmed when provided', async () => {
  const category = new Category({
    restaurantId: new mongoose.Types.ObjectId(),
    name: 'Burgers',
    slug: 'burgers',
  });
  await assert.doesNotReject(category.validate());
  assert.equal(category.description, undefined);
  assert.equal(category.imageUrl, undefined);

  const withText = new Category({
    ...categoryData(),
    description: '  Freshly made burgers  ',
    imageUrl: '  /home2.webp  ',
  });
  assert.equal(withText.description, 'Freshly made burgers');
  assert.equal(withText.imageUrl, '/home2.webp');
  await assert.doesNotReject(withText.validate());
});

test('sortOrder defaults to zero', () => {
  assert.equal(new Category(categoryData()).sortOrder, 0);
});

test('negative sortOrder fails validation', async () => {
  const category = new Category({ ...categoryData(), sortOrder: -1 });
  assert.ok((await validationError(category)).errors.sortOrder);
});

test('non-integer sortOrder fails validation', async () => {
  const category = new Category({ ...categoryData(), sortOrder: 1.5 });
  assert.ok((await validationError(category)).errors.sortOrder);
});

test('isActive defaults to true', () => {
  assert.equal(new Category(categoryData()).isActive, true);
});

test('timestamps and Restaurant reference are declared', () => {
  assert.equal(Category.schema.options.timestamps, true);
  assert.ok(Category.schema.path('createdAt'));
  assert.ok(Category.schema.path('updatedAt'));
  assert.equal(Category.schema.path('restaurantId').options.ref, 'Restaurant');
});

test('restaurant and slug compound unique index is declared', () => {
  const indexes = Category.schema.indexes();
  assert.equal(indexes.length, 2);
  assert.deepEqual(indexes[0][0], { restaurantId: 1, slug: 1 });
  assert.equal(indexes[0][1].unique, true);
});

test('restaurant and sortOrder compound ordering index is declared', () => {
  const indexes = Category.schema.indexes();
  assert.deepEqual(indexes[1][0], { restaurantId: 1, sortOrder: 1 });
  assert.equal(indexes[1][1].unique, undefined);
});
