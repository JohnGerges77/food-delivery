import mongoose from 'mongoose';

function omitTokenHashes(_document, result) {
  delete result.tokenHash;
  delete result.csrfTokenHash;
  return result;
}

const ownerSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, select: false },
  csrfTokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
  toJSON: { transform: omitTokenHashes },
  toObject: { transform: omitTokenHashes },
});

ownerSessionSchema.index({ tokenHash: 1 }, { unique: true });
ownerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OwnerSession', ownerSessionSchema);
