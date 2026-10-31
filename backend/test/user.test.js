import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const ownerData = () => ({
  restaurantId: new mongoose.Types.ObjectId(),
  name: 'Savora Owner',
  email: 'owner@savora.example',
  passwordHash: 'precomputed-hash-for-offline-test',
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

test('valid owner passes offline validation', async () => {
  await assert.doesNotReject(new User(ownerData()).validate());
});

test('missing restaurantId fails validation', async () => {
  const user = new User({ ...ownerData(), restaurantId: undefined });
  assert.ok((await validationError(user)).errors.restaurantId);
});

test('invalid restaurantId fails casting', async () => {
  const user = new User({ ...ownerData(), restaurantId: 'not-an-object-id' });
  assert.equal((await validationError(user)).errors.restaurantId.name, 'CastError');
});

test('missing and whitespace-only names fail validation', async () => {
  for (const name of [undefined, '   ']) {
    const user = new User({ ...ownerData(), name });
    assert.ok((await validationError(user)).errors.name);
  }
});

test('missing email fails validation', async () => {
  const user = new User({ ...ownerData(), email: undefined });
  assert.ok((await validationError(user)).errors.email);
});

test('invalid email fails validation', async () => {
  for (const email of ['invalid', 'owner@', '@savora.example', 'owner name@savora.example']) {
    const user = new User({ ...ownerData(), email });
    assert.ok((await validationError(user)).errors.email);
  }
});

test('email is trimmed and lowercased', async () => {
  const user = new User({ ...ownerData(), email: '  OWNER@SAVORA.EXAMPLE  ' });
  assert.equal(user.email, 'owner@savora.example');
  await assert.doesNotReject(user.validate());
});

test('role defaults to owner', () => {
  assert.equal(new User(ownerData()).role, 'owner');
});

test('unsupported roles are rejected', async () => {
  for (const role of ['staff', 'customer', 'admin']) {
    const user = new User({ ...ownerData(), role });
    assert.ok((await validationError(user)).errors.role);
  }
});

test('isActive defaults to true', () => {
  assert.equal(new User(ownerData()).isActive, true);
});

test('passwordHash is required and excluded from default query selection', async () => {
  const user = new User({ ...ownerData(), passwordHash: undefined });
  assert.ok((await validationError(user)).errors.passwordHash);
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('JSON serialization omits passwordHash even when present on the document', () => {
  const user = new User(ownerData());
  assert.equal(user.passwordHash, 'precomputed-hash-for-offline-test');
  assert.equal(user.toJSON().passwordHash, undefined);
  assert.equal(user.toObject().passwordHash, undefined);
  assert.equal(JSON.stringify(user).includes('passwordHash'), false);
  assert.equal(JSON.stringify(user).includes('precomputed-hash-for-offline-test'), false);
});

test('email has one globally unique index', () => {
  const indexes = User.schema.indexes();
  assert.equal(indexes.length, 2);
  const emailIndex = indexes.find(([fields]) => fields.email === 1);
  assert.deepEqual(emailIndex[0], { email: 1 });
  assert.equal(emailIndex[1].unique, true);
  assert.equal(emailIndex[1].partialFilterExpression, undefined);
});

test('restaurantId has a partial unique index for owners', () => {
  const indexes = User.schema.indexes();
  const ownerIndex = indexes.find(([fields]) => fields.restaurantId === 1);
  assert.deepEqual(ownerIndex[0], { restaurantId: 1 });
  assert.equal(ownerIndex[1].unique, true);
  assert.deepEqual(ownerIndex[1].partialFilterExpression, { role: 'owner' });
});

test('restaurant reference and timestamps are declared', () => {
  assert.equal(User.schema.path('restaurantId').options.ref, 'Restaurant');
  assert.equal(User.schema.options.timestamps, true);
  assert.ok(User.schema.path('createdAt'));
  assert.ok(User.schema.path('updatedAt'));
});
