# Guest cart persistence

The browser stores one version 2 cart per restaurant slug in `localStorage`, with a 30-day lifetime from the last cart change. It contains product and optional variant IDs, quantities and display snapshots; checkout contact details and credentials are not saved. Display prices are estimates: the server still validates products, variants, availability and authoritative prices when an order is submitted. Expired, incompatible or malformed carts are not restored. A cart remains usable in memory if browser storage fails, but persistence cannot be guaranteed in that case.

The old `savora-cart-v1` session entry is imported only if its version, exact tenant slug and all lines are valid and no persistent cart or migration marker exists. The old entry is removed only after the persistent write succeeds. A per-tenant marker prevents an old session in another tab from resurrecting a cleared cart. An unknown future persistent version is never replaced by migration. Clearing removes that tenant's cart contents and its matching legacy entry; it leaves other tenants alone.

Tabs listen for localStorage events for cached restaurants, validate incoming data and ignore obsolete events. localStorage has no atomic read-modify-write: simultaneous edits may overwrite one another (last completed write wins). Failed or blocked writes may leave an older persisted cart behind, including after checkout, so a browser with unavailable storage cannot promise durable cleanup. A successful checkout clears only the unchanged cart for the submitted tenant; failure retains it. Orders remain server-persisted before WhatsApp handoff.

Verification on 2026-11-17 used Node v24.22.3 at `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`:
- Backend `npm test`: 160/160 passed (offline, no MongoDB integration).
- Frontend `node --test test/*.test.mjs`: 103/103 passed, including Checkout, variants, migration, expiry, corruption, quota fallback and storage-event tests.
- `npm run lint -- src test` and `node node_modules/typescript/bin/tsc --noEmit`: passed. Source-scoped lint deliberately excludes unrelated local Chrome profiles.
- `npm run build`: Webpack production build passed.
- `git diff --check`: passed.
- Both production-only `npm audit --omit=dev` audits returned zero vulnerabilities in the preceding local verification.
- `node frontend/test/cart-persistence.browser.mjs` from the repository root passed with real Chrome after sandboxed Chrome disconnected during navigation. The successful run used a new temporary profile, fully closed the browser process, reopened the same profile, and verified a UI-added variant and quantity, EN/AR navigation, two independent restaurant carts, unavailable variant controls, intercepted checkout failure retention/success cleanup and corrupted storage. Menu APIs were synthetic; all checkout POSTs were intercepted. No database write occurred. This is browser persistence evidence, not proof of live order persistence.

Pending release QA includes real beta database checkout/authentication and public Production access after the beta configuration gates are satisfied. Simultaneous multi-tab writes remain last-write-wins. Full browser testing of quota denial and cross-tab events is not claimed; those paths have automated store tests.
