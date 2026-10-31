import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import RestaurantSchema from '../src/models/Restaurant.js';
import UserSchema from '../src/models/User.js';
import OwnerSessionSchema from '../src/models/OwnerSession.js';
import CategorySchema from '../src/models/Category.js';
import ProductSchema from '../src/models/Product.js';
import OrderSchema from '../src/models/Order.js';
import { provisionRestaurantOwner } from '../src/services/provisionRestaurantOwner.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frontendPort = 3110;
const frontendUrl = `http://localhost:${frontendPort}`;
const apiPort = 5101;

function validatedTestUri() {
  const value = process.env.MONGODB_TEST_URI;
  assert.ok(value, 'MONGODB_TEST_URI is required');
  try {
    const uri = new URL(value);
    assert.ok(['mongodb:', 'mongodb+srv:'].includes(uri.protocol));
    assert.equal(decodeURIComponent(uri.username), 'savora_test_user');
    assert.equal(uri.pathname, '/savora_test');
    assert.equal([...uri.searchParams.keys()].some((key) =>
      key.toLowerCase() === 'dbname'), false);
  } catch { throw new Error('MONGODB_TEST_URI failed test database safety checks'); }
  return value;
}

async function waitFor(check, label, attempts = 160) {
  for (let i = 0; i < attempts; i++) {
    try { if (await check()) return; } catch { /* Navigation or compilation is in progress. */ }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Timed out: ${label}`);
}

async function browserSession(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then((response) => response.json());
  const target = targets.find((entry) => entry.type === 'page');
  assert.ok(target, 'An isolated Edge/Chrome CDP page is required');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const requests = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      const safe = url.hostname === 'localhost' && url.port === String(apiPort);
      void send(safe ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        safe ? { requestId } : { requestId, errorReason: 'BlockedByClient' })
        .catch(() => { /* Navigation may cancel an intercepted request. */ });
      if (!safe) requests.push({ method: 'BLOCKED', url: request.url });
    }
    if (message.method === 'Network.requestWillBeSent' &&
        message.params.request.url.includes('/api/')) {
      requests.push({ method: message.params.request.method,
        url: message.params.request.url, body: message.params.request.postData });
    }
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  function send(method, params = {}) {
    return new Promise((done, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve: done, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression,
      returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function navigate(path) {
    await send('Page.navigate', { url: `${frontendUrl}${path}` });
    await waitFor(() => evaluate('document.readyState === "complete"'), path);
  }
  async function fill(name, value) {
    await evaluate(`document.querySelector('[name=${name}]').focus()`);
    await send('Input.insertText', { text: value });
    await waitFor(() => evaluate(`document.querySelector('[name=${name}]').value === ${JSON.stringify(value)}`),
      `${name} input`);
  }
  async function fillId(id, value) {
    await evaluate(`document.getElementById(${JSON.stringify(id)}).focus()`);
    await send('Input.insertText', { text: value });
    await waitFor(() => evaluate(`document.getElementById(${JSON.stringify(id)}).value === ${JSON.stringify(value)}`),
      `${id} input`);
  }
  async function click(expression) {
    assert.equal(await evaluate(expression), true, 'Expected browser action was available');
  }
  async function screenshot(name) {
    const result = await send('Page.captureScreenshot', { format: 'png',
      captureBeyondViewport: true });
    await writeFile(join(root, 'docs', name), Buffer.from(result.data, 'base64'));
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*',
    requestStage: 'Request' }] });
  await send('Network.clearBrowserCookies');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900,
    deviceScaleFactor: 1, mobile: false });
  return { socket, send, evaluate, navigate, fill, fillId, click, screenshot, requests };
}

test('real browser, Next and Express journey on isolated savora_test', async () => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24);
  assert.ok(process.env.SAVORA_CDP_PORT, 'SAVORA_CDP_PORT is required');
  const connection = mongoose.createConnection(validatedTestUri(), {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000,
  });
  const provisions = [];
  let server;
  let browser;
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
    for (const Model of [OwnerSession, Category, Product, Order]) await Model.createIndexes();
    const suffix = randomUUID().replaceAll('-', '');
    const password = `Phase88-${suffix}-Password!`;
    for (const label of ['a', 'b']) {
      provisions.push(await provisionRestaurantOwner({
        restaurant: { name: `Phase 8.8 ${label}`, slug: `it-phase88-${label}-${suffix}`,
          currency: 'EGP' },
        owner: { name: `Phase 8.8 owner ${label}`,
          email: `it-phase88-${label}-${suffix}@example.test` },
        password,
      }, { connection }));
    }
    const [a, b] = provisions;
    await Restaurant.updateOne({ _id: a.restaurantId }, { $set: {
      deliverySettings: { deliveryFee: 5, minimumOrder: 0,
        estimatedDeliveryTime: '30 min', deliveryAvailable: true },
      socialLinks: { whatsapp: 'https://wa.me/201001234567' },
    } });
    const category = await Category.create({ restaurantId: a.restaurantId,
      name: 'Phase 8.8 meals', slug: `it-phase88-meals-${suffix}` });
    const product = await Product.create({ restaurantId: a.restaurantId,
      categoryId: category._id, name: 'Phase 8.8 burger',
      slug: `it-phase88-burger-${suffix}`, price: 12.5, isAvailable: true });
    server = createApp({ connection, allowedOrigins: frontendUrl,
      secureCookies: false }).listen(apiPort);
    await new Promise((done) => server.once('listening', done));
    await waitFor(async () =>
      (await fetch(`${frontendUrl}/en/dashboard/login`).catch(() => null))?.ok,
    'separately started isolated Next frontend', 120);
    browser = await browserSession(process.env.SAVORA_CDP_PORT);
    const { evaluate, navigate, fill, fillId, click, screenshot, requests } = browser;
    await navigate(`/en/r/${a.slug}/menu/${product._id}`);
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some((el) => el.textContent.includes('Add to cart'))"),
      'test product detail');
    await click("(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Add to cart')); if (!el) return false; el.click(); return true; })()");
    await click("(() => { const el = [...document.querySelectorAll('a')].find((x) => new URL(x.href).pathname.endsWith('/cart')); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/cart')"), 'cart');
    await click("(() => { const el = [...document.querySelectorAll('a')].find((x) => x.href.includes('/checkout')); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=fullName]'))"), 'checkout');
    await fill('fullName', 'Phase88 Guest');
    await fill('phone', '+201001234567');
    await fill('address', '12 Test Street');
    await fill('city', 'Cairo');
    for (let step = 0; step < 3; step++) {
      await evaluate("document.querySelector('form button[type=submit]').click()");
      await new Promise((done) => setTimeout(done, 300));
    }
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation]'))"),
      'persisted checkout confirmation', 240);
    const saved = await Order.findOne({ restaurantId: a.restaurantId,
      customerName: 'Phase88 Guest' });
    assert.ok(saved);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.total, 17.5);
    assert.equal(await evaluate(`document.querySelector('[data-testid=checkout-confirmation]').textContent.includes(${JSON.stringify(saved.orderNumber)})`), true);
    const checkoutPost = requests.find((entry) => entry.method === 'POST' &&
      entry.url.includes(`/api/public/restaurants/${a.slug}/orders`));
    assert.ok(checkoutPost);
    assert.equal('total' in JSON.parse(checkoutPost.body), false);
    assert.equal('restaurantId' in JSON.parse(checkoutPost.body), false);
    await screenshot('phase88-real-checkout-test.png');

    await navigate('/en/dashboard/login');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=email]'))"), 'owner login');
    await fill('email', a.ownerEmail);
    await fill('password', password);
    await evaluate("document.querySelector('form button[type=submit]').click()");
    await waitFor(() => evaluate("location.pathname === '/en/dashboard'"), 'authenticated dashboard', 240);
    await navigate('/en/dashboard/settings');
    await waitFor(() => evaluate("Boolean(document.getElementById('settings-openingHours'))"),
      'real owner settings');
    await fillId('settings-openingHours', 'Daily 10–22');
    await click("(() => { const el = [...document.querySelectorAll('form button')].find((x) => x.textContent.includes('Save Settings')); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => (await Restaurant.findById(a.restaurantId))?.openingHours === 'Daily 10–22',
      'settings PATCH persistence', 240);
    await navigate('/en/dashboard/settings');
    await waitFor(() => evaluate("document.getElementById('settings-openingHours')?.value === 'Daily 10–22'"),
      'settings reload persistence');

    await navigate('/en/dashboard/categories');
    await waitFor(() => evaluate("document.body.textContent.includes('Phase 8.8 meals')"),
      'real Category list');
    await click("(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add Category'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("Boolean(document.getElementById('category-name'))"),
      'Category editor');
    await fillId('category-name', 'Phase 8.8 UI category');
    await fillId('category-slug', `it-phase88-ui-${suffix}`);
    await click("(() => { const el = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.includes('Save Category')); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => Boolean(await Category.findOne({
      restaurantId: a.restaurantId, slug: `it-phase88-ui-${suffix}` })),
    'Category created through browser', 240);

    await navigate('/en/dashboard/products');
    await waitFor(() => evaluate("document.body.textContent.includes('Phase 8.8 burger')"),
      'real Product list');
    await click("(() => { const el = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add Product'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("Boolean(document.getElementById('product-name'))"),
      'Product editor');
    await fillId('product-name', 'Phase 8.8 UI side');
    await fillId('product-slug', `it-phase88-side-${suffix}`);
    await fillId('product-price', '3.25');
    await click("(() => { const el = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.includes('Save Product')); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => Boolean(await Product.findOne({
      restaurantId: a.restaurantId, slug: `it-phase88-side-${suffix}` })),
    'Product created through browser', 240);

    await navigate('/en/dashboard/orders');
    await waitFor(() => evaluate(`document.querySelector('[data-testid=owner-orders-list]')?.textContent.includes(${JSON.stringify(saved.orderNumber)})`),
      'real Order in dashboard', 240);
    await click("(() => { const el = [...document.querySelectorAll('[data-testid=owner-orders-list] article button')].find((x) => x.textContent.trim() === 'View'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("document.querySelector('[role=dialog]')?.textContent.includes('Phase 8.8 burger')"),
      'saved item snapshot');
    await click("(() => { const el = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Mark as Delivered'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-testid=status-confirmation]'))"),
      'final transition confirmation');
    await click("(() => { const el = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.includes('Confirm Status')); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => (await Order.findById(saved._id))?.status === 'delivered',
      'delivered Order persisted', 240);
    assert.ok((await Order.findById(saved._id)).deliveredAt);
    await navigate('/en/dashboard');
    await waitFor(() => evaluate("/EGP\\s*17\\.50/.test(document.body.textContent) && document.body.textContent.includes('Phase 8.8 burger')"),
      'real delivered value and product in Overview', 240);
    await screenshot('phase88-real-overview-test.png');
    assert.ok(requests.some((entry) => entry.url.includes('/api/owner/stats/overview')));
    assert.ok(requests.some((entry) => entry.method === 'PATCH' &&
      entry.url.includes(`/api/owner/orders/${saved._id}/status`)));
    await navigate('/en/dashboard');
    await waitFor(() => evaluate("/EGP\\s*17\\.50/.test(document.body.textContent)"),
      'refresh restores the authenticated session', 240);
    await click("(() => { const el = document.querySelector('button[aria-label=\"Log out\"]'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/dashboard/login')"),
      'logout redirect');
    assert.equal(await Order.countDocuments({ restaurantId: b.restaurantId }), 0);
    await fill('email', b.ownerEmail);
    await fill('password', password);
    await evaluate("document.querySelector('form button[type=submit]').click()");
    await waitFor(() => evaluate("location.pathname === '/en/dashboard'"),
      'second owner login', 240);
    await navigate('/en/dashboard/orders');
    await waitFor(() => evaluate("document.body.textContent.includes('No matching orders')"),
      'second owner has no first tenant Orders');
    assert.equal(await evaluate("document.body.textContent.includes('Phase88 Guest')"), false);
    assert.equal(requests.some((entry) => entry.method === 'BLOCKED'), false,
      'no browser request reached another API origin');
  } finally {
    if (browser) {
      browser.socket.close();
    }
    if (server) {
      server.close();
      server.closeAllConnections();
      server.closeIdleConnections();
      server.unref();
    }
    if (connection.readyState === 1 && connection.name === 'savora_test' &&
        connection.db.databaseName === 'savora_test') {
      for (const tenant of provisions) {
        const restaurant = await connection.db.collection('restaurants').findOne({
          _id: tenant.restaurantId, slug: tenant.slug,
        });
        assert.ok(restaurant, 'Fixture identity must match before cleanup');
        for (const [name, filter] of [
          ['ownersessions', { userId: tenant.ownerId }],
          ['orders', { restaurantId: tenant.restaurantId }],
          ['products', { restaurantId: tenant.restaurantId }],
          ['categories', { restaurantId: tenant.restaurantId }],
        ]) {
          const collection = connection.db.collection(name);
          const ids = await collection.find(filter, { projection: { _id: 1 } }).toArray();
          if (ids.length) await collection.deleteMany({
            _id: { $in: ids.map((document) => document._id) },
          });
        }
        await connection.db.collection('users').deleteOne({ _id: tenant.ownerId,
          restaurantId: tenant.restaurantId });
        await connection.db.collection('restaurants').deleteOne({
          _id: tenant.restaurantId, slug: tenant.slug,
        });
      }
    }
    await connection.close();
  }
});
