# Implementation log — SIM-044.1

## Attempt 1
Plan defaults (all six) built as written.

### Files touched
- `src/server/seats/seats.ts`: `visibility` param on `seatRows`/`loadSeat`; held clause in the devices subquery only; `tier` on `getSeat`, `listRoomSeats`, `releaseSeat`; Manager/Admin writes pass `"org"`. Required because AC1/AC2.
- `src/app/api/seats/[id]/route.ts`, `src/app/api/rooms/[id]/seats/route.ts`, `src/app/api/seats/[id]/release/route.ts`: pass `ctx.tier`. Required because AC1.
- `src/server/members/manage.ts`: `memberSelect(refCap, visible)`, `listMembers`/`getMember` take `sub, tier`; `mustLoad` passes null. Required because AC3.
- `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`: pass `ctx.sub, ctx.tier`. AC3.
- `src/lib/members/types.ts`: `deviceCount: number | null`. AC3 contract.
- `src/ui/members/MembersView.tsx`, `src/ui/copy/members.ts`: dash + "Not shown" for null. AC3 UI.
- `src/ui/seats/SeatDetailPanel.tsx`, `src/ui/copy/seats.ts`: "None shown" when devices are hidden. UX gap.
- Tests: `seats.test.ts`, `seats.db.test.ts`, `seats-routes.test.ts`, `manage.test.ts`, `manage.db.test.ts`, `members/route.test.ts`, `MembersView.test.tsx`, `SeatDetailPanel.test.tsx`, `layout.db.test.ts`.

### Tests added
Per plan "Tests to write". Deviation: unowned devices cannot be placed at a seat (DB check `devices_unowned_not_placed_check`), so the seat visibility world uses X's primary plus two of Y's secondaries (deviceCount 3). On release the primary is demoted but stays X's, so X still sees it (asserted).

### Checks
- `pnpm format:check`: All matched files use the correct format.
- `pnpm typecheck && pnpm check:layers`: green; check-layers: 840 files, no violations.
- `pnpm test`: Test Files 320 passed | 1 skipped; Tests 3221 passed | 7 skipped.
- `pnpm build`: exit 0.
- `pnpm test:db` (local Postgres 16, port 54329, data dir under /var/tmp, removed afterwards): Test Files 20 passed (20); Tests 319 passed (319).

### Out-of-plan files
None.

### Follow-ups
None new (member email for Users and the write-action existence oracle stay as already recorded).

### Scope self-check
Only plan files touched; no migration, no config.
