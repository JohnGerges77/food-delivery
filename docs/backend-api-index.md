# Backend API index

Base path is `/api`. JSON errors use an `{ "error": "..." }` object; 204 responses have no body. Unrecognized paths return JSON 404. Unexpected service/database failures return a generic 503 without a stack trace. All owner IDs are MongoDB ObjectId strings. No public signup, customer login, or public order lookup exists.

## Health and authentication

| Method and path | Access | Contract |
| --- | --- | --- |
| `GET /api/health` | Public | 200 `{status:"ok", message:"HTTP service is running"}` when MongoDB is ready; otherwise 503 `{status:"unavailable"}`. |
| `POST /api/auth/login` | Trusted owner Origin | `{email,password}` JSON, max 4 KB, plus `X-Savora-CSRF: 1`; returns safe `{user,restaurant}` and fresh session/CSRF cookies. Invalid credentials, unknown email and inactive accounts share a generic 401. |
| `GET /api/auth/me` | Owner session | Safe `{user,restaurant}`. No password, session hash, or raw Order data. |
| `GET /api/auth/csrf` | Owner session and trusted Origin | `{csrfToken}` for a dashboard on a sibling API hostname. Validates the CSRF cookie against the session hash. Never cache or log it. |
| `POST /api/auth/logout` | Owner session, trusted Origin, CSRF | Revokes the session and clears cookies; 204. |

Owner session cookies are HttpOnly, host-only, SameSite=Lax, and scoped to `/api`; `Secure` is set in production. The separate CSRF cookie is readable by same-origin browser JavaScript, and `/auth/csrf` is available for a trusted sibling hostname. State-changing owner routes require an exact configured `Origin` and a matching `X-Savora-CSRF` token. Owner CORS is credentialed only for `AUTH_TRUSTED_ORIGINS`; public CORS never sends `Access-Control-Allow-Credentials`.

## Owner dashboard

Every route below requires a verified owner session and derives the restaurant exclusively from it. Forged `restaurantId`, `userId`, or role input cannot switch tenants. Foreign resource IDs receive the same non-disclosing 404 as missing IDs.

| Method and path | Main request/response |
| --- | --- |
| `GET /api/owner/restaurant` | `{restaurant}`: safe settings DTO. |
| `PATCH /api/owner/restaurant` | Whitelisted partial settings JSON, max 8 KB; `{restaurant}`. Slug, status, currency and ownership are immutable. Nested objects patch individual fields. |
| `GET /api/owner/categories` | Bounded `page`, `limit`, `sort`; `{categories,pagination}`. |
| `GET /api/owner/categories/:id` | `{category}`. |
| `POST /api/owner/categories` | Name and slug required, max 8 KB; 201 `{category}`. |
| `PATCH /api/owner/categories/:id` | Whitelisted partial JSON, max 8 KB; `{category}`. |
| `DELETE /api/owner/categories/:id` | 204; 409 if any Product references it. |
| `GET /api/owner/products` | Bounded `page`, `limit`, `sort`, `categoryId`, `isAvailable`, `isFeatured`; `{products,pagination}`. |
| `GET /api/owner/products/:id` | `{product}`. |
| `POST /api/owner/products` | Name, slug, tenant Category ID and price required, max 16 KB; 201 `{product}`. |
| `PATCH /api/owner/products/:id` | Whitelisted partial JSON, max 16 KB; `{product}`. |
| `DELETE /api/owner/products/:id` | 204; 409 if any historical Order item references it. |
| `GET /api/owner/orders` | Bounded pagination and exact status, method, order number, UTC created-date filters; `{orders,pagination}`. |
| `GET /api/owner/orders/:id` | `{order}` with persisted item snapshots and guest details, visible only to its owner. |
| `PATCH /api/owner/orders/:id/status` | `{status}` JSON, max 1 KB; `{order}`. Only allowed next status, conditional atomic update; 409 on conflict. |
| `GET /api/owner/stats/overview` | Current/previous UTC KPIs, changes, sparklines and insights. |
| `GET /api/owner/stats/trends` | Chronological, zero-filled current and previous bucket arrays. |
| `GET /api/owner/stats/top-products` | Delivered Order snapshot rankings; optional `limit=5|10|20`, `rankBy=quantitySold|deliveredItemValue`. |
| `GET /api/owner/stats/breakdowns` | Direct/WhatsApp and current-status counts for Orders created in the selected period. |
| `GET /api/owner/stats/activity` | 168 UTC weekday/hour cells and busiest-period insights. |

All owner mutations in this table also require trusted Origin and session-bound CSRF. Analytics accept `period=7d|30d|6m|12m` (default 30d) or a bounded custom `from`/`to` UTC date range. Delivered Order Value is an operational measure for Orders currently delivered and delivered in the selected window; it is not verified payment. Full contracts: [owner products](owner-products-api.md), [owner orders](owner-orders-api.md), [analytics](dashboard-analytics-api.md).

## Guest storefront

The validated URL slug selects the tenant. Active restaurants only; unavailable restaurants return a safe 404. These routes do not require login, cookies, owner Origin, or CSRF.

| Method and path | Main request/response |
| --- | --- |
| `GET /api/public/restaurants/:slug` | Safe `{restaurant}` metadata. |
| `GET /api/public/restaurants/:slug/categories` | Active same-tenant `{categories,pagination}`; bounded page/limit. |
| `GET /api/public/restaurants/:slug/products` | Available Products in active same-tenant Categories; `{currency,products,pagination}`. Bounded category/featured/sort filters. |
| `POST /api/public/restaurants/:slug/orders` | Guest checkout JSON, max 12 KB, required `Idempotency-Key`. First success 201, equivalent retry 200. Returns safe `{order}` and, for WhatsApp, `{whatsapp:{url,messageSent:false}}` after persistence. |

The public response does not return customer details or hashes. The WhatsApp URL itself contains message details, so the client should handle it as sensitive. Full contracts: [public menu](public-menu-api.md) and [guest checkout](guest-checkout-api.md). There is no public order tracking endpoint in V1.

## Common status behavior

`400` means invalid input or query; `401` means missing/invalid owner session or generic login failure; `403` means untrusted Origin or bad CSRF; `404` hides missing/foreign resources; `409` means a business or concurrency conflict; `413` means an oversized JSON body; `414` is used for bounded analytics and owner Order listing URLs; `429` is a login or checkout rate limit with `Retry-After`; `503` means database or service unavailable. Check each endpoint's detailed document for its exact cases. Unknown query keys and MongoDB operators are rejected on list and analytics APIs.
