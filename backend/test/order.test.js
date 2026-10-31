import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';

const orderData = () => ({
  restaurantId: new mongoose.Types.ObjectId(),
  orderNumber: 'SV-1001',
  customerName: 'Mona Ali',
  customerPhone: '+20 100 123 4567',
  deliveryAddress: '12 Nile Street',
  city: 'Cairo',
  items: [{
    productId: new mongoose.Types.ObjectId(),
    name: 'Smoked Gold Burger',
    unitPrice: 18.5,
    quantity: 2,
    imageUrl: '/home2.webp',
  }],
  subtotal: 37,
  total: 37,
  submissionMethod: 'direct',
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

test('valid direct and WhatsApp orders pass offline validation', async () => {
  await assert.doesNotReject(new Order(orderData()).validate());
  await assert.doesNotReject(new Order({
    ...orderData(),
    submissionMethod: 'whatsapp',
    customerEmail: '  MONA@EXAMPLE.COM  ',
    notes: '  Ring the bell  ',
  }).validate());
});

test('required order fields fail when missing', async () => {
  for (const field of [
    'restaurantId', 'orderNumber', 'customerName', 'customerPhone',
    'deliveryAddress', 'city', 'subtotal', 'total', 'submissionMethod',
  ]) {
    const order = new Order({ ...orderData(), [field]: undefined });
    assert.ok((await validationError(order)).errors[field], field);
  }
});

test('required strings reject whitespace-only values', async () => {
  for (const field of [
    'orderNumber', 'customerName', 'customerPhone', 'deliveryAddress', 'city',
  ]) {
    const order = new Order({ ...orderData(), [field]: '   ' });
    assert.ok((await validationError(order)).errors[field], field);
  }
});

test('restaurantId and item productId reject invalid ObjectIds', async () => {
  const invalidRestaurant = new Order({ ...orderData(), restaurantId: 'not-an-id' });
  assert.equal((await validationError(invalidRestaurant)).errors.restaurantId.name, 'CastError');

  const invalidProduct = new Order({
    ...orderData(),
    items: [{ ...orderData().items[0], productId: 'not-an-id' }],
  });
  assert.equal((await validationError(invalidProduct)).errors['items.0.productId'].name, 'CastError');
});

test('customer email is optional, normalized, and validated', async () => {
  const withoutEmail = new Order(orderData());
  assert.equal(withoutEmail.customerEmail, undefined);
  await assert.doesNotReject(withoutEmail.validate());

  const normalized = new Order({ ...orderData(), customerEmail: '  MONA@EXAMPLE.COM  ' });
  assert.equal(normalized.customerEmail, 'mona@example.com');
  await assert.doesNotReject(normalized.validate());

  const invalid = new Order({ ...orderData(), customerEmail: 'not-an-email' });
  assert.ok((await validationError(invalid)).errors.customerEmail);
});

test('required strings and optional notes are trimmed without phone format assumptions', async () => {
  const order = new Order({
    ...orderData(),
    orderNumber: '  SV-1001  ',
    customerName: '  Mona Ali  ',
    customerPhone: '  +20 100 123 4567  ',
    deliveryAddress: '  12 Nile Street  ',
    city: '  Cairo  ',
    notes: '  Ring the bell  ',
  });
  assert.equal(order.orderNumber, 'SV-1001');
  assert.equal(order.customerName, 'Mona Ali');
  assert.equal(order.customerPhone, '+20 100 123 4567');
  assert.equal(order.deliveryAddress, '12 Nile Street');
  assert.equal(order.city, 'Cairo');
  assert.equal(order.notes, 'Ring the bell');
  await assert.doesNotReject(order.validate());
});

test('items must be a nonempty array', async () => {
  for (const items of [undefined, []]) {
    const order = new Order({ ...orderData(), items });
    assert.ok((await validationError(order)).errors.items);
  }
});

test('embedded items retain product snapshots without subdocument IDs', async () => {
  const order = new Order({
    ...orderData(),
    items: [{
      ...orderData().items[0],
      name: '  Smoked Gold Burger  ',
      imageUrl: '  /home2.webp  ',
      notes: '  No onions  ',
    }],
  });
  assert.equal(order.items[0].name, 'Smoked Gold Burger');
  assert.equal(order.items[0].unitPrice, 18.5);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].imageUrl, '/home2.webp');
  assert.equal(order.items[0].notes, 'No onions');
  assert.equal(order.items[0]._id, undefined);
  assert.equal(Order.schema.path('items').schema.options._id, false);
  assert.equal(Order.schema.path('items').schema.path('productId').options.ref, 'Product');
  await assert.doesNotReject(order.validate());
});

test('item snapshots require a nonblank name, productId, unitPrice, and quantity', async () => {
  for (const [field, value] of [
    ['name', undefined], ['name', '   '], ['productId', undefined],
    ['unitPrice', undefined], ['quantity', undefined],
  ]) {
    const item = { ...orderData().items[0], [field]: value };
    const order = new Order({ ...orderData(), items: [item] });
    assert.ok((await validationError(order)).errors[`items.0.${field}`], field);
  }
});

test('quantity must be a positive integer', async () => {
  for (const quantity of [0, -1, 1.5, Infinity]) {
    const order = new Order({
      ...orderData(),
      items: [{ ...orderData().items[0], quantity }],
    });
    assert.ok((await validationError(order)).errors['items.0.quantity'], String(quantity));
  }
  await assert.doesNotReject(new Order({
    ...orderData(),
    items: [{ ...orderData().items[0], quantity: 1 }],
  }).validate());
});

test('unitPrice, subtotal, deliveryFee, and total must be finite and nonnegative', async () => {
  for (const field of ['unitPrice', 'subtotal', 'deliveryFee', 'total']) {
    for (const value of [-1, Infinity, NaN]) {
      const data = orderData();
      if (field === 'unitPrice') data.items[0].unitPrice = value;
      else data[field] = value;
      const order = new Order(data);
      const errorPath = field === 'unitPrice' ? 'items.0.unitPrice' : field;
      assert.ok((await validationError(order)).errors[errorPath], `${field}: ${value}`);
    }
  }

  await assert.doesNotReject(new Order({
    ...orderData(),
    items: [{ ...orderData().items[0], unitPrice: 0 }],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
  }).validate());
});

test('status, source, and deliveryFee defaults match the current workflow', () => {
  const order = new Order(orderData());
  assert.equal(order.status, 'pending');
  assert.equal(order.source, 'website');
  assert.equal(order.deliveryFee, 0);
  assert.equal(order.deliveredAt, undefined);
});

test('only dashboard statuses and website source are accepted', async () => {
  for (const status of [
    'pending', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled',
  ]) {
    await assert.doesNotReject(new Order({ ...orderData(), status }).validate());
  }
  const invalidStatus = new Order({ ...orderData(), status: 'completed' });
  assert.ok((await validationError(invalidStatus)).errors.status);

  const invalidSource = new Order({ ...orderData(), source: 'dashboard' });
  assert.ok((await validationError(invalidSource)).errors.source);
});

test('submissionMethod is required and restricted to direct or whatsapp', async () => {
  for (const submissionMethod of ['direct', 'whatsapp']) {
    await assert.doesNotReject(new Order({ ...orderData(), submissionMethod }).validate());
  }
  const invalid = new Order({ ...orderData(), submissionMethod: 'cash' });
  assert.ok((await validationError(invalid)).errors.submissionMethod);
});

test('timestamps are enabled and deliveredAt is an optional Date', async () => {
  assert.equal(Order.schema.options.timestamps, true);
  assert.ok(Order.schema.path('createdAt'));
  assert.ok(Order.schema.path('updatedAt'));
  assert.equal(Order.schema.path('restaurantId').options.ref, 'Restaurant');

  const deliveredAt = new Date('2026-10-12T10:00:00.000Z');
  const order = new Order({ ...orderData(), deliveredAt });
  assert.equal(order.deliveredAt?.toISOString(), deliveredAt.toISOString());
  await assert.doesNotReject(order.validate());
});

test('trackingTokenHash is excluded from default selection and document serialization', () => {
  assert.equal(Order.schema.path('trackingTokenHash').options.select, false);
  const order = new Order({ ...orderData(), trackingTokenHash: 'private-test-value' });
  assert.equal(order.toJSON().trackingTokenHash, undefined);
  assert.equal(order.toObject().trackingTokenHash, undefined);
  assert.equal(JSON.stringify(order).includes('private-test-value'), false);
});

test('five tenant-scoped indexes include idempotency and delivered-date access', () => {
  const indexes = Order.schema.indexes();
  assert.equal(indexes.length, 5);
  assert.deepEqual(indexes[0][0], { restaurantId: 1, orderNumber: 1 });
  assert.equal(indexes[0][1].unique, true);
  assert.deepEqual(indexes[1][0], { restaurantId: 1, idempotencyKeyHash: 1 });
  assert.equal(indexes[1][1].unique, true);
  assert.deepEqual(indexes[2][0], { restaurantId: 1, createdAt: -1 });
  assert.deepEqual(indexes[3][0], { restaurantId: 1, status: 1, createdAt: -1 });
  assert.deepEqual(indexes[4][0], { restaurantId: 1, deliveredAt: -1 });
  assert.deepEqual(indexes[4][1].partialFilterExpression, { status: 'delivered' });
  assert.equal(indexes[2][1].unique, undefined);
  assert.equal(indexes[3][1].unique, undefined);
});
