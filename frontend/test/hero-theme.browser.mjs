import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = "http://127.0.0.1:3192";
const baseline = "http://127.0.0.1:3191";
const screenshots = process.env.SAVORA_HERO_SCREENSHOTS;
const port = process.env.SAVORA_CDP_PORT || "9472";
const demo = "savora-beta-demo";
const tab = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()))
  .find((target) => target.type === "page");
assert.ok(tab, "Start the isolated local Chromium tab");

const socket = new WebSocket(tab.webSocketDebuggerUrl);
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
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
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

async function visit(path, selector, origin = base) {
  const url = origin + path;
  await send("Page.navigate", { url });
  await waitFor(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' &&
    document.fonts.status === 'loaded' && document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().width > 0`);
}

async function resize(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height: width <= 768 ? 844 : 1000, mobile: width < 640, deviceScaleFactor: 1,
  });
  await waitFor(`innerWidth === ${width}`);
}

async function capture(name) {
  if (!screenshots) return;
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(screenshots, name + ".png"), Buffer.from(result.data, "base64"));
}

async function compareHero() {
  for (const locale of ["en", "ar"]) for (const width of [390, 1440]) {
    await resize(width);
    const path = `/${locale}/r/${demo}`;
    await visit(path, "main h1", baseline);
    await evaluate("document.querySelector('main section img')?.decode().catch(() => {})");
    await capture(`before-classic-${locale}-${width}`);
    await visit(path, "[data-classic-hero]");
    await waitFor("Boolean(document.querySelector('[data-classic-hero] img')?.naturalWidth)");
    const photo = await evaluate(`(() => {
      const hero = document.querySelector('[data-classic-hero]');
      const image = hero.querySelector('img');
      return { source: image.currentSrc, fit: getComputedStyle(image).objectFit,
        dir: getComputedStyle(image).transform, width: image.clientWidth, height: hero.clientHeight,
        pageWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth,
        transform: image.style.filter };
    })()`);
    assert.match(photo.source, /savora-hero-wide\.webp/);
    assert.equal(photo.fit, "cover");
    assert.equal(photo.width, photo.viewportWidth);
    assert.ok(photo.height > 480 && photo.height < 850);
    assert.ok(photo.pageWidth <= width);
    assert.equal(photo.transform, "");
    assert.equal(photo.dir, locale === "ar" ? "matrix(-1, 0, 0, 1, 0, 0)" : "none");
    assert.equal(await evaluate("document.querySelectorAll('[data-classic-hero] a').length"), 2);
    await capture(`after-classic-${locale}-${width}`);
  }
}

const presets = { classic: "#ff7a00", aqua: "#06363a", cafe: "#5b3827", luxury: "#2f472d" };
const colors = { default: null, sky: "#89cff0", dark: "#000000", light: "#ffffff" };
const widths = [320, 360, 390, 768, 1440, 1920];
const storefront = "[data-storefront-page]";
const button = "document.querySelector('[data-menu-card] button[data-product-action]')";

async function testMatrix(quick) {
  let count = 0;
  for (const theme of Object.keys(presets)) for (const color of Object.keys(colors)) for (const locale of ["en", "ar"]) {
    if (quick && (locale !== "en" || !["default", "sky"].includes(color))) continue;
    const slug = `theme-${theme}-${color}`;
    const path = `/${locale}/r/${slug}`;
    for (const page of ["home", "menu", "cart", "checkout"]) {
      await visit(page === "home" ? path : `${path}/${page}`, storefront + " main");
      if (page === "home") {
        const photo = theme === "classic" ? "[data-classic-hero] img" : "[data-tenant-hero] img";
        if (color === "sky") {
          await waitFor(`Boolean(document.querySelector('${photo}')?.naturalWidth)`);
          assert.match(await evaluate(`document.querySelector('${photo}').currentSrc`), /best3\.webp/);
        } else if (theme === "classic") {
          assert.ok(!(await evaluate("document.querySelector('[data-classic-hero] img')?.src.includes('savora-hero-wide')")));
        }
      }
      if (page === "menu") {
        await waitFor(`!!${button} && Object.keys(${button}).some((key) => key.startsWith('__reactProps'))`);
        await evaluate(button + ".click()");
      }
      if (page === "cart") await waitFor("document.querySelector('main dl dt')?.textContent");
      if (page === "checkout") await waitFor("!!document.querySelector('form button[type=submit]')");
      for (const width of quick ? [390, 1440] : widths) {
        await resize(width);
        const data = await evaluate(`(() => {
          const root = document.querySelector('${storefront}');
          const style = getComputedStyle(root);
          const card = document.querySelector('[data-menu-card]');
          const action = document.querySelector('[data-product-action], main .storefront-action');
          const cardFits = !card || (card.getBoundingClientRect().left >= -1 && card.getBoundingClientRect().right <= innerWidth + 1);
          return { theme: root.dataset.storefrontTheme, accent: style.getPropertyValue('--sf-primary').trim(),
            custom: root.hasAttribute('data-custom-accent'), dir: document.documentElement.dir,
            documentWidth: document.documentElement.scrollWidth, cardFits,
            buttonColor: action && getComputedStyle(action).color,
            buttonBackground: action && getComputedStyle(action).backgroundColor,
            buttonImage: action && getComputedStyle(action).backgroundImage };
        })()`);
        const context = JSON.stringify({ theme, color, locale, page, width, ...data });
        assert.equal(data.theme, "savora-" + theme, context);
        assert.equal(data.accent, colors[color] ?? presets[theme], context);
        assert.equal(data.custom, color !== "default", context);
        assert.equal(data.dir, locale === "ar" ? "rtl" : "ltr", context);
        assert.ok(data.documentWidth <= width && data.cardFits, context);
        if (page === "menu") assert.match(data.buttonBackground, /^rgb\(/, context);
        if (page === "cart") assert.match(data.buttonImage, /^linear-gradient/, context);
        if ((width === 390 || width === 1440) && color === "sky" && locale === "en" && page !== "checkout") {
          await capture(`after-${theme}-sky-${page}-${width}`);
        }
        count++;
      }
    }
  }
  console.log(`${count} storefront combinations passed`);
}

async function fill(selector, value) {
  await evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); field.focus(); field.select(); })()`);
  await send("Input.insertText", { text: value });
}

async function testOwner() {
  await resize(1440);
  const settings = "/en/dashboard/settings";
  const primary = "#settings-primaryColor";
  const picture = "#settings-heroImageUrl";
  const managedStore = "/en/r/phase101-classic";
  const picker = "input[data-primary-picker]";
  const reset = "[...document.querySelectorAll('button')].find((button) => button.textContent === 'Reset to Theme Default')";
  await visit(settings, primary);
  await waitFor(`Object.keys(document.querySelector('${primary}')).some((key) => key.startsWith('__reactProps'))`);
  await fill(primary, "#89CFF0");
  await fill(picture, base + "/best1.webp");
  assert.equal(await evaluate(`document.querySelector('${picker}').value`), "#89cff0");
  assert.equal(await evaluate("document.querySelector('[data-custom-accent]').style.getPropertyValue('--sf-primary')"), "#89cff0");
  await capture("after-owner-hero-image-1440");
  await evaluate(`document.querySelector('${primary}').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await capture("after-owner-branding-1440");
  const save = "document.querySelector('form button[type=submit]')";
  await evaluate(save + ".click()");
  await waitFor("document.body.textContent.includes('Settings saved')");
  await visit(managedStore, "[data-classic-hero]");
  await waitFor("document.querySelector('[data-classic-hero] img')?.naturalWidth");
  assert.equal(await evaluate("document.querySelector('[data-classic-hero] img').currentSrc"), base + "/best1.webp");
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${storefront}')).getPropertyValue('--sf-primary').trim()`), "#89cff0");
  await visit("/en/r/theme-cafe-default", storefront + " h1");
  assert.equal(await evaluate(`document.querySelector('${storefront}').hasAttribute('data-custom-accent')`), false);
  await visit(settings, primary);
  assert.equal(await evaluate(`document.querySelector('${primary}').value`), "#89CFF0");
  assert.equal(await evaluate(`document.querySelector('${picture}').value`), base + "/best1.webp");
  await waitFor(`Object.keys(document.querySelector('${primary}')).some((key) => key.startsWith('__reactProps'))`);
  await evaluate(reset + ".click()");
  await waitFor(`document.querySelector('${primary}').value === '' && !(${save}).disabled`);
  await evaluate(save + ".click()");
  await waitFor("document.body.textContent.includes('Settings saved')");
  await visit(managedStore, "[data-classic-hero]");
  assert.equal(await evaluate(`document.querySelector('${storefront}').hasAttribute('data-custom-accent')`), false);
  await visit("/en/admin/login", "form");
  assert.equal(await evaluate("!!document.querySelector('[data-storefront-theme]')"), false);
  console.log("Owner preview/save/refresh/reset, independent restaurant, and Platform Admin theme isolation passed");
}

try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await resize(1440);
  await visit(`/en/r/${demo}`, "main h1", screenshots ? baseline : base);
  if (screenshots) await compareHero();
  await testMatrix(process.env.SAVORA_HERO_QUICK === "1");
  await testOwner();
} finally {
  socket.close();
}
