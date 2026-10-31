# Phase 8.6: owner Orders frontend

## Scope and API mapping

The existing Orders dashboard keeps its Savora sidebar/header, dark search/filter card, orange status tabs, order cards, action buttons, and details modal. The Orders route no longer passes fixture `getOrders()` data. After the owner session resolves, the page calls the credentialed owner API through `apiRequest`:

| UI action | Backend endpoint | Response |
| --- | --- | --- |
| Initial load, filters, pagination, Refresh | `GET /api/owner/orders` | `{orders,pagination}` |
| View an Order or reconcile its status | `GET /api/owner/orders/:id` | `{order}` |
| Confirm an allowed status change | `PATCH /api/owner/orders/:id/status` with only `{status}` | `{order}` |

`apiRequest` sends `credentials: "include"` and `cache: "no-store"`. The PATCH obtains the session-bound CSRF token and sends `X-Savora-CSRF`. The backend derives the tenant from the verified owner session; the UI never sends a restaurant ID. A `401` returns control to the existing session restoration/authenticated dashboard shell. A `403` is reported as an Origin/CSRF rejection.

The service explicitly maps the approved Order DTO and drops unexpected extra fields. List cards show the server order number, customer name, phone and address, local display time, `direct`/`whatsapp` method, status, item count and confirmed total in the authenticated restaurant currency. Selecting a card fetches `GET :id` before showing its details. The modal displays customer email when present, city, top-level notes, saved item names, stored unit prices, quantities, item notes/images, stored subtotal/fee/total, method, status, created time and delivered time when present. Current Product data is never used to reconstruct historical prices or names. No payment or WhatsApp delivery claim is shown.

## Filters and pagination

- The search box is labeled **Exact order number only** and submits `orderNumber`; it does not search a single page for customer names or imply global free-text search.
- Status tabs show All Orders, Pending, Delivered, and Cancelled. They send `statusGroup`, so the backend includes all historical in-progress Orders in Pending **before** pagination and count. The older `status` query remains an exact stored-status filter for API callers. `out-for-delivery` is the persisted value; localized labels are display-only.
- Method offers all, direct and WhatsApp.
- From/To controls submit validated `YYYY-MM-DD` strings unchanged. Backend boundaries are UTC midnight through the full `to` day. The browser displays timestamps using the viewer's local timezone with `en-US` or `ar-EG` formatting; no restaurant timezone is inferred.
- The page uses `page` and `limit=20`, shows the backend's filtered `total`, and offers Previous/Next based on `hasNext`. An out-of-range page after data changes is brought back to a valid page. Refresh is manual. No polling or WebSocket was added.

The backend uses offset-based pagination, so new Orders arriving between page requests can shift page membership. Refresh re-queries the current filters; it does not promise a live feed. When the first page is empty, the original design shows an empty state rather than fixture data. Loading skeletons and retry actions use the same card styling. A failed refresh for the same query keeps previously displayed results with an error banner; a failed new query does not mislabel old results as matching the new filters.

## Status workflow and concurrency

Allowed actions mirror the backend: stored `pending`, `preparing`, `ready`, or `out-for-delivery` → `delivered|cancelled`. Delivered and cancelled are terminal. The UI labels all four in-progress states Pending while retaining the exact status in memory for the backend's atomic check. Cards and the details modal offer **Mark as Delivered** as the primary action and **Cancel Order** as the secondary action. Choosing one opens the existing details modal, rechecks the latest Order with `GET :id`, and displays a confirmation before PATCH. Cancellation and delivery are explicitly described as final; delivery is not described as payment confirmation.

Buttons are disabled during PATCH. The UI waits for the canonical `{order}` response before changing status. A `409` never shows success: the page refetches the selected Order and list, explains that the state changed, and shows actions allowed from the refreshed status. Other uncertain mutation failures also trigger a read to reconcile what the server stored; no automatic PATCH retry is made.

## Customer privacy and limitations

The authenticated shell must show an owner context before this component mounts. The component is keyed by user and restaurant IDs, so an owner switch or logout cannot reuse the previous view state. Order PII is kept only in component memory; it is not written to local/session storage, put in a URL, or logged. API responses use `no-store`. Missing and foreign IDs share the backend's 404 behavior.

The shared Overview/sidebar fixture statistics remain outside this phase; they are not derived from one paginated Orders page. Analytics, payment state, customer tracking, and a live feed are deferred.

## Verification and safe manual check

From `frontend/`, run `node --test test/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, and `node node_modules/next/dist/bin/next build` with Node 24. `test/owner-orders.browser.mjs` runs against local Next and Chrome CDP and intercepts **all** owner/auth API calls. It checks desktop English and mobile Arabic views, saved snapshot details, exact lookup, a 409 conflict/refetch and a confirmed PATCH without touching MongoDB. Browser screenshots were inspected for preservation of the original dashboard composition.

For a separately authorized live check, sign in as the intended development owner, visit Orders, use Refresh, and locate the user-reported Direct checkout reference. Compare its server total and details with the checkout confirmation. Test status updates only with explicit permission and a chosen disposable Order. No live status change, development database mutation, or MongoDB integration test was performed for this frontend task.

## Workflow update verification (2026-10-20)

The updated browser test exercised All/Pending grouped filters, legacy `preparing` reconciliation after a 409, final-action confirmation, Arabic cancellation confirmation without a PATCH, desktop English and mobile Arabic labels, and an Arabic Order dialog using Tajawal. The Owner Orders MongoDB integration test ran only on guarded `savora_test`. No live `savora_dev` Order status was changed.
