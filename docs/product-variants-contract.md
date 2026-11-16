# MVP Fix 14 — implementation contract

Reviewed against deployed baseline `2454be805c19a154576a14b483d6d4174280b4d8`.

The user confirmed that converting a variant product to a normal product requires explicitly entering a normal price, and that stale variant cart lines must be rejected. The dashboard clears the normal-price input on conversion; the API requires price in the conversion patch even when its numeric value equals the old stored price. For newly created variant products the retained normal-price field starts from the minimum submitted variant price, but is never used for variant checkout.

## Existing behavior

Product has one required major-unit Number price. Owner writes validate currency precision. Public products are tenant-scoped and require an active owned Category. Checkout writes the Product inside its transaction, derives prices in integer minor units, and persists immutable Order item snapshots. Cart is currently in-memory across client navigation, keyed only by productId; checkout rejects duplicate productIds. Order snapshots and WhatsApp currently contain only the product name.

## Additive contract

- Optional embedded `variants`: `{ _id, name, price, isAvailable, sortOrder }`. Missing/empty means a normal product. No new collection, index or migration. Embedded ObjectIds are server-generated for new entries; Owner DTO uses `id`. Existing IDs must belong to the current Product. Renaming/repricing/reordering preserves them; removed IDs cannot be submitted again as existing variants. At most 20 variants; names trimmed and bounded, amounts use restaurant currency precision, order is sortOrder then ID.
- Keep stored `Product.price` as the normal-product price for compatibility. Variant checkout never uses it. Public DTO adds variants and startingPrice; existing price remains unchanged. Variant displays and price sorting must use the lowest available variant amount. Hide promoted/orderable products with no available variants. Suppress product-level oldPrice for variant prices because it does not describe a particular variant.
- Owner sends a complete variants array only when changed. New entries omit id. Existing entries carry their own id. Removing variants requires an explicit `price` in the same write (user-confirmed conversion policy); stale variant cart lines are rejected. Warn in the UI before removing variants or converting modes. No historical Order mutation.
- Checkout item adds optional `variantId`; it is mandatory for a variant Product and forbidden for a normal Product. Duplicate identity is `(productId, variantId)`, not productId alone. Preserve the current 10-line/100-unit bounds. Reject stale, unavailable, deleted or foreign variants without substitution. No browser prices/names are trusted.
- Order snapshot adds optional `variantId` and `variantName`; `unitPrice` remains the actual authoritative purchase price. Legacy items omit these fields. Owner DTOs and WhatsApp read the snapshot, never the live Product.
- Cart identity uses productId plus variantId; separate sizes never merge. Persist only non-personal cart data with tenant/version scoping; checkout contact data remains excluded. Hydration must not flash or overwrite a different tenant's cart. Stale carts are revalidated by checkout and remain visible on failure.

Cart persistence uses sessionStorage: it survives reload/navigation in the current browser tab, with safe in-memory fallback when storage is unavailable. Closing the tab is not a promise of durable cart retention. Switching restaurant clears the active tenant cart. No customer contact/address fields enter cart persistence.
- Existing idempotency input for legacy products stays byte-compatible: omit absent variantId rather than serializing null. VariantId is included in fingerprints and server request hashes. Successful replay returns the saved Order even after catalog changes.

## Security and verification

Tenant scope comes from verified Owner context or resolved public slug. Variant IDs are resolved only within the selected owned Product. Checkout's Product write fence also coordinates variant edits/removal with order creation. No Extras, upload changes, deployment or staging writes. Verify model/API/checkout/cart/UI compatibility, Direct and WhatsApp snapshots and retry semantics using exact-ID isolated savora_test fixtures and independent cleanup auditing. Keep results separate from this design until actually run.
