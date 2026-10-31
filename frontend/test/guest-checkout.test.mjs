import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCheckoutPayload, checkoutValidation, GuestCheckoutCoordinator, GuestCheckoutError,
  submitGuestCheckout } from "../src/services/guest-checkout-service.ts";

process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";
const productId = "507f1f77bcf86cd799439012";
const details = { fullName: "  Aya Hassan ", phone: "+201001234567", email: " AYA@EXAMPLE.COM ",
  address: "12 Nile Street", city: "Cairo", notes: "No nuts" };
const items = [{ productId, quantity: 2, name: "Dish", image: "", price: 999 }];
const order = { orderNumber: "SV-8341302408423A218E893F82", status: "pending",
  submissionMethod: "direct", currency: "EGP", subtotal: 25, deliveryFee: 0, total: 25, savedInSavora: true };
const saved = (method = "direct") => ({ order: { ...order, submissionMethod: method },
  ...(method === "whatsapp" ? { whatsapp: { url: "https://wa.me/201001234567?text=Order%20SV", messageSent: false } } : {}) });
const response = (body, status = 201) => new Response(JSON.stringify(body), { status });
function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key), map };
}

test("form maps exact backend fields and real product IDs without client prices", () => {
  const direct = buildCheckoutPayload(details, items, "direct");
  assert.deepEqual(direct, { customerName: "Aya Hassan", customerPhone: "+201001234567",
    customerEmail: "aya@example.com", deliveryAddress: "12 Nile Street", city: "Cairo",
    notes: "No nuts", submissionMethod: "direct", items: [{ productId, quantity: 2 }] });
  assert.equal(JSON.stringify(direct).includes("999"), false);
  assert.equal(buildCheckoutPayload(details, items, "whatsapp").submissionMethod, "whatsapp");
  assert.deepEqual(buildCheckoutPayload({ ...details, email: "", notes: "" }, items, "direct").items, [{ productId, quantity: 2 }]);
  assert.equal("customerEmail" in buildCheckoutPayload({ ...details, email: "" }, items, "direct"), false);
});

test("customer and cart validation catches invalid input before POST", () => {
  assert.deepEqual(checkoutValidation(details, items), {});
  assert.ok(checkoutValidation({ ...details, fullName: "", phone: "bad", email: "bad", address: "", city: "" }, []).fullName);
  assert.ok(checkoutValidation(details, [{ ...items[0], quantity: 0 }]).cart);
  assert.ok(checkoutValidation(details, [{ ...items[0], productId: "fixture-product" }]).cart);
  assert.ok(checkoutValidation(details, [{ ...items[0], quantity: 101 }]).cart);
  assert.throws(() => buildCheckoutPayload(details, [], "direct"), GuestCheckoutError);
});

test("public request uses slug, no owner credentials, and only confirmed backend amounts", async () => {
  const payload = buildCheckoutPayload(details, items, "direct");
  let calls = 0;
  const result = await submitGuestCheckout("Cafe-One", payload, "12345678-1234-1234-1234-123456789012", async (url, options) => {
    calls++;
    assert.equal(url, "http://localhost:5000/api/public/restaurants/cafe-one/orders");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.headers["Idempotency-Key"], "12345678-1234-1234-1234-123456789012");
    assert.equal("X-Savora-CSRF" in options.headers, false);
    assert.deepEqual(JSON.parse(options.body), payload);
    return response(saved());
  });
  assert.equal(calls, 1);
  assert.equal(result.order.orderNumber, order.orderNumber);
  assert.equal(result.order.total, 25);
  assert.equal(result.order.currency, "EGP");
});

test("WhatsApp link appears only after saved response and never claims sent", async () => {
  const payload = buildCheckoutPayload(details, items, "whatsapp");
  const result = await submitGuestCheckout("cafe", payload, "12345678-1234-1234-1234-123456789012",
    async () => response(saved("whatsapp")));
  assert.equal(result.whatsapp.messageSent, false);
  assert.match(result.whatsapp.url, /^https:\/\/wa\.me\//);
  await assert.rejects(submitGuestCheckout("cafe", payload, "12345678-1234-1234-1234-123456789012",
    async () => response({ order: { ...order, submissionMethod: "whatsapp", savedInSavora: false }, whatsapp: result.whatsapp })),
  (error) => error.uncertain === true);
  await assert.rejects(submitGuestCheckout("cafe", payload, "12345678-1234-1234-1234-123456789012",
    async () => response({ order: { ...order, submissionMethod: "whatsapp" } })),
  (error) => error.uncertain === true);
});

test("double click shares one POST; timeout and refresh reuse the same key and payload", async () => {
  const memory = storage();
  const first = new GuestCheckoutCoordinator();
  const payload = buildCheckoutPayload(details, items, "direct");
  const calls = [];
  let resolvePending;
  const pending = new Promise((resolve) => { resolvePending = resolve; });
  const slow = async (_url, options) => { calls.push(options); await pending; throw new TypeError("network timeout"); };
  const one = first.submit("cafe", payload, slow, memory);
  const two = first.submit("cafe", payload, slow, memory);
  assert.equal(one instanceof Promise, true);
  resolvePending();
  await assert.rejects(one, (error) => error.uncertain === true);
  await assert.rejects(two, (error) => error.uncertain === true);
  assert.equal(calls.length, 1);
  assert.equal(memory.map.size, 1);
  assert.equal(JSON.stringify([...memory.map.values()]).includes("Aya"), false, "PII not stored");
  const retry = new GuestCheckoutCoordinator();
  const result = await retry.submit("cafe", payload, async (_url, options) => {
    calls.push(options);
    return response(saved(), 200);
  }, memory);
  assert.equal(result.order.orderNumber, order.orderNumber);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(memory.map.size, 0);
});

test("changed payload or tenant creates new key; 409 and 503 never confirm success", async () => {
  const memory = storage();
  const coordinator = new GuestCheckoutCoordinator();
  const payload = buildCheckoutPayload(details, items, "direct");
  const keys = [];
  const unavailable = async (_url, options) => { keys.push(options.headers["Idempotency-Key"]); return response({ error: "Checkout unavailable" }, 409); };
  await assert.rejects(coordinator.submit("cafe", payload, unavailable, memory), (error) => error.status === 409 && !error.uncertain);
  await assert.rejects(coordinator.submit("cafe", payload, unavailable, memory), (error) => error.status === 409);
  assert.equal(keys[0], keys[1]);
  await assert.rejects(coordinator.submit("cafe", { ...payload, city: "Giza" }, unavailable, memory), (error) => error.status === 409);
  assert.notEqual(keys[1], keys[2]);
  await assert.rejects(coordinator.submit("cafe", payload, unavailable, memory), (error) => error.status === 409);
  assert.equal(keys[0], keys[3], "returning to an uncertain payload reuses its original key");
  await assert.rejects(coordinator.submit("other", payload, unavailable, memory), (error) => error.status === 409);
  assert.notEqual(keys[2], keys[4]);
  await assert.rejects(coordinator.submit("cafe", payload, async () => response({ error: "Service unavailable" }, 503), memory),
    (error) => error.uncertain === true);
});
