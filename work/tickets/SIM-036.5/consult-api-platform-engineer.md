## SIM-036.5 API consult (read-only)

### Findings

**Existing building blocks**
- `OrgDrive` is in `src/server/drive/drive.ts`. `getDrive()` returns null when Drive is off and throws `DriveConfigError` (`config.ts:3`) when the config is partial. `uploadOrgFile(orgId, {name, mimeType, bytes})`, `getFile(id)` and `deleteFile(id)` are NOT org-checked. `deleteFile` already treats an already-gone file as success. `DriveError.code` is one of: `drive_not_configured, drive_auth, drive_not_found, drive_forbidden, drive_rate_limited, drive_unavailable, drive_too_large, drive_bad_response, drive_invalid_id`. `DRIVE_MAX_BYTES` is 64 KB, so a 20 KB PNG fits both ways.
- `readJson` (`src/server/request/read-json.ts`) lowercases the content type and strips parameters. A missing `content-length` counts as 0, so chunked bodies pass the precheck. It enforces the cap by streaming, cancels the reader and returns only `{ok:false}` with no reason.
- `withAuth` (`src/server/http/with-auth.ts:80-86`) turns any exception from a handler into 500 `internal`. It logs `err.code` only. So a `DriveError` that is not caught in the handler becomes 500, not the fixed 502/503. The handler or service must catch Drive errors itself. `withAuth` never emits 401/403 after the handler starts, so R7 depends only on the codes you pick.
- `apiError(status, code)` accepts any status, but `code` must be in `API_ERROR_CODES` (`src/lib/api/error.ts`). 503 always adds `Retry-After: 5`.
- Service layer (`src/server/device-types/device-types.ts`): `inTx` plus an `Abort` refusal, `orgQuery` for org scoping, `COLS` already includes `has_image` and `image_version`. `deleteDeviceType` does `delete ... returning name, slot` and returns `Result<null>`. The existing `[id]/route.ts` is the pattern to copy: uuid check, then pool, then body, then service, then `NO_STORE`.
- Migration `20261124160000_device_types.sql` already has `image_drive_file_id text null` (CHECK `^[A-Za-z0-9_-]{10,200}$`) and `image_version int not null default 0`. No migration is needed.

**Inconsistency in the ticket step 5 and step 8.** The ticket says to look up the row `for update` and also to do a compare-and-set update. The order is: lock the row, upload to Drive, then update. This holds a DB connection and a row lock across a network call to Drive. Under a Drive slowdown that exhausts the pool. The lock is also redundant once the update is a compare-and-set.

### Recommendations

1. **Layout and testability**
   - Put the logic in a new service file, `src/server/device-types/image.ts`, with these functions:
     - `setDeviceTypeImage(db, drive: OrgDrive | null, scope, sub, id, bytes)`
     - `removeDeviceTypeImage(db, drive, scope, sub, id)`
     - `getDeviceTypeImage(db, drive, scope, id, ifNoneMatch)`
   - Pass the drive in as a parameter, so handler tests use a fake `OrgDrive`. Route files only call `getDrive()` inside a `try`, plus a Drive error mapper, and map the result.
   - New route file `src/app/api/device-types/[id]/image/route.ts` must export through `withAuth` (a test proves the mark). PUT and DELETE use tier `admin`. GET uses `user`. Add `export const dynamic = "force-dynamic"`.

2. **`readBytes(req, maxBytes, type)`** in `src/server/request/read-bytes.ts`
   - Return a discriminated reason: `{ok:true, bytes} | {ok:false, reason:"type"|"too_large"|"empty"|"read"}`.
   - Compare the content type the way `readJson` does (lowercase, parameters stripped).
   - Precheck `content-length` when it is a valid number above the cap.
   - Stream with a hard cap, cancel the reader on overflow, and return a single `Uint8Array`.
   - A missing `req.body` or an empty body gives `empty`.
   - The handler maps `too_large` to 422 `image_too_large`. It maps `type`, `empty` and `read` to 422 `image_not_png`. This follows Q1 (422 for every bad image).
   - Do not copy `readJson`'s "missing content-length counts as 0" as a security property. The streaming cap is what enforces the limit.

3. **`src/lib/validate/png.ts`** (pure, in lib). `validatePng(bytes)` returns `{ok:true}` or `{ok:false, code:"image_not_png"|"image_bad_size"}`.
   - Check the 8-byte signature `89 50 4E 47 0D 0A 1A 0A`.
   - The first chunk must be IHDR with length 13. Read width and height as big-endian u32 via `DataView` (not `<<`, which goes negative above 2^31). Both must equal 24.
   - Walk the chunks by their lengths with bounds checks. Require that IHDR comes first, at least one IDAT exists, the walk lands exactly on the end of the buffer, and IEND (length 0) is the last chunk.
   - This is stronger than checking only the last 12 bytes. It rejects trailing data and polyglots.
   - Optionally verify each chunk's CRC32 (cheap at 20 KB, `node:zlib` `crc32` is available on Node 22) and reject `acTL` (APNG).
   - Return a non-24 size as `image_bad_size`, anything else as `image_not_png`. Both are 422.
   - Tests: signature off by one byte, length 12 IHDR, 23×24, 24×23, 0×0, 2^32−1 width, truncated, trailing bytes after IEND, no IEND, no IDAT, a valid 24×24 fixture, an HTML or SVG body labelled `image/png`, and an empty buffer.

4. **PUT order (R7, R6)**
   - Order: wrapper, uuid (404), pool (503 `unavailable`), `readBytes` (422), `validatePng` (422), a plain org-scoped `select` of the row (404), `getDrive()` (null → 503 `images_unavailable`), upload, a short tx doing the compare-and-set update, then cleanup.
   - Do not hold the lock across the upload. Use the plain select to read `image_drive_file_id` as `old`. Then upload. Then run one short tx:

     `update device_types set image_drive_file_id=$new, image_version=image_version+1, updated_at=now() where org_id=$1 and id=$2 and image_drive_file_id is not distinct from $old returning ...`

     plus `writeAudit`.
   - If it returns 0 rows, re-select. A missing row gives 404 and a changed row gives a 409 domain refusal (new code, for example `image_changed`). In both cases delete the new file best-effort. A 409 means the client may retry.
   - Name the file server-side: `devtype-<typeId>-<crypto.randomUUID()>.png`, with a fixed `mimeType: "image/png"`. Use `scope.orgId` for the org argument. Never use a client filename or header.
   - Cleanup after commit: delete `old` if present. If the update fails definitely (0 rows, or an error before commit), delete the new file. If the commit outcome is ambiguous (error at COMMIT), prefer an orphan over a dangling reference: do not delete the new file, and log it.
   - Cleanup is `try { await drive.deleteFile(id) } catch { log({event:"drive_orphan", ...}) }`. Log the event and the type id, never bytes or tokens. Cleanup must never change the response status.
   - Return 200 with the `DeviceTypeDto` (`hasImage:true`, new `imageVersion`) and `Cache-Control: no-store`.

5. **DELETE image**
   - In one tx: select `for update` (404 if the type is missing), then `set image_drive_file_id=null, image_version=image_version+1` only if an image exists. If there is no image, return 204 with no bump and no audit (idempotent). After commit, delete the old file best-effort, and log an orphan when Drive is off or the delete fails.
   - This route must never call `getDrive()` in a way that can fail the request. Wrap it, and a `DriveConfigError` becomes only a logged orphan.
   - `deleteDeviceType`: change the SQL to `returning name, slot, image_drive_file_id`. Return the file id in the value (for example `{ orphanFileId }`) and let the caller (route) run cleanup through a shared helper. This is better than injecting Drive into the service. The existing `Result<null>` callers and `device-types.db.test.ts` need updating.

6. **GET image**
   - Order: wrapper, uuid (404), pool, org-scoped select `(image_drive_file_id, image_version)`. A missing row, another org, or a null id gives 404 `not_found` (identical for all three).
   - Compute the ETag as `"<typeId>-<imageVersion>"`. Use the type id, never the Drive file id. Parse `If-None-Match` as a comma list. Accept `*`, strip a `W/` prefix, and compare tokens. On a match return 304 with no Drive call, and still include `ETag`, `Cache-Control: private, no-cache` and `X-Content-Type-Options: nosniff`.
   - Otherwise `getFile(id)`, check the PNG signature (8 bytes at minimum, ideally `validatePng`), then respond 200 with:
     - `Content-Type: image/png` (fixed, never `contentType` from Drive)
     - `X-Content-Type-Options: nosniff`
     - `Cache-Control: private, no-cache`
     - the ETag
     - `Content-Disposition: inline`
     - `Content-Security-Policy: sandbox`
     - `Content-Length`
   - A failed signature check, or `drive_not_found` for a row that says an image exists, gives 502 `drive_error` and a log line. Do not return 404, so the client does not conclude the image is gone.
   - A GET must not write to the DB.

7. **Drive error mapping (one helper, for example `src/server/device-types/drive-http.ts`)**
   - `DriveConfigError` and `getDrive()` null: 503 `images_unavailable`.
   - `drive_rate_limited` and `drive_unavailable`: 503 `images_unavailable`. `Retry-After: 5` is acceptable here.
   - `drive_auth`, `drive_forbidden`, `drive_not_configured`, `drive_invalid_id`, `drive_bad_response`, `drive_too_large`, `drive_not_found`: 502 `drive_error`.
   - Never forward `err.code`, `err.message`, or Google's status. Non-Drive errors are re-thrown, so `withAuth` gives 500 `internal`.
   - Add the new codes to `API_ERROR_CODES`: `image_not_png`, `image_bad_size`, `image_too_large`, `images_unavailable`, `drive_error`, plus the 409 code if you choose the CAS refusal. Check any test that enumerates the list.
   - A test must prove `drive_auth` on upload, get and delete never yields 401/403 (loop over every `DriveCode` and assert status ∈ {502,503} on upload/get).
   - One cosmetic point: `apiError(503)` always sends `Retry-After: 5`, which is slightly misleading for "images off" (config). Accept it, or leave it for a follow-up. Do not edit `respond.ts` for this (it is High).

8. **Caching and the UI contract**
   - `private, no-cache` plus the ETag means every load costs one DB lookup but no Drive call.
   - A bearer token is in browser memory, so an `<img src>` cannot authenticate. SIM-036.4 must fetch with `apiFetch` and use a blob URL, caching per `imageVersion` from the layout DTO. Put this in the handoff note for SIM-036.3/4.

9. **Audit.** The SIM-036.2 plan has only `device_type.create|update|delete` (A11). Recommend `device_type.image_set` and `device_type.image_remove` with meta `{version}` only (no Drive ids). Confirm the audit table does not constrain the action string (it is not in my read).

10. **Tests**
    - Unit tests: `png.test.ts` (list above) and `read-bytes.test.ts` (wrong content type, parameters allowed, declared content-length above the cap, a streamed body that exceeds the cap without a header and cancels the reader, an empty body, an exact-cap body ok).
    - Handler tests with a fake `OrgDrive` (record the call order):
      - 422 cases make zero DB and zero Drive calls.
      - Order is lookup, upload, update, delete-old.
      - The upload name matches `/^devtype-<id>-.+\.png$/` and `mimeType` is `image/png`.
      - A CAS loss deletes the new file and returns 409.
      - A DB failure deletes the new file.
      - A delete-old failure still returns 200 and logs an orphan.
      - DELETE works with Drive null and with Drive throwing.
      - GET: 304 makes no `getFile` call, the fixed headers hold, a text/html Drive `contentType` is not echoed, non-PNG bytes give 502, and a cross-org id gives 404 with no Drive call.
      - Error mapping test (the loop above).
      - Admin-only for PUT and DELETE (user gets 403 from the wrapper), user allowed for GET.
    - DB tests (`device-types.db.test.ts` pattern): cross-org 404 on all three routes, the version bump on set and remove, `deleteDeviceType` returns the file id, an idempotent remove does not bump, and a concurrent set (CAS) loses cleanly.

### High paths (per `.claude/loop.config.md`, section High paths)

Planned files and whether each is High:
- `src/server/request/read-bytes.ts` and its test: NO. `src/server/request/**` is not listed (it sits beside `readJson`, which is also not High).
- `src/lib/validate/png.ts` and test, and `src/lib/api/error.ts`: NO.
- `src/app/api/device-types/[id]/image/route.ts` and its test: NO.
- `src/server/device-types/image.ts`, `device-types.ts`, the drive-error helper and the DB tests: NO.
- `src/server/drive/**`: NO. Caveat: `**/config.*` matches `src/server/drive/config.ts`, so do not touch that file.
- High only if the planner adds them to scope, which I recommend against:
  - `src/server/http/**` (`respond.ts`, `with-auth.ts`, `org-scope.ts`): High (for example, a change to `apiError`'s Retry-After).
  - `.env.example`, `next.config.*`, `src/proxy.ts`: High. No env change is needed here.
  - `db/migrations/**` and `**/*.sql`: High. No migration is planned.

As planned, no file is a High path. The gate is still plan-approval (security), and the `security-ai-generated-code-auditor` review trigger fires on `src/server/` changes.

### Risks
- Holding a row lock and a connection across the Drive upload (as the ticket words it) risks pool exhaustion during a Drive slowdown. Use the plain select plus CAS design above.
- Orphan Drive files after failures between upload and commit are accepted (the sweep is a follow-up). Prefer an orphan over a dangling reference when the commit outcome is unknown.
- An uncaught `DriveError` becomes 500 `internal` through `withAuth`. Every Drive call must sit inside the mapper.
- `apiFetch` re-sends once on 401/403. The design is safe because no 401/403 can come from a handler. Verify that `apiFetch` does not also retry 502/503 on PUT, which would be harmless (it would re-upload and clean up) but wasteful.
- The PNG check does not prove the image is visually safe, only structurally valid. It is served as `image/png` with nosniff and a sandbox CSP, which is the intended mitigation (CWE-79/434).
- Production go-live needs M-46 (Drive secrets). Until then `getDrive()` is null, so PUT gives 503 and GET of an existing image row gives 503.

### Open questions for the planner
1. Confirm the choice of CAS without `for update` (recommended), and the new 409 code name (`image_changed`?).
2. Audit action names for set and remove (`device_type.image_set` / `image_remove`), and whether the audit table allows them.
3. Should an idempotent DELETE of a missing image return 204 (recommended), with a missing type giving 404?
4. For a Drive file missing while the DB row says it exists on GET, is 502 `drive_error` acceptable (recommended), or should it be a self-heal to 404?
5. Add `Retry-After` to 503 `images_unavailable`? It is currently implied by `apiError`.
6. Should the PNG validator verify CRCs and reject APNG (`acTL`)? Recommended, but optional.

Files read: `/home/user/simap/work/tickets/SIM-036.5/ticket.md`, `/home/user/simap/work/tickets/SIM-036.2/plan.md`, `/home/user/simap/work/tickets/SIM-036.1/security-review.md`, `/home/user/simap/.claude/loop.config.md`, `/home/user/simap/src/server/drive/drive.ts`, `/home/user/simap/src/server/request/read-json.ts`, `/home/user/simap/src/server/device-types/device-types.ts`, `/home/user/simap/src/app/api/device-types/[id]/route.ts`, `/home/user/simap/src/server/http/with-auth.ts`, `/home/user/simap/src/server/http/respond.ts`, `/home/user/simap/src/lib/api/error.ts`. I did not read D61 in `/home/user/simap/work/decisions.md` directly (only its quote in the SIM-036.2 plan). I also did not read the audit action constraints.
