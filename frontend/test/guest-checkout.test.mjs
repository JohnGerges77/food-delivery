import assert from "node:assert/strict";
import { test } from "node:test";
import { orderReference } from "../src/lib/order-reference.ts";
import { buildBetaCheckoutPayload, buildCheckoutPayload, checkoutValidation, GuestCheckoutCoordinator, GuestCheckoutError,
  storefrontCheckoutAvailability, submitGuestCheckout } from "../src/services/guest-checkout-service.ts";

process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";
const productId = "507f1f77bcf86cd799439012";
const details = { fullName: "  Aya Hassan ", phone: "+201001234567",
  address: "12 Nile Street", city: "Cairo", notes: "No nuts" };
const items = [{ productId, quantity: 2, name: "Dish", image: "", price: 999 }];
const order = { orderNumber: "SV-8341302408423A218E893F82", status: "pending",
  submissionMethod: "direct", currency: "EGP", subtotal: 25, deliveryFee: 0, total: 25, savedInSavora: true };
const saved = (method = "direct") => ({ order: { ...order, submissionMethod: method },
  ...(method === "whatsapp" ? { whatsapp: { url: "https://wa.me/201001234567?text=Order%20SV", messageSent: false } } : {}) });
const response = (body, status = 201) => new Response(JSON.stringify(body), { status });

test("a saved display number is readable and legacy confirmations keep their full reference", async () => {
  const payload = buildBetaCheckoutPayload(items);
  const result = await submitGuestCheckout("cafe", payload, "fixed-key-123456",
    async () => response({ order: { ...order, displayNumber: 1001 } }));
  assert.equal(orderReference(result.order), "#1001");
  assert.equal(orderReference(order), order.orderNumber);
  assert.equal(orderReference({ ...order, displayNumber: null }), order.orderNumber);
});

test("the entitlement overrides delivery and the deployment gate, with a non-retryable client error", async () => {
  assert.equal(storefrontCheckoutAvailability(true, false, true, false), "menu-only");
  assert.equal(storefrontCheckoutAvailability(false, true, true, true, "checkout-disabled"), "checkout-disabled");
  assert.equal(storefrontCheckoutAvailability(false, true, false, true, "available"), "delivery-unavailable");
  await assert.rejects(submitGuestCheckout("cafe", buildBetaCheckoutPayload(items), "fixed-key-123456",
    async () => response({ code: "ONLINE_ORDERING_DISABLED" }, 403)), (error) =>
      error instanceof GuestCheckoutError && error.orderingDisabled && !error.uncertain && !error.paused);
});
function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key), map };
}

test("form maps exact backend fields and real product IDs without client prices", () => {
  const direct = buildCheckoutPayload(details, items, "direct");
  assert.deepEqual(direct, { customerName: "Aya Hassan", customerPhone: "+201001234567",
    deliveryAddress: "12 Nile Street", city: "Cairo",
    notes: "No nuts", submissionMethod: "direct", items: [{ productId, quantity: 2 }] });
  assert.equal(JSON.stringify(direct).includes("999"), false);
  assert.equal(buildCheckoutPayload(details, items, "whatsapp").submissionMethod, "whatsapp");
  assert.deepEqual(buildCheckoutPayload({ ...details, notes: "" }, items, "direct").items, [{ productId, quantity: 2 }]);
  assert.equal("customerEmail" in buildCheckoutPayload(details, items, "direct"), false);
});

test("customer and cart validation catches invalid input before POST", () => {
  assert.deepEqual(checkoutValidation(details, items), {});
  assert.ok(checkoutValidation({ ...details, fullName: "", phone: "bad", address: "", city: "" }, []).fullName);
  assert.ok(checkoutValidation(details, [{ ...items[0], quantity: 0 }]).cart);
  assert.ok(checkoutValidation(details, [{ ...items[0], productId: "fixture-product" }]).cart);
  assert.ok(checkoutValidation(details, [{ ...items[0], quantity: 101 }]).cart);
  assert.throws(() => buildCheckoutPayload(details, [], "direct"), GuestCheckoutError);
});

test("beta checkout sends either method and item identifiers without contact details, notes or client prices", () => {
  const variantId = "507f1f77bcf86cd799439013";
  const payload = buildBetaCheckoutPayload([{ ...items[0], variantId, notes: "Do not transmit" }]);
  assert.deepEqual(payload, { submissionMethod: "direct", items: [{ productId, quantity: 2, variantId }] });
  assert.deepEqual(buildBetaCheckoutPayload([{ ...items[0], variantId }], "whatsapp"),
    { ...payload, submissionMethod: "whatsapp" });
  assert.throws(() => buildBetaCheckoutPayload([]), GuestCheckoutError);
});

test("WhatsApp validates a safe handoff and accepts a saved replay with a withdrawn URL", async () => {
  const payload = buildBetaCheckoutPayload(items, "whatsapp");
  const key = "12345678-1234-1234-1234-123456789012";
  const first = saved("whatsapp");
  const withdrawn = { order: { ...first.order, status: "delivered" }, whatsapp: { url: null, messageSent: false } };
  assert.deepEqual(await submitGuestCheckout("cafe", payload, key, async () => response(first)), first);
  assert.deepEqual(await submitGuestCheckout("cafe", payload, key, async () => response(withdrawn, 200)), withdrawn);
  await assert.rejects(submitGuestCheckout("cafe", payload, key, async () => response(withdrawn)), GuestCheckoutError);
  await assert.rejects(submitGuestCheckout("cafe", payload, key, async () => response({ ...first,
    whatsapp: { url: "https://wa.me/12025550100?text=test&next=https://example.test", messageSent: false } })), GuestCheckoutError);
});

test("the checkout gate rejection tells guests to keep their cart while unknown service failures preserve retries", async () => {
  const payload = buildBetaCheckoutPayload(items);
  const key = "12345678-1234-1234-1234-123456789012";
  await assert.rejects(submitGuestCheckout("cafe", payload, key,
    async () => response({ error: "Checkout unavailable" }, 503)),
  (error) => error.status === 503 && !error.uncertain && /Ordering is paused/.test(error.message));
  await assert.rejects(submitGuestCheckout("cafe", payload, key,
    async () => response({ error: "Service unavailable" }, 503)),
  (error) => error.status === 503 && error.uncertain && /same details/.test(error.message));
});

test("delivery pauses storefront checkout in both modes and the deploy flag gates only Beta", () => {
  assert.equal(storefrontCheckoutAvailability(false, false, true), "available");
  assert.equal(storefrontCheckoutAvailability(false, true, false), "delivery-unavailable");
  assert.equal(storefrontCheckoutAvailability(true, false, true), "checkout-disabled");
  assert.equal(storefrontCheckoutAvailability(true, true, false), "delivery-unavailable");
  assert.equal(storefrontCheckoutAvailability(true, true, true), "available");
});

test("a Beta firewall deny keeps the cart and preserves a distinct origin failure", async () => {
  const key = "12345678-1234-1234-1234-123456789012";
  const deny = async () => new Response("Forbidden", { status: 403 });
  const beta = buildBetaCheckoutPayload(items);
  await assert.rejects(submitGuestCheckout("cafe", beta, key, deny),
    (error) => error.status === 403 && error.paused && !error.uncertain && /Ordering is paused/.test(error.message));
  await assert.rejects(submitGuestCheckout("cafe", beta, key,
    async () => response({ error: "Untrusted checkout origin" }, 403)),
    (error) => error.status === 403 && !error.paused && !error.uncertain && /access was denied/.test(error.message));
  await assert.rejects(submitGuestCheckout("cafe", buildCheckoutPayload(details, items, "direct"), key, deny),
    (error) => error.status === 403 && !error.uncertain && /access was denied/.test(error.message));
});

test("public request uses slug, same-origin credentials, and only confirmed backend amounts", async () => {
  const payload = buildCheckoutPayload(details, items, "direct");
  let calls = 0;
  const result = await submitGuestCheckout("Cafe-One", payload, "12345678-1234-1234-1234-123456789012", async (url, options) => {
    calls++;
    assert.equal(url, "http://localhost:5000/api/public/restaurants/cafe-one/orders");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
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

test("401 protection response does not confirm an order and retry keeps the idempotency key", async () => {
  const memory = storage();
  const coordinator = new GuestCheckoutCoordinator();
  const payload = buildCheckoutPayload(details, items, "direct");
  const keys = [];
  const denied = async (_url, options) => {
    keys.push(options.headers["Idempotency-Key"]);
    return new Response("Protected by Vercel Authentication", { status: 401 });
  };
  await assert.rejects(coordinator.submit("cafe", payload, denied, memory),
    (error) => error.status === 401 && error.uncertain === false && /access was denied/.test(error.message));
  await assert.rejects(coordinator.submit("cafe", payload, denied, memory),
    (error) => error.status === 401);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  assert.equal(memory.map.size, 1);
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
