# Phase 8.2: owner restaurant settings

The dashboard Settings route loads `GET /api/owner/restaurant` after the owner session is authenticated. It does not use `src/data/restaurant.ts` or the public restaurant service. The response must contain the authenticated restaurant ID; a mismatch is rejected. Loading shows a skeleton, failures show a retry control, and no fixture values are substituted.

## DTO and form mapping

| Settings form | Owner DTO / PATCH field |
| --- | --- |
| Restaurant name, description, logo URL, phone, email, address, opening hours | `name`, `description`, `logoUrl`, `phone`, `contactEmail`, `address`, `openingHours` |
| Delivery fee, minimum order, estimated time, available | `deliverySettings.deliveryFee`, `.minimumOrder`, `.estimatedDeliveryTime`, `.deliveryAvailable` |
| Facebook, Instagram, WhatsApp | `socialLinks.facebook`, `.instagram`, `.whatsapp` |
| Brand name, primary color | `branding.brandName`, `.primaryColor` |

Optional string DTO values (`null`) become empty form strings. A valid zero amount becomes `"0"`, and `false` stays `false`. Amounts become JavaScript numbers only in the PATCH payload. The form accepts non-negative values with at most two decimal places. The backend PATCH contract accepts amounts but cannot clear an existing amount to `null`, so the form reports an error if an existing amount is emptied. Optional strings can be cleared with `""`. Opening hours remains display text, not an interpreted schedule. `slug` and `currency` are shown read-only. `id`, `slug`, `status`, `currency`, timestamps, and tenant identifiers are never sent in PATCH.

The form validates required name, email, HTTP(S) URLs without credentials, hex primary color, amount precision, and the backend's 2048-character text limit. It compares the edited form with the last confirmed DTO and sends only changed writable fields. Nested objects contain only changed child fields, preserving their siblings. After PATCH succeeds, the canonical response replaces the form state and updates the authenticated restaurant summary. The success message appears only then. An unsuccessful response leaves edits available for retry. Refresh fetches the current DTO again.

`apiRequest` supplies `credentials: "include"` and `cache: "no-store"`. PATCH uses the existing session-bound `/api/auth/csrf` bootstrap and `X-Savora-CSRF`. On 401, Settings invokes the existing auth restore flow, which removes access when the session is invalid. A 403 or 400 is displayed without bypassing the server guard. Browser unload warns about unsaved edits; the dashboard's client-side navigation does not currently block route changes.

For local use, `frontend/.env.local` needs `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://localhost:5000`; the backend needs `AUTH_TRUSTED_ORIGINS=http://localhost:3000`, a working MongoDB connection, and an existing owner session. Use `localhost` for both origins. `npm run dev` remains `next dev --webpack`. No provisioning or development-restaurant mutation is part of this phase.
