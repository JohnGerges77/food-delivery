import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { serverConfig, startServer } from '../src/server.js';

test('startup requires Node 24 configuration and never falls back to test MongoDB', () => {
  assert.throws(() => serverConfig({ MONGODB_TEST_URI: 'test-only',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:3000' }), /MONGODB_URI is required/);
  assert.throws(() => serverConfig({ MONGODB_URI: 'mongodb://example.invalid/savora_dev' }),
    /AUTH_TRUSTED_ORIGINS is required/);
  assert.throws(() => serverConfig({ MONGODB_URI: 'uri',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:3000', PORT: '0' }), /PORT/);
  assert.throws(() => serverConfig({ MONGODB_URI: 'uri',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:3000', TRUST_PROXY_HOPS: '-1' }),
  /TRUST_PROXY_HOPS/);
});

test('missing runtime configuration exits safely before listening or connecting', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, MONGODB_URI: '', MONGODB_TEST_URI: 'test-only',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      DOTENV_CONFIG_PATH: '__savora_no_env_file__.env' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Startup failed: MONGODB_URI is required/);
  assert.doesNotMatch(result.stdout, /listening|MongoDB connected/);
});

test('startup validates origins before connecting and listens after connection', async () => {
  let connected = false;
  await assert.rejects(startServer({ env: { MONGODB_URI: 'test-only',
    AUTH_TRUSTED_ORIGINS: 'https://dashboard.example.test', NODE_ENV: 'production' },
  connect: async () => { connected = true; },
  makeApp: () => { throw new Error('Invalid AUTH_TRUSTED_ORIGINS'); } }),
  /Invalid AUTH_TRUSTED_ORIGINS/);
  assert.equal(connected, false);

  let config;
  const server = await startServer({ env: { MONGODB_URI: 'test-only',
    AUTH_TRUSTED_ORIGINS: 'https://dashboard.example.test', NODE_ENV: 'production' },
  connect: async (uri) => { assert.equal(uri, 'test-only'); connected = true; },
  makeApp: (options) => {
    config = options;
    return { listen: () => http.createServer((_req, res) => res.end('ok'))
      .listen(0, '127.0.0.1') };
  } });
  try {
    assert.equal(connected, true);
    assert.equal(config.secureCookies, true);
    assert.equal(config.allowedOrigins, 'https://dashboard.example.test');
    assert.equal(config.trustProxyHops, 0);
    assert.equal(server.requestTimeout, 60_000);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('health reflects database readiness and API responses carry safe headers', async () => {
  const connection = { readyState: 0 };
  const server = createApp({ connection, allowedOrigins: 'http://localhost:3000' })
    .listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const unavailable = await fetch(`${base}/api/health`);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
    assert.equal(unavailable.headers.get('x-powered-by'), null);
    assert.equal(unavailable.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(unavailable.headers.get('x-frame-options'), 'DENY');
    connection.readyState = 1;
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Not found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('occupied port fails startup cleanly', async () => {
  const occupied = http.createServer().listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => occupied.once('listening', resolve));
    await assert.rejects(startServer({ env: { MONGODB_URI: 'test-only',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
      PORT: String(occupied.address().port) },
    connect: async () => {}, makeApp: () => ({ listen: (port) =>
      http.createServer().listen(port, '127.0.0.1') }) }),
    (error) => error.code === 'EADDRINUSE');
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
