# Order numbers and online ordering entitlement

## Order references

The existing `Order._id`, `Order.orderNumber` (`SV-…`) and idempotency hashes retain their meanings. An optional integer `displayNumber` provides the customer-facing reference, beginning at `#1001` for each restaurant. Legacy rows without it display their original full reference. Customer confirmations, prepared WhatsApp messages, and Owner order lists, details and recent orders use the display reference. No live export or printable Order route exists in this baseline.

The restaurant row carries the last committed `orderDisplaySequence`. Checkout locks that row, checks the effective entitlement, validates the menu items and calculates authoritative prices. It increments the sequence and inserts the Order in the same transaction. A missing counter starts at 1000. Aborts roll back both writes. Cancellation and deletion never decrement the counter. The partial unique index independently enforces uniqueness for numbered Orders within a tenant.

Idempotency lookup runs before a new write and again inside the transaction after it acquires the tenant write lock. A matching retry returns the existing Order and number. A changed payload with the same key returns 409. A bounded retry with backoff handles transient write conflicts. Uncertain commits are retried on the same transaction or resolved using the same idempotency key.

Owner search is tenant-scoped. `#1001` matches the display number, a bare number also checks for an exact legacy reference, and `SV-…` still matches the original reference. The UI uses Western digits in both locales. The display number grants no access to orders.

## Platform entitlement

Only the Platform Admin may change `Restaurant.onlineOrderingEnabled` using `PATCH /api/admin/restaurants/:id/ordering` with `{"onlineOrderingEnabled":true}` or `false`. This uses the existing Admin session, trusted Origin and session-bound CSRF. A successful change and its `restaurant.ordering_changed` audit event commit together on the same restaurant row. The Owner can read the mode and manage order operations only when entitled. Profile, catalog, branding, analytics and historical Orders remain available through their existing permissions.

New restaurant creation through Platform Admin or the provisioning CLI explicitly defaults to Digital Menu Only. The Admin may enable ordering at creation or from restaurant details. Legacy records missing the field are interpreted as entitled so their operational behavior is preserved.

The public restaurant response reports the entitlement and effective availability. The Express response and Next fetch are both uncached. Effective availability checks entitlement, the deployment gate, and restaurant status and delivery settings. WhatsApp additionally requires its existing switch, valid destination and Beta allowlist. Cart validation separately enforces product, variant and category availability within the tenant. Existing Origin and WAF policies still apply to the same guest POST endpoint.

An otherwise eligible new checkout for a menu-only tenant returns HTTP 403 with code `ONLINE_ORDERING_DISABLED`. It creates no Order, allocates no number and produces no handoff. A matching replay for a committed Order remains readable through the original request and key. When the entitlement is off, a WhatsApp replay has `url: null` and `messageSent: false`. Existing deployment-wide shutdown and suspension rules still apply.

Digital Menu Only removes ordering controls across Classic, Aqua, Café and Luxury. Listings retain details links and product pages retain read-only variant prices. Old Cart and Checkout URLs redirect to the same restaurant's menu. A stale open checkout handles the server's 403 and returns to the menu. An already-rendered tab refreshes its permissions on the next storefront read. Cart storage stays scoped to the restaurant, and placing a new order always requires a new customer action.

## Index and backfill rollout

Before deploying this candidate to any environment that verifies declared indexes at startup, create and independently verify the following additive index using the separately authorized DDL principal. The restricted runtime never creates it. The manifest now expects 20 custom indexes across the same nine collections.

```javascript
db.orders.createIndex(
  { restaurantId: 1, displayNumber: 1 },
  { unique: true, partialFilterExpression: { displayNumber: { $type: "number" } } }
)
```

After separate release approval, use the backend CLI with an explicitly scoped `MONGODB_ORDER_BACKFILL_URI`. The database in the URI and the connected database must match the command's database argument. The default invocation is a read-only snapshot and reports existing display numbers, the legacy count, and the counter floor.

```text
node src/cli/backfill-order-display-numbers.js DATABASE RESTAURANT_SLUG
node src/cli/backfill-order-display-numbers.js DATABASE RESTAURANT_SLUG --apply 500
```

Apply requires the matching unique index. It raises the counter to cover any existing numbered rows, then assigns missing numbers oldest-first by `createdAt` and `_id`. Each legacy assignment and counter increment share the same lock and transaction as live checkout. New orders may interleave and occupy numbers without changing the relative order of legacy assignments. The CLI detects duplicate or invalid display numbers, preserves original references, amounts, statuses and timestamps, and verifies the result in a consistent snapshot. Repeat bounded batches until `remaining` is zero and a second run reports `updated: 0`. Run any production backfill only after writer versions and the index are verified.

The live Beta deployment and data were outside this task. The candidate was verified on `savora_test` using synthetic fixtures and exact-ID teardown.

## Verification

Node `v24.22.3` at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` ran all checks.

- `node --test test/*.test.js` from `backend/` passed 189/189.
- The guarded `savora_test` runs covered `integration/guestCheckout.integration.js`, `integration/platformAdmin.integration.js`, `integration/publicMenu.integration.js`, and `integration/tenant.integration.js`. All 34 cases passed across the runs. The concurrency suite was rerun after adding bounded backoff.
- In `frontend/`, `node --experimental-strip-types --test test/*.test.mjs` passed 116/116. `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, and `node node_modules/next/dist/bin/next build --webpack` passed.
- Chromium ran `node test/ordering-entitlements.browser.mjs` against the local in-memory fixture (`SAVORA_ENTITLEMENT_VISUAL=1` with `test/phase101-visual-api.mjs`) and the built candidate. It passed 32 menu-only layouts across four themes, both locales and both screen sizes. It exercised the Admin switch, stale links, branding, read-only variants, the Arabic confirmation, Owner search and retained history.
- `node test/batch01-checkout.browser.mjs` passed local mocked Direct and WhatsApp checkout in standard and Beta mode on desktop English and mobile Arabic.
