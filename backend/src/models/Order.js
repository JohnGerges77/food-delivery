import mongoose from 'mongoose';

function omitTrackingTokenHash(_document, result) {
  delete result.trackingTokenHash;
  delete result.idempotencyKeyHash;
  delete result.idempotencyRequestHash;
  delete result.whatsappTarget;
  return result;
}

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isFinite, message: 'unitPrice must be finite' },
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'quantity must be an integer' },
    },
    imageUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    orderNumber: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address'],
    },
    deliveryAddress: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isFinite, message: 'subtotal must be finite' },
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
      validate: { validator: Number.isFinite, message: 'deliveryFee must be finite' },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isFinite, message: 'total must be finite' },
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled'],
      default: 'pending',
    },
    source: { type: String, enum: ['website'], default: 'website' },
    submissionMethod: { type: String, required: true, enum: ['direct', 'whatsapp'] },
    idempotencyKeyHash: { type: String, select: false },
    idempotencyRequestHash: { type: String, select: false },
    whatsappTarget: { type: String, select: false },
    notes: { type: String, trim: true },
    trackingTokenHash: { type: String, select: false },
    deliveredAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { transform: omitTrackingTokenHash },
    toObject: { transform: omitTrackingTokenHash },
  },
);

orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, idempotencyKeyHash: 1 },
  { unique: true, partialFilterExpression: { idempotencyKeyHash: { $type: 'string' } } });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, deliveredAt: -1 },
  { partialFilterExpression: { status: 'delivered' } });

export default mongoose.model('Order', orderSchema);
