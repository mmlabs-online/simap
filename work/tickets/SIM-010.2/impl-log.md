## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/lib/rooms/occupancy.ts` (+ test) | Ring math, 0-seat safe |
| `src/ui/copy/rooms.ts` | D36 copy |
| `src/ui/rooms/rooms-api.ts` (+ test) | Result-returning API wrapper over `useApiFetch` |
| `src/ui/rooms/useRooms.ts` | List loading, stale-response guard |
| `src/ui/rooms/room-form.ts` (+ test) | Pure form helpers (Q22, validation, patch, rename warning) |
| `src/ui/rooms/delete-flow.ts` (+ test) | Plain vs forced delete, impact lines |
| `src/ui/rooms/OccupancyRing.tsx`, `RoomCard.tsx`, `RoomsView.tsx` (+ test) | Cards, ring, states, Admin-only actions |
| `src/ui/rooms/RoomFormDialog.tsx`, `DeleteRoomDialog.tsx`, `RoomsPage.tsx` | Dialogs and glue |
| `src/ui/index.ts` | Export `RoomsPage` |
| `src/app/(app)/rooms/page.tsx` | Render `RoomsPage` |

### Tests added / changed
- `src/lib/rooms/occupancy.test.ts`, `src/ui/rooms/rooms-api.test.ts`, `room-form.test.ts`, `delete-flow.test.ts`, `RoomsView.test.tsx` (cases per plan)

### Checks (actual output summary)
- typecheck: pnpm typecheck exit 0; pnpm check:layers "168 files, no violations"
- format:check: "All matched files use the correct format."
- test: 62 files, 571 tests passed
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Retry does not switch the view back to loading before the response arrives.

### Scope self-check
- Could the diff be smaller? No; pure helpers and tests are planned.
- Diff size: about +1000 / -10 lines (tests and pure helpers over half)
