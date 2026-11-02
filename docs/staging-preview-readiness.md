# Savora staging Preview readiness

## Deployment shape

The existing `food-delivery` Vercel project already has a Production deployment. The proposed Preview uses one Vercel deployment with two Services: Next.js from `frontend/` and Express from `backend/`. The top-level `/api/*` rewrite sends requests to the Express service on the same browser origin. A service binding gives server-side storefront rendering a private backend URL. `frontend/package.json` explicitly selects the Webpack build.

The Express entrypoint is `backend/src/index.js`. It accepts only Vercel `preview` requests from `codex/savora-staging-preview` under Node 24. It derives the one trusted HTTPS Origin from Vercel's immutable `VERCEL_URL`, forces Secure cookies, and reuses the existing Owner/Admin CSRF guards. It validates both the URI database path and connected database name as `savora_staging`; the URI principal must be `savora_staging_user`. Missing or mismatched configuration returns 503 before application routes are served. The normal local Express server remains `backend/src/server.js`.

## Required before a Preview deployment

1. Provision `savora_staging` in MongoDB Atlas with a dedicated `savora_staging_user` whose database privileges are limited to that database. Enable transactions and the needed Atlas network access for Vercel Functions. Do not reuse development, test, or production credentials.
2. In the existing Vercel project, store `MONGODB_URI` as a **Secret**, scoped to **Preview** and the exact `codex/savora-staging-preview` branch. The URI must end in `/savora_staging` before its optional query string and must not specify `dbName` elsewhere. Do not paste its value into chat, source, a public `NEXT_PUBLIC_*` variable, or build logs.
3. Confirm that Vercel's **Automatically expose System Environment Variables** setting is enabled; the backend requires `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, and `VERCEL_URL`, and uses `VERCEL_BRANCH_URL` for the stable Preview alias. Confirm the project's repository root setting permits the root `vercel.json` Services configuration. The Services settings in that file specify `frontend/` as the Next.js root.
4. Leave `NEXT_PUBLIC_SAVORA_API_BASE_URL` unset for Preview, so browser requests use the same origin and server-side public menu reads use `SAVORA_INTERNAL_API_URL` from the Service binding. The Express entrypoint trusts only the immutable `VERCEL_URL` and the system-provided `VERCEL_BRANCH_URL` Preview origins. If `AUTH_TRUSTED_ORIGINS` is set, every configured origin must exactly match one of those verified HTTPS origins. Avoid adding `MONGODB_TEST_URI`, `ADMIN_BOOTSTRAP_DATABASE`, or development credentials to Preview.
5. Review the complete branch diff and verify that `.env` files, the ignored local credential backup, browser profiles, and test artifacts are absent from the upload. The existing Production deployment must remain assigned to its current domains. Do not push `main`, use `--prod`, promote, or alias the Preview to a Production domain.
6. Only after the configuration checks and a successful Webpack build, deploy the branch as Preview. Confirm the returned deployment has `target: preview` before browser tests.

## Preview test plan

- Check `/api/health`, a valid public restaurant GET, and one missing tenant. Verify database readiness and no public leakage from another tenant.
- Exercise Classic, Aqua, Café, and Luxury at desktop and mobile sizes, in English and Arabic, with menu and product navigation.
- Test Owner login, `/me`, CSRF bootstrap, settings/catalog/Orders, refresh, and logout; reject a forged Origin and cross-tenant resource ID.
- Test Platform Admin login, CSRF, restaurant listing, theme assignment, suspension/reactivation, and logout with disposable staging-only fixtures.
- Submit one Direct and one WhatsApp guest order using staging-only products. Verify saved Orders and idempotent retry before WhatsApp handoff, then verify Owner delivery and delivered-value analytics. Clean up only exact disposable staging records after recording the results.

## Current verification limits

Vercel currently lists no project environment variables for this Preview branch and no deployment from this branch. The project reports Node `24.x`, but its API response does not expose the remote Root Directory or the System Environment Variables toggle. Local Node 24.22.1 Webpack build attempts both stopped during compilation with a Rust memory-allocation failure; they did not establish a successful deployable build. Offline unit checks are separate from Atlas-backed or browser Preview tests.

No Preview was deployed while staging credentials and build verification remained unavailable. No Production configuration or deployment was changed.
