import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import MediaAssetSchema from '../models/MediaAsset.js';
import { createMediaStorage, storageConfig } from '../services/mediaStorage.js';

// Kept for a future migration implementation; Blob support is not installed.
throw new Error('Blob migration is unavailable: no Blob storage adapter is installed');

if (process.argv.some((arg) => arg.startsWith('--') && arg !== '--apply')) {
  throw new Error('Only --apply is supported');
}
const apply = process.argv.includes('--apply');
if (!process.env.MONGODB_URI || !process.env.MIGRATION_UPLOADS_DIR) {
  throw new Error('MONGODB_URI and MIGRATION_UPLOADS_DIR are required');
}
const source = createMediaStorage(storageConfig({ ...process.env, MEDIA_STORAGE_PROVIDER: 'blob' }));
const destination = createMediaStorage(storageConfig({ ...process.env,
  MEDIA_STORAGE_PROVIDER: 'local', UPLOADS_DIR: process.env.MIGRATION_UPLOADS_DIR,
  VERCEL: undefined }));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
let migrated = 0;
let examined = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const MediaAsset = mongoose.connection.models.MediaAsset ??
    mongoose.connection.model('MediaAsset', MediaAssetSchema.schema);
  for await (const asset of MediaAsset.find({ provider: 'blob', status: 'active' }).cursor()) {
    examined++;
    for (const size of ['small', 'large']) {
      const variant = asset.variants[size];
      const sourceStream = await source.read(variant.key);
      if (!sourceStream) throw new Error(`Missing source for asset ${asset.id}`);
      const bytes = Buffer.concat(await Array.fromAsync(sourceStream));
      if (bytes.length !== variant.bytes || sha256(bytes) !== variant.sha256) {
        throw new Error(`Source verification failed for asset ${asset.id}`);
      }
      if (!apply) continue;
      try { await destination.write(variant.key, bytes); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const copyStream = await destination.read(variant.key);
      if (!copyStream) throw new Error(`Missing destination for asset ${asset.id}`);
      const copy = Buffer.concat(await Array.fromAsync(copyStream));
      if (copy.length !== variant.bytes || sha256(copy) !== variant.sha256) {
        throw new Error(`Destination verification failed for asset ${asset.id}`);
      }
    }
    if (!apply) continue;
    const result = await MediaAsset.updateOne({ _id: asset._id, provider: 'blob',
      status: 'active' }, { $set: { provider: 'local' } });
    if (result.modifiedCount !== 1) throw new Error(`Asset changed during migration: ${asset.id}`);
    migrated++;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', examined, migrated,
    remainingBlobActive: await MediaAsset.countDocuments({ provider: 'blob', status: 'active' }) }));
} finally { await mongoose.disconnect(); }
