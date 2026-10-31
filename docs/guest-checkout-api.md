# Guest checkout API (Phase 5.2)

`POST /api/public/restaurants/:slug/orders` creates a guest order for an active restaurant. The URL slug determines the tenant. No login, owner cookie, or CSRF token is required. Send `Content-Type: application/json` and a fresh `Idempotency-Key` header (16–128 ASCII letters, digits, `_`, or `-`; a UUID works). Use the same key when retrying the same checkout after a timeout. Use a new key for a new order.

```http
POST /api/public/restaurants/savora-cairo/orders
Content-Type: application/json
Idempotency-Key: 66ae6dc6-840a-45b9-a781-ecf393e058b1

{
  "customerName": "Mona Ali",
  "customerPhone": "+201001234567",
  "customerEmail": "mona@example.com",
  "deliveryAddress": "12 Nile Street",
  "city": "Cairo",
  "notes": "Ring the bell",
  "submissionMethod": "direct",
  "items": [{ "productId": "670e460ab0d9d830c8589699", "quantity": 2, "notes": "No onions" }]
}
```

`customerEmail`, top-level `notes`, and item `notes` are optional. Each cart item supplies only `productId`, `quantity`, and optional `notes`. The request accepts at most 10 distinct products, 99 units of one product, and 100 units total. The JSON body limit is 12 KB. Unknown fields, MongoDB operators, dotted keys, duplicate products, and client-generated amounts or order metadata are rejected.

First successful direct submission returns `201`:

```json
{
  "order": {
    "orderNumber": "SV-8341302408423A218E893F82",
    "status": "pending",
    "submissionMethod": "direct",
    "currency": "EGP",
    "subtotal": 24.68,
    "deliveryFee": 7.5,
    "total": 32.18,
    "savedInSavora": true
  }
}
```

For `submissionMethod: "whatsapp"`, the same Order is committed first. Only then is a handoff URL made from its saved snapshot. The restaurant must have a configured HTTPS `https://wa.me/<international-digits>` target. First success returns `201`:

```json
{
  "order": {
    "orderNumber": "SV-8341302408423A218E893F82",
    "status": "pending",
    "submissionMethod": "whatsapp",
    "currency": "EGP",
    "subtotal": 24.68,
    "deliveryFee": 7.5,
    "total": 32.18,
    "savedInSavora": true
  },
  "whatsapp": {
    "url": "https://wa.me/201001234567?text=Order%20SV-8341302408423A218E893F82%0A...",
    "messageSent": false
  }
}
```

The example URL is abbreviated. The actual URL is encoded and bounded. **Saved in Savora** means the database committed the order. Opening WhatsApp does not establish that a customer sent the message or that the restaurant received it. The API does not call a WhatsApp service or change the order from `pending`.

## Idempotency and errors

The server hashes the key, scopes it to the restaurant, and enforces a compound unique index. It compares a digest of normalized checkout input. A completed equivalent retry returns `200` with the original confirmation and no new Order. Reusing a key with different input returns `409`. An uncertain network response can be retried with the same key to recover the confirmation. Item order is part of the normalized input; keep the same cart order when retrying.

| Status | Meaning |
| --- | --- |
| `400` | Invalid JSON, missing/invalid key, or invalid/forbidden checkout field. |
| `404` | Unknown or suspended restaurant. |
| `409` | Reused key with different input, or checkout unavailable because of product, category, delivery, minimum order, monetary configuration, or WhatsApp target. |
| `413` | Body exceeds 12 KB. |
| `429` | More than 60 checkout requests per minute for one IP and slug on this server process; `Retry-After` is set. |
| `503` | Database or service unavailable; no success confirmation is returned. |

The public response does not contain customer details, internal MongoDB IDs, idempotency hashes, or tracking secrets. The WhatsApp handoff URL necessarily contains order/customer details for the message; treat it as sensitive and never log or cache it. Public CORS is noncredentialed and is not an authorization control.

## Pricing and concurrent writes

The server reads each tenant-owned available Product and its active tenant-owned Category. It takes name, image, and price from Product records, uses the restaurant's delivery fee and minimum order, and calculates with integer minor units according to the currency's fraction digits (0–3). It rejects unsupported precision, then persists the existing Order model's major-unit Number fields. Initial status is `pending`, source is `website`, and the order number contains 96 random bits plus a restaurant-scoped unique index.

Checkout and Product hard deletion run in bounded MongoDB transactions with snapshot reads and majority writes. Checkout increments an internal Product reference revision and Category reference revision before inserting the Order. Product deletion writes the same Product document and checks for any Order reference in its transaction. A write conflict retries the whole transaction and rechecks current ownership/availability/references. The Order item snapshot remains after later Product edits. Deployment must ensure the new Order idempotency unique index exists before accepting checkout traffic. The in-process rate limiter is per server instance; use shared edge protection when running multiple instances.
