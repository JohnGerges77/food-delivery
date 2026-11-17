# Public beta release gate — 2026-11-17

Production was not merged, deployed, made public, or connected to any existing database.

Read-only Vercel inspection of project `food-delivery` (`prj_yBnQ8SGsHUkiwLNi44Ex9gBemfSu`, team `team_qLJ2OW8OFT6uv36du7hu26uD`) confirmed:
- Environment metadata has only branch-scoped Preview `MONGODB_URI` and `AUTH_TRUSTED_ORIGINS`; no Production variables and zero hidden Production variables. Secret values were not retrieved.
- Latest Production: READY `dpl_7uzTGLVTyQ58XiHLVeLpoa1Yig5s`, commit `68627ce4c8a85f64641ddb56a16ebeaa2b089924` from main. READY is not a current application/runtime verification.
- SSO protection scope: `all_except_custom_domains`; password protection/trusted-IP protection disabled. Public access has not been enabled.
- Baseline Preview `ac173423fcef4affb1e94ff84822d3e0c8c7e13e` was READY. Authenticated deployment fetch of `/api/health` returned 200 and `status: ok`.

Additional code gates:
- `backend/src/index.js` currently accepts only the designated Preview branch, `savora_staging` database and staging username. Production deliberately returns 503. Production needs an explicitly tested beta environment path validating `savora_beta`, dedicated credentials and exact trusted public origins, while retaining staging guards.
- Login and checkout rate limits use per-process Maps. They do not provide shared protection across Vercel instances; public order-spam controls need an agreed platform/shared enforcement policy.
- Local media storage is rejected on Vercel. Uploads are unavailable without an approved persistent provider. Existing external URLs are distinct from persistent upload support. Do not introduce Vercel Blob.
- Owner/Admin session/CSRF authentication and tenant checks remain required. Health checks DB readiness. Checkout prices and snapshots are computed on the server. Error responses are generic; no secrets should be logged.

Required external setup before resuming Production:
1. Create `savora_beta` and a separate database user restricted to that database (no staging/dev/test permissions). Supply credentials securely via Vercel Production settings, not chat or source.
2. Verify the user's effective permissions, network/TLS connectivity and database identity. Set `MONGODB_URI` as Production-only secret. No existing credentials may be borrowed.
3. Approve exact synthetic restaurant records and controlled Owner/Admin accounts; no existing users, sessions or orders may be copied.
4. Confirm the final Production hostname(s) and exact `AUTH_TRUSTED_ORIGINS`. Keep Preview protected; change only Production access after authenticated readiness and security checks.
5. Implement/test the explicit beta runtime path, index review and spam controls; then review main diff and merge only after gates pass.

No beta credentials or approved seed/account manifest were available in this task. No beta DB connectivity or privilege claim is made. Live Owner/Admin login and beta order persistence remain unverified.

Rollback reference: current Production deployment `dpl_7uzTGLVTyQ58XiHLVeLpoa1Yig5s` / commit `68627ce4c8a85f64641ddb56a16ebeaa2b089924`. If a future release is promoted and fails, use Vercel rollback to that recorded deployment in the same project/team, verify domain mapping and health, then explicitly manage subsequent auto-promotion. Application rollback does not undo database writes; preserve the beta database and never point rollback at staging. No rollback was executed.
