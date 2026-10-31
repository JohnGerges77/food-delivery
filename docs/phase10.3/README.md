# Phase 10.3 — Savora Café

## Shipped theme and design

`savora-cafe` is the third implemented restaurant storefront theme. The palette is cream `#F7F0E6`, mocha `#5B3827`, caramel `#B98858`, ivory `#FFFDF9`, and espresso `#2D211B`, with supporting muted brown `#715C50` and warm image fallback `#E9DACA`. Café uses an editorial two-column hero, a circular menu motif, Georgia display typography for English restaurant names, compact product previews, warm category pills, and a mocha information/footer band. Arabic body text uses the existing locally hosted Tajawal font. Restaurant-authored names, descriptions, and menu text stay untranslated.

The hero shows an actual tenant product image when the public menu has one. With no image it shows a labeled abstract menu graphic; missing product images receive a warm neutral placeholder. The read-only visual fixture intentionally has no product photos and makes no claim about a real café's appearance. No restaurant facts, products, awards, reviews, offers, or prices are invented in live routes.

The theme lives in `frontend/src/components/features/storefront/cafe/`. `StorefrontClient` chooses it only from the server-resolved Restaurant DTO. Its CSS module scopes all new styles to the Café root. The existing `MenuOrderingPage` still owns pagination, category filtering, search, preview quantity, and add-to-cart. Existing tenant-scoped Zustand cart, guest form, Direct and WhatsApp submission, idempotency, server-priced Order persistence, and saved-before-confirmation rules remain shared. Café adds presentation only; it does not duplicate checkout logic or change its API. The preview modal's warm surface and shared Cart/Checkout's cream treatment are CSS-scoped. Classic and Aqua components and styles were not edited.

## Platform Admin assignment

The backend enum and Admin validation now accept exactly `savora-classic`, `savora-aqua`, and `savora-cafe`. Admin create, list and details show Café, allow selection, save through the existing authenticated CSRF/trusted-Origin service, and preview the active tenant storefront. The change continues to write `restaurant.theme_changed` audit records in the existing transaction. Unknown/unimplemented IDs are rejected; legacy records without `storefrontTheme` resolve to Classic. Owner Settings has no theme write field or route. No migration or existing Restaurant assignment was changed.

## Browser evidence

Chrome CDP captured a controlled, GET-only local public API fixture at CSS widths 1440, 768, 390, and 375. `frontend/test/phase101-visual-api.mjs` supplies the Café fixture alongside unchanged Classic/Aqua fixture responses; it rejects every non-GET. `frontend/test/phase103-capture.mjs` navigates a production Next build and asserts theme ID, document direction, font, and no horizontal overflow. It also adds an item in the browser and checks populated Cart and Checkout at 390 and 375 without submitting an Order. The in-app browser separately exercised preview quantity 1→2, total EGP 85→170, Add to Cart, and Cart/Checkout navigation. The guarded real `savora_test` Admin browser journey selected Café on create, rendered that saved storefront, changed to Aqua and back to Café, checked audit entries, and finished exact fixture teardown.

| View | Capture |
| --- | --- |
| Café home, desktop English and Arabic | [English](cafe-home-desktop-en.png), [Arabic](cafe-home-desktop-ar.png) |
| Café home, tablet and mobile | [768 English](cafe-home-tablet-en.png), [390 Arabic](cafe-home-mobile-ar.png), [375 Arabic](cafe-home-small-mobile-ar.png) |
| Café menu | [1440 English](cafe-menu-desktop-en.png), [768 English](cafe-menu-tablet-en.png), [390 Arabic](cafe-menu-mobile-ar.png), [375 Arabic](cafe-menu-small-mobile-ar.png) |
| Café product and quick preview | [Desktop product](cafe-product-desktop-en.png), [mobile Arabic product](cafe-product-mobile-ar.png), [preview](cafe-preview-browser-en.png) |
| Café populated Cart and Checkout | [390 Cart](cafe-cart-mobile-ar.png), [390 Checkout](cafe-checkout-mobile-ar.png), [375 Cart](cafe-cart-small-mobile-en.png), [375 Checkout](cafe-checkout-small-mobile-en.png) |
| Existing theme regression | [Classic desktop](classic-menu-desktop-en.png), [Classic mobile](classic-menu-mobile-ar.png), [Aqua desktop](aqua-menu-desktop-en.png), [Aqua mobile](aqua-menu-mobile-ar.png) |
| Admin and Owner isolation | [Admin create](phase9-admin-create-en.png), [Admin saved Café](phase103-admin-theme-cafe-en.png), [Admin rendered Café](phase103-admin-assigned-cafe-en.png), [Admin overview](phase9-admin-overview-en.png), [Owner login](owner-login-browser-en.png) |

Classic and Aqua were visually compared with the Phase 10.2 captures. Their source components and CSS modules were untouched, and the current screenshots retain the approved black/orange and teal/mint compositions. Capture engines and full-page versus viewport dimensions differ, so this is a visual regression review, **not** a pixel-perfect comparison. The Café screens showed no horizontal overflow at the tested widths, no clipped primary actions, keyboard-visible focus styling, and a reduced-motion CSS fallback. This is not a full assistive-technology audit.

## Verification

Node `v24.22.1` at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` ran all Node checks. Commands were run from their respective `backend/` or `frontend/` directories:

| Check | Command | Result |
| --- | --- | --- |
| Backend offline | `node --test --test-concurrency=1 test/*.test.js` | 143/143 passed |
| Frontend offline | `node --test --test-concurrency=1 test/*.test.mjs` | 70/70 passed |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | passed |
| ESLint | `node node_modules/eslint/bin/eslint.js .` | passed |
| Next production | `node node_modules/next/dist/bin/next build --webpack` | passed, including fresh build for isolated E2E API |
| Guarded public menu | `node --env-file=.env --test --test-concurrency=1 integration/publicMenu.integration.js` | 7/7 passed |
| Guarded Admin API | `node --env-file=.env --test --test-concurrency=1 integration/platformAdmin.integration.js` | 1/1 passed; Café creation/change, public DTO, legacy Classic, CSRF/Origin, Owner denial, audit and cleanup |
| Guarded Admin browser | `node --env-file=.env --test --test-concurrency=1 integration/platformAdminBrowser.integration.js` with `SAVORA_CDP_PORT=9449`, `SAVORA_BROWSER_OUTPUT_DIR=phase10.3`, and `MONGODB_URI=''` | 1/1 passed; Café UI create/change and exact cleanup |
| Read-only visual browser | `node test/phase103-capture.mjs` with local fixture, production Next and Chrome CDP | 19 route/viewport captures and checks passed |

The first sandboxed MongoDB integration attempt stalled before producing results; the same guarded tests passed with network access. Early Admin browser reruns exposed two test timing races after the Café assertions; they were fixed by waiting for the prior save and hydrated login/logout controls. The final guarded browser run passed. Test credentials were generated inside the test, used only in `savora_test`, and removed by the test's exact-ID/slug teardown. No request or write targeted `savora_dev`, no real Admin account was provisioned, and no deployment occurred.

## Limits and operator checks

The visual fixture is deliberately read-only, so it does not prove a production checkout POST. Shared checkout persistence was covered by existing frontend tests and previous guarded backend journeys; this phase did not change that business logic. Product images remain external URL or existing asset references; upload/provider work and Luxury remain outside scope. A live operator should assign Café to a disposable active tenant in a staging environment, preview English and Arabic home/menu/product/Cart/Checkout with that tenant's real images, submit a Direct and WhatsApp guest order and confirm MongoDB saves before success/handoff, then verify Classic/Aqua tenants and Owner/Admin separation. Check keyboard navigation and screen-reader announcements on the actual target browsers before production rollout.
