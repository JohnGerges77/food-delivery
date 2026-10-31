# Phase 10.2 — Savora Aqua

## Theme contract

`Restaurant.storefrontTheme` now accepts `savora-classic` and `savora-aqua`. New and legacy records without a value resolve to Classic. The public restaurant DTO provides the resolved tenant value. `StorefrontClient` selects one of two shipped presentation registries from that server response, so a URL parameter or another tenant cannot select a theme. The Aqua CSS module scopes its colors to the Aqua storefront root. Owner and Platform Admin pages remain outside that root.

Aqua has its own navigation, home, menu wrapper, product, about, and footer compositions. The home uses real product images from the tenant's public menu and shows only real restaurant information. When there are no product photos, it shows an explicit empty visual state. The Menu's existing component still owns category fetching, filtering, previews, pagination, and add-to-cart; semantic data attributes allow Aqua to give it distinct cards and controls without changing Classic's rendered styles. Both themes use the same tenant-isolated Zustand cart, checkout coordinator, public API, idempotency, server-authoritative amounts, and saved-order confirmation. Aqua's Cart/Checkout treatment is scoped by the storefront page attribute; the submission logic was not copied.

The palette is Cyber Teal `#06363A`, Aqua Foam `#98FFE1`, off-white `#F3FAF7`, and Dark Ink `#102B2D`. Supporting surface and text tones are derived from these. The first viewport contrasts a teal editorial statement with a staggered mosaic of actual food photos. Product images receive a single short shutter reveal; reduced-motion rules suppress it when requested. Arabic retains Tajawal and RTL; English retains Arial/Helvetica. No fabricated reviews, offers, metrics, products, or restaurant facts were added.

## Admin assignment

Platform Admin can choose Classic or Aqua during the existing atomic Restaurant and Owner creation flow and can change the theme on a restaurant's details page. The list and details identify the saved selection; the details page links to the public preview for an active restaurant. `PATCH /api/admin/restaurants/:id/theme` uses the existing Admin session, trusted-Origin guard, CSRF guard, exact body validation, conditional update, and transactionally written `restaurant.theme_changed` audit record. Creation records the selected theme in the existing `restaurant.created` audit entry. Unknown and unfinished IDs are rejected; Owners have no theme write endpoint or setting.

## Visual review

The screenshots use a local GET-only public API fixture, the repository's existing food images, and an isolated production Next instance. The fixture is illustrative and did not connect to MongoDB. The in-app Chromium browser was checked at 1440×900 and 390×844. Aqua and Classic had no horizontal overflow; Arabic used `dir=rtl` and Tajawal. Adding a fixture product on the Aqua Menu raised the cart count to one; the shared Cart showed that item and the Checkout form was reachable. No Checkout POST was sent.

| View | Capture |
| --- | --- |
| Aqua home, desktop English | [First viewport](aqua-home-desktop-en.png), [full page](aqua-home-full-desktop-en.png) |
| Aqua home, desktop Arabic | [Screenshot](aqua-home-desktop-ar.png) |
| Aqua home, mobile Arabic | [Screenshot](aqua-home-mobile-ar.png) |
| Aqua menu, desktop English | [Screenshot](aqua-menu-desktop-en.png) |
| Aqua menu and card, mobile Arabic | [Menu](aqua-menu-mobile-ar.png), [card](aqua-menu-card-mobile-ar.png) |
| Aqua Cart and Checkout, mobile Arabic | [Cart](aqua-cart-mobile-ar.png), [Checkout](aqua-checkout-mobile-ar.png) |
| Aqua product and About | [Product](aqua-product-desktop-en.png), [About](aqua-about-desktop-ar.png) |
| Classic regression, desktop English and mobile Arabic | [Desktop](classic-menu-desktop-en.png), [mobile](classic-menu-mobile-ar.png) |
| Admin and Owner login isolation | [Admin](admin-login-desktop-en.png), [Owner](owner-login-desktop-en.png) |

Classic desktop card/image/Add-button dimensions remained 308×408 / 306×204 / 48 px against the Phase 10.1 reference 308×409 / 306×204 / 48 px; the one-pixel card difference is rendering rounding. Orange color and original Classic composition remained. The in-app mobile viewport measured 380 CSS px inside the requested 390 px browser size, so its absolute card width is 10 px narrower than the Phase 10.1 Edge screenshot; its layout and proportions were unchanged.

## Verification and limits

Node `v24.22.1` at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` ran the offline suites. Backend `node --test --test-concurrency=1 test\*.test.js`: 143/143 passed. Frontend `node --test --test-concurrency=1 test\*.test.mjs`: 69/69 passed. `tsc --noEmit`, ESLint, the targeted Aqua design lint, and `next build --webpack` passed. The final build used the normal local configuration after the isolated screenshot build. The Next build required `experimental.cpus: 1` because the first parallel build exhausted host memory. The design inspector's CDP attempt timed out at `Page.enable`; browser screenshots and measurements were collected through the app browser instead.

The first sandboxed `savora_test` integration invocations stalled at MongoDB connectivity. Outside that network restriction, the guarded public-menu integration passed 7/7, including tenant-specific Aqua and legacy Classic resolution. The first guarded Platform Admin integration run timed out connecting to Atlas; one retry passed 1/1. After adding a legacy-record mutation case, the final Admin integration rerun passed 1/1, covering theme creation, Admin-only changes, a missing stored theme field, persisted public reads, CSRF/Origin rejection, audit counts, and exact fixture teardown. A separately guarded read-only audit found zero Phase 10.1 public-menu fixture Restaurants, Categories, and Products by their exact test slug patterns. This resolves the Phase 10.1 integration and fixture uncertainty for those test records. No `savora_dev` write, deployment, or production migration occurred.
