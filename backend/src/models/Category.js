import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
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
    imageUrl: { type: String, trim: true },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'sortOrder must be an integer',
      },
    },
    isActive: { type: Boolean, default: true },
    // Internal write fence shared by Product assignment and Category deletion.
    referenceRevision: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

categorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1, sortOrder: 1 });

export default mongoose.model('Category', categorySchema);
