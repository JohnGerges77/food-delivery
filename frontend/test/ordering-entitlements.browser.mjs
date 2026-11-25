import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const storefront = "http://127.0.0.1:3193";
const api = "http://127.0.0.1:5179";
const artifacts = process.env.SAVORA_ENTITLEMENT_SCREENSHOTS;
const port = process.env.SAVORA_CDP_PORT || "9472";
const tenant = "savora-beta-demo";
const adminId = "507f1f77bcf86cd799439099";
const target = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()))
  .find((entry) => entry.type === "page");
assert.ok(target, "Start an isolated Chromium tab with local CDP");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const call = pending.get(message.id);
  if (!call) return;
  pending.delete(message.id);
  if (message.error) call.reject(new Error(message.error.message));
  else call.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(++sequence, { resolve, reject });
    socket.send(JSON.stringify({ id: sequence, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || expression);
  return response.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out at ${await evaluate("location.href")} waiting for ${expression}`);
}
const element = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const hydrated = (selector) => `!!${element(selector)} && Object.keys(${element(selector)}).some((key) => key.startsWith('__reactProps'))`;
async function click(selector) {
  await waitFor(hydrated(selector));
  await evaluate(element(selector) + ".click()");
}
async function visit(path, selector, expected = path) {
  await send("Page.navigate", { url: storefront + path });
  await waitFor(`location.pathname === ${JSON.stringify(expected)} &&
    document.readyState === 'complete' && ${element(selector)}?.getBoundingClientRect().width > 0`);
}
async function resize(width) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: width < 640 ? 844 : 930,
    mobile: width < 640, deviceScaleFactor: 1 });
}
async function capture(file, selector) {
  if (!artifacts) return;
  if (selector) await evaluate(element(selector) + ".scrollIntoView({ block: 'center', behavior: 'instant' })");
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(artifacts, file + ".png"), Buffer.from(result.data, "base64"));
}
function assertMenuOnly() {
  return evaluate(`(() => {
    const root = document.querySelector('[data-storefront-page]');
    return !root.querySelector('a[href$="/cart"],a[href$="/checkout"],[data-product-action],button[aria-label^="Add to cart"],input[type=radio]')
      && !/Ordering Information|Delivery is|add it straight to your cart|معلومات الطلب|التوصيل متاح|أضفه مباشرة إلى سلتك/.test(root.textContent);
  })()`).then((value) => assert.equal(value, true));
}
async function testDigitalMenus() {
  for (const theme of ["classic", "aqua", "cafe", "luxury"]) {
    for (const locale of ["en", "ar"]) for (const width of [390, 1440]) {
      await resize(width);
      const path = `/${locale}/r/menu-only-${theme}`;
      for (const page of ["", "/menu"]) {
        await visit(path + page, "[data-storefront-page] main");
        await assertMenuOnly();
        assert.equal(await evaluate("document.documentElement.dir"), locale === "ar" ? "rtl" : "ltr");
        assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
        assert.equal(await evaluate("document.querySelector('[data-storefront-page]').style.getPropertyValue('--sf-primary')"), "#89cff0");
        if (page) assert.ok(await evaluate("!!document.querySelector('[data-menu-card] a[href*=menu]')"));
        if (width === 390 && locale === "ar" && page) await capture(`menu-only-${theme}-ar-mobile`);
      }
    }
  }
  const path = "/ar/r/" + tenant;
  await resize(390);
  await visit(path + "/cart", "[data-menu-card]", path + "/menu");
  await visit(path + "/checkout", "[data-menu-card]", path + "/menu");
  const product = await evaluate("document.querySelector('[data-menu-card] a').pathname");
  await visit(product, "main h1");
  await assertMenuOnly();
  assert.match(await evaluate("document.querySelector('main').textContent"), /200/);
  await capture("menu-only-variants-ar-mobile");
  console.log("32 digital storefront layouts, four themes, two directions, preserved branding and variant prices, and stale routes passed");
}

const entitlement = "[data-testid=ordering-entitlement]";
const editMode = entitlement + " select";
const saveMode = entitlement + " button";
async function enableOrdering() {
  await resize(1440);
  await visit("/en/admin/restaurants/" + adminId, entitlement);
  await waitFor(hydrated(editMode));
  assert.equal(await evaluate(element(editMode) + ".value"), "false");
  await capture("platform-admin-menu-only", entitlement);
  await evaluate(`(() => { const input = ${element(editMode)}; input.value = 'true'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor("!" + element(saveMode) + ".disabled");
  await click(saveMode);
  await waitFor(element(entitlement + " [role=status]") + "?.textContent === 'Ordering mode saved.'");
  await capture("platform-admin-ordering-enabled", entitlement);
}

async function validateOrdering() {
  const path = "/en/r/" + tenant;
  await resize(390);
  await visit(path + "/menu", "[data-menu-card]");
  await waitFor("!!document.querySelector('nav a[href$=\"/cart\"]')");
  await capture("ordering-enabled-menu-en-mobile");
  const product = await evaluate("document.querySelector('[data-menu-card] a[data-product-action]').pathname");
  await visit(product, "main fieldset");
  assert.equal(await evaluate(element("main fieldset + button") + ".disabled"), true);
  await click("main fieldset label:nth-of-type(2) input");
  await click("main fieldset + button");
  await waitFor("document.querySelector('main').textContent.includes('Added to cart.')");
  await visit("/ar/r/" + tenant + "/checkout", "form button[type=submit]");
  await waitFor("!document.querySelector('form button[type=submit]').disabled");
  await click("form button[type=submit]");
  const receipt = "[data-testid=checkout-confirmation]";
  await waitFor(element(receipt + " bdi") + "?.textContent === '#1001'");
  await waitFor(`(() => {
    const filter = getComputedStyle(${element(receipt)}.closest('form')).filter;
    return filter === 'none' || filter === 'blur(0px)';
  })()`);
  await capture("customer-order-1001-ar-mobile", receipt);

  await resize(1440);
  await visit("/en/dashboard/orders", "main");
  await waitFor("document.querySelector('main bdi')?.textContent === '#1001'");
  const search = "input[placeholder='Order number or legacy reference']";
  await waitFor(hydrated(search));
  await evaluate(element(search) + ".focus()");
  await send("Input.insertText", { text: "#1001" });
  await evaluate(element(search) + ".closest('form').requestSubmit()");
  await waitFor("document.querySelector('main bdi')?.textContent === '#1001'");
  await capture("owner-orders-1001-en-desktop", "main bdi");

  await visit(path + "/menu", "[data-menu-card] button");
  await click("[data-menu-card] button[data-product-action]");
  await visit(path + "/checkout", "form button[type=submit]");
  await waitFor("!document.querySelector('form button[type=submit]').disabled");
  const response = await fetch(api + `/api/admin/restaurants/${adminId}/ordering`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "X-Savora-CSRF": "a".repeat(64) },
    body: JSON.stringify({ onlineOrderingEnabled: false }),
  });
  assert.equal(response.status, 200);
  await click("form button[type=submit]");
  await waitFor(`location.pathname === '${path}/menu' && !!document.querySelector('[data-menu-card]')`);
  await assertMenuOnly();
  await visit("/en/dashboard/settings", "#settings-primaryColor");
  assert.match(await evaluate("document.querySelector('main').textContent"), /Digital Menu Only/);
  assert.equal(await evaluate("!!document.querySelector('#settings-deliveryFee, #settings-whatsapp')"), false);
  await visit("/en/dashboard/orders", "main");
  await waitFor("document.querySelector('main bdi')?.textContent === '#1001'");
  console.log("Platform switch, enabled storefront, #1001 receipt and owner search, disabled stale checkout, and Owner history passed");
}

try {
  if (artifacts) await mkdir(artifacts, { recursive: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await testDigitalMenus();
  await enableOrdering();
  await validateOrdering();
} finally { socket.close(); }
