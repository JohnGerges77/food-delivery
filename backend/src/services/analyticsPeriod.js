export class InvalidAnalyticsQuery extends Error {
  constructor() { super('Invalid analytics query'); }
}

const DAY_MS = 86_400_000;
const MAX_CUSTOM_DAYS = 366;

function invalid() { throw new InvalidAnalyticsQuery(); }

function utcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid();
  return date;
}

function monthStart(date, offset = 0) {
  const result = new Date(0);
  result.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + offset, 1);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function dayStart(date) {
  const result = new Date(0);
  result.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth(),
    date.getUTCDate());
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function parseAnalyticsPeriod(query, now = new Date()) {
  if (query === null || typeof query !== 'object' || Array.isArray(query) ||
      !Number.isFinite(now.getTime())) invalid();
  for (const key of Object.keys(query)) {
    if (!['period', 'from', 'to'].includes(key)) invalid();
  }
  const period = query.period ?? (query.from !== undefined || query.to !== undefined
    ? 'custom' : '30d');
  if (!['7d', '30d', '6m', '12m', 'custom'].includes(period)) invalid();
  let from;
  let toExclusive;
  let previousFrom;
  let granularity;
  if (period === 'custom') {
    if (query.from === undefined || query.to === undefined) invalid();
    from = utcDate(query.from);
    const to = utcDate(query.to);
    const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
    if (days < 1 || days > MAX_CUSTOM_DAYS || to.getTime() >=
        Date.UTC(9999, 11, 31)) invalid();
    toExclusive = new Date(to.getTime() + DAY_MS);
    previousFrom = new Date(from.getTime() - days * DAY_MS);
    granularity = days <= 31 ? 'day' : days <= 183 ? 'week' : 'month';
  } else {
    if (query.from !== undefined || query.to !== undefined) invalid();
    const today = dayStart(now);
    if (period === '7d' || period === '30d') {
      const days = period === '7d' ? 7 : 30;
      from = new Date(today.getTime() - (days - 1) * DAY_MS);
      toExclusive = new Date(today.getTime() + DAY_MS);
      previousFrom = new Date(from.getTime() - days * DAY_MS);
      granularity = 'day';
    } else {
      const months = period === '6m' ? 6 : 12;
      from = monthStart(now, -(months - 1));
      toExclusive = monthStart(now, 1);
      previousFrom = monthStart(now, -(2 * months - 1));
      granularity = period === '6m' ? 'week' : 'month';
    }
  }
  return Object.freeze({ period, from, toExclusive, previousFrom,
    previousToExclusive: from, granularity });
}

export function parseAnalyticsQuery(query, endpoint, now = new Date()) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) invalid();
  const extras = endpoint === 'top-products' ? ['limit', 'rankBy'] : [];
  for (const key of Object.keys(query)) {
    if (!['period', 'from', 'to', ...extras].includes(key)) invalid();
  }
  const period = parseAnalyticsPeriod(Object.fromEntries(
    Object.entries(query).filter(([key]) => !extras.includes(key))), now);
  if (endpoint !== 'top-products') return { period };
  const limit = query.limit === undefined ? 5 : Number(query.limit);
  if (query.limit !== undefined && (typeof query.limit !== 'string' ||
      !['5', '10', '20'].includes(query.limit))) invalid();
  const rankBy = query.rankBy ?? 'quantitySold';
  if (!['quantitySold', 'deliveredItemValue'].includes(rankBy)) invalid();
  return { period, limit, rankBy };
}

export function periodMetadata(period, currency) {
  return { period: period.period, from: period.from.toISOString(),
    toExclusive: period.toExclusive.toISOString(),
    granularity: period.granularity, currency };
}

export function bucketStart(date, granularity) {
  if (granularity === 'day') return dayStart(date);
  if (granularity === 'month') return monthStart(date);
  const midnight = dayStart(date);
  return new Date(midnight.getTime() - ((midnight.getUTCDay() + 6) % 7) * DAY_MS);
}

export function nextBucket(date, granularity) {
  if (granularity === 'month') return monthStart(date, 1);
  return new Date(date.getTime() + (granularity === 'week' ? 7 : 1) * DAY_MS);
}

export function bucketStarts(from, toExclusive, granularity) {
  const buckets = [];
  for (let cursor = bucketStart(from, granularity); cursor < toExclusive;
    cursor = nextBucket(cursor, granularity)) {
    buckets.push(cursor);
  }
  return buckets;
}
