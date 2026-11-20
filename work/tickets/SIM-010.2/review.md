## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Environment: Linux, branch `ticket/SIM-010.2`, diff vs `origin/main`.
- `pnpm format:check` — exit 0, "All matched files use the correct format." (194 files)
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0; "check-layers: 168 files, no violations"
- `pnpm test` — exit 0, "Test Files 62 passed (62)", "Tests 571 passed (571)" (includes `no-literals.test.ts`,
  `copy.test.ts`, `check-layers.test.ts`)
- `pnpm build` — exit 0; `/rooms` listed as a static route
- `pnpm test:db` — CI-only; no `src/server/**` or migration change in this diff.
- Results match impl-log.md Attempt 1.

### Acceptance criteria
- [x] 1. AC4 UI half (actions hidden for User/Manager, shown for Admin) — `src/ui/rooms/RoomsView.test.tsx` › "hides
  New room, Edit and Delete unless canManage" (passes); `src/ui/rooms/RoomsPage.tsx:24`
  `canManage = session ? atLeastTier(session.tier, "admin") : false`; `RoomsView.tsx:37,74` render actions only when
  `canManage` (hidden, not disabled).
- [x] 2. Loading, empty, error states — `RoomsView.test.tsx` › "loading shows aria-busy skeletons and no rooms", "ready
  with no rooms shows the empty text", "error shows an alert with the message and Retry".
- [x] 3. Cards with a 0-seat-safe, accessible ring — `src/lib/rooms/occupancy.test.ts` (all planned cases incl. (0,0),
  clamp 11/10, negative total); `RoomsView.test.tsx` › "ready renders a card and ring per room, 0-seat safe" (two
  `role="img"`, `occupancyLabel(1, 4)`, `percent(0)`). `OccupancyRing.tsx:14-15` `role="img"` + copy `aria-label`.
- [x] 4. Rename warning in edit mode — `src/ui/rooms/room-form.test.ts` › "warns in edit mode when the code changes"
  (C302-01 / C303-01), "is null for the same code, an invalid code, or create mode"; wired as dialog subtitle at
  `RoomFormDialog.tsx:89-91`.
- [x] 5. Delete impact; plain vs forced; force only after forced confirm — `delete-flow.test.ts` › "is plain when nothing
  is occupied or placed (free seats and requests do not count)", "is forced when a seat is occupied or a device is
  placed", "lists only non-zero counts in order"; `rooms-api.test.ts` › "remove: force adds ?force=true; 204 is ok";
  `DeleteRoomDialog.tsx:60` sends `force` only when `step === "forced"`, `:62` 409 `room_not_empty` reloads impact.
- [x] 6. Q22 code uppercases as typed — `room-form.test.ts` › "uppercases as typed and keeps spaces";
  `RoomFormDialog.tsx:100-103` `onChange={(e) => set("code", codeInput(e.target.value))}`,
  `autoCapitalize="characters"`, `spellCheck={false}`.
- [x] 7. Client validation reuses the lib validator; server errors map to copy — `room-form.ts:35,58` call
  `validateRoomCreate` / `validateRoomPatch`; `room-form.test.ts` › "returns the validator output" (Vietnamese name
  `Phòng họp` accepted), "maps each invalid field to its message", "sends only changed fields", "treats the same code
  in another case as unchanged", "clearing the description sends null"; `rooms-api.test.ts` › "409 body code
  room_code_taken is returned"; `src/ui/copy/api.ts:15` has the `room_code_taken` message.
- [x] 8. API only through `useApiFetch`; access/network errors handled — `RoomsPage.tsx:21-22`; `rooms-api.test.ts` ›
  "maps ApiAccessError and network errors", "a non-JSON error body is internal". `grep "fetch(" src/ui/rooms` (non-test):
  no matches.
- [x] 9. Copy follows SIM-022 — `src/ui/copy/rooms.ts` English, no diacritics; `no-literals.test.ts` and
  `copy.test.ts` pass on the new files.
- [x] Checks green — see above.
- Source plan (SIM-010 Slice B) acceptance: AC4 UI half, states, rename warning, forced-delete confirmation,
  `RoomsView`/`rooms-api`/`occupancy` tests — all covered above. Deviations from the source slice (no `copy.test.ts`
  edit, `apiErrorMessage` instead of an `errors` map, no "wait for session") are recorded as **(changed)** in the
  approved plan.

Ming verification after merge (not verified here; carry to the PR):
- Browser as Admin on `/rooms`: create `c302` (shows `C302` while typing), duplicate `C302` ("This room code is already
  used."), edit to `C303` (rename warning), delete an empty room (plain confirm), force-delete a room with an occupant
  (forced confirm lists counts; occupant may need `pnpm seed:dev`/psql).
- As User or Manager: list shows, no New room / Edit / Delete.

### Issues
None.

### Scope
All 19 changed `src/` files are in plan.md's file list; the `work/tickets/SIM-010.2/*` files are loop files. No High
path touched; security trigger not fired (no `src/server/**`).

### Rules (CLAUDE.md)
No violations found. R1: ui files import only `@/lib/*` and relative `src/ui`, page imports `@/ui` (check:layers
clean). R3: no env. R4: no switcher, no detail links, no seat UI, no kit/icon changes. R5: new logic tested. R6: n/a (no
server code).

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- 💭 `src/ui/rooms/DeleteRoomDialog.tsx:47` — `loadImpact` depends on `onDone`, which `RoomsPage.tsx:30` recreates on
  every render, so any `RoomsPage` re-render while the dialog is open (e.g. a session context update) re-fetches the
  impact. Harmless (idempotent GET) but `useCallback` on `done`/`close` in `RoomsPage` or a ref for `onDone` would avoid it.
- 💭 `DeleteRoomDialog.tsx` / `RoomFormDialog.tsx` — no unmount guard on the impact/mutation awaits (setState after
  close is a no-op in React 19, so only cosmetic).
- 💭 Plain delete (`DeleteRoomDialog.tsx:84`) does not mention free seats that will also be removed; the plan chose
  `deleteBody` only for the plain step, so this follows the plan.
- 💭 If the impact load fails, the submit stays disabled (`submitting || !impact`) with the error shown; the user can
  only close and reopen. Acceptable; no retry inside the dialog.

### Follow-ups (out of scope)
- Retry from the error state does not switch the view back to loading before the response (impl-log follow-up).
- Stale-tier 403 on a mutation could call `refreshPermissions()` (plan Assumptions; Ming's choice).
- SIM-019.2 may lift the `rooms-api` result/error mapping into a shared helper.
