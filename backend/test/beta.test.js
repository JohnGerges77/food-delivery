import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { betaConfig, vercelConfig, createVercelEntry } from '../src/index.js';
import { createApp } from '../src/app.js';

const valid = { VERCEL_ENV: 'production', NODE_ENV: 'production',
  VERCEL_GIT_COMMIT_REF: 'main', SAVORA_DEPLOYMENT_MODE: 'beta',
  VERCEL_URL: 'savora-build123.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'savora.vercel.app',
  AUTH_TRUSTED_ORIGINS: 'https://savora.vercel.app',
  MONGODB_URI: 'mongodb+srv://savora_beta_user:synthetic@cluster.example/savora_beta?retryWrites=true&w=majority' };
async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('Production beta requires explicit mode and main; checkout defaults off', () => {
  const config = vercelConfig(valid);
  assert.equal(config.databaseName, 'savora_beta');
  assert.equal(config.checkoutEnabled, false);
  assert.equal(config.allowedOrigins, 'https://savora.vercel.app,https://savora-build123.vercel.app');
  assert.equal(betaConfig({ ...valid, SAVORA_BETA_CHECKOUT_ENABLED: 'true' }).checkoutEnabled, true);
  for (const change of [{ SAVORA_DEPLOYMENT_MODE: undefined }, { SAVORA_DEPLOYMENT_MODE: 'staging' },
    { NODE_ENV: 'development' }, { VERCEL_GIT_COMMIT_REF: 'codex/savora-staging-preview' },
    { VERCEL_ENV: 'development' }, { VERCEL_ENV: 'preview' }, { SAVORA_BETA_CHECKOUT_ENABLED: '1' },
    { MEDIA_STORAGE_PROVIDER: 'local' }, { UPLOADS_DIR: '/tmp/uploads' }]) {
    assert.throws(() => vercelConfig({ ...valid, ...change }));
  }
});

test('beta rejects absent credentials, other databases, staging users and unsafe URI overrides', () => {
  for (const uri of [undefined, '', 'not a uri',
    'mongodb+srv://savora_beta_user@cluster.example/savora_beta',
    'mongodb+srv://savora_beta_user:synthetic@cluster.example/',
    ...['savora_staging', 'savora_dev', 'savora_test', 'SAVORA_BETA'].map(db => `mongodb+srv://savora_beta_user:synthetic@cluster.example/${db}`),
    'mongodb+srv://savora_staging_user:synthetic@cluster.example/savora_beta',
    ...['dbName=savora_staging', 'DBNAME=savora_test', 'tls=false', 'tlsInsecure=true', 'tlsAllowInvalidCertificates=true',
      'w=0', 'authSource=savora_staging', 'w=majority&W=majority'].map(q => `mongodb+srv://savora_beta_user:synthetic@cluster.example/savora_beta?${q}`)]) {
    assert.throws(() => betaConfig({ ...valid, MONGODB_URI: uri }));
  }
});

test('beta trusted origins are exact HTTPS Production origin; no wildcard or preview substitution', () => {
  for (const value of [undefined, '*', 'http://savora.vercel.app', 'https://savora.vercel.app/',
    'https://savora.vercel.app,https://other.vercel.app', 'https://other.vercel.app']) {
    assert.throws(() => betaConfig({ ...valid, AUTH_TRUSTED_ORIGINS: value }));
  }
  for (const hostname of [undefined, 'https://savora.vercel.app', 'savora.vercel.app/path', 'savora.vercel.app:443']) {
    assert.throws(() => betaConfig({ ...valid, VERCEL_PROJECT_PRODUCTION_URL: hostname }));
  }
});

test('missing Production configuration never connects or constructs the application', async () => {
  await serve(createVercelEntry({ env: { ...valid, MONGODB_URI: undefined },
    connect: () => assert.fail('must not connect'), makeApp: () => assert.fail('must not construct app') }), async base => {
    const r = await fetch(base + '/api/health');
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'Service unavailable' });
  });
});

test('effective wrong database after connect is disconnected before application writes', async () => {
  for (const db of ['savora_staging', 'savora_test', 'savora_dev', undefined]) {
    const connection = { readyState: 0 }; let disconnected = false;
    const app = createVercelEntry({ env: valid, connection,
      connect: async (_uri, options) => {
        assert.equal(options.autoIndex, false); assert.equal(options.autoCreate, false);
        connection.readyState = 1; connection.db = { databaseName: db };
      }, disconnect: async () => { disconnected = true; connection.readyState = 0; },
      makeApp: () => assert.fail('must not construct app') });
    await serve(app, async base => assert.equal((await fetch(base + '/api/public/restaurants/demo/orders', { method: 'POST' })).status, 503));
    assert.equal(disconnected, true);
  }
});

test('pre-existing wrong connection is never reused; effective name is checked on every request', async () => {
  const connection = { readyState: 1, db: { databaseName: 'savora_staging' } };
  await serve(createVercelEntry({ env: valid, connection,
    connect: () => assert.fail('no reconnect to disguise mismatch'), makeApp: () => assert.fail('no writes') }), async base => {
    assert.equal((await fetch(base + '/api/health')).status, 503);
  });
});

test('Production startup shares one connect; constructs app only after beta identity is verified', async () => {
  const connection = { readyState: 0 }; let connects = 0; let constructions = 0;
  const app = createVercelEntry({ env: valid, connection, checkIndexes: async () => [], connect: async () => {
    connects++; await new Promise(resolve => setTimeout(resolve, 10));
    connection.readyState = 1; connection.db = { databaseName: 'savora_beta' };
  }, makeApp: options => {
    constructions++; assert.equal(options.secureCookies, true); assert.equal(options.checkoutEnabled, false);
    assert.equal(options.mediaStorage, null); assert.equal(options.checkoutLimit, 10);
    assert.equal(options.betaCheckout, true);
    return createApp(options);
  } });
  await serve(app, async base => {
    const results = await Promise.all([fetch(base + '/api/health'), fetch(base + '/api/health')]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(connects, 1); assert.equal(constructions, 1);
    assert.equal((await fetch(base + '/api/owner/restaurant')).status, 401);
    assert.equal((await fetch(base + '/api/admin/restaurants')).status, 401);
    connection.db.databaseName = 'savora_staging';
    assert.equal((await fetch(base + '/api/health')).status, 503);
  });
});

test('beta checkout kill switch, exact Origin and lower instance-local limit fail before persistence', async () => {
  const connection = { readyState: 0 };
  const request = (base, origin) => fetch(base + '/api/public/restaurants/demo/orders', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  await serve(createApp({ connection, checkoutEnabled: false }), async base => {
    assert.equal((await request(base, 'https://savora.vercel.app')).status, 503);
  });
  await serve(createApp({ connection, checkoutAllowedOrigins: ['https://savora.vercel.app'], checkoutLimit: 1 }), async base => {
    assert.equal((await request(base, 'https://other.example')).status, 403);
    assert.equal((await request(base, 'https://savora.vercel.app')).status, 400);
    assert.equal((await request(base, 'https://savora.vercel.app')).status, 429);
  });
});

test('connection failure can retry without exposing driver errors or credentials', async () => {
  let attempts = 0;
  await serve(createVercelEntry({ env: valid, connection: { readyState: 0 },
    connect: async () => { attempts++; throw Error('synthetic private driver detail'); }, disconnect: async () => {} }), async base => {
    for (let i = 0; i < 2; i++) {
      const r = await fetch(base + '/api/health'); assert.equal(r.status, 503);
      assert.deepEqual(await r.json(), { error: 'Service unavailable' });
    }
    assert.equal(attempts, 2);
  });
});

test('missing or conflicting beta indexes block all app routes without creating indexes', async () => {
  const connection = { readyState: 1, db: { databaseName: 'savora_beta' } };
  for (const findings of [[{ issue: 'missing' }], [{ issue: 'conflicting unique' }]]) {
    await serve(createVercelEntry({ env: valid, connection, checkIndexes: async () => findings,
      makeApp: () => assert.fail('missing index must block application') }), async base => {
      assert.equal((await fetch(base + '/api/health')).status, 503);
    });
  }
});


test('beta public browsing works while both order submission methods are gated off', async () => {
  const restaurant = { _id: '507f1f77bcf86cd799439011', name: 'Synthetic Beta', slug: 'demo', currency: 'EGP',
    socialLinks: { whatsapp: 'https://wa.me/12025550100' } };
  const connection = { readyState: 1, db: { databaseName: 'savora_beta' }, models: {
    Restaurant: { findOne: () => ({ select: () => ({ lean: async () => restaurant }) }) }, Product: {}, Category: {},
  } };
  await serve(createVercelEntry({ env: valid, connection, checkIndexes: async () => [] }), async base => {
    const result = await fetch(base + '/api/public/restaurants/demo');
    assert.equal(result.status, 200);
    const dto = (await result.json()).restaurant;
    assert.equal(dto.slug, 'demo');
    assert.equal(dto.socialLinks.whatsapp, null);
    for (const submissionMethod of ['direct', 'whatsapp']) {
      const response = await fetch(base + '/api/public/restaurants/demo/orders', { method: 'POST',
        headers: { Origin: valid.AUTH_TRUSTED_ORIGINS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionMethod }) });
      assert.equal(response.status, 503);
    }
  });
});

test('enabled beta rejects WhatsApp and supplied personal data before reaching the database', async () => {
  await serve(createApp({ connection: { readyState: 0 }, betaCheckout: true }), async base => {
    const items = [{ productId: '507f1f77bcf86cd799439012', quantity: 1 }];
    for (const body of [
      { submissionMethod: 'whatsapp', items },
      { submissionMethod: 'direct', items, customerName: 'Untrusted' },
      { submissionMethod: 'direct', items: [{ ...items[0], notes: 'Untrusted' }] },
    ]) {
      const response = await fetch(base + '/api/public/restaurants/demo/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'beta-qa-synthetic-request' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'Invalid checkout' });
    }
  });
});
