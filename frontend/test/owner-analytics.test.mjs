import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getOwnerAnalytics, parseAnalytics, comparisonLabel } from "../src/services/owner-analytics-service.ts";

process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL = "http://localhost:5000";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const meta = { period: "30d", from: "2026-09-20T00:00:00.000Z", toExclusive: "2026-10-20T00:00:00.000Z", granularity: "day", currency: "EGP" };
const cmp = (current, previous = 0, percentageChange = null) => ({ current, previous, absoluteChange: current - previous, percentageChange });
const overview = { ...meta, totalOrders: cmp(2, 1, 100), deliveredOrders: cmp(1), pendingOrders: cmp(1), cancelledOrders: cmp(0), ordersDeliveredInPeriod: cmp(1), deliveredOrderValue: cmp(225), deliveredSubtotal: cmp(200), deliveredDeliveryFees: cmp(25), averageDeliveredOrderValue: cmp(225), cancellationRate: cmp(0), deliveryCompletionRate: cmp(50), sparklines: { totalOrders: [{ date: "2026-10-19", value: 2 }], deliveredOrderValue: [{ date: "2026-10-19", value: 225 }] } };
const bucket = (date, ordersCreated, ordersDelivered, deliveredOrderValue) => ({ date, bucketStart: `${date}T00:00:00.000Z`, ordersCreated, ordersDelivered, deliveredOrderValue, averageDeliveredOrderValue: ordersDelivered ? deliveredOrderValue / ordersDelivered : 0 });
const trends = { ...meta, series: [bucket("2026-10-18", 0, 1, 225), bucket("2026-10-19", 2, 0, 0)], previousSeries: [bucket("2026-09-19", 0, 0, 0)] };
const methods = [{ key: "direct", label: "Direct", count: 1, percentage: 50 }, { key: "whatsapp", label: "WhatsApp", count: 1, percentage: 50 }];
const statusKeys = ["pending", "delivered", "cancelled"];
const breakdowns = { ...meta, totalOrders: 2, submissionMethods: methods, statuses: statusKeys.map((key) => ({ key, label: key, count: key === "pending" || key === "delivered" ? 1 : 0, percentage: key === "pending" || key === "delivered" ? 50 : 0 })) };
const top = { ...meta, rankBy: "quantitySold", limit: 5, products: [{ rank: 1, productId: "507f1f77bcf86cd799439011", productName: "Old Burger", quantitySold: 2, deliveredItemValue: 200 }], mostFrequentlyOrderedProduct: { productId: "507f1f77bcf86cd799439011", productName: "Old Burger" } };
const activity = { ...meta, totalOrders: 2, cells: Array.from({ length: 168 }, (_, i) => ({ weekday: Math.floor(i / 24), hour: i % 24, orders: i === 0 ? 2 : 0 })), insights: { busiestWeekday: { weekday: 0, orders: 2 }, busiestHour: { hour: 0, orders: 2 }, highestActivityCell: { weekday: 0, hour: 0, orders: 2 } } };
const fixtures = { overview, trends, "top-products": top, breakdowns, activity };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("all five exact owner endpoints use credentials, no cache, and selected period", async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url), section = parsed.pathname.split("/").at(-1);
    seen.push(section);
    assert.equal(parsed.searchParams.get("period"), "30d");
    assert.equal(parsed.searchParams.has("restaurantId"), false);
    assert.equal(options.credentials, "include"); assert.equal(options.cache, "no-store");
    return json(fixtures[section]);
  };
  for (const section of Object.keys(fixtures)) await getOwnerAnalytics(section, "30d");
  assert.deepEqual(seen, Object.keys(fixtures));
});
test("period presets map unchanged and reject mismatched response periods", async () => {
  for (const period of ["7d", "30d", "6m", "12m"]) {
    globalThis.fetch = async (url) => { assert.equal(new URL(url).searchParams.get("period"), period); return json({ ...overview, period }); };
    assert.equal((await getOwnerAnalytics("overview", period)).period, period);
  }
  globalThis.fetch = async () => json(overview);
  await assert.rejects(getOwnerAnalytics("overview", "7d"), /Invalid analytics response/);
});
test("created and delivered buckets remain distinct and in backend order", () => {
  const parsed = parseAnalytics("trends", trends, "30d");
  assert.deepEqual(parsed.series.map((x) => [x.ordersCreated, x.ordersDelivered, x.deliveredOrderValue]), [[0, 1, 225], [2, 0, 0]]);
  assert.throws(() => parseAnalytics("trends", { ...trends, series: [...trends.series].reverse() }, "30d"), /Invalid analytics response/);
});
test("null comparison is neutral, currency and delivered values come from DTO", () => {
  assert.match(comparisonLabel(overview.deliveredOrderValue, "en"), /No previous-period comparison/);
  assert.equal(parseAnalytics("overview", overview, "30d").deliveredOrderValue.current, 225);
  assert.equal(parseAnalytics("overview", overview, "30d").currency, "EGP");
  assert.equal(comparisonLabel(overview.totalOrders, "en"), "+100%");
});
test("donuts, snapshot products and Monday-first UTC heatmap map exactly", () => {
  assert.equal(parseAnalytics("breakdowns", breakdowns, "30d").submissionMethods[1].key, "whatsapp");
  assert.deepEqual(parseAnalytics("breakdowns", breakdowns, "30d").statuses.map((row) => row.key), statusKeys);
  assert.equal(parseAnalytics("top-products", top, "30d").products[0].productName, "Old Burger");
  const result = parseAnalytics("activity", activity, "30d");
  assert.equal(result.cells.length, 168); assert.deepEqual(result.cells[0], { weekday: 0, hour: 0, orders: 2 });
  assert.throws(() => parseAnalytics("activity", { ...activity, cells: activity.cells.slice(1) }, "30d"), /Invalid analytics response/);
});
test("Top 10 value ranking uses exact query and saved item value", async () => {
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("limit"), "10"); assert.equal(query.get("rankBy"), "deliveredItemValue");
    return json({ ...top, limit: 10, rankBy: "deliveredItemValue" });
  };
  const result = await getOwnerAnalytics("top-products", "30d", { limit: 10, rankBy: "deliveredItemValue" });
  assert.equal(result.products[0].deliveredItemValue, 200);
  assert.equal(result.products[0].productName, "Old Burger");
});
test("request cancellation and invalid UTC bucket dates fail closed", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  const request = getOwnerAnalytics("trends", "30d", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /Request cancelled/);
  assert.throws(() => parseAnalytics("trends", { ...trends, series: [{ ...trends.series[0], date: "2026-02-30" }] }, "30d"), /Invalid analytics response/);
});
test("empty restaurant stays zero and API failures never fall back to fixtures", async () => {
  const empty = { ...overview, totalOrders: cmp(0), deliveredOrderValue: cmp(0) };
  assert.equal(parseAnalytics("overview", empty, "30d").totalOrders.current, 0);
  globalThis.fetch = async () => json({ error: "Unauthorized" }, 401);
  await assert.rejects(getOwnerAnalytics("overview", "30d"), (error) => error.status === 401);
  globalThis.fetch = async () => json({ invalid: true });
  await assert.rejects(getOwnerAnalytics("overview", "30d"), /Invalid analytics response/);
});
