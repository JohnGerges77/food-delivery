import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const productData = () => ({
  restaurantId: new mongoose.Types.ObjectId(),
  categoryId: new mongoose.Types.ObjectId(),
  name: 'Smoked Gold Burger',
  slug: 'smoked-gold-burger',
  price: 18.5,
  imageUrl: '/home2.webp',
  images: ['/home2.webp'],
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

test('valid Product passes offline validation', async () => {
  await assert.doesNotReject(new Product(productData()).validate());
});

test('required fields fail when missing', async () => {
  for (const field of ['restaurantId', 'categoryId', 'name', 'slug', 'price']) {
    const product = new Product({ ...productData(), [field]: undefined });
    assert.ok((await validationError(product)).errors[field]);
  }
});

test('restaurantId and categoryId reject invalid ObjectIds', async () => {
  for (const field of ['restaurantId', 'categoryId']) {
    const product = new Product({ ...productData(), [field]: 'invalid-id' });
    assert.equal((await validationError(product)).errors[field].name, 'CastError');
  }
});

test('whitespace-only name fails validation', async () => {
  const product = new Product({ ...productData(), name: '   ' });
  assert.ok((await validationError(product)).errors.name);
});

test('slug is trimmed and lowercased', async () => {
  const product = new Product({ ...productData(), slug: '  SMOKED-GOLD-BURGER  ' });
  assert.equal(product.slug, 'smoked-gold-burger');
  await assert.doesNotReject(product.validate());
});

test('invalid slug formats fail validation', async () => {
  assert.equal(
    Product.schema.path('slug').options.match[0].source,
    '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  );
  for (const slug of ['bad slug', '-burger', 'burger-', 'double--burger', 'burger_special']) {
    const product = new Product({ ...productData(), slug });
    assert.ok((await validationError(product)).errors.slug);
  }
});

test('price must be nonnegative and zero is valid', async () => {
  const negative = new Product({ ...productData(), price: -1 });
  assert.ok((await validationError(negative)).errors.price);
  await assert.doesNotReject(new Product({ ...productData(), price: 0 }).validate());
});

test('oldPrice is optional and cannot be negative', async () => {
  const withoutOldPrice = new Product(productData());
  assert.equal(withoutOldPrice.oldPrice, undefined);
  await assert.doesNotReject(withoutOldPrice.validate());

  const negative = new Product({ ...productData(), oldPrice: -1 });
  assert.ok((await validationError(negative)).errors.oldPrice);
});

test('optional image fields preserve local paths', async () => {
  const product = new Product({
    ...productData(),
    imageUrl: '  /home2.webp  ',
    images: ['  /home2.webp  ', '/best1.webp'],
  });
  assert.equal(product.imageUrl, '/home2.webp');
  assert.deepEqual(Array.from(product.images), ['/home2.webp', '/best1.webp']);
  await assert.doesNotReject(product.validate());

  const withoutImages = new Product({
    restaurantId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    name: 'Burger',
    slug: 'burger',
    price: 12,
  });
  assert.equal(withoutImages.imageUrl, undefined);
  assert.deepEqual(Array.from(withoutImages.images), []);
  await assert.doesNotReject(withoutImages.validate());
});

test('availability and featured defaults work', () => {
  const product = new Product(productData());
  assert.equal(product.isAvailable, true);
  assert.equal(product.isFeatured, false);
});

test('preparationTime is optional and must be a nonnegative integer', async () => {
  const withoutPreparationTime = new Product(productData());
  assert.equal(withoutPreparationTime.preparationTime, undefined);
  await assert.doesNotReject(withoutPreparationTime.validate());

  for (const preparationTime of [-1, 1.5]) {
    const product = new Product({ ...productData(), preparationTime });
    assert.ok((await validationError(product)).errors.preparationTime);
  }
  await assert.doesNotReject(new Product({ ...productData(), preparationTime: 0 }).validate());
  await assert.doesNotReject(new Product({ ...productData(), preparationTime: null }).validate());
});

test('calories are optional and nonnegative', async () => {
  const withoutCalories = new Product(productData());
  assert.equal(withoutCalories.calories, undefined);
  await assert.doesNotReject(withoutCalories.validate());

  const negative = new Product({ ...productData(), calories: -1 });
  assert.ok((await validationError(negative)).errors.calories);
});

test('timestamps and model references are declared', () => {
  assert.equal(Product.schema.options.timestamps, true);
  assert.ok(Product.schema.path('createdAt'));
  assert.ok(Product.schema.path('updatedAt'));
  assert.equal(Product.schema.path('restaurantId').options.ref, 'Restaurant');
  assert.equal(Product.schema.path('categoryId').options.ref, 'Category');
});

test('tenant-scoped unique slug index is declared', () => {
  const indexes = Product.schema.indexes();
  assert.equal(indexes.length, 2);
  assert.deepEqual(indexes[0][0], { restaurantId: 1, slug: 1 });
  assert.equal(indexes[0][1].unique, true);
});

test('tenant-scoped category lookup index is declared without a featured index', () => {
  const indexes = Product.schema.indexes();
  assert.deepEqual(indexes[1][0], { restaurantId: 1, categoryId: 1 });
  assert.equal(indexes[1][1].unique, undefined);
});
