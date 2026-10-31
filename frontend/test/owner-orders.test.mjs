import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearCsrfToken } from "../src/services/api-client.ts";
import { getOwnerOrder, listOwnerOrders, nextOrderStatuses, orderStatuses, visibleOrderStatuses, operationalOrderStatus,
  ownerOrderDate, ownerOrderMethodLabel, ownerOrderMoney, ownerOrderStatusLabel,
  parseOwnerOrder, patchOwnerOrderStatus, validateOwnerOrderFilters } from "../src/services/owner-orders-service.ts";

process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";
const originalFetch = globalThis.fetch;
const id = "507f1f77bcf86cd799439011";
const productId = "507f1f77bcf86cd799439012";
const direct = { id, orderNumber: "SV-8341302408423A218E893F82", customerName: "Aya Hassan",
  customerPhone: "+201001234567", customerEmail: "aya@example.com", deliveryAddress: "12 Nile Street",
  city: "Cairo", items: [{ productId, name: "Old Burger Name", unitPrice: 125, quantity: 2,
    imageUrl: null, notes: "No onions" }], subtotal: 250, deliveryFee: 0, total: 250,
  status: "pending", source: "website", submissionMethod: "direct", notes: "Ring bell",
  createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z", deliveredAt: null };
const whatsapp = { ...direct, id: "507f1f77bcf86cd799439013", orderNumber: "SV-AAAA", submissionMethod: "whatsapp",
  customerEmail: null, notes: null, items: [{ ...direct.items[0], notes: null }] };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { globalThis.fetch = originalFetch; clearCsrfToken(); });

test("list includes real Direct and WhatsApp DTOs with owner cookies and bounded metadata", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/owner/orders?page=1&limit=20");
    assert.equal(options.method, "GET"); assert.equal(options.credentials, "include");
    assert.equal(options.cache, "no-store");
    return json({ orders: [direct, whatsapp], pagination: { page: 1, limit: 20, total: 2, hasNext: false } });
  };
  const result = await listOwnerOrders();
  assert.deepEqual(result.orders.map((order) => order.submissionMethod), ["direct", "whatsapp"]);
  assert.equal(result.orders[0].customerName, "Aya Hassan");
  assert.equal(result.orders[0].deliveryFee, 0);
  assert.equal(result.pagination.total, 2);
});

test("list uses exact supported filters, UTC dates, page and limit", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://localhost:5000/api/owner/orders?page=2&limit=12&status=out-for-delivery&submissionMethod=whatsapp&orderNumber=SV-AAAA&from=2026-10-01&to=2026-10-18");
    return json({ orders: [whatsapp], pagination: { page: 2, limit: 12, total: 13, hasNext: false } });
  };
  const result = await listOwnerOrders({ page: 2, limit: 12, status: "out-for-delivery", submissionMethod: "whatsapp",
    orderNumber: "SV-AAAA", from: "2026-10-01", to: "2026-10-18" });
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.hasNext, false);
  assert.equal(result.orders.length, 1);
  assert.equal(validateOwnerOrderFilters({ from: "2026-02-30" }) !== null, true);
  assert.equal(validateOwnerOrderFilters({ from: "2026-10-19", to: "2026-10-18" }) !== null, true);
  assert.equal(validateOwnerOrderFilters({ orderNumber: "SV-AAAA" }), null);
  assert.equal(validateOwnerOrderFilters({ orderNumber: "Aya Hassan" }) !== null, true);
  assert.equal(validateOwnerOrderFilters({ page: 1001 }) !== null, true);
});

test("visible Pending tab requests the server-side group before pagination", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://localhost:5000/api/owner/orders?page=1&limit=2&statusGroup=pending");
    return json({ orders: [{ ...direct, status: "ready" }], pagination: { page: 1, limit: 2, total: 7, hasNext: true } });
  };
  const result = await listOwnerOrders({ page: 1, limit: 2, statusGroup: "pending" });
  assert.equal(result.pagination.total, 7);
  assert.equal(result.orders[0].status, "ready");
  assert.equal(validateOwnerOrderFilters({ statusGroup: "ready" }) !== null, true);
  assert.equal(validateOwnerOrderFilters({ statusGroup: "pending", status: "pending" }) !== null, true);
});

test("empty list and invalid response never fall back to fixture Orders", async () => {
  globalThis.fetch = async () => json({ orders: [], pagination: { page: 1, limit: 20, total: 0, hasNext: false } });
  assert.deepEqual((await listOwnerOrders()).orders, []);
  globalThis.fetch = async () => json({ orders: [{ ...direct, id: "ord-1001" }], pagination: { page: 1, limit: 20, total: 1, hasNext: false } });
  await assert.rejects(listOwnerOrders(), /Invalid server response/);
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await assert.rejects(listOwnerOrders(), (error) => error.status === 401);
});

test("detail GET shows historical snapshots and strips unapproved internal fields", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `http://localhost:5000/api/owner/orders/${id}`);
    assert.equal(options.credentials, "include");
    return json({ order: { ...direct, restaurantId: "secret", trackingTokenHash: "secret",
      items: [{ ...direct.items[0], currentProductPrice: 500 }] } });
  };
  const result = await getOwnerOrder(id);
  assert.equal(result.items[0].name, "Old Burger Name");
  assert.equal(result.items[0].unitPrice, 125);
  assert.equal(result.items[0].notes, "No onions");
  assert.equal(result.customerEmail, "aya@example.com");
  assert.equal(result.notes, "Ring bell");
  assert.equal("trackingTokenHash" in result, false);
  assert.equal("restaurantId" in result, false);
  assert.equal("currentProductPrice" in result.items[0], false);
  await assert.rejects(getOwnerOrder("ord-1001"), (error) => error.status === 404);
});

test("status policy and labels use exact persisted out-for-delivery value", () => {
  assert.deepEqual(orderStatuses, ["pending", "preparing", "ready", "out-for-delivery", "delivered", "cancelled"]);
  assert.deepEqual(visibleOrderStatuses, ["pending", "delivered", "cancelled"]);
  for (const status of ["pending", "preparing", "ready", "out-for-delivery"]) {
    assert.deepEqual(nextOrderStatuses(status), ["delivered", "cancelled"]);
    assert.equal(operationalOrderStatus(status), "pending");
    assert.equal(ownerOrderStatusLabel(status, "en"), "Pending");
  }
  assert.deepEqual(nextOrderStatuses("delivered"), []);
  assert.deepEqual(nextOrderStatuses("cancelled"), []);
  assert.equal(ownerOrderStatusLabel("out-for-delivery", "ar"), "قيد الانتظار");
  assert.equal(ownerOrderStatusLabel("delivered", "ar"), "تم التسليم");
  assert.equal(ownerOrderMethodLabel("direct", "ar"), "مباشر");
  assert.match(ownerOrderMoney(0, "EGP", "en"), /0\.00/);
  assert.match(ownerOrderMoney(250, "EGP", "en"), /EGP/);
  assert.ok(ownerOrderDate(direct.createdAt, "ar").length > 0);
});

test("PATCH bootstraps CSRF, sends only status, and uses canonical saved response", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/auth/csrf")) return json({ csrfToken: "a".repeat(64) });
    assert.equal(url, `http://localhost:5000/api/owner/orders/${id}/status`);
    assert.equal(options.method, "PATCH"); assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Savora-CSRF"), "a".repeat(64));
    assert.deepEqual(JSON.parse(options.body), { status: "delivered" });
    return json({ order: { ...direct, status: "delivered", deliveredAt: "2026-10-19T12:00:00.000Z" } });
  };
  const result = await patchOwnerOrderStatus(id, "delivered");
  assert.equal(result.status, "delivered");
  assert.ok(result.deliveredAt);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.credentials, "include");
});

test("409, 403, 404 and service failures cannot confirm a mutation", async () => {
  for (const status of [409, 403, 404, 503]) {
    clearCsrfToken();
    globalThis.fetch = async (url) => url.endsWith("/api/auth/csrf") ? json({ csrfToken: "b".repeat(64) }) : json({ error: "Request failed" }, status);
    await assert.rejects(patchOwnerOrderStatus(id, "cancelled"), (error) => error.status === status);
  }
  assert.deepEqual(parseOwnerOrder(direct).items[0], direct.items[0]);
});
