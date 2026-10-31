import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true },
  tokenHash: { type: String, required: true, select: false },
  csrfTokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('PlatformAdminSession', schema);
