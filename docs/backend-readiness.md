# Backend readiness audit (Phase 7)

Scope: backend audit, targeted hardening, guarded test journey, and documentation. No frontend work, live provisioning, production migration, deployment, or `savora_dev` write was performed. See the [API index](backend-api-index.md), [environment setup](backend-env-setup.md), and [future frontend mapping](backend-frontend-integration-contract.md).

## Runtime and API findings

The previous nodemon "app crashed" line had no captured cause, so it cannot be attributed to a particular past error. The pre-audit server did allow listening without `MONGODB_URI`, which could mislead an operator. Startup now requires Node 24, `MONGODB_URI`, and `AUTH_TRUSTED_ORIGINS`; validates port/proxy configuration; verifies origin/cookie settings before contacting MongoDB; and listens only after connection. Database selection errors are reported without echoing the URI. The `/api/health` response is now a database readiness check (503 when disconnected), and SIGINT/SIGTERM close the listener and MongoDB connection. HTTP startup, port conflict, missing configuration and real Atlas DNS/network faults should be diagnosed separately. Automated startup tests do not contact a development database.

Owner and public routes now share minimal response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`), no `X-Powered-By`, JSON 404s for unknown paths, and generic 503s for unexpected errors. Owner cookie and mutation protections remain intact. Timeouts bound HTTP headers/requests and MongoDB server selection; the connection pool is capped at 20. A trusted proxy hop count is opt-in and defaults to zero.

## Authentication and tenant security

Reviewed `password.js`, `ownerAuth.js`, `OwnerSession`, `auth.js`, `owner.js`, `ownerTenant.js`, settings, Category/Product/Order services, analytics and their tests. Argon2id configuration remains `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`. Login uses generic 401 failures, bounded input and per-process throttling. A fresh random token is issued on successful login; only its SHA-256 hash is stored. Session expiry is checked on every authenticated request and the TTL index removes expired records eventually. Owner `isActive` and Restaurant `status: active` are checked for every verified session; logout deletes the session. The owner authentication context is created only after database verification and cannot be fabricated by request headers/body/query.

The owner session cookie is HttpOnly, Secure in production, host-only, SameSite=Lax, and Path `/api`. The CSRF cookie is session-bound; mutation requests require its matching header and an exact trusted Origin. An additive `GET /api/auth/csrf` route returns the raw CSRF token only to an authenticated request from a trusted Origin, so a dashboard on a same-site sibling hostname can use the host-only API cookie. It does not return a session token or hash. Public routes use noncredentialed CORS; owner CORS never allows wildcard credentials. No public registration or customer authentication exists.

Owner Restaurant, Category, Product, Order and analytics operations scope reads and writes to the verified restaurant. Resource lookups combine `_id` and tenant scope; foreign and missing IDs share 404 responses. Product Category reassignment checks same-tenant Category ownership. Checkout checks each Product and its active same-tenant Category. Explicit DTOs avoid hashes, internal revisions and administrative fields. Owner Order details intentionally contain guest PII and must be presented only in protected owner views. Tests cover forged tenant inputs, cross-tenant reads/writes, malformed IDs, operators, dotted keys, prototype-pollution keys, unknown fields, CSRF and Origin failures.

## Checkout, orders and analytics consistency

Direct and WhatsApp checkout both persist an Order before confirmation; WhatsApp handoff is generated from the saved snapshot and explicitly reports `messageSent:false`. Product price, category, delivery fee, minimum order and availability come from tenant-owned database records. Currency precision is checked and totals are calculated in integer minor units before storage in the existing Number fields. Order numbers include 96 random bits and a tenant-scoped unique index. Idempotency keys are hashed, tenant-scoped and unique; identical retries recover the original confirmation, while different input with the same key returns 409. A database error cannot return successful checkout.

Category deletion versus Product creation/reassignment, and Product deletion versus Order creation, use bounded MongoDB transactions with shared document write fences. Supported APIs therefore reject or retry races rather than leave references orphaned. Direct database writes that bypass these services have no foreign-key guarantee. Owner status changes use a tenant-scoped conditional atomic update; `deliveredAt` is set on the transition to `delivered` and terminal statuses cannot be reopened. Order item snapshots survive Product edits.

Analytics match the verified tenant before aggregation, bound UTC date ranges and work from persisted Orders. Created-order counts use `createdAt` and current status; delivered value, product rankings and delivery-event counts use currently delivered Orders and `deliveredAt`. Empty ranges are zero-filled, weekly buckets start Monday UTC, and monetary sums use Decimal128 conversion to minor units. Delivered Order Value is operational, not proof of payment collection. There is no historical status-event ledger or restaurant-local timezone conversion.

## Index inventory and controlled rollout

The required declarations are: Restaurant unique slug; User unique email and partial unique owner per restaurant; Category unique tenant slug and tenant sort order; Product unique tenant slug and tenant Category lookup; Order unique tenant order number, partial unique tenant idempotency hash, tenant `createdAt`, tenant status/`createdAt`, and partial delivered `restaurantId`/`deliveredAt`; OwnerSession unique token hash and expiration TTL. The read-only index checker reported **no missing or conflicting declared indexes on `savora_test`** during this audit. That result does not prove indexes exist in development or production.

Rollout procedure for each target environment:

1. Back up the database, identify the exact target URI/database, and obtain a dedicated credential with only the rights needed for inspection. Review current index names, keys, unique flags, partial filters and TTL values using `npm run indexes:check` with explicit `MONGODB_INDEX_CHECK_URI` and `MONGODB_INDEX_CHECK_DATABASE`; the script is read-only and has no fallback URI.
2. Before building a unique index, check for duplicate tenant/order/idempotency values and resolve them through a reviewed, tenant-specific data plan. Plan capacity and write load for index creation. Do not drop an existing index or run `syncIndexes()` automatically.
3. Have an operator approve and run explicit `createIndex` commands for each missing declaration during a controlled maintenance window. In particular, verify the partial `Order(restaurantId,idempotencyKeyHash)` unique index before accepting guest checkout and the partial `Order(restaurantId,deliveredAt)` index before relying on delivered-date reporting at scale.
4. Re-run the read-only checker and a limited smoke test in that environment. Record exact index specs and query plans. If an existing index conflicts, pause for a reviewed migration; do not force replacement.

For an operator-approved rollout, the two newer Order definitions are exactly:

```javascript
db.orders.createIndex(
  { restaurantId: 1, idempotencyKeyHash: 1 },
  { unique: true, partialFilterExpression: { idempotencyKeyHash: { $type: 'string' } } }
);
db.orders.createIndex(
  { restaurantId: 1, deliveredAt: -1 },
  { partialFilterExpression: { status: 'delivered' } }
);
```

These are documentation for a reviewed manual operation, not commands run by the backend audit. Confirm exact target database, existing indexes and duplicate data before using them.

The checker compares declared key order, uniqueness, partial filters and TTL. It cannot measure query-plan quality, collection size, duplicate data, or live build impact. No production or development index change was made in this audit.

## Rate limiting, dependencies and deployment checklist

Login and guest checkout rate limits are in-process Maps, bounded in size. They are useful for local/single-instance development but are **not a shared production abuse control**. For multiple instances, enforce shared limits at a trusted edge/API gateway keyed by verified client IP and route, with a documented policy for retries and `Retry-After`; a Redis-backed application limiter is an alternative when that infrastructure exists. Configure `TRUST_PROXY_HOPS` only for a private backend behind the exact trusted proxy chain. Limit request bodies and URLs at the proxy as well as in Express, protect the public checkout route, set ingress connection limits, and monitor MongoDB latency, error rates and pool saturation. Logs must omit passwords, URI credentials, cookies, CSRF tokens, Idempotency-Key values, guest PII and WhatsApp handoff URLs. TLS, HTTP-to-HTTPS redirect, HSTS, secret injection, backup/restore, process supervision, health checks, and alerting belong to the deployment environment.

On the audit date, `npm audit` reported **three high advisories in development dependencies**: `nodemon@3.1.14 → chokidar@3.6.0 → braces@3.0.3`. `npm audit --omit=dev` reported **zero production dependency advisories**. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) listed no patched `braces` release at review time; npm proposed a breaking old nodemon downgrade. No force fix or dependency change was applied. Do not ship dev dependencies in the production image. Reassess the advisory and compatible watcher options when a supported fix exists.

Before production traffic, verify:

- Production Node 24, lockfile install, required secrets/origins, HTTPS and cookie topology, private backend network, trusted proxy hop count, and shared edge rate limiting.
- Production index inspection and controlled rollout, Atlas replica-set transaction support, backup/restore, database least privilege, and monitoring.
- Deployment smoke tests for login/CSRF, guest checkout/idempotency, Order transitions and analytics with approved disposable fixtures; never reuse `savora_test` or run the development provisioning CLI against production.
- No shared/public caching of owner or checkout responses; no plaintext sensitive values in logs or error reporting.

## Verification and limits

The backend-only E2E journey provisions two disposable `savora_test` tenants and covers login, `/me`, CSRF bootstrap, settings, Category/Product creation, public menu, direct and WhatsApp checkout, idempotent retry, persisted Orders, owner listing, status transitions, analytics, cross-tenant denial and logout. Cleanup deletes only IDs within those newly created test tenants. The complete unit and guarded integration suite results are recorded in `AGENTS.md` after execution.

This audit establishes readiness for **frontend integration**, not automatic production deployment. Production still needs the environment-specific index review, TLS/proxy/shared-rate-limit setup, approved smoke tests, and operational monitoring above. V1 intentionally excludes customer accounts, online payments, public order tracking, table ordering/reservations, and a staff role hierarchy.
