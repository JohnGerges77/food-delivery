import mongoose from 'mongoose';

function omitHash(_document, result) {
  delete result.passwordHash;
  return result;
}

const schema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['platform_admin'], default: 'platform_admin', required: true },
  isActive: { type: Boolean, default: true },
  bootstrapSlot: { type: String, enum: ['primary'], default: 'primary', required: true,
    select: false },
}, { timestamps: true, toJSON: { transform: omitHash }, toObject: { transform: omitHash } });

schema.index({ email: 1 }, { unique: true });
schema.index({ bootstrapSlot: 1 }, { unique: true });
export default mongoose.model('PlatformAdmin', schema);
