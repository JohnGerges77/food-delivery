import mongoose from 'mongoose';

const deliverySettingsSchema = new mongoose.Schema(
  {
    deliveryFee: { type: Number, min: 0 },
    minimumOrder: { type: Number, min: 0 },
    estimatedDeliveryTime: { type: String, trim: true },
    deliveryAvailable: { type: Boolean, default: true },
  },
  { _id: false },
);

function optionalWebUrl() {
  return {
    type: String,
    trim: true,
    validate: {
      validator(value) {
        if (!value) return true;

        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
        } catch {
          return false;
        }
      },
      message: 'Must be a valid HTTP or HTTPS URL',
    },
  };
}

const socialLinksSchema = new mongoose.Schema(
  {
    facebook: optionalWebUrl(),
    instagram: optionalWebUrl(),
    whatsapp: optionalWebUrl(),
  },
  { _id: false },
);

const brandingSchema = new mongoose.Schema(
  {
    brandName: { type: String, trim: true },
    primaryColor: {
      type: String,
      trim: true,
      match: [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color'],
    },
  },
  { _id: false },
);

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a valid slug'],
    },
    description: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    phone: { type: String, trim: true },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address'],
    },
    address: { type: String, trim: true },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{3}$/, 'Must be a three-letter uppercase currency code'],
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    storefrontTheme: { type: String, enum: ['savora-classic', 'savora-aqua', 'savora-cafe', 'savora-luxury'], default: 'savora-classic' },
    openingHours: { type: String, trim: true },
    deliverySettings: deliverySettingsSchema,
    socialLinks: socialLinksSchema,
    branding: brandingSchema,
  },
  { timestamps: true },
);

restaurantSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Restaurant', restaurantSchema);
