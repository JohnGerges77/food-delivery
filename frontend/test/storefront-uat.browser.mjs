import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.env.SAVORA_STOREFRONT_URL || "http://127.0.0.1:3192";
const baseline = process.env.SAVORA_UAT_BASELINE_URL;
const artifacts = process.env.SAVORA_UAT_ARTIFACTS;
const baselineOnly = process.env.SAVORA_UAT_BASELINE_ONLY === "1";
const port = process.env.SAVORA_CDP_PORT || "9472";
const demo = "savora-beta-demo";
for (const origin of [base, baseline].filter(Boolean)) {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use a local fixture storefront");
}
const target = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()))
  .find((entry) => entry.type === "page");
assert.ok(target, "An isolated local Chromium tab must be open");

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
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out at ${await evaluate("location.href")} waiting for ${expression}`);
}

async function navigate(origin, locale, slug, page = "") {
  const url = `${origin}/${locale}/r/${slug}${page}`;
  await send("Page.navigate", { url });
  await waitFor(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' &&
    document.fonts.status === 'loaded' && document.querySelector('[data-storefront-page] main')?.getBoundingClientRect().width > 0`);
}

async function resize(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width, height: width < 640 ? 844 : 900, mobile: width < 640, deviceScaleFactor: 1,
  });
}

async function capture(name, selector) {
  if (!artifacts) return;
  if (selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(artifacts, name + ".png"), Buffer.from(result.data, "base64"));
}

function menuGap() {
  return evaluate(`Math.round(document.querySelector('[data-menu-filters] input').getBoundingClientRect().top -
    document.querySelector('nav').getBoundingClientRect().bottom)`);
}

async function captureBaseline() {
  assert.ok(baseline, "Set SAVORA_UAT_BASELINE_URL to the unmodified local build");
  for (const width of [390, 1440]) {
    await resize(width);
    await navigate(baseline, "ar", demo, "/menu");
    await waitFor("!!document.querySelector('[data-menu-filters] input')");
    console.log(`Baseline Arabic menu ${width}px header-to-search: ${await menuGap()}px`);
    await capture(`before-ar-menu-${width}`);
    await navigate(baseline, "ar", demo);
    await waitFor("[...document.querySelectorAll('a h3')].some((h) => h.textContent === 'Cheese Burger')");
    await capture(`before-ar-home-${width}`, "a:has(h3)");
  }
}

async function checkLayouts() {
  await navigate(base, "en", demo);
  await evaluate("localStorage.clear()");
  const tenants = [demo, "phase102-aqua", "phase103-cafe", "phase104-luxury"];
  for (const slug of tenants) for (const locale of ["en", "ar"]) for (const width of [320, 360, 390, 1440]) {
    await resize(width);
    for (const page of ["", "/menu"]) {
      await navigate(base, locale, slug, page);
      const selector = page || slug === demo ? "[data-menu-card]" : "article:has(h3)";
      await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
      const layout = await evaluate(`(() => {
        const cards = [...document.querySelectorAll(${JSON.stringify(selector)})];
        return {
          width: document.documentElement.scrollWidth,
          dir: document.documentElement.dir,
          cards: cards.map((card) => {
            const title = card.querySelector('h3');
            const action = card.querySelector('[data-product-action]') || card.querySelector('a');
            const price = action?.hasAttribute('data-product-action') ? action.parentElement.firstElementChild : card.querySelector('strong');
            if (!title || !action) return { fits: false, reason: 'missing title or action' };
            const bounds = card.getBoundingClientRect();
            const text = title.getBoundingClientRect();
            const label = price?.getBoundingClientRect();
            const photo = card.querySelector('[data-menu-image]')?.getBoundingClientRect();
            const photoFits = !photo || (photo.width > 0 && photo.height > 0 &&
              (innerWidth >= 640 || Math.abs(photo.width - photo.height) <= 1));
            const overlaps = label && text.top < label.bottom && text.bottom > label.top &&
              text.left < label.right - 1 && text.right > label.left + 1;
            const fits = bounds.left >= -1 && bounds.right <= innerWidth + 1 &&
              title.clientWidth >= 80 && title.scrollWidth <= title.clientWidth + 1 &&
              text.left >= bounds.left - 1 && text.right <= bounds.right + 1 && !overlaps && photoFits &&
              action.getBoundingClientRect().width > 0;
            return { title: title.textContent, fits, overlaps, photoFits, left: bounds.left, right: bounds.right, titleWidth: title.clientWidth };
          }),
        };
      })()`);
      assert.equal(layout.dir, locale === "ar" ? "rtl" : "ltr");
      assert.ok(layout.width <= width && layout.cards.every((card) => card.fits),
        JSON.stringify({ slug, locale, viewport: width, page, ...layout }));
      if (slug === demo && locale === "ar" && [390, 1440].includes(width)) {
        if (page) {
          const gap = await menuGap();
          console.log(`Fixed Arabic menu ${width}px header-to-search: ${gap}px`);
          if (width === 390) assert.ok(gap >= 0 && gap <= 48, `Unexpected mobile menu gap: ${gap}px`);
        }
        await capture(`after-ar-${page ? "menu" : "home"}-${width}`,
          page ? undefined : 'section:has(a[href$="/menu"]) [data-menu-card]');
      }
    }
  }
  await resize(1010);
  await navigate(base, "en", "phase103-cafe", "/menu");
  await waitFor("!!document.querySelector('[data-menu-filters]')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-menu-filters]')).top"), "0px");
  console.log("64 layouts passed across four themes, two directions and four widths, plus the Café tablet filter check.");
}

async function checkOrdering() {
  await resize(390);
  await navigate(base, "en", demo);
  assert.match(await evaluate("document.title"), /Savora Beta Demo \| Savora/);
  assert.equal(await evaluate("document.querySelector('meta[property=\"og:title\"]').content"), "Savora Beta Demo | Savora");
  const favicon = await evaluate("document.querySelector('link[rel=icon]').href");
  assert.equal(new URL(favicon).pathname, "/logo.webp");
  assert.match((await fetch(favicon)).headers.get("content-type"), /image\/webp/);
  await evaluate("localStorage.clear()");
  await navigate(base, "en", demo);

  for (const entry of [
    { source: "", name: "Cheese Burger", choices: ["Single", "Double"], pick: 1 },
    { source: "/menu", name: "Pizza Margherita", choices: ["Small", "Medium", "Large"], pick: 1 },
  ]) {
    await navigate(base, "en", demo, entry.source);
    const card = `[...document.querySelectorAll('[data-menu-card]')].find((c) => c.querySelector('h3').textContent === ${JSON.stringify(entry.name)})`;
    const link = `(${card})?.querySelector('a[data-product-action]')`;
    await waitFor(`!!(${link})`);
    await evaluate(`${link}.click()`);
    await waitFor("!!document.querySelector('fieldset input[type=radio]')");
    assert.deepEqual(await evaluate("[...document.querySelectorAll('fieldset label')].map((label) => label.querySelector('span').textContent)"), entry.choices);
    assert.equal(await evaluate("!!document.querySelector('fieldset input:checked')"), false);
    await waitFor("Object.keys(document.querySelector('fieldset input')).some((key) => key.startsWith('__reactProps'))");
    assert.equal(await evaluate("document.querySelector('fieldset + button').disabled"), true);
    await evaluate(`document.querySelectorAll('fieldset input')[${entry.pick}].click()`);
    await waitFor("!document.querySelector('fieldset + button').disabled");
    await evaluate("document.querySelector('fieldset + button').click()");
    await waitFor("document.querySelector('main [role=status]')?.textContent === 'Added to cart.'");
  }

  await navigate(base, "en", demo, "/menu");
  await waitFor("[...document.querySelectorAll('[data-menu-filters] button')].some((b) => b.textContent === 'Sides' && Object.keys(b).some((k) => k.startsWith('__reactProps')))");
  await evaluate("[...document.querySelectorAll('[data-menu-filters] button')].find((b) => b.textContent === 'Sides').click()");
  await waitFor("document.querySelectorAll('[data-menu-card]').length === 1 && document.querySelector('[data-menu-card] h3').textContent === 'French Fries'");
  assert.equal(await evaluate("!!document.querySelector('[data-menu-card] [role=img]') && !document.querySelector('[data-menu-card] img')"), true);
  await evaluate("document.querySelector('[data-menu-card] button[data-product-action]').click()");
  await waitFor("document.querySelector('[data-menu-card] [role=status]')?.textContent === '1 in cart'");
  await navigate(base, "en", demo, "/cart");
  await waitFor("document.querySelector('main').textContent.includes('French Fries')");
  const text = await evaluate("document.querySelector('main').textContent");
  for (const expected of ["Double", "210", "Medium", "200", "French Fries", "60", "470"]) assert.ok(text.includes(expected), expected);
  console.log("Metadata, favicon, required variant selection, Sides filter, thumbnail fallback and EGP 470 persisted cart passed.");
}

async function checkPausedCheckout() {
  const slug = "phase101-paused";
  await navigate(base, "en", slug, "/menu");
  const button = "document.querySelector('[data-menu-card] button[data-product-action]')";
  await waitFor(`!!${button} && Object.keys(${button}).some((key) => key.startsWith('__reactProps'))`);
  await evaluate(button + ".click()");
  await waitFor("document.querySelector('[data-menu-card] [role=status]')?.textContent === '1 in cart'");
  for (const page of ["/cart", "/checkout"]) {
    await navigate(base, "en", slug, page);
    await waitFor("document.querySelector('main').textContent.includes('Delivery is currently unavailable, so orders are paused.')");
    await waitFor("document.querySelector('main dl dt')?.textContent === 'Subtotal'");
    const labels = await evaluate("[...document.querySelectorAll('main dl dt')].map((dt) => dt.textContent)");
    assert.ok(labels.includes("Subtotal"));
    assert.ok(!labels.includes("Delivery fee") && !labels.includes("Provisional total"));
    assert.equal(await evaluate("!!document.querySelector('main button[type=submit]')"), false);
  }
  console.log("Delivery pause is explicit and provisional fee and total are hidden in the cart and checkout.");
}

try {
  if (artifacts) await mkdir(artifacts, { recursive: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  if (baseline) await captureBaseline();
  if (!baselineOnly) {
    await checkLayouts();
    await checkOrdering();
    await checkPausedCheckout();
  }
} finally {
  socket.close();
}
