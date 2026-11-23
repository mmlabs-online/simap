## Attempt 1 — 2026-11-23

### Files touched
| File | Required because |
|---|---|
| `src/server/layout/save.ts` (new) | The PUT transaction |
| `src/server/layout/save.test.ts` (new) | Statement order and refusals with a fake client |
| `src/server/layout/layout.ts` | Extracted `readLayoutRows` for the PUT re-read |
| `src/server/layout/layout.db.test.ts` | `saveRoomLayout (db)` tests |
| `src/app/api/rooms/[id]/layout/route.ts` | `PUT`, admin tier |
| `src/app/api/rooms/[id]/layout/route.test.ts` | PUT cases; `fakeAuth` takes a role |
| `src/lib/validate/layout.ts` | Int4 cap on `baseVersion`; floor-cell cap after the rules |
| `src/lib/validate/layout.test.ts` | Validator cases |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | 3 new error codes and messages |

### Tests added / changed
- `layout.test.ts › validateLayoutSave floor and version caps` (4 tests)
- `save.test.ts › saveRoomLayout` (9 tests: order, cap 501, stale, 404, set comparison, empty fields, seat UPDATE text, JSON floor bind, audit meta)
- `route.test.ts › PUT` (7 tests)
- `layout.db.test.ts › saveRoomLayout (db)` (13 tests): written, NOT executed here (no docker). Verified only by the PR's CI `db integration tests` step.

### Checks (actual output summary)
- typecheck: pass (`pnpm typecheck && pnpm check:layers`, exit 0)
- format:check: All matched files use the correct format.
- test: Test Files 151 passed; Tests 1613 passed | 8 skipped
- build: exit 0
- test:db: not run (no docker); CI-only

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Fixture ids change on every save, so paint order of two non-blocking fixtures on one tile may flip (plan assumption 1): record as `debt` for SIM-015.2.
- `src/ui/copy/audit.ts` has no label for `room.layout_save` (raw code shows).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +472 / -70 tracked (plus 2 new files)
