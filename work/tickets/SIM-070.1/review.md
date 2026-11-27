# Review — SIM-070.1

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 1031 files, no violations"
- `pnpm test` — exit 0, "Test Files 398 passed | 1 skipped (399); Tests 3903 passed | 9 skipped (3912)" (includes
  `scripts/check-tokens.test.ts`, `no-literals.test.ts` and `src/ui/page-container.test.ts`). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run: there is no DB, server or migration change (`git diff --stat origin/main...HEAD -- src/app src/server src/lib db` is empty).
- The branch includes `origin/main` (merge-base check ok).

### Acceptance criteria
- [x] AC1: header, stats bar, group tabs, search and card grid; one column at 390 px; correct stats. Evidence:
  `map-items-state.test.ts › mapItemStats` ({5, 4, 1} for a fixture with hidden, customised, fixed-size items and
  disallowed-direction art); `MapItemsView.test.tsx › ready: header…`, `› stats…`, `› grid…` (grid-cols-1 sm:2 lg:3
  xl:4), `› 390 px layout classes`. The structure matches `work/tickets/SIM-070/mockup-map-items-list.webp`: eyebrow,
  title with the dot, subtitle, stats card with the note, green "All N" pill, search on the right, card with the badge
  top-left and the pencil bottom-right, group chip, "Fixed size", source label, footer. The pixel-level desktop look
  and the no-sideways-scroll check at 390 px are manual and stay on Ming's list below.
- [x] AC2: tabs and search narrow the grid on the client; "All N" and "Showing N of M" stay correct; an empty result
  shows a message. Evidence: `filterItems` cases (group, unknown group, trimmed and case-insensitive name/key,
  Vietnamese fold "ban hop" and NFD, group + query combined), `activeGroup`; `MapItemsList › a group narrows…` (All
  stays 5, "Showing 1 of 5 items"), `› a query with no match…`, `› a vanished group falls back to All`, `› footer`.
- [x] AC3: card content and the pencil opening the editor. Evidence: `MapItemCard.test.tsx` (base, fixed, hidden,
  custom image, package sprite, library frame / no atlas, non-directional, aria-hidden preview, Vietnamese name);
  `MapItemCard.tsx:396-405` calls `onEdit(item)`; `MapItemsPage.tsx` is unchanged, so `onEdit` still opens
  `MapItemEditor`.
- [x] AC4: no API change; new tests cover stats, filter, art source and the card variants. Evidence: empty diff for
  `src/app src/server src/lib db`; the tests above plus `artSourceOf` (only allowed directions count, agrees with
  `isCustomised`).

Ming verification after merge (from plan.md, the PR carries these):
- Visual comparison with the list mockup at 1280 px and 390 px, light and dark (card spacing, green selected pill,
  tile-grid faintness in dark mode, readability of the 12 px mono key, no sideways scroll at 390 px).
- The **(Ming)** defaults in plan.md `## Assumptions`: search ignores diacritics (foldText); the "customised"
  spelling.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: the new code imports only `@/lib/*` and ui modules (`check:layers` green). R4: the changed
files match the plan's file list (11 source/test/script files plus the ticket's work files). R5: new logic has tests.
D36: all visible strings come from `mapItemsCopy` / `shellCopy`. R2/R3/R6/R7: not applicable.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/mapItems/MapItemsView.tsx:756-757`: the plan wanted `aria-label` on the stats `<section>`. The
  implementation uses an sr-only `<h2>`, which gives a heading but does not name the region. Adding
  `aria-labelledby` would name it.
- `src/ui/TabBar.tsx:94`: the count span follows the label with no text separator. Some screen readers may read the
  name as "All5". A sr-only space or a visible separator would avoid this.
- `src/ui/copy/mapItems.ts:138`: `art.thumbAlt` is now unused (the card image is decorative). Remove it in a later
  cleanup.
- `MapItemCard.test.tsx › the preview is aria-hidden…` cuts the preview at the first `</div>`. This is weak but
  correct for today's markup.
- While a custom image blob is still loading, the card shows the sprite or library frame but the label already says
  "Custom image". This lasts only a moment.

### Follow-ups (out of scope)
- Share one tile-grid style between `MapItemCard` and `MapItemEditorAppearance`, or add a `@utility tile-grid` after
  SIM-071 slice 7 (plan follow-up).
