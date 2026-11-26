Status: READY

# Plan — SIM-046: Profile photo upload (slice 1 of 3: storage, validation and API)

## Scope summary
This plan covers **slice 1** only: the server side. The UI slices are listed under `## Split proposal`.

- `docs/spec-v1.md` §4 Member entity (l.130): "profile photo (optional; stored file reference, POR-05) ... No photo =
  fallback (OQ-57)".
- `docs/spec-v1.md` POR-05 (l.581-589):
  - "The member uploads a real image as their profile photo, replaces it or removes it. Who else may remove it: OQ-61."
  - "Format and size limits: OQ-56 (precedent: device type images, D68, and SIM-036.5 storage: header checked on the
    server before any DB or Drive call, server-chosen file name, org-scoped, served behind the bearer with ETag and
    `private, no-cache`)."
  - "The photo is never drawn on the room map (LAY-06)."
  - "Every change is audited (SYS-03) without the image bytes."
- OQ-56 default (l.829): "PNG or JPEG (no APNG or other animation), square, 64 × 64 to 512 × 512 px, at most 256 KB,
  stored and served like device type images (SIM-036.5); no server-side resizing (no image library, stack unchanged)."
- OQ-57 default (l.832): "the photo shows in the shell avatar, the Members list and member card, the seat panel's
  occupant row and the Profile tab; without a photo those places show the pixel character's head (or initials)."
- OQ-58 default (l.836): Users still see the Members page (names, employee code, seats). This decides who may GET
  another member's photo.
- OQ-61 default (l.845): "only the member sets their own photo ...; a Manager+ can remove another member's photo
  (audited) but not upload one".
- `work/decisions.md` D71: "a profile photo the member uploads (a real image) ... Amends D44 ('no photos': the map
  still never shows photos)".
- `work/decisions.md` D68 is the device type image precedent. Ticket out of scope: "Pixel character (SIM-047);
  server-side image resizing".

## Acceptance criteria → verification
Ticket AC1, AC2, AC3, AC5 and AC6 are fully covered by this slice. AC4 is covered only by its server half; the UI
half is in slices 2 and 3.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The migration is forward-only, and the previous image keeps working (R2). | Read `db/migrations/20261126130000_members_photo.sql`: one `alter table members` with 2 add-columns (nullable / constant default) and 2 named checks. No drop, rename, backfill or index. `pnpm migrate:smoke` is green. `pnpm schema:check` block "12" is green, including "12 member created before the migration has no photo, version 0". The existing `members.db.test.ts` and `manage.db.test.ts` stay green with no change to their `COLS` (the old SELECT lists ignore the new columns). |
| 2 | The member uploads, replaces and removes their own photo. The file header and the OQ-56 limits are checked on the server before any DB or storage call. Refusals are 422 with a domain code. | `src/lib/validate/photo.test.ts` (every format, size and dimension case). `src/app/api/me/photo/photo-routes.test.ts` › "PUT refusals: 422 code and no getPool / service call" for each code: `image_too_large`, `image_not_supported` and `image_bad_size`. `src/server/members/photo.db.test.ts` › set / replace / remove. |
| 3 | The photo is stored org-scoped under a server-chosen name. It is served behind the bearer with an ETag and `private, no-cache`. | `photo.db.test.ts` › "upload name is photo-<memberId>-<uuid>.png/.jpg and goes to uploadOrgFile(scope.orgId)" and "cross-org id gives 404 with no Drive call". `photo-routes.test.ts` › "GET 200 headers": Content-Type taken from the bytes, ETag `"<memberId>-<version>"`, `private, no-cache`, `nosniff`, `inline`, `CSP: sandbox`. Also "GET 304 on If-None-Match before any Drive call" and "no bearer gives 401". |
| 4 (server half) | The photo is never drawn on the room map. | No file under `src/server/layout/**`, `src/lib/sprites/**` or `src/ui/roomlayout/**` changes (check with `git diff --stat`). The layout API is untouched. The UI guard test comes in slice 2. |
| 5 | Only the OQ-61 rights exist: own photo only, and a Manager+ may remove another member's photo (audited). | `photo-routes.test.ts`: "PUT /api/members/[id]/photo has no handler (405)". "DELETE /api/members/[id]/photo as user gives 403 from withAuth, service not called". "as manager / admin gives 204". `photo.db.test.ts` › "manager removes B's photo: audit actor = manager sub, entityId = B, meta.self false". |
| 6 | Every change writes an audit row without the image bytes. Tests cover validation and permissions. | `photo.db.test.ts` › "audit rows": `member.photo_set` with meta exactly `{version, self, type, bytes}` (a number, not the data). `member.photo_remove` with meta exactly `{version, self}`. No meta value is longer than 10 characters, and the Drive id appears in no meta. Validation and permission tests are listed under rows 2 and 5. |

All checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` and `pnpm build`. With a local
DB, also `pnpm test:db` and `pnpm schema:check`.

## Ming verification after merge
- After deploy, run a real Drive round trip on the hosted app. Slice 1 has no UI, so use a bearer `curl`/REST client,
  or wait for slice 2: PUT a 250 KB JPEG to `/api/me/photo`, GET it back, then DELETE it. The file should appear in
  the org's Drive folder under the name `photo-<memberId>-<uuid>.jpg` and disappear after the DELETE. This proves the
  raised `DRIVE_MAX_BYTES` works against the real Drive API (unit tests use a fake).
- After the change, a device type image and a map item image still upload and load (shared Drive client).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261126130000_members_photo.sql` | New. Expand-only columns and checks (see Data model). Timestamp reserved by batch 2026-11-26-1. | AC1, R2 | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | One bullet after the map items bullet (l.62-71), following the existing style: the columns, "no FK, no index", "the Drive file is deleted after commit (best effort; orphans logged)", "the MIME type is taken from the bytes, not stored". | Repo convention for every migration | No (but under `db/`, so the security review is triggered) |
| `scripts/schema-check.mjs` | New block `// 12 member photo (SIM-046)` after block 11 and before the `x` checks (around l.1100; add it next to the other numbered blocks). Checks: bad Drive id refused (23514 `members_photo_check`); negative version refused (23514 `members_photo_version_check`); valid id with version 1 accepted; `oldMember` (inserted before stage 1, l.75) has `photo_drive_file_id is null and photo_version = 0`; `1 later run applies members_photo` (add next to l.161-172). | AC1 | No |
| `src/lib/validate/photo.ts` | New, pure. `PHOTO_LIMITS = { minPx: 64, maxPx: 512, maxBytes: 262144 }`, `PhotoType = "png" \| "jpeg"`, `PHOTO_MIME`, `PHOTO_EXT`, `parseJpeg(bytes)`, `validatePhoto(bytes)` and `stripPhotoMetadata(bytes, type)`. Reuses `parsePng` from `./png`. Details under Approach. | AC2, R5 | No |
| `src/server/request/read-bytes.ts` | `type: string` becomes `type: string \| readonly string[]` (l.11). The media type must be one of the set. Same caps and the same return shape. The two existing callers are unchanged. | AC2 (PNG or JPEG body) | No |
| `src/server/request/read-bytes.test.ts` | New cases for a list of types. | R5 | No (Low) |
| `src/server/drive/client.ts` | `DRIVE_MAX_BYTES = 256 * 1024` (l.38). Update the doc comment (l.34-37) to say "profile photos 256 KB under OQ-56". | Otherwise a valid 200 KB photo passes the route and fails with 502 `drive_error` (consult API #1) | No (not on the High list; see Assumption A6) |
| `src/server/drive/client.test.ts` | l.208-229: also assert `DRIVE_MAX_BYTES >= PHOTO_LIMITS.maxBytes` and that a `PHOTO_LIMITS.maxBytes` upload is accepted. The `DRIVE_MAX_BYTES + 1` cases stay. | R5 | No (Low) |
| `src/lib/members/photo.ts` | New, pure type: `MemberPhotoDto = { hasPhoto: boolean; photoVersion: number }`. It is not added to `src/lib/members/types.ts`, because SIM-044.1 edits that file. | API contract | No |
| `src/server/members/photo.ts` | New (`import "server-only"`). `setOwnPhoto`, `removeOwnPhoto`, `removeMemberPhoto`, `getOwnPhoto` and `getMemberPhoto`, mirroring `src/server/device-types/image.ts` and reusing `src/server/drive/image-flow.ts`. | AC2, AC3, AC5, AC6, R6 | No |
| `src/app/api/me/photo/route.ts` | New. PUT / DELETE / GET for the caller's own photo, all `{ tier: "user" }`. | AC2, AC3 | No |
| `src/app/api/members/[id]/photo/route.ts` | New. GET `{ tier: "user" }` and DELETE `{ tier: "manager" }`. No PUT export. | AC3, AC5 | No |
| `src/app/api/me/photo/photo-routes.test.ts` | New route tests for both route files (the pattern is `src/app/api/device-types/image-routes.test.ts`). | AC2, AC3, AC5, R7 | No (Low) |
| `src/server/members/photo.test.ts` | New unit tests: SQL text and values (R6 `org_id = $1`), Drive failure mapping, never 401/403. | AC3, R6, R7 | No (Low) |
| `src/server/members/photo.db.test.ts` | New DB tests with a fake Drive (pattern: `src/server/device-types/image.db.test.ts` l.15-35). | AC2, AC3, AC5, AC6 | No (Low) |
| `src/lib/validate/photo.test.ts` | New validator and strip tests. | AC2, R5 | No (Low) |
| `src/test/photo-fixtures.ts` | New test-only builders `pngOf(w, h, opts)` and `jpegOf(w, h, opts)` (SOI, optional APP0/APP1/COM, DQT, SOF0/SOF2, DHT, SOS, scan bytes with `FF00`/RST, EOI). The PNG builder is lifted from `image-routes.test.ts` l.39-80 (that file is not changed). | Shared by lib, route and DB tests | No (Low) |

No file in `src/server/members/manage.ts`, `src/server/members/members.ts`, `src/lib/members/types.ts`,
`src/server/seats/**`, `src/server/layout/**`, `src/ui/**` or `src/app/**/layout*` is touched in this slice.

## Data model / migration
`db/migrations/20261126130000_members_photo.sql`:
```sql
-- SIM-046 / D71, POR-05, OQ-56: a member's profile photo is a Drive file in the org folder, like device type images
-- (SIM-036.5). Expand-only: one nullable column and one integer with a constant default (no table rewrite on PG 11+),
-- no backfill, no index, no FK. The previous image never selects or writes these columns, so it keeps working.
-- The MIME type is not stored: the server re-reads it from the bytes (PNG or JPEG) on every GET.
alter table members
  add column photo_drive_file_id text null,
  add column photo_version integer not null default 0,
  add constraint members_photo_check check (photo_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add constraint members_photo_version_check check (photo_version >= 0);
```
- `photo_drive_file_id`: `text`, nullable. Null means no photo. Same id format as `device_types_image_check`.
- `photo_version`: `integer not null default 0`. It is bumped on every set and remove, and it is used in the ETag.
- R6: covered by the existing `members.org_id` and the `(org_id, sub)` / `(org_id, id)` keys. No new unique key, so
  `schema-check` check 2 is unaffected.
- The `members` AFTER INSERT seed trigger is unaffected (new columns only).
- Downgrade: forward-only (R2). The previous image ignores the columns. A contract migration is never needed (the
  columns stay).
- **Migrator ordering policy** (`db/migrator.js` `planMigrations`, l.44-79):
  - A duplicate version is refused (l.48).
  - A pending file whose version is **older than the newest applied one** is refused with "migration X is older than
    the newest applied one" (l.73-76).
  - A database that is ahead of the image (an applied version the image does not have) logs a warning and applies
    nothing (l.251-253).
  - Consequence: SIM-046 (`20261126130000`) must merge, and be applied, before SIM-047 (`20261126140000`) is applied
    anywhere. If SIM-047 lands first, SIM-046 must rename its file to a version after `20261126140000` before merge.
    The latest version on `main` today is `20261126120000`, so `130000` is valid now.

## API contract
All routes are `withAuth` route handlers. 401/403 come only from the wrapper (token, tier, member gate) and before
any side effect (R7). Errors use the one `apiError` shape. Success JSON responses carry `Cache-Control: no-store`.

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/me/photo` | Raw body, `Content-Type: image/png` or `image/jpeg`, ≤ 262144 bytes | 200 `MemberPhotoDto` `{ hasPhoto: true, photoVersion }` | 422 `image_too_large`, `image_not_supported`, `image_bad_size`; 404 `not_found` (no member row yet); 409 `image_changed` (lost CAS), 409 `not_allowed` (deactivated between gate and write); 502 `drive_error`; 503 `images_unavailable`, `unavailable` (no DB) | user (own) |
| DELETE | `/api/me/photo` | None | 204 (idempotent; works with Drive off) | 404 `not_found` (no member row); 409 `not_allowed` (deactivated race); 503 `unavailable` | user (own) |
| GET | `/api/me/photo` | Optional `If-None-Match` | 200 bytes / 304 | 404 `not_found` (no member or no photo); 502 `drive_error` (Drive failure or stored bytes fail `validatePhoto`); 503 `images_unavailable`, `unavailable` | user |
| GET | `/api/members/[id]/photo` | Canonical UUID `id`; optional `If-None-Match` | 200 bytes / 304 | 404 `not_found` (bad id, other org, no photo); 502; 503 | user (any member of the token's org, OQ-58) |
| DELETE | `/api/members/[id]/photo` | Canonical UUID `id` | 204 (idempotent) | 404 `not_found`; 503 `unavailable` | manager (Manager and Admin, via `atLeast`) |
| PUT | `/api/members/[id]/photo` | None | 405 (Next default; no handler exported) | None | Nobody (OQ-61) |

Headers on GET 200 and 304: `ETag: "<memberId>-<photoVersion>"`, `Cache-Control: private, no-cache` and
`X-Content-Type-Options: nosniff`. On 200 only: `Content-Type` from the bytes (`image/png` / `image/jpeg`),
`Content-Disposition: inline`, `Content-Security-Policy: sandbox` and `Content-Length`. These are the same as
`src/app/api/device-types/[id]/image/route.ts` l.16-81.

PUT order in the handler:
1. `withAuth` (token, tier, member gate).
2. `readBytes(req, PHOTO_LIMITS.maxBytes, ["image/png", "image/jpeg"])`. Failures map to 422: `too_large` gives
   `image_too_large`; anything else gives `image_not_supported`.
3. `validatePhoto(bytes)` → 422 with its code.
4. `stripPhotoMetadata`, then `validatePhoto` again (defensive; a failure here is a 500 bug, not a user error).
5. `getPool()`.
6. `setOwnPhoto`.

This puts `getPool()` after validation, so no domain DB or Drive call happens before the header check (AC2). The
member-gate lookup in `withAuth` is the auth step that every route has.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/photo.test.ts › PNG 64, 256, 512 square ok, type "png"` | AC2 |
| `› PNG 63×63, 513×513, 64×65 → image_bad_size` | AC2 (OQ-56 bounds) |
| `› JPEG baseline SOF0 and progressive SOF2 64/512 ok, type "jpeg"; 63, 513, non-square → image_bad_size` | AC2 |
| `› APNG (acTL) → image_not_supported; GIF, WebP, BMP, SVG text, empty, 1 byte → image_not_supported` | AC2 (no animation, format) |
| `› JPEG: missing EOI, bytes after EOI (polyglot), truncated segment length, segment length < 2, two SOF, SOF3/SOF9 (lossless/arithmetic), SOS before SOF, nested SOI, height 0 (DNL) → image_not_supported` | AC2 (strict structure) |
| `› JPEG scan data with FF00 stuffing and RST0-7 markers parses; fill bytes FF FF before a marker parse` | AC2 |
| `› 262144 bytes ok; 262145 → image_too_large (checked before parsing)` | AC2 |
| `› the magic bytes decide: JPEG bytes give "jpeg" whatever the caller declared` | AC2 |
| `› stripPhotoMetadata JPEG: APP1 (Exif with "GPS" text), APP13 and COM removed; APP0, DQT, SOF, DHT, SOS, scan and EOI byte-identical; result passes validatePhoto; nothing to strip gives identical bytes` | Privacy (A3) |
| `› stripPhotoMetadata PNG: eXIf, tEXt, zTXt, iTXt and tIME chunks removed; IHDR, IDAT, IEND and other chunks byte-identical; result passes validatePhoto` | Privacy (A3) |
| `› Vietnamese text in a tEXt/COM payload (UTF-8 "Nguyễn") is stripped and does not break parsing` | Domain focus |
| `src/server/request/read-bytes.test.ts › list of types: image/jpeg accepted, image/gif refused "type", parameters ignored, caps unchanged` | AC2 |
| `src/server/drive/client.test.ts › DRIVE_MAX_BYTES covers PHOTO_LIMITS.maxBytes; a 262144-byte upload is sent` | consult API #1 |
| `src/app/api/me/photo/photo-routes.test.ts › PUT refusals: wrong content type, empty, 262145 declared length, 262145 streamed, bad JPEG, 513 px → 422 code, getPool and setOwnPhoto not called` | AC2 |
| `› PUT ok passes stripped bytes and type "jpeg" to setOwnPhoto(pool, getDrive, scope, sub, …); 200 with no-store` | AC2 |
| `› PUT service refusals map 1:1 (404, 409 image_changed, 409 not_allowed, 502, 503); no 401/403 from the handler` | R7 |
| `› DELETE /api/me/photo 204; GET 200 headers (Content-Type from bytes, ETag, private no-cache, nosniff, inline, CSP sandbox, Content-Length); GET 304 keeps ETag and Cache-Control` | AC3 |
| `› /api/members/[id]/photo: non-UUID id → 404 before getPool; GET as user ok; DELETE as user → 403 forbidden from withAuth and removeMemberPhoto not called; DELETE as manager and admin → 204; module exports no PUT` | AC5, R7 |
| `› no bearer → 401 on every handler` | AC3 |
| `src/server/members/photo.test.ts › every query has "org_id = $1" with scope.orgId first (R6); Drive errors give 502/503, never 401/403; a non-Drive error is rethrown` | R6, R7 |
| `src/server/members/photo.db.test.ts › first set: version 1, upload name matches /^photo-<memberId>-[0-9a-f-]{36}\.jpg$/, mimeType image/jpeg, uploadOrgFile orgId = scope org` | AC2, AC3 |
| `› replace: old file deleted after commit, version 2; a Drive delete failure logs drive_orphan {memberId} and still returns ok` | AC2 |
| `› CAS race: a concurrent set during upload → 409 image_changed and the new file is deleted` | AC2 |
| `› set while the member was deactivated after the gate → 409 not_allowed, new file deleted, no audit row, row unchanged` | R7 |
| `› no member row for sub → 404 with no Drive call` | AC2 |
| `› remove own: idempotent (second call 204, one audit row), works with getDrive returning null` | AC2 |
| `› manager removes B's photo: B's row null and version bumped, audit actor = manager sub, entity "member", entityId = B id, meta {version, self: false}` | AC5, AC6 |
| `› audit meta exactly {version, self, type, bytes} for set and {version, self} for remove; JSON of the meta contains neither the Drive id nor the image bytes` | AC6 |
| `› getMemberPhoto: other org's member id → 404 with no Drive call (R6); no photo → 404; If-None-Match match → not_modified with no Drive call; stored bytes that fail validatePhoto → 502 drive_error` | AC3, R6 |
| `› display name with diacritics ("Nguyễn Văn Ân") unaffected by set/remove (updated_at changes, display_name unchanged)` | Domain focus |
| `scripts/schema-check.mjs › block 12 (see Files)` | AC1 |

## Approach
1. **Migration** (R2). Write the SQL above, add the README bullet and add schema-check block 12. Run
   `pnpm migrate:smoke`, `pnpm migrate` and `pnpm schema:check` against the local DB.
2. **Validator** `src/lib/validate/photo.ts` (pure, no Node APIs, so slice 2's UI can import it for client-side
   pre-checks).
   - `validatePhoto(bytes)` first checks `bytes.length > PHOTO_LIMITS.maxBytes`, which gives `image_too_large`.
   - Then it picks the format by magic bytes:
     - `89 50 4E 47 0D 0A 1A 0A` → `parsePng` (APNG is already refused there; map its failure to
       `image_not_supported`).
     - `FF D8 FF` → `parseJpeg`.
     - Anything else → `image_not_supported`.
   - Then it requires `width === height && 64 <= width <= 512`, otherwise `image_bad_size`.
   - It returns `{ ok: true, type, size: width }`.
   - `parseJpeg`, a strict walk:
     - SOI at 0.
     - Then markers: skip `FF` fill bytes. Standalone `D0-D7` / `01` are only allowed inside scan data.
     - Every other marker carries a 2-byte length ≥ 2 that must fit in the buffer.
     - Exactly one SOF, and only SOF0/1/2 (`C0`/`C1`/`C2`). SOF3/5-7/9-11/13-15 → `image_not_supported`. The SOF
       segment needs `len === 8 + 3 * Nf` with `Nf` in {1, 3}; height at +5 and width at +7 (big-endian u16); height
       0 → `image_not_supported`.
     - SOS (`DA`) must come after the SOF. After the SOS header, scan entropy data until `FF xx` where `xx` is not
       `00`, not `D0-D7` and not `FF`. Several SOS segments are allowed (progressive).
     - EOI (`D9`) must come after at least one SOS and be the last 2 bytes (no trailing data, so no polyglot tail).
     - A second SOI anywhere → `image_not_supported`.
     - Never read past `length` (every access is bounds-checked).
   - `stripPhotoMetadata(bytes, type)`:
     - JPEG: copy segments before the first SOS, dropping APP1 (`E1`, Exif/XMP), APP13 (`ED`, IPTC) and COM (`FE`).
       From the first SOS to EOI, copy unchanged.
     - PNG: drop whole `eXIf`, `tEXt`, `zTXt`, `iTXt` and `tIME` chunks. Kept chunks keep their own CRCs, so none is
       recomputed.
     - It returns new bytes. The route re-validates them.
3. **readBytes** accepts a list of media types (one-line change to the comparison). The device type and map item
   callers are unchanged.
4. **Drive cap**: set `DRIVE_MAX_BYTES = 256 * 1024` and update the comment and test. The other products still
   validate their own lower limits (D68 100 KB, D66 64 KB) in their validators, so their behaviour does not change.
5. **Service** `src/server/members/photo.ts`. Copy the structure of `src/server/device-types/image.ts` l.24-187.
   - Log events are `member_photo_drive` (Drive failures, through `mapDriveFailure`) and `drive_orphan` with
     `{ memberId }`. Never log the Drive id, sub or email.
   - `PhotoResult<T> = ImageResult<T> | { ok: false; status: 409; code: "not_allowed" }`. This is a local type;
     `image-flow.ts` is not edited.
   - `setOwnPhoto(db, drive, scope, actorSub, { bytes, type })`:
     1. `select id, status, photo_drive_file_id from members where org_id = $1 and sub = $2`. Missing → 404;
        `deactivated` → 409 `not_allowed`.
     2. `uploadOrgFile(scope.orgId, { name: \`photo-${id}-${randomUUID()}.${PHOTO_EXT[type]}\`, mimeType: PHOTO_MIME[type], bytes })`.
     3. One `withTx`: `update members set photo_drive_file_id = $3, photo_version = photo_version + 1, updated_at = now() where org_id = $1 and id = $2 and status = 'active' and photo_drive_file_id is not distinct from $4 returning photo_version`,
        plus the audit row `member.photo_set`, entity `member`, entityId `id`, meta
        `{ version, self: true, type, bytes: bytes.length }`.
     4. On 0 rows: discard the new file, then re-select. Row gone → 404; deactivated → 409 `not_allowed`; otherwise
        409 `image_changed`.
     5. Error handling and post-commit delete of the old file are the same as `setDeviceTypeImage` l.109-123.
   - `removeOwnPhoto(db, drive, scope, actorSub)` and `removeMemberPhoto(db, drive, scope, actorSub, memberId)` share
     one `removeWhere` helper:
     1. `select id, sub, status, photo_drive_file_id ... for update`. For own removal: deactivated → 409
        `not_allowed` (inside the tx, before any write). Manager removal ignores the target's status.
     2. No file → ok, no audit (idempotent).
     3. Otherwise null the id, bump the version and write the audit row `member.photo_remove` with meta
        `{ version, self: row.sub === actorSub }`.
     4. After commit, best-effort `discardFile`.
   - `getOwnPhoto(db, drive, scope, sub, ifNoneMatch)` and `getMemberPhoto(db, drive, scope, memberId, ifNoneMatch)`:
     1. Row lookup by `org_id` and `sub` (own) or `org_id` and `id` (member).
     2. No file → 404.
     3. ETag `"<memberId>-<version>"`; a match returns `not_modified` before Drive.
     4. `getFile`, then `validatePhoto(f.bytes)`. Not ok → log `{event: "member_photo_drive", op: "get", code: "invalid_photo"}`
        and return 502.
     5. Return `{ kind: "bytes", bytes, etag, contentType: PHOTO_MIME[type] }`.
6. **Routes**:
   - `src/app/api/me/photo/route.ts` and `src/app/api/members/[id]/photo/route.ts`, in the order given under API
     contract. `export const dynamic = "force-dynamic"`.
   - Reuse the header constants by copying `IMAGE_HEADERS` locally. They are not exported from the device-type route;
     do not import across route files.
   - The `[id]` route checks `isCanonicalUuid` before `getPool`.
7. **Rules**:
   - R1: the lib validator is pure; the routes are the only importers of `src/server/members/photo.ts`; the new server
     file starts with `import "server-only"`. `pnpm check:layers` must be green.
   - R2: as in step 1.
   - R3: no new env var.
   - R6: every query uses `orgQuery` with `org_id = $1`; Drive ids are only used after the org-scoped row lookup.
   - R7: Manager removal is a separate `{ tier: "manager" }` handler, not a branch inside a user handler. The
     deactivated race returns 409 `not_allowed`, never 403.
   - R5: tests as listed.
8. **Local environment for the implementer** (Windows):
   - Node and pnpm are not on PATH. In PowerShell:
     ```powershell
     $fnm = Get-ChildItem "C:\Users\ttngo\AppData\Local\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter fnm.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName; & $fnm env --shell powershell | Out-String | Invoke-Expression; & $fnm use 22
     ```
     Then run commands as `cmd /c "pnpm ..."`.
   - Local Postgres: `docker compose -f compose.dev.yml up -d`, with
     `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` for `pnpm migrate`, `pnpm schema:check` and `pnpm test:db`.
9. **Commit**: `SIM-046: add member profile photo storage, validation and API`. Record in `impl-log.md` that slices 2
   and 3 are follow-ups.

## Specialist input used
- `consult-api-platform-engineer.md`:
  - Adopted:
    - #1 Raise the Drive cap.
    - #2 New photo validator with PNG + JPEG, progressive allowed, magic bytes decide.
    - #3 `readBytes` takes a set.
    - #5 Expose only `hasPhoto` / `photoVersion`.
    - #6 SIM-044.1 conflict: resolved by moving all DTO and UI work to slice 3.
    - #7 Deactivated handling: wrapper gate, plus 409 for the race (not 403, R7).
    - #9 R6 404 cross-org.
    - #10 Both route shapes.
    - Rec. 6: separate manager-tier DELETE handler.
    - Rec. 5: 304 before Drive and re-validation on read.
  - Rejected:
    - `photo_mime` column (#4). The type is re-sniffed from the bytes on every GET, which we already re-validate, so
      the column adds nothing.
    - EXIF "reject". Stripping is kinder to phone photos (A3).
    - #11 "GET only for members the caller can see": OQ-58 says Users see every member, so tier `user` matches today's
      visibility (A4).
- `consult-database-optimizer.md`:
  - Adopted:
    - Rec. 1: migration SQL, with the constraint names verbatim.
    - Rec. 2: CAS upload flow and post-commit delete.
    - Rec. 3: timestamp split 130000 / 140000. The ordering is verified in `db/migrator.js` (see Data model).
    - Rec. 4: schema-check block.
    - Rec. 5: README bullet.
    - Rec. 6: permissions.
  - Answered open questions:
    - Members are never hard-deleted: `grep "delete from members"` in `src/` finds nothing; only deactivation exists.
      So no delete-path cleanup is needed (A9).
    - The Drive folder is per org: `createOrgDrive` → `folders.resolve(orgId)` plus `appProperties {app, orgId}`
      (`src/server/drive/drive.ts` l.29-34).
    - SIM-047's column design is left to SIM-047.
  - Rejected: `for update` before the upload. The device-type precedent holds no lock across Drive and uses a CAS
    instead; the consult's own risk note is served by the CAS.

## Assumptions
Each line can be accepted as-is.

- **A1 (OQ-56) limits.** PNG or JPEG only, decided by the magic bytes. APNG is refused. Square, 64–512 px, at most
  262144 bytes. Progressive JPEG (SOF2) is allowed; lossless and arithmetic JPEG are refused. Accept?
- **A2 Content-Type.** The request header must be `image/png` or `image/jpeg`, but the bytes decide the stored and
  served type. A PNG sent as `image/jpeg` is accepted and served as `image/png`. Alternative: refuse a mismatch with
  422.
- **A3 EXIF/GPS privacy.** The server strips metadata at segment level before storing: JPEG APP1/APP13/COM and PNG
  eXIf/tEXt/zTXt/iTXt/tIME. Side effect: the EXIF orientation tag is lost. A phone JPEG that relied on it may show
  rotated; acceptable because the user must already crop it to a square. Alternatives: store the bytes as uploaded
  (keeps GPS), or refuse files with EXIF.
- **A4 (OQ-57/OQ-58) who may fetch another member's photo.** Any active member of the same org (tier `user`) may GET
  any member's photo in that org, deactivated members included. This matches who sees names on the Members page and
  seat panel today.
- **A5 (OQ-61) rights.**
  - Own upload, replace and remove: tier user.
  - Remove another member's photo: Manager and Admin (`atLeast(tier, "manager")`), audited with the actor and the
    target. Upload for others: nobody (no handler).
  - A Manager may also remove a deactivated member's photo.
  - A deactivated member cannot change their own photo (wrapper 403, or 409 `not_allowed` in the race).
- **A6 Shared Drive client.** Raise the global `DRIVE_MAX_BYTES` from 128 KB to 256 KB instead of adding a per-call
  limit. Device type and map item limits stay in their own validators, so their behaviour does not change.
  `src/server/drive/client.ts` is not on the High-path list (`.github/risk-tiers.yml`); it is called out here because
  it is shared. Accept, or make it a per-call `maxBytes`?
- **A7 Split.** This PR is server-only (slice 1). Slices 2 and 3 (see Split proposal) are filed as SIM-046.1 and
  SIM-046.2. Slice 3 waits for SIM-044.1 to merge. Accept?
- **A8 Fallback before SIM-047.** Without a photo, the fallback stays the initials `Avatar` until SIM-047 provides a
  pixel-head renderer. Slice 2 uses initials; the pixel head becomes a follow-up once SIM-047 ships.
- **A9 No hard delete.** Members are only deactivated (no `delete from members` in `src/`), so the photo file stays
  while the row exists and no delete-path cleanup is added. Orphan files after a failed post-commit delete are
  logged only (`drive_orphan`), as with device types.
- **A10 No client-side crop/resize in SIM-046.** The OQ-56 default says no server resizing. A canvas-based
  center-crop to 512 px in the browser would help users with big phone photos, but it is a follow-up UX ticket;
  slice 2 only shows the limits and pre-checks with the same `validatePhoto`. Accept, or fold it into slice 2?
- **A11 Migration timestamp and merge order.** `20261126130000_members_photo.sql` (batch reservation). The migrator
  refuses a pending file older than the newest applied one, so SIM-046 merges before SIM-047 (`20261126140000`). If
  SIM-047 merges first, SIM-046 renames its file to a later version before merge (the checksum is unaffected; it has
  never been applied).
- **A12 Audit action names.** `member.photo_set` and `member.photo_remove`, entity `member`. There is no
  action-label map in the UI to update (grep finds none).

**Overlap with other open work (hotspots):**
- **SIM-044.1** (in progress in another session) edits `src/server/members/manage.ts`, `src/lib/members/types.ts`,
  `src/server/seats/**`, `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`,
  `src/ui/members/MembersView.tsx` and its test, `src/ui/seats/SeatDetailPanel.tsx` and its test,
  `src/ui/copy/members.ts`, `src/ui/copy/seats.ts`, and the layout tests.
  - Slice 1 touches **none** of these files.
  - The only shared directory is `src/app/api/members/[id]/`, where SIM-046 adds a new `photo/route.ts` (no textual
    conflict).
  - `MemberPhotoDto` lives in the new `src/lib/members/photo.ts` so that `types.ts` is left alone.
  - Slice 3 (DTO fields in `manage.ts` / `seats.ts`, plus `MembersView` and `SeatDetailPanel`) starts only after
    SIM-044.1 merges, on a fresh branch from `main`.
- **SIM-047** (same batch, planned next) will also add a `members` migration, a `schema-check.mjs` block, a
  `db/migrations/README.md` bullet and code in `src/server/members/**`. Expected conflicts are textual only: the
  README bullet and the adjacent schema-check blocks. SIM-046 merges first; SIM-047 rebases and numbers its
  schema-check block 13.
- **SIM-045.1** edits `src/ui/portal/**` and `src/ui/copy/portal.ts`. Slice 1 does not touch them; slice 2 will, so
  slice 2 runs after SIM-045.1 merges.

## Blocking questions
None. OQ-56, OQ-57 and OQ-61 have spec defaults (A1, A4, A5). They are reversible and accepted at this plan gate.

## Split proposal
The whole ticket is about 900 product lines plus about 800 test lines, well over one cycle.

- **Slice 1, SIM-046 (this plan):**
  - Migration, validator and strip, `readBytes` list, Drive cap, service, the five route handlers, schema-check and
    tests.
  - Estimate: about 600 changed product lines (validator and strip about 220, service about 200, routes about 130,
    migration, README and schema-check about 70, `readBytes` and Drive cap about 10) plus about 700 test lines.
  - It is cohesive for one security review (all server, all High-adjacent), and the validator dominates it.
  - It covers AC1, AC2, AC3, AC5, AC6 and the server half of AC4.
- **Slice 2, SIM-046.1 (after SIM-045.1 merges):**
  - Profile tab photo section: preview, upload / replace / remove, client pre-check with `validatePhoto`, and error
    copy in `src/ui/copy/portal.ts`.
  - `src/ui/portal/photo-api.ts` and an own-photo context mounted in `src/ui/AppShell.tsx` (fetches `/api/me/photo`,
    blob URL, refresh after a change, reset on session change).
  - `Avatar.tsx` gets an optional `src`, and `AppShellView.tsx` passes the shell photo.
  - A guard test that `src/ui/roomlayout/**` and `src/lib/sprites/**` never reference a photo path.
  - Covers AC4 (shell avatar, Profile tab).
  - Note: `apiFetch` uses `cache: "no-store"` (`src/lib/api/fetch.ts` l.52), so the UI caches by `photoVersion`, as
    `image-url-cache.ts` does.
- **Slice 3, SIM-046.2 (after SIM-044.1 merges):**
  - `hasPhoto` / `photoVersion` on `MemberDto` (`manage.ts` `memberSelect`) and on the seat occupant (`seats.ts`
    `seatRows`).
  - A photo cache for lists (reuse `createImageUrlCache` with a concurrency limit of 4; failures fall back to
    initials).
  - Photo in the Members list, the member card and the seat panel occupant row.
  - "Remove photo" on the member card for Manager+.
  - Covers AC4 (lists, seat panel) and the UI of AC5.
