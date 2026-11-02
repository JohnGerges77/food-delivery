import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import OrderSchema from '../src/models/Order.js';
import PlatformAuditSchema from '../src/models/PlatformAudit.js';
import { tokenHash } from '../src/services/ownerAuth.js';

// Explicit invocation only: node integration/batch01.staging.integration.js [audit]
const audit = process.argv[2] === 'audit';
assert.ok(audit || process.env.SAVORA_BATCH01_STAGING_WRITE === 'YES', 'Explicit staging write opt-in required');
assert.equal(process.versions.node.split('.')[0], '24');
const manifestPath = new URL(process.argv[3] === 'first' ? '../../docs/batch01/staging-fixtures-first.json' : '../../docs/batch01/staging-fixtures.json', import.meta.url);
const config = dotenv.parse(fs.readFileSync(new URL('../.env.staging.local', import.meta.url)));
const uri = config.MONGODB_URI;
assert.ok(uri);
const url = new URL(uri);
assert.ok(['mongodb:', 'mongodb+srv:'].includes(url.protocol));
assert.equal(decodeURIComponent(url.username), 'savora_staging_user');
assert.equal(url.pathname, '/savora_staging');
assert.equal([...url.searchParams.keys()].some(k => k.toLowerCase() === 'dbname'), false);
const conn = mongoose.createConnection(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
const schemas = { Restaurant: RestaurantSchema, User: UserSchema, OwnerSession: OwnerSessionSchema, Category: CategorySchema, Product: ProductSchema, Order: OrderSchema };
let manifest;
let server;
let failure;
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
try {
  await conn.asPromise();
  assert.equal(conn.name, 'savora_staging');
  assert.equal(conn.db.databaseName, 'savora_staging');
  const status = await conn.db.admin().command({ connectionStatus: 1 });
  assert.deepEqual(status.authInfo.authenticatedUsers.map(x => x.user), ['savora_staging_user']);
  console.log('Verified authenticated staging identity and database');
  for (const [name, schema] of Object.entries(schemas)) conn.model(name, schema.schema);
  conn.model('PlatformAudit', PlatformAuditSchema.schema);
  const M = conn.models;
  if (audit) {
    manifest = JSON.parse(fs.readFileSync(manifestPath));
    assert.match(manifest.prefix, /^batch01-[a-f0-9]{32}$/);
    const regex = new RegExp('^' + manifest.prefix);
    const checks = {
      restaurants: await M.Restaurant.countDocuments({ slug: regex }),
      users: await M.User.countDocuments({ email: regex }),
      categories: await M.Category.countDocuments({ slug: regex }),
      products: await M.Product.countDocuments({ slug: regex }),
      orders: await M.Order.countDocuments({ restaurantId: { $in: manifest.ids.Restaurant } }),
      sessions: await M.OwnerSession.countDocuments({ userId: { $in: manifest.ids.User } }),
      audits: await M.PlatformAudit.countDocuments({ restaurantId: { $in: manifest.ids.Restaurant } }),
    };
    for (const [name, ids] of Object.entries(manifest.ids)) checks[`ids_${name}`] = await M[name].countDocuments({ _id: { $in: ids } });
    console.log('Independent audit:', JSON.stringify(checks));
    assert.ok(Object.values(checks).every(n => n === 0), 'Fixtures remain');
  } else {
    assert.ok(!fs.existsSync(manifestPath), 'Existing manifest requires review before a new run');
    const prefix = `batch01-${randomUUID().replaceAll('-', '')}`;
    manifest = { prefix, ids: Object.fromEntries(Object.keys(schemas).map(n => [n, []])), orderKeys: [] };
    save();
    async function fixture(name, data) {
      const _id = new mongoose.Types.ObjectId();
      assert.equal(await M[name].exists({ _id }), null, 'Generated fixture ID already exists');
      manifest.ids[name].push(String(_id)); save();
      return M[name].create({ _id, ...data });
    }
    const a = await fixture('Restaurant', { name: `${prefix} A`, slug: `${prefix}-a`, currency: 'EGP', socialLinks: { whatsapp: 'https://wa.me/201001234567' }, deliverySettings: { deliveryFee: 7.5, minimumOrder: 0, deliveryAvailable: true } });
    const b = await fixture('Restaurant', { name: `${prefix} B`, slug: `${prefix}-b`, currency: 'EGP' });
    const owner = await fixture('User', { restaurantId: a._id, name: `${prefix} owner`, email: `${prefix}@example.test`, passwordHash: 'test-only-hash' });
    const raw = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await fixture('OwnerSession', { userId: owner._id, tokenHash: tokenHash(raw), csrfTokenHash: tokenHash(csrf), expiresAt: new Date(Date.now()+900000) });
    const ca = await fixture('Category', { restaurantId: a._id, name: 'A', slug: `${prefix}-a` });
    const cb = await fixture('Category', { restaurantId: b._id, name: 'B', slug: `${prefix}-b` });
    const p = await fixture('Product', { restaurantId: a._id, categoryId: ca._id, name: 'QA meal', slug: `${prefix}-meal`, price: 12.34 });
    const unavailable = await fixture('Product', { restaurantId: a._id, categoryId: ca._id, name: 'Unavailable', slug: `${prefix}-unavailable`, price: 10, isAvailable: false });
    const foreign = await fixture('Product', { restaurantId: b._id, categoryId: cb._id, name: 'Foreign', slug: `${prefix}-foreign`, price: 10 });
    server = createApp({ connection: conn, allowedOrigins: 'https://dashboard.example.test', secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const cookie = `savora_owner_session=${raw}; savora_owner_csrf=${csrf}`;
    const headers = { Cookie: cookie, Origin: 'https://dashboard.example.test', 'X-Savora-CSRF': csrf, 'Content-Type': 'application/json' };
    const patch = (body, h = headers) => fetch(`${base}/api/owner/restaurant`, { method: 'PATCH', headers: h, body: JSON.stringify(body) });
    const pub = async () => (await (await fetch(`${base}/api/public/restaurants/${a.slug}`)).json()).restaurant;
    assert.equal((await fetch(`${base}/api/owner/restaurant`)).status, 401);
    assert.equal((await patch({ heroProductId: String(p._id) }, { ...headers, Origin: 'https://evil.example' })).status, 403);
    assert.equal((await patch({ heroProductId: String(p._id) }, { ...headers, 'X-Savora-CSRF': 'wrong' })).status, 403);
    assert.equal((await fetch(`${base}/api/owner/products/${foreign._id}`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/api/admin/restaurants`, { headers })).status, 401);
    for (const id of [String(foreign._id), String(unavailable._id), 'bad', String(new mongoose.Types.ObjectId())]) assert.equal((await patch({ heroProductId: id })).status, 400);
    assert.equal((await patch({ heroProductId: String(p._id) })).status, 200);
    assert.equal(String((await M.Restaurant.findById(a._id)).heroProductId), String(p._id));
    let hero = await pub(); assert.equal(hero.heroProduct.id, String(p._id)); assert.equal(hero.heroProduct.imageUrl, null); assert.equal(hero.heroProductSelected, true);
    assert.equal((await patch({ heroProductId: null })).status, 200);
    hero = await pub(); assert.equal(hero.heroProduct, null); assert.equal(hero.heroProductSelected, false);
    console.log('PASS hero selection, no-image DTO, clearing, tenant and security checks');
    const body = method => ({ customerName: 'QA Guest', customerPhone: '+201001234567', deliveryAddress: '12 QA Street', city: 'Cairo', submissionMethod: method, items: [{ productId: String(p._id), quantity: 2 }] });
    for (const method of ['direct', 'whatsapp']) {
      const key = randomUUID(); const hash = createHash('sha256').update(key).digest('hex');
      manifest.orderKeys.push({ restaurantId: String(a._id), hash }); save();
      const post = payload => fetch(`${base}/api/public/restaurants/${a.slug}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) });
      assert.equal((await post({ ...body(method), total: 1 })).status, 400);
      const response = await post(body(method)); assert.equal(response.status, 201);
      const result = await response.json();
      const orders = await M.Order.find({ restaurantId: a._id, idempotencyKeyHash: hash });
      assert.equal(orders.length, 1); const order = orders[0];
      assert.equal(String(order.restaurantId), String(a._id)); assert.equal(order.customerEmail, undefined);
      assert.equal(order.subtotal, 24.68); assert.equal(order.deliveryFee, 7.5); assert.equal(order.total, 32.18);
      assert.equal(order.orderNumber, result.order.orderNumber); assert.match(order.orderNumber, /^SV-[0-9A-F]{24}$/);
      assert.equal(result.order.savedInSavora, true);
      if (method === 'whatsapp') {
        const wa = new URL(result.whatsapp.url); assert.equal(wa.origin + wa.pathname, 'https://wa.me/201001234567');
        const message = wa.searchParams.get('text'); for (const value of [order.orderNumber, 'QA meal', '32.18', a.name]) assert.ok(message.includes(value));
        assert.equal(result.whatsapp.messageSent, false);
      }
      const replay = await post(body(method)); assert.equal(replay.status, 200); assert.equal((await replay.json()).order.orderNumber, order.orderNumber);
      assert.equal(await M.Order.countDocuments({ restaurantId: a._id, idempotencyKeyHash: hash }), 1);
      console.log(`PASS ${method} persisted, priced, tenant scoped and idempotent`);
    }
    const cross = await fetch(`${base}/api/public/restaurants/${a.slug}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ ...body('direct'), items: [{ productId: String(foreign._id), quantity: 1 }] }) });
    assert.equal(cross.status, 409);
  }
} catch (err) { failure = err; console.error('FAILED:', err.stack); }
finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (!audit && manifest && conn.readyState === 1) {
    try {
      for (const entry of manifest.orderKeys) {
        const rows = await conn.models.Order.find({ restaurantId: entry.restaurantId, idempotencyKeyHash: entry.hash }).select('_id').lean();
        for (const row of rows) if (!manifest.ids.Order.includes(String(row._id))) manifest.ids.Order.push(String(row._id));
      }
      save();
      for (const name of ['Order', 'OwnerSession', 'Product', 'Category', 'User', 'Restaurant']) {
        for (const id of manifest.ids[name]) {
          const ownership = name === 'Restaurant' ? { slug: new RegExp('^' + manifest.prefix) } :
            name === 'User' ? { email: new RegExp('^' + manifest.prefix) } :
            name === 'OwnerSession' ? { userId: { $in: manifest.ids.User } } :
            { restaurantId: { $in: manifest.ids.Restaurant } };
          await conn.models[name].deleteOne({ _id: id, ...ownership });
        }
      }
      for (const [name, ids] of Object.entries(manifest.ids)) assert.equal(await conn.models[name].countDocuments({ _id: { $in: ids } }), 0, `${name} cleanup failed`);
      console.log('Exact-ID cleanup passed:', JSON.stringify(Object.fromEntries(Object.entries(manifest.ids).map(([k,v]) => [k,v.length]))));
    } catch (err) { console.error('CLEANUP FAILED; manifest contains exact IDs:', manifestPath.pathname, err.message); failure = failure || err; }
  }
  await conn.close();
}
if (failure) process.exitCode = 1;
