import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import Admin from '../src/models/PlatformAdmin.js';
import Session from '../src/models/PlatformAdminSession.js';
import Audit from '../src/models/PlatformAudit.js';
import { validateBootstrapTarget } from '../src/cli/bootstrap-platform-admin.js';
import { parseAdminListQuery, serializeAdminRestaurant, InvalidAdminInput,
  createPlatformRestaurant, changeRestaurantTheme } from
  '../src/services/platformRestaurants.js';
import { createLoginLimiter } from '../src/routes/auth.js';

test('Platform Admin identity, sessions and audit indexes are isolated', () => {
  const admin = new Admin({ email: ' ADMIN@Example.COM ', passwordHash: 'hash' });
  assert.equal(admin.email, 'admin@example.com');
  assert.equal(admin.role, 'platform_admin');
  assert.equal(admin.isActive, true);
  assert.equal(admin.toJSON().passwordHash, undefined);
  assert.equal(Admin.schema.path('passwordHash').options.select, false);
  assert.ok(Admin.schema.indexes().some(([keys, options]) =>
    keys.bootstrapSlot === 1 && options.unique));
  assert.ok(Session.schema.indexes().some(([keys, options]) =>
    keys.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(Audit.schema.indexes().some(([keys]) => keys.restaurantId === 1));
});

test('bootstrap target requires exact named database and principal', () => {
  const uri = 'mongodb+srv://savora_test_user:secret@example.mongodb.net/savora_test';
  assert.equal(validateBootstrapTarget(uri, 'savora_test'), uri);
  for (const bad of [uri.replace('savora_test_user', 'other'),
    uri.replace('/savora_test', '/savora_dev'), `${uri}?dbName=other`]) {
    assert.throws(() => validateBootstrapTarget(bad, 'savora_test'));
  }
});

test('admin list query is bounded and DTO excludes secrets', () => {
  assert.deepEqual(parseAdminListQuery({ search: '', page: '2', limit: '20' }),
    { search: '', page: 2, limit: 20 });
  for (const query of [{ limit: '1000' }, { search: 'x'.repeat(101) },
    { restaurantId: 'other' }, { page: '0' }]) {
    assert.throws(() => parseAdminListQuery(query), InvalidAdminInput);
  }
  const result = serializeAdminRestaurant({ _id: new mongoose.Types.ObjectId(),
    name: 'A', slug: 'a', currency: 'EGP', status: 'active', secret: 'never' },
  { _id: new mongoose.Types.ObjectId(), email: 'a@example.test', name: 'Owner',
    isActive: true, passwordHash: 'never' });
  assert.equal(JSON.stringify(result).includes('never'), false);
  assert.equal(result.storefrontTheme, 'savora-classic');
});

test('admin theme assignments accept four shipped themes and default legacy records', async () => {
  const Restaurant = (await import('../src/models/Restaurant.js')).default;
  assert.equal(new Restaurant({ name: 'A', slug: 'a', currency: 'EGP' }).storefrontTheme,
    'savora-classic');
  await assert.doesNotReject(new Restaurant({ name: 'B', slug: 'b', currency: 'EGP',
    storefrontTheme: 'savora-aqua' }).validate());
  await assert.doesNotReject(new Restaurant({ name: 'Cafe', slug: 'cafe', currency: 'EGP',
    storefrontTheme: 'savora-cafe' }).validate());
  await assert.doesNotReject(new Restaurant({ name: 'Luxury', slug: 'luxury', currency: 'EGP',
    storefrontTheme: 'savora-luxury' }).validate());
  assert.equal(serializeAdminRestaurant({ _id: new mongoose.Types.ObjectId(),
    name: 'Legacy', slug: 'legacy', currency: 'EGP' }).storefrontTheme, 'savora-classic');
  await assert.rejects(createPlatformRestaurant(null, new mongoose.Types.ObjectId(), {
    restaurant: { name: 'Bad', slug: 'bad', currency: 'EGP', storefrontTheme: 'savora-luxury-dark' },
    owner: { name: 'Owner', email: 'owner@example.test', password: 'Safe password 123!' },
  }), InvalidAdminInput);
  await assert.rejects(changeRestaurantTheme(null, new mongoose.Types.ObjectId(),
    String(new mongoose.Types.ObjectId()), 'savora-luxury-dark'), InvalidAdminInput);
});

test('admin routes reject public and Owner cookies before database reads', async () => {
  const app = createApp({ connection: { readyState: 0 },
    allowedOrigins: 'https://dashboard.example.test', secureCookies: true,
    adminLoginLimiter: createLoginLimiter({ maxAttempts: 1 }) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/api/admin/auth/me', '/api/admin/overview', '/api/admin/restaurants']) {
      const response = await fetch(`${base}${path}`, { headers: {
        Cookie: 'savora_owner_session=' + 'a'.repeat(64) } });
      assert.equal(response.status, 401);
    }
    const body = JSON.stringify({ restaurant: {}, owner: {} });
    const blocked = await fetch(`${base}/api/admin/restaurants`, { method: 'POST',
      headers: { Origin: 'https://evil.example.test', Cookie: 'savora_owner_session=' + 'a'.repeat(64),
        'Content-Type': 'application/json' }, body });
    assert.equal(blocked.status, 401);
    assert.equal((await fetch(`${base}/api/admin/restaurants/${new mongoose.Types.ObjectId()}/theme`, {
      method: 'PATCH', headers: { Origin: 'https://dashboard.example.test',
        Cookie: 'savora_owner_session=' + 'a'.repeat(64), 'Content-Type': 'application/json' },
      body: JSON.stringify({ storefrontTheme: 'savora-aqua' }) })).status, 401);
    const login = () => fetch(`${base}/api/admin/auth/login`, { method: 'POST',
      headers: { Origin: 'https://dashboard.example.test', 'X-Savora-CSRF': '1',
        'Content-Type': 'application/json' }, body: JSON.stringify({
          email: 'a@example.test', password: 'Wrong password 123!' }) });
    assert.equal((await login()).status, 503); // DB unavailable after input and limiter.
    assert.equal((await login()).status, 429);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
