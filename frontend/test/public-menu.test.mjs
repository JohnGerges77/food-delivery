import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAllPublicCategories, getPublicProducts, getPublicRestaurant, findPublicProduct,
  localPreviewSlug, validateStorefrontSlug, PublicMenuError } from "../src/services/public-menu.ts";
import { publicMoney, safePublicImage } from "../src/lib/public-menu-presentation.ts";
import { resolveStorefrontTheme } from "../src/lib/storefront-theme.ts";
import { useCartStore } from "../src/store/cart-store.ts";

const originalFetch = globalThis.fetch;
const originalPreview = process.env.NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG;
const id = "507f1f77bcf86cd799439012";
const categoryId = "507f1f77bcf86cd799439011";
const product = { id, categoryId, name: "Dish", slug: "dish", description: null,
  price: 0, oldPrice: 4.5, imageUrl: null, images: [], isFeatured: false,
  preparationTime: null, calories: null };
const restaurant = { name: "Cafe", slug: "cafe", description: null, logoUrl: null,
  currency: "EGP", phone: null, contactEmail: null, address: null, openingHours: null,
  deliverySettings: { deliveryFee: 0, minimumOrder: 0, estimatedDeliveryTime: null, deliveryAvailable: false },
  socialLinks: { facebook: null, instagram: null, whatsapp: null },
  branding: { brandName: null, primaryColor: null } };
process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG = originalPreview;
  useCartStore.setState({ tenantSlug: null, items: [] });
});

test("explicit slug normalizes and local preview only applies in development", () => {
  assert.equal(validateStorefrontSlug(" Cafe-One "), "cafe-one");
  assert.throws(() => validateStorefrontSlug("../other"), PublicMenuError);
  process.env.NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG = " Savora-Demo ";
  assert.equal(localPreviewSlug(), process.env.NODE_ENV === "development" ? "savora-demo" : null);
});

test("restaurant response preserves public null and zero values without credentials", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/public/restaurants/cafe");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.method, "GET");
    return json({ restaurant });
  };
  assert.deepEqual(await getPublicRestaurant("Cafe"), restaurant);
});

test("tenant theme resolution defaults legacy and unshipped values to Classic", () => {
  assert.equal(resolveStorefrontTheme(restaurant), "savora-classic");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-classic" }), "savora-classic");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-aqua" }), "savora-aqua");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-cafe" }), "savora-cafe");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-luxury" }), "savora-luxury");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-cafe", slug: "tenant-c" }), "savora-cafe");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-aqua", slug: "a" }), "savora-aqua");
  assert.equal(resolveStorefrontTheme({ storefrontTheme: "savora-classic", slug: "b" }), "savora-classic");
  for (const storefrontTheme of ["theme-2", "savora-luxury-dark", "other"]) {
    assert.equal(resolveStorefrontTheme({ storefrontTheme }), "savora-classic");
  }
});

test("missing restaurant has no fixture fallback; wrong-tenant slug is rejected", async () => {
  globalThis.fetch = async () => json({ error: "Not found" }, 404);
  await assert.rejects(getPublicRestaurant("cafe"), (error) => error.status === 404);
  globalThis.fetch = async () => json({ restaurant: { ...restaurant, slug: "other" } });
  await assert.rejects(getPublicRestaurant("cafe"), /Invalid restaurant response/);
});

test("categories and products follow bounded public pagination and exact IDs", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.includes("/categories")) return json({ categories: [{ id: categoryId, name: "Food", slug: "food",
      description: null, imageUrl: null, sortOrder: 0 }], pagination: { page: 1, limit: 100, total: 1, hasNext: false } });
    return json({ currency: "EGP", products: [product],
      pagination: { page: 1, limit: 100, total: 1, hasNext: false } });
  };
  assert.equal((await getAllPublicCategories("cafe"))[0].id, categoryId);
  const listed = await getPublicProducts("cafe", 1, { categoryId, isFeatured: false, sort: "price" });
  assert.equal(listed.products[0].id, id);
  assert.equal(listed.products[0].price, 0);
  assert.match(calls[1], /categoryId=507f1f77bcf86cd799439011&isFeatured=false&sort=price/);
  assert.deepEqual(await findPublicProduct("cafe", id), product);
  assert.equal(await findPublicProduct("cafe", "prod-fixture"), null);
});

test("empty menu, timeout and pagination failure remain explicit", async () => {
  globalThis.fetch = async () => json({ currency: "EGP", products: [],
    pagination: { page: 1, limit: 100, total: 0, hasNext: false } });
  assert.deepEqual((await getPublicProducts("cafe")).products, []);
  globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
  await assert.rejects(getPublicProducts("cafe"), /timed out/);
});

test("pagination reaches later products and a failed request can be retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error("network");
    return json({ currency: "EGP", products: calls === 2 ? [] : [product],
      pagination: { page: calls - 1, limit: 100, total: 101, hasNext: calls === 2 } });
  };
  await assert.rejects(getPublicProducts("cafe"), /Cannot reach/);
  assert.equal((await getPublicProducts("cafe")).pagination.hasNext, true);
  assert.equal((await getPublicProducts("cafe", 2)).products[0].id, id);
});

test("public presentation uses real EGP, discounts and safe image fallback", () => {
  assert.match(publicMoney(0, "EGP", "en"), /EGP/);
  assert.doesNotMatch(publicMoney(4.5, "EGP", "en"), /\$/);
  assert.equal(safePublicImage(null), null);
  assert.equal(safePublicImage("javascript:alert(1)"), null);
  assert.equal(safePublicImage("/images/dish.jpg"), "/images/dish.jpg");
  assert.equal(safePublicImage("//example.com/dish.jpg"), null);
  assert.equal(safePublicImage("https://example.com/dish.jpg"), "https://example.com/dish.jpg");
});

test("cart accepts real IDs and clears between restaurants including legacy fixture data", () => {
  const cart = useCartStore.getState();
  cart.setTenant("cafe");
  cart.addPublicItem("cafe", product, 2);
  assert.deepEqual(useCartStore.getState().items.map((item) => item.productId), [id]);
  assert.equal(useCartStore.getState().items[0].quantity, 2);
  useCartStore.setState({ tenantSlug: null, items: [{ productId: "prod-fixture", name: "Old",
    price: 10, image: "", quantity: 1 }] });
  useCartStore.getState().setTenant("cafe");
  assert.deepEqual(useCartStore.getState().items, []);
  useCartStore.getState().addPublicItem("cafe", product);
  useCartStore.getState().setTenant("other");
  assert.deepEqual(useCartStore.getState().items, []);
});
