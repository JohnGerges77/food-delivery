import mongoose from 'mongoose';
import { currencyFractionDigits } from './ownerProducts.js';
import { createOwnerTenantScope, ownerListFilter } from './ownerTenant.js';
import { bucketStarts, periodMetadata } from './analyticsPeriod.js';

const STATUSES = ['pending', 'delivered', 'cancelled'];
const METHODS = ['direct', 'whatsapp'];
const STATUS_LABELS = ['Pending', 'Delivered', 'Cancelled'];
const MAX_TIME_MS = 10_000;

function context(connection, auth) {
  createOwnerTenantScope(connection, auth);
  const digits = currencyFractionDigits(auth.restaurant.currency);
  if (!Number.isInteger(digits) || digits < 0 || digits > 3) {
    throw new Error('Unsupported currency precision');
  }
  return { Order: connection.models.Order, digits, scale: 10 ** digits,
    currency: auth.restaurant.currency };
}

function minorExpression(field, scale) {
  return { $round: [{ $multiply: [
    { $toDecimal: field }, mongoose.Types.Decimal128.fromString(String(scale)),
  ] }, 0] };
}

function decimalInteger(value) {
  if (value === undefined || value === null) return 0n;
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:E([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('Invalid analytics amount');
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0) - fraction.length;
  if (BigInt(match[2] + fraction) === 0n) return 0n;
  if (Math.abs(exponent) > 100) throw new Error('Analytics amount too large');
  let integer = BigInt(match[2] + fraction);
  if (exponent < 0) {
    const divisor = 10n ** BigInt(-exponent);
    if (integer % divisor !== 0n) throw new Error('Invalid analytics amount');
    integer /= divisor;
  } else integer *= 10n ** BigInt(exponent);
  return match[1] ? -integer : integer;
}

function money(minor, scale) {
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) ||
      minor < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Analytics amount exceeds safe JSON precision');
  }
  return Number(minor) / scale;
}

function averageMinor(totalMinor, count) {
  if (!count) return 0n;
  return (totalMinor + BigInt(Math.floor(count / 2))) / BigInt(count);
}

function roundedPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round(numerator / denominator * 10_000) / 100;
}

// Legacy status values remain stored unchanged and report as pending.
export const operationalStatusExpression = {
  $cond: [{ $in: ['$status', ['delivered', 'cancelled']] }, '$status', 'pending'],
};

export function completePercentages(counts, total) {
  if (!total) return counts.map(() => 0);
  const hundredths = counts.map((count) => Math.floor(count * 10_000 / total));
  let remainder = 10_000 - hundredths.reduce((sum, value) => sum + value, 0);
  const fractions = counts.map((count, index) => ({ index,
    fraction: count * 10_000 / total - hundredths[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of fractions) {
    if (remainder === 0) break;
    hundredths[index] += 1;
    remainder -= 1;
  }
  return hundredths.map((value) => value / 100);
}

function compare(current, previous, { scale = 1 } = {}) {
  const isMoney = typeof current === 'bigint';
  const difference = current - previous;
  const numeric = (value) => isMoney ? money(value, scale) : value;
  const percentageChange = previous === (isMoney ? 0n : 0) ? null :
    isMoney
      ? Number((difference * 10_000n +
        (difference < 0n ? -previous / 2n : previous / 2n)) / previous) / 100
      : Math.round(difference / previous * 10_000) / 100;
  return { current: numeric(current), previous: numeric(previous),
    absoluteChange: numeric(difference), percentageChange };
}

function dateTrunc(field, granularity) {
  return { $dateTrunc: { date: field, unit: granularity, timezone: 'UTC',
    ...(granularity === 'week' ? { startOfWeek: 'monday' } : {}) } };
}

function aggregate(Order, pipeline) {
  return Order.aggregate(pipeline).option({ maxTimeMS: MAX_TIME_MS });
}

async function trendRows(Order, auth, from, toExclusive, granularity, scale) {
  const [created, delivered] = await Promise.all([
    aggregate(Order, [
      { $match: ownerListFilter(auth, { createdAt: { $gte: from, $lt: toExclusive } }) },
      { $group: { _id: dateTrunc('$createdAt', granularity), ordersCreated: { $sum: 1 } } },
    ]),
    aggregate(Order, [
      { $match: ownerListFilter(auth, { status: 'delivered',
        deliveredAt: { $gte: from, $lt: toExclusive } }) },
      { $group: { _id: dateTrunc('$deliveredAt', granularity),
        ordersDelivered: { $sum: 1 },
        valueMinor: { $sum: minorExpression('$total', scale) } } },
    ]),
  ]);
  return fillTrendRows(from, toExclusive, granularity, scale, created, delivered);
}

function fillTrendRows(from, toExclusive, granularity, scale, created, delivered) {
  const createdMap = new Map(created.map((row) => [row._id.toISOString(), row]));
  const deliveredMap = new Map(delivered.map((row) => [row._id.toISOString(), row]));
  return bucketStarts(from, toExclusive, granularity).map((bucket) => {
    const key = bucket.toISOString();
    const ordersCreated = createdMap.get(key)?.ordersCreated ?? 0;
    const ordersDelivered = deliveredMap.get(key)?.ordersDelivered ?? 0;
    const valueMinor = decimalInteger(deliveredMap.get(key)?.valueMinor);
    return { date: key.slice(0, 10), bucketStart: key, ordersCreated,
      ordersDelivered, deliveredOrderValue: money(valueMinor, scale),
      averageDeliveredOrderValue: money(averageMinor(valueMinor, ordersDelivered), scale) };
  });
}

export async function ownerTrends(connection, auth, period) {
  const { Order, scale, currency } = context(connection, auth);
  const [series, previousSeries] = await Promise.all([
    trendRows(Order, auth, period.from, period.toExclusive, period.granularity, scale),
    trendRows(Order, auth, period.previousFrom, period.previousToExclusive,
      period.granularity, scale),
  ]);
  return { ...periodMetadata(period, currency), series, previousSeries };
}

export async function ownerOverview(connection, auth, period) {
  const { Order, scale, currency } = context(connection, auth);
  const [createdResult, deliveredResult] = await Promise.all([
    aggregate(Order, [
      { $match: ownerListFilter(auth, { createdAt: {
        $gte: period.previousFrom, $lt: period.toExclusive } }) },
      { $facet: {
        statuses: [{ $group: { _id: {
          window: { $cond: [{ $lt: ['$createdAt', period.from] },
            'previous', 'current'] }, status: operationalStatusExpression,
        }, count: { $sum: 1 } } }],
        sparkline: [
          { $match: { createdAt: { $gte: period.from } } },
          { $group: { _id: dateTrunc('$createdAt', period.granularity),
            ordersCreated: { $sum: 1 } } },
        ],
      } },
    ]),
    aggregate(Order, [
      { $match: ownerListFilter(auth, { status: 'delivered', deliveredAt: {
        $gte: period.previousFrom, $lt: period.toExclusive } }) },
      { $facet: {
        totals: [{ $group: { _id: {
          $cond: [{ $lt: ['$deliveredAt', period.from] },
            'previous', 'current'],
        }, count: { $sum: 1 },
        totalMinor: { $sum: minorExpression('$total', scale) },
        subtotalMinor: { $sum: minorExpression('$subtotal', scale) },
        feeMinor: { $sum: minorExpression('$deliveryFee', scale) } } }],
        sparkline: [
          { $match: { deliveredAt: { $gte: period.from } } },
          { $group: { _id: dateTrunc('$deliveredAt', period.granularity),
            ordersDelivered: { $sum: 1 },
            valueMinor: { $sum: minorExpression('$total', scale) } } },
        ],
      } },
    ]),
  ]);
  const createdRows = createdResult[0].statuses;
  const deliveredRows = deliveredResult[0].totals;
  const sparkline = fillTrendRows(period.from, period.toExclusive,
    period.granularity, scale, createdResult[0].sparkline,
    deliveredResult[0].sparkline);
  const counts = { current: Object.fromEntries(STATUSES.map((status) => [status, 0])),
    previous: Object.fromEntries(STATUSES.map((status) => [status, 0])) };
  for (const row of createdRows) {
    if (Object.hasOwn(counts[row._id.window], row._id.status)) {
      counts[row._id.window][row._id.status] = row.count;
    }
  }
  const delivered = { current: null, previous: null };
  for (const row of deliveredRows) delivered[row._id] = row;
  const orderTotal = (window) => Object.values(counts[window]).reduce((sum, n) => sum + n, 0);
  const count = (window, status) => counts[window][status];
  const amount = (window, field) => decimalInteger(delivered[window]?.[field]);
  const deliveredCount = (window) => delivered[window]?.count ?? 0;
  const totalOrders = compare(orderTotal('current'), orderTotal('previous'));
  const deliveredOrderValue = compare(amount('current', 'totalMinor'),
    amount('previous', 'totalMinor'), { scale });
  return {
    ...periodMetadata(period, currency),
    totalOrders,
    deliveredOrders: compare(count('current', 'delivered'), count('previous', 'delivered')),
    pendingOrders: compare(count('current', 'pending'), count('previous', 'pending')),
    cancelledOrders: compare(count('current', 'cancelled'), count('previous', 'cancelled')),
    ordersDeliveredInPeriod: compare(deliveredCount('current'), deliveredCount('previous')),
    deliveredOrderValue,
    deliveredSubtotal: compare(amount('current', 'subtotalMinor'),
      amount('previous', 'subtotalMinor'), { scale }),
    deliveredDeliveryFees: compare(amount('current', 'feeMinor'),
      amount('previous', 'feeMinor'), { scale }),
    averageDeliveredOrderValue: compare(
      averageMinor(amount('current', 'totalMinor'), deliveredCount('current')),
      averageMinor(amount('previous', 'totalMinor'), deliveredCount('previous')),
      { scale }),
    cancellationRate: compare(roundedPercent(count('current', 'cancelled'),
      orderTotal('current')), roundedPercent(count('previous', 'cancelled'),
      orderTotal('previous'))),
    deliveryCompletionRate: compare(roundedPercent(count('current', 'delivered'),
      orderTotal('current')), roundedPercent(count('previous', 'delivered'),
      orderTotal('previous'))),
    sparklines: {
      totalOrders: sparkline.map(({ date, ordersCreated }) => ({ date, value: ordersCreated })),
      deliveredOrderValue: sparkline.map(({ date, deliveredOrderValue: value }) =>
        ({ date, value })),
    },
    insights: {
      orderVolumeChange: totalOrders.absoluteChange,
      deliveredValueChange: deliveredOrderValue.absoluteChange,
      currentCancellationProportion: roundedPercent(count('current', 'cancelled'),
        orderTotal('current')),
    },
  };
}

export async function ownerBreakdowns(connection, auth, period) {
  const { Order, currency } = context(connection, auth);
  const [result] = await aggregate(Order, [
    { $match: ownerListFilter(auth, { createdAt: {
      $gte: period.from, $lt: period.toExclusive } }) },
    { $facet: {
      statuses: [{ $group: { _id: operationalStatusExpression, count: { $sum: 1 } } }],
      methods: [{ $group: { _id: '$submissionMethod', count: { $sum: 1 } } }],
    } },
  ]);
  const statusCounts = new Map(result.statuses.map((row) => [row._id, row.count]));
  const methodCounts = new Map(result.methods.map((row) => [row._id, row.count]));
  const total = result.statuses.reduce((sum, row) => sum + row.count, 0);
  const statusPercentages = completePercentages(
    STATUSES.map((key) => statusCounts.get(key) ?? 0), total);
  const methodPercentages = completePercentages(
    METHODS.map((key) => methodCounts.get(key) ?? 0), total);
  const item = (key, label, count, percentage) => ({ key, label, count, percentage });
  return { ...periodMetadata(period, currency), totalOrders: total,
    submissionMethods: METHODS.map((key, index) => item(key,
      key === 'direct' ? 'Direct' : 'WhatsApp', methodCounts.get(key) ?? 0,
      methodPercentages[index])),
    statuses: STATUSES.map((key, index) => item(key, STATUS_LABELS[index],
      statusCounts.get(key) ?? 0, statusPercentages[index])),
  };
}

export async function ownerTopProducts(connection, auth, period, { limit, rankBy }) {
  const { Order, scale, currency } = context(connection, auth);
  const sort = rankBy === 'quantitySold'
    ? { quantitySold: -1, itemMinor: -1, _id: 1 }
    : { itemMinor: -1, quantitySold: -1, _id: 1 };
  const [result] = await aggregate(Order, [
    { $match: ownerListFilter(auth, { status: 'delivered', deliveredAt: {
      $gte: period.from, $lt: period.toExclusive } }) },
    { $unwind: { path: '$items', includeArrayIndex: 'itemIndex' } },
    { $sort: { deliveredAt: -1, _id: -1, itemIndex: 1 } },
    { $group: { _id: '$items.productId', productName: { $first: '$items.name' },
      quantitySold: { $sum: '$items.quantity' },
      itemMinor: { $sum: { $multiply: [
        minorExpression('$items.unitPrice', scale), '$items.quantity',
      ] } } } },
    { $facet: {
      ranked: [{ $sort: sort }, { $limit: limit }],
      mostFrequent: [{ $sort: { quantitySold: -1, itemMinor: -1, _id: 1 } },
        { $limit: 1 }],
    } },
  ]);
  const rows = result.ranked;
  const frequent = result.mostFrequent[0];
  return { ...periodMetadata(period, currency), rankBy, limit,
    products: rows.map((row, index) => ({ rank: index + 1,
      productId: String(row._id), productName: row.productName,
      quantitySold: row.quantitySold,
      deliveredItemValue: money(decimalInteger(row.itemMinor), scale) })),
    mostFrequentlyOrderedProduct: frequent
      ? { productId: String(frequent._id), productName: frequent.productName }
      : null,
  };
}

export async function ownerActivity(connection, auth, period) {
  const { Order, currency } = context(connection, auth);
  const rows = await aggregate(Order, [
    { $match: ownerListFilter(auth, { createdAt: {
      $gte: period.from, $lt: period.toExclusive } }) },
    { $group: { _id: {
      weekday: { $subtract: [{ $isoDayOfWeek: { date: '$createdAt', timezone: 'UTC' } }, 1] },
      hour: { $hour: { date: '$createdAt', timezone: 'UTC' } },
    }, orders: { $sum: 1 } } },
  ]);
  const byCell = new Map(rows.map((row) => [`${row._id.weekday}:${row._id.hour}`, row.orders]));
  const cells = [];
  const weekdays = Array(7).fill(0);
  const hours = Array(24).fill(0);
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const orders = byCell.get(`${weekday}:${hour}`) ?? 0;
      cells.push({ weekday, hour, orders });
      weekdays[weekday] += orders;
      hours[hour] += orders;
    }
  }
  const totalOrders = weekdays.reduce((sum, value) => sum + value, 0);
  const busiestWeekday = totalOrders ? weekdays.indexOf(Math.max(...weekdays)) : null;
  const busiestHour = totalOrders ? hours.indexOf(Math.max(...hours)) : null;
  const peak = totalOrders ? cells.reduce((best, cell) =>
    cell.orders > best.orders ? cell : best, cells[0]) : null;
  return { ...periodMetadata(period, currency), cells, totalOrders,
    insights: {
      busiestWeekday: busiestWeekday === null ? null :
        { weekday: busiestWeekday, orders: weekdays[busiestWeekday] },
      busiestHour: busiestHour === null ? null :
        { hour: busiestHour, orders: hours[busiestHour] },
      highestActivityCell: peak,
    },
  };
}
