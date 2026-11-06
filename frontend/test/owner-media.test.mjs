import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getOwnerMediaAvailability } from '../src/services/owner-media-service.ts';

const originalFetch = globalThis.fetch;
process.env.SAVORA_INTERNAL_API_URL = 'http://localhost:5000';
afterEach(() => { globalThis.fetch = originalFetch; });

test('media availability uses the authenticated owner endpoint and fails closed', async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).endsWith('/api/owner/media/capabilities'));
    assert.equal(options.credentials, 'include');
    return new Response(JSON.stringify({ available: false }), { status: 200 });
  };
  assert.equal(await getOwnerMediaAvailability(), false);
  globalThis.fetch = async () => new Response(JSON.stringify({ available: true }), { status: 200 });
  assert.equal(await getOwnerMediaAvailability(), true);
  globalThis.fetch = async () => new Response(JSON.stringify({ available: 'yes' }), { status: 200 });
  await assert.rejects(getOwnerMediaAvailability(), /Invalid media availability response/);
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  await assert.rejects(getOwnerMediaAvailability());
});
