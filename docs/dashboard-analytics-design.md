# Future owner dashboard analytics design (documentation only)

This specification describes a future frontend integration. Phase 6 adds chart-ready backend data only. No frontend files, UI components, or packages are changed here.

## Layout and hierarchy

Use a clean, premium SaaS canvas with restrained color, consistent type, generous spacing, and clear numeric hierarchy. On desktop, place the 7d / 30d / 6m / 12m selector and custom UTC date range above the analytics content. Keep the selected period visible while moving between sections. On tablet, allow chart cards to stack in two columns; on mobile, use one column, readable labels, and scrollable charts or tables where needed. Use the existing Next.js and TypeScript app conventions and Tailwind styles. A future Recharts integration can consume the API arrays directly; no chart package is installed in this phase.

## Dashboard components

1. **KPI cards:** Total Orders, Delivered Order Value, Pending Orders, and Average Delivered Order Value. Show the current value, previous-period change badge, currency where needed, and the API's small sparklines. Use `null` percentage changes as “No prior baseline,” not 0% growth. Make it clear that Delivered Order Value is an operational measure, not paid revenue.
2. **Main performance AreaChart:** Plot `ordersCreated` and `ordersDelivered` from `/stats/trends`. Use restrained gradients, distinct line/area colors, smooth transitions, accessible legends, and tooltips with the UTC bucket date. A previous-period toggle can use `previousSeries`; label the prior dates accurately, especially for weekly periods with partial boundary weeks.
3. **Financial area chart:** Plot `deliveredOrderValue` and optionally `averageDeliveredOrderValue`. Format tooltips with the response `currency` and its minor-unit precision. Do not label this as payment collection.
4. **Donut charts:** Use `/stats/breakdowns` for Direct versus WhatsApp and current status distribution. Display both count and percentage in tooltip and legend. Zero-count slices can remain in the legend without drawing misleading arcs.
5. **Horizontal bars:** Use `/stats/top-products` with 5, 10, or 20 rows. Let the owner switch between `quantitySold` and `deliveredItemValue`. Keep rank, snapshot name, and value legible. The latter excludes delivery fees.
6. **Activity heatmap:** Use the 7 × 24 `/stats/activity` matrix. Put Monday through Sunday on one axis and UTC hours on the other, with color intensity tied to `orders`. Label it UTC, since restaurant-local time and opening hours are not inferred.
7. **Recent Orders:** Use the existing `/api/owner/orders` endpoint and its pagination. Analytics routes intentionally do not return customer data or raw Orders. Restrict the recent table to the authenticated owner dashboard.

## Loading, empty and interaction states

Use stable skeleton card/chart dimensions while fetching, avoiding layout jumps. A new restaurant with no data gets a clear empty state: zero-valued KPIs, an empty chart axis or quiet illustration, zeroed donut legends, no product bars, and an empty heatmap. Do not fabricate growth or traffic. Period switching should keep the old view clearly marked as loading until the new response arrives, then animate the change subtly. Hover and keyboard focus should reveal the same factual tooltip information. Respect reduced-motion settings by disabling chart and number transitions. Ensure chart colors meet contrast needs and never use color alone to communicate status. Keep accessible text summaries and tabular alternatives available for key numbers.

## Data contracts and safeguards

Treat the API's `from` and `toExclusive` as UTC boundaries; display local dates only if a later product decision explicitly defines that conversion. Keep created-order and delivered-order series separate. Use the overview's `deliveredOrders` for the current status of orders created in the period, and `ordersDeliveredInPeriod` for delivery events and financial denominators. Avoid recalculating money, rates, status history, or product ranking in the browser. Owner session cookies and existing credentialed CORS rules remain the integration path; analytics are not public storefront data.
