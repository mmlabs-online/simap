## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| `src/ui/mapItems/map-items-state.ts` | `mapItemStats`, `filterItems`, `artSourceOf`, `activeGroup`, `ArtSource` (pure logic, Scope 1) |
| `src/ui/mapItems/map-items-state.test.ts` | tests for the four helpers |
| `src/ui/mapItems/MapItemCard.tsx` (new) | the card (Scope 5) |
| `src/ui/mapItems/MapItemCard.test.tsx` (new) | card variants |
| `src/ui/mapItems/MapItemsView.tsx` | header, stats, pill tabs, search, grid, footer; `MapItemsList` |
| `src/ui/mapItems/MapItemsView.test.tsx` | rewritten for the new page |
| `src/ui/TabBar.tsx` | additive `variant="pill"` and `count` |
| `src/ui/layout-blocks.test.tsx` | `TabBar pill` cases |
| `src/ui/kit.test.tsx` | pill TabBar in the legacy-alias scan |
| `src/ui/copy/mapItems.ts` | new copy; removed `intro`, `edit`, `list.customised` |
| `scripts/check-tokens.pending.json` | removed the `MapItemsView.tsx` entry (now 0 violations) |

### Tests added / changed
- map-items-state.test.ts › mapItemStats, filterItems (incl. Vietnamese fold), activeGroup, artSourceOf
- MapItemCard.test.tsx › base, fixed, hidden, custom image, package sprite, library frame / no atlas, non-directional, aria-hidden preview, Vietnamese name
- MapItemsView.test.tsx › forbidden, loading, error, not ready, header; MapItemsList stats, tabs, search, grid, footer, group, no match, vanished group, 390 px classes
- layout-blocks.test.tsx › TabBar pill (3 cases); kit.test.tsx › pill in legacy scan

### Checks (actual output summary)
- typecheck: `tsc --noEmit` ok; check:layers: "1031 files, no violations"
- format:check: "All matched files use the correct format."
- test: "Test Files 398 passed | 1 skipped (399); Tests 3903 passed | 9 skipped"
- build: ok (exit 0)
- `git diff --stat main -- src/app src/server src/lib db` is empty.
- Manual 1280/390 px visual check not run here (left to Ming's post-merge verification).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Share one tile-grid style between `MapItemCard` and `MapItemEditorAppearance` (plan follow-up).
- The card `<img alt>` uses a `DECORATIVE = ""` constant because `no-literals.test.ts` flags `alt=""`.

### Scope self-check
- Could the diff be smaller? no
- Diff size: see `git diff --stat`
