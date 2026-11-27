# Savora storefront performance

Measured on November 27, 2026. Production baseline `b5ea682b4be43ade957f438e4075922bb416f636`. The candidate branch is `codex/performance-optimization`.

## Navigation

The Home → Menu links already used Next.js client transitions. Chrome kept the document throughout, but the page-level storefront remounted the navbar, awaited Restaurant data, and then requested categories and products. Every navigation repeated that work. Product Details could scan up to ten 100-item catalog pages. Product cards also registered for automatic RSC prefetch, adding background traffic.

Both the default Beta storefront and tenant URLs now have a persistent shell. Their route loading boundaries can render during a transition while the navbar stays mounted and cart state remains available. Critical links use Next.js shell prefetch and display progress while pending. Product links fetch their destination when followed. Catalog requests start alongside the live Restaurant read. On Classic Home, the hero can stream ahead of the rest of the catalog. Product Details requests a single product and its visible category. [Next.js prefetching](https://nextjs.org/docs/app/guides/prefetching)

| Home → Menu click to content | Live baseline | Local baseline | Local candidate |
| --- | ---: | ---: | ---: |
| Beta Demo mobile EN / AR | 3,417 / 2,170 ms | 767 / 703 ms | 537 / 526 ms |
| Salam mobile EN / AR | 1,383 / 1,356 ms | 673 / 656 ms | 646 / 613 ms |
| Beta Demo desktop EN / AR | 1,890 / 1,932 ms | 461 / 458 ms | 343 / 331 ms |
| Salam desktop EN / AR | 1,013 / 985 ms | 476 / 460 ms | 339 / 345 ms |

Chrome recorded candidate DOM feedback in 13–21 ms on mobile and 3–4 ms on desktop. The baseline had measurable loading feedback for Beta Demo and no matching loading state for the Salam clicks. The candidate retained the same navbar DOM node in all eight runs and recorded one RSC request in each click window, down from two to five. Each matrix also visited Home, Menu, Product Details, About, Cart, and Checkout directly for both tenants, locales, and screen sizes.

## Initial rendering

Lighthouse 13.6.0, mobile simulation, English Beta Demo Home. The local builds used the same read-only catalog capture and a 200 ms fixed upstream response delay. Mobile Chrome click traces used a 390 px viewport, 150 ms emulated latency, 200 KB/s down, and 4× CPU throttling. Desktop used a 1440 px viewport.

| Metric | Live baseline | Local baseline | Local candidate |
| --- | ---: | ---: | ---: |
| Performance score | 79 | 83 | 90 |
| FCP | 3.06 s | 2.08 s | 1.97 s |
| LCP | 3.06 s | 3.86 s | 3.07 s |
| TBT | 82 ms | 210 ms | 168 ms |
| CLS | 0 | 0 | 0 |
| Speed Index | 10.51 s | 2.25 s | 2.19 s |
| JavaScript transfer | 251 KiB | 243 KiB | 191 KiB |
| CSS transfer | 242 KiB | 35 KiB | 31 KiB |
| Image transfer | 93 KiB | 93 KiB | 93 KiB |
| JS startup CPU | 449 ms | 464 ms | 428 ms |
| Main-thread work | 1.29 s | 1.13 s | 1.13 s |
| Long tasks | 5 | 4 | 3 |

The live Lighthouse run identified the Aqua heading as LCP. Its observed trace split was 633 ms document TTFB and 9,777 ms element render delay. The simulated Lighthouse LCP in the table uses Lighthouse's model. The mobile CDP run instead identified the hero image as LCP and observed an English Beta Home document TTFB of 628 ms and an image LCP of 9.04 s. This variability matters when comparing against the operator's original 7.3 s LCP.

The comparable local traces identified the Pizza Margherita hero as LCP. The final run's four observed subparts were 28 → 26 ms TTFB, 710 → 216 ms resource load delay, 361 → 1,062 ms transfer, and 18 → 12 ms render delay. An earlier candidate run scored 89 with 3.21 s simulated LCP and 340 ms of observed image transfer. Eager, high-priority discovery moved the request earlier in both candidate runs. The unchanged external image URL still depends on its host. The Classic demo fallback has a 46,896-byte mobile WebP versus 154,988 bytes for the original desktop asset. The browser gets this asset directly from a `picture` source, and the versioned mobile URL has a one-year immutable cache lifetime.

The former storefront bundle eagerly imported all four themes, Checkout, and Cart. Theme and route chunks now load on demand with server rendering. The root font setup preloaded four Tajawal TTFs on live English pages. Tajawal now keeps all four weights as WOFF2, with 85,196 source bytes in total compared with 242,280 TTF bytes. The Arabic Beta Demo mobile run transferred 63 KiB of fonts after versus 87 KiB locally before. English switches to its existing system font without downloading Tajawal.

Chrome reported `MainResourceHasCacheControlNoStore` and `JsNetworkRequestReceivedCacheControlNoStoreResource` in candidate back/forward failures. Some desktop runs also reported `BrowsingInstanceNotSwapped`. Checkout restored from bfcache in three of eight local trials. Public locale cookies now write only when the preference changes. Documents and RSC still carry dynamic freshness controls, and session and guest order responses keep their private cache behavior. [Chrome bfcache diagnostics](https://developer.chrome.com/docs/devtools/application/back-forward-cache)

## Cache and backend evidence

Only successful public catalog DTOs participate in the Next server's in-process cache. Keys include normalized tenant slug, locale, and the bounded resource or canonical product ID. Entries expire after 30 seconds and the cache holds at most 128 entries. Identical in-flight reads share a promise. Failed reads are removed. Owner catalog changes become visible to fresh reads after expiration. Restaurant branding, status, theme, and ordering entitlements are fetched live on each server navigation and deduplicated across the page, layout, and metadata within that render. The ordering service still obtains authoritative price, product availability, delivery rules, and entitlement from MongoDB before committing an order.

Controlled sequential requests to the two local builds counted calls at the upstream fixture. Both used one live Restaurant read per page. Times are full response times with the same 200 ms fixture delay.

| Local route sequence | API requests before → after | Time before → after |
| --- | ---: | ---: |
| Home | 4 → 4 | 527 → 389 ms |
| Menu after Home | 3 → 1 | 448 → 231 ms |
| Repeat Menu | 3 → 1 | 434 → 232 ms |
| First Product Details | 3 → 2 | 444 → 235 ms |
| Repeat Product Details | 3 → 1 | 434 → 230 ms |
| About, Cart, and Checkout | 1 → 1 each | 221–232 → 220–239 ms |

Live public GETs had `Cache-Control: no-store` and no service `Server-Timing` breakdown. Restaurant TTFB samples ranged from 0.61 to 6.18 s. Catalog samples ranged from 0.80 to 2.29 s. Static CSS was immutable, a Vercel cache hit, and gzip-compressed in the explicit curl check. Dynamic request IDs included `fra1::iad1`. Function startup time, warm instance reuse, and the Production Atlas region require Vercel and Atlas telemetry to verify.

The existing Vercel entry reuses the MongoDB connection and the index readiness result for the connected database handle. Its Beta identity and readiness checks still run. Read-only execution plans captured on `savora_test` used `_id_` for the product lookup, examining one key and one document in 0 ms of server execution. The existing catalog aggregation used `restaurantId_1_slug_1` for the Product scan and `_id_` for the Category join, with seven candidate Product keys and documents examined and 1 ms in the initial cursor. MongoDB driver medians from the test host were 220 ms for Restaurant reads, 219 ms for product lookups, 221 ms for Category reads, and 229 ms for product aggregation. Those round-trip measurements include the test host's network path. Public category, product, and media requests now skip the unrelated hero-product resolution. The HTTP endpoints and measured plans use existing indexes.

## Verification

Node `v24.22.3` at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.

| Check | Command arguments after `node.exe` | Result |
| --- | --- | --- |
| Frontend unit | `--test --test-concurrency=1` with all `test/*.test.mjs` files enumerated by PowerShell | 119 passed |
| Backend offline | `--test --test-concurrency=1` from `backend/` | 189 passed |
| MongoDB integration | `--env-file="C:/Users/EL-B/my Projects/food-delevery/backend/.env" --test --test-concurrency=1 integration/publicMenu.integration.js` | 10 passed on guarded `savora_test`, with exact fixture teardown |
| Frontend typecheck | `node_modules/typescript/bin/tsc --noEmit --incremental false` | Passed |
| Frontend lint | `node_modules/eslint/bin/eslint.js src test next.config.ts` | Passed |
| Production build | `node_modules/next/dist/bin/next build --webpack` | Passed |

Chrome verified all four themes in English desktop and Arabic mobile, dynamic colors and hero images, navbar identity, product routes, Cart and Checkout, and redirect to Menu after disabling Online Ordering in the upstream fixture. Two separate mocked Checkout submissions verified Cart persistence after reload, the idempotency header, the short order display number, confirmation after save, and the WhatsApp handoff link. All order POSTs were intercepted locally. Owner and Platform Admin authentication are covered by the unit suites. A broad frontend auto-discovery attempt included standalone browser harnesses and failed on their external prerequisites. The unit command above selects the unit files, and the Chrome workflows ran separately.

The raw Lighthouse JSON, DevTools traces, per-route Chrome sample matrices, local screenshot fixtures, and API request-count capture are in the workspace's `.savora-perf/` directory. The app changes remain on the local feature branch. The existing release workflow restricts Preview database access to the designated staging branch.

## Remaining performance targets

The final local run met the score, TBT, layout stability, feedback, and warm navigation targets. FCP remained 0.17 s above its target and LCP 0.57 s above its target. The live upstream TTFB spikes and the third-party hero request remain the main dependencies for staging verification. Shared Tailwind utilities account for much of the remaining CSS.
