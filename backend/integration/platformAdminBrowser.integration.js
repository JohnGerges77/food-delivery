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
import AdminSchema from '../src/models/PlatformAdmin.js';
import AdminSessionSchema from '../src/models/PlatformAdminSession.js';
import AuditSchema from '../src/models/PlatformAudit.js';
import { bootstrapPlatformAdmin } from '../src/services/platformAdminAuth.js';

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

async function waitFor(check, label, attempts = 480) {
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
    for (let attempt = 0; attempt < 4; attempt++) {
      await evaluate(`(() => { const input = document.querySelector('[name=${name}]'); input.value = ''; input.focus(); })()`);
      await send('Input.insertText', { text: value });
      if (await evaluate(`document.querySelector('[name=${name}]').value === ${JSON.stringify(value)}`)) return;
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error(`Could not fill ${name} input`);
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
  async function screenshot(name, fullPage = true) {
    const result = await send('Page.captureScreenshot', { format: 'png',
      captureBeyondViewport: fullPage });
    await writeFile(join(root, 'docs', ...(process.env.SAVORA_BROWSER_OUTPUT_DIR === 'phase10.3' ? ['phase10.3'] : []), name), Buffer.from(result.data, 'base64'));
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

test('real Platform Admin browser journey on isolated savora_test', async () => {
  assert.equal(Number(process.versions.node.split('.')[0]), 24);
  assert.ok(process.env.SAVORA_CDP_PORT, 'SAVORA_CDP_PORT is required');
  const connection = mongoose.createConnection(validatedTestUri(), { autoIndex: false,
    autoCreate: false, serverSelectionTimeoutMS: 30_000 });
  const suffix = randomUUID().replaceAll('-', '');
  const slug = `it-admin-browser-${suffix}`;
  const adminEmail = `admin-browser-${suffix}@example.test`;
  const ownerEmail = `owner-browser-${suffix}@example.test`;
  const password = `Browser-${suffix}-Password!`;
  let server;
  let browser;
  let adminId;
  let restaurantId;
  let ownerId;
  let otherTenant;
  let otherCategoryId;
  try {
    await connection.asPromise();
    assert.equal(connection.name, 'savora_test');
    assert.equal(connection.db.databaseName, 'savora_test');
    const Restaurant = connection.model('Restaurant', RestaurantSchema.schema);
    const User = connection.model('User', UserSchema.schema);
    const Admin = connection.model('PlatformAdmin', AdminSchema.schema);
    const AdminSession = connection.model('PlatformAdminSession', AdminSessionSchema.schema);
    const Audit = connection.model('PlatformAudit', AuditSchema.schema);
    const Category = connection.model('Category', CategorySchema.schema);
    assert.equal(await Admin.countDocuments(), 0, 'No existing test Admin may be replaced');
    const admin = await bootstrapPlatformAdmin(connection, adminEmail, password);
    adminId = admin._id;
    await AdminSession.createIndexes();
    await Audit.createIndexes();
    otherTenant = await provisionRestaurantOwner({
      restaurant: { name: 'Other tenant', slug: `it-admin-other-${suffix}`, currency: 'EGP' },
      owner: { name: 'Other Owner', email: `other-owner-${suffix}@example.test` },
      password,
    }, { connection });
    const otherCategory = await Category.create({ restaurantId: otherTenant.restaurantId,
      name: 'Other tenant private category', slug: `it-admin-other-category-${suffix}` });
    otherCategoryId = otherCategory._id;
    server = createApp({ connection, allowedOrigins: frontendUrl,
      secureCookies: false }).listen(apiPort);
    await new Promise((done) => server.once('listening', done));
    await waitFor(async () =>
      (await fetch(`${frontendUrl}/en/admin/login`).catch(() => null))?.ok,
    'separately started isolated Next frontend', 120);
    browser = await browserSession(process.env.SAVORA_CDP_PORT);
    const { evaluate, navigate, fill, click, screenshot, send, requests } = browser;
    await navigate('/en/admin/login');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=email]'))"),
      'Admin login');
    await screenshot('phase9-admin-login-en.png');
    await fill('email', adminEmail);
    await fill('password', password);
    await click("(() => { const el = document.querySelector('form button'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname === '/en/admin' && !document.body.textContent.includes('Loading…')"), 'Admin overview', 480);
    await screenshot('phase9-admin-overview-en.png');
    await navigate('/en/admin/restaurants');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[aria-label=Search]')) && !document.body.textContent.includes('Loading…')"),
      'Admin restaurant list');
    await screenshot('phase9-admin-restaurants-en.png');
    await navigate('/en/admin/restaurants/new');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=ownerPassword]'))"),
      'Admin restaurant form');
    assert.equal(await evaluate("[...document.querySelector('select[name=storefrontTheme]').options].map(x => x.value).join(',')"),
      'savora-classic,savora-aqua,savora-cafe,savora-luxury');
    await evaluate("document.querySelector('select[name=storefrontTheme]').value = 'savora-cafe'");
    await screenshot('phase9-admin-create-en.png');
    await fill('name', 'Phase 9 Cafe');
    await fill('slug', slug);
    await fill('ownerName', 'Phase 9 Owner');
    await fill('ownerEmail', ownerEmail);
    await fill('ownerPassword', password);
    await click("(() => { const el = document.querySelector('form button'); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => Boolean(await Restaurant.findOne({ slug })),
      'browser-created Restaurant and Owner', 480);
    const restaurant = await Restaurant.findOne({ slug });
    restaurantId = restaurant._id;
    assert.equal(restaurant.storefrontTheme, 'savora-cafe');
    const owner = await User.findOne({ restaurantId, email: ownerEmail });
    assert.ok(owner);
    ownerId = owner._id;
    await waitFor(() => evaluate("location.pathname.includes('/admin/restaurants/') && !location.pathname.endsWith('/new')"),
      'Admin restaurant details', 480);
    await waitFor(() => evaluate("document.body.textContent.includes('Savora Café')"), 'Cafe Admin assignment');
    await screenshot('phase9-admin-details-en.png');
    await navigate(`/en/r/${slug}`);
    await waitFor(() => evaluate("document.querySelector('[data-storefront-theme]')?.getAttribute('data-storefront-theme') === 'savora-cafe'"),
      'Cafe storefront from saved Admin assignment');
    await screenshot('phase103-admin-assigned-cafe-en.png');
    await navigate(`/en/admin/restaurants/${restaurantId}`);
    await waitFor(() => evaluate("document.querySelector('select')?.value === 'savora-cafe'"), 'Cafe detail selection');
    await evaluate("(() => { const select = document.querySelector('select'); select.value = 'savora-aqua'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
    await click("(() => { const button = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save theme')); if (!button) return false; button.click(); return true; })()");
    await waitFor(async () => (await Restaurant.findById(restaurantId))?.storefrontTheme === 'savora-aqua', 'Admin theme change to Aqua');
    await waitFor(() => evaluate("document.querySelector('select')?.value === 'savora-aqua'"), 'Aqua detail selection');
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(x => x.textContent.includes('Save theme'))"), 'theme save settled');
    await evaluate("(() => { const select = document.querySelector('select'); select.value = 'savora-cafe'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
    await click("(() => { const button = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save theme')); if (!button) return false; button.click(); return true; })()");
    await waitFor(async () => (await Restaurant.findById(restaurantId))?.storefrontTheme === 'savora-cafe', 'Admin theme change to Cafe');
    assert.equal(await Audit.countDocuments({ restaurantId, action: 'restaurant.theme_changed' }), 2);
    await screenshot('phase103-admin-theme-cafe-en.png');
    await navigate('/ar/admin/restaurants');
    await waitFor(() => evaluate("document.documentElement.dir === 'rtl' && document.body.textContent.includes('المطاعم') && !document.body.textContent.includes('جارٍ التحميل')"),
      'Arabic Admin list', 480);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await evaluate('scrollTo(0, 0)');
    const rtlBounds = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      headerLeft:document.querySelector('header').getBoundingClientRect().left,
      headerRight:document.querySelector('header').getBoundingClientRect().right})`);
    assert.ok(rtlBounds.headerLeft >= -1 && rtlBounds.headerRight <= rtlBounds.width + 1,
      'Arabic header stays within the desktop viewport');
    await screenshot('phase9-admin-restaurants-ar.png', false);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844,
      deviceScaleFactor: 1, mobile: true });
    await navigate('/ar/admin/restaurants/new');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=ownerPassword]'))"),
      'Arabic mobile Admin form', 480);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await screenshot('phase9-admin-create-ar-mobile.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900,
      deviceScaleFactor: 1, mobile: false });
    await navigate('/en/admin');
    await waitFor(() => evaluate("[...document.querySelectorAll('header button')].some(x => x.textContent === 'Log out')"),
      'Admin logout control', 480);
    await click("(() => { const el = [...document.querySelectorAll('header button')].find(x => x.textContent === 'Log out'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/admin/login')"), 'first Admin logout', 480);
    await navigate('/en/dashboard/login');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=email]'))"), 'Owner login form');
    await fill('email', ownerEmail);
    await fill('password', password);
    await click("(() => { const el = document.querySelector('form button[type=submit]'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname === '/en/dashboard'"), 'new Owner dashboard', 480);
    const otherStatus = await evaluate(`fetch('http://localhost:${apiPort}/api/owner/categories/${otherCategoryId}', {credentials:'include'}).then(r=>r.status)`);
    assert.equal(otherStatus, 404, 'new Owner cannot read another tenant Category');
    await navigate('/en/admin');
    await waitFor(() => evaluate("location.pathname === '/en/admin/login'"),
      'Owner cannot enter Admin dashboard', 480);
    await navigate('/en/dashboard');
    await waitFor(() => evaluate("location.pathname === '/en/dashboard' && Boolean(document.querySelector('button[aria-label=\"Log out\"]'))"), 'Owner dashboard restoration', 480);
    await click("(() => { const el = document.querySelector('button[aria-label=\"Log out\"]'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/dashboard/login')"), 'Owner logout', 480);
    await navigate('/en/admin/login');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=email]'))"), 'Admin re-login form');
    await fill('email', adminEmail);
    await fill('password', password);
    await click("(() => { const el = document.querySelector('form button'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname === '/en/admin'"), 'Admin re-login', 480);
    await navigate(`/en/admin/restaurants/${restaurantId}`);
    await waitFor(() => evaluate("document.body.textContent.includes('Phase 9 Cafe') && [...document.querySelectorAll('button')].some(x => x.textContent.includes('Suspend restaurant'))"), 'details');
    await click("(() => { const el = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Suspend restaurant')); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("Boolean(document.querySelector('[role=dialog]'))"), 'suspend confirmation');
    await screenshot('phase9-admin-suspend-en.png');
    await click("(() => { const el = document.querySelector('[role=dialog] button'); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => (await Restaurant.findById(restaurantId))?.status === 'suspended',
      'browser suspension', 480);
    assert.equal((await fetch(`http://localhost:${apiPort}/api/public/restaurants/${slug}`)).status, 404);
    const blockedOwner = await fetch(`http://localhost:${apiPort}/api/auth/login`, {
      method: 'POST', headers: { Origin: frontendUrl, 'X-Savora-CSRF': '1',
        'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    assert.equal(blockedOwner.status, 401);
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(x => x.textContent === 'Activate restaurant')"),
      'reactivation control', 480);
    await click("(() => { const el = [...document.querySelectorAll('button')].find(x => x.textContent === 'Activate restaurant'); if (!el) return false; el.click(); return true; })()");
    await click("(() => { const el = document.querySelector('[role=dialog] button'); if (!el) return false; el.click(); return true; })()");
    await waitFor(async () => (await Restaurant.findById(restaurantId))?.status === 'active',
      'browser reactivation', 480);
    await waitFor(() => evaluate("[...document.querySelectorAll('header button')].some(x => x.textContent === 'Log out')"),
      'Admin final logout control', 480);
    await click("(() => { const el = [...document.querySelectorAll('header button')].find(x => x.textContent === 'Log out'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/admin/login')"), 'Admin logout', 480);
    await navigate('/en/dashboard/login');
    await waitFor(() => evaluate("Boolean(document.querySelector('input[name=email]'))"), 'final Owner login form');
    await fill('email', ownerEmail);
    await fill('password', password);
    await click("(() => { const el = document.querySelector('form button[type=submit]'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname === '/en/dashboard'"), 'new Owner login', 480);
    await waitFor(() => evaluate("Boolean(document.querySelector('button[aria-label=\"Log out\"]'))"),
      'final Owner logout control', 480);
    await waitFor(() => evaluate("Object.keys(document.querySelector('button[aria-label=\"Log out\"]')).some(key => key.startsWith('__reactProps'))"),
      'final Owner logout hydration', 480);
    await click("(() => { const el = document.querySelector('button[aria-label=\"Log out\"]'); if (!el) return false; el.click(); return true; })()");
    await waitFor(() => evaluate("location.pathname.endsWith('/dashboard/login')"), 'Owner logout', 480);
    assert.equal(await Audit.countDocuments({ restaurantId }), 5);
    assert.equal(requests.some((entry) => entry.method === 'BLOCKED'), false);
  } finally {
    if (browser) browser.socket.close();
    if (server) { server.close(); server.closeAllConnections(); server.closeIdleConnections(); server.unref(); }
    if (connection.readyState === 1 && connection.name === 'savora_test' &&
        connection.db.databaseName === 'savora_test') {
      const restaurant = await connection.db.collection('restaurants').findOne({ slug });
      restaurantId ??= restaurant?._id;
      const owner = await connection.db.collection('users').findOne({ email: ownerEmail });
      ownerId ??= owner?._id;
      if (restaurantId) {
        await connection.db.collection('platformaudits').deleteMany({ restaurantId });
        for (const collectionName of ['orders', 'products', 'categories']) {
          const collection = connection.db.collection(collectionName);
          const ids = await collection.find({ restaurantId }, { projection: { _id: 1 } }).toArray();
          if (ids.length) await collection.deleteMany({ _id: { $in: ids.map((x) => x._id) } });
        }
      }
      if (ownerId) {
        await connection.db.collection('ownersessions').deleteMany({ userId: ownerId });
        await connection.db.collection('users').deleteOne({ _id: ownerId, email: ownerEmail });
      }
      if (restaurantId) await connection.db.collection('restaurants').deleteOne({ _id: restaurantId, slug });
      if (otherTenant) {
        const ownedCategory = await connection.db.collection('categories').findOne({
          restaurantId: otherTenant.restaurantId, slug: `it-admin-other-category-${suffix}` });
        otherCategoryId ??= ownedCategory?._id;
        if (otherCategoryId) await connection.db.collection('categories').deleteOne({
          _id: otherCategoryId, restaurantId: otherTenant.restaurantId });
        await connection.db.collection('ownersessions').deleteMany({ userId: otherTenant.ownerId });
        await connection.db.collection('users').deleteOne({ _id: otherTenant.ownerId,
          restaurantId: otherTenant.restaurantId });
        await connection.db.collection('restaurants').deleteOne({ _id: otherTenant.restaurantId,
          slug: otherTenant.slug });
      }
      if (adminId) {
        await connection.db.collection('platformadminsessions').deleteMany({ adminId });
        await connection.db.collection('platformadmins').deleteOne({ _id: adminId, email: adminEmail });
      }
      for (const [collectionName, filter] of [
        ['restaurants', { slug }], ['users', { email: ownerEmail }],
        ['ownersessions', { userId: ownerId ?? null }],
        ['orders', { restaurantId: restaurantId ?? null }],
        ['products', { restaurantId: restaurantId ?? null }],
        ['categories', { restaurantId: restaurantId ?? null }],
        ['platformadmins', { email: adminEmail }],
        ['platformadminsessions', { adminId: adminId ?? null }],
        ['platformaudits', { restaurantId: restaurantId ?? null }],
        ['restaurants', { slug: `it-admin-other-${suffix}` }],
        ['users', { _id: otherTenant?.ownerId ?? null }],
        ['ownersessions', { userId: otherTenant?.ownerId ?? null }],
        ['categories', { _id: otherCategoryId ?? null }],
      ]) assert.equal(await connection.db.collection(collectionName).countDocuments(filter), 0,
        `Fixture cleanup failed: ${collectionName}`);
    }
    await connection.close();
  }
});

