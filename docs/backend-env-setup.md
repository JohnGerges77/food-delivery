# Backend environment and Windows startup

Run commands from `backend/` with Node.js 24. The default Windows `node` may be Node 20. Verify both version and executable before installing dependencies or running scripts:

```powershell
$node24 = 'C:\path\to\node24\node.exe'
& $node24 -p "process.version + ' ' + process.execPath"
$env:Path = "$(Split-Path $node24);$env:Path" # current PowerShell process only
npm.cmd ci
npm.cmd start
```

The path adjustment above is confined to that PowerShell process; it does not change the system PATH. `npm start` and `npm run dev` invoke `node` from that process PATH. Verify `node -v` prints `v24.x` before either command. On this audit machine, the verified executable was `C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` (v24.19.0); locate it again on another machine rather than assuming that cache path exists.

Copy `.env.example` to a local, uncommitted `.env` and fill it privately. Do not paste URI credentials, passwords, session cookies, or WhatsApp handoff URLs into source, documentation, tickets, or logs.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required for `npm start` and `npm run dev`. Point it at the intended application database. Startup fails when absent or unreachable. Never use the test URI as an implicit fallback. |
| `AUTH_TRUSTED_ORIGINS` | Required. Comma-separated, exact owner dashboard browser origins, such as `http://localhost:3000` for local work or `https://dashboard.example.com` in production. Production rejects HTTP origins. This is not a list of public storefront domains. |
| `NODE_ENV` | Set to `production` behind HTTPS to issue Secure owner cookies. Leave unset or set to `development` for plain HTTP localhost only. |
| `PORT` | Optional listener port, default `5000`; integer 1-65535. |
| `TRUST_PROXY_HOPS` | Optional, default `0`. Set to the exact number of trusted reverse-proxy hops only when direct access to the backend is blocked. Otherwise forged `X-Forwarded-For` could defeat IP limiting. |
| `MONGODB_TEST_URI` | Integration and E2E tests only. Must authenticate as exactly `savora_test_user`, use `/savora_test`, have no `dbName` override, and connect to `savora_test`. Never point it at development or production. |
| `SAVORA_DEV_ATLAS_HOSTNAME` | Independent expected Atlas cluster hostname for the separate development provisioning CLI guard. It is not a secret; set it outside source. The provisioning CLI is not part of startup or automated testing. |

The server loads `.env` through `dotenv/config`. Startup checks Node 24, the database URI, trusted origins, port and proxy setting; it validates owner CORS/cookie configuration before connecting; it listens only after MongoDB connects. `/api/health` returns 200 while the application connection is ready and 503 if it becomes unavailable. Connection errors are reported without printing the URI or credentials. SIGINT/SIGTERM closes the HTTP listener and disconnects MongoDB.

## Safe startup checks

The automated startup unit tests use a fake connection and a missing-URI child process; they do not connect to `savora_dev`. To exercise the real development database manually after reviewing your `.env`, run `npm.cmd start` or `npm.cmd run dev` from the Node 24 PowerShell session above. `npm run dev` stays running under nodemon. A nodemon "app crashed" line means the child exited; inspect its preceding safe `Startup failed: ...` message. A missing URI or trusted origin is expected to exit with code 1. Check for an occupied `PORT` and Atlas network/DNS access separately. Do not treat an HTTP-only process as proof of database readiness.

For a **no-database** failure check, point dotenv at a nonexistent file in the current shell before running `npm.cmd start`: set `$env:DOTENV_CONFIG_PATH = '__savora_no_env_file__.env'` and remove `MONGODB_URI` from that shell. Simply setting `MONGODB_URI` to an empty value is insufficient on this machine because dotenv can fill it from `.env`. Clear the temporary `DOTENV_CONFIG_PATH` variable before a real manual startup.

## HTTPS owner dashboard topology

Preferred production arrangement: expose `/api` through the same HTTPS owner dashboard origin, with a reverse proxy forwarding to the private backend. A separate `api.example.com` hostname can also work when it is **same-site** with `dashboard.example.com`: the `SameSite=Lax`, host-only, `Path=/api` session and CSRF cookies are sent to the API with `credentials: 'include'`. Because dashboard JavaScript cannot read the API host's CSRF cookie, call `GET /api/auth/csrf` from the trusted dashboard Origin to obtain the session-bound token, then send it as `X-Savora-CSRF` on owner mutations. Refresh it after login or page reload. Only exact origins in `AUTH_TRUSTED_ORIGINS` receive credentialed CORS responses. A dashboard on a different site is not supported by the current Lax-cookie contract and needs a separate reviewed design.

Terminate TLS at a trusted proxy; redirect HTTP to HTTPS there, set HSTS there, restrict direct backend access, and forward the original host/protocol/IP through a known number of hops. Never enable wildcard credentialed CORS. Public storefront GET and guest checkout routes use noncredentialed CORS and do not require listing storefront origins in owner trusted origins.

## Test and inspection commands

After the Node 24 process PATH setup, `npm.cmd test` runs offline unit tests. `npm.cmd run test:integration` runs the guarded `MONGODB_TEST_URI` integration suite, including the end-to-end journey; `npm.cmd run test:e2e` runs only that journey. These scripts read `.env` with Node's `--env-file`; the tests validate the exact test username, URI path, and connected database before writes. Do not invoke the development provisioning CLI as a test.

For read-only index inspection, explicitly set `MONGODB_INDEX_CHECK_URI` and `MONGODB_INDEX_CHECK_DATABASE`, then run `npm.cmd run indexes:check`. The script has no URI fallback and performs only `listIndexes`. Run it against `savora_test` first using the test URI and database name; the script also checks the exact test username. A production inspection requires a separately approved read-only credential and connection. Never use `syncIndexes()` or an automatic drop/rebuild in deployment.
