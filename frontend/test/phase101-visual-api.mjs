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

createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "GET") {
    response.writeHead(405).end(JSON.stringify({ error: "Read-only visual fixture" }));
    return;
  }
  const url = new URL(request.url, "http://localhost");
  const slug = url.pathname.startsWith("/api/public/restaurants/phase102-aqua") ? "phase102-aqua" :
    url.pathname.startsWith("/api/public/restaurants/phase101-classic") ? "phase101-classic" :
    url.pathname.startsWith("/api/public/restaurants/phase101-paused") ? pausedRestaurant.slug :
    url.pathname.startsWith("/api/public/restaurants/phase103-cafe") ? "phase103-cafe" :
    url.pathname.startsWith("/api/public/restaurants/phase104-luxury") ? "phase104-luxury" :
    url.pathname.startsWith("/api/public/restaurants/savora-beta-demo") ? "savora-beta-demo" : null;
  if (!slug) {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const suffix = url.pathname.slice(`/api/public/restaurants/${slug}`.length);
  let listing = slug === demoRestaurant.slug ? suffix === "/categories" ? demoCategories : demoProducts :
    slug === "phase103-cafe" ? suffix === "/categories" ? cafeCategories : cafeProducts :
    suffix === "/categories" ? categories : products;
  if (suffix === "/products" && url.searchParams.has("categoryId")) {
    listing = listing.filter((item) => item.categoryId === url.searchParams.get("categoryId"));
  }
  if (suffix === "" || suffix === "/categories" || suffix === "/products") {
    response.writeHead(200).end(JSON.stringify(suffix === "" ? { restaurant: {
      ...(slug === demoRestaurant.slug ? demoRestaurant :
        slug === pausedRestaurant.slug ? pausedRestaurant :
        slug === "phase102-aqua" ? aquaRestaurant : slug === "phase103-cafe" ? cafeRestaurant :
          slug === "phase104-luxury" ? luxuryRestaurant : restaurant),
      heroProductSelected: true, heroProduct: slug === demoRestaurant.slug ? demoProducts[1] :
        slug === "phase103-cafe" ? cafeProducts[0] : products[1],
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
