Status: READY

# Plan: SIM-039.4: Custom map item images per direction (upload, remove, serve)

## Scope summary
- `docs/spec-v1.md` LAY-07, lines 471-479:
  > **Art per direction.** For each direction the Admin picks a sprite from the bundled package browser (...), or
  > uploads a custom image, or leaves the library sprite. A missing direction falls back as in "Art per item"; one
  > image is never rotated to fill another direction.
  > **Custom image rules** (walls, windows and floors included): PNG only (no APNG: an `acTL` chunk is refused),
  > width = 32 × the item's width in tiles for that direction, height = 32 × its height, or up to 32 px taller for an
  > upward overhang (floors: exactly 32 × 32, no overhang); transparent background allowed; at most 64 KB. Stored in
  > Google Drive and served behind the bearer exactly like device type images (SIM-036.5: header checked on the server
  > before any DB or Drive call, server-chosen file name, org-scoped, ETag, `private, no-cache`). Removing an image
  > falls back to the next art source.
- LAY-07, lines 480-484: `desk.single` "given art per direction"; `chair.office` "only sets the art of the chair drawn at
  each seat". "Every catalog change is audited (SYS-03) and is refused for any org but the token's (R6)."
- D66 (3): "Custom images are uploaded per direction (n/e/s/w) for directional items; a missing direction falls back to
  the chosen package sprite, then the built-in frame, then the placeholder; one image is never rotated." (4): "Walls,
  windows and floors are catalog rows and accept custom uploads under the same rules." (7): "Custom images: PNG (no
  APNG), 32 px per tile of the item's size for that direction, up to 32 px upward overhang (floors exactly 32 × 32), at
  most 64 KB, Drive storage and serving as SIM-036.5."
- D68: "Device types only; map item images (SIM-039.4) decide later." The device-type 100 px / 100 KB rule
  (`IMAGE_LIMITS`) is not used here and does not change. Map items keep D66's 32 px per tile and 64 KB.
- D67 (2): hidden items are not listed for non-Admins. D67 (3): saved layouts reference the catalog row, so an image
  change shows on every saved layout.
- Ticket scope: "PUT/DELETE/GET per item and direction ... Reuse `readBytes`, a size-aware `validatePng`, `OrgDrive`,
  compare-and-set, ETag `private, no-cache`, `driveFailure` (no 401/403, R7)." Technical note: "Extract the shared
  Drive image flow from `src/server/device-types/image.ts`; keep device-type behaviour unchanged."
- Sibling note (SIM-039.2 plan l.218-221): "its compare-and-set must also compare `w` and `h` ... It can reuse
  `discardMapItemFiles`. A resize/reset nulls file ids, so an in-flight upload CAS fails with `image_changed`."
- Out of scope: rendering (039.5), the admin page and its copy (039.6), Admin-created kinds, per-desk art.

**Where this plan departs from the ticket text (for Ming at the gate):**
- **AC 1 "Wrong size ... → 422 before any DB or Drive call" cannot hold for the size check.** The expected size depends
  on the item's current `w × h` in this org, which only the DB has. The plan is: not PNG, APNG and too large → 422
  before any DB or Drive call. Wrong size → 422 after **one read-only, org-scoped select**, before any Drive call and
  with no write. Unknown key and wrong direction for a non-directional item → 404 / 422 before any DB call, because the
  library is static code.
- **"Extract the shared Drive image flow"** is done as shared helpers, not as one generic flow function.
  `src/server/drive/image-flow.ts` holds the refusal types, the Drive-failure mapping (now with a log event
  parameter), `useDrive` and `etagMatches`. Each feature keeps its own select → upload → CAS → discard sequence,
  because the SQL, audit actions, file names and log fields differ. The device-type exports, results and log lines stay
  byte-identical (see A5).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Not PNG / APNG / too large → 422 before any DB or Drive call. Wrong size → 422 after one read-only select and before any Drive call or write (departure above). | `map-items-image-routes.test.ts › PUT 422 image_not_png / image_too_large (Content-Length and streamed) / APNG never call the service`. `image.test.ts (map-items) › bad size: one select, no Drive call, no update, no audit`. `› unknown key 404 and non-directional n/e/w 422 not_allowed with zero DB calls`. |
| 2 | Replace and remove delete the old Drive file. | `image.test.ts › replace commits then deleteFile(old)`, `› remove commits then deleteFile(old)`, `› remove with Drive off still 204 and logs map_item_drive_orphan`. DB: `map-items-image.db.test.ts › replace deletes the old file; remove deletes it; second remove is 204 with no audit`. |
| 3 | Cross-org → 404. | `map-items-image.db.test.ts › org B gets 404 on PUT, DELETE and GET for org A's file, and org A's row is unchanged`. |
| 4 | Every query is scoped by the token's org (R6). | Every statement goes through `orgQuery` with `org_id = $1` (its guard throws otherwise). Reviewer greps `src/server/map-items/image.ts` for `orgQuery`; the DB test in row 3. |
| 5 | Admin-only writes are audited. | Route test: PUT/DELETE with a `user` or `manager` token → 403 from the wrapper, service not called; GET with `user` → 200. DB: `› audit: one map_item.image_set / map_item.image_remove row with meta {key, dir, version}, entity_id null, no file id; none for a refusal or no-op remove`. |
| 6 | Size rule (D66 7, LAY-07): 32 px per tile for that direction, up to 32 px upward overhang, floors exactly 32 × 32, 64 KB, PNG, no APNG. | `art.test.ts › mapItemImageFits ...` (cases under Tests), `png.test.ts › parsePng ...`, route test 64 KB boundary. |
| 7 | Device-type image behaviour unchanged. | These existing suites pass **without edits**: `src/lib/validate/png.test.ts` (existing cases), `src/server/device-types/image.test.ts`, `src/server/device-types/image.db.test.ts`, `src/app/api/device-types/image-routes.test.ts`, `src/ui/deviceTypes/*.test.ts`. Reviewer checks `git diff` shows no change to those files except the added `parsePng` block in `png.test.ts`. |
| 8 | Checks green, including `pnpm test:db` run locally. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, plus `pnpm test:db` on a local throwaway Postgres 16 (Approach step 9). Results go in impl-log. The 5 known `handoffs.db.test.ts` failures are compared against the base commit, not this ticket's (A11). |

## Ming verification after merge
- With real Drive config on the deployed server: upload a PNG for one direction of a fixture (for example a 2 × 1 table
  `e` image of 32 × 64 px with overhang). The image is created in the org's Drive folder. Replace it: the old file is
  gone from Drive. Remove it: the file is gone. Image rendering itself is 039.5, so check with the API (curl with a
  bearer) or the Drive folder only.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/validate/png.ts` | Add `export function parsePng(bytes): { ok: true; width; height } \| { ok: false; code: "image_not_png" }`, which holds today's structural loop (lines 32-67). `validatePng` becomes `parsePng` plus the unchanged `IMAGE_LIMITS` check (lines 68-71). `IMAGE_LIMITS`, `PngResult` and the results stay exactly the same. | size-aware check; device types unchanged | no |
| `src/lib/validate/png.test.ts` | Append a `describe("parsePng")` block. Existing cases stay untouched. | R5 | no |
| `src/lib/map-items/types.ts` | `MAP_ITEM_LIMITS` += `imageBytes: 65536`, `tilePx: 32`, `overhangPx: 32`. | D66 7 constants in one place | no |
| `src/lib/map-items/art.ts` | Add `mapItemImageFits(item: Pick<LibraryItem,"kind">, dir, w, h, px: {width, height}): boolean` (rule in Approach 2). | pure rule (CLAUDE.md "pure logic first") | no |
| `src/lib/map-items/art.test.ts` | `mapItemImageFits` cases. | R5 | no |
| `src/server/drive/image-flow.ts` (new) | `import "server-only"`. Exports `DriveGetter`, `ImageRefusal`, `ImageResult<T>`, `ImageGet`, `IMAGE_NOT_FOUND`/`IMAGE_UNAVAILABLE`/`IMAGE_DRIVE_ERROR` constants, `mapDriveFailure(err, op, event)`, `useDrive(drive)` and `etagMatches(header, etag)`. The bodies are moved verbatim from `device-types/image.ts` lines 14-75. The only change is the `event` parameter. | ticket technical note (extract) | no |
| `src/server/drive/image-flow.test.ts` (new) | Unit tests for the moved helpers with a custom event name. | R5 | no |
| `src/server/device-types/image.ts` | Import from `image-flow`. Re-export `DriveGetter`, `ImageRefusal`, `ImageResult`, `ImageGet` and `etagMatches`. Keep `export function driveFailure(err, op)` as a one-line wrapper calling `mapDriveFailure(err, op, "device_type_image_drive")`. `discardImageFile`, `orphan`, the SQL, the audit and the log lines stay unchanged. | extract without behaviour change | no |
| `src/server/map-items/image.ts` (new) | `setMapItemImage`, `removeMapItemImage` and `getMapItemImage` (Approach 4-6). | the feature | no |
| `src/server/map-items/image.test.ts` (new) | Service tests with a fake db and a fake `OrgDrive` (call order, refusals and logs). | R5 | no |
| `src/server/map-items/map-items-image.db.test.ts` (new) | DB integration tests (see Tests). | AC 2-5, ticket "test:db" | no |
| `src/app/api/map-items/[key]/art/[dir]/image/route.ts` (new) | PUT (admin), DELETE (admin) and GET (user), mirroring `device-types/[id]/image/route.ts`. | the API | no |
| `src/app/api/map-items/map-items-image-routes.test.ts` (new) | Route tests with a mocked service. | R5, AC 1, 5 | no |

Not touched (on purpose): `src/server/map-items/drive-cleanup.ts` (reused as is), `edit.ts`, `map-items.ts` (`COLS`
and `toDto` reused), `src/lib/api/error.ts` and `src/ui/copy/api.ts` (all codes exist; see A8), the existing JSON
route `.../art/[dir]/route.ts`, `db/migrations/**` (no schema change), and `src/server/http/**`. No High path is
touched.

## Data model / migration
None. `map_items` (`db/migrations/20261125200000_map_items.sql`, SIM-039.1) already has `art_<d>_drive_file_id`
(regex-checked, null), `art_<d>_image_version` (int, default 0) per direction, and primary key
`(org_id, builtin_key)` (R2: no migration).

## API contract
`<key>` = `builtinKey` (`isMapItemKey`), `<dir>` ∈ `n|e|s|w` (`artDir`). An invalid key or dir → 404 `not_found` before
anything else. The auth codes come only from `withAuth` (R7).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/map-items/<key>/art/<dir>/image` | body: raw PNG bytes, `Content-Type: image/png`, ≤ 65 536 bytes | 200 `MapItemDto` (with `art[dir].hasImage = true` and the bumped `imageVersion`), `Cache-Control: no-store` | 404 `not_found` (bad key/dir, key not in the library, no row in this org); 422 `image_too_large`, `image_not_png` (incl. APNG, wrong content type), `not_allowed` (n/e/w on a non-directional item), `image_bad_size`; 409 `image_changed` (lost CAS: concurrent upload/remove, resize, reset); 503 `unavailable` (no pool), `images_unavailable` (Drive off/misconfigured/rate-limited); 502 `drive_error` | Admin |
| DELETE | same | none | 204, `no-store`. Idempotent: no image → 204 with no write or audit. | 404 `not_found`; 422 `not_allowed` (n/e/w on a non-directional item); 503 `unavailable`. Works with Drive off (the file is orphaned and logged). | Admin |
| GET | same | `If-None-Match` optional | 200 PNG bytes with `Content-Type: image/png`, `ETag: "<key>-<dir>-<version>"`, `Cache-Control: private, no-cache`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Content-Security-Policy: sandbox` and `Content-Length`. 304 with the same cache headers and ETag when it matches, before any Drive call. | 404 `not_found` (no row in this org, no image for that dir, key not in the library); 503 `unavailable`/`images_unavailable`; 502 `drive_error` (Drive failure, or the stored bytes are not a structurally valid PNG) | any member (`user`), hidden items included (A7) |

Consumers (039.5/039.6): `GET /api/map-items/<key>/art/<dir>/image`. The DTO's `art[dir].hasImage` / `imageVersion`
(already in `MapItemDto`) tell them when to fetch and when to refetch.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/png.test.ts › parsePng returns width and height of a valid PNG (64 x 32)` | parser |
| `png.test.ts › parsePng: every structural failure of validatePng is image_not_png (bad signature, CRC, IHDR not first, no IDAT, acTL, data after IEND)` | APNG and structure |
| `png.test.ts › parsePng does not apply IMAGE_LIMITS (a 128 x 160 PNG is ok)` | split |
| `src/lib/map-items/art.test.ts › mapItemImageFits: floor 32x32 ok; floor 32x64, 64x64, 32x31 refused` | floors exact, no overhang |
| `art.test.ts › 1x1 fixture: 32x32 and 32x64 ok; 32x65, 32x31, 33x32 refused` | overhang bounds, never shorter |
| `art.test.ts › 2x1 item: s/n 64x32 and 64x64 ok, 64x65 refused, 32x32 refused (width)` | width = 32·tw, height in [32·th, 32·th+32] |
| `art.test.ts › 2x1 item e/w uses swapped tiles: 32x64 and 32x96 ok, 64x32 refused` | `sizeFor` swap |
| `art.test.ts › 4x4 item: 128x128 and 128x160 ok, 128x161 refused` | upper bound |
| `art.test.ts › desk (seat) and chair follow the fixture rule (overhang allowed)` | D66 2 |
| `src/server/drive/image-flow.test.ts › mapDriveFailure maps DriveConfigError→503, rate_limited/unavailable→503, other DriveError→502, logs {event, op, code} with the given event; rethrows other errors` | extraction |
| `image-flow.test.ts › etagMatches: exact, list, W/ prefix, *, null` | extraction |
| `image-flow.test.ts › useDrive throws DriveConfigError when the getter returns null` | extraction |
| `src/server/map-items/image.test.ts › unknown key → 404 and non-directional n/e/w → 422 not_allowed with zero db calls` | AC 1 |
| `image.test.ts › bad size: exactly one select (org_id = $1), no Drive call, no update, no audit, 422 image_bad_size` | AC 1 departure |
| `image.test.ts › set: select → upload (name mapitem-<key>-<dir>-<uuid>.png, image/png, orgId) → CAS update → audit → commit → deleteFile(old)` | flow order |
| `image.test.ts › CAS SQL touches only art_<dir>_* and compares file id, version, w and h` | per-direction CAS (039.2 note) |
| `image.test.ts › CAS 0 rows and the row still exists → 409 image_changed, new file deleted; row gone → 404` | lost race |
| `image.test.ts › error after the update ran (audit or COMMIT throws): new file kept, map_item_drive_orphan {key} logged, error rethrown; before it ran: new file deleted` | unknown outcome |
| `image.test.ts › upload DriveError / Drive off → 502/503 with event map_item_image_drive, no update` | `mapDriveFailure` |
| `image.test.ts › deleting the old file fails → still ok, map_item_drive_orphan {key} only (no file id)` | logs (R3) |
| `image.test.ts › remove: lock for no key update → null + version+1 → audit → commit → deleteFile(old); no image → 204-equivalent with no update or audit; Drive off → ok and orphan logged` | remove |
| `image.test.ts › get: no file → 404 without Drive; If-None-Match match → not_modified without Drive; bytes not a PNG → 502 drive_error, logged op get code invalid_png; a 32x64 PNG is served (device-type size rule not applied)` | serve |
| `src/server/map-items/map-items-image.db.test.ts › upload sets the file id and bumps the version; DTO hasImage true; audit map_item.image_set meta {key, dir, version}, entity_id null` | AC 2, 5 |
| `map-items-image.db.test.ts › replace deletes the old file; remove nulls the id, bumps the version and deletes the file; a second remove writes no audit` | AC 2 |
| `map-items-image.db.test.ts › org B gets 404 on PUT, DELETE and GET for org A's key/dir with a file, and org A's row is unchanged` | AC 3, R6 |
| `map-items-image.db.test.ts › two concurrent uploads to one dir: one ok, one 409 image_changed, the loser's file deleted` | CAS race |
| `map-items-image.db.test.ts › uploads to two dirs of one item at once both succeed and both file ids remain` | per-direction CAS |
| `map-items-image.db.test.ts › a resize (updateMapItem) during the upload → 409 image_changed and no file stored; same for resetMapItem` | 039.2 note (w/h in CAS) |
| `map-items-image.db.test.ts › a rename or a package sprite pick during the upload does not lose the image (setMapItemArt keeps the file id)` | interaction with `write()` |
| `map-items-image.db.test.ts › get returns the bytes with ETag "<key>-<dir>-<version>"; a hidden item's image is served to a user` | serve, A7 |
| `src/app/api/map-items/map-items-image-routes.test.ts › bad key or dir → 404 before the pool` | contract |
| `routes.test › PUT 422 image_too_large (Content-Length 65537 and a streamed 65537-byte body), 422 image_not_png (wrong content type, garbage, APNG); service not called` | AC 1 |
| `routes.test › PUT 65536-byte valid PNG reaches the service with the bytes` | 64 KB boundary |
| `routes.test › PUT/DELETE with a user or manager token → 403 from the wrapper, service not called; GET with user → service called` | AC 5, R7 |
| `routes.test › service refusals map to status/code; PUT 200 JSON with no-store; DELETE 204` | contract |
| `routes.test › GET 200 headers (ETag, private no-cache, nosniff, inline, CSP sandbox, Content-Length) and 304 with ETag` | contract |
| Existing device-type suites (AC 7), unedited | no regression |

## Approach
1. **PNG split (`src/lib/validate/png.ts`).** Move lines 32-67 into `parsePng`, which returns `{ ok: true, width,
   height }` or `notPng`. `validatePng(bytes)` becomes: `const p = parsePng(bytes); if (!p.ok) return p;` followed by
   the existing size test (lines 68-71). The device-type results do not change. Run the existing `png.test.ts`
   before adding the new block.
2. **Size rule (`src/lib/map-items/art.ts`).** `mapItemImageFits(item, dir, w, h, { width, height })`:
   - `kind === "floor"` → `width === 32 && height === 32`.
   - Otherwise `[tw, th] = sizeFor(dir, w, h)` and `width === tilePx·tw && height >= tilePx·th && height <= tilePx·th +
     overhangPx`, using `MAP_ITEM_LIMITS`.
3. **Extraction (`src/server/drive/image-flow.ts`).** Move `DriveGetter`, `ImageRefusal`, `ImageResult`, `ImageGet`,
   the three refusal constants, `useDrive` and `etagMatches` verbatim. `mapDriveFailure(err, op, event)` is today's
   `driveFailure` with `"device_type_image_drive"` replaced by `event`. In `device-types/image.ts`, replace those
   definitions with imports and re-exports, and keep `driveFailure(err, op)` as a wrapper with the old event string.
   Keep `log`, `orphan` and `discardImageFile` local (their log shape `{event:"drive_orphan", typeId}` is tested).
   Do not edit any device-type test.
4. **`setMapItemImage(db, drive, scope, actorSub, key, dir, bytes, png: {width,height})`** in
   `src/server/map-items/image.ts`. `import "server-only"`. `type ImageDb = TxPool & { query(...) }` (`TxPool` alone
   has no `query`; `pg.Pool` satisfies both).
   - a. `lib = libraryItem(key)`, else 404. If `!artDirAllowed(lib, dir)` → 422 `not_allowed`. No DB call yet.
   - b. One read-only `orgQuery` select: `select w, h, art_<d>_drive_file_id as file, art_<d>_image_version as version
     from map_items where org_id = $1 and builtin_key = $2`. `<d>` comes only from the closed `Direction` value (never
     request text). Use a small `col(d, "drive_file_id" | "image_version")` helper that asserts `d` is in
     `MAP_ITEM_DIRS`. No row → 404.
   - c. If `!mapItemImageFits(lib, dir, w, h, png)` → 422 `image_bad_size`. No Drive call, no write.
   - d. Upload `mapitem-${key}-${dir}-${randomUUID()}.png` with `image/png` via `useDrive(drive).uploadOrgFile(scope.orgId,
     ...)`. A failure → `mapDriveFailure(err, "upload", "map_item_image_drive")`.
   - e. `withTx`: `update map_items set art_<d>_drive_file_id = $3::text, art_<d>_image_version = art_<d>_image_version
     + 1, updated_at = now() where org_id = $1 and builtin_key = $2 and art_<d>_drive_file_id is not distinct from
     $4::text and art_<d>_image_version = $5 and w = $6 and h = $7 returning ${COLS}`. This updates one direction's
     columns only, never `edit.ts` `write()`. Rows → `applied = true`, `toDto` (null → 404 abort), then
     `writeAudit(c, scope, { actorSub, action: "map_item.image_set", entity: "map_item", entityId: null, meta: { key,
     dir, version } })`.
   - f. Error handling copies the device-type pattern. A throw after `applied` → log `{event:"map_item_drive_orphan",
     key}` and rethrow. Before that → `discardMapItemFiles(drive, [fileId], key)` and rethrow. 0 rows → discard the
     new file, then re-run the select: row → 409 `image_changed`, none → 404. Success → `discardMapItemFiles(drive,
     old ? [old] : [], key)` after commit.
5. **`removeMapItemImage(db, drive, scope, actorSub, key, dir)`.**
   - Run the library/dir checks as in 4a.
   - `withTx`: `select art_<d>_drive_file_id ... where org_id = $1 and builtin_key = $2 for no key update` (039.2 lock
     rule for non-resize edits). No row → 404. Null → no write and no audit.
   - Otherwise `update ... set art_<d>_drive_file_id = null, art_<d>_image_version = art_<d>_image_version + 1,
     updated_at = now() where org_id = $1 and builtin_key = $2 returning art_<d>_image_version`, then audit
     `map_item.image_remove`, meta `{ key, dir, version }`.
   - After commit: `discardMapItemFiles`. It works with Drive off (orphan logged).
6. **`getMapItemImage(db, drive, scope, key, dir, ifNoneMatch)`.**
   - `libraryItem(key)` null → 404. Then the org-scoped select of file and version. No file → 404.
   - ETag `"${key}-${dir}-${version}"` (the key regex is `[a-z0-9.]`, so it is quote-safe). On a match →
     `not_modified` before Drive.
   - Otherwise `getFile`. Check structure with `parsePng(bytes).ok` (not the size; see A6). A non-PNG file → log
     `{event:"map_item_image_drive", op:"get", code:"invalid_png"}` and 502. Drive errors go through `mapDriveFailure`.
   - No `artDirAllowed` check on GET: n/e/w of a non-directional item never has a file, so it is 404 anyway.
7. **Route** `src/app/api/map-items/[key]/art/[dir]/image/route.ts`. It is a copy of the device-type route shape. Use
   `withAuth<{ key: string; dir: string }>`.
   - Order: `isMapItemKey(key)` and `artDir(dir)`, else 404. Then `getPool()`, else 503.
   - PUT then runs `readBytes(req, MAP_ITEM_LIMITS.imageBytes, "image/png")` → 422 `image_too_large`/`image_not_png`,
     then `parsePng` → 422 `image_not_png`, then the service with `{width, height}`. JSON 200 with `no-store`.
   - DELETE → 204 `no-store`. GET → the same response block as the device-type route (copy `IMAGE_HEADERS`).
   - Tiers: PUT/DELETE `admin`, GET `user`. The route sits on a sibling path, so the existing JSON `PUT .../art/[dir]`
     is untouched.
8. **Rules.**
   - R1: lib code stays pure; the route is the only entry into `src/server/**`; new server files start with `import
     "server-only"`; `pnpm check:layers`.
   - R2: no schema change.
   - R3: no new env; logs carry key, dir, op and code only, never file ids or bytes.
   - R4: only the files listed.
   - R5: the tests above.
   - R6: `orgQuery` with `org_id = $1` everywhere; org and tier only from the token.
   - R7: refusals are 404/409/422/502/503 and never 401/403; Drive errors never map to 401/403.
9. **Checks.**
   - Run the five Checks in `loop.config.md`.
   - Run `pnpm test:db` on a throwaway PostgreSQL 16 cluster exactly as SIM-039.1 plan step 11
     (`work/tickets/SIM-039.1/plan.md` l.294-310): `initdb`/`pg_ctl` under a `mktemp -d` dir (session scratchpad or
     `/var/tmp`), port 55432, trust auth, localhost only, `DATABASE_URL` passed inline. Never read or write `.env*`.
     Run `pnpm migrate && pnpm migrate:smoke && pnpm schema:check && pnpm test:db`, then stop the cluster and remove
     the dir.
   - Also run `pnpm test:db` once on the base commit (`git stash -u` or a worktree of `origin/main`). Record both
     pass/fail lines (not the URL) in impl-log.

## Specialist input used
(`consult-api-platform-engineer.md`)
- Findings 1 (size check needs a read-only select): **adopted** as the AC 1 departure.
- Finding 2 (split `png.ts` into a parser and two checks; `IMAGE_LIMITS` untouched; 64 KB in `MAP_ITEM_LIMITS`):
  **adopted**. The map-item rule lives in `src/lib/map-items/art.ts` next to `sizeFor`, not in `png.ts`.
- Finding 2 "GET re-validation": **adopted as structural-only** (A6).
- Finding 3 (sibling `/art/[dir]/image` path; do not overload the content type): **adopted**.
- Finding 4 (CAS on file id + w + h, ideally version; closed column names; 0 rows → 409/404; orphan on unknown
  outcome): **adopted**, with the version included.
- Finding 5 (upload does not clear the package sprite and the sprite pick does not clear the file): **adopted** (A4).
- Finding 6 (idempotent remove, `for no key update`, works with Drive off): **adopted**. The dir rule was picked
  (A3).
- Finding 7 (ETag `"<key>-<dir>-<version>"`): **adopted**.
- Finding 8 (extraction keeping device-type exports and log events): **adopted** as helper extraction. The generic
  `uploadWithCas` helper was **rejected**: it would reshape the device-type flow for little gain (A5).
- Audit actions and meta, `entityId: null`: **adopted** (039.2 correction).
- Recommendation 5 (copy may say "device type"): **checked**. `image_bad_size` and `image_too_large` copy names the
  device-type limits. No change here (A8).
- Test list (rec. 4) and the race tests (rec. 2): **adopted**. The resize and reset races and the two-direction
  concurrency were added.
- Open questions 1-6 → A1, A2, A3, A4, A5, A9.

## Assumptions
For Ming at the plan-approval gate. Each one is reversible, and the alternative is given.
- **A1 Height rule.** Non-floor image height must be within [32 × tilesH, 32 × tilesH + 32]: never shorter, and at most
  32 px taller. Width is exactly 32 × tilesW. Tiles come from the item's current size for that direction (e/w swap,
  D66 7). This applies to every non-floor item: fixtures (walls and windows included, any direction), `desk.single`
  and `chair.office`. Floors are exactly 32 × 32. Alternative: also allow a shorter image (drawn bottom-aligned).
- **A2 Route shape.** `/api/map-items/<key>/art/<dir>/image` (PUT/DELETE/GET), a sibling of the existing JSON
  sprite-pick route. 039.5 and 039.6 will use this path.
- **A3 Non-directional items.** PUT and DELETE on `n`/`e`/`w` → 422 `not_allowed`, consistent with the sprite pick
  (`setMapItemArt`). GET → 404 (there is never a file there). Alternative: an idempotent 204 for DELETE on any dir.
- **A4 Upload leaves the chosen package sprite in place, and picking a sprite leaves the custom image in place.** After a
  remove, the item falls back to that sprite (LAY-07 "falls back to the next art source"; D66 3 order: custom image →
  chosen sprite → built-in frame → placeholder). Which one draws is 039.5's job. `setMapItemArt` is not changed (R4).
- **A5 Extraction scope.** The shared helpers move to `src/server/drive/image-flow.ts`. Device types keep every
  exported name, result and log line (`device_type_image_drive`, `drive_orphan {typeId}`). Map items log
  `map_item_image_drive {op, code}` and reuse `map_item_drive_orphan {key}`. Alternative: import the helpers from
  `device-types/image.ts` directly (smaller diff, but a cross-feature import).
- **A6 GET checks structure only.** A file is never re-checked against the current size, so a resize race never gives a
  false 502. A resize or reset deletes the file anyway (039.2).
- **A7 GET serves hidden items' images to any member.** Placed copies of a hidden item still draw on maps (LAY-07), and
  the layout read includes them (039.3). D67 (2) is about the catalog list only.
- **A8 Error copy.** Codes `image_bad_size`, `image_too_large` and `image_not_png` are reused, and
  `src/ui/copy/api.ts` is not changed. Today's text names the device-type limits ("square, 24-100 px", "100 KB").
  039.6 must show map-item-specific messages from `src/ui/copy/<feature>.ts` (the expected `W × H` and 64 KB) instead
  of `apiErrorMessage` for these codes. Alternative: new codes `item_image_bad_size`/`item_image_too_large` here.
- **A9 `chair.office` and `desk.single` accept images** (D66 2, LAY-07 l.480-482). Their direction rule follows the
  library's `directional` flag, like every item.
- **A10 CAS also compares `art_<d>_image_version`** besides the file id, `w` and `h`. A remove-then-upload by
  someone else between the select and the CAS gives 409 instead of a silent overwrite.
- **A11 Pre-existing `pnpm test:db` failures.** The planner has no shell, so this was checked by reading the code only.
  `src/server/devices/handoffs.ts` l.174-179 still runs the `insert into device_handoffs ...` through `orgQuery`
  without `org_id = $1` in its text, so the 5 `handoffs.db.test.ts` "start" failures (SIM-039.1 impl-log l.35) most
  likely still fail on main. The implementer confirms this by running the base commit (Approach 9). These failures are
  not this ticket's and are not fixed here (R4). If they still fail, they need their own BUG ticket.
- **A12 Size.** Product code is about 300 lines (route ~90, service ~170, helpers ~40, lib ~20) and tests about 650.
  This is one cycle (Size M).
- **Hotspots.** `src/server/device-types/image.ts` and `src/lib/validate/png.ts` are not edited by any open ticket.
  SIM-037.5 (PLANNING) works on devices and handoffs. SIM-039.7 (BACKLOG) will touch device types later and should
  build on `image-flow.ts`. No rebase expected.

## Blocking questions
None.

## Split proposal
None.
