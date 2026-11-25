# Implementation log: SIM-039.4

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/lib/validate/png.ts` | `parsePng` (structure + IHDR size); `validatePng` = `parsePng` + unchanged `IMAGE_LIMITS` check |
| `src/lib/validate/png.test.ts` | new `describe("parsePng")` block appended; existing cases untouched |
| `src/lib/map-items/types.ts` | `MAP_ITEM_LIMITS` += `imageBytes`, `tilePx`, `overhangPx` |
| `src/lib/map-items/art.ts`, `art.test.ts` | `mapItemImageFits` and its cases |
| `src/server/drive/image-flow.ts` (new), `image-flow.test.ts` (new) | shared Drive helpers moved from device-types (`mapDriveFailure` takes the log event) |
| `src/server/device-types/image.ts` | imports/re-exports the helpers; `driveFailure` is a wrapper with the old event name |
| `src/server/map-items/image.ts` (new), `image.test.ts` (new), `map-items-image.db.test.ts` (new) | set / remove / get service and tests |
| `src/app/api/map-items/[key]/art/[dir]/image/route.ts` (new), `src/app/api/map-items/map-items-image-routes.test.ts` (new) | PUT / DELETE / GET route and tests |

### Tests added / changed
- `png.test.ts › parsePng` (3 tests), `art.test.ts › mapItemImageFits` (6), `image-flow.test.ts` (4), `map-items/image.test.ts` (14), `map-items-image-routes.test.ts` (9), `map-items-image.db.test.ts` (9).
- No device-type test file was edited (`device-types/image.test.ts`, `image.db.test.ts`, `image-routes.test.ts`, `src/ui/deviceTypes/*` unchanged and passing).

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0
- check:layers: exit 0, "738 files, no violations"
- test: exit 0, 279 files passed, 2847 tests passed, 7 skipped
- build: exit 0
- Local throwaway PostgreSQL 16 cluster (under /var/tmp, port 55432, trust, 127.0.0.1; DATABASE_URL inline; cluster stopped and dir removed):
  - `pnpm migrate && pnpm migrate:smoke && pnpm schema:check`: exit 0, "schema check ok"
  - `pnpm test:db` (this branch): 3 files failed, 9 tests failed, 263 passed (272 total)
  - `pnpm test:db` (base commit f115c60, via `git stash -u`): 3 files failed, 9 tests failed, 254 passed (263 total)
  - The 9 failures are identical on both: 7 in `handoffs.db.test.ts`, 1 in `devices.db.test.ts` (`canReturn ...`), 1 in `members/manage.db.test.ts` (`deactivate with release ...`). They are pre-existing, not this ticket's (A11). The 9 new `map-items-image.db.test.ts` tests all pass (+9 passed vs base).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- The 9 `test:db` failures above exist on main (handoff start / devices return flags / members deactivate); they need their own BUG ticket (A11 expected 5 in handoffs; there are 9 across 3 files).
- 039.6 must show map-item-specific copy for `image_bad_size`, `image_too_large`, `image_not_png` (A8).
- `MapItemImageRefusal` (422 codes) is local to `map-items/image.ts`; `ImageRefusal` in `image-flow.ts` stays 404/409/502/503 so device types are unchanged.

### Scope self-check
- Could the diff be smaller? No; only the planned files.
- Diff size: product code about 330 lines (route 80, service 190, image-flow 60, lib 30), the rest tests.

## Attempt 2 (REWORK: security-review finding 2)

- `src/server/map-items/image.ts`: new `mapItemEtag(scope, key, dir, version)` gives `"<key>-<dir>-<version>-<12 hex of sha256(orgId)>"`, so the tag is org-specific and the org id is not exposed. New `IMAGE_VARY` constant (`Authorization`), kept in the server module because `routes-guarded.test.ts` forbids the word in route files.
- `src/app/api/map-items/[key]/art/[dir]/image/route.ts`: `Vary: IMAGE_VARY` added to the shared image headers (200 and 304).
- Tests: `image.test.ts` (org-specific ETag, no raw org id), `map-items-image.db.test.ts` (org B sending org A's ETag gets bytes, not 304), `map-items-image-routes.test.ts` (Vary on 200 and 304).
- Device-type code untouched.
- Checks: format:check clean; typecheck, check:layers ok; `pnpm test` 279 files passed, 2847 tests passed, 7 skipped. `pnpm test:db` on a throwaway Postgres 16 (removed after): all map-items DB tests pass; 9 failures remain only in `devices/*.db.test.ts` and `members/manage.db.test.ts` (outside this ticket, not touched).
- Out-of-plan files: none. Follow-up: device-type image ETag has the same cross-org shape (id is a UUID, so low risk); not changed per instruction.
