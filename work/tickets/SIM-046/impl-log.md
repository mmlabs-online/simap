
## Attempt 1 - 2026-11-26

Slice 1 of 3 (server only). SIM-044.1 was already on main; none of the plan's files conflicted, no adaptation needed.

### Files touched
| File | Required because |
|---|---|
| db/migrations/20261126130000_members_photo.sql | AC1, R2: expand-only columns and checks |
| db/migrations/README.md | migration convention bullet |
| scripts/schema-check.mjs | block 12 and "1 later run applies members_photo" |
| src/lib/validate/photo.ts | OQ-56 validator, JPEG parser, metadata strip |
| src/lib/members/photo.ts | MemberPhotoDto (kept out of types.ts) |
| src/server/request/read-bytes.ts | accepts a list of media types |
| src/server/drive/client.ts | DRIVE_MAX_BYTES 256 KB |
| src/server/members/photo.ts | service: set, remove (own / manager), get |
| src/app/api/me/photo/route.ts | PUT / DELETE / GET own photo |
| src/app/api/members/[id]/photo/route.ts | GET and manager DELETE; no PUT |
| src/test/photo-fixtures.ts | PNG / JPEG builders for tests |
| tests: src/lib/validate/photo.test.ts, src/server/request/read-bytes.test.ts, src/server/drive/client.test.ts, src/server/members/photo.test.ts, src/server/members/photo.db.test.ts, src/app/api/me/photo/photo-routes.test.ts | R5, plan test list |

### Tests added / changed
- All tests in the plan's list (validator, strip, readBytes list, Drive cap, route tests for both route files, service unit tests, DB tests incl. CAS race, deactivated race, audit meta, cross-org, diacritics), plus schema-check block 12.

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: clean (no errors). check:layers: 850 files, no violations.
- test: 323 files passed, 1 skipped; 3251 tests passed, 9 skipped.
- build: succeeded.
- migrate:smoke: ok. schema:check: ok (block 12 and members_photo run checks pass).
- test:db (run twice): 21 files, 329 tests passed both times.

### Out-of-plan files
- src/lib/api/error.ts: added `image_not_supported` to API_ERROR_CODES (apiError only accepts listed codes).
- src/ui/copy/api.ts: one message line for `image_not_supported` (required by `satisfies Record<ApiErrorCode, string>`).

### Follow-ups (noticed, not done)
- Slice 2/3 (SIM-046.1, SIM-046.2) as in the plan.
- `apiCopy.errors.image_bad_size` / `image_too_large` use the device type IMAGE_LIMITS (24-100 px, 100 KB); the photo UI needs its own copy using PHOTO_LIMITS (64-512 px, 256 KB).
- Merge order: SIM-046 (130000) before SIM-047 (140000).

### Scope self-check
- Could the diff be smaller? No; the two out-of-plan lines are forced by typecheck.
- Diff size: about +91/-6 on modified files plus new files (validator ~160, service ~230, routes ~110, tests ~900).
