# Phase 10.4 — Savora Luxury and fixed storefront palettes

## Scope and theme contract

Four tenant-scoped storefront themes are registered: `savora-classic`, `savora-aqua`, `savora-cafe`, and `savora-luxury`. Classic remains the schema and public DTO default for new or legacy Restaurants without an assigned theme. The backend rejects unsupported IDs. Only authenticated Platform Admin creation and audited assignment can write `storefrontTheme`; Owner Settings cannot.

The theme is resolved from the public Restaurant DTO for the validated slug. `StorefrontClient` scopes the selected palette to its `data-storefront-theme` root. Each ID has one fixed appearance: Classic black/orange, Aqua teal/mint, Café cream/mocha, and Luxury light ivory/olive/copper. The Classic storefront appearance toggle was removed; the Owner and Platform Admin dashboard controls continue to use their separate appearance setting. No `prefers-color-scheme` palette rule changes storefront colors.

## Central color system

The only storefront palette definitions are the four `[data-storefront-theme="…"]` blocks in [`frontend/src/app/globals.css`](../../frontend/src/app/globals.css). Each defines `--sf-background`, `--sf-surface`, `--sf-surface-alt`, `--sf-text`, `--sf-text-muted`, `--sf-primary`, `--sf-primary-hover`, `--sf-on-primary`, `--sf-accent`, `--sf-border`, and `--sf-highlight`, plus any specific accents. The theme CSS modules use `var(--sf-…)`. Legacy variables such as `--background` and `--primary` alias the selected theme's tokens within the storefront root for shared Cart/Checkout and Classic components. The dashboard's global colors remain outside these roots.

To change a theme's colors, edit the matching ID block in `globals.css`, keeping its `color-scheme` and the shared token names. For example, update only `[data-storefront-theme="savora-aqua"]` to alter Aqua. Aqua and Café have additional `--sf-tone-<hex>` entries for exact inherited decorative shades; those values also live in their scoped block. Component CSS modules set composition, typography, spacing, effects and token usage. Classic's existing orange `rgba()` glows and translucent layers remain as decorative effects; its principal colors and legacy aliases are centralized. Changing the four palette blocks does not change Owner or Admin colors.

Luxury's palette (all in `globals.css`):

| Token | Value | Use |
| --- | --- | --- |
| `--sf-background` | `#fffdf9` | Ivory canvas |
| `--sf-surface` | `#ffffff` | Cards and forms |
| `--sf-surface-alt` | `#f7f5ef` | Quiet section surface |
| `--sf-text` | `#20251f` | Main ink |
| `--sf-text-muted` | `#5a6258` | Secondary text |
| `--sf-primary` | `#2f472d` | Deep olive |
| `--sf-primary-hover` | `#253a24` | Olive interaction |
| `--sf-on-primary` | `#ffffff` | Text on dark surfaces |
| `--sf-accent` | `#b3925a` | Brass detail |
| `--sf-border` | `#dedbd2` | Rules and outlines |
| `--sf-highlight` | `#eae4d7` | Subtle highlight |
| `--sf-cta` / `--sf-cta-hover` | `#b94e1d` / `#963e17` | Copper actions |

## Luxury design

The supplied Flavoria screenshot informed the slim information strip, restrained white navigation, split food hero, story composition, compact dish cards and refined footer. The implementation uses the resolved Restaurant's real name, description, hours, contact fields, categories and products. Actual product images appear when available; a typographic graphic fallback appears when an image is absent. The story image is another real menu product. Featured cards and category navigation link to genuine menu data. No reservation, offer, newsletter, awards, restaurant history or payment claim was added. The shared Cart and Checkout retain server-authoritative order submission and tenant-scoped cart behavior; their Luxury presentation uses the light palette.

Arabic uses RTL and the self-hosted Tajawal font for Luxury headings. English remains LTR. The supplied read-only fixture has English restaurant/product data, so data text in Arabic captures remains English; UI labels are translated. This is content supplied by the restaurant, not a localization fallback in the theme.

## Browser review

The screenshots below are local browser renders against `frontend/test/phase101-visual-api.mjs`, a deterministic GET-only public API fixture using existing repository food images. It rejects POSTs and never connects to MongoDB. Mobile captures use viewport screenshots because the browser's full-page RTL capture cropped the page despite no document overflow.

| View | Screenshot |
| --- | --- |
| Luxury home desktop English | [PNG](luxury-home-desktop-en.png) |
| Luxury home desktop Arabic | [PNG](luxury-home-desktop-ar.png) |
| Luxury home tablet English | [PNG](luxury-home-tablet-en.png) |
| Luxury home mobile Arabic | [PNG](luxury-home-mobile-ar.png) |
| Luxury menu desktop English | [PNG](luxury-menu-desktop-en.png) |
| Luxury menu mobile Arabic | [PNG](luxury-menu-mobile-ar.png) |
| Luxury product desktop English | [PNG](luxury-product-desktop-en.png) |
| Luxury populated cart desktop English | [PNG](luxury-cart-desktop-en.png) |
| Luxury checkout desktop English | [PNG](luxury-checkout-desktop-en.png) |
| Luxury populated cart mobile English | [PNG](luxury-cart-mobile-en.png) |
| Luxury checkout validation mobile English | [PNG](luxury-checkout-mobile-en.png) |
| Classic desktop / mobile English | [Desktop](classic-home-desktop-en.png) · [Mobile](classic-home-mobile-en.png) |
| Aqua desktop / mobile English | [Desktop](aqua-home-desktop-en.png) · [Mobile](aqua-home-mobile-en.png) |
| Café desktop / mobile English | [Desktop](cafe-home-desktop-en.png) · [Mobile](cafe-home-mobile-en.png) |

Luxury was visually checked at 1440, 768, 390 and 375px, with English LTR and Arabic RTL; Classic, Aqua and Café were checked at 1440 and 390px. Computed root colors matched the selected slug, and no horizontal overflow was observed. Menu and product routes opened for all three older themes. Their desktop/mobile captures retain the approved black/orange, teal/mint and cream/mocha identities; they were reviewed visually, not pixel-diffed against earlier screenshots. Existing animation may render an empty first frame immediately after navigation; captures were taken after content appeared.

Luxury's menu Add action, populated Cart, quantity increase, Checkout navigation, provisional order summary and empty-field validation were exercised in the browser. Aqua and Café product/Cart behavior was also checked. The frontend unit tests cover Direct and WhatsApp payloads, persistence acknowledgment checks, retry/idempotency and the `messageSent: false` contract. No browser Order POST was sent from the read-only fixture, so this phase's browser run does not prove a live Direct or WhatsApp submission.

## Verification and limits

Node executable: `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` (v24.22.1). Commands and results:

| Directory | Command (with the Node executable above) | Result |
| --- | --- | --- |
| `backend/` | `node --test --test-concurrency=1 test/*.test.js` | 143/143 passed |
| `frontend/` | `node --test --test-concurrency=1 test/*.test.mjs` | 74/74 passed |
| `frontend/` | `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| `frontend/` | `node node_modules/eslint/bin/eslint.js . --ignore-pattern '.chrome-phase103*/**'` | Passed; ignored only existing temporary Chrome profiles |
| `frontend/` | `node node_modules/next/dist/bin/next build --webpack` | Passed, 35 static pages generated |

Earlier guarded attempts failed before connection with `querySrv ETIMEOUT` and later `ReplicaSetNoPrimary`/TLS alerts. The local Atlas test connection subsequently worked. The first connected Platform Admin run reached its final audit assertion and failed `7 !== 6`: the old expectation counted the creation, four theme changes and suspension but omitted the legitimate `restaurant.activated` event produced by reactivation. No application service change was needed. The integration test now checks the ordered audit actions, actor/restaurant IDs and event details, including the activation transition, and closes its connection even if a teardown assertion fails.

The guarded tests were rerun **separately**, not concurrently, with the Node executable above:

| Command from `backend/` | Result |
| --- | --- |
| `node --env-file=.env --test --test-concurrency=1 integration/platformAdmin.integration.js` | 1/1 passed after the audit assertion fix and exact fixture teardown; rerun passed after adding an Admin-session cleanup assertion |
| `node --env-file=.env --test --test-concurrency=1 integration/publicMenu.integration.js` | 7/7 passed, including tenant-scoped menu/theme resolution and fixture teardown |
| `node --test --test-concurrency=1 test/*.test.js` | 143/143 passed |

Each test validates `MONGODB_TEST_URI` username `savora_test_user`, path `/savora_test`, and absence of a `dbName` override, then checks the actual connected database identity before writes. The Admin journey confirmed Luxury creation/assignment persistence, public DTO, unknown-ID rejection, Owner denial, Classic fallback for a legacy Restaurant, and seven accurate audit events. The public menu journey confirmed other-tenant theme and data isolation. Both tests remove and check their exact generated fixture IDs in `finally`.

A separate read-only `savora_test` audit after the final runs found **zero** test-owned platform/public Restaurants, platform Owner and Admin accounts, platform creation audits, public Categories and public Products using the tests' anchored UUID-suffix patterns. The Admin test also verified zero sessions for its exact Admin and Owner IDs and zero audits for its Restaurant ID. No broad deletion, `savora_dev`/production write or deployment occurred. The separate existing checkout integration remains the path for a fresh live Direct/WhatsApp persistence check; no new checkout POST was part of this phase.

For browser review, start the GET-only fixture on port 5179 and Next with `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://127.0.0.1:5179`, then visit `/en/r/phase104-luxury` and `/ar/r/phase104-luxury` at desktop and mobile widths. Do not point the browser fixture at `savora_dev`.
