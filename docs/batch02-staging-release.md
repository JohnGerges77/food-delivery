# Batch 02 — staging release preparation

Status: preparation only. No staging writes, store creation, configuration changes, commit, push, or deployment are authorized by this document.

**Current decision:** defer live image uploads to the VPS phase. Blob is not included in this release. Staging MediaAsset indexes have already been installed and must be left intact. Without an explicitly configured persistent provider, Owner Dashboard disables media mutations and explains their unavailability.

## Approval gates and index procedure

Staging index creation has already been completed. An authorized operator must separately approve commit/push/deployment and isolated staging fixtures, orders, and exact cleanup. Production requires its own authorization. Verify the branch, deployment commit, project/team, and staging database independently at each gate. The index procedure below is retained for future independently approved environments; do not repeat it on staging.

Historical pre-installation boundary review: the local Staging, Development and Test URIs resolve to `cluster0.va0oopz.mongodb.net`, using databases `savora_staging`, `savora_dev` and `savora_test` respectively. The Staging connection authenticated as `savora_staging_user` against `admin` and reported replica set `atlas-ahvl1n-shard-0`. Subsequently the owner confirmed the staging database boundary and the approved staging indexes were installed and verified. Do not repeat installation as part of this release. Any future environment requires independent identity and writer verification.

Use a dedicated staging database administrative connection, not a production URI. In `mongosh`, independently confirm `db.getName() === 'savora_staging'`, the Atlas project/cluster identity, the authenticated principal, backup readiness, and paused media writes. Stop if any differs. The following guarded block is repeatable and fails before creating indexes if its database or duplicate checks fail. Execute only after explicit approval; do not paste credentials into a command or transcript.

```javascript
if (db.getName() !== 'savora_staging') throw new Error('Wrong database');
const duplicate = db.mediaassets.aggregate([
  { $match: { status: 'active' } },
  { $group: { _id: { restaurantId: '$restaurantId', targetKind: '$targetKind',
    targetId: '$targetId', sourceSha256: '$sourceSha256' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }, { $limit: 1 }
]).toArray();
if (duplicate.length) throw new Error('Duplicate active assets: investigate before proceeding');
const exists = db.getCollectionInfos({ name: 'mediaassets' }).length > 0;
printjson(exists ? db.mediaassets.getIndexes() : []);
db.mediaassets.createIndex({ restaurantId: 1, targetKind: 1, targetId: 1, status: 1 });
db.mediaassets.createIndex({ status: 1, updatedAt: 1 });
db.mediaassets.createIndex({ restaurantId: 1, targetKind: 1, targetId: 1, sourceSha256: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } });
printjson(db.mediaassets.getIndexes());
```

Compare keys, `unique: true`, and the partial filter to `MediaAsset.schema.indexes()`; if an existing conflicting index prevents creation, stop for review. Do not drop, rename, or synchronize indexes automatically. Preserve the before/after sanitized inventory and run the concurrent test only using approved isolated fixtures.

The MediaAsset schema disables `autoIndex` and `autoCreate` independently of connection defaults. Each upload and each applied reconciliation checks the actual collection indexes and returns 503 if the three required definitions are absent or incompatible. The runtime database principal needs read permission to list indexes on `mediaassets`; it does not need permission to create them. Index installation remains an explicit administrative operation. Keep uploads paused while changing indexes: the readiness check is a point-in-time check and cannot protect against an administrator dropping an index during an in-flight upload. Other models retain their existing index settings.

## Storage on Preview

Leave `MEDIA_STORAGE_PROVIDER` unset on Vercel. The Owner interface reports managed media unavailable, and mutation endpoints fail closed. Local filesystem storage is rejected on Vercel; Blob is not implemented or installed. Existing external image URLs remain supported. Do not provision a Blob store or change environment configuration for this release.

## Isolated staging end-to-end plan

Do not run `backend/integration/media.integration.js` against staging: it is guarded for `savora_test`. After the separate fixture/write approval and a ready protected Preview:

1. Create two dedicated test restaurants and owner accounts through the approved administrative process, using a unique `batch02-<run-id>` marker and `.example.test` contacts. Create one category and product per restaurant and record exact Restaurant, User, session, Category and Product IDs in a private manifest. Confirm the target is `savora_staging`; do not reuse `savora-demo`. Record starting counts scoped to those IDs and exact storage keys as assets are created.
2. In an authenticated Preview browser, confirm Owner upload and deletion controls are unavailable with a clear message, and existing external product and logo URLs render. Do not attempt managed uploads on Vercel.
3. Defer managed image upload, replacement, deletion, tenant-isolation and persistence tests to an independently approved VPS environment with persistent storage.
4. Submit one Direct and one WhatsApp order for the fixture restaurant, without sending the WhatsApp message. Capture only sanitized status, order references and totals; compare authoritative product price, delivery fee and stored snapshots. Repeat the same idempotency key with the same payload and verify exactly one persisted Order per key. Check the browser POST has the Preview origin and avoids Vercel Authentication 401.
5. Teardown only after verifying every ID belongs to the manifest and no unexpected relations exist. Remove test Orders, sessions, products, categories, owners and restaurants in dependency order. If any check or deletion fails, stop and retain the manifest for targeted recovery; never use a broad prefix delete. Verify zero records by each exact ID and record before/after counts. Keep test evidence sanitized.

## Security disposition

The Blob dependency chain has been removed from the backend production dependencies. The 2026-11-06 full audits reported two backend and eight frontend moderate entries; both `npm audit --omit=dev` checks reported zero findings. All remaining entries trace to [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch glob amplification. Backend: `nodemon@3.1.14` → `minimatch@10.2.6` (two entries). Frontend: `eslint-config-next` → `typescript-eslint` and its parser/plugin/utilities → `@typescript-eslint/typescript-estree` → `minimatch@10.2.5` (eight entries). These are development/build tools; avoid processing untrusted glob patterns and track upstream-compatible fixes. No forced downgrade or override was applied. Re-run both full and production-only audits before release.

Sharp, body-parser and qs were updated in the previous verification. Re-run `npm audit` against the registry at release time because advisory data changes.

## VPS portability

Media references use portable Savora paths. VPS operation requires an absolute persistent `UPLOADS_DIR` outside the repository, an HTTPS reverse proxy, verified database indexes, and tested external backups. The old Blob migration CLI is disabled and cannot migrate files without a separately implemented and tested adapter. See [batch02-media.md](batch02-media.md).
