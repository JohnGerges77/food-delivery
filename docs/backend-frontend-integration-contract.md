# Future frontend integration contract

This is a mapping guide for the existing Next.js app; no frontend files were changed in Phase 7. The current `frontend/src/services/*` functions read fixtures or mutate mock arrays. Replace those service boundaries deliberately rather than changing backend tenant rules to fit fixture data.

## Tenant and session flow

- A guest storefront resolves its restaurant by a validated slug and calls `/api/public/restaurants/:slug` plus the public Category and Product lists. Use the returned `id` values as opaque MongoDB ObjectId strings. Existing fixture IDs such as `ord-1001` are not API identifiers.
- One central owner dashboard signs in through `POST /api/auth/login` from an exact trusted Origin with `X-Savora-CSRF: 1`. Use `credentials: 'include'`; retain no session token in localStorage. On reload, call `GET /api/auth/me` to recover the safe owner/restaurant context.
- For owner mutations, obtain the session-bound CSRF token from the readable cookie when dashboard and API share a hostname, or call `GET /api/auth/csrf` with credentials from the trusted Origin when they are same-site sibling hostnames. Send that value in `X-Savora-CSRF` and keep `credentials: 'include'`. A 401 means reauthenticate; a 403 means Origin/CSRF configuration or token is wrong. `POST /api/auth/logout` requires the same Origin and CSRF header.
- `SameSite=Lax` requires same-site dashboard/API deployment. A storefront domain does not belong in `AUTH_TRUSTED_ORIGINS`, because public routes are noncredentialed. A dashboard on an unrelated site needs a separately reviewed cookie/CSRF design.

## Existing frontend field adapters

| Current frontend field/behavior | Backend contract and adapter |
| --- | --- |
| `Category.image` | Map from API `imageUrl` (nullable). Maintain a presentation fallback for null. |
| `Product.image` | Map from API `imageUrl`; API also supplies `images`. Do not send fixture-only `rating` as a Product write field. |
| Flat `Restaurant.deliveryFee`, `minimumOrder` | Read from `restaurant.deliverySettings.deliveryFee` and `.minimumOrder`. Preserve `deliveryAvailable` and `estimatedDeliveryTime` when rendering settings. PATCH only fields that changed. |
| Restaurant `socialLinks` and opening hours | API uses the same nested `socialLinks` object and a display-only `openingHours` string. Do not infer open/closed times from it. |
| Fixture IDs and order numbers | Use API `id`/`productId` ObjectId strings and server-generated `SV-...` order numbers. Never generate authoritative IDs or order numbers in the browser. |
| `Order.phone`, `address` | Owner Order DTO uses `customerPhone`, `deliveryAddress`, plus `city` and optional `customerEmail`. Map for display; do not expose the private owner Order DTO in public pages. |
| Cart `price`, totals | Display public Product prices and `currency`, but submit only `productId`, `quantity` and optional item `notes`. The server derives all prices, fees and totals. |
| Checkout form | Map to `customerName`, `customerPhone`, optional `customerEmail`, `deliveryAddress`, `city`, optional `notes`, `submissionMethod: direct|whatsapp`, and `items`. Generate a fresh Idempotency-Key for a new checkout and reuse it unchanged when retrying that checkout. |
| WhatsApp completion | Wait for a successful persisted checkout response before opening `whatsapp.url`. Display `messageSent:false` accurately; opening the URL does not prove delivery or payment. |
| `DashboardStats.revenueToday` | Use analytics `deliveredOrderValue` with its UTC period metadata and currency. Label it "Delivered Order Value" or equivalent, not paid revenue. Do not equate all created Orders with revenue. |
| `TopProduct.ordersCount`, `revenue` | Use `/stats/top-products` `quantitySold` and `deliveredItemValue`, based on saved Order snapshots. No profit or payment value is available. |
| Recent Orders | Use paginated `/api/owner/orders`, not the analytics responses. Its guest details must stay inside authenticated owner views. |

## Dashboard charts and dates

`/api/owner/stats/overview` provides comparison KPIs and sparklines. `/trends` supplies zero-filled current and previous arrays for line/area charts. `/breakdowns` supplies status and submission-method slices. `/top-products` supplies ranked bars. `/activity` supplies all 168 Monday-first UTC cells. Use `from` inclusive and `toExclusive` exclusive UTC timestamps from each response. Display the response `currency`; do not recompute financial values in the browser. Weekly buckets start on Monday and monthly buckets on the first of the month. Previous weekly series can have a different number of buckets. See [analytics API](dashboard-analytics-api.md) and [design guide](dashboard-analytics-design.md).

## Error and loading behavior

Use the API's bounded pagination metadata. Preserve 404 as an unavailable/missing resource without revealing another restaurant. Show validation errors from 400 without reflecting submitted secrets. On 409 during checkout, do not silently create another order with a new key; reconcile the original attempt first. On Order status 409, refresh the Order because another update may have won. Treat 503 as an unavailable service and do not show a successful checkout. Empty Categories, Products, Orders, and analytics arrays are valid states. Do not cache owner or checkout responses in shared/public caches.

V1 deliberately has no public signup, customer account, online payment, public tracking, reservation, or dashboard role hierarchy. A verified payment signal and a restaurant-local timezone are not yet represented by these APIs.
