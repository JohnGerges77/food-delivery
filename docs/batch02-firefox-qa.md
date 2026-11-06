# Batch 02 manual Firefox QA

Use a local isolated fixture or an explicitly approved protected staging deployment. Do not use existing Demo records for upload, replacement, deletion, or checkout. Record the deployment commit and fixture identifiers before beginning. Sign in to Vercel normally when testing a protected Preview.

1. Open a new private Firefox window with no Savora cookies. Visit an unprefixed restaurant URL. Confirm the URL changes to `/ar/...`, the document is RTL, and Arabic is displayed. Switch to English, close and reopen the storefront in the same session, then revisit the unprefixed URL. Confirm English remains selected. Test a fresh private session separately for the Arabic default.
2. For Classic, Aqua, Café and Luxury, check home, menu, product details, cart and checkout at desktop width (1440px), tablet (768px), and mobile widths (390px and 375px). In Arabic, check text direction, navigation order, alignment, focus outlines, and that no horizontal scrolling occurs. Confirm prices, quantities, dates and order references use 0–9.
3. On each theme, click the image, name and empty area of a product card. Each should open that product's details. Return to the menu, activate Add-to-Cart using mouse and keyboard, and confirm quantity increases without navigating. Verify focus and accessible names for both actions.
4. On Vercel, sign in as an Owner and verify upload, replacement and managed image deletion controls are unavailable and that the storage-unavailable message is clear. Check existing external product images, galleries and logos across themes, including Hero product image and fallback behavior. Verify guest viewing does not require an Owner session. Do not attempt to enable storage or alter Demo data.
5. Inspect Network requests without copying cookies or tokens. Confirm existing external image URLs continue to render and no unavailable media control claims success.
6. With explicit authorization for isolated staging orders, place one Direct order and one WhatsApp order without sending the WhatsApp message. Confirm pricing and delivery totals, persistence in Owner Orders, and no duplicate after a retry. Verify the order POST does not return Vercel Authentication 401. Record references and clean up only the identified test fixtures using an approved procedure.

Record pass/fail, viewport, theme, language, URL, and sanitized error details. Stop if a test would modify Demo or Production data.

## Results template

Deployment commit/alias: ______  Tester/date: ______  Fixture manifest ID: ______

Use P = pass, F = fail, N = not tested. Record a separate row for each language and viewport; attach only sanitized evidence.

| Theme | Language | 1440 | 768 | 390 | 375 | RTL/overflow | Card + Add | Gallery/Hero/logo | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Classic | Arabic | N | N | N | N | N | N | N | |
| Classic | English | N | N | N | N | N | N | N | |
| Aqua | Arabic | N | N | N | N | N | N | N | |
| Aqua | English | N | N | N | N | N | N | N | |
| Café | Arabic | N | N | N | N | N | N | N | |
| Café | English | N | N | N | N | N | N | N | |
| Luxury | Arabic | N | N | N | N | N | N | N | |
| Luxury | English | N | N | N | N | N | N | N | |

| Scenario | Result | Evidence / sanitized failure |
| --- | --- | --- |
| Fresh visit defaults to Arabic and RTL | N | |
| Explicit English survives return to unprefixed route | N | |
| Western digits in prices, quantities, dates and references | N | |
| Vercel media controls unavailable with a clear Owner message | N | |
| Existing external images, galleries, logos and Hero fallback render | N | |
| Guest image read without Owner session | N | |
| Direct checkout: persisted once, correct total, no Vercel 401 | N | |
| WhatsApp checkout: persisted once, correct total, message not sent | N | |
| Exact fixture and stored-object cleanup verified | N | |

## Future VPS persistent-storage QA

Only after separate approval, use isolated owners and products on a VPS with an explicitly configured persistent mount. Upload JPEG, PNG and WebP images and a logo; check previews, progress, validation, replacement and gallery deletion. Verify tenant isolation and guest reads, restart or redeploy with the same mount, and verify persistence. Test reconciliation and exact fixture cleanup. Never use Vercel's ephemeral filesystem for this test.
