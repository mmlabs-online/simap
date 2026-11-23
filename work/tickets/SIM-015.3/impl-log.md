# Implementation log — SIM-015.3

## Attempt 1 — 2026-11-23

### Files touched
| File | Required because |
|---|---|
| src/lib/sprites/map-view.ts (new) | Pure payload-to-view mapper `toMapView` (AC1, AC2, AC7) |
| src/lib/sprites/map-view.test.ts (new) | Mapper tests (AC7) |
| src/lib/sprites/zoom.ts (new) | Canvas budget, `allowedZooms`, `clampZoom` (finding 4, AC5) |
| src/lib/sprites/zoom.test.ts (new) | Cap and clamp tests |
| src/lib/sprites/placement.test.ts | cannot/mine sprites with the real atlas (AC2) |
| src/ui/roomlayout/paint.ts, paint.test.ts | Budget and size guards before painting (finding 4) |
| src/ui/roomlayout/ZoomControl.tsx (new) | One shared zoom button group |
| src/ui/roomlayout/RoomMap.tsx, RoomMap.test.tsx | onZoom/onSelect, effective zoom, tooLarge, focusable scroll region, theme tokens; ZoomControl tests |
| src/ui/roomlayout/SeatOverlay.tsx, SeatOverlay.test.tsx | onSelect, data-map-seat, aria-haspopup (AC4); zoom-independent tags (AC3) |
| src/ui/roomlayout/RoomMapSection.tsx, .test.tsx (new) | Map card with loading/error/empty/notes (AC1, AC5, AC6) |
| src/ui/roomlayout/index.ts | Exports |
| src/ui/seats/seats-api.ts, seats-api.test.ts | `layout(roomId)` client for the SIM-015.1 endpoint |
| src/ui/seats/useRoomLayout.ts (new) | Layout hook with stale-response guard and reload |
| src/ui/seats/SeatsPage.tsx | Wires hook, `refreshAll`, shared `openSeat`, map slot |
| src/ui/seats/SeatsView.tsx, SeatsView.test.tsx | Optional `map` slot above the table |
| src/ui/seats/SeatDetailPanel.tsx, .test.tsx | `returnFocusTarget` so focus returns to the map seat |
| src/ui/copy/roomlayout.ts | New strings (D36) |
| src/app/dev/roommap/RoomMapDemo.tsx | Use shared ZoomControl via `onZoom` |

### Tests added / changed
- map-view.test.ts (9 cases), zoom.test.ts (4), placement.test.ts › cannot and mine seats emit their state sprites from the real atlas
- paint.test.ts › refuses a canvas over the cap without resizing; returns false when the canvas did not take the requested size
- SeatOverlay.test.tsx › data-map-seat / aria-haspopup / no data-seat-code; tag classes same at zoom 2, 3, 4
- RoomMap.test.tsx › tooLarge status; theme tokens; ZoomControl pressed/disabled
- RoomMapSection.test.tsx › loading, error + retry, empty, ready, unplaced and truncated notes
- seats-api.test.ts › layout path and bad shape / server error
- SeatsView.test.tsx › map slot above table; none when room missing
- SeatDetailPanel.test.tsx › returnFocusTarget

### Checks (actual output summary)
- typecheck: exit 0 (next typegen + tsc)
- check:layers: "370 files, no violations"
- format:check: "All matched files use the correct format."
- test: "Test Files 150 passed (150), Tests 1593 passed | 8 skipped". One earlier full run showed 1 failure that was my own ZoomControl test (class name contained "disabled:"), fixed; one later run showed 1 unidentified failure that did not reproduce on re-run (all green).
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Viewport-only rendering for rooms over the canvas budget (debt issue, per Ming's approved default).
- Mouse drag-to-pan (per approved default).
- Browser checks in the plan's "Ming verification" list (canvas, pan, focus, 390 px, dark mode) are not covered by Vitest.
- The unidentified one-off test failure above may be a timing flake under load.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan list.
- Diff size: see `git diff --shortstat` (about 400 product lines plus tests).
