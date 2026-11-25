import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import Product from '../src/models/Product.js';
import { createApp } from '../src/app.js';
import { checkoutRateLimit } from '../src/routes/public.js';
import { betaCheckoutBody, buildWhatsAppUrl, InvalidCheckout, CheckoutUnavailable, moneyToMinor,
  parseCheckout } from '../src/services/guestCheckout.js';
import { normalizeWhatsAppNumber } from '../src/services/whatsappOrdering.js';
import { effectiveOrdering } from '../src/services/restaurantOrdering.js';

const key = 'checkout-test-key-0001';
const id = String(new mongoose.Types.ObjectId());
const payload = () => ({ customerName: ' Mona ', customerPhone: '+201001234567',
  deliveryAddress: ' 12 Nile Street ', city: ' Cairo ', submissionMethod: 'direct',
  items: [{ productId: id, quantity: 2 }] });

test('online entitlement, deployment gate, delivery and Beta target are independent ordering gates', () => {
  const enabled = { slug: 'a', deliverySettings: { deliveryAvailable: true, whatsappOrderingEnabled: true },
    socialLinks: { whatsapp: 'https://wa.me/12025550100' } };
  assert.equal(effectiveOrdering(enabled).availability, 'available');
  assert.equal(effectiveOrdering(enabled).whatsappTarget, 'https://wa.me/12025550100');
  assert.equal(effectiveOrdering({ ...enabled, onlineOrderingEnabled: false }, { checkoutEnabled: false }).availability, 'menu-only');
  assert.equal(effectiveOrdering(enabled, { checkoutEnabled: false }).whatsappTarget, null);
  assert.equal(effectiveOrdering({ ...enabled, deliverySettings: { deliveryAvailable: false } }).availability, 'delivery-unavailable');
  assert.equal(effectiveOrdering(enabled, { betaWhatsAppTargets: new Map() }).whatsappTarget, null);
});

test('checkout parses a strict, normalized guest payload', () => {
  assert.deepEqual(parseCheckout(payload(), key), {
    customerName: 'Mona', customerPhone: '+201001234567',
    deliveryAddress: '12 Nile Street', city: 'Cairo', submissionMethod: 'direct',
    items: [{ productId: id, quantity: 2 }],
  });
  assert.equal(parseCheckout({ ...payload(), customerEmail: '' }, key).customerEmail,
    undefined);
});

test('beta input adds fixed synthetic details and preserves a validated variant without accepting prices', () => {
  const variantId = String(new mongoose.Types.ObjectId());
  const items = [{ productId: id, variantId, quantity: 1 }];
  const parsed = parseCheckout(betaCheckoutBody({ submissionMethod: 'direct', items }), key);
  assert.deepEqual(parsed.items, items);
  assert.equal(parsed.customerName, 'Savora Beta Test Guest');
  assert.equal(parsed.deliveryAddress, 'Synthetic order, no fulfillment');
  assert.equal(parseCheckout(betaCheckoutBody({ submissionMethod: 'whatsapp', items }), key).submissionMethod, 'whatsapp');
  assert.throws(() => betaCheckoutBody({ submissionMethod: 'direct',
    items: [{ ...items[0], unitPrice: 1 }] }), InvalidCheckout);
});

test('checkout rejects untrusted amounts, operators, nested keys and malformed input', () => {
  const bad = [
    { ...payload(), restaurantId: id }, { ...payload(), total: 1 },
    { ...payload(), subtotal: 1 }, { ...payload(), deliveryFee: 1 },
    { ...payload(), orderNumber: 'x' }, { ...payload(), status: 'delivered' },
    { ...payload(), 'items.0.quantity': 4 },
    { ...payload(), $set: { total: 1 } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    { ...payload(), customerName: ' ' }, { ...payload(), customerPhone: 'abc' },
    { ...payload(), customerEmail: 'bad' }, { ...payload(), notes: 'x'.repeat(501) },
    { ...payload(), submissionMethod: 'other' }, { ...payload(), items: [] },
    { ...payload(), items: [{ productId: id, quantity: 0 }] },
    { ...payload(), items: [{ productId: id, quantity: 1.5 }] },
    { ...payload(), items: [{ productId: id, quantity: 1, unitPrice: 1 }] },
    { ...payload(), items: [{ productId: id, quantity: 1, name: 'Fake' }] },
    { ...payload(), items: [{ productId: id, quantity: 1, imageUrl: '/fake' }] },
    { ...payload(), items: [{ productId: id, quantity: 1 },
      { productId: id, quantity: 1 }] },
  ];
  for (const body of bad) assert.throws(() => parseCheckout(body, key), InvalidCheckout);
  assert.throws(() => parseCheckout(payload(), 'short'), InvalidCheckout);
  assert.equal({}.polluted, undefined);
});

test('money uses bounded integer minor units and rejects ambiguous precision', () => {
  assert.equal(moneyToMinor(12.34, 2), 1234);
  assert.equal(moneyToMinor(5, 0), 5);
  assert.equal(moneyToMinor(1.234, 3), 1234);
  for (const value of [-1, 1.234, 1e-7, Infinity, 1_000_000.01]) {
    assert.throws(() => moneyToMinor(value, 2), CheckoutUnavailable);
  }
});

test('WhatsApp requires a clean wa.me target and uses a bounded encoded message', () => {
  assert.equal(normalizeWhatsAppNumber('https://wa.me/201001234567'),
    'https://wa.me/201001234567');
  assert.equal(normalizeWhatsAppNumber('+1 (202) 555-0100'), 'https://wa.me/12025550100');
  for (const value of ['01234567890', '+99912345678', 'https://evil.test/123', 'http://wa.me/201001234567',
    'https://wa.me/201001234567?text=forged', 'https://wa.me/abc']) {
    assert.equal(normalizeWhatsAppNumber(value), null);
  }
  const url = buildWhatsAppUrl({ orderNumber: 'SV-123', customerName: 'Mona',
    customerPhone: '+201001234567', deliveryAddress: '12 Nile', city: 'Cairo',
    subtotal: 40, deliveryFee: 2.5, total: 42.5,
    notes: 'No onions', items: [{ name: 'Burger', quantity: 2, unitPrice: 20 }] },
  'https://wa.me/201001234567', 'EGP', 'Cafe One');
  assert.ok(url.length < 4096);
  assert.match(decodeURIComponent(url), /2 x Burger/);
  assert.match(decodeURIComponent(url), /Cafe One/);
  assert.match(decodeURIComponent(url), /20.00 EGP = 40.00 EGP/);
  assert.match(decodeURIComponent(url), /Notes: No onions/);
});

test('beta handoff retains the warning, variant and price for every item in an encoded order', () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    name: index + ' 🍕'.repeat(80), variantName: index + ' عربي'.repeat(50), quantity: 1, unitPrice: 20,
  }));
  const url = new URL(buildWhatsAppUrl({
    orderNumber: 'SV-123', items, subtotal: 200, deliveryFee: 0, total: 200,
    customerName: 'Savora Beta Test Guest', customerPhone: '+12025550199',
  }, 'https://wa.me/12025550100', 'EGP', 'Beta', { beta: true }));
  const message = url.searchParams.get('text');
  assert.match(message, /TEST ORDER.*no payment or fulfillment/);
  assert.match(message, /Order SV-123/);
  for (let index = 0; index < items.length; index++) {
    assert.match(message, new RegExp('1 x ' + index + ' .* \\(' + index + ' .*\\) @ 20.00 EGP'));
  }
  assert.match(message, /Total: 200.00 EGP/);
  assert.doesNotMatch(message, /5550199|Savora Beta Test Guest/);
  assert.ok(url.search.length < 3507);
});

test('internal checkout fields are hidden by Order serialization', () => {
  const order = new Order({ idempotencyKeyHash: 'key-secret',
    idempotencyRequestHash: 'request-secret', whatsappTarget: 'target-secret' });
  assert.equal(JSON.stringify(order).includes('secret'), false);
  assert.equal(Order.schema.path('idempotencyKeyHash').options.select, false);
  assert.equal(Product.schema.path('orderReferenceRevision').options.select, false);
});

test('database outage cannot return a successful checkout', async () => {
  const connection = mongoose.createConnection();
  const server = createApp({ connection, allowedOrigins: 'https://dashboard.example.test' })
    .listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}` +
      '/api/public/restaurants/test/orders', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload()) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Service unavailable' });
    const tooLarge = await fetch(`http://127.0.0.1:${server.address().port}` +
      '/api/public/restaurants/test/orders', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ ...payload(), notes: 'x'.repeat(13_000) }) });
    assert.equal(tooLarge.status, 413);
    const preflight = await fetch(`http://127.0.0.1:${server.address().port}` +
      '/api/public/restaurants/test/orders', { method: 'OPTIONS', headers: {
        Origin: 'https://storefront.example.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Idempotency-Key',
      } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await connection.close();
  }
});

test('checkout rate limit is bounded by IP and restaurant', () => {
  const limit = checkoutRateLimit({ limit: 2, windowMs: 60_000 });
  const req = { ip: '192.0.2.1', params: { slug: 'cafe' } };
  let passed = 0;
  const res = { statusCode: 200, set() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
  limit(req, res, () => passed++);
  limit(req, res, () => passed++);
  limit(req, res, () => passed++);
  assert.equal(passed, 2);
  assert.equal(res.statusCode, 429);
  req.params.slug = 'other';
  limit(req, res, () => passed++);
  assert.equal(passed, 3);
});
