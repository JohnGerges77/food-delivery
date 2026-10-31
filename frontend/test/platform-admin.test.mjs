import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createAdminRestaurant, adminRestaurants, logoutAdmin,
  setAdminRestaurantStatus, setAdminRestaurantTheme, PlatformApiError, clearAdminCsrf } from '../src/services/platform-admin-service.ts';
import { usePlatformAdmin } from '../src/store/platform-admin-store.ts';

process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = 'http://localhost:5000';
const previousFetch = globalThis.fetch;
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => {
  globalThis.fetch = previousFetch;
  clearAdminCsrf();
  usePlatformAdmin.setState({ status: 'loading', admin: null });
});

test('Admin login uses isolated endpoints, cookies and no browser storage', async () => {
  globalThis.localStorage = { setItem() { throw new Error('storage forbidden'); } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/admin/auth/login');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.get('X-Savora-CSRF'), '1');
    return response({ admin: { id: 'id', email: 'admin@example.test' } });
  };
  await usePlatformAdmin.getState().login(' Admin@Example.test ', 'abcdefghijkl');
  assert.equal(usePlatformAdmin.getState().status, 'authenticated');
  assert.equal(usePlatformAdmin.getState().admin.email, 'admin@example.test');
});

test('Admin restoration rejects an Owner-only browser session', async () => {
  globalThis.fetch = async () => response({ error: 'Unauthorized' }, 401);
  await usePlatformAdmin.getState().restore();
  assert.equal(usePlatformAdmin.getState().status, 'unauthenticated');
  assert.equal(usePlatformAdmin.getState().admin, null);
});

test('Admin list encodes search and respects bounded pagination request', async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, 'http://localhost:5000/api/admin/restaurants?page=2&limit=20&search=caf%C3%A9%20%26');
    return response({ restaurants: [], page: 2, limit: 20, total: 0 });
  };
  assert.equal((await adminRestaurants(2, 'café &')).total, 0);
});

test('Creation and suspension bootstrap Admin CSRF and never store a password', async () => {
  const calls = [];
  globalThis.localStorage = { setItem() { throw new Error('storage forbidden'); } };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return response({ csrfToken: 'a'.repeat(64) });
    return response({ restaurant: { id: 'abc', status: 'active' } }, options.method === 'POST' ? 201 : 200);
  };
  await createAdminRestaurant({ restaurant: { name: 'Cafe', slug: 'cafe', currency: 'EGP' },
    owner: { name: 'Owner', email: 'owner@example.test', password: 'abcdefghijkl' } });
  await setAdminRestaurantStatus('abc', 'suspended');
  assert.equal(calls.length, 3);
  assert.equal(calls[1].options.headers.get('X-Savora-CSRF'), 'a'.repeat(64));
  assert.equal(calls[2].options.headers.get('X-Savora-CSRF'), 'a'.repeat(64));
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(JSON.parse(calls[2].options.body).status, 'suspended');
});

test('theme assignment uses the Admin namespace and CSRF', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return response({ csrfToken: 'a'.repeat(64) });
    return response({ restaurant: { id: 'abc', storefrontTheme: 'savora-aqua' } });
  };
  const result = await setAdminRestaurantTheme('abc', 'savora-aqua');
  assert.equal(result.restaurant.storefrontTheme, 'savora-aqua');
  assert.equal(calls[1].url, 'http://localhost:5000/api/admin/restaurants/abc/theme');
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(calls[1].options.headers.get('X-Savora-CSRF'), 'a'.repeat(64));
  assert.deepEqual(JSON.parse(calls[1].options.body), { storefrontTheme: 'savora-aqua' });
});

test('Cafe theme assignment uses the same Admin CSRF flow', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return response({ csrfToken: 'b'.repeat(64) });
    return response({ restaurant: { id: 'abc', storefrontTheme: 'savora-cafe' } });
  };
  const result = await setAdminRestaurantTheme('abc', 'savora-cafe');
  assert.equal(result.restaurant.storefrontTheme, 'savora-cafe');
  assert.equal(calls[1].options.headers.get('X-Savora-CSRF'), 'b'.repeat(64));
  assert.deepEqual(JSON.parse(calls[1].options.body), { storefrontTheme: 'savora-cafe' });
});

test('Luxury theme assignment uses the same Admin CSRF flow', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return response({ csrfToken: 'c'.repeat(64) });
    return response({ restaurant: { id: 'abc', storefrontTheme: 'savora-luxury' } });
  };
  const result = await setAdminRestaurantTheme('abc', 'savora-luxury');
  assert.equal(result.restaurant.storefrontTheme, 'savora-luxury');
  assert.equal(calls[1].options.headers.get('X-Savora-CSRF'), 'c'.repeat(64));
  assert.deepEqual(JSON.parse(calls[1].options.body), { storefrontTheme: 'savora-luxury' });
});

test('Conflict and logout errors remain explicit', async () => {
  globalThis.fetch = async () => response({ error: 'Duplicate' }, 409);
  await assert.rejects(setAdminRestaurantStatus('abc', 'active'),
    (error) => error instanceof PlatformApiError && error.status === 409);
  await assert.rejects(logoutAdmin(), PlatformApiError);
});
