# Phase 8.7: Owner Overview analytics

## Scope and visual baseline

The authenticated Overview route now renders `DashboardHomePage` without server fixture props. Its original Savora dark/orange shell, header, sidebar, rounded KPI cards, Top Products card, and Recent Orders card remain. The fixture weekly bars are replaced with two responsive SVG area charts. The unsupported “Restaurant Open” and “Tonight's Service 94%” claims are removed. The sidebar's bottom card retains its original styling and now contains neutral navigation context.

No backend endpoint, database record, public storefront, checkout, or Order status was changed. The charts use native SVG and CSS within the existing React stack. Recharts was not installed; the dependency fetch did not finish in this environment, and the SVG implementation needs no package.

## API mapping and period controls

All reads use `apiRequest` with owner-session cookies, `credentials: include`, `cache: no-store`, and a 20-second timeout. Requests contain `period`, plus bounded `limit` and `rankBy` for Top Products. No `restaurantId` is sent. The server derives the tenant and currency from the verified session. The client explicitly validates the five DTOs and drops unexpected fields. It stores analytics only in component memory, keyed to owner and restaurant. Owner session 401 goes through the existing restore flow, which hides dashboard content.

| Endpoint | UI mapping |
| --- | --- |
| `GET /api/owner/stats/overview` | Eight KPIs, previous-period percentages, backend sparklines, UTC window. |
| `GET /api/owner/stats/trends` | Orders-created and orders-delivered area series; delivered-order-value area series. |
| `GET /api/owner/stats/top-products` | Rank, saved product name, delivered quantity and delivered item value, Top 5/10 and ranking control. |
| `GET /api/owner/stats/breakdowns` | Current-status and Direct/WhatsApp donuts. |
| `GET /api/owner/stats/activity` | Monday-first, 7-by-24 UTC heatmap and busiest day/hour. |
| `GET /api/owner/orders?page=1&limit=5` | Original Recent Orders card, with data held only in authenticated component memory. |

The single Overview period state defaults to `30d` and offers `7d`, `30d`, `6m`, `12m` using the backend's exact values. Switching periods aborts prior analytics requests and tags results by period; stale responses cannot replace the selected period. Top Product rank/limit changes fetch only that section. Refresh reloads all five analytics sections and Recent Orders. Different endpoint snapshots can be a few moments apart, as documented by the backend. A boundary/currency mismatch against the overview is shown as a section error. The existing Overview had no custom-range control, so custom dates remain outside this UI iteration; the backend continues to support them.

## Definitions

The status donut now has exactly three server-calculated groups: Pending, Delivered, and Cancelled. Stored `preparing`, `ready`, and `out-for-delivery` Orders contribute to Pending without changing their records. The Pending KPI uses that same grouping; the former Preparing KPI is replaced with Cancellation Rate. Recent Orders also show the simplified label. The eight-card layout, charts, colors, navigation, and period selectors remain in place.

All boundaries and axis dates are displayed in UTC. The client does not recreate buckets: it plots the backend's chronological, zero-filled `series` and its exact day/week/month granularity. `ordersCreated` uses `createdAt`; `ordersDelivered` and delivered-order value use `deliveredAt` for currently delivered Orders. A delivered Order created before the period can contribute to the value chart inside the period. The KPI `deliveredOrders` is distinct from `ordersDeliveredInPeriod`; the displayed delivered count uses the latter. Current status donuts describe Orders **created in the period and their status now**, not a historical status timeline.

Delivered Order Value includes saved order totals for currently delivered Orders delivered within the UTC window. It is operational order value, **not verified payment revenue**. Top Product item value uses saved Order item snapshots and excludes delivery fees. WhatsApp denotes a persisted submission method; it does not prove a message was sent. The response `currency` is checked against the owner context and formatted with `Intl.NumberFormat`; no Product price is used to reconstruct past value. A `null` percentage change displays a neutral “No previous-period comparison” label. Previous values are available to screen readers. Rate deltas are percentage points in the API; the UI displays the API's percentage-change field only where defined.

## Interaction, empty and error states

Period buttons expose `aria-pressed` and keyboard focus. SVG chart data points expose the bucket's values as accessible labels; Enter/Space and pointer hover show their tooltip. Donut segments have accessible labels and counts, with Enter/Space selecting a segment; the legend remains readable for zero slices. All 168 heatmap cells are keyboard-focusable with weekday, UTC hour, and exact count. Sections use stable-height loading skeletons and individual retry actions. Framer Motion gives chart lines a brief entrance. A zero-Order restaurant displays zero KPIs, baseline charts, zeroed donuts, empty products and heatmap. There is no fixture fallback. `prefers-reduced-motion` suppresses chart transitions and loading shimmer.

The original page/card spacing and dark/orange palette remain. Desktop uses the existing sidebar and four-column KPI layout; tablet stacks charts; mobile uses one-column cards and a horizontally scrollable heatmap within its card. English and Arabic labels are provided for new analytics content, including RTL rendering from the existing locale layout. Restaurant-provided names are displayed unchanged.

## Verification and limitations

Run frontend tests, TypeScript, ESLint, and Next build with Node 24 from `frontend/`; run backend offline tests from `backend/`. The browser script `frontend/test/owner-analytics.browser.mjs` requires local Next at `localhost:3000` and headless Chrome CDP on port 9335. It intercepts every owner API call and exercises desktop English and mobile Arabic, periods, interactive charts, empty/error states, and page overflow. Screenshots are written to the OS temp directory. They document the final appearance; no executable before screenshot exists for pixel parity comparison.

Independent live MongoDB Analytics verification was not performed. No automated request reached `savora_dev`. The SVG chart has keyboard and pointer tooltips but no time-series table export. Custom date ranges and payment verification remain future product decisions. The dashboard header's existing search and notification controls were left as originally implemented; Phase 8.7 does not introduce global search or notifications.

## Simplified status and typography verification (2026-10-20)

The status donut consumes the three grouped backend slices without client-side aggregation. The Overview keeps its eight KPI cards, with Cancellation Rate in the former Preparing slot. The guarded `savora_test` Analytics integration test passed; the desktop English and mobile Arabic mocked-API Chrome flow passed with period changes, tooltips, empty/error states, and computed Tajawal for Arabic SVG labels. No `savora_dev` Analytics write was issued.
