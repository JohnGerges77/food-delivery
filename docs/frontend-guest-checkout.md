# Phase 8.5: public guest checkout frontend

## Scope and routing

The existing dark/orange `CheckoutOrderingPage` remains at `/{locale}/r/{slug}/checkout`. Its hero, customer card, field styling and icons, progress strip, animated layout, and order summary are retained. The Details, Review, and Submit stages now work within that card. The route slug and the Zustand cart tenant must match before any request is sent. Changing the restaurant slug remounts checkout, so one restaurant's draft fields do not appear in another. No owner credentials, cookies, CSRF token, or browser-provided `restaurantId` enter the public checkout call.

The form maps `fullName → customerName`, `phone → customerPhone`, optional `email → customerEmail`, `address → deliveryAddress`, `city → city`, and optional `notes → notes`. Cart entries map to `items: [{ productId, quantity, notes? }]`. The client validates the backend's text, phone, ID, distinct-product, and quantity limits. It sends no price, fee, total, status, or order number. The server still validates all input and authoritatively prices the order from tenant-owned records.

## Direct and WhatsApp flow

The Details stage keeps all six controlled fields editable. Review shows the entered contact and delivery details. Submit offers Direct and WhatsApp choices. The button is disabled only while a request is running or the tenant cart is empty. The order summary uses the real restaurant currency; amounts shown before save are labeled provisional, and a null delivery fee remains unknown rather than becoming a displayed zero.

`POST /api/public/restaurants/:slug/orders` uses `credentials: "omit"`, a JSON body, and an `Idempotency-Key`. A successful `200` replay or `201` response must include `savedInSavora: true`, a valid order reference, currency, and final server amounts before the UI shows success. The cart is cleared after confirmation only if the current cart still belongs to the same restaurant and has the same products and quantities that were submitted. The confirmation displays the backend order number and total, with no payment claim.

For WhatsApp, the server saves the Order first and returns the handoff URL. The confirmation states that the WhatsApp message has **not** been sent. The URL is rendered as a user-clickable link only after the saved response is validated; the page never opens WhatsApp automatically. A missing or invalid restaurant WhatsApp target is reported as checkout unavailable by the backend.

## Idempotency and failures

`GuestCheckoutCoordinator` computes a SHA-256 fingerprint of the normalized request body and generates a cryptographic UUID for a new logical payload. Concurrent submit calls share one in-flight promise. After a network timeout, unknown response, or HTTP 503, the exact same body and key are reused for the same payload. The key changes if the payload or restaurant changes; returning to a previous payload reuses that payload's pending key. A `409` is shown as a conflict or unavailable checkout; the UI does not manufacture a confirmation. Other non-success responses preserve the form and cart.

Pending keys, slug, and fingerprints are stored in `sessionStorage`; customer information and request bodies are not stored there. This allows an attempt to be recovered after a refresh **if** the guest rebuilds the same cart and re-enters the same form values. The cart and form remain in memory, so refreshing loses their visible state. Changing details after an uncertain result creates a different logical attempt and may create another Order if the first attempt committed; the warning remains visible while editing, and retrying the original details first is safest. Each pending session key is removed only after its validated saved response.

The backend uses one generic `409 Checkout unavailable` for unavailable products, inactive categories, delivery restrictions, minimum order, currency configuration, and WhatsApp target problems. The frontend therefore gives a combined explanation rather than attributing an unverified specific cause. A `503` can have an uncertain outcome and uses the retry path.

## Verification

- Frontend unit tests: `node --test test/*.test.mjs` from `frontend/` (46 passed).
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` (passed).
- ESLint: `node node_modules/eslint/bin/eslint.js .` (passed, after removing one unused test helper).
- Production build: `node node_modules/next/dist/bin/next build` (passed).
- Headless browser: `node test/checkout-input.browser.mjs` and `node test/guest-checkout.browser.mjs` with local Next plus Chrome CDP. The latter intercepts checkout `OPTIONS` and `POST`, so no database Order is created. Desktop English and mobile Arabic screenshots were inspected. Tests cover typing, Tab focus, steps, validation, loading, a timed-out request and same-key replay, Direct confirmation, and WhatsApp confirmation/link.
- Backend offline regression: `node --test` from `backend/` (136 passed). No MongoDB integration test was run for this frontend change.

The local storefront product/catalog GETs used for the browser tests were read-only. No checkout POST reached `savora_dev`; no development records were modified. Live checkout against `savora_dev` remains for a separately authorized manual test.
