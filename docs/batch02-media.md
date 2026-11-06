# Batch 02 media system — local implementation

**Current staging decision:** uploads, replacement and deletion are unavailable until persistent local storage is configured on a VPS. No Blob store or Vercel environment change is planned. The owner interface checks the authenticated `/api/owner/media/capabilities` endpoint and shows an unavailable message when configuration or required indexes are missing; server mutation routes independently reject requests without storage. Existing image URLs and storefront presentation remain available.

The capability endpoint checks provider configuration and index readiness, not a live storage write or credential validity. A configured but unreachable storage provider may still fail an upload; the UI reports the failure without claiming success. On a VPS, set `MEDIA_STORAGE_PROVIDER=local` and an absolute persistent `UPLOADS_DIR` outside the repository, mount it across deployments, and verify the declared MongoDB indexes and runtime `listIndexes` permission before enabling uploads.

## Storage and API

Only the local adapter is included. A future cloud adapter can implement the same `provider`, `write`, `read`, and `delete` interface, but requires a separate implementation and security review. Blob configuration is rejected even when credentials are present.

Owner primary image uploads use `PUT /api/owner/media/products/:id`; additional images use `PUT /api/owner/media/products/:id/images` (up to 10), and logos use `PUT /api/owner/media/logo`, with raw JPEG, PNG, or WebP bytes. The browser sends the same origin session cookie and `X-Savora-CSRF`; the existing trusted Origin and owner guards run before the body parser. `DELETE` on the primary/logo endpoints or `/api/owner/media/products/:id/images/:assetId` removes a managed image. The generic Product and Settings APIs retain legacy `imageUrl`, `images`, and `logoUrl` compatibility; managed references must be changed through the media endpoints. Product details in all four themes display additional images.

The server decodes the real file with Sharp, checks declared MIME against decoded format, restricts input to 4,000,000 bytes and 16–6,000 pixels on each side, and produces 320px and 1200px WebP variants with metadata stripped. The 4 MB limit stays below Vercel's function body limit. Unique generated keys contain only server-created ObjectIds. No client filename becomes a filesystem path. `MediaAsset` records provider, tenant, target, original SHA-256, dimensions, and both variant hashes. The primary URL points to the large variant; list cards request the small variant. Existing external image URLs and Demo media remain untouched.

The target's `imageUrl`, `images`, or `logoUrl` and asset state change together in a MongoDB transaction. An identical upload for the same target returns the existing URL. A replacement retires the old asset, then deletes its files. If storage deletion fails, the tombstone remains for reconciliation. Public `GET /api/public/restaurants/:slug/media/:id/:size` resolves an active restaurant, then checks asset tenant and that the target still references it. Cached responses can remain in a browser for up to 60 seconds after deletion. Before enabling uploads on an existing database, build and inspect the declared `MediaAsset` indexes, including the partial active-image deduplication index.

### Index installation gate

With writes paused and a verified backup, connect using an administrative account explicitly scoped to the intended database. First verify `db.getName()` and inspect `db.mediaassets.getIndexes()`. Audit active records for duplicates of `(restaurantId, targetKind, targetId, sourceSha256)` and resolve any conflicts before creating the declared indexes. Create the compound query indexes and the unique compound index with `partialFilterExpression: { status: 'active' }` matching `backend/src/models/MediaAsset.js`. Read `getIndexes()` back and verify keys, uniqueness and partial filter exactly, then run a controlled concurrent upload test and verify cleanup before enabling uploads. Never use index synchronization or drop existing indexes as part of this step. Staging indexes have already been installed; do not repeat their installation. Repeat the gated procedure independently for Production only when explicitly authorized.

After the database name and duplicate audit are independently confirmed, the reviewed `mongosh` commands are:

```javascript
db.mediaassets.createIndex({ restaurantId: 1, targetKind: 1, targetId: 1, status: 1 });
db.mediaassets.createIndex({ status: 1, updatedAt: 1 });
db.mediaassets.createIndex({ restaurantId: 1, targetKind: 1, targetId: 1, sourceSha256: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } });
db.mediaassets.getIndexes();
```

### Configuration

Uploads remain disabled and return `503` until `MEDIA_STORAGE_PROVIDER` is explicitly set. There is no ephemeral filesystem fallback.

- Local development or VPS: `MEDIA_STORAGE_PROVIDER=local` and absolute, persistent `UPLOADS_DIR` outside the Git repository. Vercel rejects local mode. The process needs read/write access to that directory; use a Docker volume or a persistent host mount, for example `/var/lib/savora/uploads:/var/lib/savora/uploads` with `UPLOADS_DIR=/var/lib/savora/uploads`. Keep the mount when replacing the container.
- Vercel Staging: leave `MEDIA_STORAGE_PROVIDER` unset. Local mode is rejected on Vercel and Blob is unsupported; no filesystem fallback occurs.
- Public managed media URLs are served by the backend through the same-origin `/api` rewrite when a supported provider is active. Keep Vercel Authentication on.

### VPS serving, HTTPS and backups

Use Nginx as an HTTPS reverse proxy to Express for `/api/public/restaurants/*/media/*`; do not point an unrestricted Nginx alias at the upload volume because that would bypass tenant and active-reference checks. Forward the original Host and scheme. The response is `image/webp`, `nosniff`, and `Cache-Control: public, max-age=60`; Nginx may cache successful media GETs for at most 60 seconds. Avoid caching 401/403/404 responses. Terminate TLS in Nginx and redirect HTTP to HTTPS. Mount the upload directory read/write into the backend container and keep it outside the image and Git checkout.

Back up MongoDB and the mounted upload directory as one recoverable set using external storage. Record backup timestamp, MongoDB snapshot/cluster time, file count, total bytes, and SHA-256 manifest. Encrypt backup copies and test a restore into an isolated environment: restore MongoDB and files, then compare every active variant's `bytes` and `sha256` to its `MediaAsset` metadata and fetch representative tenant-scoped URLs. Retain backups according to your recovery policy. Never use a container layer or Vercel Function's temporary filesystem as durable storage.

### Reconciliation and future cloud migration

`npm run media:reconcile` is read-only by default. It reports pending or retired assets older than one hour. After reviewing the count and mount/provider, `npm run media:reconcile -- --apply` promotes still-referenced pending assets or deletes unreferenced files and records. Schedule this on a VPS or run it after interrupted uploads. Do not run it against Demo/Production without an approved maintenance procedure.

The old Blob migration CLI is deliberately disabled before any database connection; it cannot migrate files in this release. If cloud storage is introduced later, implement and test a provider and migration tool first. Pause writes, back up MongoDB and source files, copy each exact asset key to the persistent mount, verify bytes and SHA-256 against metadata, and update provider references only after verification. Verify the complete manifest and restore procedure before seeking separate approval to delete any source objects. The active provider is process-wide; plan a maintenance window for cutover.
