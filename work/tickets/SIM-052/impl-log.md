## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/server/layout/layout.ts` | `readLayoutRows`/`getRoomLayout` take `tier`; device query adds `mine` (owner_id = caller member); User gets `type` null on non-held devices |
| `src/lib/sprites/layout.ts` | `SeatDevice.type: string \| null` |
| `src/lib/sprites/map-view.ts` | parser keeps `type: null` |
| `src/lib/sprites/device-slots.ts` | null type with no catalog info gives kind `other`, sprite art |
| `src/app/api/rooms/[id]/layout/route.ts` | GET passes `ctx.tier` |
| `src/server/layout/save.ts` | passes `"admin"` (PUT is admin tier) |
| tests (below) | plan test list |

### Tests added / changed
- `layout.db.test.ts` › "free-text type by tier (SIM-052)": User non-held null / held kept / no "MacBook" in JSON; non-held keeps catalog deviceType; manager and admin keep type; User without member row. Helper `get`/`value` gained `tier` (default admin); the existing "holds none" test now passes tier user.
- `route.test.ts` › asserts tier "user" forwarded
- `map-view.test.ts` › keeps `type: null`, still drops non-string type
- `device-slots.test.ts` › resolveDeviceArt with null type
- `placement.test.ts` › draws devices with null type
- Dropped from plan: "unowned device (owner_id null)" case, because the DB check `devices_unowned_not_placed_check` forbids an unowned placed device. `save.test.ts` needed no change.

### Checks (actual output summary)
- typecheck: pass (next typegen + tsc, no errors)
- format:check: "All matched files use the correct format."
- check:layers: 864 files, no violations
- test: 328 files passed, 3285 tests passed, 9 skipped
- test:db: 22 files, 339 tests passed
- build: completed (route table printed)

### Out-of-plan files
None

### Follow-ups (noticed, not done)
- None

### Scope self-check
- Could the diff be smaller? No
- Diff size: about +150 / -10 lines including tests
