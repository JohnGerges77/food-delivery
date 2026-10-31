# Savora full-stack readiness through Phase 9

**Status: functionally ready for deployment planning.** This is a local and guarded `savora_test` result, not approval to serve production traffic. See [Phase 8.8 test evidence](fullstack-test-report.md), [Phase 9 test evidence](platform-admin-test-report.md), and the [pre-deployment checklist](pre-deployment-checklist.md).

## Phase 9 addition

A separate Platform Admin identity and session now support operator-only login at `/en/admin` and `/ar/admin`. The Admin can see real Restaurant counts, search and page through tenants, inspect the initial Owner summary, create a Restaurant and its Owner in one audited MongoDB transaction, and suspend or reactivate a tenant. Existing Owners cannot enter the Admin interface or authorize its APIs. Suspension blocks public menu reads and new Checkout, Owner login and existing Owner sessions; historical records remain intact. Legacy Restaurants without a status remain active. The first Admin is created only by an explicit guarded interactive CLI; no Admin account was created in `savora_dev` during Phase 9.

Phase 9 verification passed 141 backend offline tests, 67 frontend tests, 78 guarded API integration tests across separate runs, one real isolated Admin browser E2E, TypeScript, ESLint and a Webpack production build. The browser journey verified role and tenant isolation, suspension/reactivation and exact fixture cleanup. See the [architecture](platform-admin-architecture.md), [API](platform-admin-api.md), [operator guide](platform-admin-user-guide.md), and [verification record](platform-admin-test-report.md).

## Verified product behavior

- The original Savora storefront, owner dashboard, animations, SVG charts, and English typography remain. Arabic routes use the locally installed Tajawal font.
- Guest checkout persists a direct or WhatsApp Order before showing success or opening a handoff. WhatsApp opening does not confirm message delivery or payment.
- The owner can move a pending or historical nonterminal Order directly to `delivered` or `cancelled`. Both are terminal. Stored `preparing`, `ready`, and `out-for-delivery` values remain intact and appear in the Pending operational group.
- Analytics use Pending, Delivered, and Cancelled groups. Delivered Order Value and delivered product rankings use only delivered Orders and their `deliveredAt` time. These figures measure operations, not collected payments.
- A real browser journey on `savora_test` saved an Order, showed it in Owner Orders, delivered it, and displayed **EGP 17.50** in Overview. It also saved Settings, created a Category and Product, restored the session after navigation, logged out, and verified a second owner could not see the first tenant's Order.

## Security boundary

Owner APIs use a verified server-side session and tenant scope, with exact trusted-Origin and session CSRF checks for mutations. The session cookie is HttpOnly and API scoped; the frontend does not store it in local storage. Public menu and checkout resolve an active restaurant slug and never accept browser prices or tenant IDs as authoritative. Backend integration tests cover cross-tenant denial, malformed inputs, idempotency, and terminal Order transitions. The real browser test allowed API requests only to its isolated `localhost:5101` Express server and connected through a guarded `savora_test_user` URI targeting `/savora_test`. No automated request or write was directed to `savora_dev`.

## Open limitations

| Severity | Finding | Planning action |
| --- | --- | --- |
| Medium | Two tested invalid public routes returned HTTP 200 while rendering a noindex not-found page. | Review Next streamed 404 semantics and SEO requirements before public indexing. |
| Low | Public search covers loaded menu entries and the product lookup is bounded. | Define large-catalog search and pagination requirements if tenants exceed current bounds. |
| Low | Cart and unsent form state are in memory across hard refreshes; checkout retry metadata is session scoped. | Decide whether persistence is needed after observing usage. |
| Operational | The default Turbopack build exhausted this host's worker memory; the Webpack production build passed. Atlas connections intermittently timed out during read-only audits, then succeeded on retry. | Size build infrastructure and validate network/Atlas access during deployment planning. |

No verified functional blocker remains in the requested local end-to-end path. Production prerequisites are listed separately; image uploading and an image hosting provider are intentionally undecided for Phase 8.8. No deployment was performed.
