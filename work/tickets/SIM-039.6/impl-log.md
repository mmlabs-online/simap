
## Attempt 1 — 2026-11-25

Slice 1 only (plan approved by Ming; art per direction is SIM-039.9).

### Files touched
| File | Required because |
|---|---|
| `src/ui/mapItems/map-items-api.ts` | `call`/`errorOf` with `rooms`, new `patch` and `reset` (plan) |
| `src/ui/mapItems/map-items-api.test.ts` | patch/reset/rooms/never-throws cases |
| `src/ui/mapItems/map-items-state.ts` (+ test) | pure state (plan) |
| `src/ui/mapItems/map-item-form.ts` (+ test) | pure form diff and resize effects (plan) |
| `src/ui/mapItems/MapItemsPage.tsx`, `MapItemsView.tsx` (+ view test) | page and pure view (plan) |
| `src/ui/mapItems/MapItemFormDialog.tsx` (+ test) | edit dialog and fields (plan) |
| `src/ui/mapItems/ResetMapItemDialog.tsx` (+ test) | reset confirm (plan) |
| `src/ui/copy/mapItems.ts` | D36 copy (plan) |
| `src/app/(app)/map-items/page.tsx`, `src/ui/index.ts` | route and export (plan) |
| `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/lib/icons.ts`, `src/ui/copy/shell.ts` | nav entry, `chair` icon, labels (plan) |

### Tests added / changed
- map-items-api, map-items-state, map-item-form, MapItemsView, MapItemFormDialog, ResetMapItemDialog tests as listed in the plan; nav.test.ts (admin 11, mapItems admin only, rail order).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc, no errors.
- check:layers: 761 files, no violations.
- test: Test Files 288 passed | 1 skipped; Tests 2935 passed | 7 skipped.
- build: exit 0.
- test:db: not run (no server code changed; plan item 10 skipped on the orchestrator's instruction).

### Out-of-plan files
- `src/ui/mapItems/test-items.ts` — tiny shared test fixture (`dto()`), used by 5 test files; not shipped logic.
- `src/ui/AppShellView.test.tsx` — the plan said it needs no edit, but it asserts the admin nav list (9 -> 10 links, adds `/map-items`); it failed otherwise.

### Follow-ups (noticed, not done)
- Amend LAY-07 and the ticket Scope wording from "reorder" to "listed alphabetically (D67 1)" (flagged in the plan).
- Floor hide may have no visible effect (plan A9).

### Scope self-check
- Could the diff be smaller? No; everything is plan-listed.
- Diff size: 8 modified files +123 / -24, plus new files.
