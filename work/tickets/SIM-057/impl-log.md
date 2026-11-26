
# Implementation log — SIM-057 (attempt 1)

## Files touched
- `src/lib/checkin-room.ts` (new), `src/lib/checkin-room.test.ts` (new): pure first-room rule and shown-room rule (AC4).
- `src/lib/nav.ts`, `src/lib/nav.test.ts`: `checkin` item, `homeFor`, tier-aware `navItemsFor`, `isCheckinView` (AC1, AC2).
- `src/lib/room-switcher.ts`, `src/lib/room-switcher.test.ts`: `roomCodeFromQuery`, `checkinRoomHref`, `checkinGoTarget` (AC3).
- `src/ui/copy/checkin.ts` (new), `src/ui/copy/shell.ts`: copy (D36, `Record<NavId, string>`).
- `src/ui/checkin/CheckinView.tsx`, `CheckinPage.tsx`, `HomePage.tsx` (new) and tests for View and Home: the view and home switch.
- `src/ui/index.ts`, `src/app/(app)/page.tsx`, `src/app/(app)/checkin/page.tsx` (new), `src/app/(app)/dashboard/page.tsx` (new): routes.
- `src/ui/AppShell.tsx`: hide the shell room switcher on the check-in view.
- `src/ui/AppShellView.test.tsx`: admin href list plus per-tier nav test.

## Tests added
All listed in plan.md (checkin-room, nav, room-switcher, CheckinView, HomePage, AppShellView).

## Check results
- `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`: pass.
- `pnpm test`: Test Files 344 passed | 1 skipped; Tests 3409 passed | 7 skipped.
- `pnpm build`: success.

## Out-of-plan files
None.

## Follow-ups
- `/api/me` seats summary to replace the N+1 `loadMySeats`; tidy spec line 665 (SHL-01).
- `CheckinPage` and `useRoomSeats` each call `useRooms` (two room-list fetches); could share later.

## Scope self-check
Only plan files touched; no presence data, popup or polling. The floating button slot ships empty. Not run: manual browser check at 1280/390 px.
