## Attempt 1 — 2026-11-23

Size: about 263 source lines (156 changed in existing files plus the 107-line runner), under the 450 fallback. The
seat limit (A5) and the copy polish stay in this ticket; nothing moved to SIM-015.11.

### Files touched
| File | Required because |
|---|---|
| `src/lib/layout-editor/save-run.ts` (new) | `runSave`, `SaveApi`, `SaveDetail`, `SaveOutcome`: the A3 DELETE, POST, PUT sequence, never throws |
| `src/lib/layout-editor/save-run.test.ts` (new) | Runner tests with a scripted fake API (AC1-AC3) |
| `src/lib/layout-editor/save-plan.ts` | `withPlaceholderSeatIds`, `dropSeat` |
| `src/lib/layout-editor/save-plan.test.ts` | Tests for both helpers |
| `src/lib/layout-editor/editor-state.ts` | Delete of seats allowed, `pending_seats` removed, dry-run payload, `saveFailed` progress and detail, `seat_limit` notice |
| `src/lib/layout-editor/editor-state.test.ts` | Updated delete and savePayload tests, new desk place, saveFailed progress, saveDone after desk add |
| `src/lib/layout-editor/place-tool.ts` | `{ kind: "desk" }` tool, `seat_limit` refusal |
| `src/lib/layout-editor/place-tool.test.ts` | Desk tool tests |
| `src/lib/layout-editor/palette.ts` | `fixturePalette` renamed `editorPalette`, includes the desk group |
| `src/lib/layout-editor/palette.test.ts` | Updated for `editorPalette` |
| `src/lib/layout-editor/save-errors.ts` | `seat_not_empty` is invalid, `seats_unmatched` is conflict |
| `src/lib/layout-editor/save-errors.test.ts` | Two new cases |
| `src/ui/roomlayout/LayoutEditor.tsx` | `save()` uses `runSave`; palette arms the desk tool; leave guard stays on while saving (A8); banner gets `detail` |
| `src/ui/roomlayout/Palette.tsx` | `onArm(entry)`, label by entry kind |
| `src/ui/roomlayout/EditorInspector.tsx` | Delete enabled for seats, save note, `"use client"` |
| `src/ui/roomlayout/EditorViews.tsx` | Banner `detail` line and `saveErrors` messages |
| `src/ui/copy/roomlayout.ts` | Desks group, "New desk", `seat_limit`, `deleteSeatNote`, `saveErrors`, `saveDetail`; `seat_delete` removed |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Updated palette and inspector tests; banner detail, new desk name, seat_limit tests |

### Tests added / changed
- save-run.test.ts: all 13 rows of the plan (no changes; delete/create/PUT order; seq mapping with gap; 409 on 2nd seat; 409 into tray; 404 as done; unavailable; 60 desks in chunks; fewer seats; PUT fails after creates; retry sends only remaining calls; throwing API; tray not empty)
- save-plan.test.ts › withPlaceholderSeatIds, dropSeat
- editor-state.test.ts › delete of an existing seat (replaces the seat_delete refusal test); savePayload accepts removed seats and new desks (replaces the pending_seats cases); place with a desk tool; saveFailed with progress; saveDone after desk add
- place-tool.test.ts › tryPlace desk; placementPreview, sameTool, nextTool for desk
- palette.test.ts › editorPalette
- save-errors.test.ts › seat_not_empty and seats_unmatched
- LayoutEditorViews.test.tsx › palette Desks group, inspector Delete note, New desk, banner detail, seat_limit status line

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: 413 files, no violations
- format:check: exit 0 (after `pnpm format`)
- test: 1777 passed, 3 skipped (1780)
- build: `pnpm build` exit 0
- test:db: not run (CI only, no server or SQL change)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `toolName` in `LayoutEditor.tsx` already names the desk tool "New desk" through `itemName`, so it needed no change.
- Ming verification 1 to 5 (real server numbering, 409 flow, offline retry, leave dialog) need a running stack and were not run here.

### Scope self-check
- Could the diff be smaller? No. The runner and its tests are the core; the rest is the plan's file list.
- Diff size: +438 / -95 lines in existing files, plus the two new files (about 107 source lines and about 300 test lines)
