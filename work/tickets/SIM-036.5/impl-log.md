# Impl log — SIM-036.5

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/lib/validate/png.ts` (+test) | pure PNG check, CRC table, `IMAGE_LIMITS` |
| `src/server/request/read-bytes.ts` (+test) | raw body reader |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | six new error codes and English text |
| `src/server/device-types/image.ts` (+`image.test.ts`, `image.db.test.ts`) | set / remove / get service, A1 compare-and-set, Drive error mapper, `discardImageFile` |
| `src/app/api/device-types/[id]/image/route.ts` (+`image-routes.test.ts`) | PUT / DELETE / GET |
| `src/server/device-types/device-types.ts` | `deleteDeviceType` returns `{ imageFileId }`; also exports `Row`, `COLS`, `toDto` (see Out-of-plan) |
| `src/app/api/device-types/[id]/route.ts` | DELETE discards the image file after commit |
| `src/app/api/device-types/device-types-routes.test.ts` | contract change; new discard case (mocks `@/server/device-types/image`, not `@/server/drive/drive`) |
| `src/server/device-types/device-types.db.test.ts` | contract change (two expectations: lines 71 and 149) |

### Tests added / changed
- `png.test.ts`, `read-bytes.test.ts`, `image.test.ts`, `image-routes.test.ts`, `image.db.test.ts` as in the plan's test table
  (DB tests: set twice, remove idempotent, cross-org 404 with no Drive call, CAS lost, deleteDeviceType file id).
- A9 confirmed: `DRIVE_ID_RE` in `config.ts` is `^[A-Za-z0-9_-]{10,200}$`, identical to the DB CHECK.

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck + check:layers: clean; `check-layers: 632 files, no violations`
- test: Test Files 241 passed | 1 skipped; Tests 2375 passed | 7 skipped
- build: Compiled successfully (exit 0)
- test:db (local Postgres): Test Files 15 passed; Tests 178 passed

### Out-of-plan files
- None. In-plan `device-types.ts` also gets `export` on `Row`, `COLS`, `toDto` so `image.ts` reuses them instead of copying the column list.
- The routes test mocks `@/server/device-types/image` (the unit that calls Drive) instead of `@/server/drive/drive`.

### Follow-ups (noticed, not done)
- Orphan Drive file sweep (already out of scope).

### Scope self-check
- Could the diff be smaller? No; production code about 420 lines, rest is tests.
- Diff size: 6 tracked files +46 / -10, plus 9 new files.
