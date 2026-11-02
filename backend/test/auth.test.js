import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import OwnerSession from '../src/models/OwnerSession.js';
import { createAuthGuards, createLoginLimiter, sessionCookies } from '../src/routes/auth.js';
import { tokenHash } from '../src/services/ownerAuth.js';

const origin = 'http://localhost:3000';

async function withApp(options, run) {
  const server = createApp({ allowedOrigins: origin, ...options }).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function login(url, { requestOrigin = origin, body = '{}', csrf = '1' } = {}) {
  return fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'X-Savora-CSRF': csrf },
    body,
  });
}

test('OwnerSession declares hashed fields and an expiry TTL index', () => {
  assert.equal(OwnerSession.schema.path('tokenHash').options.select, false);
  assert.equal(OwnerSession.schema.path('csrfTokenHash').options.select, false);
  assert.ok(OwnerSession.schema.indexes().some(([key, options]) =>
    key.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(OwnerSession.schema.indexes().some(([key, options]) =>
    key.tokenHash === 1 && options.unique === true));
  const session = new OwnerSession({ tokenHash: 'hash', csrfTokenHash: 'csrf-hash' });
  assert.equal(session.toJSON().tokenHash, undefined);
  assert.equal(session.toObject().csrfTokenHash, undefined);
  assert.match(tokenHash('test-token'), /^[0-9a-f]{64}$/);
  assert.notEqual(tokenHash('test-token'), 'test-token');
});

test('session cookie is HttpOnly, Secure in production, SameSite Lax, and API scoped', () => {
  const [session, csrf] = sessionCookies('a'.repeat(64), 'b'.repeat(64), true);
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api', 'Max-Age=604800']) {
    assert.ok(session.includes(attribute));
  }
  assert.ok(csrf.includes('Secure'));
  assert.ok(!csrf.includes('HttpOnly'));
  assert.ok(!sessionCookies('a'.repeat(64), 'b'.repeat(64), false)[0].includes('Secure'));
});

test('CSRF read accepts a trusted Referer on no-Origin GET without relaxing mutation Origin', () => {
  const trusted = 'https://staging.example.test';
  const { trustedCsrfReadOrigin, trustedMutationOrigin } = createAuthGuards({
    allowedOrigins: trusted, secureCookies: true });
  function status(guard, headers) {
    let result = 200;
    const req = { get: (name) => headers[name.toLowerCase()] };
    const res = { status(code) { result = code; return this; }, json() {} };
    guard(req, res, () => {});
    return result;
  }
  const sameOriginGet = { referer: `${trusted}/en/admin/restaurants`,
    'sec-fetch-site': 'same-origin' };
  assert.equal(status(trustedCsrfReadOrigin, sameOriginGet), 200);
  assert.equal(status(trustedCsrfReadOrigin, { origin: trusted }), 200);
  assert.equal(status(trustedCsrfReadOrigin, { ...sameOriginGet,
    origin: 'https://evil.example.test' }), 403);
  assert.equal(status(trustedCsrfReadOrigin, { ...sameOriginGet,
    'sec-fetch-site': 'cross-site' }), 403);
  assert.equal(status(trustedCsrfReadOrigin, { referer: 'https://evil.example.test/page',
    'sec-fetch-site': 'same-origin' }), 403);
  assert.equal(status(trustedCsrfReadOrigin, { referer: 'https://staging.example.test.evil.test/' }), 403);
  assert.equal(status(trustedCsrfReadOrigin, { 'sec-fetch-site': 'same-origin' }), 403);
  assert.equal(status(trustedMutationOrigin, sameOriginGet), 403);
  assert.equal(status(trustedMutationOrigin, { origin: trusted }), 200);
});

test('auth routes reject untrusted origins, missing CSRF header, and malformed input', async () => {
  await withApp({}, async (url) => {
    const preflight = await fetch(`${url}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');

    const untrusted = await login(url, { requestOrigin: 'https://other.example.test' });
    assert.equal(untrusted.status, 403);
    assert.equal(untrusted.headers.get('access-control-allow-origin'), null);

    const noCsrf = await login(url, { csrf: '' });
    assert.equal(noCsrf.status, 401);
    assert.deepEqual(await noCsrf.json(), { error: 'Invalid credentials' });

    const malformed = await login(url, { body: '{' });
    assert.equal(malformed.status, 400);
    const oversized = await login(url, { body: JSON.stringify({ padding: 'x'.repeat(5000) }) });
    assert.equal(oversized.status, 413);

    const unauthenticated = await fetch(`${url}/api/auth/me`);
    assert.equal(unauthenticated.status, 401);
    const invalidCookie = await fetch(`${url}/api/auth/me`, {
      headers: { Cookie: 'savora_owner_session=invalid' },
    });
    assert.equal(invalidCookie.status, 401);
    assert.ok(invalidCookie.headers.getSetCookie().some((value) => value.includes('Max-Age=0')));
  });
});

test('missing trusted-origin configuration fails closed', async () => {
  await withApp({ allowedOrigins: '' }, async (url) => {
    assert.equal((await login(url)).status, 403);
  });
});

test('login rate limiter has a bounded attempt window and returns Retry-After', async () => {
  let time = 0;
  const loginLimiter = createLoginLimiter({ maxAttempts: 2, windowMs: 1000, now: () => time });
  await withApp({ loginLimiter }, async (url) => {
    assert.equal((await login(url)).status, 401);
    assert.equal((await login(url)).status, 401);
    const blocked = await login(url);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '1');
    time = 1001;
    assert.equal((await login(url)).status, 401);
  });
});
