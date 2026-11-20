# Consult — frontend-developer (SIM-010, 2026-11-20)

## Findings
- Rooms page (`src/app/(app)/rooms/page.tsx`) is a server-component PageSkeleton using `shellCopy.pages.rooms`. Detail and edit pages (`rooms/[roomCode]/page.tsx`, `/edit/page.tsx`) are also skeletons. Routes are keyed by `roomCode` (the spec's "room code" is editable, so URLs break on rename).
- `EntityFormDialog` (`src/ui/EntityFormDialog.tsx`) is presentation-only. It has props `open/title/subtitle/submitLabel/submitting/error/onClose/onSubmit`, an inline `role=alert` error line, and exports `DialogField` and `DialogSelect`. It is a native `<dialog>` that unmounts when `open=false`, so form state must live in the parent or a child component keyed per open. Default copy comes from `kitCopy` (`src/ui/copy/kit.ts`).
- The shell has `<div data-slot="room-switcher" />` in `AppShellView` (header, only when a session exists). `AppShellView` is pure and takes `session`, `pathname` and `actions`, so a switcher needs either a new prop/slot or a client component that reads context.
- `src/ui/session.tsx` has `SessionProvider`, `useSession()` and `useShellActions()`. `Session` carries `tier` and `orgName`. Tier checks live in `src/lib/tier.ts` and `src/lib/auth/tier.ts`.
- `src/lib/api/error.ts` defines only the codes `unauthenticated`, `org_required`, `forbidden`, `member_deactivated`, `unavailable` and `internal`. The rooms API needs new codes: `duplicate_room_code`, `room_not_found`, `room_has_occupants` (delete impact) and `validation`.
- `src/ui/README.md` says the fetch client lives in `src/ui/api/`. It does not exist yet (SIM-006 adds it). There is no data-fetching hook or cache layer in the repo.

## Recommendations
1. **Data fetching (R1).** Use plain client components with a small `useRooms()` hook in `src/ui/rooms/`. It calls `apiFetch("/api/rooms")` and returns `{status: "loading"|"error"|"ready", rooms, reload}`. Do not add SWR or React Query (stack is fixed). Do not pass server-fetched data from the page, because the token lives in browser memory. Make `rooms/page.tsx` a thin wrapper around a `<RoomsView />` client component.
2. **Test seam.** Split `RoomsView` (pure props: `rooms`, `status`, `canManage`, callbacks) from `RoomsPage` (hook plus session). This mirrors `AppShellView` / `AppShell`. Vitest tests render `RoomsView` for loading, empty, error, ready, Admin and User cases. Put pure logic in `src/lib/rooms/`: `occupancyPercent`, `ringStroke`, `validateRoomInput` (code regex, trim and uppercase, length) and `describeDeleteImpact`. These get unit tests with no DOM.
3. **States.**
   - Loading: 3 to 6 skeleton cards with `aria-busy`.
   - Empty: icon plus text. Admins also get a "Create room" button, Users get text only.
   - Error: card with `role=alert`, a Retry button, and a message mapped from the `ApiErrorCode`.
   - Header: a "New room" button shown only when `tier` is admin (hidden, not disabled; the API still returns 403).
4. **Dialog.** A `RoomFormDialog` in `src/ui/rooms/` handles both create and edit. Fields: code, name, description, floor, using `DialogField`. The parent keeps `error` and `submitting`. It maps `duplicate_room_code` to an inline message and keeps the dialog open on error. In edit mode, show a `subtitle` warning when the code changes: "Seat codes will be renamed (C302-01 becomes C303-01)". Never render a seat-code field (ROO-02).
5. **Delete.** A separate confirm dialog, also built on `EntityFormDialog`. Step 1 fetches the impact: `GET /api/rooms/:id/delete-impact` returns the occupied seat count and placed device count. Step 2 is a plain delete if the impact is 0, otherwise a forced-delete confirm that spells out the consequences. The API takes `?force=true`.
6. **Room switcher.** Add a `RoomSwitcher` client component in `src/ui/rooms/` (a `<select>` or menu) and pass it to `AppShellView` as an optional `roomSwitcher?: ReactNode` prop that replaces the empty `data-slot` div. This keeps the view pure and the existing shell test passes. The selection goes in the URL (`/rooms/<id>`), not in context, so it survives reload and there is no extra state. Keep the room list in a shared `RoomsProvider` context so the page and the switcher share one fetch and a mutation refreshes both. Mount it in `(app)/layout.tsx` inside the `SessionProvider`.
7. **Routes.** Key routes by room id (uuid), not by code. The `[roomCode]` folder name is a skeleton leftover, so either rename it or note that SIM-012/015 consume it. Detail and edit pages stay skeletons (out of scope).
8. **Copy.** Create `src/ui/copy/rooms.ts` (English, per SIM-022's pattern) and extend `copy.test.ts` if it checks every copy file. Do not hard-code strings in components. Because SIM-022 is in the same batch, add the file against whichever shape lands first and expect a trivial merge conflict in `copy.test.ts` / `shell.ts`.
9. **Occupancy card.** Port the seatMGT room card and ring as `RoomCard` plus `OccupancyRing`. The ring is SVG with `role=img` and an `aria-label` such as "12 of 20 seats occupied". Handle the 0-seat case without dividing by zero. Use existing `Card` and `Chip`, and color tokens only.
10. **Admin hiding.** Use `useSession().tier` through the existing helper in `src/lib/tier.ts`. Do not read roles any other way (R6).

## Risks
- SIM-006's `apiFetch` signature is unknown. Wrap calls behind a tiny `roomsApi` module (`list/create/update/impact/delete`) so changes touch only that file. Until SIM-006 merges, `RoomsPage` can't be tested end to end. Unit tests should inject the fetcher.
- A 401 or token-refresh race on first render (the session is not yet restored) will make `useRooms` flash an error. Wait for the session before fetching.
- Native `<dialog>` and `showModal` are missing in jsdom. Either mock them or test only `RoomsView` plus pure logic (see how `kit.test.tsx` handles this).
- Two shared files (`AppShellView.tsx`, `shell.ts`) conflict with SIM-022 and SIM-006. Keep edits there minimal.
- Stale list after a rename or forced delete (switcher and page out of sync). The shared provider with `reload()` after every mutation avoids this.

## Open questions (proposed default)
1. Route key: id or code? Default: id (uuid); a code rename must not break links.
2. Should the switcher also show on `/` (dashboard)? Default: visible on all pages, selection sets the route when on a room page and does nothing on others.
3. Delete-impact endpoint shape: a separate GET or a dry-run on DELETE? Default: a separate `GET /api/rooms/:id/delete-impact`, simpler to test.
4. Should Users see the "New room" button disabled with a tooltip instead of hidden? Default: hidden, as the AC says.
5. Pagination or search on the room list? Default: none for v1 (room counts are small).
6. Floor field type: free text or integer? Default: free text up to 20 characters (basements like "B1"). Check the spec data model.
