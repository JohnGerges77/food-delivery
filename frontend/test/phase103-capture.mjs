import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targets = await fetch("http://127.0.0.1:9449/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target, "Headless Chrome page is available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { done, fail } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) fail(new Error(message.error.message)); else done(message.result);
});
function send(method, params = {}) { return new Promise((done, fail) => { const id = ++sequence; pending.set(id, { done, fail }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function waitFor(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise((done) => setTimeout(done, 150)); } throw new Error(`Page did not render: ${expression}`); }
const output = resolve("../docs/phase10.3");
await mkdir(output, { recursive: true });
try {
  for (const [slug, locale, page, width, height, name] of [
    ["phase103-cafe", "en", "", 1440, 900, "cafe-home-desktop-en"],
    ["phase103-cafe", "ar", "", 1440, 900, "cafe-home-desktop-ar"],
    ["phase103-cafe", "ar", "", 390, 844, "cafe-home-mobile-ar"],
    ["phase103-cafe", "en", "", 768, 900, "cafe-home-tablet-en"],
    ["phase103-cafe", "ar", "", 375, 812, "cafe-home-small-mobile-ar"],
    ["phase103-cafe", "en", "menu", 1440, 900, "cafe-menu-desktop-en"],
    ["phase103-cafe", "en", "menu", 768, 900, "cafe-menu-tablet-en"],
    ["phase103-cafe", "ar", "menu", 390, 844, "cafe-menu-mobile-ar"],
    ["phase103-cafe", "ar", "menu", 375, 812, "cafe-menu-small-mobile-ar"],
    ["phase103-cafe", "en", "menu/507f1f77bcf86cd799439041", 1440, 900, "cafe-product-desktop-en"],
    ["phase103-cafe", "ar", "menu/507f1f77bcf86cd799439041", 390, 844, "cafe-product-mobile-ar"],
    ["phase101-classic", "en", "menu", 1440, 900, "classic-menu-desktop-en"],
    ["phase101-classic", "ar", "menu", 390, 844, "classic-menu-mobile-ar"],
    ["phase102-aqua", "en", "menu", 1440, 900, "aqua-menu-desktop-en"],
    ["phase102-aqua", "ar", "menu", 390, 844, "aqua-menu-mobile-ar"],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: `http://127.0.0.1:3103/${locale}/r/${slug}/${page}` });
    await waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-storefront-theme]')`);
    await new Promise((done) => setTimeout(done, 450));
    const state = await evaluate(`(() => ({ theme: document.querySelector('[data-storefront-theme]')?.getAttribute('data-storefront-theme'), dir: document.documentElement.dir, font: getComputedStyle(document.body).fontFamily, overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth, cards: document.querySelectorAll('[data-menu-card]').length }))()`);
    assert.equal(state.theme, slug === "phase103-cafe" ? "savora-cafe" : slug === "phase102-aqua" ? "savora-aqua" : "savora-classic");
    assert.equal(state.dir, locale === "ar" ? "rtl" : "ltr");
    assert.equal(state.overflow, false, `${name} overflow`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(resolve(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    process.stdout.write(`${name}: ${JSON.stringify(state)}\n`);
  }
  for (const [width, height, locale, label] of [[390, 844, "ar", "mobile-ar"], [375, 812, "en", "small-mobile-en"]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: `http://127.0.0.1:3103/${locale}/r/phase103-cafe/menu/507f1f77bcf86cd799439041` });
    await waitFor("!!document.querySelector('[data-storefront-page=product] button')");
    await evaluate("document.querySelector('[data-storefront-page=product] button').click()");
    await waitFor("document.querySelector('[aria-label*=cart], [aria-label*=السلة]')?.textContent.includes('1')");
    await evaluate("document.querySelector('[data-storefront-page=product] a[href$=cart]')?.click()");
    await waitFor("document.querySelector('[data-storefront-page=cart]')?.textContent.includes('Espresso')");
    let state = await evaluate("({ overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth, page: document.querySelector('[data-storefront-page]')?.getAttribute('data-storefront-page') })");
    assert.equal(state.overflow, false, `${label} cart overflow`);
    await writeFile(resolve(output, `cafe-cart-${label}.png`), Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    process.stdout.write(`cafe-cart-${label}: ${JSON.stringify(state)}\n`);
    await evaluate("document.querySelector('[data-storefront-page=cart] a[href$=checkout]')?.click()");
    await waitFor("!!document.querySelector('[data-storefront-page=checkout] input')");
    state = await evaluate("({ overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth, page: document.querySelector('[data-storefront-page]')?.getAttribute('data-storefront-page') })");
    assert.equal(state.overflow, false, `${label} checkout overflow`);
    await writeFile(resolve(output, `cafe-checkout-${label}.png`), Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    process.stdout.write(`cafe-checkout-${label}: ${JSON.stringify(state)}\n`);
  }
} finally { socket.close(); }
