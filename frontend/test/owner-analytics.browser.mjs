import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Run against local Next and Chrome CDP. Every owner API request is intercepted.
const port = process.env.SAVORA_CDP_PORT || "9335";
const base = process.env.SAVORA_STOREFRONT_URL || "http://localhost:3000";
const target = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((x) => x.type === "page");
assert.ok(target);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let sequence = 0;
const pending = new Map(), requests = [], errors = [];
const meta = (period) => ({ period, from: "2026-09-20T00:00:00.000Z", toExclusive: "2026-10-20T00:00:00.000Z", granularity: "day", currency: "EGP" });
const cmp = (current, previous = 0) => ({ current, previous, absoluteChange: current - previous, percentageChange: previous ? (current - previous) / previous * 100 : null });
const metrics = ["totalOrders", "deliveredOrders", "pendingOrders", "cancelledOrders", "ordersDeliveredInPeriod", "deliveredOrderValue", "deliveredSubtotal", "deliveredDeliveryFees", "averageDeliveredOrderValue", "cancellationRate", "deliveryCompletionRate"];
const methodKeys = ["direct", "whatsapp"], statusKeys = ["pending", "delivered", "cancelled"];
const cell = (i, empty) => ({ weekday: Math.floor(i / 24), hour: i % 24, orders: !empty && i === 0 ? 2 : 0 });
const category = { id: "507f1f77bcf86cd799439012", name: "Burgers", slug: "burgers", description: null, imageUrl: null, sortOrder: 0, isActive: true };
const product = { id: "507f1f77bcf86cd799439011", name: "Historical Burger", slug: "historical-burger", categoryId: category.id, description: null, price: 200, oldPrice: null, imageUrl: null, images: [], isAvailable: true, isFeatured: false, preparationTime: null, calories: null };
const restaurant = { id: "507f1f77bcf86cd799439016", name: "Savora", slug: "savora-demo", currency: "EGP", status: "active", description: null, logoUrl: null, phone: null, contactEmail: null, address: null, openingHours: null, deliverySettings: { deliveryFee: 25, minimumOrder: 0, estimatedDeliveryTime: null, deliveryAvailable: true }, socialLinks: { facebook: null, instagram: null, whatsapp: null }, branding: { brandName: null, primaryColor: null } };
let empty = false, failOverview = false;
function response(section, period, url) {
  const m = meta(period), zero = empty ? 0 : 2;
  if (section === "overview") {
    const values = { totalOrders: zero, deliveredOrders: empty ? 0 : 1,
      pendingOrders: empty ? 0 : 1, cancelledOrders: 0,
      ordersDeliveredInPeriod: empty ? 0 : 1, deliveredOrderValue: empty ? 0 : 225,
      deliveredSubtotal: empty ? 0 : 200, deliveredDeliveryFees: empty ? 0 : 25,
      averageDeliveredOrderValue: empty ? 0 : 225, cancellationRate: 0,
      deliveryCompletionRate: empty ? 0 : 50 };
    return { ...m, ...Object.fromEntries(metrics.map((key) => [key, cmp(values[key])])),
      sparklines: { totalOrders: [{ date: "2026-10-19", value: zero }],
        deliveredOrderValue: [{ date: "2026-10-19", value: empty ? 0 : 225 }] } };
  }
  if (section === "trends") return { ...m, series: ["2026-10-18", "2026-10-19"].map((date, i) => ({ date, bucketStart: `${date}T00:00:00.000Z`, ordersCreated: i ? period === "12m" ? 999 : zero : 0, ordersDelivered: i ? 0 : empty ? 0 : 1, deliveredOrderValue: i || empty ? 0 : 225, averageDeliveredOrderValue: i || empty ? 0 : 225 })), previousSeries: [] };
  if (section === "top-products") return { ...m, rankBy: url.searchParams.get("rankBy"), limit: Number(url.searchParams.get("limit")), products: empty ? [] : [{ rank: 1, productId: "507f1f77bcf86cd799439011", productName: "Historical Burger", quantitySold: 1, deliveredItemValue: 200 }], mostFrequentlyOrderedProduct: empty ? null : { productId: "507f1f77bcf86cd799439011", productName: "Historical Burger" } };
  if (section === "breakdowns") return { ...m, totalOrders: zero, submissionMethods: methodKeys.map((key) => ({ key, label: key, count: empty ? 0 : 1, percentage: empty ? 0 : 50 })), statuses: statusKeys.map((key) => ({ key, label: key, count: empty ? 0 : key === "pending" || key === "delivered" ? 1 : 0, percentage: empty ? 0 : key === "pending" || key === "delivered" ? 50 : 0 })) };
  if (section === "activity") return { ...m, totalOrders: zero, cells: Array.from({ length: 168 }, (_, i) => cell(i, empty)), insights: { busiestWeekday: empty ? null : { weekday: 0, orders: 2 }, busiestHour: empty ? null : { hour: 0, orders: 2 }, highestActivityCell: empty ? null : cell(0, empty) } };
  throw Error(section);
}
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function fulfill(requestId, body, code = 200) { await send("Fetch.fulfillRequest", { requestId, responseCode: code, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: new URL(base).origin }, { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Methods", value: "GET, OPTIONS" }, { name: "Access-Control-Allow-Headers", value: "Content-Type" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }); }
socket.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Fetch.requestPaused") {
    const { requestId, request } = msg.params, url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    let body, code = 200;
    if (request.method === "OPTIONS") { body = {}; code = 204; }
    else if (url.pathname === "/api/auth/me") body = { user: { id: "507f1f77bcf86cd799439015", name: "Owner", email: "owner@example.com" }, restaurant: { id: "507f1f77bcf86cd799439016", name: "Savora", slug: "savora-demo", currency: "EGP" } };
    else if (url.pathname === "/api/owner/orders") body = { orders: [], pagination: { page: 1, limit: 5, total: 0, hasNext: false } };
    else if (url.pathname === "/api/owner/restaurant") body = { restaurant };
    else if (url.pathname === "/api/owner/categories") body = { categories: [category], pagination: { page: 1, limit: Number(url.searchParams.get("limit") || 12), total: 1, hasNext: false } };
    else if (url.pathname === "/api/owner/products") body = { products: [product], pagination: { page: 1, limit: Number(url.searchParams.get("limit") || 12), total: 1, hasNext: false } };
    else if (url.pathname.startsWith("/api/owner/stats/")) { const section = url.pathname.split("/").at(-1); body = response(section, url.searchParams.get("period"), url); if (section === "overview" && failOverview) { body = { error: "Service unavailable" }; code = 503; } }
    else { body = { error: "Unexpected mocked request" }; code = 500; errors.push(`${request.method} ${url.pathname}`); }
    const answer = () => void fulfill(requestId, body, code).catch((error) => { if (error.message !== "Invalid InterceptionId.") errors.push(error.message); });
    if (url.pathname.endsWith("/trends") && url.searchParams.get("period") === "12m") setTimeout(answer, 650);
    else answer();
  }
  if (!msg.id) return;
  const entry = pending.get(msg.id); if (!entry) return; pending.delete(msg.id);
  if (msg.error) entry.reject(new Error(msg.error.message)); else entry.resolve(msg.result);
});
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) { for (let i = 0; i < 100; i++) { try { if (await check()) return; } catch { /* Navigation may not have created document.body yet. */ } await delay(200); } throw new Error(`Timed out: ${label}`); }
async function screenshot(name) { const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); const path = join(process.env.TEMP, name); await writeFile(path, Buffer.from(image.data, "base64")); process.stdout.write(`Screenshot: ${path}\n`); }
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*://localhost:5000/api/*", requestStage: "Request" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}/en/dashboard` });
  await until(() => evaluate("document.body.textContent.includes('Historical Burger') && document.querySelectorAll('svg[role=img]').length >= 4"), "English Overview");
  assert.equal(await evaluate("document.body.textContent.includes('Delivered Order Value') && document.querySelectorAll('svg[role=img]').length >= 4"), true);
  assert.equal(await evaluate("document.body.textContent.includes('Cancellation Rate') && document.body.textContent.includes('50%')"), true, "operational rate cards reflect the fixture");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.includes('Arial')"), true, "English font unchanged");
  assert.equal(await evaluate("document.body.textContent.includes('Today Revenue') || document.body.textContent.includes('Restaurant Open')"), false);
  await delay(700); await screenshot("savora-analytics-phase87-desktop-en.png");
  await evaluate("document.querySelector('[aria-label=\"Orders performance chart\"] circle[role=button]').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await until(() => evaluate("document.querySelector('[role=status]')?.textContent.includes('Orders created')"), "keyboard area tooltip");
  assert.equal(await evaluate("(() => { const p = document.querySelector('svg[aria-label=\"2 total orders\"] circle[role=button]'); p.focus(); return p.getAttribute('aria-label').includes('Pending'); })()"), true, "keyboard donut label");
  assert.equal(await evaluate("document.querySelectorAll('[role=group][aria-label*=\"UTC hour\"] button').length"), 168, "UTC heatmap cells");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "desktop no overflow");
  await evaluate("[...document.querySelectorAll('button')].find(x => x.textContent.includes('Last 7 Days')).click()");
  await until(() => requests.some((r) => r.includes("/stats/activity?period=7d")), "7d request");
  await until(() => evaluate("document.querySelector('[aria-pressed=true]')?.textContent.includes('Last 7 Days')"), "7d selection");
  assert.ok(requests.some((r) => r.includes("/stats/trends?period=7d")));
  await evaluate("[...document.querySelectorAll('button')].find(x => x.textContent.includes('Last 12 Months')).click()");
  await until(() => requests.some((r) => r.includes("/stats/trends?period=12m")), "slow 12m request");
  await evaluate("[...document.querySelectorAll('button')].find(x => x.textContent.includes('Last 30 Days')).click()");
  await until(() => evaluate("document.querySelector('[aria-pressed=true]')?.textContent.includes('Last 30 Days')"), "30d selection");
  await delay(800);
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Orders performance chart\"] svg')?.getAttribute('aria-label').includes('999')"), false, "stale 12m trend cannot replace 30d");
  failOverview = true;
  await evaluate("[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Refresh').click()");
  await until(() => evaluate("document.body.textContent.includes('Could not load this section.')"), "error state");
  failOverview = false; empty = true;
  await evaluate("[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Refresh').click()");
  await until(() => evaluate("document.body.textContent.includes('No delivered products yet')"), "empty state");
  await send("Emulation.setDeviceMetricsOverride", { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "tablet no page overflow");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `${base}/ar/dashboard` });
  await until(() => evaluate("document.body.textContent.includes('لا توجد منتجات مسلّمة بعد')"), "Arabic mobile Overview");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic Tajawal loaded");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('svg text')).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic chart labels use Tajawal");
  await screenshot("savora-analytics-phase87-mobile-ar.png");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "mobile no page overflow");
  for (const [locale, width, mobile] of [["en", 1440, false], ["ar", 1440, false], ["ar", 390, true]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
    for (const [page, marker] of [["settings", "Restaurant Name"], ["categories", "Burgers"], ["products", "Historical Burger"]]) {
      await send("Page.navigate", { url: `${base}/${locale}/dashboard/${page}` });
      await until(() => evaluate(`document.body.textContent.includes(${JSON.stringify(marker)})`), `${locale} ${page}`);
      assert.equal(await evaluate(`getComputedStyle(document.body).fontFamily.toLowerCase().includes(${JSON.stringify(locale === "ar" ? "tajawal" : "arial")})`), true, `${locale} ${page} font`);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `${locale} ${page} overflow`);
      if (page === "settings") assert.equal(await evaluate(`getComputedStyle(document.querySelector('input')).fontFamily.toLowerCase().includes(${JSON.stringify(locale === "ar" ? "tajawal" : "arial")})`), true, `${locale} settings input font`);
      await delay(400); await screenshot(`savora-typography-${locale}-${width}-${page}.png`);
    }
  }
  assert.deepEqual(errors, []); process.stdout.write("Analytics browser flow passed: desktop EN, mobile AR, period switch, error/empty states, and Settings/Categories/Products typography on desktop EN/AR and mobile AR with mocked APIs.\n");
} finally { await send("Fetch.disable"); socket.close(); }
