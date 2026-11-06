import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { createMediaStorage, storageConfig, validMediaKey } from '../src/services/mediaStorage.js';
import { cleanupRetiredMedia, InvalidMedia, mediaUrl, ownsStoredKeys, prepareImage, reconcileStaleMedia, requiredMediaIndexesPresent, requireMediaIndexes } from '../src/services/ownerMedia.js';
import MediaAsset from '../src/models/MediaAsset.js';

const tenant = 'a'.repeat(24);
const asset = 'b'.repeat(24);
const key = `media/${tenant}/${asset}/large.webp`;

test('MediaAsset disables automatic DDL and upload readiness requires exact indexes', async () => {
  assert.equal(MediaAsset.schema.options.autoIndex, false);
  assert.equal(MediaAsset.schema.options.autoCreate, false);
  const indexes = [
    { key: { restaurantId: 1, targetKind: 1, targetId: 1, status: 1 } },
    { key: { status: 1, updatedAt: 1 } },
    { key: { restaurantId: 1, targetKind: 1, targetId: 1, sourceSha256: 1 }, unique: true, partialFilterExpression: { status: 'active' } },
  ];
  assert.equal(requiredMediaIndexesPresent(indexes), true);
  assert.equal(requiredMediaIndexesPresent(indexes.slice(0, 2)), false);
  assert.equal(requiredMediaIndexesPresent([...indexes.slice(0, 2), { ...indexes[2], unique: false }]), false);
  assert.equal(requiredMediaIndexesPresent([...indexes.slice(0, 2), { ...indexes[2], hidden: true }]), false);
  await assert.rejects(requireMediaIndexes({ collection: { async indexes() { throw new Error('unavailable'); } } }), /required indexes/);
  const unavailableModel = { collection: { async indexes() { return []; } } };
  await assert.rejects(reconcileStaleMedia({ readyState: 1, models: { MediaAsset: unavailableModel, Product: {}, Restaurant: {} } },
    { provider: 'local' }, { apply: true }), /required indexes/);
});

test('cleanup only accepts keys belonging to the recorded tenant and asset', () => {
  const record = { restaurantId: tenant, _id: asset,
    variants: { small: { key: `media/${tenant}/${asset}/small.webp` }, large: { key } } };
  assert.equal(ownsStoredKeys(record), true);
  record.variants.large.key = `media/${'c'.repeat(24)}/${asset}/large.webp`;
  assert.equal(ownsStoredKeys(record), false);
});

test('failed storage deletion keeps the tombstone and never deletes foreign keys', async () => {
  const own = { restaurantId: tenant, _id: asset, variants: {
    small: { key: `media/${tenant}/${asset}/small.webp` }, large: { key } } };
  const foreign = { ...own, _id: 'd'.repeat(24) };
  let removed = 0;
  const keys = [];
  const model = { find(filter) {
    assert.equal(filter.restaurantId, tenant);
    return { sort: () => ({ limit: async () => [own, foreign] }) };
  }, async deleteOne() { removed++; } };
  const connection = { readyState: 1, models: { MediaAsset: model, Product: {}, Restaurant: {} } };
  const storage = { provider: 'local', async delete(value) { keys.push(value); throw new Error('storage unavailable'); } };
  await cleanupRetiredMedia(connection, storage, tenant);
  assert.equal(removed, 0);
  assert.deepEqual(keys, [own.variants.small.key]);
});

test('media storage requires explicit persistent configuration', () => {
  assert.equal(storageConfig({}), null);
  assert.throws(() => storageConfig({ MEDIA_STORAGE_PROVIDER: 'local' }), /UPLOADS_DIR/);
  assert.throws(() => storageConfig({ MEDIA_STORAGE_PROVIDER: 'local',
    UPLOADS_DIR: path.resolve('.') }), /outside the repository/);
  assert.throws(() => storageConfig({ MEDIA_STORAGE_PROVIDER: 'local',
    UPLOADS_DIR: os.tmpdir(), VERCEL: '1' }), /outside Vercel/);
  assert.throws(() => storageConfig({ MEDIA_STORAGE_PROVIDER: 'blob',
    BLOB_STORE_ID: 'configured' }), /Invalid MEDIA_STORAGE_PROVIDER/);
  assert.throws(() => createMediaStorage({ provider: 'blob' }), /Invalid media provider/);
  assert.throws(() => storageConfig({ MEDIA_STORAGE_PROVIDER: 'unknown' }), /Invalid/);
});

test('local adapter persists bytes and rejects traversal', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'savora-media-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createMediaStorage(storageConfig({ MEDIA_STORAGE_PROVIDER: 'local',
    UPLOADS_DIR: directory }));
  const bytes = randomBytes(256);
  await storage.write(key, bytes);
  const stream = await storage.read(key);
  const received = Buffer.concat(await Array.fromAsync(stream));
  assert.deepEqual(received, bytes);
  assert.deepEqual(await readdir(path.join(directory, 'media', tenant, asset)), ['large.webp']);
  await assert.rejects(storage.write(key, bytes), { code: 'EEXIST' });
  for (const unsafe of ['../../outside', `media/${tenant}/../large.webp`,
    `media/${tenant}/${asset}/small.webp/../../escape`, 'C:\\secrets']) {
    assert.equal(validMediaKey(unsafe), false);
    await assert.rejects(storage.write(unsafe, bytes), /Invalid media key/);
    await assert.rejects(storage.read(unsafe), /Invalid media key/);
    await assert.rejects(storage.delete(unsafe), /Invalid media key/);
  }
  await storage.delete(key);
  assert.equal(await storage.read(key), null);
});

test('JPEG, PNG, and WebP are decoded and optimized into bounded variants', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const bytes = await sharp({ create: { width: 1800, height: 900,
      channels: 4, background: '#f08040' } })[format]().toBuffer();
    const image = await prepareImage(bytes, `image/${format}`);
    assert.equal(image.width, 1800);
    assert.equal(image.height, 900);
    assert.equal(image.variants.small.width, 320);
    assert.equal(image.variants.large.width, 1200);
    assert.equal((await sharp(image.variants.small.bytes).metadata()).format, 'webp');
    assert.match(image.sha256, /^[0-9a-f]{64}$/);
  }
  assert.equal(mediaUrl('tenant-a', asset),
    `/api/public/restaurants/tenant-a/media/${asset}/large`);
});

test('image content, claimed type, dimensions, and size are checked server-side', async () => {
  const image = await sharp({ create: { width: 40, height: 40,
    channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(prepareImage(image, 'image/jpeg'), InvalidMedia);
  await assert.rejects(prepareImage(Buffer.from('not an image at all'), 'image/png'), InvalidMedia);
  await assert.rejects(prepareImage(image, 'image/svg+xml'), InvalidMedia);
  await assert.rejects(prepareImage(Buffer.alloc(4_000_001), 'image/png'), InvalidMedia);
  const tiny = await sharp({ create: { width: 10, height: 10,
    channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(prepareImage(tiny, 'image/png'), InvalidMedia);
});
