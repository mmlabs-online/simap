Status: READY

# Plan — SIM-036.5: Device type image upload, remove and serve

**High paths:** no planned file is a High path (`.claude/loop.config.md` → High paths). The plan does not touch
`src/server/http/**` (so `respond.ts` and `with-auth.ts` stay as they are), `src/server/drive/config.ts` (it matches
`**/config.*`), `.env.example`, `db/migrations/**` or any `*.sql` file. The gate is still `plan-approval`, set on the
ticket (security). The `security-ai-generated-code-auditor` review trigger fires because the diff changes `src/server/`.

**Main design decision (A1): no row lock is held during the Drive upload.** The ticket says to look the row up
`for update` and then upload. Taken literally, that keeps a DB connection and a row lock open during a network call
to Drive, so a slow Drive could exhaust the pool (consult §Findings, "Inconsistency"). The plan uses this order
instead:
1. A plain org-scoped `select` reads the current file id (`old`). A missing row gives 404.
2. Upload the file to Drive.
3. Run one short transaction: a compare-and-set `update ... where image_drive_file_id is not distinct from $old`,
   plus the audit row.

When the compare-and-set loses, the request gets 409 `image_changed`. The ticket's other guarantees still hold: 404
before any Drive call, one CAS update, `image_version + 1`, and the old file is deleted after commit.

## Scope summary
- `work/decisions.md` D61 (2): "Admins manage a per-org device type catalog: name, desk slot and an optional image.
  Images are stored in Google Drive the tudocuatui way (its D27/D34/D41: server-only OAuth refresh token, scope
  `drive.file`, a per-org subfolder, served by an `/api` route behind the bearer, rendered as `blob:` URLs). Image
  format: square PNG, 24 × 24 px, transparent background allowed, at most 20 KB".
- `docs/spec-v1.md:263-264` (DEV-01): "an optional 24 × 24 px PNG image, SIM-036.5".
- `work/tickets/SIM-036.2/plan.md:373-419` (Split proposal, approved by Ming 2026-11-24). It covers the PUT, DELETE
  and GET image routes, `readBytes`, `png.ts`, "Every failure gives 422 … before any DB or Drive call", the side-effect
  order, the Drive error mapping, "`drive_auth` never becomes 401/403", and the five security follow-ups.
- `work/tickets/SIM-036.1/security-review.md:42-47`: serve a fixed `image/png` after the signature check, plus
  `nosniff`; look up the org-scoped id before `getFile`/`deleteFile`; the server picks the file name; `drive_auth`
  never maps to 401/403.
- Ticket `## Scope` and `## Acceptance criteria`. They match the sources above, with one change: the `for update`
  ordering is replaced as described in A1.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Upload accepts only a real PNG of exactly 24 × 24 px and at most 20 KB (422 otherwise, before any DB or Drive call) | `png.test.ts`, `read-bytes.test.ts`; `image-routes.test.ts › 422 cases call neither the service nor getDrive` (wrong type, too large declared, too large streamed, empty, HTML labelled image/png, 23×24) |
| 2 | Replacing or removing an image deletes the old Drive file | `image.test.ts › set: order is select, upload, update, delete-old`; `image.test.ts › remove: commits, then deletes the old file`; `image-routes.test.ts › DELETE type cleans up its image file`; `image.db.test.ts › set twice / remove` (fake drive records `deleteFile(old)`) |
| 3 | Drive failures map to a fixed 5xx code | `image.test.ts › every DriveCode and DriveConfigError maps to 502/503 on set and get; body never contains the DriveCode` |
| 4 | `GET` returns the bytes only to members of the same org (404 across orgs) | `image.db.test.ts › cross-org: get/set/remove give 404 and make no Drive call` |
| 5 | `GET` sends ETag, `private, no-cache`, fixed `image/png`, `nosniff` (plus `inline`, `sandbox` CSP) | `image-routes.test.ts › GET 200 headers` (a Drive `contentType: text/html` is not echoed); `› GET 304 on If-None-Match` |
| 6 | The server picks the Drive file name; no client filename is used | `image.test.ts › upload name matches ^devtype-<id>-<uuid>\.png$, mimeType image/png, orgId = scope.orgId` (the request carries `content-disposition: filename=evil.html` and `x-filename`, and neither is used) |
| 7 | `drive_auth` and every other Drive failure map to 5xx, never 401/403 | Same loop as row 3, also run on the DELETE paths (always 204), with an explicit `drive_auth` case |
| 8 | Unit tests for `png.ts` and `readBytes`; handler tests with a fake `OrgDrive` (ordering, CAS, cleanup on failure, no Drive call on 422); DB tests for cross-org 404 and the version bump | The test files listed below exist and pass: `pnpm test`, `pnpm test:db` (CI) |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` in CI |

## Ming verification after merge
- After M-46 (the production Drive secrets): as Admin, upload a 24 px PNG with `PUT`, load it with `GET`, replace it,
  then remove it. Check that the old files leave the org's Drive subfolder. These steps need the real Drive and
  production secrets, so the reviewer cannot run them. Until M-46, `PUT` answers 503 `images_unavailable`, which is
  expected.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/validate/png.ts` | new: `IMAGE_LIMITS = { px: 24, maxBytes: 20480 }`, `validatePng(bytes): {ok:true} \| {ok:false, code:"image_not_png"\|"image_bad_size"}`, a pure table-based CRC32 (no `node:` import, so `src/lib` stays pure) | Pure PNG check (ticket scope; R1 validators live in `src/lib/validate/`) | no |
| `src/lib/validate/png.test.ts` | new | AC 1, 8 | no |
| `src/server/request/read-bytes.ts` | new: `readBytes(req, maxBytes, type)` returns `{ok:true, bytes} \| {ok:false, reason:"type"\|"too_large"\|"empty"\|"read"}` | Raw body reader (ticket scope) | no |
| `src/server/request/read-bytes.test.ts` | new | AC 8 | no |
| `src/lib/api/error.ts` | add `image_not_png`, `image_bad_size`, `image_too_large`, `image_changed`, `images_unavailable`, `drive_error` to `API_ERROR_CODES` | `apiError` only accepts listed codes | no |
| `src/ui/copy/api.ts` | add English text for the 6 codes (the `satisfies Record<ApiErrorCode,string>` check forces it; `auth.test.ts:63` checks the text is not empty) | Typecheck; D36 | no |
| `src/server/device-types/image.ts` | new service: `setDeviceTypeImage`, `removeDeviceTypeImage`, `getDeviceTypeImage`, `discardImageFile`, `driveFailure` (error mapper), `etagMatches` | Ticket scope; drive passed in as a getter so tests can inject a fake | no |
| `src/server/device-types/image.test.ts` | new: unit tests with a fake `Db` and a fake `OrgDrive` that record calls in order | AC 2, 3, 6, 7, 8 | no |
| `src/server/device-types/image.db.test.ts` | new: DB tests (real Postgres, fake `OrgDrive`) | AC 4, 8 | no |
| `src/app/api/device-types/[id]/image/route.ts` | new: `PUT` and `DELETE` (tier `admin`), `GET` (tier `user`), all through `withAuth`; `dynamic = "force-dynamic"` | Ticket scope. `routes-guarded.test.ts` finds the file and checks the `withAuth` mark automatically | no |
| `src/app/api/device-types/image-routes.test.ts` | new: route tests (service and `getDrive` mocked) | AC 1, 5, 7; tiers | no |
| `src/server/device-types/device-types.ts` | `deleteDeviceType` (lines 166-190): `returning name, slot, image_drive_file_id`; return type `Result<{ imageFileId: string \| null }>` | Ticket: "`deleteDeviceType` deletes the image file the same way" | no |
| `src/app/api/device-types/[id]/route.ts` | `DELETE` (lines 31-42): after `r.ok`, `await discardImageFile(getDrive, r.value.imageFileId, id)`, then 204 | Same | no |
| `src/app/api/device-types/device-types-routes.test.ts` | line 97: mock value `{ imageFileId: null }`; mock `@/server/drive/drive` (`getDrive` → null); add one case: an image id is discarded after a 204 and a throwing Drive still gives 204 | Contract change | no |
| `src/server/device-types/device-types.db.test.ts` | line 71: expect `{ ok: true, value: { imageFileId: null } }` | Contract change | no |

The implementer must not touch any other file without recording why in `impl-log.md`. In particular, leave
`src/server/http/respond.ts` alone, including its `Retry-After` behaviour.

## Data model / migration
None. `image_drive_file_id text null` (CHECK `^[A-Za-z0-9_-]{10,200}$`) and
`image_version integer not null default 0` (CHECK `>= 0`) already exist in
`db/migrations/20261124160000_device_types.sql:18-26` (SIM-036.2). The Drive client accepts only ids that match
`DRIVE_ID_RE` (`src/server/drive/client.ts:325`), so a returned id cannot break the CHECK (A9).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/device-types/{id}/image` | Raw body; `Content-Type: image/png` (lowercased, parameters ignored); ≤ 20480 bytes; 24 × 24 PNG. Client filename headers are ignored | 200 `DeviceTypeDto` (`hasImage: true`, new `imageVersion`), `Cache-Control: no-store` | 401/403 (wrapper only); 404 `not_found` (bad uuid, no row, other org); 503 `unavailable` (no pool); 422 `image_too_large` / `image_not_png` / `image_bad_size`; 503 `images_unavailable`; 502 `drive_error`; 409 `image_changed` (CAS lost; retry is safe) | Admin |
| DELETE | `/api/device-types/{id}/image` | — | 204, `no-store`. Also 204 when the type has no image (idempotent, no version bump) | 401/403 (wrapper); 404 `not_found`; 503 `unavailable` (no pool). Never a Drive code: Drive is called best-effort after commit | Admin |
| GET | `/api/device-types/{id}/image` | Optional `If-None-Match` | 200 PNG bytes with headers `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`, `ETag: "<typeId>-<imageVersion>"`, `Content-Disposition: inline`, `Content-Security-Policy: sandbox`, `Content-Length`. 304 (same ETag, Cache-Control and nosniff headers, empty body) when `If-None-Match` matches | 401/403 (wrapper); 404 `not_found` (bad uuid, no row, other org, no image: identical body); 503 `unavailable`; 503 `images_unavailable`; 502 `drive_error` (Drive failure, file missing, or bytes that are not a valid PNG) | Any member (`user` tier) |
| DELETE | `/api/device-types/{id}` (existing) | unchanged | unchanged (204) | unchanged; the image file is discarded best-effort after commit | Admin |

Drive error mapping (`driveFailure`), the only path from a Drive error to a response:
- `DriveConfigError`, `getDrive()` returning null, `drive_rate_limited` and `drive_unavailable` → 503
  `images_unavailable`. `apiError` adds `Retry-After: 5`, which is accepted (A6).
- `drive_auth`, `drive_forbidden`, `drive_not_configured`, `drive_invalid_id`, `drive_bad_response`,
  `drive_too_large` and `drive_not_found` → 502 `drive_error`.
- Any other error is rethrown, so `withAuth` answers 500 `internal`.
- `err.code`, `err.message` and Google's status are never sent to the client. A log line
  `{event:"device_type_image_drive", op, code}` records the DriveCode only.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `png.test.ts › accepts a valid 24×24 RGBA PNG fixture` (built in the test: signature, IHDR, one IDAT with zlib-deflated rows via `node:zlib` in the test only, IEND, correct CRCs) | AC 1 |
| `png.test.ts › image_not_png`: empty buffer; 7 bytes; signature off by one byte; HTML text; SVG text; IHDR length 12; first chunk not IHDR; truncated mid-chunk; chunk length past the end; trailing bytes after IEND; no IEND; IEND with length ≠ 0; no IDAT; bad CRC; an `acTL` chunk (APNG) | AC 1 |
| `png.test.ts › image_bad_size`: 23×24, 24×23, 0×0, 48×48, width 0xFFFFFFFF (read with DataView, never negative) | AC 1 |
| `read-bytes.test.ts`: wrong type → `type`; missing type → `type`; `Image/PNG; foo=bar` accepted; declared `content-length` 20481 → `too_large` without reading; a streamed body over the cap with no `content-length` → `too_large` and the reader is cancelled; exactly 20480 bytes → ok; no body / 0 bytes → `empty`; a stream that errors → `read`; chunks are joined in order | AC 8 |
| `image.test.ts › set: order is select, upload, update(CAS), commit, delete-old` (fake Db + fake drive share one call log) | AC 2, 8 |
| `image.test.ts › set: upload name ^devtype-<id>-<uuid>\.png$, mimeType image/png, orgId = scope.orgId` | AC 6 |
| `image.test.ts › set: no row → 404, getDrive never called` | ordering, R6 |
| `image.test.ts › set: getDrive null / DriveConfigError → 503 images_unavailable, nothing uploaded` | AC 3 |
| `image.test.ts › set: CAS 0 rows, row gone → 404, new file deleted; row changed → 409 image_changed, new file deleted` | CAS, cleanup |
| `image.test.ts › set: update throws before it returns → error rethrown (500), new file deleted` | cleanup on failure |
| `image.test.ts › set: error after the update ran (audit insert or COMMIT) → new file NOT deleted, drive_orphan logged` | A3 |
| `image.test.ts › set: deleteFile(old) throws → still ok, drive_orphan logged (type id only, no bytes or Drive ids)` | best-effort |
| `image.test.ts › set: no old image → no delete call` | |
| `image.test.ts › every DriveCode (and DriveConfigError) on upload and getFile → status ∈ {502,503}, never 401/403; code ∈ {drive_error, images_unavailable}; the DriveCode never appears in the result` | AC 3, 7 |
| `image.test.ts › remove: tx commits (null, version+1, audit) and only then calls deleteFile(old); Drive null / throwing / DriveConfigError → ok and drive_orphan logged` | AC 2, 7 |
| `image.test.ts › remove: no image → ok, no update, no audit, no Drive call; no row → 404` | A4 |
| `image.test.ts › get: no row / null id → 404 with no Drive call; If-None-Match match (exact, W/ prefix, list, *) → not_modified with no getDrive call; non-match → getFile; invalid PNG bytes → 502 drive_error; drive_not_found → 502` | AC 4, 5, A5 |
| `image.test.ts › get makes no write query` (the fake Db sees only one `select`) | |
| `image.test.ts › discardImageFile: null id → no-op; getDrive throws / deleteFile throws → never throws, logs drive_orphan` | |
| `image-routes.test.ts › 401 without token for PUT/DELETE/GET; user and manager → 403 on PUT/DELETE; user → GET allowed` | tiers, R7 |
| `image-routes.test.ts › bad uuid → 404 before getPool` | |
| `image-routes.test.ts › 422 cases (wrong type, oversize declared, oversize streamed, empty, HTML labelled image/png, 23×24) → 422 with the right code; service and getDrive not called` | AC 1 |
| `image-routes.test.ts › PUT ok → 200 DTO, no-store; service refusal maps status/code` | |
| `image-routes.test.ts › GET 200 headers` (exactly `image/png` even though the fake drive says `text/html`; nosniff; `private, no-cache`; ETag; `inline`; `sandbox`; `Content-Length`); `› GET 304` (empty body, ETag, headers kept) | AC 5 |
| `device-types-routes.test.ts › DELETE type: imageFileId discarded after 204; a throwing Drive still 204` | ticket: deleteDeviceType cleanup |
| `image.db.test.ts › set: version 0→1, has_image true, audit device_type.image_set {version:1}; set again → 2, old file deleted` | AC 2, 8 |
| `image.db.test.ts › remove: null, version bump, audit image_remove; remove again → no bump, no audit` | AC 2, A4 |
| `image.db.test.ts › cross-org: set/remove/get on another org's type → 404 and no Drive call` | AC 4, R6 |
| `image.db.test.ts › CAS loses: the fake upload changes the row's file id in SQL before returning → 409 image_changed, the row keeps the other id, the new file is deleted` | CAS |
| `image.db.test.ts › deleteDeviceType returns imageFileId of the deleted row` | |
| `device-types.db.test.ts` (existing line 71) updated expectation | contract change |

## Approach
1. **`png.ts`** (pure, in lib).
   - Check the 8-byte signature.
   - Walk the chunks with a `DataView`: big-endian u32 length, 4-byte type, data, CRC32 over type and data. Every
     offset is bounds-checked.
   - The first chunk must be `IHDR` with length 13. Width and height are read with `getUint32`.
   - Require at least one `IDAT`. Reject `acTL`. The last chunk must be `IEND` with length 0, and the walk must end
     exactly at the end of the buffer.
   - A size other than 24 × 24 gives `image_bad_size`. A wrong size on an otherwise valid structure is reported only
     after the whole walk passes; every other failure gives `image_not_png`.
   - Export `IMAGE_LIMITS`.
2. **`read-bytes.ts`** (server, starts with `import "server-only"`).
   - Normalise the content type the same way `read-json.ts:7` does.
   - Precheck: when `content-length` parses as a finite number above the cap, return `too_large`. A missing header
     is not treated as 0. The streaming cap is what enforces the limit.
   - Read the stream. On overflow, `reader.cancel()` and return `too_large`.
   - A missing body or 0 bytes gives `empty`. Any read error gives `read`.
3. **`error.ts` and `ui/copy/api.ts`**: add the six codes and their English text.
4. **`image.ts`** (server).
   - Signature: `(db: Db, drive: () => OrgDrive | null, scope, sub, id, …)`. The `Db` type is imported from
     `./device-types`. Every SQL statement goes through `orgQuery` with `org_id = $1` (R6).
   - **set**:
     1. `select image_drive_file_id from device_types where org_id=$1 and id=$2` (no lock). No row gives 404.
     2. Call `drive()` inside `try`. Null or a throw goes to `driveFailure`, which gives 503.
     3. `uploadOrgFile(scope.orgId, { name: \`devtype-${id}-${randomUUID()}.png\`, mimeType: "image/png", bytes })`.
        A failure goes to `driveFailure`.
     4. `withTx`:
        `update device_types set image_drive_file_id=$3, image_version=image_version+1, updated_at=now() where org_id=$1 and id=$2 and image_drive_file_id is not distinct from $4 returning ${COLS}`.
        Then set a local flag `applied = true` and call `writeAudit(device_type.image_set, {version})`.
     5. When the update returns 0 rows, roll back and re-select: no row gives 404, otherwise 409 `image_changed`.
        Then `discardImageFile(new)`.
     6. A throw while `applied` is false means a definite failure: discard the new file and rethrow. A throw while
        `applied` is true (audit insert or COMMIT failed) has an ambiguous outcome: keep the new file, log
        `drive_orphan`, and rethrow (A3).
     7. On success, `discardImageFile(old)` when `old` is set, then return the DTO.
   - **remove**:
     1. `withTx`: `select image_drive_file_id … for update`. No row gives 404. A null id gives ok with no write.
        Otherwise `update … set image_drive_file_id=null, image_version=image_version+1`, plus the audit row
        `device_type.image_remove {version}`.
     2. After commit, `discardImageFile(old)`.
     - No Drive call happens inside the transaction.
   - **get**:
     1. `select image_drive_file_id, image_version …`. No row or a null id gives 404 `not_found`.
     2. `etag = "<id>-<version>"`. If `etagMatches(ifNoneMatch, etag)`, return `{kind:"not_modified"}` without calling
        `drive()`.
     3. Otherwise `drive()` (null or a throw gives 503), then `getFile`, then `validatePng(bytes)`. An invalid PNG
        gives 502 `drive_error` and a log line.
     4. Return `{kind:"bytes", bytes, etag}`.
   - **discardImageFile(drive, fileId, typeId)**: a no-op for a null id. Otherwise
     `try { const d = drive(); if (!d) log orphan; else await d.deleteFile(fileId) } catch { log orphan }`. It never
     throws. The log line is `{event:"drive_orphan", typeId}` and holds no Drive id, bytes or token.
5. **`[id]/image/route.ts`**.
   - Every handler follows the pattern of the existing `[id]/route.ts`: `withAuth`, `isCanonicalUuid` (404),
     `getPool()` (503 `unavailable`).
   - PUT then calls `readBytes(req, IMAGE_LIMITS.maxBytes, "image/png")`. `too_large` gives 422 `image_too_large`;
     every other failure gives 422 `image_not_png`. Then `validatePng`, which gives 422 with its code. Only then is the
     service called with `getDrive`.
   - The route builds the GET/304 headers.
   - R7: no 401/403 is produced after the wrapper. Every Drive outcome is 502 or 503.
   - R1: the route imports `server` and `lib` only.
6. **`deleteDeviceType` and its route**: return `{ imageFileId }`. The route calls `discardImageFile(getDrive, …)`
   after the 204 decision and before returning.
7. Update the two existing tests. Run all Checks. `pnpm test:db` runs locally if a Postgres is available; CI runs it
   anyway.

Rules: R1 (layers, `@/` imports), R5 (tests for every new function), R6 (all SQL org-scoped; the Drive id always comes
from the org-scoped row, never from the client), R7 (above), R3 (no env names added; `getDrive` already reads the
four existing variables), R2 (no schema change). Domain focus: boundary validation (422 before side effects), one
error shape (`apiError`), no secrets or PII in logs.

## Specialist input used
`consult-api-platform-engineer.md`:
- Adopted:
  - §Findings "Inconsistency" and §4: a plain select, the upload, then a short CAS transaction instead of
    `for update` held across Drive (A1).
  - §1: a new service file with Drive injected. The adopted form is a getter, so the 404 lookup still runs before
    `getDrive()`, as the ticket orders.
  - §2: `readBytes` returns reasons, and every bad image maps to 422.
  - §3: the full chunk walk, the DataView reads, the test list, plus CRC and `acTL` (A7).
  - §4: the server-chosen name, a 409 code for the CAS loss, the ambiguous-commit rule.
  - §5: an idempotent DELETE, and `deleteDeviceType` returning the file id with cleanup in the route.
  - §6: GET headers, 304 before Drive, 502 on a bad or missing file.
  - §7: the mapping table and the loop test over every DriveCode.
  - §9: audit names.
  - §10: the test plan.
- Changed:
  - §7: the mapper lives in `image.ts`, not in a separate `drive-http.ts`, which saves one file. It is still a single
    exported function with its own tests.
  - §3: CRC32 is a small pure table in `png.ts`, not `node:zlib`, because `src/lib` must stay free of Node imports
    (R1 "lib, pure code").
- Rejected: none.
- Handoff note (§8) for SIM-036.3/036.4: an `<img src>` cannot send the bearer token. The UI must fetch with
  `apiFetch`, turn the response into a `blob:` URL (D61), and cache it per `imageVersion`. PUT sends the raw `File`
  as the body with `content-type: image/png`.

## Assumptions
- **A1** (the consult's open question 1): CAS without `for update` across the upload, as described at the top. New
  409 code `image_changed`. Safe default: no pool exhaustion when Drive is slow. A lost race costs one orphan-free
  retry.
- **A2** (open question 2): audit actions `device_type.image_set` and `device_type.image_remove`, with meta
  `{ version }` only and no Drive ids. `audit_log.action` is plain `text not null` with no CHECK
  (`db/migrations/20261120150000_init.sql:213`). The audit UI has no per-action label list (grep found none).
- **A3**: when the COMMIT outcome is unknown, keep the new file (a possible orphan) rather than risk a row that points
  to a deleted file. Orphans are accepted by the ticket; the sweep is a follow-up.
- **A4** (open question 3): DELETE on a type that has no image gives 204 with no bump and no audit row. A missing type,
  or another org's type, gives 404.
- **A5** (open question 4): GET of a row whose Drive file is missing or invalid gives 502 `drive_error` with a log
  line. There is no self-heal and no 404, so a GET never writes and the client does not conclude the image was
  removed.
- **A6** (open question 5): 503 `images_unavailable` keeps the `Retry-After: 5` that `apiError` adds.
  `respond.ts` is High and stays untouched.
- **A7** (open question 6): `validatePng` checks every chunk CRC and rejects APNG (`acTL`). It does not decode
  pixels, check bit depth or colour type, or inflate IDAT. Structural validity plus a fixed `image/png`, `nosniff` and
  `sandbox` CSP is the mitigation (SIM-036.1 security review).
- **A8**: PUT answers 200 with the updated `DeviceTypeDto` (the ticket gives no PUT response shape). The client then
  knows the new `imageVersion` for its ETag and blob cache.
- **A9**: the Drive client already rejects any returned file id that does not match `DRIVE_ID_RE`
  (`client.ts:325`, `drive_bad_response` → 502). The implementer confirms that `DRIVE_ID_RE` in `config.ts` is no
  wider than the DB CHECK `^[A-Za-z0-9_-]{10,200}$`, reading `config.ts` only and not editing it. If it is wider, a
  CHECK violation on the update counts as a definite failure: the new file is deleted and the request gives 500.
- **A10**: `content-type` is compared like `readJson` (lowercase, parameters ignored). The ticket's "exact
  content-type" means the media type must be exactly `image/png`.
- **A11**: `apiFetch` does not retry 5xx (`src/lib/api/fetch.ts:36`), so a 502 or 503 on PUT is not re-sent
  automatically.
- Hotspots: no ticket is in `IN_PROGRESS`, `REVIEW`, `DONE` or `REWORK` (`work/backlog.md`), so no rebase is
  expected. SIM-036.3 and SIM-036.4 (BACKLOG) will later add to `src/ui/copy/` and to the device-types routes.

## Blocking questions
None.

## Split proposal
None. This ticket is already the split slice that Ming approved in the SIM-036.2 plan. The estimate is about 450
lines of production code, plus about 800 lines of tests, which the ACs require. Splitting off `png.ts` and
`readBytes` would ship validators with no caller, the same reason SIM-036.2 kept its last slice whole. If the
implementer's diff goes well past this estimate, the fallback is to move the `deleteDeviceType` cleanup (the last two
rows of the file table and their test edits) to a follow-up ticket.
