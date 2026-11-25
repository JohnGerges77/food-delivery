# Savora hero and dynamic storefront themes

## Color propagation

`Restaurant.branding.primaryColor` already persisted through the authenticated Owner settings endpoint. The public restaurant response already included it. `StorefrontClient` only read `storefrontTheme`, so the storefront always received the preset CSS palette. Some shared layouts also embedded orange directly in gradients and effects. The Owner preview was a local swatch.

`StorefrontClient` now resolves the preset separately from the saved accent. `storefront-accent.ts` normalizes three- or six-digit HEX values, uses the exact selected color for the primary fill, and derives a contrasting foreground, hover and active fills, and accessible text colors for light surfaces and dark photography. `globals.css` composes the border, muted background, focus ring, gradient and glow tokens from those colors. The theme modules retain their surfaces, typography, layouts and preset palettes. Warning and error colors have dedicated roles.

The tokens are scoped to the resolved restaurant subtree. Owner Settings uses a separate preview subtree. Global platform pages and Platform Admin keep Savora's own styling. A preset remains active when the stored color is blank or invalid.

Public restaurant reads use the existing Express `Cache-Control: no-store` and Next `fetch(..., { cache: "no-store" })` contract. The React request cache deduplicates the metadata and storefront reads for one render. A browser reload reads new settings without a redeploy.

## Hero image

The Classic demo uses the operator's `frontend/public/savora-hero-wide.webp` (1920×819) as a full-width image. Next Image supplies responsive sizes and a preload. The layout reserves its space, crops with `object-fit: cover`, and places live text over a dark gradient. The demo photograph is mirrored on Arabic pages to place its dark space behind RTL copy. Owner-supplied images keep their original orientation.

The hero uses the restaurant name and description, a localized headline, Explore Menu and About Us links, and the restaurant's currency, delivery availability and opening hours when configured. The supplied image is scoped to the Classic `savora-beta-demo` fallback.

`heroImageUrl` is an optional Restaurant setting for an independent hero photograph. `aboutImageUrl` still serves the About section. `heroProductId` still references a tenant-owned menu item and provides a hero fallback where the theme supports it. Aqua, Café and Luxury display a configured image in their existing media layouts. With no usable configured image, the theme uses its own product or visual fallback. An unreachable external photo falls back to a visual placeholder, or to the next eligible image in Classic.

## Owner workflow

1. Open **Dashboard → Settings → Appearance**. Enter a HEX value or use the picker. The preview shows the storefront button and foreground.
2. Select **Save Settings**. Refresh the storefront and the Owner screen to see the persisted color.
3. Use **Reset to Theme Default** and save to clear the override.
4. Under **Storefront hero image**, enter a public image URL and save. Clear the field and save to restore the theme fallback. Use an HTTPS image URL for an HTTPS storefront.

The same Owner session, trusted-Origin, CSRF and tenant-scoped patch handle both edits. The theme ID is read-only in Owner Settings. Legacy unchanged URL values are carried forward in partial edits.

The hero image uses the existing URL-based media contract. Remote content is loaded by the browser from its host, which manages its availability, caching and file size. The bundled demo image is optimized by Next.js.

## Reproducible checks

- Node.js v24.22.3, executable `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.
- From `backend/`, run `node --test test/*.test.js`. The guarded MongoDB runs used `node --test integration/tenant.integration.js`, `integration/publicMenu.integration.js`, and `integration/guestCheckout.integration.js` with the dedicated `savora_test` account.
- From `frontend/`, run `node --experimental-strip-types --test test/*.test.mjs`, `node node_modules/eslint/bin/eslint.js .`, and `node node_modules/next/dist/bin/next build --webpack`. The production build also runs TypeScript.
- Start the fixture with `SAVORA_BRANDING_VISUAL=1` and `node test/phase101-visual-api.mjs`. The local browser suite uses the baseline on port 3191, the candidate on 3192 and isolated Chromium CDP on 9472. Run `node test/hero-theme.browser.mjs` with `SAVORA_HERO_SCREENSHOTS` set to capture before/after and custom theme screenshots.
- `node test/batch01-checkout.browser.mjs` intercepts order requests and WhatsApp navigation on the local candidate. The production Beta conditions are simulated locally. No WhatsApp messages are sent.

The release candidate passed 187 backend offline checks, 114 frontend checks, 30 guarded MongoDB test cases across the three suites, ESLint, and the Next.js Webpack production build. The MongoDB suites verified exact test-fixture cleanup.

Chromium passed 768 combinations across Home, Menu, Cart and Checkout, four themes, two directions, six widths (320, 360, 390, 768, 1440 and 1920), and four accent choices (preset, sky blue, black and white). It verified the Owner save/reload/reset flow against the local branding fixture, a second tenant's independent branding, and Platform Admin isolation. Mocked Direct and WhatsApp checkouts passed in standard and Beta mode on English desktop and Arabic mobile.

The storefront UAT browser suite also passed 64 layout checks, variant selection, the Sides fixture, the persisted EGP 470 cart, and delivery-paused Cart and Checkout.
