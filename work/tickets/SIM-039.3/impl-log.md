# Implementation log — SIM-039.3

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/lib/validate/layout.ts` | `FootprintLookup`, `registryFootprints`, `footprintAt`, lookup parameter on `checkLayoutRules`/`fixturesOnDesks`/`validateLayoutSave`, `checkLayoutBasics`, `parseLayoutSave` (plan step 1) |
| `src/lib/validate/layout.test.ts` | sized-rule, `footprintAt`, `parseLayoutSave` and unchanged-`validateLayoutSave` cases |
| `src/lib/map-items/footprints.ts` (new) | `catalogFootprints` lookup builder (no import cycle) |
| `src/lib/map-items/footprints.test.ts` (new) | AC1 proof and builder cases |
| `src/lib/sprites/resolve-layout.ts` | lookup as 4th parameter, `footprintAt` in `take()` |
| `src/lib/sprites/resolve-layout.test.ts` | `catalog lookup` describe |
| `src/lib/sprites/layout.ts` | `LayoutItem`, additive `LayoutResponse.items` |
| `src/server/layout/save.ts` | catalog sizes `for key share`, sized rules, hidden rule, wider `SaveRefusal` |
| `src/server/layout/save.test.ts` | fake answers catalog/hidden statements; new cases; fixture values made valid (rules now run in the save) |
| `src/server/layout/layout.ts` | `readLayoutRows`: one catalog select, lookup into `resolveLayout`, fill `items` |
| `src/server/layout/layout.db.test.ts` | new describe (catalog sizes, hidden, items, org isolation, race); statement-count test 6 -> 7 (one extra select) |
| `src/app/api/rooms/[id]/layout/route.ts` | PUT calls `parseLayoutSave` |
| `src/app/api/rooms/[id]/layout/route.test.ts` | on-desk test now reaches the service; refusal mappings |
| `src/lib/api/error.ts` | `layout_item_hidden` appended |
| `src/ui/copy/api.ts` | copy for `layout_item_hidden` |
| `src/lib/layout-editor/save-errors.ts`, `.test.ts` | `layout_item_hidden` is "invalid" |
| `src/server/README.md` | layout-save lock order sentence |

### Tests added / changed
- `footprints.test.ts`: catalog lookup vs `footprintOf` for every placeable seat/fixture key x rotation; `registryFootprints` same; builder cases.
- `layout.test.ts`: `footprint lookup` (swap rule, overlap, bounds+swap, desk tile, shrink, null lookup, registry sizes) and `parseLayoutSave` (accepts size faults, still refuses shape/sprite/rotation/zone/grid/floor cap; `validateLayoutSave` unchanged).
- `resolve-layout.test.ts › catalog lookup` (3 cases).
- `save.test.ts`: order with `catalog sizes`; statement text and values; overlap at catalog size; missing key; hidden fixture count; no hidden key; hidden desk exempt; hidden floor kept/added.
- `layout.db.test.ts › catalog footprints and hidden items (db)`: 11 cases per the plan (plus one extra: a fixture growing onto a desk gives `layout_fixture_on_desk`).
- `route.test.ts`, `save-errors.test.ts` as planned.

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0
- check:layers: "719 files, no violations"
- test: 271 files passed, 1 skipped; 2727 tests passed, 7 skipped
- build: exit 0
- Local DB (throwaway PostgreSQL 16 cluster under /var/tmp, port 55432, trust auth, `DATABASE_URL` passed inline only, no .env* read or written; cluster stopped and directory deleted): `pnpm migrate` exit 0 (all applied, then "up to date"); `pnpm test:db`: 17 of 18 files passed, 244 tests passed, 5 failed. The 5 failures are all in `src/server/devices/handoffs.db.test.ts` (handoffs (db): start: owner starts, manager starts, second start 409, two concurrent starts, start leaves owner/seat unchanged). They are pre-existing on `main` (per Ming/orchestrator) and not touched here; not fixed. `layout.db.test.ts` (44 tests) and `map-items*.db.test.ts` all pass.

### Findings during implementation
- The registry does not swap w and h for a non-directional item at 90/270 (shelf.books, sofa, table.coffee, whiteboard, window.double at 90/270 give 2x1 from the registry; `footprintAt` gives 1x2). Those combinations are always refused earlier as `layout_bad_rotation`, so no valid layout differs. The AC1 test compares only placeable combinations (rotation 0, or a directional item); all of those match `footprintOf` exactly.
- Pre-deploy query: the VALUES list was checked against `LIBRARY_ITEMS` and equals every non-1x1 entry: desk.single 2x1, elevator 2x2, stairs 2x2, door 1x2, shelf.books 2x1, sofa 2x1, table.coffee 2x1, table.meeting 3x2, whiteboard 2x1, window.double 2x1 (10 entries). Matches the plan.
- A8 holds: the editor still checks registry sizes and offers hidden items until SIM-039.5.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `src/server/devices/handoffs.db.test.ts`: 5 pre-existing failures on `main`.
- The `layout_unknown_sprite` default for `invalid_request` from `checkLayoutRules` in `save.ts` is a type-narrowing guard only; the route's `parseLayoutSave` already prevents it.

### Scope self-check
- Could the diff be smaller? No; product code is the plan's list, the rest is tests.
- Diff size: see `git diff --shortstat` at commit.
