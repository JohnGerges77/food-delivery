# Owner Orders API (Phase 5.3)

All routes require a verified owner session. The server derives `restaurantId` from that session; request headers, body, and query values cannot select another tenant. Customer details are returned only for orders belonging to the authenticated owner's restaurant. Owner responses use the existing credentialed CORS policy and `Cache-Control: no-store`.

## Endpoints

- `GET /api/owner/orders` returns `{ "orders": [...], "pagination": { "page": 1, "limit": 20, "total": 0, "hasNext": false } }`.
- `GET /api/owner/orders/:id` returns `{ "order": {...} }`. A missing, malformed, or foreign ID receives the same 404.
- `PATCH /api/owner/orders/:id/status` accepts only `{ "status": "delivered" }` or `{ "status": "cancelled" }`. It returns `{ "order": {...} }`. Send the configured trusted `Origin`, owner session cookie, CSRF cookie, and matching `X-Savora-CSRF` header. JSON body limit: 1 KB.

Example safe Order response:

```json
{
  "order": {
    "id": "670e460ab0d9d830c8589699",
    "orderNumber": "SV-8341302408423A218E893F82",
    "customerName": "Mona Ali",
    "customerPhone": "+201001234567",
    "customerEmail": "mona@example.com",
    "deliveryAddress": "12 Nile Street",
    "city": "Cairo",
    "items": [{
      "productId": "670e460ab0d9d830c8589698",
      "name": "Burger",
      "unitPrice": 12.34,
      "quantity": 2,
      "imageUrl": "/burger.webp",
      "notes": "No onions"
    }],
    "subtotal": 24.68,
    "deliveryFee": 7.5,
    "total": 32.18,
    "status": "pending",
    "source": "website",
    "submissionMethod": "whatsapp",
    "notes": "Ring bell",
    "createdAt": "2026-10-01T12:00:00.000Z",
    "updatedAt": "2026-10-01T12:00:00.000Z",
    "deliveredAt": null
  }
}
```

Optional top-level or item fields are `null` when absent. Item names, prices, quantities, images, and notes come from the saved Order snapshot, not current Product records. Stored monetary values are returned unchanged. The DTO does not include `restaurantId`, tracking hashes, idempotency hashes, WhatsApp target, session information, or internal revision fields.

## Listing filters

Only these query parameters are accepted:

| Parameter | Rule |
| --- | --- |
| `page` | Integer 1-1000; default 1. |
| `limit` | Integer 1-100; default 20. |
| `status` | Exact stored status, including historical `preparing`, `ready`, and `out-for-delivery`. Cannot be combined with `statusGroup`. |
| `statusGroup` | `pending`, `delivered`, or `cancelled`. `pending` matches stored `pending`, `preparing`, `ready`, and `out-for-delivery` before counting and pagination. Cannot be combined with `status`. |
| `submissionMethod` | `direct` or `whatsapp`. |
| `from`, `to` | Valid `YYYY-MM-DD` UTC calendar dates. `from` starts at 00:00 UTC; `to` includes the full day. |
| `orderNumber` | Exact alphanumeric/hyphen string, up to 100 characters. |

Results sort by `createdAt` descending, then `_id` descending. Unknown parameters, duplicate values, malformed dates, and MongoDB operators are rejected. Lists are capped at 100 orders per page; both direct and WhatsApp orders appear. The `total` count applies to the same tenant and filters as the page. A page beyond the end returns an empty array with the unchanged total. The list URL is limited to 2048 characters.

## Status policy and concurrency

| Current status | Allowed next status |
| --- | --- |
| `pending` | `delivered`, `cancelled` |
| `preparing` | `delivered`, `cancelled` |
| `ready` | `delivered`, `cancelled` |
| `out-for-delivery` | `delivered`, `cancelled` |
| `delivered`, `cancelled` | None; terminal. |

New checkout Orders start as `pending`. The three intermediate statuses remain valid stored values for historical Orders and are never bulk rewritten. Owner DTOs retain their exact stored status so conditional updates can use it; the simplified UI labels all four nonterminal statuses Pending. The server sets `deliveredAt` atomically with `delivered` using server time. Cancellation leaves it unset. Clients cannot set it, reopen terminal orders, or edit customer details, snapshots, money, source, method, order number, timestamps, or tenant ID through this endpoint.

Each change first checks the current status, then performs a tenant-scoped atomic update conditional on that exact status. A competing change makes the conditional update fail with 409; the server does not retry it against a newer status. The client can fetch the current Order and decide what to do next. A request that arrives after another completed transition may proceed if it is valid from the newly observed status.

| Status | Meaning |
| --- | --- |
| `400` | Invalid list query, JSON, status value, or forbidden/malformed body field. |
| `401` | Missing, expired, revoked, or otherwise invalid owner session. |
| `403` | Untrusted Origin or missing/invalid CSRF token on PATCH. |
| `404` | Malformed, missing, or foreign Order ID. |
| `409` | Invalid or stale status transition. |
| `413` | PATCH body exceeds 1 KB. |
| `414` | Order list URL exceeds 2048 characters. |
| `503` | Database or service unavailable. |

## Simplified workflow verification (2026-10-20)

The guarded `savora_test` Owner Orders integration test verified direct `pending → delivered`, `pending → cancelled`, terminal states, legacy `ready → delivered` and `out-for-delivery → cancelled`, a readable `preparing` record, grouped Pending count before pagination, exact-status compatibility, tenant isolation, Origin/CSRF guards, atomic concurrent 200/409 outcomes, and server-set `deliveredAt`. No historical Orders were migrated or bulk updated. The full test invocation exhausted host memory; the affected Owner Orders file passed when run in the guarded suite before that interruption.
