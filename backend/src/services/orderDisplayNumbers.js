export const FIRST_DISPLAY_NUMBER = 1001;
export const DISPLAY_NUMBER_FLOOR = FIRST_DISPLAY_NUMBER - 1;
export const orderWriteRetry = Object.freeze({ maxAttempts: 8, retryDelayMs: 100 });

export function validOrderDisplayNumber(value) {
  return Number.isSafeInteger(value) && value >= FIRST_DISPLAY_NUMBER;
}

export async function allocateOrderDisplayNumber(Restaurant, restaurantId, session) {
  const restaurant = await Restaurant.findOneAndUpdate({
    _id: restaurantId,
    $or: [{ orderDisplaySequence: { $exists: false } },
      { orderDisplaySequence: { $gte: DISPLAY_NUMBER_FLOOR, $lt: Number.MAX_SAFE_INTEGER } }],
  }, [{ $set: { orderDisplaySequence: { $add: [
    { $ifNull: ['$orderDisplaySequence', DISPLAY_NUMBER_FLOOR] }, 1,
  ] } } }], {
    session, updatePipeline: true, returnDocument: 'after', timestamps: false, projection: { orderDisplaySequence: 1 },
  }).lean();
  if (!validOrderDisplayNumber(restaurant?.orderDisplaySequence)) {
    throw new Error('Invalid or exhausted order display sequence');
  }
  return restaurant.orderDisplaySequence;
}

export function orderDisplayReference(order) {
  return validOrderDisplayNumber(order.displayNumber) ? `#${order.displayNumber}` : order.orderNumber;
}
