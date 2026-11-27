import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicCatalogCache } from "../src/services/public-catalog-cache.ts";

test("coalesces catalog reads, isolates tenant and locale, and expires without serving stale data", async () => {
  let time = 0;
  let calls = 0;
  const read = createPublicCatalogCache({ ttl: 5, now: () => time });
  const load = async () => ++calls;
  const key = ["a", "ar", "products"];

  assert.deepEqual(await Promise.all([read(key, load), read(key, load)]), [1, 1]);
  assert.equal(await read(["b", "ar", "products"], load), 2);
  assert.equal(await read(["a", "en", "products"], load), 3);
  time = 5;
  assert.equal(await read(key, load), 4);
});

test("does not retain failures and bounds the number of cached entries", async () => {
  const read = createPublicCatalogCache({ maxEntries: 1 });
  await assert.rejects(read(["a"], async () => { throw Error("upstream"); }), /upstream/);
  assert.equal(await read(["a"], async () => 1), 1);
  assert.equal(await read(["b"], async () => 2), 2);
  assert.equal(await read(["a"], async () => 3), 3);
});
