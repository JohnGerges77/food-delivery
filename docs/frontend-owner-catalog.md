# Phase 8.3: owner Categories and Products frontend

The protected dashboard Categories and Products routes now use only the authenticated owner APIs. Their server page components pass no fixture records. The dashboard shell restores `/api/auth/me` before the client pages render; owner requests use the existing `apiRequest` with `credentials: "include"`, `cache: "no-store"`, and session-bound CSRF bootstrap for POST, PATCH and DELETE. A 401 invokes the existing auth restore flow; 403, 400, 404, 409, network and timeout failures remain visible without optimistic success. The shared client times out requests after 20 seconds.

## Contracts and mappings

| Backend owner DTO | Dashboard presentation/form |
| --- | --- |
| Category `id`, `name`, `slug`, `description`, `imageUrl`, `sortOrder`, `isActive` | MongoDB `id` stays opaque. Null text/image becomes an empty edit field; missing or broken images show an icon. Active state and sort order are real values. No internal `referenceRevision` is parsed or shown. |
| Product `id`, `name`, `slug`, `categoryId`, `description`, `price`, `oldPrice`, `imageUrl`, `images`, `isAvailable`, `isFeatured`, `preparationTime`, `calories` | Null optional fields become empty edit fields. `images` is edited as one path/URL per line (up to ten). Primary image is used first, then the first additional image, then a placeholder. No rating or review value is manufactured. |

Category create requires a name and a valid slug; edits include only changed fields and never derive a new slug from a name change. Category `sortOrder` is an integer from 0 to 1,000,000. Product create requires name, slug, a Category ID fetched from the owner's Category API, and price. Inactive Categories are selectable because the backend permits draft Products in them; the UI marks them as hidden from the public menu. A missing/deleted Category is rejected by the backend, and the client reloads affected lists on 404.

Products use the currency in the authenticated restaurant context. `Intl.NumberFormat` controls display and minor-unit precision. Prices are entered as text, validated before conversion, limited to 0–1,000,000, and sent as JSON numbers. This preserves zero and prevents an extra EGP decimal digit from being silently rounded. Blank `oldPrice`, `preparationTime`, and `calories` map to `null`, which the Product API supports. Product image values accept validated root-relative paths or HTTP(S) URLs; no upload API exists.

The pages use bounded owner pagination. Category sorting supports `sortOrder` and `-sortOrder`; Product sorting and category/availability/featured filters use the backend's exact query keys. Text search applies only to the **currently loaded page**, since these owner APIs do not expose a text-search parameter. Product category options are loaded from all bounded owner Category pages, up to the backend's 1000-page limit. After mutation, pages refetch canonical records, and deleting the final item on a page moves to the preceding page.

Category deletion remains blocked by any referencing Product; a 409 keeps the Category on screen and suggests moving/removing Products or deactivating the Category. Product deletion remains blocked by historical Orders; a 409 keeps the Product visible and offers a separate `isAvailable: false` action. Both destructive actions require a confirmation dialog. Dialogs support Escape, initial focus, focus trapping and focus return. Success and error notifications are shown after backend confirmation or failure.

Local configuration remains `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://localhost:5000` for the frontend and `AUTH_TRUSTED_ORIGINS=http://localhost:3000` plus MongoDB connectivity for the backend. `npm run dev` still uses Webpack. No provisioning, migration, or automatic write to the development restaurant is part of this phase. The current automated suite mocks HTTP requests; it does not prove browser behavior against Atlas or MongoDB-backed persistence.
