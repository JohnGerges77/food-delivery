import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAllPublicCategories, getPublicProducts, getPublicRestaurant, findPublicProduct,
  localPreviewSlug, validateStorefrontSlug, PublicMenuError, selectOffers } from "../src/services/public-menu.ts";
import { publicMoney, safePublicImage } from "../src/lib/public-menu-presentation.ts";
import { westernDigits } from "../src/lib/western-digits.ts";
import { resolveStorefrontTheme } from "../src/lib/storefront-theme.ts";
import { useCartStore } from "../src/store/cart-store.ts";

const originalFetch = globalThis.fetch;
const originalPreview = process.env.NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG;
const id = "507f1f77bcf86cd799439012";
const categoryId = "507f1f77bcf86cd799439011";
const product = { id, categoryId, name: "Dish", slug: "dish", description: null,
  price: 0, oldPrice: 4.5, imageUrl: null, images: [], isFeatured: false,
  preparationTime: null, calories: null };

test("offers filter before limiting and preserve menu order", () => {
  const featured = Array.from({ length: 8 }, (_, index) => ({ ...product, id: String(index), isFeatured: true }));
  assert.deepEqual(selectOffers([{ ...product, id: "ordinary" }, ...featured]).map((item) => item.id), ["0", "1", "2", "3", "4"]);
  assert.equal(selectOffers(featured.slice(0, 2)).length, 2);
  assert.deepEqual(selectOffers([product]), []);
});

test("Arabic demo catalog translation preserves tenant data, IDs, and variant prices", async () => {
  const burger = { ...product, slug: "cheese-burger", name: "Cheese Burger", description: "Test description",
    price: 150, variants: [{ id: "variant", name: "Double", price: 210, isAvailable: true, sortOrder: 1 }] };
  const sides = { id: categoryId, name: "Sides", slug: "sides", description: null };
  globalThis.fetch = async (url) => json(url.endsWith("/categories?page=1&limit=100")
    ? { categories: [sides], pagination: { hasNext: false } }
    : { products: [burger], pagination: { hasNext: false } });
  const translated = await findPublicProduct("savora-beta-demo", id, "ar");
  assert.match(translated.name, /[\u0600-\u06ff]/);
  assert.match(translated.description, /[\u0600-\u06ff]/);
  assert.match(translated.variants[0].name, /[\u0600-\u06ff]/);
  assert.deepEqual([translated.id, translated.categoryId, translated.price,
    translated.variants[0].id, translated.variants[0].price], [id, categoryId, 150, "variant", 210]);
  assert.match((await getAllPublicCategories("savora-beta-demo", "ar"))[0].name, /[\u0600-\u06ff]/);
  assert.deepEqual(await findPublicProduct("savora-beta-demo", id), burger);
  assert.deepEqual(await findPublicProduct("another-tenant", id, "ar"), burger);
});

test("thumbnail proxies fall back while approved static asset URLs still work", () => {
  assert.equal(safePublicImage("https://encrypted-tbn0.gstatic.com/images?q=fixture"), null);
  assert.equal(safePublicImage("https://lh3.googleusercontent.com/proxy"), null);
  assert.equal(safePublicImage("/best1.webp"), "/best1.webp");
});

test("a variant must be explicitly chosen and an invalid add preserves the current cart", () => {
  const store = useCartStore.getState();
  assert.equal(store.addPublicItem("first", { ...product, price: 60 }), true);
  const burger = { ...product, variants: [{ id: "variant", name: "Double", price: 210, isAvailable: true }] };
  assert.equal(store.addPublicItem("second", burger), false);
  assert.equal(useCartStore.getState().tenantSlug, "first");
  assert.equal(useCartStore.getState().getSubtotal(), 60);
  assert.equal(store.addPublicItem("second", burger, 2, "variant"), true);
  assert.equal(useCartStore.getState().items[0].variantId, "variant");
  assert.equal(useCartStore.getState().getSubtotal(), 420);
});

test("cart quantity controls preserve subtotal and clear items", () => {
  const store = useCartStore.getState();
  store.clearCart();
  store.addPublicItem("cafe", { ...product, price: 12.5 }, 2);
  store.increaseQuantity(product.id);
  assert.equal(useCartStore.getState().getSubtotal(), 37.5);
  store.decreaseQuantity(product.id);
  assert.equal(useCartStore.getState().getTotal(5), 30);
  store.removeItem(product.id);
  assert.equal(useCartStore.getState().items.length, 0);
  store.addPublicItem("cafe", product);
  store.clearCart();
  assert.equal(useCartStore.getState().items.length, 0);
});
const restaurant = { name: "Cafe", slug: "cafe", description: null, logoUrl: null,
  currency: "EGP", phone: null, contactEmail: null, address: null, openingHours: null,
  deliverySettings: { deliveryFee: 0, minimumOrder: 0, estimatedDeliveryTime: null, deliveryAvailable: false },
  socialLinks: { facebook: null, instagram: null, whatsapp: null },
  branding: { brandName: null, primaryColor: null } };

test("Arabic storefront formatting keeps Western numerals in prices and supplied text", async () => {
  assert.equal(westernDigits("طلب ١٢٣۴۵٦"), "طلب 123456");
  assert.match(publicMoney(1234.5, "EGP", "ar"), /1[\s,٬]?234/);
  assert.doesNotMatch(publicMoney(1234.5, "EGP", "ar"), /[٠-٩۰-۹]/);
  globalThis.fetch = async () => json({ restaurant: { ...restaurant,
    name: "مطعم ١٢", address: "شارع ۳", openingHours: "١٠:٣٠",
    deliverySettings: { ...restaurant.deliverySettings, estimatedDeliveryTime: "٣٠ دقيقة" } } });
  const displayed = await getPublicRestaurant("cafe");
  assert.equal(displayed.name, "مطعم 12");
  assert.equal(displayed.address, "شارع 3");
  assert.equal(displayed.openingHours, "10:30");
  assert.equal(displayed.deliverySettings.estimatedDeliveryTime, "30 دقيقة");
});
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

test("restaurant response preserves public null and zero values with same-origin credentials", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/public/restaurants/cafe");
    assert.equal(options.credentials, "same-origin");
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
  assert.equal(useCartStore.getState().items[0].quantity, 2);
  useCartStore.getState().addPublicItem("cafe", product);
  useCartStore.getState().setTenant("other");
  assert.deepEqual(useCartStore.getState().items, []);
});

test("cart attention revision advances only for successful public adds", () => {
  const cart = useCartStore.getState();
  const initial = cart.addRevision;
  const product = { id, name: "Burger", price: 12, imageUrl: null };
  cart.addPublicItem("cafe", product, 1);
  assert.equal(useCartStore.getState().addRevision, initial + 1);
  cart.addPublicItem("cafe", product, 2);
  assert.equal(useCartStore.getState().addRevision, initial + 2);
  cart.addPublicItem("cafe", product, 0);
  cart.addPublicItem("cafe", { ...product, id: "invalid" });
  assert.equal(useCartStore.getState().addRevision, initial + 2);
});
