import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import entry, { stagingConfig } from '../src/index.js';
import { createApp } from '../src/app.js';

const valid = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'codex/savora-staging-preview',
  VERCEL_URL: 'food-delivery-abc123.vercel.app',
  MONGODB_URI: 'mongodb+srv://savora_staging_user:example@cluster.example/savora_staging',
};

test('staging accepts only its exact Preview origin and database', () => {
  assert.equal(stagingConfig(valid).allowedOrigins,
    'https://food-delivery-abc123.vercel.app');
  for (const change of [
    { VERCEL_ENV: 'production' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_URL: 'attacker.example' },
    { AUTH_TRUSTED_ORIGINS: 'https://other.vercel.app' },
    { MONGODB_URI: 'mongodb+srv://savora_dev_user:example@cluster.example/savora_dev' },
    { MONGODB_URI: 'mongodb+srv://savora_test_user:example@cluster.example/savora_test' },
    { MONGODB_URI: 'mongodb+srv://savora_staging_user:example@cluster.example/savora_staging?dbName=savora_dev' },
    { MONGODB_URI: 'mongodb+srv://savora_dev_user:example@cluster.example/savora_staging' },
  ]) {
    assert.throws(() => stagingConfig({ ...valid, ...change }));
  }
});

test('staging trusts the Vercel deployment and branch origins, but no other Origin', async () => {
  const branchUrl = 'food-delivery-git-codex-savora-stag-95d85a-john-gerges-projects.vercel.app';
  const deploymentOrigin = `https://${valid.VERCEL_URL}`;
  const branchOrigin = `https://${branchUrl}`;
  const config = stagingConfig({ ...valid, VERCEL_BRANCH_URL: branchUrl,
    AUTH_TRUSTED_ORIGINS: branchOrigin });
  assert.equal(config.allowedOrigins, `${deploymentOrigin},${branchOrigin}`);
  for (const change of [
    { VERCEL_BRANCH_URL: 'other.example' },
    { VERCEL_BRANCH_URL: 'food-delivery.vercel.app' },
    { AUTH_TRUSTED_ORIGINS: 'https://other.vercel.app' },
    { AUTH_TRUSTED_ORIGINS: 'http://food-delivery-git-codex-savora-stag-95d85a-john-gerges-projects.vercel.app' },
  ]) {
    assert.throws(() => stagingConfig({ ...valid, VERCEL_BRANCH_URL: branchUrl,
      AUTH_TRUSTED_ORIGINS: branchOrigin, ...change }));
  }
  assert.throws(() => stagingConfig({ ...valid, AUTH_TRUSTED_ORIGINS: branchOrigin }));

  const app = createApp({ allowedOrigins: config.allowedOrigins, secureCookies: true });
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/admin/auth/login`;
    const request = (origin) => fetch(url, { method: 'POST',
      headers: { Origin: origin, 'X-Savora-CSRF': '1', 'Content-Type': 'application/json' },
      body: '{}' });
    assert.equal((await request(branchOrigin)).status, 401);
    assert.equal((await request(deploymentOrigin)).status, 401);
    assert.equal((await request('https://other.vercel.app')).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('staging handler fails closed before a database connection when configuration is absent', async () => {
  const server = entry.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Service unavailable' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
