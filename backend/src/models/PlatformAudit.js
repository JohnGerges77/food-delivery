import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true },
  action: { type: String, enum: ['restaurant.created', 'restaurant.suspended',
    'restaurant.activated', 'restaurant.theme_changed'], required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ restaurantId: 1, createdAt: -1 });
export default mongoose.model('PlatformAudit', schema);
