# Phase 8.4: public storefront and menu

## Restaurant identity and routes

The public storefront uses a validated, normalized slug in `/{locale}/r/{slug}`. Home, menu, product details, about, cart and checkout are nested beneath that prefix. The existing `/{locale}`, `/{locale}/menu` and related URLs still work **only in local development** when `NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG` is configured. This local preview is a bridge for old links, not a production tenant resolver. Without a slug those old URLs show an unavailable state, never fixture content. The dashboard route remains separate.

The route slug is passed to the public backend; no browser-supplied `restaurantId` is used. The backend owns active-restaurant and tenant visibility checks. Restaurant subdomains or custom domains can later be mapped to a validated slug at a trusted server boundary; hostname mapping has not been designed or enabled here. Switching restaurant routes resets the in-memory cart and mounts a fresh storefront state. Locale switching preserves the current restaurant path.

## Public API and presentation

`src/services/public-menu.ts` calls only:

- `GET /api/public/restaurants/:slug`
- `GET /api/public/restaurants/:slug/categories`
- `GET /api/public/restaurants/:slug/products`

Requests use the configured `NEXT_PUBLIC_SAVORA_API_BASE_URL`, `credentials: "omit"`, `cache: "no-store"`, a 12-second timeout, and no owner CSRF/session state. The owner API client is unchanged. The public Restaurant DTO supplies its name, description, optional logo, public contact data, address, opening-hours text, nested delivery settings, currency and branding name. Opening hours are displayed as text; no live open/closed status is inferred. Optional social links are shown only with safe HTTP(S) URLs.

The backend filters inactive Categories, unavailable Products and Products in inactive or foreign Categories. The UI uses the returned Category and Product ObjectId strings, names, description, image URLs, prices, oldPrice, featured flag and optional preparation time. There is no fake rating, review count, popularity, or discount. A missing image uses a gradient placeholder. Image URLs accept safe root-relative paths and HTTP(S) URLs without embedded credentials. Restaurant content is rendered as text.

Currency formatting uses `restaurant.currency` and `Intl.NumberFormat`; zero remains valid. An old price is struck through only when it exceeds the current price. Cart amounts are display estimates; checkout will derive authoritative prices and fees on the backend.

## Pagination, search and empty/error states

Categories are fetched in backend-sized pages of 100, up to 10 pages. If that bound is exceeded, the storefront shows an error instead of silently hiding Categories. Menu Products start with 100 items and support **Load more** using backend `hasNext`. Choosing a Category requests the backend's `categoryId` filter and resets the list; the All tab returns to the initial unfiltered page. Text search covers **loaded dishes only**, and the label states this limitation. Product details verify the ID against paginated public listings because there is no public single-Product endpoint. This lookup is bounded at 10 pages (1,000 Products); a larger catalog needs a dedicated backend detail contract.

The public route group has skeleton loading, retryable network errors, empty menu/category states, and a restaurant-or-dish unavailable page for 404. A restaurant response whose slug differs from the requested slug is rejected. Empty API arrays never fall back to fixtures. Next.js may stream an unavailable page with HTTP 200 after the loading shell has begun; the UI still shows the unavailable state. HTTP status behavior needs a production-host review before SEO rollout.

## Cart and checkout boundary

The Zustand cart accepts real public Product IDs, price display and names through `addPublicItem`. It is in memory; there is no cart persistence in the current app. Setting a restaurant clears items from a different restaurant or legacy fixture items with no tenant identity. Quantity and removal remain available. The Checkout page deliberately has no submit action: it states that no Order was saved or sent and keeps the cart. Phase 8.5 must integrate the public checkout POST, server-authoritative totals, idempotency and WhatsApp handoff.

## Visual regression correction

The first Phase 8.4 renderer replaced the existing landing, navigation, menu, cart, checkout and footer composition with a simplified storefront component. The correction makes `StorefrontClient` a thin route container and reconnects the original `HeroSection`, `BestItems`, `FeaturedProducts`, `WhyChoose`, `ContactSection`, `PublicNavbar`, `MenuOrderingPage`, `CartOrderingPage`, `CheckoutOrderingPage`, and `Footer`. Their original dark/orange backgrounds, decorative assets, grids, glass cards, and motion remain. Each section now reads public DTOs and tenant-aware links through a small storefront context. Product and cart images show a styled placeholder if an image is missing or fails to load.

The `savora-demo` restaurant currently returns no Products. The landing still renders its original sections and displays menu-specific empty states; no fixture dish or price is substituted. No rating, review, order statistic, preparation estimate or open/closed claim is generated. Product detail and checkout keep the dark/orange treatment. The original checkout form, progress strip, order cards and summary are visible. Customer fields are editable and held in React state; only the submit button is disabled until an actual API submission is implemented. The form also prevents implicit submission; there is no fake success dialog or cart clearing. The old About page's invented history, guest counts and restaurant claims remain omitted; its centered hero, facts grid, imagery and contact sections now show actual public fields.

The checkout input correction has two frontend state tests plus an optional Chromium CDP smoke test in `test/checkout-input.browser.mjs`. With a local storefront and Chromium remote debugging port, run it under Node 24; `SAVORA_CDP_PORT` and `SAVORA_CHECKOUT_URL` override the default port `9334` and URL `http://localhost:3000/en/r/savora-demo/checkout`. It checks every field, Tab order, English desktop and Arabic mobile input, value retention after React updates, disabled submit and no public checkout POST.

The correction passed 38 frontend tests, TypeScript, ESLint and the Next.js production build under Node 24.14.0, plus 136 backend offline tests. Read-only local GETs returned 200 for the public restaurant API and English/Arabic storefront routes. The local HTML contains the original hero asset, contact section and tenant menu link. No browser screenshot comparison was available, so desktop/tablet/mobile visual parity and interactive animation behavior still need manual browser review. No `savora_dev` writes or MongoDB integration tests ran.

## Local verification

In `frontend/.env.local`, set `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://localhost:5000`. Optionally set `NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG=savora-demo` for old local URLs. The explicit URL `http://localhost:3000/en/r/savora-demo/menu` needs no preview slug. Run the backend with Node 24 and `npm run dev` in `frontend/` (Webpack). `node --test test/*.test.mjs`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` verify the frontend. Public GET requests can inspect existing `savora_dev` data without writes. The Phase 8.4 checks did not run MongoDB integration tests or interactive browser UI verification.
