import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import MediaAssetSchema from '../src/models/MediaAsset.js';
import { tokenHash } from '../src/services/ownerAuth.js';
import { createMediaStorage, storageConfig } from '../src/services/mediaStorage.js';
import { reconcileStaleMedia, requiredMediaIndexesPresent } from '../src/services/ownerMedia.js';

const origin = 'https://dashboard.example.test';
function testUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  const uri = new URL(value);
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(uri.protocol));
  assert.equal(decodeURIComponent(uri.username), 'savora_test_user');
  assert.equal(uri.pathname, '/savora_test');
  assert.ok(![...uri.searchParams.keys()].some((key) => key.toLowerCase() === 'dbname'));
  return value;
}

test('isolated owner media API persists, replaces, deletes and isolates tenants', async () => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'savora-media-api-'));
  const connection = mongoose.createConnection(testUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const ids = new Map();
  const suffix = randomUUID().replaceAll('-', '');
  const mediaCollection = `it_media_${suffix}`;
  let server;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    for (const Schema of [RestaurantSchema, UserSchema, OwnerSessionSchema,
      CategorySchema, ProductSchema]) {
      ids.set(Schema.modelName, []);
      connection.model(Schema.modelName, Schema.schema);
    }
    ids.set('MediaAsset', []);
    connection.model('MediaAsset', MediaAssetSchema.schema, mediaCollection);
    const alternate = await mongoose.createConnection(testUri(), {
      autoIndex: true, autoCreate: true, serverSelectionTimeoutMS: 10000,
    }).asPromise();
    try {
      assert.equal(alternate.db.databaseName, 'savora_test');
      const model = alternate.model('MediaAssetGuardProbe', MediaAssetSchema.schema, mediaCollection);
      const startup = createApp({ connection: alternate, mediaStorage: null,
        allowedOrigins: origin, secureCookies: true }).listen(0, '127.0.0.1');
      try {
        await new Promise((resolve) => startup.once('listening', resolve));
        await model.init();
        assert.equal(await alternate.db.listCollections({ name: mediaCollection }, { nameOnly: true }).hasNext(), false,
          'model initialization must not create the collection, even with connection options enabled');
      } finally { await new Promise((resolve) => startup.close(resolve)); }
    } finally { await alternate.close(); }
    async function fixture(name, data) {
      const _id = new mongoose.Types.ObjectId();
      ids.get(name).push(_id);
      return connection.models[name].create({ _id, ...data });
    }
    const tenants = [];
    for (const label of ['a', 'b']) {
      const restaurant = await fixture('Restaurant', {
        name: `Media ${label}`, slug: `it-media-${label}-${suffix}`, currency: 'EGP',
      });
      const user = await fixture('User', { restaurantId: restaurant._id,
        name: `Owner ${label}`, email: `it-media-${label}-${suffix}@example.test`,
        passwordHash: 'test-only-hash' });
      const category = await fixture('Category', { restaurantId: restaurant._id,
        name: 'Media', slug: `media-${suffix}` });
      const product = await fixture('Product', { restaurantId: restaurant._id,
        categoryId: category._id, name: 'Image product', slug: `image-${suffix}`, price: 12.5 });
      const raw = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      await fixture('OwnerSession', { userId: user._id, tokenHash: tokenHash(raw),
        csrfTokenHash: tokenHash(csrf), expiresAt: new Date(Date.now() + 900_000) });
      tenants.push({ restaurant, product, csrf,
        cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}` });
    }
    const storage = createMediaStorage(storageConfig({ MEDIA_STORAGE_PROVIDER: 'local',
      UPLOADS_DIR: directory }));
    server = createApp({ connection, allowedOrigins: origin, secureCookies: true,
      mediaStorage: storage }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const [a, b] = tenants;
    const disabledServer = createApp({ connection, allowedOrigins: origin, secureCookies: true,
      mediaStorage: null }).listen(0, '127.0.0.1');
    await new Promise((resolve) => disabledServer.once('listening', resolve));
    try {
      const disabledBase = `http://127.0.0.1:${disabledServer.address().port}`;
      const guest = await fetch(`${disabledBase}/api/owner/media/capabilities`);
      assert.equal(guest.status, 401);
      const capability = await fetch(`${disabledBase}/api/owner/media/capabilities`, { headers: { Cookie: a.cookie } });
      assert.deepEqual(await capability.json(), { available: false });
      for (const method of ['PUT', 'DELETE']) {
        const response = await fetch(`${disabledBase}/api/owner/media/products/${a.product.id}`, {
          method, headers: { Cookie: a.cookie, Origin: origin, 'X-Savora-CSRF': a.csrf,
            'Content-Type': 'image/png' }, ...(method === 'PUT' ? { body: Buffer.from('disabled') } : {}) });
        assert.equal(response.status, 503);
      }
    } finally { await new Promise((resolve) => disabledServer.close(resolve)); }
    const upload = (owner, endpoint, bytes, mime = 'image/png', headers = {}) =>
      fetch(`${base}/api/owner/media/${endpoint}`, { method: 'PUT', body: bytes,
        headers: { Cookie: owner.cookie, Origin: origin, 'X-Savora-CSRF': owner.csrf,
          'Content-Type': mime, ...headers } });
    const png = await sharp({ create: { width: 800, height: 600,
      channels: 3, background: '#fa8030' } }).png().toBuffer();
    const webp = await sharp({ create: { width: 800, height: 600,
      channels: 3, background: '#3080fa' } }).webp().toBuffer();

    const notReady = await upload(a, `products/${a.product.id}`, png);
    assert.equal(notReady.status, 503);
    assert.match((await notReady.json()).error, /required indexes/);
    assert.equal(await connection.db.listCollections({ name: mediaCollection }, { nameOnly: true }).hasNext(), false);
    await connection.models.MediaAsset.collection.createIndex({ restaurantId: 1, targetKind: 1, targetId: 1, status: 1 });
    await connection.models.MediaAsset.collection.createIndex({ status: 1, updatedAt: 1 });
    const missingUnique = await upload(a, `products/${a.product.id}`, png);
    assert.equal(missingUnique.status, 503);
    assert.equal(await connection.models.MediaAsset.countDocuments(), 0);
    await connection.models.MediaAsset.createIndexes();
    assert.equal(requiredMediaIndexesPresent(await connection.models.MediaAsset.collection.indexes()), true);
    const capability = await fetch(`${base}/api/owner/media/capabilities`, { headers: { Cookie: a.cookie } });
    assert.deepEqual(await capability.json(), { available: true });

    assert.equal((await upload(b, `products/${a.product.id}`, png)).status, 404);
    assert.equal((await upload(a, `products/${a.product.id}`, png,
      'image/png', { Origin: 'https://wrong.example.test' })).status, 403);
    assert.equal((await upload(a, `products/${a.product.id}`, png,
      'image/png', { 'X-Savora-CSRF': 'bad' })).status, 403);
    assert.equal((await upload(a, `products/${a.product.id}`, png,
      'image/jpeg')).status, 415);
    const firstResponse = await upload(a, `products/${a.product.id}`, png);
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    assert.equal(first.duplicate, false);
    assert.equal((await connection.models.Product.findById(a.product.id)).imageUrl, first.url);
    const read = await fetch(`${base}${first.url}`);
    assert.equal(read.status, 200);
    assert.equal((await sharp(Buffer.from(await read.arrayBuffer())).metadata()).format, 'webp');
    assert.equal((await fetch(`${base}${first.url.replace(a.restaurant.slug,
      b.restaurant.slug)}`)).status, 404);
    assert.equal((await fetch(`${base}${first.url.replace('/large', '/small')}`)).status, 200);
    const duplicate = await (await upload(a, `products/${a.product.id}`, png)).json();
    assert.deepEqual(duplicate, { url: first.url, duplicate: true });
    assert.equal(await connection.models.MediaAsset.countDocuments({
      restaurantId: a.restaurant.id, status: 'active' }), 1);

    const write = storage.write;
    let writes = 0;
    storage.write = async (...args) => { if (++writes === 2) throw new Error('interrupted upload'); return write(...args); };
    assert.equal((await upload(a, `products/${a.product.id}`, webp, 'image/webp')).status, 503);
    storage.write = write;
    assert.equal((await connection.models.Product.findById(a.product.id)).imageUrl, first.url);
    assert.equal(await connection.models.MediaAsset.countDocuments({ restaurantId: a.restaurant.id }), 1);
    const startSession = connection.startSession;
    connection.startSession = async () => ({ async withTransaction() { throw new Error('transaction unavailable'); }, async endSession() {} });
    assert.equal((await upload(a, `products/${a.product.id}`, webp, 'image/webp')).status, 503);
    connection.startSession = startSession;
    assert.equal((await connection.models.Product.findById(a.product.id)).imageUrl, first.url);
    assert.equal(await connection.models.MediaAsset.countDocuments({ restaurantId: a.restaurant.id }), 1);

    assert.equal((await upload(b, `products/${a.product.id}/images`, png)).status, 404);
    const galleryResponses = await Promise.all([upload(a, `products/${a.product.id}/images`, webp, 'image/webp'),
      upload(a, `products/${a.product.id}/images`, webp, 'image/webp')]);
    assert.ok(galleryResponses.every((response) => response.status === 200));
    const galleryResults = await Promise.all(galleryResponses.map((response) => response.json()));
    const gallery = galleryResults[0];
    assert.equal(galleryResults[0].url, galleryResults[1].url);
    assert.ok((await connection.models.Product.findById(a.product.id)).images.includes(gallery.url));
    assert.equal((await fetch(`${base}${gallery.url}`)).status, 200);
    assert.equal((await (await upload(a, `products/${a.product.id}/images`, webp,
      'image/webp')).json()).duplicate, true);
    assert.equal(await connection.models.MediaAsset.countDocuments({
      restaurantId: a.restaurant.id, targetKind: 'gallery', status: 'active' }), 1);
    const galleryId = /\/media\/([0-9a-f]{24})\/large$/.exec(gallery.url)[1];
    const removeGallery = await fetch(`${base}/api/owner/media/products/${a.product.id}/images/${galleryId}`, {
      method: 'DELETE', headers: { Cookie: a.cookie, Origin: origin,
        'X-Savora-CSRF': a.csrf } });
    assert.equal(removeGallery.status, 204);
    assert.equal((await fetch(`${base}${gallery.url}`)).status, 404);
    assert.equal((await connection.models.Product.findById(a.product.id)).images.length, 0);

    const removeStored = storage.delete;
    storage.delete = async () => { throw new Error('storage unavailable'); };
    const secondResponse = await upload(a, `products/${a.product.id}`, webp, 'image/webp');
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json();
    assert.notEqual(second.url, first.url);
    assert.equal(await connection.models.MediaAsset.countDocuments({ restaurantId: a.restaurant.id, status: 'retired' }), 1);
    storage.delete = removeStored;
    const reconciled = await reconcileStaleMedia(connection, storage, { apply: true, olderThan: new Date(Date.now() + 1000) });
    assert.equal(reconciled.deleted, 1);
    assert.equal((await fetch(`${base}${first.url}`)).status, 404);
    assert.equal((await fetch(`${base}${second.url}`)).status, 200);
    assert.equal((await connection.models.Product.findById(a.product.id)).imageUrl, second.url);
    const logoResponse = await upload(a, 'logo', png);
    assert.equal(logoResponse.status, 200);
    const logo = await logoResponse.json();
    assert.equal((await connection.models.Restaurant.findById(a.restaurant.id)).logoUrl, logo.url);
    assert.equal((await fetch(`${base}${logo.url}`)).status, 200);
    const remove = await fetch(`${base}/api/owner/media/products/${a.product.id}`, {
      method: 'DELETE', headers: { Cookie: a.cookie, Origin: origin,
        'X-Savora-CSRF': a.csrf } });
    assert.equal(remove.status, 204);
    assert.equal((await fetch(`${base}${second.url}`)).status, 404);
    assert.equal((await connection.models.Product.findById(a.product.id)).imageUrl, null);
    assert.equal(await connection.models.MediaAsset.countDocuments({
      restaurantId: a.restaurant.id, status: 'active' }), 1);
    const reopened = createMediaStorage(storageConfig({ MEDIA_STORAGE_PROVIDER: 'local',
      UPLOADS_DIR: directory }));
    const asset = await connection.models.MediaAsset.findOne({
      restaurantId: a.restaurant.id, status: 'active' });
    assert.ok(await reopened.read(asset.variants.large.key), 'logo persists on mounted storage');
    const bImageResponse = await upload(b, `products/${b.product.id}`, png);
    assert.equal(bImageResponse.status, 200);
    const bImage = await bImageResponse.json();
    const bGalleryResponse = await upload(b, `products/${b.product.id}/images`, webp, 'image/webp');
    assert.equal(bGalleryResponse.status, 200);
    const bGallery = await bGalleryResponse.json();
    const deleteProduct = await fetch(`${base}/api/owner/products/${b.product.id}`, {
      method: 'DELETE', headers: { Cookie: b.cookie, Origin: origin,
        'X-Savora-CSRF': b.csrf } });
    assert.equal(deleteProduct.status, 204);
    assert.equal((await fetch(`${base}${bImage.url}`)).status, 404);
    assert.equal((await fetch(`${base}${bGallery.url}`)).status, 404);
    assert.equal(await connection.models.MediaAsset.countDocuments({
      restaurantId: b.restaurant.id }), 0, 'product deletion clears managed media');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      for (const name of ['MediaAsset', 'OwnerSession', 'Product', 'Category', 'User', 'Restaurant']) {
        for (const _id of ids.get(name) ?? []) {
          await connection.models[name].deleteOne({ _id });
          assert.equal(await connection.models[name].countDocuments({ _id }), 0, `${name} fixture cleanup`);
        }
      }
      for (const restaurantId of ids.get('Restaurant') ?? []) {
        await connection.models.MediaAsset.deleteMany({ restaurantId });
        assert.equal(await connection.models.MediaAsset.countDocuments({ restaurantId }), 0);
      }
      if (await connection.db.listCollections({ name: mediaCollection }, { nameOnly: true }).hasNext()) {
        await connection.db.dropCollection(mediaCollection);
        assert.equal(await connection.db.listCollections({ name: mediaCollection }, { nameOnly: true }).hasNext(), false);
      }
    }
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});
