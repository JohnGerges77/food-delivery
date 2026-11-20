# Public beta infrastructure preparation

For the current environment, verified synthetic seed, main approval gates, and rollback procedure, see [Savora public beta release procedure](public-beta-release-candidate.md). The notes below record the earlier implementation and its verification at that time.

Status: local code preparation only. No commit, push, main merge, deployment, Vercel setting update or beta provisioning was performed in this task. Staging remains `e3690a7488da6ff030965bf09e0a90f4d1f77ebf`.

## Recovered implementation and final behavior

The initial work already contained `betaConfig`, environment dispatch, a testable Vercel entry, DB identity checks, disabled automatic collection/index initialization, a beta checkout gate, exact checkout Origin checking and a lower instance-local limit. Continuation reviewed those changes, added explicit Production read-only index handling to the older Admin/provisioning services, and completed index-contract and read-only browsing/gate tests.

`backend/src/index.js` previously called `stagingConfig()` for every request, accepting only the designated Preview branch, staging username and staging database. It now selects beta only for Node 24, `VERCEL_ENV=production`, `NODE_ENV=production`, Git ref `main` and explicit `SAVORA_DEPLOYMENT_MODE=beta`. Other environments do not fall back to beta. Staging retains its existing exact branch/database/user checks; local `server.js` is unchanged.

Beta URI rules require `mongodb+srv`, a nonempty password, username `savora_beta_user` and exact pathname `/savora_beta`. Allowed query options are `retryWrites=true`, `w=majority`, `appName`, `authSource=admin` or `savora_beta`, and `tls=true`. Duplicate/unknown options, dbName overrides, insecure TLS options, wrong users and wrong databases fail closed. Omit optional query options if not needed; SRV uses TLS by default. The fixed username prevents accidentally selecting staging credentials; it does not prove Atlas grants or password independence. Verify these externally.

Before constructing the app or passing it a request, startup connects with `autoIndex:false`, `autoCreate:false`, pool size 5 and verifies `connection.db.databaseName`. It checks that identity on every request, including a warm connection. Driver/configuration errors return generic 503 without secret-bearing messages. Concurrent requests share connection initialization; failure can retry.

**Missing indexes block the entire beta application, including health and public reads, even while order creation is disabled.** This deliberately uses one readiness gate: auth/session/tenant uniqueness indexes are required as well as checkout indexes. Once connectivity and all declared indexes are valid, public browsing works with checkout disabled. There is no partially ready write-capable application. Staging does not gain this new full index-readiness gate.

The beta gate uses read-only `listIndexes` across Restaurant, User, Category, Product, Order, OwnerSession, PlatformAdmin, PlatformAdminSession and PlatformAudit. It compares declared keys, unique flags, partial predicates and TTL settings. It is cached for that connected database handle and repeated for a new handle; it is not continuous monitoring of external index drops. Do not change DDL while serving traffic: disable checkout, stop traffic, perform reviewed maintenance, and restart/recheck afterward.

In particular Orders require unique `{ restaurantId:1, orderNumber:1 }` and unique `{ restaurantId:1, idempotencyKeyHash:1 }` with `partialFilterExpression: { idempotencyKeyHash: { $type:'string' } }`. Missing, nonunique or differently filtered indexes fail readiness. Other declared indexes must also match. Unexpected additional indexes require operator review; this checker validates declared requirements, not every possible Atlas configuration.

The older explicit `createIndexes()` calls in Admin creation/status changes and provisioning/bootstrap now use `ensureModelIndexes`: under `VERCEL_ENV=production`, they inspect only and fail if indexes differ. Local explicit setup retains its previous behavior. Runtime must use a dedicated restricted user; never run a provisioning CLI against beta without the Production read-only-index setting and separate approval. No automatic migration, syncIndexes, drop or collection-creation command was added.

## Exact Vercel configuration contract

Configure only after secure credential/hostname review. No real values were set in this task.

| Name | Scope / source | Required value or handling |
| --- | --- | --- |
| `MONGODB_URI` | Backend, Production Secret only | Atlas-generated URI for the dedicated beta user and exact beta database. Never use a `NEXT_PUBLIC_` key or copy Preview credentials. |
| `SAVORA_DEPLOYMENT_MODE` | Backend, Production Config | `beta`. Preview may remain unset (existing staging behavior), or use `staging`. |
| `AUTH_TRUSTED_ORIGINS` | Backend, Production Config | Exactly `https://` followed by `VERCEL_PROJECT_PRODUCTION_URL`, no slash, wildcard or comma list. One canonical public hostname in this beta. |
| `SAVORA_BETA_CHECKOUT_ENABLED` | Backend, Production Config | Omit or `false` while preparing/reviewing. Only literal `true` enables Orders after release gates. Invalid values reject startup. |
| `VERCEL_ENV` | Vercel system env | Must be `production` for beta; never spoof it in Preview. |
| `VERCEL_GIT_COMMIT_REF` | Vercel system env | Must be `main`; Production Git deployments need system environment variables exposed. |
| `VERCEL_URL` | Vercel system env | Generated deployment hostname without protocol. That exact HTTPS origin is additionally trusted for protected pre-promotion testing. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Vercel system env | Canonical Production hostname without protocol/path. Confirm the actual value before configuring trusted origins. |
| `NODE_ENV` | Framework/runtime | `production`; Node runtime must be `24.x`. Do not set development to bypass guards. |
| `SAVORA_INTERNAL_API_URL` | Frontend server, Vercel service binding | Keep the existing backend URL binding in root `vercel.json`; do not manually point it at staging. |
| `NEXT_PUBLIC_SAVORA_API_BASE_URL` | Production | Leave unset. Browsers use same-origin `/api`; SSR uses the internal backend binding. |
| `MEDIA_STORAGE_PROVIDER`, `UPLOADS_DIR` | Production | Leave unset; persistent uploads are explicitly rejected. No Vercel Blob. |

No JWT/session-signing secret is required by this implementation. Owner/Admin authentication uses Argon2id password hashes, random 32-byte opaque session and CSRF tokens, and SHA-256 hashes stored in separate session collections. Cookies are host-only, Secure, SameSite=Lax, `/api` scoped; session cookies are HttpOnly. Owner/Admin cookie namespaces and authorization contexts remain separate. Owner mutations require trusted Origin and session CSRF. Public guest checkout remains unauthenticated but server-resolves its restaurant and verifies product/variant ownership, availability, authoritative prices and idempotency.

`PORT`, `TRUST_PROXY_HOPS`, `MONGODB_TEST_URI`, development provisioning and Admin bootstrap variables are not Vercel Production request-runtime requirements. Do not copy a local `.env` wholesale. Vercel entry keeps `trust proxy` at 0; review the platform client-IP contract before changing it. Current req.ip limits can group users behind a proxy and are not a reliable per-person quota.

## Atlas setup — separate authorization required

1. In the selected Atlas project/cluster, confirm replica-set transactions are supported and billing is approved. Use an empty `savora_beta` namespace. Do not rename, clone, export or import staging/dev/test/customer data. MongoDB creates a database with its first collection, so empty namespace/collection provisioning belongs to the reviewed DDL step below.
2. Create a fresh SCRAM database user named `savora_beta_user`, with an independently generated password stored securely. Prefer an Atlas custom runtime role scoped to `savora_beta` only, with data CRUD and `listCollections`/`listIndexes` permissions, no cross-database or cluster administration, collection/index DDL or drop actions. Verify actual operations on isolated synthetic records after authorization. A dedicated database-scoped `readWrite` role is broader because it includes DDL; document/review that tradeoff if used instead.
3. Use a separate temporary provisioning principal scoped only to beta for reviewed collection/index creation. Do not put provisioning credentials in Vercel. Review the complete declared index manifest from the nine models, names/options, TTL deletion consequences, uniqueness and existing duplicate conflicts before applying it. Precreate required collections; never use `syncIndexes` or drop/rebuild indexes blindly. Disable/remove the provisioning principal afterward.
4. Restrict Atlas Network Access to reviewed egress addresses or approved private connectivity; retain TLS certificate validation. Do not add `0.0.0.0/0`. If suitable Vercel egress/private networking is unavailable on the current plan, network access remains a configuration blocker; no paid service is approved by this task.
5. Obtain the URI from Atlas, select the beta database explicitly, percent-encode credentials correctly, review allowed options, and store it through Vercel Production Secret settings. Do not paste it into chat, docs, command arguments or logs. Verify the effective database and grants, including denial on staging/dev/test, with an operator-approved read-only access audit.
6. Read-only index verification uses the existing CLI: securely provide `MONGODB_INDEX_CHECK_URI` and `MONGODB_INDEX_CHECK_DATABASE=savora_beta`, then run `npm run indexes:check` from backend under Node 24. Never run this against another environment accidentally. A nonzero result is a release gate, not permission to auto-fix DDL.

## Beta order safety

Order creation is off by default in Production beta. Both Direct and WhatsApp requests are stopped before body parsing/order persistence. Menu reads are independent of the feature flag once global runtime readiness passes. Enabled Orders require the exact configured public or generated deployment Origin and are limited to 10 attempts/minute per req.ip+slug per instance. Existing staging/local limits remain 60/minute. Missing/untrusted Origin is denied in beta; browser Origin checking reduces cross-site abuse but is forgeable by non-browser clients and is not authentication.

Maps are neither distributed nor durable and reset on cold starts. Multi-instance attackers can exceed these limits. Idempotency suppresses retries with the same key, not spam with new keys. Before enabling Orders, review platform WAF/bot/request-rate controls and budget/observability with current plan limits; no new paid service or shared store was introduced. For a browsing-only beta, keep the order gate off. For controlled ordering, approve synthetic test volume, watch request/error counts and saved-order growth, and disable the flag/redeploy if abuse appears. Changing Vercel env affects new deployments, not already running ones.

## Public access and release sequence (not executed)

1. Review local code/tests and the eventual diff into main. Provision beta credentials, network access, collections and reviewed indexes separately. Approve synthetic restaurant/menu records and controlled Owner/Admin accounts; never copy real identities, sessions or orders. Existing interactive Admin bootstrap/provisioning requires an operator-controlled secure process and hash utilities, never plaintext passwords in seed files. Review/verify indexes before those writes.
2. Configure Production-only variables above with checkout off. Leave Preview secrets branch-scoped and protection enabled. Root routing keeps `/api/*` on backend and all other paths on frontend. Confirm frontend SSR binding targets that same deployment's backend.
3. With release authorization, preserve rollback references, merge reviewed changes into main and stage the Production build without assigning public domains. Verify the Git-ref system value is `main`; do not use a source-less deployment that omits it.
4. Use authenticated access to that generated URL: health 200, expected public menu DTOs, Owner/Admin login-refresh-logout, cross-tenant denial, exact Origin/CSRF denial, and both checkout methods disabled. These session tests write only approved synthetic beta records after separate authorization.
5. Current Vercel scope is `all_except_custom_domains`. Standard Protection already permits Production domains while protecting Preview/generated deployment URLs. The minimum change can be **no protection change at all**: use the assigned Production domain. Confirm its classification and test without Vercel cookies; do not disable protection project-wide or add a Preview exception. If settings differ at release time, retain Standard Protection for Preview and restrict any adjustment to the intended Production domain after readiness passes. [Vercel documentation](https://vercel.com/docs/deployment-protection).
6. Promote only after protected runtime checks. In a fresh unauthenticated browser verify public Production menu/theme/language/cart and that Owner/Admin data endpoints remain 401 without app sessions. Keep generated deployment URLs and Preview gated. No global auth bypass links should be distributed to testers.
7. Enable `SAVORA_BETA_CHECKOUT_ENABLED=true` only after index verification, synthetic end-to-end order validation approval, abuse safeguards and account/tenant checks pass. Rebuild/redeploy with explicit authorization, then perform controlled Direct/WhatsApp tests. WhatsApp handoff must follow saved order confirmation and never send automatically. Keep it false for browsing-only release.
8. Record exact deployed SHA, deployment ID, canonical domain and health results. Rollback currently references Production `dpl_7uzTGLVTyQ58XiHLVeLpoa1Yig5s` / main `68627ce4c8a85f64641ddb56a16ebeaa2b089924`. Validate refs again before release. Rollback application traffic does not reverse database writes; preserve beta data and never redirect it to staging. Prefer a healthy beta build with checkout off over the outdated main for operational fallback, after testing it. Manage Vercel auto-promotion explicitly after rollback.

## Verification record

See the final report for the final run totals. Guard tests use synthetic URI strings and stub connections; they do not prove Atlas connectivity, actual grants, real TLS negotiation, deployed service bindings or live beta index state. The earlier isolated `savora_test` auth/checkout/tenant run completed 26/26 including exact fixture cleanup before the continuation restriction; no new integration writes were started afterward. No staging, development or beta records were changed. Existing local `.env.example` edits and batch01 artifacts are outside this task and preserved.

Live configuration reinspection found only branch-scoped Preview `MONGODB_URI` and `AUTH_TRUSTED_ORIGINS`, no Production variables and no hidden Production envs. SSO remains `all_except_custom_domains`; Node is 24.x. No real beta credentials, grants/network audit, index manifest approval, synthetic seed approval or live beta verification is available yet.

Final verification on 2026-11-17 used Node **v24.22.3**, executable `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; its directory was prepended only to the current command process PATH, not system settings.

| Working directory | Exact command (Node 24 on command PATH) | Result |
| --- | --- | --- |
| backend | `npm test` | 173/173 passed, including beta guards, missing credentials, warm/wrong DB rejection, origin/gate checks, exact Order idempotency index options and read-only Production setup. |
| frontend | `node --test test/*.test.mjs` | 103/103 passed, including auth, Cart, Checkout and variants. |
| frontend | `npm run lint -- src test` | Passed; local Chrome profile directories are outside the source scope. |
| frontend | `node node_modules/typescript/bin/tsc --noEmit` | Passed. |
| frontend | `npm run build` | Webpack production build passed. No frontend source files changed. |
| backend / frontend | `npm audit --omit=dev` | Both returned zero vulnerabilities. Network-enabled audit only; no package upgrades. |
| repository | `git diff --check` | Passed. |
| backend | `node --env-file=.env --test --test-concurrency=1 integration/tenant.integration.js integration/auth.integration.js integration/guestCheckout.integration.js` | Earlier authorized isolated run: 26/26 passed, including real server-authoritative variants/prices/idempotency and tenant/session checks; exact fixture teardown completed. Final continuation additions were verified offline; integration was not rerun after them under the newer no-data-change restriction. |

Backend has no existing ESLint config/script. Additional lint used the frontend's installed ESLint without adding dependencies:

`node frontend/node_modules/eslint/bin/eslint.js --no-config-lookup --rule 'no-unreachable:error' --rule 'no-dupe-args:error' --rule 'no-dupe-keys:error' --rule 'no-constant-binary-expression:error' backend/src backend/test`

That broad command failed on one pre-existing, deliberately disabled Blob migration CLI (`backend/src/cli/migrate-blob-to-disk.js`, unconditional throw before retained future code). The failure is recorded, not fixed or presented as passing. The same check with `--ignore-pattern backend/src/cli/migrate-blob-to-disk.js` passed on all other backend source/test files, including every file changed here. The disabled CLI was left untouched and no Blob support enabled. This is a selected-rule backend lint pass, not an assertion of an unconfigured full recommended ruleset.

The initial 12/12 beta+staging run preceded index-gate completion. Current complete offline backend total is 173, superseding that checkpoint. Frontend emits the existing MODULE_TYPELESS_PACKAGE_JSON warning; it is nonfatal. No test failure remains in the changed code. Atlas/Production integration and live public beta verification remain pending external configuration.

Review artifact: `docs/public-beta-index-manifest.json` was generated offline from the nine model schemas. It lists the exact collections and declared index keys/options for the separately authorized operator to review. It contains no tenant documents or credentials and executed no DDL. Preprovision those collections and approved declared indexes only on `savora_beta`, verify via the read-only CLI, then retire the DDL principal. Do not treat the artifact itself as authorization to apply changes.
