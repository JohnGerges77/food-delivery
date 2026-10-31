# Owner Products API (Phase 4.3)

All routes require a verified owner session. POST, PATCH, and DELETE also require a configured trusted Origin and the session-bound CSRF token. The server derives `restaurantId` from the session.

- `GET /api/owner/products`: returns `{ products, pagination: { page, limit, total, hasNext } }`. Optional query keys are `page` (1–1000, default 1), `limit` (1–100, default 20), `categoryId`, `isAvailable`, `isFeatured`, and `sort` (`name`, `-name`, `price`, `-price`, `createdAt`, `-createdAt`; default `-createdAt`). `_id` breaks sort ties.
- `GET /api/owner/products/:id`: returns `{ product }` or a non-disclosing 404.
- `POST /api/owner/products`: requires `name`, `slug`, `categoryId`, and `price`; returns 201 with `{ product }`.
- `PATCH /api/owner/products/:id`: updates only supplied editable Product fields; returns `{ product }`. Name changes do not change the slug.
- `DELETE /api/owner/products/:id`: returns 204 when no Order item references the Product; otherwise returns 409 and recommends `isAvailable: false`.

The Product DTO includes `id`, `name`, `slug`, `categoryId`, `description`, `price`, `oldPrice`, `imageUrl`, `images`, `isAvailable`, `isFeatured`, `preparationTime`, and `calories`. Optional values are `null` when unset. The request body limit is 16 KB. No file uploads are supported; image values accept root-relative paths or HTTP(S) URLs.

## Money

`price` and optional `oldPrice` are finite, nonnegative JSON numbers capped at 1,000,000 major currency units. Their decimal digits must fit the authenticated restaurant's ISO currency minor units as reported by `Intl.NumberFormat` (EGP: two, JPY: zero, KWD: three). `oldPrice: null` clears that optional field. These checks restrict input; the existing Mongoose Number storage remains unchanged. Checkout reads authoritative stored Product prices and calculates totals in integer minor units before persisting the existing major-unit Number fields; browser-submitted amounts are rejected.

## Category and Order references

Product creation and category reassignment validate the Category in the owner's tenant. They and Category deletion run in MongoDB transactions that write the same internal `Category.referenceRevision` field. A concurrent writer therefore creates a write conflict; up to three whole-transaction attempts repeat the Category check. Unknown commit results retry committing the same transaction up to three times, without repeating a possibly committed Product creation. An inactive Category may hold draft products. Future public menu reads must exclude products in inactive categories.

All application paths that create or reassign Products must use this coordination; MongoDB references alone do not enforce it. Direct database writes that bypass the service can still create broken references. Product deletion checks every historical Order item before deleting and never changes embedded snapshots. Guest checkout now coordinates Order creation with Product deletion through bounded transactions and a Product write fence.
