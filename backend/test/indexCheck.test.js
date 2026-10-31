import assert from 'node:assert/strict';
import test from 'node:test';
import { compareIndexes, inspectIndexes } from '../src/cli/check-indexes.js';

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
