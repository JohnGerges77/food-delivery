import mongoose from 'mongoose';

function omitPasswordHash(_document, result) {
  delete result.passwordHash;
  return result;
}

const userSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner'], default: 'owner' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { transform: omitPasswordHash },
    toObject: { transform: omitPasswordHash },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index(
  { restaurantId: 1 },
  { unique: true, partialFilterExpression: { role: 'owner' } },
);

export default mongoose.model('User', userSchema);
