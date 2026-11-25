## Findings

**What exists (reusable)**
- Device-type flow is in `src/server/device-types/image.ts`. Generic parts are `driveFailure`, `etagMatches`, `DriveGetter`, `ImageRefusal` and `useDrive`. Everything else is device-type specific: the SQL on `device_types`, the `devtype-<id>-<uuid>.png` file name, the `device_type.image_*` audit actions, the ETag `"<id>-<version>"` and the log event names `device_type_image_drive` / `drive_orphan`. Logs use `typeId`.
- The route `src/app/api/device-types/[id]/image/route.ts` is the template. PUT and DELETE are tier `admin`, GET is tier `user`. Order in PUT: uuid check (404), pool (503), `readBytes(req, maxBytes, "image/png")` (422 `image_too_large` / `image_not_png`), `validatePng` (422), then the service. GET sets `private, no-cache`, nosniff, `Content-Disposition: inline`, CSP sandbox and Content-Length. 304 is answered before any Drive call.
- `src/lib/validate/png.ts` (SIM-040): `validatePng(bytes)` checks structure only (signature, CRC, IHDR first, IDAT, no `acTL`, IEND last). The size rule is hard-wired to the device-type `IMAGE_LIMITS`: square, 24–100 px. A rectangular 64x32 file returns `image_bad_size`. Map items cannot use `validatePng` as it is.
- `map_items` (migration `20261125200000_map_items.sql`) already has per direction `art_<d>_drive_file_id` (regex-checked), `art_<d>_image_version` (default 0) and `art_<d>_sprite`. Primary key is `(org_id, builtin_key)`. **No migration is needed (R2).**
- `src/server/map-items/edit.ts`: `lockRow`, `fromRow`, `write` (rewrites all art columns), `dropFile` and `deletedIds`. `drive-cleanup.ts` has `discardMapItemFiles(drive, ids, key)` with event `map_item_drive_orphan`. `COLS` / `toDto` in `map-items.ts` never select a file id and expose `hasImage` and `imageVersion`.
- Rules in `src/lib/map-items/art.ts` and `library.ts`: `sizeFor(dir, w, h)` swaps w and h for e/w, `artDirAllowed(lib, dir)` limits non-directional items to `s`, and `libraryItem(key)` gives `kind` (floor, chair, ...) with no DB access.
- The existing `PUT /api/map-items/[key]/art/[dir]` takes **JSON** (`{sprite}`) and calls `setMapItemArt`. Routes `[key]/route.ts` and `[key]/reset/route.ts` also exist.
- Error codes `image_not_png`, `image_bad_size`, `image_too_large`, `image_changed`, `images_unavailable` and `drive_error` are already in `src/lib/api/error.ts` and `src/ui/copy/api.ts`. The copy may say "device type"; check it.
- `DRIVE_MAX_BYTES` is 128 KB, so a 64 KB map-item image fits.
- 039.2 already clears or deletes custom files on resize and reset (`dropFile`). Those bump the version and null the file id. An in-flight upload therefore fails its compare-and-set with `image_changed`.

**Conflicts and traps**
1. **"422 before any DB or Drive call" cannot hold for the size check.** The expected size depends on the row's current `w` and `h`.
   - Before any DB call: PUT body type and size (`readBytes`, 64 KB), structural `validatePng`, key regex, `artDir`, `libraryItem(key)` (404 if unknown), `artDirAllowed` (422 `not_allowed`).
   - After a read-only select of `w, h` (and the current file id), but before any Drive call: the dimension check.
   - Wording to propose: "no Drive call, and no write".
2. **A shared, size-aware PNG check is needed, and device types must not change.**
   - Split `png.ts` into a structural parser that returns `{ width, height }` or a not-png result, plus two thin checks. `validatePng` keeps its exact signature, `IMAGE_LIMITS` and result codes. Add something like `parsePng(bytes)` and `validateMapItemPng(bytes, { w, h, floor })` (or a generic `validatePngSize`).
   - Map-item rule (spec LAY-03, line 474): width = 32 × tilesW. Height is 32 × tilesH up to 32 × tilesH + 32. Floors are exactly 32x32 (`kind === "floor"` from the library). Tiles come from `sizeFor(dir, w, h)`.
   - "Up to 32 px taller" is ambiguous. Does it include an image shorter than 32 × tilesH? The plan should say no: height must be in [32·th, 32·th + 32].
   - Map-item max is 64 KB. Put it in `MAP_ITEM_LIMITS`, e.g. `imageBytes: 65536`. Do not touch `IMAGE_LIMITS`.
   - The GET re-validation after the Drive read needs the same size-aware check against the current w/h. It cannot use the device-type `validatePng`: 32x64 art would fail it.
   - Optionally the GET only checks structure and size-agnostic validity, to avoid a false 502 after a resize race. The file is deleted on resize anyway.
3. **Route path clash.** `PUT .../art/[dir]` is already JSON for the package sprite. Add the image on a sibling path, e.g. `src/app/api/map-items/[key]/art/[dir]/image/route.ts` with PUT, DELETE and GET. Do not overload the content type. Mirrors `device-types/[id]/image`.
4. **Compare-and-set (from 039.2 plan, line 218).** The CAS must compare the file id and also `w` and `h`, and ideally the version:
   `update map_items set art_<d>_drive_file_id = $, art_<d>_image_version = art_<d>_image_version + 1, updated_at = now() where org_id = $1 and builtin_key = $2 and art_<d>_drive_file_id is not distinct from $old and w = $w and h = $h returning ...`
   - Column names are built from a closed `d` taken from `artDir`/`MAP_ITEM_DIRS`, never from user text.
   - A zero-row CAS: delete the new file and answer 409 `image_changed` if the row still exists, else 404.
   - Keep the device-type pattern: if the audit insert or COMMIT throws after the update ran, keep the file and log an orphan. Otherwise discard it.
5. **Picking a package sprite leaves a custom image in place** (039.2 note). Upload does not need to clear `art_<d>_sprite`, and the sprite pick does not clear the file. The render priority (custom image, then sprite, then library) is 039.5's call. Document it in the plan. Do not "fix" `setMapItemArt` here (R4).
6. **Remove is idempotent.** Use `select ... for no key update` of the row, then, if the file id is not null, an update that nulls it and bumps the version, then audit, then best-effort `discardMapItemFiles` after commit. No file means 204 with no audit. An unknown or foreign row means 404. It works with Drive off, as device types do. The remove path must also be allowed for `n/e/w` on non-directional items. The simplest rule is the same `artDirAllowed` 422 `not_allowed` as upload. Alternatively allow remove on any dir (idempotent). Pick one.
7. **ETag.** Use `"<key>-<dir>-<version>"`. The key regex has only `[a-z0-9.]`, so it is quote-safe. Since versions only increase, ETags are unique after replace, remove or resize. The default 0 plus a null file id means no ETag, so 404.
8. **Extraction.** Keep the device-type exports (`setDeviceTypeImage`, `removeDeviceTypeImage`, `getDeviceTypeImage`, `driveFailure`, `discardImageFile`, `etagMatches`) with identical behaviour and logs. Existing tests and the SIM-036.5 contract depend on them. Minimal safe extraction:
   - New `src/server/drive/image-flow.ts` (or `server/images/`) containing `DriveGetter`, `ImageRefusal`, `driveFailure(err, op, event)`, `etagMatches`, `useDrive` and a generic `uploadWithCas({ upload, cas, onApplied })` helper.
   - Device types re-export the old names, passing their log event string (`device_type_image_drive`).
   - Do not rename existing log events; dashboards may rely on them.
   - The extra work is optional. A smaller option is for map-items to import `driveFailure`, `etagMatches`, `DriveGetter` and `ImageRefusal` directly from `device-types/image.ts`, but a cross-feature dependency is poor structure. If device-type files change, run their existing tests unchanged.
   - Note `driveFailure` hard-codes the event `device_type_image_drive`. Parametrize it or add a map-item wrapper so the log names the right feature.

**Route handlers, R6, R7, audit**
- The auth wrapper `withAuth` (tier `admin` for PUT and DELETE, `user` for GET) is the only source of 401/403 (R7). `driveFailure` maps to 502 `drive_error` and 503 `images_unavailable`, never 401/403. Drive config errors map to 503.
- Order in PUT: key and dir validation (404), pool (503), `readBytes` and structural PNG (422), `libraryItem`/`artDirAllowed` (404/422), org-scoped select of w, h, file id (404), dimension check (422 `image_bad_size`), Drive upload, CAS transaction and audit, delete the old file.
  - Wrong size, not PNG and too large are all 422 and none writes or calls Drive.
  - Unknown key is 404, and cross-org is 404 because every statement uses `orgQuery` with `org_id = $1` (R6). Org and role come only from the token.
- Audit actions `map_item.image_set` and `map_item.image_remove`, with `entity: "map_item"`, `entityId: null` (uuid column, per the 039.2 correction) and `meta: { key, dir, version }`. Never log file ids or bytes. Orphan log: `{ event: "map_item_drive_orphan", key }` only.
- Rate and size caps: `readBytes` must be given the 64 KB limit, not `IMAGE_LIMITS.maxBytes`.
- Response of PUT: the updated `MapItemDto` (`toDto` returns null for a key not in the library; handle as 404). Header `Cache-Control: no-store` for JSON, as the other map-item routes.
- Resize and reset already delete files (039.2) and bump the version. Add a test that an upload CAS loses to a resize and to a reset (`image_changed`).

## Recommendations (by acceptance criterion)
1. AC "422 before DB or Drive": split validation as above. State the plan wording as "before any Drive call or write; the size check needs one read-only row select". Check that the test asserts the pool and Drive mocks are untouched for not-png and too-large, and Drive untouched for bad-size.
2. AC "replace and remove delete the old Drive file; cross-org 404": reuse `discardMapItemFiles` after commit, as the plan for 039.2 already says. The DB tests must show an org B token gets 404 on org A's key for PUT, DELETE and GET. Use a throwaway DB (`pnpm test:db`). Include the replace race (two concurrent PUTs, one 409) and the w/h-changed CAS case.
3. AC "R6 and audited": one audit row per applied change, none for a no-op remove. Add a DB test for audit meta and for `org_id` scoping.
4. Tests to list in the plan:
   - unit tests for the size-aware PNG check (exact 32x32 floor; 64x32 for a 2x1; 64x64 for a 2x1 with overhang; 64x65 refused; width mismatch; e/w swap; APNG; 64 KB boundary);
   - unit tests for the extracted helpers;
   - route tests (mocked service) for the three methods;
   - service tests with a fake `OrgDrive`;
   - DB tests;
   - the unchanged device-type test suites must still pass without edits.
5. Update `src/ui/copy/api.ts` only if the existing image error copy says "device type". Messages for the map-item context may need to be neutral. That is shared append-only copy; keep edits minimal.
6. Keep UI out (039.6) and rendering out (039.5). The DTO already has `hasImage` and `imageVersion`, which is enough for them. GET URL for them: `/api/map-items/<key>/art/<dir>/image?v=<imageVersion>` or with the ETag.
7. Size estimate: product code about 350 lines, tests about 60%. Size M is realistic.

## Risks
- Splitting `png.ts` touches a shared validator used by device types (SIM-040). A regression there changes live behaviour. Mitigate by keeping the old function body behaviour and tests identical.
- Extracting `driveFailure` and renaming events could silently change device-type logs or error mapping.
- If the CAS omits w/h, a resize between check and upload could store a wrongly sized image (039.2 note).
- Dimension check on GET against the current size could produce a false 502 after a resize race. Prefer a structural-only check on GET, or accept the narrow window.
- Concurrent PUTs to different directions of one row do not conflict logically, but both write the same row. Each CAS touches only its own direction's columns, so they serialize on the row lock and both succeed. Make sure the update does not use `write()` (which rewrites all art columns from a stale snapshot). Use a per-direction update.
- Floors being 1x1 and "exactly 32x32" depends on the library `kind`. `fixedSize` and `kind` should both be consulted by the validator, not one by guess.
- Mixed-case hazards: `art_<d>` column names built by string interpolation. Only from the closed `Direction` union.

## Open questions for the planner
1. Overhang rule: may the image be shorter than 32 × tilesH? (Proposed: no.) Does the overhang apply to wall and window items for e/w directions too (it only adds height)? Does the overhang apply when `tilesH` grows after rotation (for e/w use `sizeFor`)? Confirm with Ming's D66 wording (the spec line 475 reads as upward only).
2. Route shape: the sibling `/art/[dir]/image` (recommended) versus a differently named path. Confirm with the 039.6 admin page consumer.
3. Should remove or upload be allowed on `n/e/w` for non-directional items? (Proposed: 422 `not_allowed` for upload; remove either way idempotent.)
4. Should uploading an image clear the chosen package sprite, or leave it (fallback after remove)? (Proposed: leave it; remove "falls back to the next art source", spec line 478.)
5. Extract to a shared module (cleaner, touches device types) or import from `device-types/image.ts` (smaller diff)? The ticket says extract; confirm that re-exporting device-type names with unchanged behaviour is the acceptable minimum.
6. Does Ming want the chair row (`chair.office`) to accept images? It is not hidden-able and not placeable, but it is a catalog item with art, so the answer is probably yes, directional per the library. Check `library.ts` flags.

Files read: /home/user/simap/work/tickets/SIM-039.4/ticket.md, /home/user/simap/work/tickets/SIM-039.2/plan.md (lines 205–279), /home/user/simap/src/server/device-types/image.ts, /home/user/simap/src/app/api/device-types/[id]/image/route.ts, /home/user/simap/src/lib/validate/png.ts, /home/user/simap/db/migrations/20261125200000_map_items.sql, /home/user/simap/src/server/map-items/edit.ts, /home/user/simap/src/server/map-items/drive-cleanup.ts, /home/user/simap/src/server/map-items/map-items.ts, /home/user/simap/src/app/api/map-items/[key]/art/[dir]/route.ts, /home/user/simap/src/lib/map-items/art.ts, /home/user/simap/docs/spec-v1.md (lines 468–482).
