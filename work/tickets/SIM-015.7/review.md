## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 402 files, no violations"
- `pnpm test` — exit 0, "Test Files 162 passed (162); Tests 1690 passed | 3 skipped (1693)" (matches impl-log)
- `pnpm build` — exit 0, `ƒ /rooms/[roomCode]/edit` listed
- `pnpm test:db` — not run (CI-only, no Postgres here); the diff has no SQL, migration or `src/server/**` change.

### Acceptance criteria
Plan verification table (slice 2a, A1 approved 2026-11-23):
- [x] AC1 Positions and rotations survive a reload after save — evidence: `seats-api.test.ts` › "saveLayout PUTs the JSON body to /api/rooms/{id}/layout and maps the response with its version"; `editor-state.test.ts` › "move and rotate then savePayload carries the new placements and baseVersion, and passes validateLayoutSave", "saveDone resets baseline, history, selection and version from the response; dirty false"; `map-view.test.ts` › "toMapView keeps version; a missing or negative version gives null". The PUT response carries `version` (`src/server/layout/save.ts:140-142` → `readLayoutRows`, `src/server/layout/layout.ts:120`), so `toMapView` accepts both GET and PUT bodies. Real reload: Ming verification 1.
- [x] AC2 Leaving with unsaved changes asks — evidence: `leave-guard.test.ts` (6 tests: beforeunload, same-origin href via closest, ignore list, capture-phase attach/detach, click listener prevents + stops + calls onLink, leaveDecision); `LayoutEditorViews.test.tsx` › "leave dialog renders Stay and Leave". Wiring: `LayoutEditor.tsx:35` arms the guard only while `dirty && !saving`; Back goes through `guard.request`; `useLeaveGuard.leave` detaches before `router.push`.
- [x] AC3 Non-admins cannot use the editor; layout never fetched for them; Edit link admin-only; truncated read-only — evidence: `editor-page.test.ts` (3 tests); `LayoutEditorPage.tsx` mounts `AdminEditor` (the only place `useRooms`/`useRoomLayout` run) only when the early gate is `loading` (admin + desktop); `LayoutEditorViews.test.tsx` › "not allowed view …", "truncated read-only view … no Save button"; `RoomMapSection.test.tsx` › "Edit layout link only with editHref, also on an empty map, hidden when truncated"; `SeatsPage.tsx` passes `editHref` only when `canManageSeats(tier)`. Server still enforces admin on the PUT.
- [x] AC4 409 conflicts offer Reload; other failures map to Retry / access / nothing — evidence: `save-errors.test.ts` (3 tests, every kind); `LayoutEditorViews.test.tsx` › "save error banner shows Reload for both 409 codes, Try again for unavailable, no button for a rule code; role=alert"; Reload remounts the editor via the view-identity key (`LayoutEditorPage.tsx:61-75`).
- [x] AC5 Edits go through the core; refusals add no step; no-op moves/deletes add no step; seat delete disabled with reason; undo drops vanished keys — evidence: `editor-state.test.ts` (move/refused move, empty selection, rotate, delete with seat, undo, "edits are ignored while saving"); `LayoutEditorViews.test.tsx` › "inspector disables Delete for a seat with the reason via aria-describedby; Items list names a seat with a diacritic code (Phòng-A-01)".
- [x] AC6 Save blocked with a visible reason (tray, truncated, invalid payload / count caps); no PUT then — evidence: `editor-state.test.ts` › "savePayload refuses: unplaced …, invalid payload (fixtures over LAYOUT_LIMITS.fixtures → no PUT), pending seat changes …", "editorFlags …"; `LayoutEditorViews.test.tsx` › "toolbar shows the Save block reason …"; `LayoutEditor.tsx:38-41` returns before `saveStart` when `canSave` or `savePayload` fails.
- [x] AC7 Canvas click selects topmost item, shift toggles, outside/empty clears, bounds and zoom accounted — evidence: `canvas-point.test.ts` (3 tests incl. negative bounds); `EditorCanvas.tsx:53-64` uses the effective (clamped) zoom and `itemAt`.
- [x] AC8 R1 and all checks green; `RoomMap.test.tsx` green after `useAtlas` extraction — evidence: checks above; `RoomMap.test.tsx` unchanged in the diff and in the passing suite.

Ticket checklist: all four ticket criteria are covered by AC1–AC4 above (the "component tests" are static-render plus pure handler tests per approved A3).

Ming verification after merge (not verified here; the PR must carry them, from plan.md "Ming verification after merge"):
1. As admin, edit a 20+ seat room (move seat + fixture, rotate seat + door, delete fixture), Save, reload: kept; room page map matches.
2. Dirty draft: nav-rail link, editor Back, tab reload/close each ask; after Save none ask; browser Back does not ask (A9).
3. Two tabs: second save shows stale + Reload; add a seat in the seat table, then save in the editor: "seats changed" + Reload.
4. As user/manager, `/rooms/<code>/edit` shows "not allowed"; no Edit link on the room page.
5. A 64×64 room opens and saves at zoom 2 (or shows "too large"; report it as a follow-up).
6. Below 1024 px wide the page shows the "use a desktop" notice.

### Issues
None.

### Scope
Every changed source and test file is in plan.md "Files to create / modify" / "Tests to write". Other changes are workflow files (`work/ming-todo.md` M-27, ticket folder). No High path touched (no SQL, server, config, proxy, Dockerfile or workflow file). Deviations listed in impl-log (`useAtlas` returns `setFailed`, no `disarm`, one-arg `leaveDecision`, `checking` while tier unknown, no Back arrow icon, zoom buttons always enabled) are small, justified and inside the plan's files.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/lib/layout-editor/*` import only `@/lib/**`; UI imports ui and lib; page imports `@/ui` only; `check:layers` clean.
- R2/R6/R7: no schema, server or route change.
- R3: no config or secrets.
- R4: inside the approved slice 2a plan.
- R5: checks green; new logic has tests.
- D36: all new copy is in `src/ui/copy/roomlayout.ts`.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `src/ui/roomlayout/LayoutEditorPage.tsx:62-63` mutates `seen.current` during render to derive the remount key. It works (the comparison makes a StrictMode double render harmless), but `useState` with the "store previous value" pattern or keying on a load counter from `useRoomLayout` would be render-pure.
- `src/ui/roomlayout/LayoutEditor.tsx:38-39` `save` reads `flags.canSave` from the render closure; a very fast double click relies on React flushing the discrete click before the second one. A ref guard (or checking `state.save.status` in a ref) would make a duplicate PUT impossible; a duplicate would anyway get 409 `layout_stale`.
- `src/ui/roomlayout/EditorCanvas.tsx:63` a shift-click on an empty tile clears the whole selection; many editors keep the selection on shift-click of empty space. Matches the plan text, so only a UX note for SIM-015.10.
- Non-link navigations (e.g. sign-out button) are not guarded; consistent with A9's documented limits, worth one line in the PR text next to "browser Back is not intercepted".

### Follow-ups (out of scope)
- From impl-log: zoom buttons' `aria-pressed` reflects the requested, not the clamped, zoom.
- From impl-log: a failed conflict Reload keeps the old view (`useRoomLayout` `keepRowsOnError`), so the editor is not remounted and the banner stays; consider a visible "reload failed" state.
