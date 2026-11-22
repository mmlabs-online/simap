## Attempt 1 — 2026-11-22
Verdict: REWORK

### Checks (run by reviewer)
Run on `ticket/SIM-012.5` at `a35361c`. These match the results in impl-log.md.
- `pnpm format:check` — exit 0, all matched files formatted (398 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, 344 files, no violations
- `pnpm test` — exit 0, 140 files passed; 1413 tests passed, 3 skipped
- `pnpm build` — exit 0, compiled successfully
- `pnpm test:db` — not run (CI-only, by instruction; the diff has no server, schema or migration change)

### Acceptance criteria
- [x] The switcher lists the org's rooms on every signed-in page and preselects the current room on a room page — evidence: `AppShell` is in `src/app/(app)/layout.tsx:7-9`; `RoomSwitcher.test.tsx` "has the placeholder plus one option per room, current selected"; `roomCodeFromPath` tests. On a direct load the options arrive after the first render; React re-applies the controlled value on update (`react-dom-client.development.js:20930`). Not exercised in a browser.
- [x] A room opens only when Go is pressed, including arrow keys on the closed select — evidence by code: the select's `onChange` only calls `setSelected` (`RoomSwitcher.tsx:36`, `:84`); `router.push` is only in `onGo` (`RoomSwitcher.tsx:79-82`). Arrow keys not exercised in a browser.
- [ ] Go stays focusable and does nothing when the target is empty, already current, or a dot code — FAILED for an empty displayed target, see Issue 1. The focusable, current and dot cases pass (`RoomSwitcher.test.tsx` "Go is a plain button that is never disabled"; `room-switcher.test.ts` `goTarget`).
- [x] A newly created room appears after navigation, and a failed refetch keeps the last good list — evidence by code: refetch on path change (`RoomSwitcher.tsx:64-69`), `keepGoodRooms` tests, `rooms-api.ts:26-33` turns a blocked request into a result, and `useRooms` drops stale responses (`useRooms.ts:23-25`). An org switch remounts the shell (`AuthGate.tsx:250`, `:621`), so the kept list cannot cross orgs. Blocked refetch not exercised in a browser.
- [x] The select has an accessible label, and the bar fits at 390 px without crowding the header — evidence: label test in `RoomSwitcher.test.tsx`; the bar is a separate `flex-none` row (`AppShellView.tsx:156-160`), the select has `min-w-0 flex-1` (`RoomSwitcher.tsx:37`), and the header loses only the empty slot. The 390 px layout is judged from classes only.
- [x] Unit tests cover `roomCodeFromPath`, the Go decision and the shell rendering with and without a switcher — evidence: `room-switcher.test.ts`, `AppShellView.test.tsx` "roomSwitcher: absent by default, between header and main with a prop, absent when signed out"; `pnpm test` green.

**Not verified in a browser** (the implementer did not run these and neither did the reviewer; the results above come from reading the code):
- arrow keys on the closed select
- the 390 px viewport
- a blocked `/api/rooms` refetch

### Issues
#### Issue 1 — 🔴 blocker — correctness (AC3)
- **Where**: `src/ui/RoomSwitcher.tsx:62`, `:80`, `:84`
- **Expected**: When the select shows the placeholder, the target is empty and Go does nothing.
- **Actual**: `selected` can hold a code that is no longer in the list. React then falls back to the first option, so the select shows "Select a room" (`updateOptions`, `react-dom-client.development.js:1775-1796`), while `onGo` still uses the hidden code. Path from the code (not reproduced in a browser):
  1. On `/rooms`, choose room B in the switcher and do not press Go.
  2. Delete room B on that page, then open another non-room page. `current` stays `null`, so the reset effect at `:75-77` does not run, and the refetch removes B from the list.
  3. The select shows the placeholder. Pressing Go calls `router.push("/rooms/B")` and lands on a missing room.
- **Fix instruction**:
  1. Add a pure helper to `src/lib/room-switcher.ts`: `visibleSelection(rooms: RoomDto[], selected: string): string`, returning `selected` when a room has that code and `""` otherwise.
  2. In `RoomSwitcher`, compute `const shown = visibleSelection(good, selected)`, pass `selected={shown}` to `RoomSwitcherView`, and call `goTarget(shown, current)` in `onGo`. Keep the `selected` state unchanged, so the current room is still preselected once the first load arrives.
  3. Add tests to `src/lib/room-switcher.test.ts`: a listed code is returned, an unlisted code returns `""`, an empty list returns `""`, and `goTarget(visibleSelection([], "B"), null)` is `null`.

### Rules (CLAUDE.md)
No violations found. R1: `pnpm check:layers` is green and the new UI code imports only ui and lib. R4: every changed source file is in the plan's file list and no High path changed. D36: copy is in `src/ui/copy/shell.ts`. R5: the fix for Issue 1 needs the tests listed there.

### Blockers from review agents
None. No review trigger path changed.

### Nits (do not block)
- Go (`size="sm"`, about 36 px tall) is shorter than the 40 px select next to it and below the shell's 44 px icon buttons. Worth checking during the 390 px browser pass.

### Follow-ups (out of scope)
- `listRooms` caps the list at 500 rooms (`src/server/rooms/rooms.ts:69`), so an org above that would not see every room in the switcher. The seats page resolves rooms from the same list.
- `Ming verification after merge`: none in the plan. The three browser checks listed above remain open.

## Attempt 2 — 2026-11-22
Verdict: PASS

### Checks (run by reviewer)
Run on `ticket/SIM-012.5` at `0685a7c`. These match the Attempt 2 results in impl-log.md.
- `pnpm format:check` — exit 0, all matched files formatted (398 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, 344 files, no violations
- `pnpm test` — exit 0, 140 files passed; 1416 tests passed, 3 skipped
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only, by instruction; the diff has no server, schema or migration change)

### Attempt 1 blocker
Fixed. `RoomSwitcher.tsx:79` derives `shown` from the list that is rendered, and both the select (`:86`) and Go (`:82`) use it, so Go cannot act on a code the select does not show. In the attempt 1 path, B leaves the list, `shown` becomes `""`, `goTarget("", null)` is `null`, and nothing navigates. Tests: `room-switcher.test.ts` › `visibleSelection` (listed, unlisted, empty list, Go has no target).

### Regression check of the fix (from the code, not run in a browser)
- **First load on a room page**: `selected` starts as the current code (`:62`) and is kept while the list is empty, with `shown` as `""`. When the list arrives, `shown` becomes the code in the same render as the options, and React applies the value after the update (`next/dist/compiled/react-dom/cjs/react-dom-client.development.js:22642-22643`, `updateOptions` at `:1964`).
- **Navigation to a room not yet listed** (new or renamed): the select shows the placeholder and Go does nothing until the refetch lists the room, then the room is preselected, because `selected` was kept.
- **List changes while the selection stays listed**: `shown` is unchanged and React re-applies it to the new options on the update.
- **Selected room removed by a refetch**: the select shows the placeholder and Go does nothing.
- **Failed refetch**: `good` is kept (`:72`), so `shown` and the options do not change. If the current room is not in the kept list, the select shows the placeholder and Go does nothing.
- **Encoded paths**: `roomCodeFromPath` does not decode, and valid codes contain only `A-Z0-9._-` (`src/lib/validate/room.ts:13`), so a listed code and its path segment compare equal.

### Acceptance criteria
- [x] The switcher lists the org's rooms on every signed-in page and preselects the current room on a room page — evidence: `RoomSwitcher.test.tsx` "has the placeholder plus one option per room, current selected"; `roomCodeFromPath` tests; the first-load path above. Not exercised in a browser.
- [x] A room opens only when Go is pressed, including arrow keys on the closed select — evidence by code: the select's `onChange` reaches only `setSelected` (`RoomSwitcher.tsx:36`, `:86`); `router.push` is only in `onGo` (`:83`). Arrow keys not exercised in a browser.
- [x] Go stays focusable and does nothing when the target is empty, already current, or a dot code — evidence: `RoomSwitcher.test.tsx` "Go is a plain button that is never disabled"; `room-switcher.test.ts` › `goTarget` and `visibleSelection`; `RoomSwitcher.tsx:82-83`.
- [x] A newly created room appears after navigation, and a failed refetch keeps the last good list — evidence by code: refetch on path change (`RoomSwitcher.tsx:65-68`), `keepGoodRooms` tests, `useRooms` drops stale responses (`useRooms.ts:23-25`). Blocked refetch not exercised in a browser.
- [x] The select has an accessible label, and the bar fits at 390 px without crowding the header — evidence: label test in `RoomSwitcher.test.tsx`; the bar is a separate `flex-none` row in `AppShellView.tsx`, and the select has `min-w-0 flex-1` (`RoomSwitcher.tsx:37`). The 390 px layout is judged from classes only.
- [x] Unit tests cover `roomCodeFromPath`, the Go decision and the shell rendering with and without a switcher — evidence: `room-switcher.test.ts`, `AppShellView.test.tsx` "roomSwitcher: absent by default, between header and main with a prop, absent when signed out"; `pnpm test` green.

**Not verified in a browser** (the implementer did not run these and neither did the reviewer; the results above come from reading the code):
- arrow keys on the closed select
- the 390 px viewport
- a blocked `/api/rooms` refetch

The effect-driven paths in the regression check above were also read from the code only, because Vitest here renders static markup and the repo has no DOM test environment.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `pnpm check:layers` is green. R4: every changed source file is in the plan's file list, except `visibleSelection` and its tests, which are the fix attempt 1 asked for, in files already in the plan; no High path changed. R5: checks are green and the new helper has tests. D36: copy is in `src/ui/copy/shell.ts`.

### Blockers from review agents
None. No review trigger path changed.

### Nits (do not block)
- Go (`size="sm"`, about 36 px tall) is still shorter than the 40 px select next to it. Worth checking during the 390 px browser pass.
- A hidden `selected` code comes back into view if a room with the same code is created later. Go then opens that existing room, so this is harmless.

### Follow-ups (out of scope)
- `listRooms` caps the list at 500 rooms (`src/server/rooms/rooms.ts:69`), so an org above that would not see every room in the switcher, and a current room beyond the cap would not be preselected.
- `Ming verification after merge`: none in the plan. The three browser checks listed above remain open.
