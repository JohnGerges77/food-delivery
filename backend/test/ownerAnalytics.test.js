import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { bucketStarts, InvalidAnalyticsQuery, parseAnalyticsPeriod,
  parseAnalyticsQuery } from '../src/services/analyticsPeriod.js';
import { completePercentages, operationalStatusExpression,
  ownerOverview } from '../src/services/ownerAnalytics.js';

const now = new Date('2026-10-14T23:59:59.999Z');

test('legacy statuses group as pending and rounded slices total exactly 100', () => {
  assert.deepEqual(operationalStatusExpression,
    { $cond: [{ $in: ['$status', ['delivered', 'cancelled']] }, '$status', 'pending'] });
  assert.deepEqual(completePercentages([1, 1, 1], 3), [33.34, 33.33, 33.33]);
  assert.deepEqual(completePercentages([0, 0, 0], 0), [0, 0, 0]);
});

test('analytics presets use exact UTC calendar boundaries and equivalent predecessors', () => {
  const expected = {
    '7d': ['2026-10-08', '2026-10-15', '2026-10-01', 'day'],
    '30d': ['2026-09-15', '2026-10-15', '2026-08-16', 'day'],
    '6m': ['2026-05-01', '2026-11-01', '2025-11-01', 'week'],
    '12m': ['2025-11-01', '2026-11-01', '2024-11-01', 'month'],
  };
  for (const [preset, [from, end, previous, granularity]] of Object.entries(expected)) {
    const result = parseAnalyticsPeriod({ period: preset }, now);
    assert.equal(result.from.toISOString().slice(0, 10), from);
    assert.equal(result.toExclusive.toISOString().slice(0, 10), end);
    assert.equal(result.previousFrom.toISOString().slice(0, 10), previous);
    assert.equal(result.previousToExclusive.toISOString(), result.from.toISOString());
    assert.equal(result.granularity, granularity);
  }
  assert.equal(parseAnalyticsPeriod({}, now).period, '30d');
});

test('custom dates validate leap years, boundaries and maximum window', () => {
  const leap = parseAnalyticsPeriod({ from: '2024-02-28', to: '2024-03-01' }, now);
  assert.equal(leap.period, 'custom');
  assert.equal(leap.toExclusive.toISOString(), '2024-03-02T00:00:00.000Z');
  assert.equal(leap.previousFrom.toISOString(), '2024-02-25T00:00:00.000Z');
  assert.equal(parseAnalyticsPeriod({ from: '2025-12-31', to: '2026-01-01' }, now)
    .previousFrom.toISOString(), '2025-12-29T00:00:00.000Z');
  assert.equal(parseAnalyticsPeriod({ from: '2024-01-01', to: '2024-12-31' }, now)
    .granularity, 'month');
  for (const query of [{ period: 'yesterday' }, { from: '2025-02-29', to: '2025-03-01' },
    { from: '2024-02-30', to: '2024-03-01' },
    { from: '2026-10-03', to: '2026-10-02' },
    { from: '2024-01-01', to: '2025-01-01' },
    { period: 'custom', from: '2026-10-01' },
    { period: '7d', from: '2026-10-01', to: '2026-10-02' },
    { period: ['7d', '30d'] }, { restaurantId: 'forged' },
    { $where: '1' }, { 'period.value': '7d' }]) {
    assert.throws(() => parseAnalyticsPeriod(query, now), InvalidAnalyticsQuery);
  }
});

test('daily, Monday-weekly and monthly bucket starts are deterministic', () => {
  const from = new Date('2026-05-01T00:00:00.000Z');
  const to = new Date('2026-06-01T00:00:00.000Z');
  assert.equal(bucketStarts(from, to, 'day').length, 31);
  assert.deepEqual(bucketStarts(from, to, 'week').map((date) =>
    date.toISOString().slice(0, 10)),
  ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']);
  assert.deepEqual(bucketStarts(new Date('2025-12-15T00:00:00.000Z'),
    new Date('2026-02-01T00:00:00.000Z'), 'month').map((date) =>
    date.toISOString().slice(0, 10)), ['2025-12-01', '2026-01-01']);
  assert.equal(bucketStarts(new Date('0099-12-15T00:00:00.000Z'),
    new Date('0100-02-01T00:00:00.000Z'), 'month')[0].toISOString().slice(0, 10),
  '0099-12-01');
  assert.equal(bucketStarts(new Date('0099-12-15T00:00:00.000Z'),
    new Date('0099-12-16T00:00:00.000Z'), 'day')[0].toISOString().slice(0, 10),
  '0099-12-15');
});

test('top product options are narrow and other endpoints reject them', () => {
  assert.deepEqual(((value) => [value.limit, value.rankBy])(
    parseAnalyticsQuery({ period: '7d', limit: '10', rankBy: 'deliveredItemValue' },
      'top-products', now)), [10, 'deliveredItemValue']);
  for (const query of [{ limit: '100' }, { rankBy: 'profit' },
    { limit: ['5', '10'] }]) {
    assert.throws(() => parseAnalyticsQuery(query, 'top-products', now),
      InvalidAnalyticsQuery);
  }
  assert.throws(() => parseAnalyticsQuery({ limit: '5' }, 'overview', now),
    InvalidAnalyticsQuery);
});

test('analytics services reject caller-constructed owner contexts', async () => {
  const fake = { userId: new mongoose.Types.ObjectId(),
    restaurantId: new mongoose.Types.ObjectId(), restaurant: { currency: 'EGP' } };
  await assert.rejects(ownerOverview(mongoose.createConnection(), fake,
    parseAnalyticsPeriod({ period: '7d' }, now)), /Verified owner context/);
});

test('all analytics routes require a verified owner session', async () => {
  const server = createApp({ allowedOrigins: 'https://dashboard.example.test' })
    .listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/owner/stats`;
    for (const endpoint of ['overview', 'trends', 'top-products',
      'breakdowns', 'activity']) {
      const response = await fetch(`${base}/${endpoint}?period=7d`);
      assert.equal(response.status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
