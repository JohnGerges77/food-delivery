import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { createApp, handleApiError } from '../src/app.js';
import { serializeOwnerRestaurant } from '../src/routes/owner.js';
import { createOwnerTenantScope, ownerIdFilter, ownerListFilter,
  OwnerResourceNotFound } from '../src/services/ownerTenant.js';
import { InvalidRestaurantSettings, parseRestaurantSettingsPatch,
  getOwnerRestaurant, assertHeroProductEligible } from '../src/services/restaurantSettings.js';

test('tenant query helpers reject caller-constructed owner contexts', () => {
  const forged = {
    userId: new mongoose.Types.ObjectId(), restaurantId: new mongoose.Types.ObjectId(),
  };
  const resourceId = new mongoose.Types.ObjectId();
  assert.throws(() => ownerIdFilter(forged, resourceId), /Verified owner context/);
  assert.throws(() => ownerListFilter(forged), /Verified owner context/);
  assert.throws(() => createOwnerTenantScope(null, forged), /Verified owner context/);
});

test('owner restaurant serializer uses an explicit safe field list', () => {
  const restaurant = {
    _id: new mongoose.Types.ObjectId(), name: 'A', slug: 'a', currency: 'EGP',
    status: 'active', passwordHash: 'secret', tokenHash: 'secret',
    trackingTokenHash: 'secret', credentials: { password: 'secret' },
  };
  const result = serializeOwnerRestaurant(restaurant);
  assert.deepEqual(Object.keys(result), [
    'id', 'name', 'slug', 'currency', 'status', 'heroProductId', 'description', 'logoUrl',
    'phone', 'contactEmail', 'address', 'openingHours', 'deliverySettings',
    'socialLinks', 'branding',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /secret|passwordHash|tokenHash|credentials/);
});

test('Hero selection is a nullable ObjectId and checks tenant, availability and active category', async () => {
  const restaurantId = new mongoose.Types.ObjectId();
  const productId = String(new mongoose.Types.ObjectId());
  const categoryId = new mongoose.Types.ObjectId();
  assert.equal(parseRestaurantSettingsPatch({ heroProductId: productId }).heroProductId, productId);
  assert.equal(parseRestaurantSettingsPatch({ heroProductId: null }).heroProductId, null);
  for (const heroProductId of ['bad', '', {}, 42]) {
    assert.throws(() => parseRestaurantSettingsPatch({ heroProductId }), InvalidRestaurantSettings);
  }
  let found = { categoryId };
  let active = true;
  const Product = { findOne(filter) {
    assert.deepEqual(filter, { _id: productId, restaurantId, isAvailable: true });
    return { select() { return { lean: async () => found }; } };
  } };
  const Category = { async exists(filter) {
    assert.deepEqual(filter, { _id: categoryId, restaurantId, isActive: true });
    return active;
  } };
  await assert.doesNotReject(assertHeroProductEligible(Product, Category, restaurantId, productId));
  found = null;
  await assert.rejects(assertHeroProductEligible(Product, Category, restaurantId, productId), InvalidRestaurantSettings);
  found = { categoryId }; active = false;
  await assert.rejects(assertHeroProductEligible(Product, Category, restaurantId, productId), InvalidRestaurantSettings);
});

test('restaurant settings require a verified owner context', async () => {
  await assert.rejects(() => getOwnerRestaurant(null, {
    restaurantId: new mongoose.Types.ObjectId(),
  }), /Verified owner context/);
});

test('restaurant settings patch accepts only supported scalar and nested fields', () => {
  const parsed = parseRestaurantSettingsPatch({
    name: 'New name', logoUrl: 'https://example.test/logo.png',
    deliverySettings: { deliveryFee: 4, deliveryAvailable: false },
    socialLinks: { whatsapp: 'https://wa.me/201000000000' },
    branding: { primaryColor: '#abc' },
  });
  assert.deepEqual({ ...parsed }, {
    name: 'New name', logoUrl: 'https://example.test/logo.png',
    'deliverySettings.deliveryFee': 4, 'deliverySettings.deliveryAvailable': false,
    'socialLinks.whatsapp': 'https://wa.me/201000000000',
    'branding.primaryColor': '#abc',
  });
});

test('restaurant settings patch rejects immutable, unknown, operator, and dotted keys', () => {
  for (const body of [
    {}, { _id: 'x' }, { slug: 'another' }, { status: 'suspended' },
    { storefrontTheme: 'savora-classic' },
    { currency: 'USD' }, { restaurantId: 'x' }, { userId: 'x' },
    { role: 'owner' }, { surprise: true }, { $set: { name: 'x' } },
    { 'deliverySettings.deliveryFee': 0 },
    { deliverySettings: { $set: { deliveryFee: 0 } } },
    { deliverySettings: { 'deliveryFee.extra': 0 } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    { branding: JSON.parse('{"constructor":{"prototype":{}}}') },
    { deliverySettings: {} }, { socialLinks: null },
  ]) {
    assert.throws(() => parseRestaurantSettingsPatch(body), InvalidRestaurantSettings);
  }
  assert.equal({}.polluted, undefined);
});

test('restaurant settings patch rejects malformed values before Mongoose casting', () => {
  for (const body of [
    { name: '  ' }, { name: 123 }, { phone: ['123'] },
    { description: 'x'.repeat(2049) }, { deliverySettings: { deliveryFee: -1 } },
    { deliverySettings: { deliveryFee: '4' } },
    { deliverySettings: { deliveryFee: null } },
    { deliverySettings: { deliveryAvailable: 'false' } },
    { socialLinks: { facebook: 'javascript:alert(1)' } },
    { socialLinks: { whatsapp: 'https://user:pass@wa.me/123' } },
    { logoUrl: '/images/logo.png' }, { branding: [] },
  ]) {
    assert.throws(() => parseRestaurantSettingsPatch(body), InvalidRestaurantSettings);
  }
});

test('owner restaurant route requires a verified session even with forged tenant headers', async () => {
  const app = createApp({ allowedOrigins: 'http://localhost:3000' });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/owner/restaurant`;
    const response = await fetch(`${url}?restaurantId=forged&userId=forged&role=owner`, {
      headers: { restaurantId: 'forged', userId: 'forged', role: 'owner' },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    const patch = await fetch(url, { method: 'PATCH',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json',
        'X-Savora-CSRF': 'a'.repeat(64) }, body: JSON.stringify({ name: 'Forged' }) });
    assert.equal(patch.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('owner resource misses become non-disclosing HTTP 404 responses', async () => {
  const app = express();
  app.get('/resource', () => { throw new OwnerResourceNotFound(); });
  app.use(handleApiError);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/resource`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
