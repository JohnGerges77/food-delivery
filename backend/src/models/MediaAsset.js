import mongoose from 'mongoose';

const variant = new mongoose.Schema({ key: { type: String, required: true },
  width: { type: Number, required: true }, height: { type: Number, required: true },
  bytes: { type: Number, required: true },
  sha256: { type: String, required: true, match: /^[0-9a-f]{64}$/ } }, { _id: false });

const mediaAssetSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  targetKind: { type: String, enum: ['product', 'gallery', 'logo'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  provider: { type: String, enum: ['local', 'blob'], required: true },
  status: { type: String, enum: ['pending', 'active', 'retired'], default: 'pending' },
  sourceSha256: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
  sourceMime: { type: String, required: true },
  sourceWidth: { type: Number, required: true },
  sourceHeight: { type: Number, required: true },
  variants: { small: { type: variant, required: true }, large: { type: variant, required: true } },
}, { timestamps: true, autoIndex: false, autoCreate: false });

mediaAssetSchema.index({ restaurantId: 1, targetKind: 1, targetId: 1, status: 1 });
mediaAssetSchema.index({ status: 1, updatedAt: 1 });
mediaAssetSchema.index({ restaurantId: 1, targetKind: 1, targetId: 1, sourceSha256: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } });

export default mongoose.model('MediaAsset', mediaAssetSchema);
