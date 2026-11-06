import 'dotenv/config';
import mongoose from 'mongoose';
import { createMediaStorage, storageConfig } from '../services/mediaStorage.js';
import { reconcileStaleMedia } from '../services/ownerMedia.js';

const apply = process.argv.includes('--apply');
if (process.argv.some((arg) => !['--apply'].includes(arg) && arg.startsWith('--'))) {
  throw new Error('Only --apply is supported');
}
const storage = createMediaStorage(storageConfig());
if (!storage) throw new Error('Media storage is not configured');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const result = await reconcileStaleMedia(mongoose.connection, storage, { apply });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', provider: storage.provider,
    ...result }));
  if (result.failed) process.exitCode = 1;
} finally { await mongoose.disconnect(); }
