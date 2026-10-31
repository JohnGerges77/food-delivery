import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, clearCsrfToken } from "../src/services/api-client.ts";
import { createOwnerProduct, deleteOwnerProduct, formatOwnerPrice, getOwnerProduct, listOwnerProducts,
  patchOwnerProduct, productPatch, productToForm, productWrite, validateProductForm } from "../src/services/owner-products-service.ts";

const originalFetch = globalThis.fetch;
const token = "b".repeat(64);
const id = "507f1f77bcf86cd799439012";
const categoryId = "507f1f77bcf86cd799439011";
const secondCategoryId = "507f1f77bcf86cd799439013";
const categories = [
  { id: categoryId, name: "Burgers", slug: "burgers", description: null, imageUrl: null, sortOrder: 0, isActive: true },
  { id: secondCategoryId, name: "Drafts", slug: "drafts", description: null, imageUrl: null, sortOrder: 1, isActive: false },
];
process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";

function product(override = {}) {
  return { id, name: "Burger", slug: "burger", categoryId, description: null, price: 0,
    oldPrice: null, imageUrl: null, images: [], isAvailable: true, isFeatured: false,
    preparationTime: null, calories: null, ...override };
}
function json(body, status = 200) { return new Response(JSON.stringify(body), { status }); }
afterEach(() => { globalThis.fetch = originalFetch; clearCsrfToken(); });

test("GET mapping keeps zero, missing images, real category IDs, filters and pagination", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith(id) ? json({ product: product() }) :
      json({ products: [product()], pagination: { page: 2, limit: 12, total: 13, hasNext: false } });
  };
  const result = await listOwnerProducts({ page: 2, limit: 12, categoryId, isAvailable: false, isFeatured: true, sort: "price" });
  assert.equal(result.products[0].price, 0);
  assert.equal(productToForm(result.products[0]).price, "0");
  assert.equal(productToForm(result.products[0]).imageUrl, "");
  assert.equal(productToForm(result.products[0]).images, "");
  assert.match(calls[0].url, /page=2&limit=12&sort=price&categoryId=507f1f77bcf86cd799439011&isAvailable=false&isFeatured=true$/);
  assert.equal(calls[0].options.credentials, "include");
  assert.deepEqual(result.pagination, { page: 2, limit: 12, total: 13, hasNext: false });
  assert.deepEqual(await getOwnerProduct(id), product());
});

test("empty owner Product list remains empty", async () => {
  globalThis.fetch = async () => json({ products: [], pagination: { page: 1, limit: 12, total: 0, hasNext: false } });
  assert.deepEqual((await listOwnerProducts()).products, []);
});

test("EGP amounts validate raw decimal precision, cap and currency formatting", () => {
  const valid = { ...productToForm(), name: "Burger", slug: "burger", categoryId, price: "0", oldPrice: "1.25" };
  assert.deepEqual(validateProductForm(valid, categories, "EGP"), {});
  assert.equal(productWrite(valid, categories, "EGP").price, 0);
  assert.equal(productWrite(valid, categories, "EGP").oldPrice, 1.25);
  for (const price of ["1.234", "1000000.01", "-1", "", "1e3"]) {
    assert.ok(validateProductForm({ ...valid, price }, categories, "EGP").price, price);
  }
  assert.ok(validateProductForm({ ...valid, price: "1.2" }, categories, "JPY").price);
  assert.deepEqual(validateProductForm({ ...valid, price: "1.234", oldPrice: "" }, categories, "KWD"), {});
  assert.match(formatOwnerPrice(1.25, "EGP"), /EGP/);
  assert.doesNotMatch(formatOwnerPrice(1.25, "EGP"), /\$/);
});

test("create uses session CSRF, explicit writable fields and a fetched MongoDB category ID", async () => {
  const form = { ...productToForm(), name: "Burger", slug: "burger", categoryId,
    price: "12.50", images: "https://example.com/1.jpg\nhttps://example.com/2.jpg", isFeatured: true };
  const body = productWrite(form, categories, "EGP");
  assert.equal(body.categoryId, categoryId);
  assert.deepEqual(body.images, ["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  assert.equal(body.price, 12.5);
  assert.ok(!Object.hasOwn(body, "restaurantId"));
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Savora-CSRF"), token);
    assert.deepEqual(JSON.parse(options.body), body);
    return json({ product: product({ price: 12.5, images: body.images, isFeatured: true }) }, 201);
  };
  assert.equal((await createOwnerProduct(body)).price, 12.5);
});

test("edit preserves slug, supports category reassignment, flags, old price clear and nullable fields", () => {
  const original = product({ price: 5, oldPrice: 7, preparationTime: 10, calories: 300 });
  const form = { ...productToForm(original), name: "New Burger", categoryId: secondCategoryId,
    oldPrice: "", isAvailable: false, isFeatured: true, preparationTime: "", calories: "" };
  const patch = productPatch(form, original, categories, "EGP");
  assert.deepEqual(patch, { name: "New Burger", categoryId: secondCategoryId, oldPrice: null,
    isAvailable: false, isFeatured: true, preparationTime: null, calories: null });
  assert.equal(original.slug, "burger");
  assert.equal(Object.keys(productPatch(productToForm(original), original, categories, "EGP")).length, 0);
  assert.ok(validateProductForm({ ...form, categoryId: "cat-burgers" }, categories, "EGP").categoryId);
});

test("PATCH and DELETE wait for server, preserving historical Order 409 and 404", async () => {
  let patches = 0;
  let deletes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return json({ csrfToken: token });
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Savora-CSRF"), token);
    if (options.method === "PATCH") {
      patches++;
      return patches === 1 ? json({ error: "Category missing" }, 404) : json({ product: product({ isAvailable: false }) });
    }
    deletes++;
    return deletes === 1 ? json({ error: "Product has orders" }, 409) : new Response(null, { status: 204 });
  };
  await assert.rejects(patchOwnerProduct(id, { categoryId: secondCategoryId }), (error) => error instanceof ApiError && error.status === 404);
  assert.equal((await patchOwnerProduct(id, { isAvailable: false })).isAvailable, false);
  await assert.rejects(deleteOwnerProduct(id), (error) => error instanceof ApiError && error.status === 409);
  await assert.doesNotReject(deleteOwnerProduct(id));
});

test("duplicate Product slug 409 is returned without a local success", async () => {
  globalThis.fetch = async (url) => url.endsWith("/csrf") ? json({ csrfToken: token }) :
    json({ error: "Product slug already exists" }, 409);
  await assert.rejects(patchOwnerProduct(id, { slug: "taken" }),
    (error) => error instanceof ApiError && error.status === 409);
});

test("validation and network failures never substitute fixture Products", async () => {
  const form = { ...productToForm(), name: "Burger", slug: "burger", categoryId, price: "10" };
  assert.ok(validateProductForm({ ...form, images: "javascript:bad" }, categories, "EGP").images);
  assert.ok(validateProductForm({ ...form, categoryId: "cat-burgers" }, categories, "EGP").categoryId);
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(listOwnerProducts(), (error) => error instanceof ApiError && error.status === null);
  globalThis.fetch = async () => json({ products: [{ name: "fixture?" }], pagination: {} });
  await assert.rejects(listOwnerProducts(), /Invalid server response/);
});
