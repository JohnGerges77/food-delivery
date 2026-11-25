import { createServer } from "node:http";

const id = (suffix) => `507f1f77bcf86cd7994390${suffix}`;
const categories = [
  { id: id("11"), name: "Signature dishes", slug: "signature", description: null, imageUrl: null, sortOrder: 0 },
  { id: id("12"), name: "Pasta", slug: "pasta", description: null, imageUrl: null, sortOrder: 1 },
];
const products = [
  ["21", "House beef burger", "Seared beef, melted cheese and crisp vegetables.", 185, "/best1.webp", 25, 620],
  ["22", "Savora rice bowl", "Seasoned rice with vegetables and fresh herbs.", 165, "/best2.webp", 20, 480],
  ["23", "Grilled steak", "Flame grilled steak with herbs and roasted potatoes.", 150, "/best3.webp", 20, 520],
  ["24", "Creamy chicken pasta", "Chicken and pasta in a creamy herb sauce.", 90, "/best4.webp", null, 510],
].map(([suffix, name, description, price, imageUrl, preparationTime, calories], index) => ({
  id: id(suffix), categoryId: categories[index === 3 ? 1 : 0].id, name,
  slug: `dish-${suffix}`, description, price, oldPrice: null,
  imageUrl, images: [], isFeatured: index === 0, preparationTime, calories,
}));
const restaurant = {
  name: "Savora Classic", slug: "phase101-classic", description: "Freshly prepared favorites.",
  logoUrl: "/logo.webp", currency: "EGP", phone: null, contactEmail: null,
  address: null, openingHours: null,
  deliverySettings: { deliveryFee: 15, minimumOrder: 0, estimatedDeliveryTime: "30–45 minutes", deliveryAvailable: true },
  socialLinks: { facebook: null, instagram: null, whatsapp: null },
  branding: { brandName: "Savora", primaryColor: null },
};
const pausedRestaurant = { ...restaurant, slug: "phase101-paused",
  deliverySettings: { ...restaurant.deliverySettings, deliveryAvailable: false } };
const demoRestaurant = { ...restaurant, slug: "savora-beta-demo", name: "Savora Beta Demo",
  logoUrl: null, address: " ", deliverySettings: { ...restaurant.deliverySettings, deliveryFee: 0 } };
const demoCategories = ["Pizza", "Burgers", "Sides"].map((name, sortOrder) => ({
  ...categories[0], id: id(String(51 + sortOrder)), name, slug: name.toLowerCase(), sortOrder,
}));
const demoProducts = [
  ["Pizza Margherita", "pizza-margherita", "Tomato, mozzarella and basil on a stone-baked crust.",
    ["Small", "Medium", "Large"], [150, 200, 270], null],
  ["Cheese Burger", "cheese-burger", "Grilled beef with cheddar and pickles on a toasted bun.",
    ["Single", "Double"], [150, 210], "/best1.webp"],
  ["French Fries", "french-fries", "Golden fries tossed with sea salt.",
    [], [60], "https://encrypted-tbn0.gstatic.com/images?q=fixture"],
].map(([name, slug, description, variantNames, prices, imageUrl], index) => ({
  ...products[index], name, slug, description, imageUrl, price: prices[0], startingPrice: prices[0], calories: null,
  id: id(String(61 + index)), categoryId: demoCategories[index].id, isFeatured: true,
  variants: variantNames.map((name, sortOrder) => ({
    id: id(String(71 + index * 3 + sortOrder)), name, price: prices[sortOrder], sortOrder, isAvailable: true,
  })),
}));
const aquaRestaurant = { ...restaurant, name: "Savora Aqua Preview",
  slug: "phase102-aqua", storefrontTheme: "savora-aqua",
  description: "Freshly prepared dishes from our kitchen.",
  openingHours: "Daily, 10:00–23:00", address: "Cairo", phone: "+201000000000" };
const cafeRestaurant = { ...restaurant, name: "Savora Café Preview",
  slug: "phase103-cafe", storefrontTheme: "savora-cafe",
  description: "Coffee, pastries and simple plates from our menu.",
  openingHours: "Daily, 08:00–22:00", address: "Cairo", phone: "+201000000000" };
const luxuryRestaurant = { ...restaurant, name: "Savora Luxury Preview",
  slug: "phase104-luxury", storefrontTheme: "savora-luxury",
  description: "Freshly prepared dishes from our menu.",
  openingHours: "Daily, 12:00–22:00", address: "Cairo", phone: "+201000000000" };
const cafeCategories = [
  { id: id("31"), name: "Coffee", slug: "coffee", description: null, imageUrl: null, sortOrder: 0 },
  { id: id("32"), name: "Pastries", slug: "pastries", description: null, imageUrl: null, sortOrder: 1 },
];
const cafeProducts = [
  ["41", "Espresso", "A short, rich coffee.", 85, 0],
  ["42", "Cappuccino", "Coffee with steamed milk.", 115, 0],
  ["43", "Butter croissant", "Flaky baked pastry.", 95, 1],
  ["44", "Chocolate tart", "Chocolate dessert slice.", 140, 1],
].map(([suffix, name, description, price, category], index) => ({
  id: id(suffix), categoryId: cafeCategories[category].id, name, slug: `cafe-${suffix}`,
  description, price, oldPrice: null, imageUrl: null, images: [], isFeatured: index === 0,
  preparationTime: null, calories: null,
}));

const brandingFixtures = process.env.SAVORA_BRANDING_VISUAL === "1";
const entitlementFixtures = process.env.SAVORA_ENTITLEMENT_VISUAL === "1";
const brandingOwnerId = id("99");
const brandingCsrf = "a".repeat(64);
const stores = [restaurant, demoRestaurant, pausedRestaurant, aquaRestaurant, cafeRestaurant, luxuryRestaurant];
const themeFixtures = { classic: restaurant, aqua: aquaRestaurant, cafe: cafeRestaurant, luxury: luxuryRestaurant };
const colors = { default: null, sky: "#89CFF0", dark: "#000000", light: "#FFFFFF" };
let ownerBranding = restaurant.branding;
let ownerHero = null;
let orderingEnabled = false;
let receipt = null;

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  const url = new URL(request.url, "http://localhost");
  if ((brandingFixtures || entitlementFixtures) && /^\/api\/(auth|owner|admin)\//.test(url.pathname)) {
    if (["http://127.0.0.1:3192", "http://127.0.0.1:3193"].includes(request.headers.origin)) {
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
    }
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Savora-CSRF");
    const ownerStore = entitlementFixtures ? demoRestaurant : restaurant;
    const summary = { id: brandingOwnerId, name: ownerStore.name, slug: ownerStore.slug, currency: ownerStore.currency };
    if (request.method === "OPTIONS") return response.writeHead(204).end();
    const readPatch = async () => {
      let body = "";
      for await (const chunk of request) body += chunk;
      return JSON.parse(body);
    };
    if (entitlementFixtures && url.pathname === "/api/admin/auth/me") {
      return response.end(JSON.stringify({ admin: { id: id("97"), email: "platform@example.test" } }));
    }
    if (entitlementFixtures && url.pathname === "/api/admin/auth/csrf") return response.end(JSON.stringify({ csrfToken: brandingCsrf }));
    if (entitlementFixtures && [`/api/admin/restaurants/${brandingOwnerId}`, `/api/admin/restaurants/${brandingOwnerId}/ordering`].includes(url.pathname)) {
      if (request.method === "PATCH") {
        if (request.headers["x-savora-csrf"] !== brandingCsrf) return response.writeHead(403).end();
        const patch = await readPatch();
        if (typeof patch.onlineOrderingEnabled !== "boolean") return response.writeHead(400).end();
        orderingEnabled = patch.onlineOrderingEnabled;
      }
      return response.end(JSON.stringify({ restaurant: { ...summary, storefrontTheme: "savora-classic",
        onlineOrderingEnabled: orderingEnabled, status: "active", description: "Fixture restaurant",
        owner: { id: id("98"), name: "Fixture Owner", email: "owner@example.test", isActive: true } } }));
    }
    if (url.pathname === "/api/auth/me") return response.end(JSON.stringify({
      user: { id: id("98"), name: "Fixture Owner", email: "owner@example.test" }, restaurant: summary,
    }));
    if (url.pathname === "/api/auth/csrf") return response.end(JSON.stringify({ csrfToken: brandingCsrf }));
    if (["/api/owner/products", "/api/owner/categories"].includes(url.pathname)) {
      return response.end(JSON.stringify({ products: [], categories: [], pagination: { page: 1, limit: 100, total: 0, hasNext: false } }));
    }
    if (entitlementFixtures && url.pathname === "/api/owner/orders") {
      const search = url.searchParams.get("orderNumber");
      const orders = receipt && (!search || ["1001", "#1001", receipt.orderNumber].includes(search)) ? [receipt] : [];
      return response.end(JSON.stringify({ orders, pagination: { page: 1, limit: 20, total: orders.length, hasNext: false } }));
    }
    if (entitlementFixtures && receipt && url.pathname === "/api/owner/orders/" + receipt.id) {
      return response.end(JSON.stringify({ order: receipt }));
    }
    if (url.pathname === "/api/owner/restaurant") {
      if (request.method === "PATCH") {
        if (request.headers["x-savora-csrf"] !== brandingCsrf) return response.writeHead(403).end();
        const patch = await readPatch();
        if (patch.branding) ownerBranding = { ...ownerBranding, ...patch.branding };
        if (Object.hasOwn(patch, "heroImageUrl")) ownerHero = patch.heroImageUrl || null;
      }
      return response.end(JSON.stringify({ restaurant: {
        ...ownerStore, ...summary, status: "active", heroProductId: null, storefrontTheme: "savora-classic",
        ...(entitlementFixtures ? { onlineOrderingEnabled: orderingEnabled } : {}),
        heroImageUrl: ownerHero, branding: ownerBranding,
      } }));
    }
    return response.writeHead(404).end();
  }
  if (entitlementFixtures && url.pathname === "/api/public/restaurants/savora-beta-demo/orders") {
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
      return response.writeHead(204).end();
    }
    if (request.method === "POST") {
      if (!orderingEnabled) return response.writeHead(403).end(JSON.stringify({ code: "ONLINE_ORDERING_DISABLED" }));
      receipt ??= { id: id("92"), orderNumber: "SV-FEEDABCD1234", displayNumber: 1001,
        subtotal: 200, deliveryFee: 0, total: 200, submissionMethod: "direct", status: "pending", source: "website",
        customerName: "Synthetic Guest", customerPhone: "+12025550100", customerEmail: null, notes: null,
        deliveryAddress: "Synthetic checkout fixture", city: "Test City", createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), deliveredAt: null, items: [{ productId: demoProducts[0].id,
          variantId: demoProducts[0].variants[1].id, variantName: "Medium", name: "Pizza Margherita",
          unitPrice: 200, quantity: 1, imageUrl: null, notes: null }] };
      const { orderNumber, displayNumber, subtotal, deliveryFee, total, submissionMethod, status } = receipt;
      return response.writeHead(201).end(JSON.stringify({ order: { orderNumber, displayNumber, subtotal, deliveryFee,
        total, submissionMethod, status, currency: "EGP", savedInSavora: true } }));
    }
  }
  if (request.method !== "GET") {
    response.writeHead(405).end(JSON.stringify({ error: "Read-only visual fixture" }));
    return;
  }
  const match = /^\/api\/public\/restaurants\/([a-z0-9-]+)(.*)$/.exec(url.pathname);
  const [, slug, suffix] = match ?? [];
  let store = stores.find((item) => item.slug === slug);
  const visual = brandingFixtures && /^theme-(classic|aqua|cafe|luxury)-(default|sky|dark|light)$/.exec(slug);
  const digital = entitlementFixtures && /^menu-only-(classic|aqua|cafe|luxury)$/.exec(slug);
  if (digital) {
    const preset = themeFixtures[digital[1]];
    store = { ...preset, slug, onlineOrderingEnabled: false, checkoutAvailability: "menu-only",
      branding: { ...preset.branding, primaryColor: "#89CFF0" } };
  }
  if (visual) {
    const [, theme, color] = visual;
    const preset = themeFixtures[theme];
    store = { ...preset, slug, branding: { ...preset.branding, primaryColor: colors[color] },
      heroImageUrl: color === "sky" ? "http://127.0.0.1:3192/best3.webp" : null };
  }
  if (!store) {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const cafe = store.storefrontTheme === "savora-cafe";
  const demo = slug === demoRestaurant.slug;
  const productList = demo ? demoProducts : cafe ? cafeProducts : products;
  const categoryList = demo ? demoCategories : cafe ? cafeCategories : categories;
  let listing = suffix === "/categories" ? categoryList : productList;
  if (suffix === "/products" && url.searchParams.has("categoryId")) {
    listing = listing.filter((item) => item.categoryId === url.searchParams.get("categoryId"));
  }
  if (suffix === "" || suffix === "/categories" || suffix === "/products") {
    response.writeHead(200).end(JSON.stringify(suffix === "" ? { restaurant: {
      ...store,
      ...(slug === restaurant.slug && brandingFixtures ? { branding: ownerBranding, heroImageUrl: ownerHero } : {}),
      ...(demo && entitlementFixtures ? { onlineOrderingEnabled: orderingEnabled,
        checkoutAvailability: orderingEnabled ? "available" : "menu-only" } : {}),
      heroProductSelected: true, heroProduct: cafe ? productList[0] : productList[1],
      whatsappOrderingAvailable: slug === "phase101-classic",
      socialLinks: { facebook: null, instagram: null, whatsapp: "https://wa.me/201000000000" },
    } } : {
      [suffix === "/categories" ? "categories" : "products"]: listing,
      ...(suffix === "/products" ? { currency: "EGP" } : {}),
      pagination: { page: 1, limit: 100, total: listing.length, hasNext: false },
    }));
    return;
  }
  if (suffix.startsWith("/products/")) {
    const product = listing.find((item) => item.id === suffix.slice("/products/".length));
    response.writeHead(product ? 200 : 404).end(JSON.stringify(product ? { product } : { error: "Not found" }));
    return;
  }
  response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
}).listen(5179, "127.0.0.1", () => process.stdout.write("Phase 10.1 read-only visual API on 5179\n"));
