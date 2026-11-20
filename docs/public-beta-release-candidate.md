# Savora public beta release procedure

Release source is `codex/savora-staging-preview`. The starting Staging commit was `e3690a7488da6ff030965bf09e0a90f4d1f77ebf`. The first public beta is for browsing. Leave order creation and media uploads disabled.

## Production prerequisites

Vercel metadata for the `food-delivery` project shows all four required variables scoped to Production, plus separate Preview URI and trusted-Origin entries scoped to the Staging branch. The Production values are sensitive. Verify their behavior on the staged Production build before admitting public traffic.

| Production setting | Expected |
| --- | --- |
| `MONGODB_URI` | TLS Atlas SRV URI ending in `/savora_beta`, authenticating as `savora_beta_user`. Use the existing Production Secret and approved Atlas network access. |
| `AUTH_TRUSTED_ORIGINS` | `https://food-delivery-eta-sand.vercel.app`, assuming it remains the hostname Vercel gives in `VERCEL_PROJECT_PRODUCTION_URL`. Confirm that value at release time. |
| `SAVORA_DEPLOYMENT_MODE` | `beta` |
| `SAVORA_BETA_CHECKOUT_ENABLED` | `false` |
| Runtime and system metadata | Node 24.x, `NODE_ENV=production`, `VERCEL_ENV=production`, `VERCEL_GIT_COMMIT_REF=main`, generated `VERCEL_URL`, and canonical `VERCEL_PROJECT_PRODUCTION_URL`. |
| Service routing | Keep the root `vercel.json` service binding and same-origin `/api` rewrite. Leave `NEXT_PUBLIC_SAVORA_API_BASE_URL`, `MEDIA_STORAGE_PROVIDER`, and `UPLOADS_DIR` unset in Production. |

The operator verified the nine beta collections and 19 custom indexes and reported `status: verified` with zero Orders after provisioning. The runtime checks applicable index definitions before first use and fails closed on a mismatch. Automatic index/collection creation is disabled for both Vercel entry modes. Staging is restricted to `savora_staging` and its dedicated database user. Provisioning and DDL are standalone operator commands and are absent from the Vercel build/start path.

## Public access

Project metadata shows Vercel Authentication enabled at `all_except_custom_domains`. The assigned Production domain served a static asset anonymously. The generated Staging deployment URL challenged an unauthenticated request. The minimum change for the observed configuration is to use the assigned Production domain and retain the existing protection setting. Test both the canonical public URL and an exact generated Preview URL again before promotion. Savora sessions and CSRF controls continue to govern Owner and Platform Admin endpoints. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)

## Main release after approval

1. Confirm the reviewed commit is the exact READY Staging commit and compare the complete `origin/main...origin/codex/savora-staging-preview` diff. Recheck the remote refs, Vercel project, branch mappings, and current Production domain assignment. Scan the main-bound files for secrets and exclude local reports.
2. Record the currently assigned Production deployment and verify that it is eligible for rollback. At preparation time Vercel reported `dpl_7uzTGLVTyQ58XiHLVeLpoa1Yig5s` at `68627ce4c8a85f64641ddb56a16ebeaa2b089924`. READY describes the build. Record the pre-release HTTP behavior of the actual domain as the rollback baseline.
3. With separate main-release approval, verify automatic assignment of Production domains is off before merging. Merge the approved branch through the normal review workflow. Follow the Git-triggered `main` Production build so Vercel supplies real Production branch metadata. Confirm the new READY deployment has no public Production domain assignment yet. [Manual promotion](https://vercel.com/docs/deployments/promoting-a-deployment)
4. On the protected generated URL, verify `/api/health` returns 200 and the public `savora-beta-demo` restaurant, categories, and products return the expected theme, items, and prices. Check English and Arabic and anonymous 401 responses from `/api/auth/me` and `/api/admin/auth/me` after passing Vercel Authentication. Test the checkout gate with an empty body and without a trusted Origin. Require HTTP 503 with `{"error":"Checkout unavailable"}`. An unexpected enabled gate must still reject the malformed request before any Order insert. Keep uploads disabled.
5. Promote that exact tested Production deployment and confirm the canonical domain reaches it. From an unauthenticated browser, verify the public menu, tenant cart, and Owner/Admin rejections. Confirm the generated Preview URL still requires Vercel Authentication. Record the final deployment ID, SHA, hostname, and results. Share the canonical domain with testers.

## Rollback

If the promoted build fails a release check, use Vercel Instant Rollback to the recorded previously assigned Production deployment. Verify the domain maps to it and compare the response to the recorded pre-release baseline. This rolls back traffic assignment. Keep the beta database and the disjoint environment variables in place. Vercel disables automatic Production assignment after rollback, so confirm the intended assignment behavior before the next approved promotion. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)

## Release test scope

Run `npm test` in `backend/` and `node --test test/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `npm run lint -- src test`, and `npm run build` in `frontend/`. Run `npm audit --omit=dev --fetch-retries=0` and `npm audit --fetch-retries=0` in both apps, and `git diff --check` plus `git diff --cached --check` at the root.

Use Node 24 and set `SAVORA_TEST_NO_ORDER_WRITES=1` for the release. Provide `MONGODB_TEST_URI` for an authenticated isolated `savora_test` replica set, or load it from the existing test environment. Do not run the default full integration script during this no-order release. The selected files check the model indexes, Owner sessions, tenant-scoped Categories and Products, public menu variants, and Platform Admin authorization. The separate demo integration aborts its transaction and checks each exact fixture ID.

```powershell
node --test --test-concurrency=1 integration/models.integration.js integration/provisioning.integration.js integration/auth.integration.js integration/ownerCategories.integration.js integration/ownerProducts.integration.js integration/publicMenu.integration.js integration/platformAdmin.integration.js
$env:VERCEL_ENV = 'production'
node --test --test-concurrency=1 integration/betaDemo.integration.js
```

Check the index manifest before integration tests and require zero Orders after cleanup. For browser QA use a localhost Webpack build and read-only synthetic public menu data. Cover the four themes, Arabic and English, mobile through desktop, variant availability, cart hydration and tenant separation, and Owner/Admin redirects. Keep live checkout and media uploads outside the release QA.
