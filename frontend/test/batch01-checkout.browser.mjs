import assert from "node:assert/strict";

const beta = process.env.SAVORA_CHECKOUT_BETA_TEST === "1";
const method = process.env.SAVORA_CHECKOUT_METHOD_TEST || "whatsapp";
assert.ok(["direct", "whatsapp"].includes(method));
const base = process.env.SAVORA_STOREFRONT_URL || "http://localhost:3101";
const cdpPort = process.env.SAVORA_CDP_PORT || "9451";
const orderPath = "/api/public/restaurants/phase101-classic/orders";
const handoff = "https://wa.me/12025550100?text=" + encodeURIComponent(
  (beta ? "TEST ORDER — no payment or fulfillment.\n" : "") +
  "Savora Classic\nOrder SV-8341302408423A218E893F82\n1 x House beef burger @ 185 EGP\nTotal: 200 EGP");

const target = (await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json()))
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
    posts.push({ path: new URL(request.url).pathname, body: JSON.parse(request.postData) });
    const order = { orderNumber: "SV-8341302408423A218E893F82", status: "pending",
      submissionMethod: method, currency: "EGP", subtotal: 185,
      deliveryFee: 15, total: 200, savedInSavora: true };
    void send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 201,
      responseHeaders: [{ name: "Content-Type", value: "application/json" },
        { name: "Access-Control-Allow-Origin", value: "*" }],
      body: Buffer.from(JSON.stringify(method === "whatsapp" ?
        { order, whatsapp: { url: handoff, messageSent: false } } : { order })).toString("base64") });
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
  await send("Fetch.enable", { patterns: [{ urlPattern: "http://127.0.0.1:5179/api/public/restaurants/*/orders", requestStage: "Request" }] });
  for (const [locale, mobile] of [["en", false], ["ar", true]]) {
    await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1440,
      height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
    await send("Page.navigate", { url: `${base}/${locale}/r/phase101-classic/menu` });
    await waitFor("document.querySelector('[data-menu-card] button:last-child') && Object.keys(document.querySelector('[data-menu-card] button:last-child')).some((key) => key.startsWith('__reactProps'))");
    await evaluate("document.querySelector('[data-menu-card] button:last-child').click()");
    await evaluate("[...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname.endsWith('/cart')).click()");
    await waitFor("location.pathname.endsWith('/cart')");
    await evaluate("[...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname.endsWith('/checkout')).click()");
    await waitFor("location.pathname.endsWith('/checkout') && !!document.querySelector('form button[type=submit]')");
    assert.equal(await evaluate("document.documentElement.dir"), mobile ? "rtl" : "ltr");
    assert.equal(await evaluate("!!document.querySelector('input[name=fullName]')"), !beta);
    assert.equal(await evaluate("!!document.querySelector('input[name=email]')"), false);
    if (beta) {
      assert.equal(await evaluate("document.querySelector('main').textContent.includes(" +
        JSON.stringify(mobile ? "الطلبات للاختبار فقط" : "Test orders will not be prepared or delivered.") + ")"), true);
      assert.equal(await evaluate("document.querySelector('input[value=direct]').checked"), true);
    } else {
      for (const [field, value] of [["fullName", "Synthetic Guest"], ["phone", "+12025550199"],
        ["address", "Synthetic test address"], ["city", "Test City"]]) {
        await evaluate(`document.querySelector('[name=${field}]').focus()`);
        await send("Input.insertText", { text: value });
      }
      await evaluate("document.querySelector('form button[type=submit]').click()");
      await waitFor("!!document.querySelector('[data-testid=checkout-review]')");
      await evaluate("document.querySelector('form button[type=submit]').click()");
    }
    await waitFor("!!document.querySelector('[data-testid=checkout-methods]')");
    await evaluate(`document.querySelector('input[value=${method}]').click()`);
    assert.equal(await evaluate("!!document.querySelector('[data-testid=checkout-confirmation] a')"), false);
    await evaluate(mobile ? "window.open = () => null" :
      "window.open = () => ({ location: { replace: (url) => { window.handoffUrl = url; } } })");
    const before = posts.length;
    await evaluate("document.querySelector('form button[type=submit]').click()");
    await waitFor("!!document.querySelector('[data-testid=checkout-confirmation]')");
    assert.equal(posts.length, before + 1);
    const { path, body } = posts[before];
    assert.equal(path, orderPath);
    assert.equal(body.submissionMethod, method);
    assert.equal("customerName" in body, !beta);
    assert.equal("customerPhone" in body, !beta);
    assert.equal("total" in body, false);
    assert.equal("whatsappTarget" in body, false);
    const confirmation = await evaluate("document.querySelector('[data-testid=checkout-confirmation]').textContent");
    assert.match(confirmation, /15\.00/);
    assert.match(confirmation, /200\.00/);
    const link = "document.querySelector('[data-testid=checkout-confirmation] a[href^=\"https://wa.me/\"]')";
    if (method === "direct") {
      assert.equal(await evaluate("!!" + link), false);
      assert.equal(await evaluate("window.handoffUrl ?? null"), null);
      continue;
    }
    assert.equal(await evaluate(link + ".href"), handoff);
    assert.equal(await evaluate("window.handoffUrl ?? null"), mobile ? null : handoff);
    if (mobile) {
      await evaluate(link + ".addEventListener('click', (event) => event.preventDefault(), { once: true })");
      await evaluate(link + ".click()");
      assert.equal(posts.length, before + 1, "reopening the fallback link is local and never resubmits the Order");
    }
  }
  console.log(`${beta ? "Beta" : "Standard"} mocked ${method} checkout passed on desktop EN and mobile AR`);
} finally { socket.close(); }
