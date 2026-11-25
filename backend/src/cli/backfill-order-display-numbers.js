import mongoose from 'mongoose';
import OrderSchema from '../models/Order.js';
import RestaurantSchema from '../models/Restaurant.js';
import { compareIndexes } from './check-indexes.js';
import { withCategoryReferenceTransaction } from '../services/categoryReference.js';
import { allocateOrderDisplayNumber, DISPLAY_NUMBER_FLOOR, orderWriteRetry, validOrderDisplayNumber } from '../services/orderDisplayNumbers.js';

const legacy = { displayNumber: { $exists: false } };
const numbered = { displayNumber: { $exists: true } };
class BackfillError extends Error {}

async function inspect(Order, Restaurant, restaurantId, session) {
  const restaurant = await Restaurant.findById(restaurantId).select('orderDisplaySequence').session(session).lean();
  if (!restaurant) throw new BackfillError('Restaurant not found');
  const sequence = restaurant.orderDisplaySequence ?? DISPLAY_NUMBER_FLOOR;
  if (!Number.isSafeInteger(sequence) || sequence < DISPLAY_NUMBER_FLOOR) throw new BackfillError('Invalid stored sequence');

  let maximum = DISPLAY_NUMBER_FLOOR;
  let assigned = 0;
  for await (const order of Order.find({ restaurantId, ...numbered }).sort({ displayNumber: 1 })
    .select('displayNumber').session(session).lean().cursor()) {
    if (!validOrderDisplayNumber(order.displayNumber)) throw new BackfillError('Invalid stored order display number');
    if (maximum === order.displayNumber) throw new BackfillError('Duplicate order display number');
    maximum = order.displayNumber;
    assigned++;
  }
  const remaining = await Order.countDocuments({ restaurantId, ...legacy }).session(session);
  const floor = Math.max(sequence, maximum);
  if (remaining > Number.MAX_SAFE_INTEGER - floor) throw new BackfillError('Insufficient sequence capacity');
  return { assigned, remaining, sequence, maximum, floor };
}

async function writeLock(Restaurant, restaurantId, session) {
  const row = await Restaurant.findOneAndUpdate({ _id: restaurantId }, { $inc: { __v: 1 } },
    { session, returnDocument: 'after', timestamps: false, projection: { _id: 1 } }).lean();
  if (!row) throw new BackfillError('Restaurant not found');
}

export async function backfillOrderDisplayNumbers(connection, slug, { apply = false, limit = 500 } = {}) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 255 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 5000) throw new BackfillError('Invalid restaurant slug or limit');
  const Restaurant = connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema);
  const Order = connection.models.Order ?? connection.model('Order', OrderSchema.schema);
  const restaurant = await Restaurant.findOne({ slug }).select('_id').lean();
  if (!restaurant) throw new BackfillError('Restaurant not found');
  const restaurantId = restaurant._id;
  const snapshot = () => withCategoryReferenceTransaction(connection, (session) => inspect(Order, Restaurant, restaurantId, session));
  const before = await snapshot();
  if (!apply) return { slug, mode: 'dry-run', ...before };

  const required = Order.schema.indexes().filter(([key]) => Object.hasOwn(key, 'displayNumber'));
  if (compareIndexes(required, await Order.collection.listIndexes().toArray()).length) {
    throw new BackfillError('Required display number index is missing or conflicts');
  }
  if (before.remaining === 0 && before.sequence >= before.maximum) {
    return { slug, mode: 'apply', updated: 0, ...before };
  }

  // Checkout acquires the same write lock before touching the counter.
  await withCategoryReferenceTransaction(connection, async (session) => {
    await writeLock(Restaurant, restaurantId, session);
    const highest = await Order.findOne({ restaurantId, ...numbered }).sort({ displayNumber: -1 })
      .select('displayNumber').session(session).lean();
    if (highest && !validOrderDisplayNumber(highest.displayNumber)) throw new BackfillError('Invalid stored order display number');
    await Restaurant.updateOne({ _id: restaurantId },
      { $max: { orderDisplaySequence: highest?.displayNumber ?? DISPLAY_NUMBER_FLOOR } },
      { session, timestamps: false });
  }, orderWriteRetry);

  let updated = 0;
  while (updated < limit) {
    const changed = await withCategoryReferenceTransaction(connection, async (session) => {
      await writeLock(Restaurant, restaurantId, session);
      const order = await Order.findOne({ restaurantId, ...legacy }).sort({ createdAt: 1, _id: 1 })
        .select('_id').session(session).lean();
      if (!order) return false;
      const displayNumber = await allocateOrderDisplayNumber(Restaurant, restaurantId, session);
      const result = await Order.updateOne({ _id: order._id, restaurantId, ...legacy },
        { $set: { displayNumber } }, { session, timestamps: false, runValidators: true });
      if (result.modifiedCount !== 1) throw new BackfillError('Legacy assignment changed unexpectedly');
      return true;
    }, orderWriteRetry);
    if (!changed) break;
    updated++;
  }
  const after = await snapshot();
  if (after.sequence < after.maximum) throw new BackfillError('Sequence verification failed');
  return { slug, mode: 'apply', updated, ...after };
}

if (import.meta.main) {
  let connection;
  try {
    const [database, slug, flag, argLimit, ...extra] = process.argv.slice(2);
    if (!database || !slug || (flag !== undefined && flag !== '--apply') || extra.length ||
      !/^[a-zA-Z0-9_-]+$/.test(database)) throw new BackfillError('Usage: node src/cli/backfill-order-display-numbers.js DATABASE SLUG [--apply [LIMIT]]');
    const uri = process.env.MONGODB_ORDER_BACKFILL_URI;
    let parsed;
    try { parsed = new URL(uri); } catch { throw new BackfillError('Order backfill URI is missing or invalid'); }
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      parsed.pathname !== `/${database}` || [...parsed.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname') ||
      (database === 'savora_test' && decodeURIComponent(parsed.username) !== 'savora_test_user')) {
      throw new BackfillError('Order backfill URI does not match the requested database identity');
    }
    connection = mongoose.createConnection(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10_000 });
    await connection.asPromise();
    if (connection.name !== database || connection.db.databaseName !== database) throw new BackfillError('Connected database does not match');
    console.log(JSON.stringify(await backfillOrderDisplayNumbers(connection, slug, {
      apply: flag === '--apply', ...(argLimit ? { limit: Number(argLimit) } : {}),
    })));
  } catch (error) {
    // Driver connection errors may contain connection details. Use an allowlisted error format.
    if (error instanceof BackfillError) console.error(error.message);
    else console.error('Order display number backfill failed');
    process.exitCode = 1;
  } finally { if (connection) await connection.close(); }
}
