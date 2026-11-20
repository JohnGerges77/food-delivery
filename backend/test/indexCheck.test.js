import Order from '../src/models/Order.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { compareIndexes, inspectIndexes, inspectConnectionIndexes, ensureModelIndexes } from '../src/cli/check-indexes.js';

test('index inspection reports missing and conflicting required options', () => {
  const expected = [[{ restaurantId: 1, deliveredAt: -1 },
    { partialFilterExpression: { status: 'delivered' } }]];
  assert.deepEqual(compareIndexes(expected, []), [
    { name: 'restaurantId_1_deliveredAt_-1', issue: 'missing' },
  ]);
  assert.deepEqual(compareIndexes(expected, [{
    key: { restaurantId: 1, deliveredAt: -1 },
  }]), [{ name: 'restaurantId_1_deliveredAt_-1',
    issue: 'conflicting partialFilterExpression' }]);
  assert.deepEqual(compareIndexes(expected, [{
    key: { restaurantId: 1, deliveredAt: -1 },
    partialFilterExpression: { status: 'delivered' },
  }]), []);
});

test('index inspection refuses missing or mismatched database configuration', async () => {
  await assert.rejects(inspectIndexes(undefined, 'savora_test'), /Explicit/);
  await assert.rejects(inspectIndexes('mongodb://localhost/savora_dev', 'savora_test'),
    /database mismatch/);
  await assert.rejects(inspectIndexes(
    'mongodb://localhost/savora_test?dbName=savora_dev', 'savora_test'),
  /database mismatch/);
  await assert.rejects(inspectIndexes('mongodb://wrong@localhost/savora_test',
    'savora_test'), /savora_test_user/);
});


test('read-only inspection requires the real tenant idempotency index, unique flag and partial predicate', async () => {
  const required = Order.schema.indexes();
  const idempotency = required.find(([keys]) => keys.idempotencyKeyHash);
  assert.deepEqual(idempotency[0], { restaurantId: 1, idempotencyKeyHash: 1 });
  for (const mutation of ['missing', 'nonunique', 'predicate', 'correct']) {
    const actual = required.filter(([keys]) => mutation !== 'missing' || !keys.idempotencyKeyHash)
      .map(([key, options]) => ({ key, ...options }));
    const target = actual.find(index => index.key.idempotencyKeyHash);
    if (mutation === 'nonunique') target.unique = false;
    if (mutation === 'predicate') target.partialFilterExpression = { idempotencyKeyHash: { $exists: true } };
    const findings = await inspectConnectionIndexes({ db: { collection(name) {
      return { listIndexes: () => ({ toArray: async () => name === Order.collection.collectionName ? actual : [] }) };
    } } });
    const orderFindings = findings.filter(f => f.collection === Order.collection.collectionName);
    assert.equal(orderFindings.length > 0, mutation !== 'correct');
  }
});

test('Production explicit index setup is read-only and fails on missing indexes', async () => {
  const model = { schema: { indexes: () => [[{ id: 1 }, { unique: true }]] },
    collection: { listIndexes: () => ({ toArray: async () => [{ key: { id: 1 }, unique: true }] }) },
    createIndexes: () => assert.fail('Production must never create indexes') };
  const before = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try {
    await ensureModelIndexes(model);
    model.collection.listIndexes = () => ({ toArray: async () => [] });
    await assert.rejects(ensureModelIndexes(model), /Required indexes/);
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = before;
  }
});
