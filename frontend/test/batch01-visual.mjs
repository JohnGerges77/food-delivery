import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targets = await fetch("http://127.0.0.1:9451/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!pending.has(message.id)) return;
  const { done, fail } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) fail(new Error(message.error.message));
  else done(message.result);
});
const send = (method, params = {}) => new Promise((done, fail) => {
  const next = ++id; pending.set(next, { done, fail });
  socket.send(JSON.stringify({ id: next, method, params }));
});
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Timed out: ${expression}`);
}
const output = resolve("../docs/batch01");
await mkdir(output, { recursive: true });
const themes = process.argv[2] ? [process.argv[2]] : ["phase101-classic", "phase102-aqua", "phase103-cafe", "phase104-luxury"];
const report = [];
try {
  for (const slug of themes) {
    for (const [locale, width, height] of [["en", 1440, 900], ["en", 768, 900], ["en", 390, 844], ["ar", 375, 812]]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      const base = `http://localhost:3101/${locale}/r/${slug}`;
      await send("Page.navigate", { url: base });
      await waitFor("document.readyState === 'complete' && !!document.querySelector('main')");
      await new Promise((done) => setTimeout(done, 900));
      const hero = await evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        dir: document.documentElement.dir,
        selectedImage: !![...document.images].find((image) => image.alt === 'Savora rice bowl' && image.complete && image.naturalWidth > 0),
        fallback: document.body.textContent.includes('Espresso') }))()`);
      assert.equal(hero.overflow, false, `${slug} home overflow at ${width}`);
      assert.equal(hero.dir, locale === "ar" ? "rtl" : "ltr");
      if (slug !== "phase103-cafe") assert.equal(hero.selectedImage, true, `${slug} selected Hero image`);
      else assert.equal(hero.fallback, true, "Café graphic/text fallback");
      if (width === 1440) {
        const image = await send("Page.captureScreenshot", { format: "png" });
        await writeFile(resolve(output, `${slug}-hero-desktop.png`), Buffer.from(image.data, "base64"));
      }
      await send("Page.navigate", { url: `${base}/menu` });
      await waitFor("document.querySelectorAll('[data-menu-card]').length >= 4");
      await waitFor("Object.keys(document.querySelector('[data-menu-card] > button')).some((key) => key.startsWith('__reactProps'))");
      await new Promise((done) => setTimeout(done, 750));
      const menu = await evaluate(`(() => { const card = document.querySelector('[data-menu-card]');
        const image = card.querySelector('[data-menu-image]');
        const add = card.querySelector('button:last-child');
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          cardHeight: Math.round(card.getBoundingClientRect().height),
          imageWidth: Math.round(image.getBoundingClientRect().width),
          addWidth: Math.round(add.getBoundingClientRect().width),
          addHeight: Math.round(add.getBoundingClientRect().height),
          font: getComputedStyle(document.body).fontFamily }; })()`);
      assert.equal(menu.overflow, false, `${slug} menu overflow at ${width}`);
      assert.ok(menu.addWidth >= 44 && menu.addHeight >= 44, `${slug} touch target`);
      if (width < 600) assert.ok(menu.cardHeight <= 175 && menu.imageWidth <= 110, `${slug} compact mobile card: ${JSON.stringify(menu)}`);
      if (width === 390 || width === 375) {
        await evaluate("document.querySelector('nextjs-portal')?.remove(); document.querySelector('[data-menu-card]').scrollIntoView({ block: 'center' })");
        await new Promise((done) => setTimeout(done, 200));
        const image = await send("Page.captureScreenshot", { format: "png" });
        await writeFile(resolve(output, `${slug}-menu-${locale}-${width}.png`), Buffer.from(image.data, "base64"));
        assert.equal(await evaluate("(() => { const button = document.querySelector('[data-menu-card] > button'); button.focus(); return document.activeElement === button; })()"), true);
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await waitFor("!!document.querySelector('[role=dialog]')");
        await evaluate("document.querySelector('[role=dialog] button').click()");
        await waitFor("!document.querySelector('[role=dialog]')");
        await evaluate("document.querySelector('[data-menu-card] button:last-child').click()");
        const cart = await evaluate(`(() => ({ dialog: !!document.querySelector('[role=dialog]'),
          count: [...document.querySelectorAll('a[aria-label]')].find((a) => /cart|السلة/i.test(a.getAttribute('aria-label') || ''))?.textContent,
          animated: !!document.querySelector('.cart-add-attention') }))()`);
        assert.equal(cart.dialog, false, `${slug} Add is independent`);
        assert.equal(cart.animated, true, `${slug} cart attention`);
        assert.match(cart.count ?? "", /1/, `${slug} cart count`);
        assert.equal(await evaluate("(() => { const button = document.querySelector('[data-menu-card] > button'); button.focus(); return document.activeElement === button; })()"), true);
      }
      report.push({ slug, locale, width, hero, menu });
    }
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:3101/ar/r/phase101-classic/checkout" });
  await waitFor("!!document.querySelector('form')");
  assert.equal(await evaluate("!!document.querySelector('input[name=email]')"), false);
  const checkout = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(resolve(output, "checkout-no-email-mobile-ar.png"), Buffer.from(checkout.data, "base64"));
  console.log(JSON.stringify(report, null, 2));
} finally { socket.close(); }
