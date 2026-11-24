## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0; "check-layers: 464 files, no violations".
- `pnpm test` — exit 0, "Test Files 182 passed (182); Tests 1914 passed | 3 skipped (1917)". Matches impl-log.
- `pnpm build` — exit 0, "Compiled successfully".
- `pnpm test:db` — CI-only; no DB/server change in this diff.

### Acceptance criteria
- [x] A member places, lends, moves and returns their own device; a Manager+ does this for any device; a User sees no place action on another member's device. Evidence: the server-side `canPlace` (`src/lib/devices/rules.ts:5-6`) gates `placeModes` (`src/ui/devices/place-device.ts:15-18`). Tests: `device-actions.test.ts` › "no actions when canPlace is false", "place for an unplaced device; move and return for a placed one"; `DevicesView.test.tsx` › "actions column only when a row has an action", "Place / Move / Return buttons per canPlace row, none on a canPlace:false row"; `place-device.test.ts` › placeVerb "place, move, lend"; `PlaceDeviceDialog.test.tsx` › "lend label when the chosen seat's occupant is not the owner". The local `pnpm dev` run was not done (no Identity session here), so it stays in the Ming check below.
- [x] Primary placement refusals show their message, and the list refreshes after a change. Evidence: `PlaceDeviceDialog.test.tsx` › "shows the refusal message in the alert (each placement code)" covers all five codes; `place-device.test.ts` › settle; `devices-state.test.ts` › "refresh keeps rows and status until the answer", "a refresh answer replaces the rows; a stale answer is ignored". The wiring is `DevicesPage.tsx` `onDone` → `setPlacing(null)` + `refresh()`, and the refetch path is at `PlaceDeviceDialog.tsx:216-222`.
- [x] Pure-logic and static-render tests cover which actions and roles the dialog offers. Evidence: `place-device.test.ts` › "offeredRoles and primaryRefusal" (5 cases, including the device that is already the seat's primary); `PlaceDeviceDialog.test.tsx` › "primary radio only when offered; secondary checked by default; hint otherwise"; `pnpm test` passes.

Ming checks after merge (from plan.md):
- Lend and move devices between seats on real data: a seat whose occupant is another member, and the owner's own seat as primary. Check that the Manager view can place another member's device.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new files are in `src/ui/devices/` and import only `@/lib/*` and UI modules. `check:layers` is clean.
- R4: every changed source file is in the plan's file list. `work/ming-todo.md` (M-36) and the ticket files are workflow files.
- R5: new logic has tests.
- R6/R7: no server change, and the UI sends no org id.
- D36: all new strings are in `src/ui/copy/devices.ts` or come from `apiErrorMessage`.

### Blockers from review agents
None. No review trigger fires: no `src/server/`, auth, migration or workflow path changed.

### Nits (do not block)
- `PlaceDeviceDialog.tsx:204`: in `return` mode, `usePlaceTargets` still loads the room list and the current room's seats (up to 500, with devices), but the confirm dialog never shows them. Pass `null` as the room, or skip the hook, when `mode === "return"`.
- `PlaceDeviceDialog.tsx:216-221`: after `placement_changed`, the dialog has already refetched the device, but the alert still says "Refresh and try again". A "try again" message would be more accurate.
- `PlaceDeviceDialog.tsx:219`: when the refetched device no longer supports the mode (for example someone else returned it), the dialog closes with no message.
- `PlaceDeviceDialog.test.tsx` › "lend label…" checks the lend hint line, not the submit button's "Lend" label. The label comes from `placeVerb`, which `place-device.test.ts` covers.

### Follow-ups (out of scope)
- Add a component-level test of `PlaceDeviceInner`'s submit and refetch flow once a DOM test environment exists (impl-log follow-up).
- Gate note for the orchestrator and PR: the ticket's "Plan approved" line comes from Ming's message "duyệt plan SIM-013.2, chạy luôn", which the run read as SIM-013.3. Ask Ming to confirm in the PR that this approval covers the P1 plan gate.
