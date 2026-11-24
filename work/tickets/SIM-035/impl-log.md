## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/lib/validate/layout.ts` | New code `layout_fixture_on_desk`, `fixturesOnDesks`, rule in `checkLayoutRules`, `LAYOUT_LIMITS.devicesPerSeat` (AC1, AC2, A5) |
| `src/lib/validate/layout.test.ts` | "fixture on a desk" block; the old "prop on desk accepted" case replaced (AC2) |
| `src/lib/api/error.ts`, `src/lib/layout-editor/save-errors.ts` (+ `.test.ts`) | A1: new `ApiErrorCode`, listed as "invalid" |
| `src/ui/copy/api.ts`, `src/ui/copy/roomlayout.ts` | A1/A2 copy (D36) |
| `src/lib/sprites/device-slots.ts` (+ `.test.ts`) | New pure slot table, `deviceKind`, `placeDevices` (AC4, AC5) |
| `src/lib/sprites/layout.ts` | `SeatDevice`, `LayoutResponse.seatDevices` (AC3) |
| `src/lib/sprites/placement.ts` (+ `.test.ts`) | Device ops in `buildDrawList`, under/after sort (AC4-AC6) |
| `src/lib/sprites/map-view.ts` (+ `.test.ts`) | `MapView.seatDevices`, defensive parse |
| `src/server/layout/layout.ts` | One org-scoped query, `seatDevices` in the response (AC3, R6) |
| `src/server/layout/layout.db.test.ts` | 3 DB tests (AC3) |
| `src/server/layout/save.test.ts` | Mocked `readLayoutRows` returns `seatDevices: {}` |
| `src/app/api/rooms/[id]/layout/route.test.ts` | 422 case (AC2) |
| `src/lib/layout-editor/draft.ts` (+ `.test.ts`), `place-tool.test.ts` | `withoutDeskFixtures`; refusal tests (AC1, A2) |
| `src/lib/layout-editor/editor-state.ts` (+ `.test.ts`) | `cleaned` notice, `seatDevices` in state, clean on load (A2, AC6) |
| `src/ui/roomlayout/EditorViews.tsx`, `EditorCanvas.tsx`, `LayoutEditor.tsx`, `RoomMap.tsx`, `RoomMapSection.tsx` | Notice text and `seatDevices` plumbing (A2, AC4-AC6) |
| `src/app/dev/roommap/fixture.ts`, `RoomMapDemo.tsx`, `fixture.test.ts` | Mug off the desk, demo devices (demo must pass the rule) |
| `docs/spec-v1.md`, `work/decisions.md` | LAY-01/LAY-06, D62 (AC7) |

### Tests added / changed
- validate/layout.test.ts › "fixture on a desk" (6 tests); place-tool.test.ts › "a fixture on any desk tile is refused (ghost not ok)"
- draft.test.ts › "fixtures and desks (D61)" (7 tests) and the changed placeItem test
- editor-state.test.ts › cleaned notice, read-only keeps fixtures, place on a desk refused, seatDevices not saved
- device-slots.test.ts (7 tests); placement.test.ts › "seat devices on desks (D61)" (6 tests); map-view.test.ts › seatDevices
- route.test.ts › "a fixture on a desk gives 422 layout_fixture_on_desk; service not called"
- layout.db.test.ts › 3 seatDevices tests (written, NOT run: no local Postgres; CI runs `pnpm test:db`)
- fixture.test.ts › demo devices; save-errors.test.ts list

### Checks (actual output summary)
- typecheck: exit 0 (`next typegen && tsc --noEmit`, no errors); check:layers: "601 files, no violations"
- format:check: exit 0 (oxfmt, 655 files)
- test: 228 files passed, 2281 tests passed, 3 skipped (the DB suite is not part of `pnpm test`)
- build: exit 0 (`pnpm build`, all routes listed)
- test:db: not run (no local Postgres)

### Out-of-plan files
- `src/lib/sprites/resolve-layout.test.ts` — an existing test asserted that `checkLayoutRules` accepts a non-blocking fixture on a seat tile; it now expects `layout_fixture_on_desk` (stored fixtures are still resolved, A2).
- `src/lib/layout-editor/save-errors.test.ts`, `src/ui/roomlayout/RoomMapSection.test.tsx`, `src/lib/layout-editor/editor-state.test.ts`: `seatDevices: {}` added to `MapView` fixtures (type change); the first is in the plan.

### Follow-ups (noticed, not done)
- Slot pixel offsets are starting values; Ming tunes them in `/dev/roommap` (plan: Ming verification).
- `fixturesOnDesks` keys cells as `y * 1000 + x`; fine for grid <= 64, but a shared cell-key helper could replace it.

### Scope self-check
- Could the diff be smaller? No (each file is in the plan or needed by a type change).
- Diff size: about +600 / -45 lines including tests and the new files (about 150 lines in device-slots.ts and its test).
