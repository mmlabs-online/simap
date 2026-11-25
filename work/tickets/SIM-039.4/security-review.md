## Attempt 1

## Security review: SIM-039.4, attempt 1 (read-only)

I found no blockers. Two should-fix items and the rest pass. I had no Bash tool, so I read the files directly and did not run `git diff`. I checked "device-type behaviour unchanged" against the current `device-types/image.ts`, the device-type route and the plan's extraction notes. I did not read any `.env*` file.

### Findings

**🟡 1. A rare path can save an image to the DB and then delete its Drive file.** `/home/user/simap/src/server/map-items/image.ts:103-106` and `:123-124`
- **What happens:** inside the transaction, `applied = true` is set after the update. When `toDto(rows[0])` returns null, the callback returns `null`, so `withTx` COMMITS the update (new `art_<d>_drive_file_id`, version+1, no audit row). Line 123 then reads `!dto` as a lost race, deletes the new Drive file and returns 409/404.
- **Result:** the row points at a deleted file. GET then answers 502 for good, and the change has no audit row.
- **Plan conflict:** plan.md:174 says "toDto (null → 404 abort)", meaning roll back.
- **How likely:** today this cannot happen, because `libraryItem(key)` is checked at line 68 and the library is static. It becomes reachable if `toDto` ever gets another null case.
- **Fix:** on null, throw inside the callback so the transaction rolls back, e.g. `if (!out) throw new Error("map_item_not_in_library")`. Or keep `applied` false until `toDto` succeeds. Add a unit test where `toDto` returns null and check: rollback, no audit, and the new file is deleted.

**🟡 2. The ETag is not unique per org, so the browser cache can mix up images across orgs.** `/home/user/simap/src/server/map-items/image.ts:189` (the route sends it at `route.ts:72,78`)
- **The cause:** the ETag is `"${key}-${dir}-${version}"`. `builtinKey` is a shared library key, so org A and org B both have `desk.small`/`s`/version 1. The URL is also the same for both orgs, and the browser cache keys on the URL; the Authorization header is not part of that key and there is no `Vary`.
- **Result:** a user who belongs to two orgs and switches between them sends org A's cached ETag to org B. The route answers 304, and the browser shows org A's art inside org B. This is a cross-org display mix-up (CWE-524 style). No data reaches another person, but it breaks the "org data stays in its org" rule (R6 intent).
- **Why device types don't have this:** their ETag uses a UUID `id`.
- **Not live yet:** no UI calls this route today; it will be once the catalog UI fetches it.
- **Fix:** put the org into the tag, e.g. `"${key}-${dir}-${version}-${shortHash(scope.orgId)}"` (a hash, so the raw org id is not exposed). Or add `Vary: Authorization` to both the 200 and 304 headers. Add a route or DB test: org B with org A's ETag gets 200 or 404, never 304.

### Checks that pass (🟢)

- **R7 (auth codes only from the wrapper):** PUT and DELETE use `{ tier: "admin" }`, GET uses `{ tier: "user" }`. Every 401/403 comes from `with-auth.ts:60-75` before the handler runs. The service only refuses with 404/409/422/502/503. `mapDriveFailure` (`image-flow.ts:33-45`) maps Drive errors to 502/503, never 401/403.
- **R6 (org scoping, cross-org → 404):** every SQL statement goes through `orgQuery` with `org_id = $1` bound to `ctx.scope.orgId`: `selectImage` :44-51, the CAS update :94-102, the remove select and update :147-162, and the re-select :125. A missing row in the token's org gives 404. Audit uses `writeAudit(c, scope, …)`.
- **Upload cap:** `readBytes` (`read-bytes.ts:11-45`) checks the content type, refuses a declared `Content-Length` over 65536 without reading, and stops a stream as soon as it passes the cap (cancels and returns `too_large`). All of this runs after auth and before any DB or Drive call. The cap is `MAP_ITEM_LIMITS.imageBytes = 65536` (`types.ts:13`).
- **PNG checks before any Drive call or write:**
  - Structure is checked in the route (`route.ts:32-33`) before the service runs. `parsePng` checks signature, chunk bounds (unsigned length, `end + 4 > length`), CRC, IHDR first with length 13, a second IHDR or `acTL` refused (APNG), at least one IDAT, and IEND last with length 0 and nothing after it.
  - The direction rule (`artDirAllowed`) runs before any DB call.
  - The size rule (`mapItemImageFits`) runs after one read-only select and before the upload. Floor items must be exactly 32x32. Other items must be 32 px per tile wide and 32 px per tile tall plus up to 32 px overhang, with w/h swapped for e/w.
- **Drive file ids never leave the server:** `COLS` (`map-items.ts:34-37`) returns only `has_image`. Audit meta is `{ key, dir, version }`. Logs carry only event, op, code or key (`image.ts:118,195`, `drive-cleanup.ts:16`, `image-flow.ts:35,39`), and the wrapper logs only `err.code`. Upload file names are chosen by the server (`mapitem-${key}-${dir}-${uuid}.png`, with the key checked by regex).
- **No SQL injection through column names:** `col()` (`image.ts:39-42`) only builds names from `Direction`, and asserts it against `MAP_ITEM_DIRS`. `artDir` (`map-item.ts:21-22`) only allows n/e/s/w; `isMapItemKey` is `^[a-z0-9]+(\.[a-z0-9]+)*$` with at most 100 characters. All values are bound as parameters.
- **Compare-and-set:** the update requires the same file id (`is not distinct from`), the same version and the same `w`/`h`, so a concurrent resize, remove or second set makes it match 0 rows. Then the new file is deleted and the answer is 409 or 404 (`:123-125`). On success the old file is deleted after commit (`:127`). Remove holds a `for no key update` lock and bumps the version, so a set racing with it loses its compare-and-set. If the audit insert or COMMIT fails after the update, the new file is kept and logged as an orphan.
- **GET headers:** `nosniff`, `Content-Security-Policy: sandbox`, `Content-Disposition: inline`, `Content-Type: image/png`, `private, no-cache`, `Content-Length` and `ETag`. The 304 also carries nosniff and the ETag. Bytes read back from Drive are checked again with `parsePng` (structure only, as planned in A6); a non-PNG gives 502 and is logged without the file id.
- **Device types:** the route still calls `readBytes(…, IMAGE_LIMITS.maxBytes = 102400)` and then `validatePng`. `validatePng` is now `parsePng` plus the square 24-100 px rule, with the same codes. The service keeps its SQL, audit, `drive_orphan` and `device_type_image_drive` log shapes, and `driveFailure` is a one-line wrapper. I see no behaviour change.

### Follow-ups (out of scope)
- When the catalog UI starts fetching this route, make sure it goes through `apiFetch` with the bearer token and that the ETag fix (finding 2) is in place first.
- `discardMapItemFiles` and `discardImageFile` are near-duplicates and could move into `image-flow.ts` later.

### Files
- /home/user/simap/src/app/api/map-items/[key]/art/[dir]/image/route.ts
- /home/user/simap/src/server/map-items/image.ts
- /home/user/simap/src/server/drive/image-flow.ts
- /home/user/simap/src/lib/validate/png.ts
- /home/user/simap/src/lib/map-items/art.ts
- /home/user/simap/src/server/request/read-bytes.ts
- /home/user/simap/src/server/device-types/image.ts
- /home/user/simap/work/tickets/SIM-039.4/plan.md (line 174: the "abort" wording)
