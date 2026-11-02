# Staging QA Batch 01 — local implementation and verification

## Behavior

`Restaurant.heroProductId` is nullable. Owner Settings shows available products from the owner's tenant, filters out inactive categories, previews the name/image, and sends only the changed field. The owner PATCH verifies the product and category against the authenticated restaurant. The public Restaurant DTO resolves the current product under the same tenant, availability, and category constraints. If a selected product becomes ineligible, the Hero uses its theme's graphic fallback. Legacy restaurants without a selection keep their prior behavior. No product image was generated or uploaded.

Owner Settings accepts a clean `wa.me` URL or an Egyptian local mobile number such as `01278528656`, converting the latter to `https://wa.me/201278528656` only when the owner saves that tenant's settings. The shared checkout defaults to WhatsApp only when that restaurant has a valid configured target; Direct stays available. The backend still verifies prices and persists the Order before returning the handoff URL. The prefilled message uses the restaurant name, reference, snapshots, quantities, item prices, totals, guest contact, address, and notes. The UI attempts the handoff after a saved response and always keeps an Open WhatsApp link; a blocked popup has a clear message. No UI claims the message was sent.

Guest checkout no longer collects or sends Email. The backend keeps optional `customerEmail` for historical orders and existing API callers; owner/admin email remains intact. Menu cards use an independent full-surface preview button and Add button. Mobile cards are 116px high in the fixture, with 96px media and a 44px Add target. The cart attention effect retriggers only after a valid local add and respects reduced motion.

## Browser QA

`frontend/test/batch01-visual.mjs` drove a local Next dev server against the existing GET-only fixture `frontend/test/phase101-visual-api.mjs`. It checked all four themes at 1440, 768, 390 and 375px, LTR/RTL, Hero image or fallback, card size, keyboard Enter on the card preview, independent Add, immediate cart count/attention, and horizontal overflow. Measurements were recorded locally during QA. The fixture rejects Order POSTs.

`frontend/test/batch01-checkout.browser.mjs` intercepted the checkout POST in Chromium and returned an explicit mock saved response. It verified a single POST without email or client total, WhatsApp default, blocked popup message, and the manual handoff link. This browser check does not prove MongoDB persistence.

Local screenshots covered Classic, Aqua, Café and Luxury at desktop and mobile sizes, plus Arabic checkout and the blocked-popup fallback. The capture artifacts remain local.

## Staging integration — 2026-11-02

`backend/integration/batch01.staging.integration.js` reads only the ignored `backend/.env.staging.local`. Before writing it requires `SAVORA_BATCH01_STAGING_WRITE=YES`, Node 24, the staging URI username and database, no `dbName` override, and the actual connected database and authenticated username. It disables automatic collection and index creation. It is outside default test discovery; it must be invoked explicitly. It refuses to overwrite its fixture manifest. The manifests record only test IDs and hashed idempotency keys, not credentials or guest data.

The first staging run exposed a bug: the initial WhatsApp response omitted the restaurant name because checkout did not select it in its transactional restaurant query. Exact-ID cleanup succeeded, and an independent read-only audit returned zero. The query was corrected to select `name`, and the guarded test was repeated successfully. The rerun verified owner authorization, CSRF and Origin rejection, cross-tenant access and Admin denial; same-tenant Hero selection, public DTO, invalid/unavailable/foreign rejection, no-image DTO and clearing; and real Direct and WhatsApp Orders without email. Both orders had server-calculated EGP 24.68 subtotal, EGP 7.50 delivery and EGP 32.18 total, correct tenant and one persisted record after retry. The WhatsApp URL had the fixture restaurant's number, name, reference, item and total, with `messageSent: false`. No external WhatsApp URL was opened or message sent. The earlier mocked browser check covers blocked-popup behavior and the no-image visual fallback.

Each run cleaned exactly 2 Restaurants, 1 User, 1 OwnerSession, 2 Categories, 3 Products and 2 Orders using individual IDs and ownership checks. Separate read-only audit processes found zero remaining matching IDs, prefixed Restaurants, Users, Categories and Products, tenant Orders, OwnerSessions, or PlatformAudit records for each run. The exact IDs were recorded in local fixture manifests. Existing demo records were not used.

Node `v24.22.1` from `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` ran `node --test --test-concurrency=1 test/*.test.js`: **149 passed, 0 failed** after the fix. The no-opt-in invocation failed before connecting as intended. The frontend was unchanged during this integration task; earlier frontend tests and mocked browser QA remain documented above. No commit, push, deployment, or writes to `savora_dev` or `savora_test` occurred.
