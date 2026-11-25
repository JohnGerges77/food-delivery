import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import OrderSchema from '../src/models/Order.js';
import { tokenHash } from '../src/services/ownerAuth.js';
import { betaWhatsAppPolicy } from '../src/services/whatsappOrdering.js';

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  try {
    const parsed = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(parsed.protocol));
    assert.equal(decodeURIComponent(parsed.username), 'savora_test_user');
    assert.equal(parsed.pathname, '/savora_test');
    assert.equal([...parsed.searchParams.keys()].some((key) =>
      key.toLowerCase() === 'dbname'), false);
  } catch { throw new Error('MONGODB_TEST_URI failed test database safety checks'); }
  return value;
}

test('secure guest checkout on savora_test', async (t) => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24,
    'Integration tests require Node 24');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const ids = new Map();
  let server;
  let betaServer;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const OwnerSession = connection.model('OwnerSession', OwnerSessionSchema.schema);
    const Category = connection.model('Category', CategorySchema.schema);
    const Product = connection.model('Product', ProductSchema.schema);
    const Order = connection.model('Order', OrderSchema.schema);
    for (const model of [Restaurant, User, OwnerSession, Category, Product, Order]) {
      ids.set(model.modelName, []);
    }
    assert.ok((await Order.collection.listIndexes().toArray()).some((index) =>
      index.unique && index.key.restaurantId === 1 && index.key.idempotencyKeyHash === 1));
    async function fixture(Model, data) {
      const _id = new mongoose.Types.ObjectId();
      ids.get(Model.modelName).push(_id);
      return Model.create({ _id, ...data });
    }
    const suffix = randomUUID().replaceAll('-', '');
    const a = await fixture(Restaurant, { name: 'Checkout A',
      slug: `it-checkout-a-${suffix}`, currency: 'EGP',
      socialLinks: { whatsapp: 'https://wa.me/12025550100' },
      deliverySettings: { deliveryAvailable: true, deliveryFee: 7.5, minimumOrder: 20, whatsappOrderingEnabled: true } });
    const b = await fixture(Restaurant, { name: 'Checkout B',
      slug: `it-checkout-b-${suffix}`, currency: 'EGP' });
    const suspended = await fixture(Restaurant, { name: 'Suspended',
      slug: `it-checkout-s-${suffix}`, currency: 'EGP', status: 'suspended' });
    const category = await fixture(Category, { restaurantId: a._id,
      name: 'Meals', slug: `it-checkout-meals-${suffix}` });
    const inactive = await fixture(Category, { restaurantId: a._id,
      name: 'Hidden', slug: `it-checkout-hidden-${suffix}`, isActive: false });
    const foreignCategory = await fixture(Category, { restaurantId: b._id,
      name: 'Foreign', slug: `it-checkout-foreign-${suffix}` });
    async function product(data = {}) {
      return fixture(Product, { restaurantId: a._id, categoryId: category._id,
        name: 'Burger', slug: `it-checkout-${randomUUID().replaceAll('-', '')}`,
        price: 12.34, imageUrl: '/burger.webp', ...data });
    }
    const main = await product();
    const unavailable = await product({ isAvailable: false });
    const hidden = await product({ categoryId: inactive._id });
    const foreign = await fixture(Product, { restaurantId: b._id,
      categoryId: foreignCategory._id, name: 'Foreign',
      slug: `it-checkout-burger-${suffix}`, price: 1 });
    const bOrderable = await fixture(Product, { restaurantId: b._id,
      categoryId: foreignCategory._id, name: 'B meal',
      slug: `it-checkout-b-meal-${suffix}`, price: 25 });
    const badCategory = await product({ categoryId: foreignCategory._id });
    const owner = await fixture(User, { restaurantId: a._id, name: 'Owner',
      email: `it-checkout-${suffix}@example.test`, passwordHash: 'test-only-hash' });
    const raw = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    await fixture(OwnerSession, { userId: owner._id, tokenHash: tokenHash(raw),
      csrfTokenHash: tokenHash(csrf), expiresAt: new Date(Date.now() + 900_000) });
    const secondOwner = await fixture(User, { restaurantId: b._id, name: 'Second Owner',
      email: `it-checkout-b-${suffix}@example.test`, passwordHash: 'test-only-hash' });
    const secondToken = randomBytes(32).toString('hex');
    await fixture(OwnerSession, { userId: secondOwner._id, tokenHash: tokenHash(secondToken),
      csrfTokenHash: tokenHash(csrf), expiresAt: new Date(Date.now() + 900_000) });

    server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test',
      secureCookies: true }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const body = (productId = main._id, method = 'direct') => ({
      customerName: 'Mona', customerPhone: '+201001234567',
      customerEmail: 'mona@example.test', deliveryAddress: '12 Nile Street',
      city: 'Cairo', notes: 'Ring bell', submissionMethod: method,
      items: [{ productId: String(productId), quantity: 2, notes: 'No onions' }],
    });
    const origin = 'https://dashboard.example.test';
    const post = async (slug, payload, key = randomUUID(), endpoint = base, requestOrigin = origin) => {
      const response = await fetch(
      `${endpoint}/api/public/restaurants/${slug}/orders`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Origin: requestOrigin },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload) });
      if (response.ok) {
        const result = await response.clone().json();
        const saved = await Order.findOne({ restaurantId: { $in: ids.get('Restaurant') }, orderNumber: result.order.orderNumber }).select('_id').lean();
        assert.ok(saved);
        if (!ids.get('Order').some((id) => String(id) === String(saved._id))) ids.get('Order').push(saved._id);
      }
      return response;
    };
    const ownerDelete = (id) => fetch(`${base}/api/owner/products/${id}`, {
      method: 'DELETE', headers: { Cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}`,
        Origin: 'https://dashboard.example.test', 'X-Savora-CSRF': csrf },
    });
    const settings = (endpoint, token, patch, headers = {}) => fetch(endpoint + '/api/owner/restaurant', {
      method: patch ? 'PATCH' : 'GET',
      headers: { Cookie: `savora_owner_session=${token}; savora_owner_csrf=${csrf}`,
        Origin: origin, 'X-Savora-CSRF': csrf, 'Content-Type': 'application/json', ...headers },
      ...(patch ? { body: JSON.stringify(patch) } : {}),
    });
    const restaurant = async (endpoint, slug) => {
      const response = await fetch(endpoint + '/api/public/restaurants/' + slug);
      assert.equal(response.status, 200);
      return (await response.json()).restaurant;
    };

    await t.test('Owner variant CRUD preserves IDs and rejects foreign IDs and unsafe conversion', async () => {
      const headers = { Cookie: `savora_owner_session=${raw}; savora_owner_csrf=${csrf}`, Origin:'https://dashboard.example.test', 'X-Savora-CSRF':csrf, 'Content-Type':'application/json' };
      const created = await fetch(`${base}/api/owner/products`, { method:'POST', headers, body:JSON.stringify({name:'Variant CRUD',categoryId:String(category._id),price:12,variants:[{name:'Small',price:20,isAvailable:true,sortOrder:0},{name:'Large',price:30,isAvailable:true,sortOrder:1}]}) });
      assert.equal(created.status,201);
      const dto = (await created.json()).product;
      ids.get('Product').push(new mongoose.Types.ObjectId(dto.id));
      const patch = (id, value) => fetch(`${base}/api/owner/products/${id}`,{method:'PATCH',headers,body:JSON.stringify(value)});
      const changed = await patch(dto.id,{variants:dto.variants.map((v,index)=>({...v,name:`Renamed ${index}`,price:v.price+1,sortOrder:1-index}))});
      assert.equal(changed.status,200);
      assert.deepEqual((await changed.json()).product.variants.map((v)=>v.id),dto.variants.map((v)=>v.id));
      assert.equal((await patch(dto.id,{variants:[{...dto.variants[0],id:String(new mongoose.Types.ObjectId())}]})).status,400);
      assert.equal((await patch(foreign._id,{variants:[]})).status,404);
      assert.equal((await patch(dto.id,{variants:[]})).status,400);
      assert.equal((await patch(dto.id,{variants:[],price:45})).status,200);
      assert.equal((await Product.findById(dto.id)).price,45);
    });

    await t.test('variants use authoritative prices, immutable snapshots and idempotent WhatsApp', async () => {
      const item = await product({ price: 1, variants: [{ name: 'Small', price: 20, isAvailable: true, sortOrder: 0 }, { name: 'Large', price: 35, isAvailable: true, sortOrder: 1 }, { name: 'Disabled', price: 5, isAvailable: false, sortOrder: 2 }] });
      for (const method of ['direct', 'whatsapp']) {
        const payload = { ...body(item._id, method), items: item.variants.slice(0,2).map((v) => ({ productId: String(item._id), variantId: String(v._id), quantity: 1 })) };
        const key = randomUUID();
        const response = await post(a.slug, payload, key);
        assert.equal(response.status, 201);
        const result = await response.json();
        assert.equal(result.order.subtotal, 55);
        assert.equal((await post(a.slug, payload, key)).status, 200);
        const saved = await Order.findOne({ restaurantId: a._id, orderNumber: result.order.orderNumber });
        assert.deepEqual(saved.items.map((v) => v.variantName), ['Small','Large']);
        assert.deepEqual(saved.items.map((v) => v.unitPrice), [20,35]);
        if (method === 'whatsapp') assert.match(decodeURIComponent(result.whatsapp.url), /Burger \(Large\)/);
      }
      for (const variantId of [undefined, String(item.variants[2]._id), String(new mongoose.Types.ObjectId())]) {
        const payload = { ...body(item._id), items: [{ productId: String(item._id), ...(variantId ? { variantId } : {}), quantity: 2 }] };
        assert.equal((await post(a.slug, payload)).status, 409);
      }
      assert.equal((await post(b.slug, { ...body(item._id), items: [{productId:String(item._id),variantId:String(item.variants[0]._id),quantity:2}] })).status, 409);
      await Product.updateOne({ _id: item._id }, { $set: { variants: [], price: 99 } });
      assert.equal((await post(a.slug, { ...body(item._id), items: [{productId:String(item._id),variantId:String(item.variants[0]._id),quantity:2}] })).status, 409);
      assert.equal((await Order.findOne({ restaurantId: a._id, 'items.variantName':'Small' })).items[0].unitPrice, 20);
    });

    await t.test('direct checkout saves trusted snapshots and survives product repricing', async () => {
      const response = await post(a.slug, body());
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('set-cookie'), null);
      const result = await response.json();
      assert.equal(result.order.savedInSavora, true);
      assert.equal(result.order.status, 'pending');
      assert.equal(result.order.subtotal, 24.68);
      assert.equal(result.order.deliveryFee, 7.5);
      assert.equal(result.order.total, 32.18);
      assert.match(result.order.orderNumber, /^SV-[0-9A-F]{24}$/);
      assert.equal(result.whatsapp, undefined);
      assert.ok(!JSON.stringify(result).includes('mona@example.test'));
      const saved = await Order.findOne({ restaurantId: a._id,
        orderNumber: result.order.orderNumber });
      assert.equal(saved.source, 'website');
      assert.equal(String(saved.restaurantId), String(a._id));
      assert.equal(saved.items[0].name, 'Burger');
      assert.equal(saved.items[0].unitPrice, 12.34);
      assert.equal(saved.items[0].imageUrl, '/burger.webp');
      assert.equal(saved.items[0].notes, 'No onions');
      await Product.updateOne({ _id: main._id }, { $set: { price: 99, name: 'Changed' } });
      const unchanged = await Order.findById(saved._id);
      assert.equal(unchanged.items[0].name, 'Burger');
      assert.equal(unchanged.items[0].unitPrice, 12.34);
      await Product.updateOne({ _id: main._id }, { $set: { price: 12.34, name: 'Burger' } });
    });

    await t.test('WhatsApp handoff follows persistence and replay recovers one order', async () => {
      const key = randomUUID();
      const request = body(main._id, 'whatsapp');
      const first = await post(a.slug, request, key);
      assert.equal(first.status, 201);
      const data = await first.json();
      assert.equal(data.whatsapp.messageSent, false);
      assert.match(data.whatsapp.url, /^https:\/\/wa\.me\/12025550100\?text=/);
      assert.ok(await Order.exists({ restaurantId: a._id,
        orderNumber: data.order.orderNumber }));
      const second = await post(a.slug, { ...request, customerName: ' Mona ' }, key);
      assert.equal(second.status, 200);
      assert.deepEqual(await second.json(), data);
      assert.equal((await post(a.slug, { ...request, notes: 'Different' }, key)).status, 409);
      assert.equal(await Order.countDocuments({ restaurantId: a._id,
        orderNumber: data.order.orderNumber }), 1);
      const sameKeyOtherTenant = await post(b.slug, body(bOrderable._id, 'direct'), key);
      assert.equal(sameKeyOtherTenant.status, 201);
      assert.notEqual((await sameKeyOtherTenant.json()).order.orderNumber,
        data.order.orderNumber);
    });

    await t.test('concurrent identical retries produce one order and unique numbers', async () => {
      const key = randomUUID();
      const item = await product({ price: 25 });
      const [left, right] = await Promise.all([
        post(a.slug, body(item._id), key), post(a.slug, body(item._id), key),
      ]);
      assert.deepEqual([left.status, right.status].sort(), [200, 201]);
      const [one, two] = await Promise.all([left.json(), right.json()]);
      assert.equal(one.order.orderNumber, two.order.orderNumber);
      assert.equal(await Order.countDocuments({ restaurantId: a._id,
        orderNumber: one.order.orderNumber }), 1);
      const numbers = await Order.distinct('orderNumber', { restaurantId: a._id });
      assert.equal(numbers.length, await Order.countDocuments({ restaurantId: a._id }));
    });

    await t.test('untrusted and unavailable checkout attempts never save an order', async () => {
      const before = await Order.countDocuments({ restaurantId: a._id });
      for (const [slug, payload, status] of [
        [suspended.slug, body(), 404], ['missing-restaurant', body(), 404],
        [a.slug, body(unavailable._id), 409], [a.slug, body(hidden._id), 409],
        [a.slug, body(foreign._id), 409], [a.slug, body(badCategory._id), 409],
        [a.slug, { ...body(), total: 1 }, 400],
        [a.slug, { ...body(), items: [{ productId: String(main._id), quantity: 0 }] }, 400],
        [a.slug, { ...body(), items: [{ productId: 'bad', quantity: 1 }] }, 400],
        [a.slug, '{', 400],
      ]) assert.equal((await post(slug, payload)).status, status);
      assert.equal(await Order.countDocuments({ restaurantId: a._id }), before);
      await Restaurant.updateOne({ _id: a._id }, { $set: { 'deliverySettings.minimumOrder': 50 } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.minimumOrder': 20, 'deliverySettings.deliveryAvailable': false } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryAvailable': true } });
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryFee': 1.234 } });
      assert.equal((await post(a.slug, body())).status, 409);
      await Restaurant.updateOne({ _id: a._id }, { $set: {
        'deliverySettings.deliveryFee': 7.5 } });
      assert.equal((await post(b.slug, body(bOrderable._id, 'whatsapp'))).status, 409);
    });

    await t.test('checkout and owner hard delete cannot leave an orphan', async () => {
      for (let i = 0; i < 4; i++) {
        const item = await product({ price: 25 });
        const [checkout, deletion] = await Promise.all([
          post(a.slug, body(item._id)), ownerDelete(item._id),
        ]);
        const exists = Boolean(await Product.exists({ _id: item._id }));
        const saved = Boolean(await Order.exists({ 'items.productId': item._id }));
        assert.equal(saved && !exists, false);
        if (checkout.status === 201) {
          assert.equal(exists, true);
          assert.equal(deletion.status, 409);
        } else {
          assert.equal(deletion.status, 204);
          assert.equal(checkout.status, 409);
        }
      }
    });

    await t.test('owner WhatsApp settings persist independently and only route orders to their own tenant', async () => {
      assert.equal((await settings(base, secondToken, { restaurantId: String(a._id),
        socialLinks: { whatsapp: '+12025550101' } })).status, 400);
      const optIn = { socialLinks: { whatsapp: '+12025550101' }, deliverySettings: { whatsappOrderingEnabled: true } };
      assert.equal((await settings(base, secondToken, optIn, { 'X-Savora-CSRF': '' })).status, 403);
      assert.equal((await settings(base, secondToken, optIn, { Origin: 'https://untrusted.example.test' })).status, 403);
      assert.equal((await settings(base, secondToken,
        { socialLinks: { whatsapp: '+999123456789' } })).status, 400);
      assert.equal((await settings(base, secondToken,
        { deliverySettings: { whatsappOrderingEnabled: true } })).status, 400);
      assert.equal((await settings(base, secondToken, optIn)).status, 200);
      const savedSettings = (await (await settings(base, secondToken)).json()).restaurant;
      assert.equal(savedSettings.socialLinks.whatsapp, 'https://wa.me/12025550101');
      assert.equal(savedSettings.deliverySettings.whatsappOrderingEnabled, true);
      assert.equal(savedSettings.deliverySettings.deliveryAvailable, true);
      assert.equal((await (await settings(base, raw)).json()).restaurant.socialLinks.whatsapp, 'https://wa.me/12025550100');
      assert.equal((await restaurant(base, b.slug)).whatsappOrderingAvailable, true);
      const key = randomUUID();
      const payload = body(bOrderable._id, 'whatsapp');
      const placed = await post(b.slug, payload, key);
      assert.equal(placed.status, 201);
      const orderData = await placed.json();
      assert.equal(new URL(orderData.whatsapp.url).pathname, '/12025550101');
      assert.equal((await settings(base, secondToken, { deliverySettings: { whatsappOrderingEnabled: false } })).status, 200);
      assert.equal((await restaurant(base, b.slug)).whatsappOrderingAvailable, false);
      const replay = await post(b.slug, payload, key);
      assert.equal(replay.status, 200);
      const replayed = await replay.json();
      assert.equal(replayed.order.orderNumber, orderData.order.orderNumber);
      assert.deepEqual(replayed.whatsapp, { url: null, messageSent: false });
      assert.equal((await post(b.slug, payload)).status, 409);
      assert.equal((await post(b.slug, body(bOrderable._id))).status, 201);
      assert.equal((await settings(base, secondToken, optIn)).status, 200);
    });

    await t.test('beta uses an operator-approved tenant number and synthetic variant order with one persisted row', async () => {
      betaServer = createApp({ connection, allowedOrigins: origin, secureCookies: true,
        checkoutAllowedOrigins: [origin], betaCheckout: true,
        betaWhatsAppTargets: betaWhatsAppPolicy(JSON.stringify({ [a.slug]: '+12025550100' })),
      }).listen(0, '127.0.0.1');
      await new Promise(resolve => betaServer.once('listening', resolve));
      const beta = `http://127.0.0.1:${betaServer.address().port}`;
      const visibleA = await restaurant(beta, a.slug);
      assert.equal(visibleA.whatsappOrderingAvailable, true);
      assert.equal(visibleA.socialLinks.whatsapp, null);
      assert.equal((await restaurant(beta, b.slug)).whatsappOrderingAvailable, false);
      assert.equal((await settings(beta, secondToken, { socialLinks: { whatsapp: '+12025550100' },
        deliverySettings: { whatsappOrderingEnabled: true } })).status, 400);
      const pizza = await product({ name: 'Pizza Margherita', price: 50,
        variants: [{ name: 'Medium', price: 200, isAvailable: true, sortOrder: 0 }] });
      const payload = { submissionMethod: 'whatsapp', items: [{ productId: String(pizza._id),
        variantId: String(pizza.variants[0]._id), quantity: 1 }] };
      const key = randomUUID();
      const before = await Order.countDocuments({ restaurantId: a._id });
      assert.equal((await post(a.slug, payload, key, beta, 'https://untrusted.example.test')).status, 403);
      assert.equal((await post(a.slug, { ...payload, customerPhone: '+12025550199' }, key, beta)).status, 400);
      assert.equal((await post(b.slug, { ...payload, items: [{ productId: String(bOrderable._id), quantity: 1 }] }, key, beta)).status, 409);
      const placed = await post(a.slug, payload, key, beta);
      assert.equal(placed.status, 201);
      const result = await placed.json();
      assert.equal(result.order.status, 'pending');
      assert.equal(result.order.subtotal, 200);
      assert.equal(result.order.total, 207.5);
      assert.equal(result.whatsapp.messageSent, false);
      const handoff = new URL(result.whatsapp.url);
      assert.equal(handoff.pathname, '/12025550100');
      assert.match(handoff.searchParams.get('text'), /TEST ORDER.*no payment or fulfillment/);
      assert.match(handoff.searchParams.get('text'), /Pizza Margherita \(Medium\) @ 200\.00 EGP/);
      assert.ok(handoff.searchParams.get('text').includes(result.order.orderNumber));
      assert.doesNotMatch(handoff.searchParams.get('text'), /Beta Test Guest|5550100/);
      const saved = await Order.findOne({ restaurantId: a._id, orderNumber: result.order.orderNumber });
      assert.equal(saved.customerName, 'Savora Beta Test Guest');
      assert.equal(saved.submissionMethod, 'whatsapp');
      assert.equal(saved.items[0].variantName, 'Medium');
      assert.equal(saved.items[0].unitPrice, 200);
      const ownerOrder = (token) => fetch(beta + '/api/owner/orders/' + saved._id, {
        headers: { Cookie: `savora_owner_session=${token}` },
      });
      assert.equal((await ownerOrder(raw)).status, 200);
      assert.equal((await ownerOrder(secondToken)).status, 404);
      const replay = await post(a.slug, payload, key, beta);
      assert.equal(replay.status, 200);
      assert.deepEqual(await replay.json(), result);
      const changed = await post(a.slug, { ...payload, items: [{ ...payload.items[0], quantity: 2 }] }, key, beta);
      assert.equal(changed.status, 409);
      assert.deepEqual(await changed.json(), { error: 'Idempotency key conflict' });
      assert.equal(await Order.countDocuments({ restaurantId: a._id }), before + 1);
      const direct = await post(b.slug, { submissionMethod: 'direct',
        items: [{ productId: String(bOrderable._id), quantity: 1 }] }, randomUUID(), beta);
      assert.equal(direct.status, 201);
      assert.equal((await direct.json()).whatsapp, undefined);
    });
  } finally {
    if (betaServer) await new Promise(resolve => betaServer.close(resolve));
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connection.readyState === 1) {
      for (const name of ['Order', 'OwnerSession', 'Product', 'Category', 'User', 'Restaurant']) {
        for (const _id of ids.get(name) ?? []) {
          await connection.models[name].deleteOne({ _id });
        }
      }
      const audit = mongoose.createConnection(validatedTestUri(), { autoIndex:false, autoCreate:false, serverSelectionTimeoutMS:10000 });
      try { await audit.asPromise(); assert.equal(audit.db.databaseName, 'savora_test');
        for (const [name, values] of ids) assert.equal(await audit.collection(connection.models[name].collection.name).countDocuments({_id:{$in:values}}),0,`${name} cleanup`);
        console.log('Independent exact-ID checkout cleanup passed');
      } finally { await audit.close(); }
    }
    await connection.close();
  }
});
