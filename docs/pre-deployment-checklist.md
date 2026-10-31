# Savora pre-deployment checklist

Phases 8.8 and 9 finished functional integration and guarded local testing. These items are for the separate deployment-planning phase; none was implemented here.

## Environment and startup

- [ ] Select a deployment topology and verified same-site HTTPS hostnames for the dashboard and API. Confirm the session cookie, trusted `Origin`, CORS and CSRF bootstrap behavior on those exact hosts. Do not assume a same-origin `/api` proxy works without testing the cookie and Origin contract.
- [ ] Use Node 24 LTS and lockfile installs in both `backend/` and `frontend/`. Keep secrets in deployment secret storage, never `NEXT_PUBLIC_*` variables. Set backend `MONGODB_URI`, `AUTH_TRUSTED_ORIGINS`, `NODE_ENV=production`, `PORT`, and reviewed `TRUST_PROXY_HOPS`; set the frontend's browser-visible `NEXT_PUBLIC_SAVORA_API_BASE_URL` before building.
- [ ] Ensure the MongoDB target is a replica set supporting transactions. Restrict network access and credentials to the intended environment. Back up and verify a restore procedure.
- [ ] Run `npm run indexes:check` read-only against the exact production database with `MONGODB_INDEX_CHECK_URI` and `MONGODB_INDEX_CHECK_DATABASE`. Inspect duplicates and conflicting indexes, then plan any required index rollout separately. Do not run `syncIndexes()` or drop indexes automatically.
- [ ] Inspect and roll out the PlatformAdmin unique email/bootstrap slot, PlatformAdminSession token/TTL, and PlatformAudit indexes before privileged production use. Review the first Admin bootstrap target and run the interactive CLI only with approved credentials and a verified Node 24 executable; never put its password in a command argument or environment file.
- [ ] Configure HTTPS redirects, HSTS, secure cookies, a private backend ingress, process supervision, health/readiness checks, log redaction, metrics and alerts.
- [ ] Provide shared edge/API rate limiting for login and guest checkout. The current in-process throttles are insufficient across multiple production instances. Review proxy hop count and real-client IP handling.
- [ ] Include Admin login and tenant creation in shared rate limiting and monitoring. Validate Admin and Owner cookies, CORS, trusted Origin, CSRF and logout on the exact production hostnames; keep the Admin bootstrap route absent.
- [ ] Review development dependency advisories and build resource limits; the Webpack build is verified on this host, while default Turbopack exhausted worker memory.
- [ ] Plan production smoke tests with approved disposable fixtures, including Direct and WhatsApp persistence, idempotent retry, owner login/CSRF, tenant isolation, Order delivery, analytics and cleanup. Never reuse `savora_test` credentials or run the development provisioning CLI against production.
- [ ] Plan a privileged production smoke test with approved disposable Restaurant/Owner fixtures for Admin login, atomic creation, listing, suspension, Owner/public denial, reactivation, audit and exact cleanup. Review secure delivery of the initial Owner password; password reset and invitation delivery are not part of Phase 9.
- [ ] Resolve the public invalid-route HTTP 200/noindex behavior according to SEO requirements before indexing. Decide whether the current bounded search and catalog limits fit expected tenants.
- [ ] Decide image upload/storage requirements in a future phase; no provider has been selected and uploading was not implemented in Phase 8.8.

## Local startup reference

For normal development, copy `backend/.env.example` to a local ignored `backend/.env` and provide the intended development MongoDB URI and exact `AUTH_TRUSTED_ORIGINS=http://localhost:3000`. Copy `frontend/.env.example` to ignored `frontend/.env.local`, set `NEXT_PUBLIC_SAVORA_API_BASE_URL=http://localhost:5000`, and optionally set `NEXT_PUBLIC_SAVORA_DEV_RESTAURANT_SLUG` for local legacy routes. Use the same hostname (`localhost`) for browser and API cookie behavior. These are startup instructions, not authorization to write development data.

With Node 24 selected, run `npm run dev` in `backend/` and `npm run dev` in `frontend/` in separate terminals. Backend startup requires a reachable MongoDB and trusted origins before it listens; `GET http://localhost:5000/api/health` indicates database readiness. The frontend defaults to `http://localhost:3000`. For a production-like local check, run the verified `next build --webpack` and `next start` from `frontend/` with the intended browser-visible API origin set at build time. See [the full-stack test command](fullstack-test-report.md#real-browser-e2e-reproduction) for the separate guarded `savora_test` setup; do not point it at development data.

## Decision gate

Phase 9 is **functionally ready for deployment planning** after 141 backend offline tests, 67 frontend tests, 78 guarded API integration tests across separate runs, 1 real Admin browser E2E, TypeScript, ESLint, Webpack build, visual checks and exact fixture cleanup described in the [Phase 9 test report](platform-admin-test-report.md). The earlier [Phase 8.8 full-stack journey](fullstack-test-report.md) also passed. Production launch remains subject to the environment-specific work above. No deployment or image-provider choice occurred in Phase 9.
