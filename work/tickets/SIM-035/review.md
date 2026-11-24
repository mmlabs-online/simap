## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
Run on `ticket/SIM-035` (HEAD `6a4346c`), Windows, Node 22 via fnm, `cmd /c pnpm …`.
- `pnpm format:check` — exit 0, "All matched files use the correct format." (655 files)
- `pnpm typecheck` — exit 0 (`next typegen` + `tsc`, no errors)
- `pnpm check:layers` — exit 0, "check-layers: 601 files, no violations"
- `pnpm test` — exit 0, "Test Files 228 passed (228)", "Tests 2281 passed | 3 skipped (2284)"
- `pnpm build` — exit 0, all routes listed, no errors
- `pnpm test:db` — not run locally (no Postgres); the 3 new tests in `src/server/layout/layout.db.test.ts` were judged
  by reading (helpers `room`/`value`/`get`/`addDevice` used correctly; primary device is owned by the seat occupant, so
  the deferred trigger passes; the composite seat FK keeps devices in their org). CI must show `pnpm test:db` green
  before merge.

Results match impl-log.md attempt 1.

### Acceptance criteria
- [x] AC1 Editor refuses a fixture on a desk tile (place, drag, group move) — evidence: `place-tool.test.ts` › "a fixture on any desk tile is refused (ghost not ok)"; `draft.test.ts` › "moving a fixture onto a desk is refused", "group move onto a desk is refused", "moving a desk onto a prop is refused", "moving a prop and its desk together is allowed", "rotating a desk onto a prop is refused", "placing a tray seat onto a prop is refused"; `editor-state.test.ts` › "place on a desk sets the refused notice, draft unchanged". All ops go through `checked()` → `checkLayoutRules` (`src/lib/validate/layout.ts:197`). Manual hover check is for Ming.
- [x] AC2 PUT returns 422 with a layout rule code — evidence: `route.test.ts` › "a fixture on a desk gives 422 layout_fixture_on_desk; service not called"; `validate/layout.test.ts` › "prop.mug on either tile of an s desk…", "prop on the second tile of an e (1x2) desk…", "a prop next to a desk, and on its chair tile, is allowed", "a blocking plant on a desk is still layout_overlap (rule order)", "validateLayoutSave with a prop on a desk…", "fixturesOnDesks returns exactly the offending fixture indices".
- [x] AC3 GET returns per-seat device types, org-scoped (R6) — evidence: `src/server/layout/layout.ts:93-108` (one `orgQuery` with `org_id = $1`, only `left(type, 61)` returned, ordered `(role = 'primary') desc, created_at, id`; `role` is `not null`, so no NULLS-FIRST surprise); `layout.db.test.ts` › "seatDevices: types per seat, primary first then created_at, id", "…another org's devices, inventory devices and other rooms' devices are never returned", "…at most 8 per seat, truncated stays false" (read, CI runs them).
- [x] AC4 Type → sprite mapping, 2 PCs → 2 `device.pc` — evidence: `device-slots.test.ts` › "maps D37 types case- and space-insensitively; anything else is other" (includes ` pc `, `ip  Phone`, `Printer`, `Màn hình`, `""`, `__proto__`); `placement.test.ts` › "two PC devices draw two device.pc frames", "each type maps to its sprite (directional laptop/monitor follow the desk)". All `device.*` keys used exist in `public/sprites/office.json`.
- [x] AC5 Per-type slots, monitor right/left, PC under, all rotations — evidence: `device-slots.test.ts` › "one of every kind: distinct positions inside the desk footprint, all 4 rotations", "monitor 1 is on the occupant's right of monitor 2, all 4 rotations", "only pc is under…", "overflow: the 3rd monitor reuses slot 2…"; `placement.test.ts` › "a PC op comes before its desk op; phone, other and monitor ops come after it", "slots follow rotation 0/90/180/270".
- [x] AC6 Editor draws devices, not selectable/movable/saved — evidence: `EditorCanvas.tsx` passes `seatDevices` only to `buildDrawList`; selection/hit-test/save use `draft.items`; `placement.test.ts` › "device ops add no seat box and no selectable id…"; `editor-state.test.ts` › "seatDevices are kept from the view and never reach savePayload".
- [x] AC7 Spec and decision — evidence: `docs/spec-v1.md` LAY-01 (l.343) and LAY-06 (l.360-361) rewritten; `work/decisions.md` D62 records A1-A6 (D61 already records the rule).

Ming verification after merge (not verified here, carry to the PR):
- Visual read with the placeholder atlas on a real room: under-desk PC, monitor right/left and phone on the desk top in all 4 rotations at 2x-4x zoom (offsets tuned in `/dev/roommap`).
- A real room with a prop already on a desk: the editor shows the "removed" notice and Save clears it (A2).

### Issues
None.

### Scope
Every changed file is in the plan's file list or justified under impl-log `Out-of-plan files`
(`src/lib/sprites/resolve-layout.test.ts`: an existing assertion that the rules accept a prop on a desk now expects
`layout_fixture_on_desk`; `RoomMapSection.test.tsx`: `seatDevices: {}` added to a `MapView` fixture). Workflow files
(`ticket.md`, `ming-todo.md` M-47) are loop bookkeeping. No High path touched.

### Rules (CLAUDE.md)
No violations found. R1: `device-slots.ts`/`placement.ts`/`map-view.ts` stay in lib, server imports lib only
(`check:layers` green). R6: the new query is org-scoped via `orgQuery` (`layout.ts:95-104`). R7: no new auth codes; the
new 422 comes from the validator before any write (route test asserts the service is not called). R2/R3: no schema or
config change. R5: checks green, new logic tested. D36: new copy in `src/ui/copy/api.ts` and `src/ui/copy/roomlayout.ts`.

### Blockers from review agents
None (orchestrator fills in from security-review.md if the trigger ran).

### Nits (do not block)
- `src/lib/sprites/placement.ts:238` — tier 0 (`under`) applies to the whole row, so a PC also paints before other
  desks to its left in the same row. Harmless with current offsets (6 px), worth keeping in mind when SIM-033 art or
  SIM-036 slots grow.
- `src/server/layout/layout.ts:104` — the query also returns devices of unplaced (tray) seats, which the client then
  drops in `toMapView`. Fine as documented in the plan; could filter `tile_x is not null` later.
- `src/lib/validate/layout.ts:108-115` — `y * 1000 + x` cell key (already noted by the implementer as a follow-up).

### Follow-ups (out of scope)
- A "+n" overlay when more than 4 devices of one kind sit at a seat (A3).
- Shared cell-key helper for the validator and editor tiles.
