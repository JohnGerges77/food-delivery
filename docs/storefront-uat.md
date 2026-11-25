# Savora storefront UAT

The candidate includes the WhatsApp feature at `b24edd655cca8953508cc2755a0f62a85c667634`. Public Beta data corrections require a separate approval.

## Findings and fixes

| Issue | Finding and resolution |
| --- | --- |
| Variant Add | The previous menu used an imperative navigation button inside a clickable card. It opened the picker in the local baseline after hydration, so the reported public-session no-op could not be reproduced there. The variant action now links directly to the tenant's product page on both Classic Home and Menu. The picker requires an explicit choice. A regular item adds directly, and a rejected add shows feedback without clearing another restaurant's cart. |
| Fries category | The Beta demo seed assigned French Fries to Burgers, matching the live read-only menu check. New provisioning links Fries to Sides by category ID and verifies all three categories. The existing transaction and already-seeded check still prevent duplicate provisioning. |
| Checkout details | Standard checkout already submits name, phone, address and city, and the API enforces the configured minimum and computes the order prices. The cart and checkout now show provisional amounts consistently when ordering is available and an explicit pause when it is unavailable. Confirmation takes the delivery fee and total from the saved response. Beta continues to send only synthetic-safe item identifiers, quantities and submission method. |
| Arabic catalog | Demo names, descriptions and variant names previously came from English-only records. The storefront applies known Arabic translations by demo tenant and catalog slug, preserving IDs, prices and English source content. The fallback logo identifies Savora. |
| Mobile menu gap | The first section was sticky with a 116px mobile inset inside an overflow-hidden menu. The mobile filters now sit in normal flow. Classic desktop keeps the sticky search controls below the nav. |
| Home cards | Classic Home used several fixed-width horizontal slots on mobile. Its offers and catalog now use the Menu component and keep the title above prices and actions. Aqua, Café and Luxury retain their theme-specific Home treatments. |
| Metadata | The fallback title and description use Savora branding. Tenant routes use the restaurant's displayed name and description for the title and Open Graph metadata. The favicon uses the existing square Savora logo. |
| Public contact | Blank public phone, email and address values are treated as absent. The Classic information cards omit absent values. Public profile fields come from the Restaurant record, while owner credentials remain separate. |
| Media | Public product media referenced a Google thumbnail cache. The storefront avoids the known thumbnail/proxy hosts and uses an accessible image fallback when approved media is unavailable. |
| Demo prices | Pizza Small/Medium/Large remain EGP 150/200/270, Burger Single/Double remain EGP 150/210, and Fries remain EGP 60. These are synthetic catalog prices. |

Both checkout methods still use `POST /api/public/restaurants/:slug/orders`. The existing WAF route scope, request guards, backend pricing, and WhatsApp handoff contract apply to both.

## Verification

- Node.js `v24.22.3`, executable `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.
- Backend offline: `node --test test/*.test.js` from `backend/` passed 186/186.
- MongoDB integration: `node --test integration/guestCheckout.integration.js` from `backend/` passed 10/10 using the guarded `savora_test` account. The independent exact-ID fixture cleanup passed.
- Frontend: `node --experimental-strip-types --test test/*.test.mjs` passed 112/112. `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, and `node node_modules/next/dist/bin/next build --webpack` passed from `frontend/`.
- `node test/storefront-uat.browser.mjs` checked Home and Menu for four themes, two directions and four widths (64 layouts), plus the Café tablet filter and delivery-paused Cart and Checkout. The local Arabic Classic 390px nav-to-search gap changed from 129px to 13px. The browser used a read-only menu fixture with the corrected Sides relationship.
- `node test/batch01-checkout.browser.mjs` exercised Direct and WhatsApp in standard and Beta mode on English desktop and Arabic mobile. Order responses were intercepted in Chromium, and WhatsApp navigation was stubbed.

## Exact live data proposal

Only the known tenant `savora-beta-demo` in `savora_beta` is in scope. The public read-only API returned Fries (`french-fries`, ID `6b0043719c95c012860dc3af`) under Burgers (`6b00436f9c95c012860dc3a7`) and returned no Sides category. The API exposed a public profile phone field and no address. The phone digits are omitted from this report.

1. After data approval, sign in as the demo **Owner**. Verify that **Dashboard → Settings → Restaurant Profile** displays `savora-beta-demo`; verify separately that the approved Production deployment is bound to `savora_beta`. Abort if either check differs.
2. In **Dashboard → Categories**, look for slug `sides`. Reuse the existing active category if it is the expected Sides record. If absent, create exactly `{"name":"Sides","slug":"sides","sortOrder":2,"isActive":true}` through the authenticated `POST /api/owner/categories` flow and verify the returned ID. If a conflicting or inactive Sides record exists, review it before changing it.
3. In **Dashboard → Products**, confirm the Fries ID, slug, current category and EGP 60 price. If it already references the verified Sides ID, do nothing. If it still references the verified Burgers ID, update **only** the category. For the existing session- and CSRF-protected API, the request is `PATCH /api/owner/products/6b0043719c95c012860dc3af` with `{"categoryId":"<verified Sides ID>"}`. Stop on any other current value. Verify the public Sides filter shows Fries, the Burgers filter omits it, and its price, variants, and availability match the preflight.
4. In **Dashboard → Settings → Restaurant Profile**, use **Phone** and **Address** only for operator-approved public business contact information. If the operator confirms the stored phone is private, clear that field or replace it with an approved business number. Leave Address empty until an approved business address is supplied. Save and reload the Owner settings and the public page to verify both.
5. If separately approved, check the current media on Pizza (`6b0043709c95c012860dc3a8`), Burger (`6b0043709c95c012860dc3ac`) and Fries (`6b0043719c95c012860dc3af`). Remove only confirmed Google thumbnail URLs from those products, or replace them with authorized static images or approved media. Preserve other gallery entries. The storefront fallback works without a database change.

Do not rerun initial provisioning on the seeded database. The proposed category update leaves historical Order item snapshots intact.

## Synthetic order cleanup

Record requested for cleanup: `SV-531249A934CA506122E4DCC8`. The exact record, its tenant, its synthetic attributes and dependent records could not be verified in `savora_beta` from the current session. The supported Owner Order operations list orders, retrieve details and update workflow status. There is no supported archive or delete operation. No raw database deletion or status change was performed. Cleanup requires an approved, auditable operation with a verified database and tenant-scoped exact-match check.

## Firefox acceptance after staging approval

1. In an authenticated Firefox session on the protected staging URL, review English desktop and Arabic Responsive Design Mode at 390px. Confirm Savora tab branding and the restaurant title, nav-to-search spacing, and matching Classic card proportions on Home and Menu.
2. Open Burger from Home and Pizza from Menu. Confirm no option is preselected and Add stays disabled until a choice is made. Add Double Burger and Medium Pizza, then add Fries directly from Menu. Reload the cart and confirm one of each with a subtotal of EGP 470. Check the Sides filter only after the separate demo correction.
3. Open checkout. In Beta, confirm the synthetic notice and absence of customer contact inputs. With checkout paused, confirm the pause message and absence of provisional fee/total. In standard test mode, confirm name, phone, address and city and the configured minimum. Verify final amounts from the server response after any separately approved submission.
4. Where WhatsApp is configured and allowlisted, confirm the two methods appear. Run the verified WhatsApp release procedure for any persistent synthetic test. Inspect the saved Order, source price, correct tenant, handoff destination and `messageSent=false`. Open but do not send the prefilled message. Reopen the link and verify no duplicate Order. See [WhatsApp ordering release and Firefox instructions](whatsapp-ordering.md).
