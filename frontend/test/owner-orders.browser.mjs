import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Run with local Next and Chrome CDP. Every owner API request is intercepted.
const port = process.env.SAVORA_CDP_PORT || "9335";
const base = process.env.SAVORA_STOREFRONT_URL || "http://localhost:3000";
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const requests = [];
const errors = [];
const direct = { id: "507f1f77bcf86cd799439011", orderNumber: "SV-8341302408423A218E893F82", customerName: "Aya Hassan",
  customerPhone: "+201001234567", customerEmail: "aya@example.com", deliveryAddress: "12 Nile Street",
  city: "Cairo", items: [{ productId: "507f1f77bcf86cd799439012", name: "Historical Burger", unitPrice: 200,
    quantity: 2, imageUrl: null, notes: "No onions" }], subtotal: 400, deliveryFee: 25, total: 425,
  status: "pending", source: "website", submissionMethod: "direct", notes: "Ring bell",
  createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z", deliveredAt: null };
const whatsapp = { ...direct, id: "507f1f77bcf86cd799439013", orderNumber: "SV-AABBCCDD", customerName: "Samir Ali",
  customerPhone: "+201009999999", customerEmail: null, submissionMethod: "whatsapp", total: 0,
  subtotal: 0, items: [{ ...direct.items[0], unitPrice: 0, quantity: 1, notes: null }] };
let order = direct;
let patchMode = "conflict";
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function fulfill(requestId, body, code = 200) {
  await send("Fetch.fulfillRequest", { requestId, responseCode: code,
    responseHeaders: [{ name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: new URL(base).origin },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      { name: "Access-Control-Allow-Methods", value: "GET, PATCH, OPTIONS" },
      { name: "Access-Control-Allow-Headers", value: "Content-Type, X-Savora-CSRF" }],
    body: Buffer.from(JSON.stringify(body)).toString("base64") });
}
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Fetch.requestPaused") {
    const { requestId, request } = message.params;
    const url = new URL(request.url);
    requests.push({ method: request.method, path: url.pathname, query: url.search, body: request.postData });
    let reply;
    let code = 200;
    if (request.method === "OPTIONS") { reply = {}; code = 204; }
    else if (url.pathname === "/api/auth/me") reply = { user: { id: "507f1f77bcf86cd799439015", name: "Owner", email: "owner@example.com" },
      restaurant: { id: "507f1f77bcf86cd799439016", name: "Savora", slug: "savora-demo", currency: "EGP" } };
    else if (url.pathname === "/api/auth/csrf") reply = { csrfToken: "a".repeat(64) };
    else if (url.pathname === "/api/owner/orders" && request.method === "GET") {
      let filtered = [order, whatsapp];
      if (url.searchParams.get("statusGroup")) filtered = filtered.filter((entry) =>
        (entry.status === "delivered" || entry.status === "cancelled" ? entry.status : "pending") === url.searchParams.get("statusGroup"));
      if (url.searchParams.get("submissionMethod")) filtered = filtered.filter((entry) => entry.submissionMethod === url.searchParams.get("submissionMethod"));
      if (url.searchParams.get("orderNumber")) filtered = filtered.filter((entry) => entry.orderNumber === url.searchParams.get("orderNumber"));
      const page = Number(url.searchParams.get("page"));
      const limit = Number(url.searchParams.get("limit"));
      reply = { orders: filtered.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: filtered.length, hasNext: page * limit < filtered.length } };
    } else if (url.pathname === `/api/owner/orders/${direct.id}` && request.method === "GET") reply = { order };
    else if (url.pathname === `/api/owner/orders/${whatsapp.id}` && request.method === "GET") reply = { order: whatsapp };
    else if (url.pathname === `/api/owner/orders/${direct.id}/status` && request.method === "PATCH") {
      if (patchMode === "conflict") { order = { ...order, status: "preparing" }; reply = { error: "Order status conflict" }; code = 409; patchMode = "success"; }
      else { order = { ...order, status: "delivered", deliveredAt: "2026-10-19T12:00:00.000Z" }; reply = { order }; }
    } else { reply = { error: "Unexpected mocked request" }; code = 500; errors.push(`${request.method} ${url.pathname}`); }
    void fulfill(requestId, reply, code).catch((error) => errors.push(error.message));
  }
  if (!message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await delay(200); }
  throw new Error(`Timed out: ${label}`);
}
async function click(expression) { assert.equal(await evaluate(expression), true); }
async function screenshot(name) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const path = join(process.env.TEMP, name);
  await writeFile(path, Buffer.from(result.data, "base64"));
  process.stdout.write(`Screenshot: ${path}\n`);
}
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*://localhost:5000/api/*", requestStage: "Request" }] });
  await send("Page.navigate", { url: `${base}/en/dashboard/orders` });
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 2"), "English orders");
  assert.equal(await evaluate("document.body.textContent.includes('Aya Hassan') && document.body.textContent.includes('Samir Ali')"), true);
  assert.equal(await evaluate("document.body.textContent.includes('Maya Hassan')"), false, "no fixture customer");
  assert.equal(await evaluate("document.querySelector('[data-testid=owner-orders-list]').textContent.includes('EGP')"), true);
  await click("(() => { const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Pending'); if (!button) return false; button.click(); return true; })()");
  await until(() => requests.some((request) => request.query.includes('statusGroup=pending')), "grouped Pending filter");
  await click("(() => { const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'All Orders'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 2"), "all Orders restored");
  await delay(900); await screenshot("savora-owner-orders-phase86-desktop-en.png");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.includes('Arial')"), true, "English font unchanged");
  await click("(() => { const button = [...document.querySelectorAll('[data-testid=owner-orders-list] article button')].find((el) => el.textContent.trim() === 'View'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("document.querySelector('[role=dialog]')?.textContent.includes('Historical Burger')"), "detail snapshot");
  assert.equal(await evaluate("document.querySelector('[role=dialog]').textContent.includes('No onions')"), true);
  assert.equal(await evaluate("document.querySelector('[role=dialog]').textContent.includes('425')"), true);
  await click("(() => { const button = [...document.querySelectorAll('[role=dialog] button')].find((el) => el.textContent.trim() === 'Mark as Delivered'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("Boolean(document.querySelector('[data-testid=status-confirmation]'))"), "status confirmation");
  assert.equal(requests.filter((request) => request.method === "PATCH").length, 0, "no mutation before confirmation");
  await click("(() => { const button = [...document.querySelectorAll('[role=dialog] button')].find((el) => el.textContent.includes('Confirm Status')); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('changed on the server')"), "409 conflict");
  assert.equal(await evaluate("document.querySelector('[role=dialog]').textContent.includes('Mark as Delivered')"), true, "legacy state can finish");
  await click("(() => { const button = [...document.querySelectorAll('[role=dialog] button')].find((el) => el.textContent.trim() === 'Mark as Delivered'); if (!button) return false; button.click(); return true; })()");
  await click("(() => { const button = [...document.querySelectorAll('[role=dialog] button')].find((el) => el.textContent.includes('Confirm Status')); if (!button) return false; button.click(); return true; })()");
  await until(() => requests.filter((request) => request.method === "PATCH").length === 2, "second PATCH");
  await until(() => evaluate("document.body.textContent.includes('Order SV-8341302408423A218E893F82 updated.')"), "canonical success");
  assert.deepEqual(requests.filter((request) => request.method === "PATCH").map((request) => JSON.parse(request.body)), [{ status: "delivered" }, { status: "delivered" }]);
  assert.ok(requests.some((request) => request.path === `/api/owner/orders/${direct.id}` && request.method === "GET"), "detail refetched");
  await click("(() => { const button = document.querySelector('[role=dialog] button[aria-label=\"Close modal\"]'); if (!button) return false; button.click(); return true; })()");
  await evaluate("document.querySelector('form input[type=search]').focus()");
  await send("Input.insertText", { text: direct.orderNumber });
  await click("(() => { const button = [...document.querySelectorAll('form button')].find((el) => el.textContent.trim() === 'Find'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 1"), "exact order lookup");
  assert.ok(requests.some((request) => request.query.includes(`orderNumber=${direct.orderNumber}`)), "server received exact reference");
  await click("(() => { const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Reset'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 2"), "reset filters");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `${base}/ar/dashboard/orders` });
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 2"), "Arabic orders");
  assert.equal(await evaluate("document.body.textContent.includes('الطلبات')"), true);
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic Tajawal loaded");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('button')).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic action font");
  await click("(() => { const button = [...document.querySelectorAll('[data-testid=owner-orders-list] article button')].find((el) => el.textContent.trim() === 'عرض'); if (!button) return false; button.click(); return true; })()");
  await until(() => evaluate("Boolean(document.querySelector('[role=dialog]'))"), "Arabic order dialog");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=dialog]')).fontFamily.toLowerCase().includes('tajawal')"), true, "Arabic dialog font");
  await delay(900); await screenshot("savora-owner-orders-phase86-mobile-ar.png");
  await click("(() => { const button = document.querySelector('[role=dialog] button[aria-label=\"Close modal\"]'); if (!button) return false; button.click(); return true; })()");
  await click("(() => { const button = [...document.querySelectorAll('[data-testid=owner-orders-list] article')][1] && [...document.querySelectorAll('[data-testid=owner-orders-list] article')][1].querySelectorAll('button'); const cancel = [...(button || [])].find((el) => el.textContent.trim() === 'إلغاء الطلب'); if (!cancel) return false; cancel.click(); return true; })()");
  await until(() => evaluate("Boolean(document.querySelector('[data-testid=status-confirmation]'))"), "Arabic cancellation confirmation");
  assert.equal(requests.filter((request) => request.method === "PATCH").length, 2, "cancellation not sent before confirmation");
  await send("Page.navigate", { url: `${base}/en/dashboard/orders` });
  await until(() => evaluate("document.querySelectorAll('[data-testid=owner-orders-list] article').length === 2"), "English mobile orders");
  assert.equal(await evaluate("getComputedStyle(document.body).fontFamily.includes('Arial') && document.documentElement.dir === 'ltr'"), true, "English mobile font and direction");
  assert.deepEqual(errors, [], "all owner requests were mocked");
  process.stdout.write("Owner Orders browser flow passed: desktop EN and mobile AR, real DTO rendering, detail, 409 refresh and confirmed PATCH with mocked API.\n");
} finally { await send("Fetch.disable"); socket.close(); }
