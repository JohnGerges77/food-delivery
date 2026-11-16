import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0, max: 1_000_000, validate: Number.isFinite },
  isAvailable: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
});

const productSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a valid slug'],
    },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0 },
    variants: { type: [variantSchema], default: [], validate: {
      validator: (items) => items.length <= 20 && new Set(items.map((item) => String(item._id))).size === items.length,
      message: 'Invalid variants',
    } },
    imageUrl: { type: String, trim: true },
    images: { type: [{ type: String, trim: true }], default: [] },
    isAvailable: { type: Boolean, default: true },
    // Checkout writes this fence before inserting an Order; hard delete writes the same document.
    orderReferenceRevision: { type: Number, default: 0, select: false },
    isFeatured: { type: Boolean, default: false },
    preparationTime: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: 'preparationTime must be an integer',
      },
    },
    calories: { type: Number, min: 0 },
  },
  { timestamps: true },
);

productSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
productSchema.index({ restaurantId: 1, categoryId: 1 });

export default mongoose.model('Product', productSchema);
