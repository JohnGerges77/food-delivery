# Beta database bootstrap reference

The operator has completed the beta bootstrap and independently verified all 19 custom indexes across the nine application collections. The procedures below describe the original preparation. The [release procedure](public-beta-release-candidate.md) uses the existing database and skips bootstrap.

Only `savora_beta` and authenticated `savora_beta_user` are accepted. The URI guard rejects dbName overrides, unsafe TLS and other database names/users; runtime checks compare both actual connected database properties and `connectionStatus` authenticatedUsers. It fails if identity cannot be verified. Permissions/network access have not been verified. No real connection or DDL was performed while preparing this plan.

`beta-bootstrap-dry-run.js` reads the nine-model manifest, checks exact agreement with current compiled schema declarations, and uses `listCollections`, `findOne` and `listIndexes` only. Any existing record in an expected collection, unexpected non-system collection/index, or conflicting required index stops the plan. Each missing collection and index is printed with its complete key and options; existing matching indexes are omitted. Empty collections from a previous partial attempt may be resumed only after a fresh plan and review. MongoDB creates the `_id_` index with each collection automatically; it is not a separate createIndex operation.

For a completely fresh database, the expected dry-run would show **9 `createCollection` and 19 `createIndex` operations**, exactly those in `docs/public-beta-index-manifest.json`. This is a hypothetical baseline, not a claim about Atlas. A real report may differ; obtain and review the actual report before approval.

Use Node 24 from `backend/`, PowerShell 7. Enter the Atlas-issued beta URI privately at the prompt; it stays in the current process environment. Do not paste credentials into a command, source, chat, or report. The report contains only database/user names, collection names and index definitions.

```powershell
$env:Path = 'C:\Users\EL-B\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path
node -p "process.version + ' ' + process.execPath"
$betaUriInput = Read-Host 'Beta URI (hidden)' -AsSecureString
$betaUriCredential = [System.Management.Automation.PSCredential]::new('local', $betaUriInput)
$env:SAVORA_BETA_BOOTSTRAP_URI = $betaUriCredential.GetNetworkCredential().Password
node src/cli/beta-bootstrap-dry-run.js | Set-Content -Encoding utf8 beta-bootstrap-plan.json
$LASTEXITCODE
Get-Content beta-bootstrap-plan.json
node src/cli/beta-bootstrap-plan-hash.js beta-bootstrap-plan.json
```

A nonzero exit, no authenticated user, a denied list/index operation, or mismatch means stop. Review the actual output and hash with the operator. Keep all application writers disabled and require exclusive administrative access for the entire review/apply/verification window. This script cannot guarantee exclusivity or protect against another actor changing data concurrently. `readWrite` for this database is broader than the runtime minimum; review privileges and avoid assigning additional access. Standard MongoDB `readWrite` normally permits collection/index creation, but verify Atlas restrictions independently.

**Only after separate explicit execution approval:** in the same PowerShell session, with the reviewed actual hash replacing the placeholder, run:

```powershell
$env:SAVORA_BETA_PLAN_SHA256 = '<reviewed-sha256>'
$env:SAVORA_BETA_BOOTSTRAP_APPROVED = 'savora_beta'
node src/cli/beta-bootstrap-apply.js
$LASTEXITCODE
```

Apply reconnects, rechecks actual authenticated identity/database, regenerates the read-only plan, requires its SHA-256 to match the approved plan, and creates only listed missing collections/indexes. It does not drop, migrate, copy or modify records. Operations are not transactional: a failure may leave some empty collections/indexes. Stop, re-run the dry-run and seek a new review; do not delete or repair automatically. Recheck for records immediately before each index, but enforce exclusivity externally to close races.

Independent verification, after authorized apply, from the same shell and using the same verified user:

```powershell
node src/cli/beta-bootstrap-dry-run.js
$env:MONGODB_INDEX_CHECK_URI = $env:SAVORA_BETA_BOOTSTRAP_URI
$env:MONGODB_INDEX_CHECK_DATABASE = 'savora_beta'
npm run indexes:check
$LASTEXITCODE
Remove-Item Env:SAVORA_BETA_BOOTSTRAP_URI,Env:SAVORA_BETA_BOOTSTRAP_APPROVED,Env:SAVORA_BETA_PLAN_SHA256,Env:MONGODB_INDEX_CHECK_URI,Env:MONGODB_INDEX_CHECK_DATABASE -ErrorAction SilentlyContinue
```

Require dry-run `operations: []` and index checker `status: ok`. The second checker independently compares the declared index keys, uniqueness, partial predicates and TTL but does not authenticate-check the user by itself; the first command does. Neither test proves effective database privilege restrictions or concurrent-writer absence. Verify those with Atlas separately. Do not store URI in the plan or on disk. No app seeds or beta orders are authorized here.
