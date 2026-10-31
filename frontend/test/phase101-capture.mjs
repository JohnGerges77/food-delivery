import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const stage = process.argv[2];
assert.ok(["before", "after"].includes(stage), "Pass before or after");
const targets = await fetch("http://127.0.0.1:9447/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target, "Headless Chrome page is available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done, fail) => {
  socket.addEventListener("open", done, { once: true });
  socket.addEventListener("error", fail, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { done, fail } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) fail(new Error(message.error.message));
  else done(message.result);
});
function send(method, params = {}) {
  return new Promise((done, fail) => {
    const id = ++sequence;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitForMenu() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.querySelectorAll('main article').length >= 4 && document.readyState === 'complete'")) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Menu fixture did not render");
}
const output = resolve("../docs/phase10.1");
await mkdir(output, { recursive: true });
try {
  for (const [locale, width, height, label] of [["en", 1440, 900, "desktop-en"], ["ar", 390, 844, "mobile-ar"]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: `http://localhost:3101/${locale}/r/phase101-classic/menu` });
    await waitForMenu();
    await new Promise((done) => setTimeout(done, 450));
    const measurements = await evaluate(`(() => {
      const card = document.querySelector('main article');
      const image = card.querySelector('[class*=aspect-]');
      const button = [...card.querySelectorAll('button')].find((entry) => entry.textContent.includes('Add') || entry.textContent.includes('أضف'));
      const categoryBadge = image.querySelector('[class*=left-4][class*=top-4]');
      const featuredBadge = image.querySelector('[class*=right-4][class*=bottom-4], [class*=right-4][class*=top-4]');
      const rect = (element) => { const value = element.getBoundingClientRect(); return { width: Math.round(value.width), height: Math.round(value.height) }; };
      return { card: rect(card), image: rect(image), button: rect(button), dir: document.documentElement.dir,
        font: getComputedStyle(document.body).fontFamily, overflow: document.documentElement.scrollWidth > innerWidth,
        badgeOverlap: Boolean(categoryBadge && featuredBadge && (() => {
          const a = categoryBadge.getBoundingClientRect(); const b = featuredBadge.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        })()) };
    })()`);
    assert.equal(measurements.dir, locale === "ar" ? "rtl" : "ltr");
    assert.equal(measurements.overflow, false, `${label} horizontal overflow`);
    if (stage === "after") assert.equal(measurements.badgeOverlap, false, `${label} badge overlap`);
    assert.ok(measurements.button.height >= 44, `${label} usable add button`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const path = resolve(output, `classic-menu-${stage}-${label}.png`);
    await writeFile(path, Buffer.from(screenshot.data, "base64"));
    process.stdout.write(`${path}\n${JSON.stringify(measurements)}\n`);
  }
} finally { socket.close(); }
