import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import sharp from 'sharp';
import MediaAssetSchema from '../models/MediaAsset.js';
import ProductSchema from '../models/Product.js';
import RestaurantSchema from '../models/Restaurant.js';
import { ownerIdFilter, OwnerResourceNotFound } from './ownerTenant.js';

export class InvalidMedia extends Error { constructor(message = 'Invalid image') { super(message); } }
export class MediaConflict extends Error { constructor() { super('Image changed; reload and retry'); } }
export class MediaIndexesUnavailable extends Error {
  constructor() { super('Media storage is not ready: required indexes are missing or unavailable'); }
}
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAX_BYTES = 4_000_000;
const MAX_SIDE = 6000;

export function requiredMediaIndexesPresent(indexes) {
  if (!Array.isArray(indexes)) return false;
  const expected = [
    { key: { restaurantId: 1, targetKind: 1, targetId: 1, status: 1 } },
    { key: { status: 1, updatedAt: 1 } },
    { key: { restaurantId: 1, targetKind: 1, targetId: 1, sourceSha256: 1 }, unique: true,
      partialFilterExpression: { status: 'active' } },
  ];
  return expected.every((need) => indexes.some((index) =>
    JSON.stringify(Object.entries(index.key ?? {})) === JSON.stringify(Object.entries(need.key)) &&
    Boolean(index.unique) === Boolean(need.unique) && !index.sparse && !index.hidden &&
    !index.collation && JSON.stringify(index.partialFilterExpression ?? null) ===
      JSON.stringify(need.partialFilterExpression ?? null)));
}

export async function requireMediaIndexes(MediaAsset) {
  let indexes;
  try { indexes = await MediaAsset.collection.indexes(); }
  catch { throw new MediaIndexesUnavailable(); }
  if (!requiredMediaIndexesPresent(indexes)) throw new MediaIndexesUnavailable();
}

function models(connection) {
  if (connection.readyState !== 1) throw new Error('Database unavailable');
  return {
    MediaAsset: connection.models.MediaAsset ?? connection.model('MediaAsset', MediaAssetSchema.schema),
    Product: connection.models.Product ?? connection.model('Product', ProductSchema.schema),
    Restaurant: connection.models.Restaurant ?? connection.model('Restaurant', RestaurantSchema.schema),
  };
}

export function mediaUrl(slug, id, size = 'large') {
  return `/api/public/restaurants/${slug}/media/${id}/${size}`;
}

export function managedMediaId(url) {
  if (typeof url !== 'string') return null;
  return /^\/api\/public\/restaurants\/[a-z0-9-]+\/media\/([0-9a-f]{24})\/large$/.exec(url)?.[1] ?? null;
}

export function ownsStoredKeys(asset) {
  const base = `media/${asset.restaurantId}/${asset._id}`;
  return asset.variants?.small?.key === `${base}/small.webp` &&
    asset.variants?.large?.key === `${base}/large.webp`;
}

export async function prepareImage(bytes, declaredMime) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 16 || bytes.length > MAX_BYTES ||
      !Object.values(MIME).includes(declaredMime)) throw new InvalidMedia();
  let metadata;
  try { metadata = await sharp(bytes, { failOn: 'error', limitInputPixels: 25_000_000 }).metadata(); }
  catch { throw new InvalidMedia(); }
  if (MIME[metadata.format] !== declaredMime || !metadata.width || !metadata.height ||
      metadata.width > MAX_SIDE || metadata.height > MAX_SIDE ||
      metadata.width < 16 || metadata.height < 16 || metadata.pages > 1) throw new InvalidMedia();
  const variants = {};
  for (const [size, width] of [['small', 320], ['large', 1200]]) {
    const { data, info } = await sharp(bytes, { failOn: 'error', limitInputPixels: 25_000_000 })
      .rotate().resize({ width, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    variants[size] = { bytes: data, width: info.width, height: info.height };
  }
  return { sha256: createHash('sha256').update(bytes).digest('hex'),
    mime: declaredMime, width: metadata.width, height: metadata.height, variants };
}

export async function cleanupRetiredMedia(connection, storage, restaurantId, limit = 10) {
  const { MediaAsset } = models(connection);
  const retired = await MediaAsset.find({ restaurantId, provider: storage.provider,
    status: 'retired' }).sort({ updatedAt: 1 }).limit(limit);
  for (const asset of retired) {
    try {
      if (!ownsStoredKeys(asset)) throw new Error('Media key ownership mismatch');
      await storage.delete(asset.variants.small.key);
      await storage.delete(asset.variants.large.key);
      await MediaAsset.deleteOne({ _id: asset._id, status: 'retired' });
    } catch { /* Keep the tombstone so reconciliation can retry. */ }
  }
}

export async function reconcileStaleMedia(connection, storage, {
  olderThan = new Date(Date.now() - 60 * 60 * 1000), limit = 100,
  apply = false,
} = {}) {
  const { MediaAsset, Product, Restaurant } = models(connection);
  if (apply) await requireMediaIndexes(MediaAsset);
  const assets = await MediaAsset.find({ provider: storage.provider,
    status: { $in: ['pending', 'retired'] }, updatedAt: { $lt: olderThan } })
    .sort({ updatedAt: 1 }).limit(limit);
  const summary = { examined: assets.length, referenced: 0, stale: 0, deleted: 0, failed: 0 };
  for (const asset of assets) {
    const restaurant = await Restaurant.findById(asset.restaurantId).select('slug logoUrl').lean();
    const url = restaurant ? mediaUrl(restaurant.slug, asset._id) : null;
    const referenced = restaurant && (asset.targetKind === 'product'
      ? await Product.exists({ _id: asset.targetId, restaurantId: asset.restaurantId,
        imageUrl: url })
      : asset.targetKind === 'gallery'
        ? await Product.exists({ _id: asset.targetId, restaurantId: asset.restaurantId,
          images: url })
        : restaurant.logoUrl === url);
    if (referenced) {
      summary.referenced++;
      if (apply && asset.status === 'pending') await MediaAsset.updateOne({ _id: asset._id,
        status: 'pending' }, { $set: { status: 'active' } });
      continue;
    }
    summary.stale++;
    if (!apply) continue;
    try {
      if (!ownsStoredKeys(asset)) throw new Error('Media key ownership mismatch');
      await MediaAsset.updateOne({ _id: asset._id, status: 'pending' },
        { $set: { status: 'retired' } });
      await storage.delete(asset.variants.small.key);
      await storage.delete(asset.variants.large.key);
      const result = await MediaAsset.deleteOne({ _id: asset._id, status: 'retired' });
      summary.deleted += result.deletedCount;
    } catch { summary.failed++; }
  }
  return summary;
}

export async function replaceOwnerImage(connection, auth, storage, kind, targetId, bytes, mime) {
  if (!storage) throw new Error('Media storage is not configured');
  if (!['product', 'gallery', 'logo'].includes(kind)) throw new InvalidMedia();
  const { MediaAsset, Product, Restaurant } = models(connection);
  await requireMediaIndexes(MediaAsset);
  const target = kind !== 'logo'
    ? await Product.findOne(ownerIdFilter(auth, targetId))
    : await Restaurant.findOne({ _id: auth.restaurantId });
  if (!target) throw new OwnerResourceNotFound();
  const image = await prepareImage(bytes, mime);
  const oldUrl = kind === 'product' ? target.imageUrl ?? null :
    kind === 'logo' ? target.logoUrl ?? null : null;
  const oldId = managedMediaId(oldUrl);
  if (kind === 'gallery') {
    const duplicate = await MediaAsset.findOne({ restaurantId: auth.restaurantId,
      targetKind: 'gallery', targetId: target._id, status: 'active',
      sourceSha256: image.sha256 });
    if (duplicate) return { url: mediaUrl(auth.restaurant.slug, duplicate._id), duplicate: true };
  }
  if (oldId) {
    const previous = await MediaAsset.findOne({ _id: oldId, restaurantId: auth.restaurantId,
      targetKind: kind, targetId: target._id, status: 'active' });
    if (previous?.sourceSha256 === image.sha256) return { url: oldUrl, duplicate: true };
  }
  const id = new mongoose.Types.ObjectId();
  const key = (size) => `media/${auth.restaurantId}/${id}/${size}.webp`;
  const asset = new MediaAsset({ _id: id, restaurantId: auth.restaurantId,
    targetKind: kind, targetId: target._id, provider: storage.provider,
    sourceSha256: image.sha256, sourceMime: image.mime,
    sourceWidth: image.width, sourceHeight: image.height,
    variants: Object.fromEntries(['small', 'large'].map((size) => [size, {
      key: key(size), width: image.variants[size].width,
      height: image.variants[size].height, bytes: image.variants[size].bytes.length,
      sha256: createHash('sha256').update(image.variants[size].bytes).digest('hex'),
    }])) });
  await asset.save();
  let committed = false;
  try {
    for (const size of ['small', 'large']) await storage.write(key(size), image.variants[size].bytes);
    const url = mediaUrl(auth.restaurant.slug, id);
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const filter = kind === 'logo' ? { _id: auth.restaurantId } :
          ownerIdFilter(auth, target._id);
        if (kind === 'gallery') filter.$expr = { $lt: [{ $size: '$images' }, 10] };
        else filter[kind === 'product' ? 'imageUrl' : 'logoUrl'] = oldUrl;
        const update = kind === 'gallery' ? { $addToSet: { images: url } } :
          { $set: { [kind === 'product' ? 'imageUrl' : 'logoUrl']: url } };
        const updated = await (kind === 'logo' ? Restaurant : Product).updateOne(filter,
          update, { session });
        if (updated.matchedCount !== 1) throw new MediaConflict();
        await MediaAsset.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'active' } }, { session });
        if (oldId) await MediaAsset.updateOne({ _id: oldId, restaurantId: auth.restaurantId,
          targetKind: kind, targetId: target._id, status: 'active' },
        { $set: { status: 'retired' } }, { session });
      });
      committed = true;
    } finally { await session.endSession(); }
    try { await cleanupRetiredMedia(connection, storage, auth.restaurantId); }
    catch { /* A committed image remains available; reconcile cleanup later. */ }
    return { url, duplicate: false };
  } catch (error) {
    if (error.code === 11000 && kind === 'gallery') {
      const existing = await MediaAsset.findOne({ restaurantId: auth.restaurantId,
        targetKind: 'gallery', targetId: target._id, status: 'active',
        sourceSha256: image.sha256 });
      if (existing) return { url: mediaUrl(auth.restaurant.slug, existing._id), duplicate: true };
    }
    throw error;
  } finally {
    if (!committed) {
      await MediaAsset.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'retired' } });
      try { await cleanupRetiredMedia(connection, storage, auth.restaurantId); }
      catch { /* Tombstone remains for reconciliation. */ }
    }
  }
}

export async function deleteOwnerImage(connection, auth, storage, kind, targetId, assetId = null) {
  if (!storage) throw new Error('Media storage is not configured');
  const { MediaAsset, Product, Restaurant } = models(connection);
  if (!['product', 'gallery', 'logo'].includes(kind)) throw new InvalidMedia();
  const target = kind !== 'logo'
    ? await Product.findOne(ownerIdFilter(auth, targetId))
    : await Restaurant.findOne({ _id: auth.restaurantId });
  if (!target) throw new OwnerResourceNotFound();
  if (kind === 'gallery') {
    if (!mongoose.isValidObjectId(assetId)) throw new OwnerResourceNotFound();
    const asset = await MediaAsset.findOne({ _id: assetId,
      restaurantId: auth.restaurantId, targetKind: 'gallery',
      targetId: target._id, status: 'active' });
    if (!asset) throw new OwnerResourceNotFound();
    const url = mediaUrl(auth.restaurant.slug, assetId);
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const updated = await Product.updateOne({ ...ownerIdFilter(auth, target._id),
          images: url }, { $pull: { images: url } }, { session });
        if (updated.matchedCount !== 1) throw new MediaConflict();
        await MediaAsset.updateOne({ _id: assetId, restaurantId: auth.restaurantId,
          targetKind: 'gallery', targetId: target._id, status: 'active' },
        { $set: { status: 'retired' } }, { session });
      });
    } finally { await session.endSession(); }
    try { await cleanupRetiredMedia(connection, storage, auth.restaurantId); }
    catch { /* Tombstone remains for reconciliation. */ }
    return;
  }
  const field = kind === 'product' ? 'imageUrl' : 'logoUrl';
  const oldId = managedMediaId(target[field]);
  if (!oldId) throw new MediaConflict();
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      const filter = kind === 'product' ? ownerIdFilter(auth, target._id) : { _id: auth.restaurantId };
      filter[field] = target[field];
      const updated = await (kind === 'product' ? Product : Restaurant).updateOne(filter,
        { $set: { [field]: null } }, { session });
      if (updated.matchedCount !== 1) throw new MediaConflict();
      await MediaAsset.updateOne({ _id: oldId, restaurantId: auth.restaurantId,
        targetKind: kind, targetId: target._id, status: 'active' },
      { $set: { status: 'retired' } }, { session });
    });
  } finally { await session.endSession(); }
  try { await cleanupRetiredMedia(connection, storage, auth.restaurantId); }
  catch { /* Tombstone remains for reconciliation. */ }
}

export async function publicMedia(connection, storage, restaurant, assetId, size) {
  if (!storage || !mongoose.isValidObjectId(assetId) || !['small', 'large'].includes(size)) return null;
  const { MediaAsset, Product, Restaurant } = models(connection);
  const asset = await MediaAsset.findOne({ _id: assetId, restaurantId: restaurant._id, status: 'active' });
  if (!asset || asset.provider !== storage.provider) return null;
  const url = mediaUrl(restaurant.slug, assetId);
  const exists = asset.targetKind === 'product'
    ? await Product.exists({ _id: asset.targetId, restaurantId: restaurant._id, imageUrl: url })
    : asset.targetKind === 'gallery'
      ? await Product.exists({ _id: asset.targetId, restaurantId: restaurant._id, images: url })
    : await Restaurant.exists({ _id: restaurant._id, logoUrl: url });
  if (!exists) return null;
  return storage.read(asset.variants[size].key);
}
