# Storefront themes

## Current contract

The requested restaurant is resolved by its validated slug on the server in `StorefrontView`. The public restaurant response includes that restaurant's `storefrontTheme`. The `Restaurant` schema accepts exactly `savora-classic`, `savora-aqua`, `savora-cafe`, and `savora-luxury`, and defaults new restaurants to Classic. The public serializer also returns Classic for older documents where the field is absent. No migration or automatic database update is needed.

`StorefrontClient` resolves the value against a registry of **shipped** themes. Unknown or absent values fall back to Classic. The selected value comes only from the resolved restaurant response, never a query parameter, browser setting, or another tenant's data. Each theme has one fixed appearance: Classic dark; Aqua, Café and Luxury light. Storefront navigation has no appearance toggle. The dashboard appearance setting (`data-theme`) remains independent, and scoped storefront palettes override its inherited colors.

The registry has four implementations: **Savora Classic**, **Savora Aqua**, **Savora Café**, and **Savora Luxury**. Each supplies Navbar, Footer, Home, Menu, Product, and About presentation slots. The outer `StorefrontClient` owns tenant initialization, the `StorefrontProvider`, and the shared Cart and Checkout pages. Public menu fetching, category/product filtering, cart state, checkout submission, Order persistence, and server-authoritative prices continue to use the same services and backend endpoints. Only Platform Admin creation and audited theme assignment may write this field; it is absent from Owner Settings.

Unknown persisted values render Classic on the frontend, while backend writes reject them. All four palettes are scoped under `[data-storefront-theme="<id>"]` in `frontend/src/app/globals.css`. The common `--sf-*` contract covers background, surfaces, text, primary/action, accent, border and highlight; legacy CSS variables inside each root alias these tokens for shared Cart, Checkout and Classic components. Aqua/Café retain their own CSS modules for layout and effects, while their fixed color values live in the central palette. Changing a preset means editing only its matching block in `globals.css`; do not change the global `:root` or dashboard `[data-theme]` blocks. See [Phase 10.4](phase10.4/README.md) for the complete palette, screenshots and current verification. No automatic bulk assignment is required.

## Classic card refinement

Only the Classic menu grid/card size changed: four columns at `xl` instead of three, tighter gap and card padding, image ratio `1.5` instead of `1.22`, shorter description/metadata spacing, and a smaller price scale. The Add button remains 48px tall. Hero, Navbar, other sections, animation classes, original colors, Cart, Checkout, Owner Dashboard, and Platform Admin were not restyled.

The screenshots below are **actual browser renders** of the Classic menu against a deterministic, read-only local public API fixture. The fixture uses the repository's existing food images and never connects to `savora_dev` or submits an Order. It permits identical before/after content. Images and text are illustrative fixture data, not a live restaurant's catalog.

| View | Before | After | First card / image / Add button |
| --- | --- | --- | --- |
| Desktop English, 1440px | [Before](phase10.1/classic-menu-before-desktop-en.png) | [After](phase10.1/classic-menu-after-desktop-en.png) | 413×592 → 308×409px / 411×337 → 306×204px / 48px tall |
| Mobile Arabic, 390px | [Before](phase10.1/classic-menu-before-mobile-ar.png) | [After](phase10.1/classic-menu-after-mobile-ar.png) | 358×539 → 358×418px / 356×292 → 356×237px / 48px tall |

Browser measurements confirmed no horizontal overflow at these widths. Arabic rendered with `dir="rtl"` and the self-hosted Tajawal font. Full page screenshots include the Classic navigation and footer to make visual comparison easier. Phase 10.4 removed the Classic storefront appearance toggle so its original black/orange identity stays fixed; dashboard controls remain.

## Verification and limits

The local screenshot tools are `frontend/test/phase101-visual-api.mjs` and `frontend/test/phase101-capture.mjs`. Run a Next dev instance on port 3101 with `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://127.0.0.1:5179`, the read-only fixture server on port 5179, and headless Edge CDP on port 9447. Capture accepts `before` or `after`; the committed captures show both states. The production UI is now the `after` state.

Backend offline regression: 142/142 passed with Node 24.21.0 using `node --test --test-concurrency=1 test/*.test.js`. Frontend regression: 68/68 passed with `node --test --test-concurrency=1 test/*.test.mjs`. TypeScript, ESLint, and Next.js Webpack production build passed. A concurrent backend test run first hit host memory pressure; serial execution passed. A guarded `savora_test` public menu integration run was attempted but produced no result after roughly two minutes and was interrupted. A later read-only `savora_test` fixture audit also produced no result and was interrupted. Therefore MongoDB integration and cleanup status for that attempted test are **not confirmed**. No `savora_dev` write was made.

**Later verification:** Phase 10.2 ran the guarded public-menu integration successfully (7/7) and a read-only audit found zero matching Phase 10.1 public-menu fixture Restaurants, Categories, and Products in `savora_test`. See [Phase 10.2](phase10.2/README.md) for the second shipped theme and current results.
