# Savora Phase 8.8 test report

Date: **21 October 2026** (Africa/Cairo). Backend commands used Node **v24.21.0** at `C:\Users\EL-B\AppData\Local\npm-cache\_npx\387698761821791d\node_modules\node\bin\node.exe`; the machine's default Node 20 was not used. `NODE24` below means that executable, not a PATH change.

## Results

| Check | Command or method | Result |
| --- | --- | --- |
| Backend offline suite, after optional Product fix | From `backend`: `& $NODE24 --test` | **137/137 passed** |
| Focused Product validation | From `backend`: `& $NODE24 --test test/product.test.js test/ownerProducts.test.js` | **23/23 passed**; optional `preparationTime: null` now validates |
| Frontend unit suite | From `frontend`: `& $NODE24 --test test/*.test.mjs` | **62/62 passed** |
| Frontend TypeScript | From `frontend`: `& $NODE24 node_modules/typescript/bin/tsc --noEmit` | Passed after generated config restoration |
| Frontend ESLint | From `frontend`: `& $NODE24 node_modules/eslint/bin/eslint.js .` | Passed after test-cache cleanup |
| Next production build | From `frontend`: `& $NODE24 node_modules/next/dist/bin/next build --webpack` | Passed again in the final check; 27 static pages generated |
| Guarded MongoDB integration | `ownerAnalytics.integration.js`; then `models,provisioning,auth,tenant`; then `ownerCategories,ownerProducts,publicMenu`; then `guestCheckout,ownerOrders,backendJourney` with `MONGODB_URI=''`, `--env-file=.env`, Node 24 | **8 + 29 + 24 + 16 = 77/77 passed** in separate runs before the optional Product validator fix; the real browser test exercised Product create after the fix |
| Mocked browser regression | Owner Analytics, Owner Orders, guest checkout and checkout inputs, with API interception | Passed; Owner Analytics was rerun after aligning fixture statuses and amounts |
| Real full-stack browser | Explicit command below | **1/1 passed**, including teardown, after the Product fix |

The all-in-one MongoDB integration invocation previously exhausted host memory; splitting by file group completed all 77 cases. Read-only Atlas audit connections intermittently timed out; successful audits are recorded below. The latest real E2E finished in about 115 seconds and left no test listener or MongoDB connection hanging.

The guarded integration commands were run from `backend/` with `$env:MONGODB_URI=''` and the same Node 24 executable:

```powershell
& $NODE24 --env-file=.env --test --test-concurrency=1 integration/ownerAnalytics.integration.js
& $NODE24 --env-file=.env --test --test-concurrency=1 integration/models.integration.js integration/provisioning.integration.js integration/auth.integration.js integration/tenant.integration.js
& $NODE24 --env-file=.env --test --test-concurrency=1 integration/ownerCategories.integration.js integration/ownerProducts.integration.js integration/publicMenu.integration.js
& $NODE24 --env-file=.env --test --test-concurrency=1 integration/guestCheckout.integration.js integration/ownerOrders.integration.js integration/backendJourney.integration.js
```

The Analytics browser regression was rerun from `frontend/` with an isolated CDP browser and the local production Next server:

```powershell
$env:SAVORA_CDP_PORT='9445'
$env:SAVORA_STOREFRONT_URL='http://localhost:3100'
& $NODE24 test/owner-analytics.browser.mjs
```

## Real browser E2E reproduction

The test is the registered Node test in `backend/integration/fullstackBrowser.integration.js`; it is deliberately excluded from the default offline `npm test` and the existing database integration script because it needs a separately running browser and Next server. It creates two disposable tenants in `savora_test`, uses exact-tenant cleanup, and fails closed unless `MONGODB_TEST_URI` has username `savora_test_user`, path `/savora_test`, and no `dbName` override. Use an Atlas allowlisted network and an isolated Edge/Chrome CDP profile.

In PowerShell, from the repository root (replace `$NODE24` with the absolute binary above):

```powershell
$NODE24 = 'C:\Users\EL-B\AppData\Local\npm-cache\_npx\387698761821791d\node_modules\node\bin\node.exe'
$profilePath = Join-Path $env:TEMP 'savora-phase88-edge-profile'
$edge = Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList @('--headless=new','--disable-gpu','--disable-software-rasterizer','--no-sandbox','--no-first-run','--remote-debugging-port=9445',"--user-data-dir=$profilePath",'about:blank') -WindowStyle Hidden -PassThru
```

In a second terminal, from `frontend/`:

```powershell
$env:SAVORA_PHASE88_TEST='1'
$env:NEXT_PUBLIC_SAVORA_API_BASE_URL='http://localhost:5101'
$env:NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG=''
& $NODE24 node_modules/next/dist/bin/next dev --webpack -p 3110
```

After Next reports ready, in a third terminal, from `backend/`:

```powershell
$env:MONGODB_URI=''
$env:SAVORA_CDP_PORT='9445'
& $NODE24 --env-file=.env --test integration/fullstackBrowser.integration.js
```

`backend/.env` must supply `MONGODB_TEST_URI` for the guarded test database. The browser test starts and stops Express on port 5101; Next uses `.next-phase88` so an unrelated `.next` session can coexist. After the test, stop the separate Next terminal and the specific Edge process (`Stop-Process -Id $edge.Id`), check ports 3110/5101/9445 have no listeners, and restore any Next-generated `next-env.d.ts` or `tsconfig.json` additions. The test's successful run returned `tests 1, pass 1, fail 0`. The checkout and Overview screenshots are `phase88-real-checkout-test.png` and `phase88-real-overview-test.png` in this directory.

The browser journey checked authoritative EGP 12.50 product + EGP 5 delivery = **EGP 17.50**, no browser-supplied total or restaurant ID, saved Order reference, Product snapshot, direct Pending to Delivered transition with `deliveredAt`, delivered-only Overview value, product ranking, Settings reload, Category and Product creation, owner session refresh and logout, second-owner isolation, and no API requests to another origin. The original dark/orange storefront and dashboard, charts and navigation were visible in saved screenshots. Mocked browser checks also exercised English desktop and Arabic mobile flows; these were visual interaction checks, not a full accessibility audit.

## Fixture cleanup audit

An interrupted expanded run left two generated tenants. The read-only audit identified exact ownership before deletion:

| Test tenant | Restaurant ID | Owner ID | Owned records before targeted cleanup |
| --- | --- | --- | --- |
| `it-phase88-a-cf3c5632748e43bbb8560eccf1ca3645` | `6ad7adf9fd251efb89519330` | `6ad7adf9fd251efb89519331` | 1 OwnerSession (`6ad7ae18fd251efb89519337`), 2 Categories (`6ad7adfcfd251efb89519334`, `6ad7ae2ffd251efb89519338`), 1 Product (`6ad7adfcfd251efb89519335`), 1 Order (`6ad7ae14fd251efb89519336`) |
| `it-phase88-b-cf3c5632748e43bbb8560eccf1ca3645` | `6ad7adfbfd251efb89519332` | `6ad7adfbfd251efb89519333` | No Session, Category, Product or Order |

The guarded cleanup checked each restaurant `_id` plus exact slug, then removed only enumerated related IDs and those two owners/restaurants. It did not use `deleteMany({})` or drop a collection/database. A later read-only audit returned `[]` for all `it-phase88-[ab]-` restaurant slugs and zero Restaurants, Users, OwnerSessions, Categories, Products and Orders for both exact tenant/owner IDs. The successful fresh E2E also reached its `finally` teardown; a subsequent read-only prefix audit again returned `[]`. Its isolated API, browser and Next listeners were stopped. No `savora_dev` request or write was made by these tests.

Temporary fixture-inspection and page-diagnostic scripts were removed after audit. The retained browser and Analytics scripts are test code only, outside production application routes.

## Configuration and test-file review

| File | Decision |
| --- | --- |
| `frontend/next.config.ts` | Keep the `SAVORA_PHASE88_TEST=1` conditional `distDir`; it isolates a reproducible test Next cache while leaving normal `.next` behavior unchanged. |
| `frontend/.gitignore` | Keep `/.next-phase88/` so the isolated generated cache is never shipped. |
| `frontend/next-env.d.ts` and `frontend/tsconfig.json` | Restore Next's generated `.next-phase88` route/include additions to their original `.next` references after the browser run. |
| `backend/integration/fullstackBrowser.integration.js` | Keep the explicit guarded real browser regression; it is not an application route or production startup script. |
| `backend/integration/inspectPhase88Fixtures.mjs` and `frontend/test/inspect-phase88-page.mjs` | Remove the one-off fixture and page diagnostics after using them. |
| `frontend/test/owner-analytics.browser.mjs` | Keep the Analytics browser regression with consistent delivered and pending mock totals. |

No original Savora page, component, animation or chart was replaced by these test/configuration changes.
