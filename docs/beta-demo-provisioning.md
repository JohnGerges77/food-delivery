# Savora public beta demo provisioning

Target `savora_beta` as the Atlas database user `savora_beta_user`. The operator reported a complete bootstrap and synthetic seed, followed by independent `status: verified` with zero Orders. Keep this procedure as an operator reference. Follow the [release procedure](public-beta-release-candidate.md) for the already seeded database.

## Demo records

`savora-beta-demo` is the public slug for **Savora Beta Demo Kitchen**, a labeled fictional restaurant. The storefront uses `savora-classic` and EGP. Delivery is unavailable. The restaurant has no public address, phone, email, WhatsApp number, or uploaded media.

| Category | Product | Price in EGP | Preparation |
| --- | --- | --- | --- |
| Pizza | Pizza Margherita | Small 150, Medium 200, Large 270 | 18 minutes |
| Burgers | Cheese Burger | Single 150, Double 210 | 14 minutes |
| Sides | French Fries | 60, no variants | 8 minutes |

The committed dataset also includes one Platform Admin, one active Owner tied to the restaurant, and the platform service's `restaurant.created` audit event. The verified dataset has zero Orders and zero persisted login sessions.

## Run locally

Use an interactive PowerShell terminal on an operator machine allowed by Atlas Network Access. Keep application writers and other provisioning processes disconnected from beta during preflight, apply, and verification. The command rechecks emptiness inside the transaction and simultaneous demo applies contend on the existing unique Admin bootstrap slot. Administrative exclusivity is still necessary to prevent unrelated writers from adding records between checks.

```powershell
Set-Location -LiteralPath 'C:\Users\EL-B\my Projects\food-delevery\backend'
$savoraNode24 = 'C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $savoraNode24 -p "process.version + ' ' + process.execPath"
& $savoraNode24 src/cli/provision-beta-demo.js plan
& $savoraNode24 src/cli/provision-beta-demo.js preflight
```

Use the local Node 24 executable if its path differs. The `plan` command is offline. The read-only `preflight` prompts for the TLS Atlas SRV URI with the `/savora_beta` path. Provide it at the hidden prompt. The program uses process memory for the input and ignores `.env` and the caller's MongoDB environment variables. Require exit code 0 and `status: preflight-passed` before continuing.

```powershell
& $savoraNode24 src/cli/provision-beta-demo.js apply
```

The apply command runs preflight, prints the redacted plan, and prompts privately for the Platform Admin and Owner email addresses. Use operator-controlled addresses and two distinct generated passwords of 16–128 characters. Confirm each password. After reviewing the plan, type `savora_beta` at the final prompt.

The command reconnects and verifies the effective database, the authenticated principal, and the full collection/index manifest. It creates the Admin using the existing one-admin bootstrap and Argon2id, and the restaurant and Owner through the audited Platform Admin service. It uses the normal authenticated Owner context and validations for delivery settings and catalog creation. The temporary Owner session is revoked in the same transaction. A successful commit is followed by read-only verification on a fresh connection. Require exit code 0 and final `status: verified`.

```powershell
& $savoraNode24 src/cli/provision-beta-demo.js verify
```

Use `verify` for an independent recheck or after an interrupted apply. It checks the namespace, actual authentication, indexes, exact collection counts, account roles and tenant relationship, the creation audit, and the real public menu service's output for both variant and ordinary products. It issues no checkout requests. Share only the redacted output; retain credentials in the operator's password manager.

If preflight fails on credentials or connectivity, verify the Atlas access list, the selected cluster, the user, and the exact database path before trying `preflight` again. A collection/index mismatch requires a separate review of the Atlas bootstrap against the approved manifest. If apply is interrupted, run `verify` first. If it succeeds, the seed is complete. If verify fails and `preflight` confirms a healthy empty namespace, apply can be retried. If records exist and verification fails, preserve the records and investigate before retrying. The command performs no DDL or cleanup of existing beta data.

## Production handoff

After verification and separate release approval, use **Project Settings → Environment Variables** in Vercel. Select **Production** for the following backend settings. [Vercel environment variables](https://vercel.com/docs/environment-variables) · [Secret and Config types](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types)

| Setting | Production configuration |
| --- | --- |
| `MONGODB_URI` | Enter the dedicated Atlas beta URI directly in Vercel as a **Secret**. Keep it server-side. Use the operator's password manager and the established beta-only Atlas user. |
| `AUTH_TRUSTED_ORIGINS` | Add as **Config** with the exact `https://<VERCEL_PROJECT_PRODUCTION_URL>` origin. Use one hostname without a path, trailing slash, or wildcard. |
| `SAVORA_DEPLOYMENT_MODE` | Add as **Config** with value `beta`. |
| `SAVORA_BETA_CHECKOUT_ENABLED` | Add as **Config** with value `false`. It gates both Direct and WhatsApp submission. |
| System environment and runtime | Expose Vercel system variables. The backend requires `VERCEL_ENV=production`, `VERCEL_GIT_COMMIT_REF=main`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV=production`, and Node 24.x. Use the real deployment metadata. |
| `SAVORA_INTERNAL_API_URL` | Keep the frontend server binding to the backend from root `vercel.json`. Browser API requests use the site's same-origin `/api` rewrite. |
| Values to leave unset | `NEXT_PUBLIC_SAVORA_API_BASE_URL`, `MEDIA_STORAGE_PROVIDER`, and `UPLOADS_DIR`. Bootstrap, test, and development credentials stay out of Production. The existing opaque-session implementation needs no JWT secret. |

Confirm the hostnames before entering `AUTH_TRUSTED_ORIGINS`. Vercel system values are inferred from the deployment. Production environment changes apply to subsequent deployments. [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)

For external testers, use the canonical Production domain. Under Vercel Standard Protection, the Production domain can be public while Preview and generated deployment URLs stay protected. Verify current project scope before promotion and validate the public route with a fresh browser session. Owner and Admin routes still use Savora authentication. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)

With a separate release authorization, review the release diff from `e3690a7488da6ff030965bf09e0a90f4d1f77ebf`, record the rollback deployment, then merge and create the Production deployment. Before promotion, verify health, the English and Arabic storefronts for `savora-beta-demo`, the variant and ordinary-product price display, guest denial on dashboard APIs, and the disabled checkout and upload gates. Approved account sign-in tests can create temporary sessions, so run them only after the seed verification has completed. After promotion, verify the canonical URL without Vercel cookies and share that URL with testers.

## Regression commands

Run with Node 24. The integration commands use `MONGODB_TEST_URI` from the existing local test setup and have `savora_test` namespace guards. Use a fresh terminal for the transaction test's process-local `VERCEL_ENV` setting. That test exercises the actual provisioning services and then intentionally aborts, checking every captured fixture ID on a separate connection.

The run used Node **v24.22.3**, executable `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. The two npm audits completed with network access and found zero production dependency vulnerabilities.

| Working directory | Command |
| --- | --- |
| backend | `npm test` |
| backend | `node --env-file=.env --test --test-concurrency=1 integration/provisioning.integration.js integration/auth.integration.js integration/tenant.integration.js integration/ownerProducts.integration.js integration/publicMenu.integration.js` |
| backend | `node --env-file=.env --test --test-concurrency=1 integration/ownerProducts.integration.js` |
| backend | `$env:VERCEL_ENV = 'production'; node --env-file=.env --test --test-concurrency=1 integration/betaDemo.integration.js` |
| frontend | `node --test test/*.test.mjs` |
| frontend | `node node_modules/typescript/bin/tsc --noEmit` |
| frontend | `npm run lint -- src test` |
| frontend | `npm run build` |
| backend and frontend | `npm audit --omit=dev --fetch-retries=0` |
| repository | `git diff --check` |

The backend has no project ESLint configuration. The changed backend source and test files were checked with the following targeted rules from the installed frontend ESLint.

```powershell
node frontend/node_modules/eslint/bin/eslint.js --no-config-lookup `
  --rule 'no-unreachable:error' --rule 'no-dupe-args:error' `
  --rule 'no-dupe-keys:error' --rule 'no-constant-binary-expression:error' `
  backend/src/cli/provision-beta-demo.js backend/src/cli/beta-bootstrap-dry-run.js `
  backend/src/cli/check-indexes.js backend/src/services/platformAdminAuth.js `
  backend/src/services/platformRestaurants.js backend/src/services/ownerAuth.js `
  backend/src/services/ownerCategories.js backend/src/services/ownerProducts.js `
  backend/src/services/restaurantSettings.js backend/test/betaDemo.test.js `
  backend/integration/betaDemo.integration.js backend/integration/ownerProducts.integration.js
```

The final offline run passed **182 backend** and **103 frontend** tests. TypeScript, frontend ESLint, targeted backend ESLint, the Webpack build, and `git diff --check` passed. The frontend source tree had no changes.

Atlas `connectionStatus` confirmed the effective test identity `savora_test_user` on `savora_test`. The initial restricted network attempt hit DNS SRV timeouts. With network access, the five-file run passed 41 of 43 checks. The Owner Product test still expected the response before variants were introduced. Its expectation was corrected to require `variants: []` for an ordinary Product, and the entire file passed 11 of 11 on rerun. The four other files passed 32 of 32 in the five-file run. The separate rollback and exact-ID verification passed 1 of 1. Together the isolated runs covered 44 passing checks.

The regression run documented above performed no beta operations. The operator subsequently performed and verified the live seed.
