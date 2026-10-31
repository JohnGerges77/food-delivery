import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Chrome CDP and the local Next app must be running. POST is always intercepted.
const port = process.env.SAVORA_CDP_PORT || "9334";
const base = process.env.SAVORA_STOREFRONT_URL || "http://localhost:3000";
const id = "6ad4e9e6cf9d4e4de3fa13cb";
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((result) => result.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target, "Chrome page is available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const posts = [];
let paused = null;
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Fetch.requestPaused") {
    if (message.params.request.method === "OPTIONS") {
      send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 204,
        responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { name: "Access-Control-Allow-Headers", value: "Content-Type, Idempotency-Key" }] });
      return;
    }
    assert.equal(message.params.request.method, "POST", "only checkout POST is intercepted");
    posts.push({ url: message.params.request.url, headers: message.params.request.headers,
      body: JSON.parse(message.params.request.postData) });
    paused = message.params.requestId;
  }
  if (!message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error(`Timed out: ${label}`);
}
async function navigate(url) {
  await send("Page.navigate", { url });
  await until(() => evaluate("document.readyState === 'complete'"), "page load");
}
async function addProduct(locale) {
  await navigate(`${base}/${locale}/r/savora-demo/menu/${id}`);
  assert.equal(await evaluate(`getComputedStyle(document.body).fontFamily.toLowerCase().includes(${JSON.stringify(locale === "ar" ? "tajawal" : "arial")})`), true, `${locale} product font`);
  await until(() => evaluate("[...document.querySelectorAll('button')].some((el) => el.textContent.includes('Add to cart') || el.textContent.includes('أضف'))"), "product button");
  await until(() => evaluate("[...document.querySelectorAll('button')].some((el) => Object.keys(el).some((key) => key.startsWith('__reactProps')))"), "hydration");
  await evaluate("[...document.querySelectorAll('button')].find((el) => el.textContent.includes('Add to cart') || el.textContent.includes('أضف')).click()");
  await evaluate("[...document.querySelectorAll('a')].find((el) => new URL(el.href).pathname.endsWith('/cart')).click()");
  await until(() => evaluate("location.pathname.endsWith('/cart')"), "cart route");
  assert.equal(await evaluate(`getComputedStyle(document.body).fontFamily.toLowerCase().includes(${JSON.stringify(locale === "ar" ? "tajawal" : "arial")})`), true, `${locale} cart font`);
  await until(() => evaluate("[...document.querySelectorAll('a')].some((el) => el.href.includes('/checkout'))"), "checkout link");
  await evaluate("[...document.querySelectorAll('a')].find((el) => el.href.includes('/checkout')).click()");
  await until(() => evaluate("Boolean(document.querySelector('input[name=fullName]'))"), "checkout form");
}
async function fill(name, value) {
  await evaluate(`document.querySelector('[name=${name}]').focus()`);
  await send("Input.insertText", { text: value });
  await until(() => evaluate(`document.querySelector('[name=${name}]').value === ${JSON.stringify(value)}`), `${name} entry`);
}
async function next() {
  await evaluate("document.querySelector('form button[type=submit]').click()");
  await delay(250);
}
async function screenshot(name) {
  const captured = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = join(process.env.TEMP, name);
  await writeFile(path, Buffer.from(captured.data, "base64"));
  process.stdout.write(`Screenshot: ${path}\n`);
}
function confirmed(method) {
  return { order: { orderNumber: "SV-8341302408423A218E893F82", status: "pending", submissionMethod: method,
    currency: "EGP", subtotal: 250, deliveryFee: 0, total: 250, savedInSavora: true },
    ...(method === "whatsapp" ? { whatsapp: { url: "https://wa.me/201001234567?text=Order%20SV", messageSent: false } } : {}) };
}
async function fulfill(method, status = 201) {
  assert.ok(paused, "checkout POST paused before backend");
  const requestId = paused;
  paused = null;
  await send("Fetch.fulfillRequest", { requestId, responseCode: status,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }],
    body: Buffer.from(JSON.stringify(confirmed(method))).toString("base64") });
}
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*://localhost:5000/api/public/restaurants/*/orders", requestStage: "Request" }] });
  await navigate(`${base}/en/r/savora-demo`);
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.includes('Arial')"), true, "English landing font");
  await evaluate("document.fonts.ready.then(() => true)");
  await delay(900);
  await screenshot("savora-typography-desktop-en-landing.png");
  await addProduct("en");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.includes('Arial') && document.documentElement.dir === 'ltr'"), true, "English checkout font and direction");
  assert.equal(await evaluate("document.querySelector('aside')?.textContent.includes('EGP')"), true);
  assert.equal(await evaluate("document.querySelector('main h1')?.textContent.includes('Guest Order')"), true);
  await delay(1200);
  await screenshot("savora-checkout-phase85-desktop-en.png");
  await next();
  assert.equal(await evaluate("Boolean(document.querySelector('[role=alert]'))"), true, "validation shown");
  await fill("fullName", "Aya Hassan");
  await fill("phone", "+201001234567");
  await fill("email", "aya@example.com");
  await fill("address", "12 Nile Street");
  await fill("city", "Cairo");
  await fill("notes", "No nuts");
  await next();
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=checkout-review]'))"), true);
  await evaluate("[...document.querySelectorAll('button')].find((el) => el.textContent.includes('Edit details')).click()");
  assert.equal(await evaluate("document.querySelector('[name=fullName]').value"), "Aya Hassan", "values preserved through steps");
  await next();
  await next();
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=checkout-methods]'))"), true);
  await next();
  await until(() => posts.length === 1, "direct POST");
  assert.equal(await evaluate("document.querySelector('form button[type=submit]').disabled"), true, "loading blocks clicks");
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation]'))"), false);
  assert.equal(posts[0].body.items[0].productId, id);
  assert.equal("total" in posts[0].body, false);
  assert.equal(posts[0].body.submissionMethod, "direct");
  await send("Fetch.failRequest", { requestId: paused, errorReason: "TimedOut" });
  paused = null;
  await until(() => evaluate("Boolean(document.querySelector('[data-testid=checkout-error]'))"), "timeout error");
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation]'))"), false);
  assert.equal(await evaluate("document.querySelector('aside')?.textContent.includes('Cheese Burger')"), true, "cart retained");
  await next();
  await until(() => posts.length === 2, "retry POST");
  assert.equal(posts[0].headers["Idempotency-Key"], posts[1].headers["Idempotency-Key"]);
  assert.deepEqual(posts[0].body, posts[1].body);
  await fulfill("direct", 200);
  await until(() => evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation]'))"), "saved direct confirmation");
  assert.equal(await evaluate("document.querySelector('[data-testid=checkout-confirmation]').textContent.includes('SV-8341302408423A218E893F82')"), true);
  assert.equal(await evaluate("document.querySelector('aside')?.textContent.includes('Your cart is empty')"), true, "cart cleared after saved response");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const route of ["", "/about", "/menu"]) {
    await navigate(`${base}/ar/r/savora-demo${route}`);
    assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.toLowerCase().includes('tajawal') && document.documentElement.dir === 'rtl'"), true, `Arabic ${route || 'landing'} font and direction`);
    await evaluate("document.fonts.ready.then(() => true)");
    await delay(900);
    await screenshot(`savora-typography-mobile-ar-${route ? route.slice(1) : "landing"}.png`);
  }
  await addProduct("ar");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.toLowerCase().includes('tajawal') && document.documentElement.dir === 'rtl'"), true, "Arabic checkout font and direction");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('input[name=fullName]')).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic checkout input uses Tajawal");
  assert.equal(await evaluate("document.querySelector('main h1')?.textContent.includes('طلب الضيف')"), true);
  await delay(1200);
  await screenshot("savora-checkout-phase85-mobile-ar.png");
  await fill("fullName", "آية حسن");
  await fill("phone", "+201001234567");
  await fill("email", "aya@example.com");
  await fill("address", "١٢ شارع النيل");
  await fill("city", "القاهرة");
  await next(); await next();
  await evaluate("document.querySelector('input[value=whatsapp]').click()");
  await next();
  await until(() => posts.length === 3, "WhatsApp POST");
  assert.equal(posts[2].body.submissionMethod, "whatsapp");
  assert.equal(await evaluate("Boolean(document.querySelector('[href^=\"https://wa.me/\"]'))"), false, "no handoff before save");
  await fulfill("whatsapp");
  await until(() => evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation]'))"), "saved WhatsApp confirmation");
  assert.equal(await evaluate("document.querySelector('[data-testid=checkout-confirmation]').textContent.includes('لم تُرسل رسالة WhatsApp بعد')"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('[data-testid=checkout-confirmation] a[href^=\"https://wa.me/\"]'))"), true);
  process.stdout.write("Guest checkout browser flow passed: desktop EN, mobile AR, validation, steps, timeout/retry, direct and WhatsApp mocked saves.\n");
} finally {
  await send("Fetch.disable");
  socket.close();
}
