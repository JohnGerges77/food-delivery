# MVP Fix 14 — local verification

Implementation baseline: `2454be805c19a154576a14b483d6d4174280b4d8`, branch `codex/savora-staging-preview`. Contract: [product-variants-contract.md](product-variants-contract.md). No commit, push or deployment performed for Fix 14.

## Results actually run

All commands used Node `v24.22.1` at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. npm commands used a process-local PATH override only.

- From backend: `npm test`: 160/160.
- From frontend: `node --test test/*.test.mjs`: 96/96; includes legacy Checkout/auth/cart regression tests, variant line identity, payloads without prices, and session cart rehydration/tenant switching.
- From backend: `node --env-file=.env --test integration/guestCheckout.integration.js`: 8/8, including Owner variant create/update/stable IDs, foreign IDs/ownership denial, explicit normal-price conversion, authoritative pricing, two variants of one product, availability denial, Direct/WhatsApp, idempotent replay, immutable historical prices, and existing concurrent checkout/delete regressions.
- From backend: `node --env-file=.env --test integration/publicMenu.integration.js`: 9/9, including available-variant minimum pricing and sorting, hiding products without available variants, existing Featured/tenant/category filters and legacy products.
- Both integration files guard URI principal/database/no dbName override, assert connected `savora_test`, disable automatic collection/index creation, delete tracked IDs only and audit those IDs from a separate connection afterward. Both audits passed at zero. The checkout test's former index creation was removed; it only inspects the existing required index.
- From frontend: `tsc --noEmit`, `npx eslint src test`, `npm run build` (Webpack) passed on the final application changes. `git diff --check` passed. `npm audit --omit=dev` returned zero vulnerabilities in each application.

## Browser evidence and limits

The production build was temporarily served locally with `test/variants-visual-api.mjs`, an in-memory read-only API fixture with no database connection and no Order POST support. The browser verified Classic menu shows one Pizza and Starting from EGP 20.00, Add opens selection rather than adding an arbitrary variant, selection is initially required, the unavailable variant is disabled, image gallery/description/metadata remain, Small and Large create separate cart lines, Small quantity increments independently, totals are correct, and reload retains the cart.

DOM layout measurements for variant details covered all four themes in Arabic RTL and English LTR at 320/390/768/1440px: three radio choices, one unavailable choice, no document horizontal overflow. Luxury mobile selector and its disabled button were visually inspected. These are emulated Chromium measurements, not physical-device or Firefox verification. Owner editor interactions, native confirm dialogs, keyboard/screen-reader behavior and complete browser Checkout submissions were not exercised in this run. Backend/API and frontend automated tests cover Checkout separately.

## Firefox review before deployment

Use isolated local/test-owned data; do not edit Savora Demo or staging records. In both languages, create two variants, rename/reprice/reorder and disable one, save/reload, remove with warning, and convert to a normal product by explicitly entering its price. Inspect variant details/menu/cart in all themes at 320/375/390/430/768/1440px, including long Arabic names, keyboard selection and focus. Verify per-variant quantity/removal, gallery thumbnails, reload/navigation persistence and stale/deleted selections. Full Direct/WhatsApp browser submission requires an isolated test environment with tracked fixture cleanup; never infer a sent WhatsApp message from opening its link.

## Product limits

At most 20 variants per product. Existing 10 checkout lines/100 total units remain. Cart persists in sessionStorage within one tab and one active restaurant, with in-memory fallback; closing a tab is not durable retention. Product-level oldPrice is not presented as a discount on variant prices. All-unavailable variant products are hidden by the public listing. Extras/add-ons, migrations, uploads, index rollout and deployment are outside this change.

## Files

- Backend models: `backend/src/models/Product.js`, `backend/src/models/Order.js`.
- Backend services: `backend/src/services/ownerProducts.js`, `publicMenu.js`, `guestCheckout.js`, `ownerOrders.js`.
- Backend tests: `backend/test/variants.test.js`, `backend/test/ownerProducts.test.js`, `backend/integration/guestCheckout.integration.js`, `backend/integration/publicMenu.integration.js`.
- Frontend contracts/state: `frontend/src/services/public-menu.ts`, `owner-products-service.ts`, `owner-orders-service.ts`, `guest-checkout-service.ts`; `frontend/src/types/order.ts`; `frontend/src/store/cart-store.ts`; `frontend/src/lib/cart-identity.ts`, `public-menu-presentation.ts`.
- Frontend UI: `frontend/src/components/features/dashboard/VariantEditor.tsx`, `DashboardProductsPage.tsx`, `DashboardOrdersPage.tsx`; `frontend/src/components/features/storefront/ProductPurchase.tsx`, `StorefrontClient.tsx`, `aqua/AquaStorefront.tsx`, `cafe/CafeStorefront.tsx`, `luxury/LuxuryStorefront.tsx`; `frontend/src/components/features/menu/MenuOrderingPage.tsx`; `frontend/src/components/features/landing/Bestitems.tsx`, `FeaturedProducts.tsx`; `frontend/src/components/features/cart/CartOrderingPage.tsx`; `frontend/src/components/features/checkout/CheckoutOrderingPage.tsx`.
- Frontend tests: `frontend/test/variants.test.mjs`, `frontend/test/variants-visual-api.mjs`.
- Documentation: this report and `docs/product-variants-contract.md`.

Pre-existing changes in `backend/.env.example` and generated/untracked `docs/batch01` artifacts were preserved. Main, Production, staging data, image storage configuration and indexes were not modified.
