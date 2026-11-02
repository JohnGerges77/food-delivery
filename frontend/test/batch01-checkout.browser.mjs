import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = (await fetch("http://127.0.0.1:9451/json/list").then((response) => response.json()))
  .find((entry) => entry.type === "page");
assert.ok(target);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
let id = 0;
const pending = new Map();
const posts = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Fetch.requestPaused") {
    const request = message.params.request;
    if (request.method === "OPTIONS") {
      void send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 204,
        responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" },
          { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { name: "Access-Control-Allow-Headers", value: "Content-Type, Idempotency-Key" }] });
      return;
    }
    assert.equal(request.method, "POST");
    posts.push({ body: JSON.parse(request.postData), headers: request.headers });
    const order = { orderNumber: "SV-8341302408423A218E893F82", status: "pending",
      submissionMethod: "whatsapp", currency: "EGP", subtotal: 185,
      deliveryFee: 15, total: 200, savedInSavora: true };
    const url = "https://wa.me/201000000000?text=" + encodeURIComponent("Savora Classic\nOrder SV-8341302408423A218E893F82\n1 x House beef burger @ 185 EGP\nAya Hassan");
    void send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 201,
      responseHeaders: [{ name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "*" }],
      body: Buffer.from(JSON.stringify({ order, whatsapp: { url, messageSent: false } })).toString("base64") });
  }
  if (!pending.has(message.id)) return;
  const entry = pending.get(message.id); pending.delete(message.id);
  if (message.error) entry.fail(new Error(message.error.message));
  else entry.done(message.result);
});
const send = (method, params = {}) => new Promise((done, fail) => {
  const next = ++id; pending.set(next, { done, fail }); socket.send(JSON.stringify({ id: next, method, params }));
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
try {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://127.0.0.1:5179/api/public/restaurants/*/orders", requestStage: "Request" }] });
  await send("Page.navigate", { url: "http://localhost:3101/en/r/phase101-classic/menu" });
  await waitFor("document.querySelector('[data-menu-card] button:last-child') && Object.keys(document.querySelector('[data-menu-card] button:last-child')).some((key) => key.startsWith('__reactProps'))");
  await evaluate("document.querySelector('[data-menu-card] button:last-child').click()");
  await evaluate("[...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname.endsWith('/cart')).click()");
  await waitFor("location.pathname.endsWith('/cart')");
  await evaluate("[...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname.endsWith('/checkout')).click()");
  await waitFor("!!document.querySelector('input[name=fullName]')");
  assert.equal(await evaluate("!!document.querySelector('input[name=email]')"), false);
  for (const [field, value] of [["fullName", "Aya Hassan"], ["phone", "+201001234567"],
    ["address", "12 Nile Street"], ["city", "Cairo"]]) {
    await evaluate(`document.querySelector('[name=${field}]').focus()`);
    await send("Input.insertText", { text: value });
  }
  await evaluate("document.querySelector('form button[type=submit]').click()");
  await waitFor("!!document.querySelector('[data-testid=checkout-review]')");
  await evaluate("document.querySelector('form button[type=submit]').click()");
  await waitFor("!!document.querySelector('[data-testid=checkout-methods]')");
  assert.equal(await evaluate("document.querySelector('input[value=whatsapp]').checked"), true);
  await evaluate("window.open = () => null; document.querySelector('form button[type=submit]').click()");
  await waitFor("!!document.querySelector('[data-testid=checkout-confirmation]')");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.submissionMethod, "whatsapp");
  assert.equal("customerEmail" in posts[0].body, false);
  assert.equal("total" in posts[0].body, false);
  assert.equal(await evaluate("document.querySelector('[data-testid=checkout-confirmation]').textContent.includes('could not open automatically')"), true);
  assert.equal(await evaluate("document.querySelector('[data-testid=checkout-confirmation] a[href^=\"https://wa.me/\"]') !== null"), true);
  await evaluate("document.querySelector('nextjs-portal')?.remove()");
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(resolve("../docs/batch01/checkout-whatsapp-fallback-mobile-en.png"), Buffer.from(screenshot.data, "base64"));
  console.log("Mocked WhatsApp checkout: one POST, no email, saved confirmation, blocked popup fallback");
} finally { socket.close(); }
