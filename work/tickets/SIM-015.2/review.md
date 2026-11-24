# Review: SIM-015.2

## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (437 files)
- `pnpm typecheck` — exit 0 (route types generated, `tsc --noEmit` clean)
- `pnpm check:layers` — exit 0, "check-layers: 383 files, no violations"
- `pnpm test` — exit 0, "Test Files 156 passed (156); Tests 1651 passed | 3 skipped (1654)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only, no Postgres here); the slice has no SQL or server code

### Acceptance criteria
- [x] AC1 tile math — evidence: `tiles.test.ts` "pointToTile maps pixels … zoom 2, 3, 4", "pointToTile clamps …", "dragDelta is a whole-tile difference …" pass; `tiles.ts:11-27`
- [x] AC2 place refusals and single add — evidence: `draft.test.ts:80-113` (out of bounds, overlap, chair out of room, chair on blocker, unknown/floor/chair sprite, non-blocking over blocking) pass; `draft.ts:90-108` goes through `checkLayoutRules`
- [x] AC3 group move all-or-nothing — evidence: `draft.test.ts:119-133` (edge refusal, overlap with unselected item, swap) pass; `draft.ts:133-140`
- [x] AC4 rotate — evidence: `draft.test.ts:137-166` (0→90→180→270→0, registry footprint 2×1/1×2, out-of-bounds footprint and chair, only non-directional refused, mixed selection keeps 0) pass; `draft.ts:143-154`
- [x] AC5 delete — evidence: `draft.test.ts:170-183` pass; `draft.ts:157-171`
- [x] AC6 tray place and save blocked — evidence: `draft.test.ts:187-200`, `save-plan.test.ts:51-54` and `:121-126` pass
- [x] AC7 resize 1..64, cut refused, floor stretch/clip/drop — evidence: `draft.test.ts:204-233` pass; `draft.ts:173-191`
- [x] AC8 undo, refused op adds no step, cap 50 — evidence: `history.test.ts` (4 tests) pass; `history.ts:10-12`
- [x] AC9 dirty check — evidence: `save-plan.test.ts:38-47` pass
- [x] AC10 save plan, seq mapping with `Phòng-A` codes, payload accepted by `validateLayoutSave` with exact keys, refusals — evidence: `save-plan.test.ts:56-126` pass
- [x] AC11 palette — evidence: `palette.test.ts` (2 tests, incl. full set equality against `REGISTRY` filtered by `FIXTURE_GROUPS`) pass
- [x] AC12 `draftToRoomLayout` paintable — evidence: `draft.test.ts:237-247` (`buildDrawList(...).unknown` empty, new desk id `n:1`, code "") pass
- [x] AC13 lib-only, all checks green — evidence: new files import only `@/lib/**` and `./*`, no React, no `server-only`; `check:layers` and all checks above green
- Ticket criterion "Unit tests cover tile math, group moves, rotation, undo, the layout diff and the save payload" — met by AC1–AC13 above.
- Ming verification after merge: none for slice 1 (plan says no user-visible change).

### Scope
Changed source files are exactly the plan's list (`src/lib/validate/layout.ts` exports plus `spriteInfo`, `src/lib/layout-editor/{types,tiles,draft,history,save-plan,palette}.ts` and five test files). `src/lib/validate/layout.ts` change is exports plus one getter; no rule changed. Work files (`plan.md`, consults, `impl-log.md`, `ticket.md` re-scope, `ming-todo.md` M-26) are loop bookkeeping. No High path touched. `work/backlog.md` unchanged on the branch.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: lib-only imports (layer check green). R2/R6/R7: not touched (no schema, route or server code). R3: no config or secrets. R4: within plan. R5: checks green, every exported function has a test (`forgetDeletedSeat`, `canUndo`, `rulesInput`, `footprintCells` covered directly or through the listed tests).

### Blockers from review agents
None (no review-trigger path changed).

### Nits (do not block)
- `draft.ts:118` — `placeFromTray` with an id that is not in the tray returns `layout_unknown_sprite`; a caller error, but the code name is misleading if slice 2 ever maps it to copy.
- `draft.ts:157-171`, `draft.ts:133-140` — `deleteItems` with an empty selection and `moveItems` with `(0, 0)` return `ok` with an equal draft, so a naive caller would commit a no-op undo step. Slice 2 should skip the commit in that case.
- `save-plan.ts:8-20` — `isDirty` orders items by local key; deleting a fixture and placing an identical one at the same tile gives a new `f:<k>` key and can read as dirty when the saved layout would be the same. Harmless (Save is just enabled).

### Follow-ups (out of scope)
- `checkLayoutRules` does not enforce the count caps (`LAYOUT_LIMITS.fixtures` 2000, `seats`, floor-cell cap); a draft can grow past what `validateLayoutSave` accepts. Slice 2/3 (SIM-015.7/015.8) should refuse the place or validate the payload before the PUT.
- After `assignCreatedSeats`, new desk keys change from `n:<k>` to `s:<id>`; slice 2 selection state must be remapped or cleared after Save.
- File SIM-015.7 and SIM-015.8 on the board (orchestrator, on `main`).
