import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, clearCsrfToken } from "../src/services/api-client.ts";
import { allOwnerCategories, categoryPatch, categoryToForm, categoryWrite, createOwnerCategory, deleteOwnerCategory,
  getOwnerCategory, listOwnerCategories, patchOwnerCategory, validateCategoryForm } from "../src/services/owner-categories-service.ts";

const originalFetch = globalThis.fetch;
const token = "a".repeat(64);
const id = "507f1f77bcf86cd799439011";
process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";

function category(override = {}) {
  return { id, name: "Burgers", slug: "burgers", description: null, imageUrl: null,
    sortOrder: 0, isActive: true, ...override };
}
function json(body, status = 200) { return new Response(JSON.stringify(body), { status }); }
afterEach(() => { globalThis.fetch = originalFetch; clearCsrfToken(); });

test("GET list and detail map DTO, preserve empty values, credentials, pagination and sort", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith(id) ? json({ category: category() }) :
      json({ categories: [category()], pagination: { page: 2, limit: 12, total: 13, hasNext: false } });
  };
  const list = await listOwnerCategories({ page: 2, limit: 12, sort: "-sortOrder" });
  assert.equal(list.categories[0].imageUrl, null);
  assert.equal(categoryToForm(list.categories[0]).imageUrl, "");
  assert.deepEqual(list.pagination, { page: 2, limit: 12, total: 13, hasNext: false });
  assert.match(calls[0].url, /page=2&limit=12&sort=-sortOrder$/);
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.cache, "no-store");
  assert.deepEqual(await getOwnerCategory(id), category());
});

test("Product category selection can retrieve every bounded owner Category page", async () => {
  globalThis.fetch = async (url) => {
    const page = new URL(url).searchParams.get("page");
    return json({ categories: [category({ id: page === "1" ? id : "507f1f77bcf86cd799439099" })],
      pagination: { page: Number(page), limit: 100, total: 101, hasNext: page === "1" } });
  };
  const result = await allOwnerCategories();
  assert.equal(result.length, 2);
  assert.notEqual(result[0].id, result[1].id);
});

test("empty owner Category list remains empty", async () => {
  globalThis.fetch = async () => json({ categories: [], pagination: { page: 1, limit: 12, total: 0, hasNext: false } });
  assert.deepEqual((await listOwnerCategories()).categories, []);
});

test("create sends explicit writable fields with CSRF and uses canonical response", async () => {
  const form = { ...categoryToForm(), name: "Pizza", slug: "pizza", sortOrder: "4", isActive: false };
  const body = categoryWrite(form);
  assert.deepEqual(body, { name: "Pizza", slug: "pizza", description: "", imageUrl: "", sortOrder: 4, isActive: false });
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    assert.equal(url, "http://localhost:5000/api/owner/categories");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Savora-CSRF"), token);
    assert.deepEqual(JSON.parse(options.body), body);
    return json({ category: category({ name: "Pizza", slug: "pizza", sortOrder: 4, isActive: false }) }, 201);
  };
  const result = await createOwnerCategory(body);
  assert.equal(result.id, id);
  assert.equal(result.isActive, false);
  assert.equal(calls, 2);
});

test("edit preserves existing slug when name changes; active toggle and 409 are server-confirmed", async () => {
  const original = category();
  const patch = categoryPatch({ ...categoryToForm(original), name: "New Burgers", isActive: false }, original);
  assert.deepEqual(patch, { name: "New Burgers", isActive: false });
  let mutationCount = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    mutationCount++;
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("X-Savora-CSRF"), token);
    if (mutationCount === 1) return json({ error: "Category slug already exists" }, 409);
    return json({ category: category({ ...patch }) });
  };
  await assert.rejects(patchOwnerCategory(id, { slug: "taken" }),
    (error) => error instanceof ApiError && error.status === 409);
  const updated = await patchOwnerCategory(id, patch);
  assert.equal(updated.name, "New Burgers");
  assert.equal(updated.slug, "burgers");
  assert.equal(updated.isActive, false);
});

test("delete retains Category on Product-reference 409 and confirms 204 success", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    assert.equal(options.method, "DELETE");
    calls++;
    return calls === 1 ? json({ error: "Category has products" }, 409) : new Response(null, { status: 204 });
  };
  await assert.rejects(deleteOwnerCategory(id), (error) => error instanceof ApiError && error.status === 409);
  await assert.doesNotReject(deleteOwnerCategory(id));
  assert.equal(calls, 2);
});

test("validation, expired session, network and timeout failures do not produce fixture data", async () => {
  const form = { ...categoryToForm(), name: " ", slug: "bad slug", imageUrl: "javascript:bad", sortOrder: "-1" };
  const errors = validateCategoryForm(form);
  assert.deepEqual(Object.keys(errors).sort(), ["imageUrl", "name", "slug", "sortOrder"]);
  assert.throws(() => categoryWrite(form));
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await assert.rejects(listOwnerCategories(), (error) => error instanceof ApiError && error.status === 401);
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(listOwnerCategories(), (error) => error instanceof ApiError && error.status === null);
  globalThis.fetch = async () => { throw new DOMException("timeout", "TimeoutError"); };
  await assert.rejects(listOwnerCategories(), /Request timed out/);
  globalThis.fetch = async () => json({ categories: [{ name: "fixture?" }], pagination: {} });
  await assert.rejects(listOwnerCategories(), /Invalid server response/);
});
