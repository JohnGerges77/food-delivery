# Owner dashboard analytics API (Phase 6)

All five routes are authenticated, read-only owner GET endpoints under `/api/owner/stats`. They use the existing owner session and credentialed owner CORS policy. The server derives `restaurantId` and `currency` from the verified session. No analytics response contains customer details, raw Orders, authentication material, tracking or idempotency hashes. Responses use `Cache-Control: no-store`.

## Periods and shared metadata

Every endpoint accepts `period=7d|30d|6m|12m` (default `30d`) or `period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`. Supplying both `from` and `to` without `period` also selects `custom`. A custom window is 1-366 UTC calendar days. Presets cannot be combined with `from` or `to`. Unknown or duplicate parameters, MongoDB operators, malformed dates, reversed ranges and overlong URLs are rejected.

| Period | Start and exclusive end | Granularity | Preceding comparison |
| --- | --- | --- | --- |
| `7d` | UTC midnight six days before today through midnight tomorrow | day | preceding seven UTC days |
| `30d` | UTC midnight 29 days before today through midnight tomorrow | day | preceding 30 UTC days |
| `6m` | first day of the fifth prior month through first day of next month | Monday-start week | preceding six complete/calendar months |
| `12m` | first day of the eleventh prior month through first day of next month | month | preceding twelve calendar months |
| `custom` | `from` at UTC midnight through midnight after `to` | day for up to 31 days; week for 32-183; month for 184-366 | immediately preceding the same number of UTC days |

All responses include `{ "period": "custom", "from": "2026-01-01T00:00:00.000Z", "toExclusive": "2026-01-02T00:00:00.000Z", "granularity": "day", "currency": "EGP" }` for a one-day EGP example. All database time filters use inclusive start and exclusive end. Weekly buckets start Monday 00:00 UTC. A weekly or monthly bucket can start before the reporting range; only records inside the range contribute. `date` is the bucket's UTC start date. Restaurant-local hours and time zones are not inferred.

## `GET /api/owner/stats/overview`

Returns KPI comparisons, chart-ready sparklines, and factual changes. Example shape for an empty restaurant:

```json
{
  "period": "custom", "from": "2026-01-01T00:00:00.000Z",
  "toExclusive": "2026-01-02T00:00:00.000Z", "granularity": "day", "currency": "EGP",
  "totalOrders": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "deliveredOrders": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "pendingOrders": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "cancelledOrders": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "ordersDeliveredInPeriod": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "deliveredOrderValue": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "deliveredSubtotal": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "deliveredDeliveryFees": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "averageDeliveredOrderValue": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "cancellationRate": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "deliveryCompletionRate": { "current": 0, "previous": 0, "absoluteChange": 0, "percentageChange": null },
  "sparklines": {
    "totalOrders": [{ "date": "2026-01-01", "value": 0 }],
    "deliveredOrderValue": [{ "date": "2026-01-01", "value": 0 }]
  },
  "insights": { "orderVolumeChange": 0, "deliveredValueChange": 0,
    "currentCancellationProportion": 0 }
}
```

`totalOrders` and the three operational status counts describe Orders **created** in the period, including both direct and WhatsApp. Stored `pending`, `preparing`, `ready`, and `out-for-delivery` all contribute to `pendingOrders`; the database values stay unchanged. The status is their current status at request time. The former `preparingOrders`, `readyOrders`, and `outForDeliveryOrders` response fields were removed. `deliveredOrders` means created in the period and currently delivered. `ordersDeliveredInPeriod` instead counts Orders whose current status is delivered and whose `deliveredAt` is inside the period, even if created earlier. The monetary metrics use this latter delivered set. `cancellationRate` is cancelled / all created in the period. `deliveryCompletionRate` is currently delivered / all created in the period. Empty denominators return zero rates. Rates and percentage changes round to two decimal places; an undefined percentage change when the previous value is zero is `null`. A rate's `absoluteChange` is in percentage points.

## `GET /api/owner/stats/trends`

Returns `series` and `previousSeries`, each chronological and zero-filled. Every bucket has `date`, `bucketStart`, `ordersCreated`, `ordersDelivered`, `deliveredOrderValue`, and `averageDeliveredOrderValue`. For an empty one-day period:

```json
{
  "period": "custom", "from": "2026-01-01T00:00:00.000Z",
  "toExclusive": "2026-01-02T00:00:00.000Z", "granularity": "day", "currency": "EGP",
  "series": [{ "date": "2026-01-01", "bucketStart": "2026-01-01T00:00:00.000Z",
    "ordersCreated": 0, "ordersDelivered": 0, "deliveredOrderValue": 0,
    "averageDeliveredOrderValue": 0 }],
  "previousSeries": [{ "date": "2025-12-31", "bucketStart": "2025-12-31T00:00:00.000Z",
    "ordersCreated": 0, "ordersDelivered": 0, "deliveredOrderValue": 0,
    "averageDeliveredOrderValue": 0 }]
}
```

Created counts use `createdAt`; delivered counts and values use `deliveredAt` and current `status: delivered`. Weekly `previousSeries` may have a different bucket count from `series` because equal calendar-month periods need not cover the same number of Monday-start weeks. Align by each series' own `bucketStart` or period-relative position, rather than assuming equal-length arrays. These arrays are ready for area/line charts and tooltips.

## `GET /api/owner/stats/top-products`

Also accepts `limit=5|10|20` (default 5) and `rankBy=quantitySold|deliveredItemValue` (default quantity). Returns `rankBy`, `limit`, `products`, and `mostFrequentlyOrderedProduct` (`null` when empty). Example product item within `products`:

```json
{ "rank": 1, "productId": "670e460ab0d9d830c8589699",
  "productName": "Burger", "quantitySold": 2, "deliveredItemValue": 149.98 }
```

The item above illustrates field names. Actual responses contain only products with delivered Order items in the period; an empty restaurant returns `"products": []` and `"mostFrequentlyOrderedProduct": null` alongside the shared metadata, `rankBy`, and `limit`. Products group by snapshot `productId`, including deleted or renamed products. The display name is from the most recently delivered matching snapshot, then newest Order ID, then lowest item position. Ranking uses requested metric descending, the other metric descending, then `productId` ascending. `deliveredItemValue` sums saved item unit price times quantity and excludes order-level delivery fees. `mostFrequentlyOrderedProduct` always uses quantity ranking, even when `rankBy=deliveredItemValue`.

## `GET /api/owner/stats/breakdowns`

Returns `totalOrders`, `submissionMethods` (Direct and WhatsApp), and `statuses` (`pending`, `delivered`, `cancelled`). Historical intermediate statuses join `pending` within MongoDB aggregation before counts are returned. For example, stored `pending` and `ready` Orders produce Pending=2, Delivered=0, Cancelled=0. All categories appear even when zero. These are current operational groups and methods for Orders created in the selected period. Percentages use largest-remainder rounding to two decimals and sum to 100 when the total is nonzero (zero otherwise).

## `GET /api/owner/stats/activity`

Returns `cells` as a complete 168-entry weekday-major matrix plus `totalOrders` and `insights`. Example cell: `{ "weekday": 0, "hour": 0, "orders": 0 }`. For an empty period, `totalOrders` is 0 and `insights` is `{ "busiestWeekday": null, "busiestHour": null, "highestActivityCell": null }`, while all 168 cells have `orders: 0`. Weekdays are **Monday=0 through Sunday=6**; hours are UTC 0-23. Activity counts Order creation by `createdAt`. Nonempty insights are `busiestWeekday: { weekday, orders }`, `busiestHour: { hour, orders }`, and `highestActivityCell: { weekday, hour, orders }`. Ties select the lowest weekday and/or hour.

## Money, errors and operations

Delivered Order Value is **not paid revenue**. V1 has no verified payment collection. Only Orders with current `status: delivered` and `deliveredAt` in the requested window contribute to monetary metrics and top products. Opening WhatsApp does not imply delivery or payment. Order-level `total`, `subtotal`, and `deliveryFee`, and item snapshot `unitPrice` remain historical values. The server converts each amount to the restaurant currency's minor units using MongoDB Decimal128 before summing; averages round to one minor unit. JSON monetary numbers retain the currency's supported precision (0-3 fraction digits). Unsafe values beyond exact JSON minor-unit precision fail closed.

| Status | Meaning |
| --- | --- |
| `400` | Invalid period, date, option, duplicate or unknown parameter. |
| `401` | Missing, expired, revoked, inactive-owner or unavailable-restaurant session. |
| `414` | Analytics URL longer than 2048 characters. |
| `503` | Database unavailable, aggregation timeout, unsupported currency precision or unsafe amount. |

Each aggregation matches the authenticated tenant and its relevant date field before grouping. Responses have bounded buckets, 168 activity cells, three status groups, two methods, or at most 20 ranked products. Aggregations use a 10-second server-side time limit and never load all matching Orders into Node.js. The existing `(restaurantId, createdAt)` and `(restaurantId, status, createdAt)` indexes support created-order reporting. A new partial `(restaurantId, deliveredAt)` index for delivered Orders is declared; it requires a controlled index rollout in deployed databases. This phase does not run a production migration. Existing Order Number fields are BSON Numbers, so the decimal minor-unit conversion avoids accumulation drift but cannot repair any precision already lost before persistence. These are live operational snapshots; concurrent Order changes can make separate endpoint responses reflect slightly different instants. No historical status event log or payment verification exists.

## Simplified status verification (2026-10-20)

The guarded `savora_test` Analytics integration test verified that a stored `preparing` Order joins Pending in overview and breakdowns, every Order is counted once, delivered value follows `deliveredAt` and stored totals, and pending/cancelled Orders do not add delivered value. The server groups statuses in MongoDB before returning totals. A unit test checks three equal slices round to `33.34 + 33.33 + 33.33 = 100`.
