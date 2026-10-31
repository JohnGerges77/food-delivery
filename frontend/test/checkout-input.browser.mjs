import assert from "node:assert/strict";

// Run against a local Chromium DevTools port and the read-only Savora storefront.
const cdpPort = process.env.SAVORA_CDP_PORT || "9334";
const checkoutUrl = process.env.SAVORA_CHECKOUT_URL || "http://localhost:3000/en/r/savora-demo/checkout";
const arabicUrl = checkoutUrl.replace("/en/", "/ar/");
assert.notEqual(arabicUrl, checkoutUrl, "checkout URL must contain /en/");
const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target, "headless Chrome page is available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let id = 0;
const pending = new Map();
const publicPosts = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Network.requestWillBeSent" && message.params.request.method === "POST" &&
      message.params.request.url.includes("/api/public/")) publicPosts.push(message.params.request.url);
  if (!message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(selector) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${selector}`);
}
async function visit(url) {
  await send("Page.navigate", { url });
  await waitFor('input[name="fullName"]');
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate("Boolean(document.querySelector('[name=fullName]')._valueTracker)")) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Checkout did not hydrate");
}
async function fill(name, value) {
  await evaluate(`document.querySelector('[name="${name}"]').focus()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await send("Input.insertText", { text: value });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(await evaluate(`document.querySelector('[name="${name}"]').value`), value, `${name} accepts text`);
}
async function inspectInputs() {
  const state = await evaluate(`[...document.querySelectorAll('input[name],textarea[name]')]
    .filter((element) => ['fullName','phone','email','address','city','notes'].includes(element.name))
    .map((element) => ({name: element.name, disabled: element.disabled, readOnly: element.readOnly,
      tabIndex: element.tabIndex, visible: element.getClientRects().length > 0}))`);
  assert.deepEqual(state.map((entry) => entry.name), ["fullName", "phone", "email", "address", "city", "notes"]);
  for (const entry of state) {
    assert.equal(entry.disabled, false, `${entry.name} is enabled`);
    assert.equal(entry.readOnly, false, `${entry.name} is editable`);
    assert.ok(entry.tabIndex >= 0, `${entry.name} is keyboard focusable`);
    assert.equal(entry.visible, true, `${entry.name} is visible`);
  }
}
async function tabTo(name) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.name"), name, `Tab moves to ${name}`);
}
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await visit(checkoutUrl);
  await inspectInputs();
  await fill("fullName", "Aya Hassan");
  await tabTo("phone");
  await send("Input.insertText", { text: "01012345678" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate("document.querySelector('[name=phone]').value"), "01012345678");
  await tabTo("email");
  await fill("email", "aya@example.com");
  await tabTo("address");
  await fill("address", "12 Nile Street");
  await tabTo("city");
  await fill("city", "Cairo");
  await tabTo("notes");
  await fill("notes", "No nuts");
  assert.equal(await evaluate("document.querySelector('[name=fullName]').value"), "Aya Hassan", "first value survives rerenders");
  assert.equal(await evaluate("document.querySelector('[name=phone]').value"), "01012345678", "phone survives rerenders");
  assert.equal(await evaluate("document.querySelector('form button[type=submit]:disabled')?.textContent.includes('Review Order')"), true);
  await evaluate("document.querySelector('form').requestSubmit()");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(await evaluate("location.href"), checkoutUrl, "implicit submit is prevented");
  assert.equal(await evaluate("document.querySelector('[name=fullName]').value"), "Aya Hassan", "submit attempt preserves draft");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await visit(arabicUrl);
  await inspectInputs();
  await fill("fullName", "آية حسن");
  await fill("notes", "بدون مكسرات");
  assert.equal(await evaluate("document.querySelector('[name=fullName]').value"), "آية حسن");
  assert.equal(await evaluate("document.querySelector('form button[type=submit]:disabled')?.textContent.includes('مراجعة الطلب')"), true);
  assert.deepEqual(publicPosts, [], "typing sends no public checkout POST");
  process.stdout.write("Checkout browser input smoke passed: English desktop, Arabic mobile, Tab focus, all fields, state persistence, empty-cart block, no POST.\n");
} finally {
  socket.close();
}
