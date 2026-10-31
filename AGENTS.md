# Savora — Repository Instructions for Codex

> **Scope:** This file belongs at the **repository root** (`food-delevery/AGENTS.md`) and applies to both `frontend/` and `backend/`. Also read any more specific `AGENTS.md` files within the directory being edited; do not replace or delete them.
>
> **Purpose:** These are the recurring instructions for every Codex task. The user's next prompt should describe **only the new task** and its acceptance criteria. Do not treat this document as permission to implement future features.

## 1. Product and architecture

Savora is a multi-tenant SaaS that provides restaurant websites and an owner dashboard.

- **V1:** One independently authenticated **owner account per restaurant**. No customer accounts, staff accounts, or complex role/permission system in V1. Keep the data model extensible for staff later.
- **Guest checkout:** Visitors can browse, add to cart, enter checkout details, and place orders without registering.
- **Persistent orders are mandatory:** **Every checkout order must be saved in MongoDB**, whether the chosen completion method is WhatsApp or direct/dashboard submission. Saving must succeed before reporting success or redirecting to WhatsApp.
- Opening a prefilled WhatsApp message **does not prove it was sent**. Do not mark the order completed or count it as realized revenue solely because WhatsApp opened.
- **Analytics:** Include all persisted orders in order counts; distinguish created/pending/cancelled/delivered orders. For V1, treat `delivered` orders as completed order revenue, not every created order. This is an operational revenue measure, not proof of payment collection.
- **Multi-tenancy:** One shared Express backend, one shared MongoDB database, and shared collections scoped by `restaurantId`. Never build a separate backend or DB per restaurant unless expressly requested.
- V1 does **not** include online payments, customer authentication, table ordering, or table reservations.
- Start with **slug-based restaurant identification** as the preferred direction, but **do not assume the public tenant-resolution API contract is finalized**.

## 2. Existing project and technology

```text
food-delevery/
├── AGENTS.md                  # These repository-wide instructions
├── docs/                      # Approved ERD and project notes
├── frontend/                  # Existing Next.js app; preserve it
└── backend/                   # Separate Express/Mongoose app
    ├── src/
    │   ├── app.js
    │   ├── server.js
    │   ├── config/db.js
    │   └── models/
    ├── test/
    ├── package.json
    └── .env.example
```

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Zustand. Reuse existing pages, components, services, styles, and animations. Do **not** rebuild or change the frontend unless the specific task explicitly asks.
- **Backend:** Node.js **24 LTS**, Express **5**, Mongoose **9**, JavaScript **ES Modules** (`import`/`export`). Use the project's actual installed versions and conventions.
- **Database:** MongoDB + Mongoose.
- **Authentication when authorized as a future task:** owner JWT login, safely hashed passwords, and protected dashboard endpoints.
- Avoid adding TypeScript to the backend or introducing Zod, shadcn/ui, Recharts, Material UI, heavy frameworks, or other dependencies without a demonstrated need and user approval.
- Follow the existing project structure instead of adding unnecessary abstraction or folders.

## 3. Mandatory workflow for every task

1. Read applicable `AGENTS.md` instructions, then inspect the **actual relevant files** before coding.
2. Check the ERD and existing frontend types/fixtures/components when a backend field must support a frontend feature. Prefer evidence from the project over guesses.
3. Work on **only the feature explicitly requested**. Do not implement unrelated schemas, auth, CRUD, endpoints, or frontend changes “while here.”
4. For an unclear product rule or a decision that changes data compatibility/security, explain the trade-off and ask rather than inventing a requirement. For minor implementation details, choose the simplest maintainable solution and report the assumption.
5. Make the smallest coherent changes. Preserve working files and public behavior; avoid unrelated refactors, formatting churn, and dependency upgrades.
6. Write or update narrowly scoped tests for the task and run the relevant tests, plus the complete backend test suite when reasonable.
7. Confirm what ran, what passed, what was **not** tested, and whether any frontend files changed. **Never claim a test or integration passed if it was not run.**
8. Stop after the requested task and wait for review. Do not automatically begin the next roadmap phase.

## 4. Windows / Node.js execution rules

- The machine's default `node` may be **v20.16.0**, while Savora's backend targets **Node 24**. **Do not silently execute backend tests with Node 20**.
- Before backend commands, verify `process.version` and `process.execPath`. Locate and use an available Node 24 binary (including a standalone Node 24 executable if present). Do not assume a temporary npm-cache path will always exist.
- Report the **actual executable path** and Node version used to run tests.
- Do not modify the system PATH, install NVM/Node, or change global settings without user approval. If Node 24 is unavailable, clearly say testing is blocked.
- Run backend commands from `backend/`. Prefer existing `npm` scripts (`npm test`, `npm run dev`, `npm start`) and the lockfile.
- Do not run `npm audit fix --force` or blindly upgrade packages. Report vulnerabilities and proposed fixes separately.
- The server is expected to keep running during `npm run dev` under nodemon. `MONGODB_URI` may be absent during offline schema tasks; do not confuse a working HTTP health endpoint with a connected database.

## 5. Mongoose data modeling rules

The approved V1 ERD contains exactly five main collections:

1. `Restaurant`
2. `User`
3. `Category`
4. `Product`
5. `Order`

Do not add separate `Customer` or `OrderItem` collections for V1. Use embedded order-item snapshots and embedded restaurant settings where appropriate.

**Global design rules:**

- Every restaurant-owned `User`, `Category`, `Product`, and `Order` document must include a required `restaurantId` referencing its `Restaurant`.
- `ref` and `ObjectId` do **not** enforce foreign keys in MongoDB. Verify referenced documents and their tenant ownership in application services/controllers once those are implemented.
- Use `timestamps: true`, sensible validation/defaults, and indexes justified by a real uniqueness or query requirement.
- Define tenant-scoped uniqueness using compound indexes, **not** globally unique slugs for categories or products.
- Mongoose `unique` declares a MongoDB index; it is **not** an ordinary field validator. Offline schema tests cannot prove database-enforced uniqueness.
- Avoid premature indexes, arbitrary denormalization, or extra collections.

**Approved model conventions:**

- `Restaurant.slug`: globally unique, normalized lowercase kebab-case.
- `Restaurant.openingHours`: a **trimmed string in V1**, compatible with the current frontend's display text; no automatic open/closed schedule interpretation.
- `Restaurant.deliverySettings`: embedded `deliveryFee`, `minimumOrder`, `estimatedDeliveryTime`, `deliveryAvailable`; frontend currently has some flat fields, so adapt through a future API mapping layer rather than editing the frontend prematurely.
- `Restaurant.socialLinks.whatsapp`: an HTTP(S) URL (frontend uses `https://wa.me/...`), not an unvalidated arbitrary phone string.
- `User.email`: globally unique, trimmed, lowercase.
- `User.role`: `owner` only in V1; `isActive` defaults to true.
- At most one owner per restaurant: **partial unique index** on `User.restaurantId` filtered by `{ role: 'owner' }`. This does not guarantee that every restaurant already has an owner.
- `User.passwordHash`: required, `select: false`, and excluded from normal document JSON/object serialization. Be aware that `lean()`, raw results, and aggregations do not necessarily apply document transforms; never expose sensitive fields through API responses. Authentication will implement hashing later.
- `Category`: unique `{ restaurantId, slug }`, and tenant-scoped ordered retrieval via `{ restaurantId, sortOrder }` when justified.
- `Product`: both `restaurantId` and `categoryId`; validate the category belongs to the same restaurant on write. Do not rely on client-supplied ownership.
- `Order`: include guest contact/address details and an embedded `items` array containing **immutable at-order-time product snapshots** (e.g. name, unit price, quantity, selected options when supported).

**Money and order integrity:**

- Never trust product prices, delivery fees, subtotals, totals, product availability, or restaurant IDs sent by the browser. Derive and validate them server-side from authoritative records.
- Record order `source` separately from `submissionMethod` (for example `website` + `whatsapp` or `website` + `direct`); align final enums with existing frontend workflows before implementation.
- Preserve historical order prices when products later change.
- New Orders start `pending`; the owner may transition a nonterminal Order directly to `delivered` or `cancelled`. Both are terminal. Preserve historical stored `preparing`, `ready`, and `out-for-delivery` values; group them as Pending for owner filters and analytics without bulk rewriting records. `status` remains an exact API filter, while `statusGroup` supplies simplified filtering.
- Guest order tracking must not reveal private order/customer information merely because a public order number is guessed.
- The **exact price representation, order-number generation, public tenant resolution contract, and full nested Order schema** still need detailed design. Do not silently treat illustrative fields as final API contracts.

## 6. Tenant isolation and API security (for future implementation tasks)

- Protected dashboard operations must derive the tenant scope from a **verified server-side auth context**, not from arbitrary `restaurantId` in query/body/path input.
- Public requests must resolve the intended restaurant from a validated, unambiguous slug/domain context before reading public menu data or creating an order.
- For every tenant-owned read/update/delete and referenced relation, enforce the restaurant scope **on the backend**; hiding records in frontend UI is not security.
- Do not allow one restaurant's product to reference another restaurant's category.
- Reject cross-tenant writes and ownership transfers by default, unless a separately designed privileged process explicitly authorizes them.
- Validate untrusted inputs, minimize sensitive data in responses, and never log passwords, JWTs, or secret credentials.
- Store secrets in local `.env` files; keep `.env.example` free of real credentials. Never commit or print real secrets.
- Separate **public** endpoints from **authenticated owner-dashboard** endpoints.

## 7. Testing requirements

- For model-only tasks, use the project's existing Node.js built-in test runner where practical and write **offline tests** for field validation, defaults, normalization, schema configuration, and index declarations.
- For code involving real persistence or permissions, plan separate MongoDB/API **integration tests**. Offline validation is not proof that indexes are built, unique constraints are enforced, or tenant isolation works against a real database.
- Add negative tests for empty required strings, invalid ObjectIds/enums, negative amounts, uniqueness once DB integration is available, and cross-tenant access for later API tasks.
- Run all currently applicable backend tests with Node 24; document failures rather than suppressing or disguising them.
- If the requested changes are backend-only, verify the frontend remains unchanged (e.g. `git diff` or an established before/after file-hash baseline).

## 8. Current progress snapshot (update only after confirmed milestones)

- **ERD:** Approved and drawn in Eraser. Saved image intended for `docs/`.
- **Backend scaffold and models:** `GET /api/health` and the five approved business models are implemented.
- **Phase 3.1:** Argon2id password utilities and transactional restaurant/owner provisioning are implemented.
- **Phase 3.2:** Owner login, logout, and `/me` use persistent hashed-token sessions and an ancillary session collection. No public signup exists.
- **Phase 3.3:** Verified owner contexts, tenant-scoped Category/Product/Order query helpers, reference checks, and `GET /api/owner/restaurant` are implemented.
- **Phase 4.1:** Authenticated owners can read and patch whitelisted restaurant settings with trusted-Origin, CSRF, tenant, and schema validation guards.
- **Phase 4.2:** Owner Category CRUD uses tenant-scoped queries, strict input validation, bounded pagination, MongoDB-enforced per-tenant slug uniqueness, and product-reference deletion checks.
- **Phase 4.3:** Owner Product CRUD validates tenant-owned Category references, currency precision, filters, and Order-reference deletion rules. Product assignment and Category deletion coordinate through an internal Category revision in bounded MongoDB transactions.
- **Phase 5.1:** Read-only public restaurant, category, and product APIs resolve active restaurants by slug, expose explicit storefront DTOs, filter menu visibility within the tenant, and use non-credentialed public CORS.
- **Phase 5.2:** Public guest checkout persists direct and WhatsApp orders before confirmation/handoff, uses authoritative pricing and order snapshots, tenant-scoped idempotency, and transactional Product-delete coordination.
- **Phase 5.3:** Authenticated owner Order listing, details, and status transitions use tenant-scoped queries, explicit snapshot DTOs, bounded filters, trusted-Origin and CSRF guards, and conditional atomic status updates.
- **Phase 6:** Five authenticated owner analytics endpoints provide UTC period comparisons, delivered-order value, trends, product snapshot rankings, status/method breakdowns, and a 168-cell activity matrix. API and future dashboard design are documented; no frontend integration was performed.
- **Phase 7:** Backend runtime now requires Node 24, MongoDB and trusted owner origins before listening; health reflects DB readiness. Authentication includes a trusted-origin CSRF bootstrap for same-site sibling hostnames. A read-only index checker, guarded end-to-end API journey, backend audit and integration documentation are complete. No frontend files or development data were changed.
- **Phase 8.1:** Frontend owner authentication uses the backend session, CSRF bootstrap and protected dashboard shell. Local browser login, refresh and logout were verified; dashboard business data remained fixture-backed.
- **Phase 8.2:** Frontend Settings now loads and patches the authenticated owner's real restaurant DTO, with partial nested writes, validation, loading/error states and confirmed-save feedback. Fifteen frontend tests, TypeScript, ESLint, the Next.js production build, and 136 backend offline tests passed with Node 24.14.0. Other dashboard data remains fixture-backed. See `docs/frontend-restaurant-settings.md`.
- **Phase 8.3:** Authenticated Categories and Products dashboard pages now use the owner CRUD APIs, real Category IDs and restaurant currency, with bounded lists, validation, confirmed mutations and referential-deletion conflict handling. Thirty frontend tests, TypeScript, ESLint, the Next.js production build, and 136 backend offline tests passed under Node 24.14.0. No live MongoDB write or interactive browser verification was performed. See `docs/frontend-owner-catalog.md`.
- **Phase 8.4:** Public storefront routes now resolve a validated restaurant slug, fetch public Restaurant/Category/Product DTOs without owner credentials, render real menu pages with bounded pagination and scoped search, and isolate the in-memory cart per restaurant. The checkout UI cannot claim a saved Order. Thirty-eight frontend tests, TypeScript, ESLint, the Next.js production build, and 136 backend offline tests passed; public local GET checks confirmed `savora-demo` data and no fixture Product fallback. No development MongoDB write, MongoDB integration test, or interactive browser verification was performed. See `docs/frontend-public-menu.md`.
- **Phase 8.5:** The restored Checkout page now submits real guest Direct and WhatsApp orders through the public API, validates details and cart IDs, and shows only backend-confirmed references/totals and post-save WhatsApp handoff. SHA-256 payload fingerprints and UUID idempotency keys support safe retry; only key/fingerprint metadata enters session storage. Forty-six frontend tests, TypeScript, ESLint, the Next.js build, 136 backend offline tests, and headless English desktop/Arabic mobile mocked-POST browser journeys passed under Node 24.14.0. No checkout POST reached `savora_dev`, no development data was changed, and no MongoDB integration test was run for this frontend task. See `docs/frontend-guest-checkout.md`.
- **Phase 8.6:** Authenticated Owner Orders now load bounded, tenant-scoped real Order DTOs with exact reference/status/method/UTC date filters, detail snapshots, manual refresh, and canonical status transitions with session CSRF and 409 reconciliation. The original Orders cards, search/status controls and details modal remain. Fifty-three frontend tests, TypeScript, ESLint, Next.js build, 136 backend offline tests, and mocked-API Chrome desktop English/mobile Arabic flows passed under Node 24.14.0. No live Owner Order status was changed, `savora_dev` was not modified, and no MongoDB integration test was run for this frontend task. See `docs/frontend-owner-orders.md`.
- **Phase 8.7:** The Owner Overview now reads the five authenticated Analytics APIs and a bounded Recent Orders list, with shared 7d/30d/6m/12m period selection, real KPIs, SVG area/donut charts, snapshot Top Products, and the 168-cell UTC activity heatmap. Original dark/orange shell, cards, and navigation remain; unsupported demo claims were removed. Sixty-one frontend tests, TypeScript, ESLint, a Webpack Next.js build, 136 backend offline tests, and mocked-API Chrome desktop English/mobile Arabic interactions passed under Node 24.14.0. A default Turbopack build attempt hit worker memory exhaustion; Webpack completed successfully. No live Analytics database verification or `savora_dev` write was performed. See `docs/frontend-dashboard-analytics.md`.
- **Order workflow + Tajawal update:** New and legacy nonterminal Orders can go directly to `delivered` or `cancelled`; terminal states cannot reopen. The Owner Orders UI and Analytics expose three operational groups, with legacy intermediate values counted as Pending while stored values stay intact. Arabic routes self-host Tajawal under OFL; English retains Arial/Helvetica. The original Savora layout, checkout persistence, and delivered-value accounting remain. Under Node 24.21.0, 137 backend offline tests, 62 frontend tests, TypeScript, ESLint, a Next.js Webpack build, and mocked Chrome Orders/Analytics/Checkout flows passed. All 77 guarded `savora_test` integration tests passed across separate runs; the single all-in-one invocation exhausted host memory. No `savora_dev` write or deployment occurred. See `docs/owner-orders-api.md`, `docs/dashboard-analytics-api.md`, and `docs/arabic-typography.md`.
- **Phase 8.4 visual correction:** Original landing, navigation, menu, cart, checkout and footer components are reconnected to public DTOs; decorative sections remain visible for an empty menu. Checkout customer fields became editable and preserve React state. Order submission was disabled until Phase 8.5 integrated real persistence. The checkout input correction has focused state tests and a local Chromium interaction smoke test. See `docs/frontend-public-menu.md` for verification; no development MongoDB writes were made.
- **Verified tests:** 137 offline tests and 77 guarded `savora_test` MongoDB integration tests (including the end-to-end journey) passed across separate runs under Node 24.21.0. A single full integration invocation exhausted host memory, so the files were completed in smaller runs. The earlier read-only index inspection found no missing or conflicting declared indexes in `savora_test`; no new index inspection was run for this update.
- **Phase 8.8 final full-stack verification:** A guarded real browser E2E connected isolated Next and Express to `savora_test` and passed 1/1 after a narrow Product model fix allowing optional `preparationTime: null`. It saved and delivered a real guest Order, showed EGP 17.50 delivered value and product analytics, persisted Settings and new Category/Product records, verified session refresh/logout and second-tenant isolation, and completed teardown. A separate read-only audit found no Phase 8.8 test tenants afterward; exact records left by an interrupted run were identified, deleted by ID, and re-audited at zero across Restaurant, User, OwnerSession, Category, Product and Order. Backend offline tests passed 137/137 after the fix; frontend tests passed 62/62, TypeScript, ESLint and a fresh Webpack production build passed; mocked browser checks also passed. `savora_dev` was untouched, no deployment occurred. See `docs/fullstack-readiness.md`, `docs/fullstack-test-report.md`, and `docs/pre-deployment-checklist.md`.
- **Phase 9:** A separate Platform Admin identity, guarded interactive bootstrap, dedicated session/CSRF namespace, audited atomic Restaurant+Owner creation, bounded listing/details, and active/suspended controls are implemented. Suspension blocks new Checkout, public reads, Owner login and existing Owner sessions while retaining historical data; legacy status-less Restaurants remain active. English/Arabic Admin dashboard routes include Overview, Restaurants, creation and details with confirmation. Under Node 24.19.0, 141 backend offline tests, 67 frontend tests, 78 guarded `savora_test` API integration tests across separate runs, one isolated real Admin browser E2E, TypeScript, ESLint and a Webpack build passed. The browser test verified Owner/Admin separation, cross-tenant denial, suspension/reactivation and zero remaining exact fixtures in nine collections. `savora_dev` was untouched and no deployment occurred. See `docs/platform-admin-architecture.md`, `docs/platform-admin-api.md`, `docs/platform-admin-user-guide.md`, and `docs/platform-admin-test-report.md`.
- **Phase 10.1:** Tenant-scoped public `storefrontTheme` resolves to Savora Classic by default, including legacy Restaurants; only Classic is registered and no theme picker exists. Classic menu cards are smaller while the rest of the storefront and both dashboards keep their established design. Deterministic read-only browser screenshots show desktop English and mobile Arabic before/after dimensions, RTL, Tajawal, and no overflow. Under Node 24.21.0, 142 backend offline tests and 68 frontend tests passed serially; TypeScript, ESLint, and a Next.js Webpack build passed. A guarded `savora_test` public-menu integration attempt was interrupted after producing no result, so live MongoDB integration is unconfirmed. `savora_dev` was not changed. See `docs/storefront-theme-architecture.md`.
- **Phase 10.2:** Savora Aqua adds a distinct teal/mint storefront presentation over the shared public menu, tenant cart, and persisted checkout. Classic remains the default for existing and legacy Restaurants. Platform Admin can assign or change either implemented theme through guarded, audited APIs and dashboard controls; Owners cannot. Under Node 24.22.1, 143 backend offline tests, 69 frontend tests, TypeScript, ESLint, and a Next.js Webpack build passed. Guarded `savora_test` public-menu integration passed 7/7, and the Admin journey passed 1/1 including legacy theme assignment and exact teardown. In-app Chromium desktop/mobile screenshots checked English, Arabic, Aqua, Classic, Cart, Checkout, and dashboard isolation; a separate read-only audit found zero exact Phase 10.1 public-menu fixtures. No `savora_dev` write or deployment occurred. See `docs/phase10.2/README.md`.
- **Phase 10.3:** Savora Café adds a warm cream/mocha/caramel storefront with dedicated navigation, home, menu, product, about and footer presentation. It uses the shared tenant cart, Menu interactions and persisted guest checkout. Platform Admin can create or change a Restaurant to Café through the existing guarded and audited controls; Classic remains the legacy default and Luxury was unavailable at that milestone. Under Node 24.22.1, 143 backend offline and 70 frontend tests, TypeScript, ESLint and a Next.js Webpack build passed. Guarded `savora_test` public-menu tests passed 7/7, Admin API 1/1 and real Admin browser E2E 1/1 with exact fixture teardown. Chrome CDP checked Café, Classic and Aqua at 1440/768/390/375 as applicable, including populated Café Cart/Checkout without an Order POST. No `savora_dev` write or deployment occurred. See `docs/phase10.3/README.md`.
- **Phase 10.4 complete:** Savora Luxury is a light editorial storefront with real Restaurant/menu content, image fallback, dedicated public slots and the shared Cart/Checkout. Classic, Aqua, Café and Luxury have fixed, scoped palettes in `frontend/src/app/globals.css`; the Classic storefront appearance toggle was removed while dashboard appearance controls remain. Platform Admin creation/assignment accepts Luxury through the guarded, audited route; Owner Settings remains unchanged. Under Node 24.22.1, 143 backend offline tests, 74 frontend tests, TypeScript, ESLint and a Next.js Webpack build passed. Read-only browser checks covered Luxury desktop/tablet/mobile English/Arabic, populated Cart, quantity and Checkout validation, plus Classic/Aqua/Café desktop/mobile and menu/product routes without overflow. After an earlier Atlas connectivity blocker cleared, guarded `savora_test` Platform Admin integration passed 1/1 and public-menu integration passed 7/7 in separate runs. The Admin test's stale final audit count was replaced by checks of all seven specific events, including legitimate reactivation; no application service changed. Exact fixture teardown passed, and a separate read-only audit found zero test-owned platform/public Restaurants, platform Admins/Owners and creation audits, and public Categories/Products. No `savora_dev` write or deployment occurred. See `docs/phase10.4/README.md`.
- **Not yet done:** Production environment selection, index inspection/rollout, shared production rate limiting, SEO review of streamed not-found HTTP status, image-upload/provider decisions, production smoke testing, and deployment.

**Progress truthfulness:** Update this section only after a milestone actually passes, not merely after planning it. Do not turn this file into a running chat transcript.

## 9. Deliverable format after every Codex task

Provide a concise report with:

1. **What was implemented** (and what was deliberately left out).
2. **Files created/modified** with their purpose.
3. **Design decisions/assumptions**, especially frontend compatibility and tenant security.
4. **Tests run:** exact commands, actual Node version/path, pass/fail numbers. State if MongoDB integration was not tested.
5. **Frontend status:** unchanged, or precisely what changed when permitted.
6. **Risks or follow-up items** requiring review.
7. **Stop**; do not auto-implement the next feature.

## 10. Collaboration and learning style

- Explain important architecture decisions and non-obvious code in **Egyptian Arabic**, keeping technical names, identifiers, and code in **English**.
- Prefer small reviewable tasks, not one prompt to build the whole backend.
- Be candid when the user proposes an insecure or unnecessarily complex design; explain the trade-offs and recommend a maintainable MVP solution.
- Treat code generation as a way to accelerate learning: describe the rationale, not only the resulting code.
- Do not commit, push, deploy, change the operating system, or perform destructive data operations unless the user explicitly requests that action.
