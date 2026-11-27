# SIM-070.1: Map items page header, stats bar, group tabs, search and card grid

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-070 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T09:23:28Z |
| PR | — |

## Goal
Slice 2 of SIM-070: the Admin "Map items" list follows Ming's list mockup
(`work/tickets/SIM-070/mockup-map-items-list.webp`). It gets a header with a stats bar, group tabs and search over a
card grid, and each card's pencil opens the SIM-070 Item editor.

## Scope reference
`docs/spec-v1.md` LAY-07; decisions D52, D66, D67, D36. Parent ticket SIM-070 (AC 1, AC 2 and the card content of
AC 3). Its `plan.md` → `## Split proposal` (slice 2) and `## Assumptions` 9 hold the chosen defaults.

## Scope
- `map-items-state.ts`: `mapItemStats(items)` (total, in palette = not hidden, customised = `isCustomised`),
  `filterItems(items, group, query)` (name and key, case-insensitive, trimmed; flat list in `catalogGroups` order)
  and `artSourceOf(item)` (custom image, then package sprite, then library sprite, over `artDirs`).
- Header: eyebrow "Build your little world", title "Map items", subtitle "Small details. A space that feels like
  yours. Manage your room's sprites and objects." (replaces `intro`).
- Stats card with the note "32 px tile system · 4 directional sprites"; it wraps at 390 px.
- Group tabs ("All N" plus one tab per group) and a labelled search field.
- Card grid of `MapItemCard`: tile-grid preview with a library-frame fallback, `w × h` badge, a 44 px pencil button,
  name, key, group chip, "Fixed size", art source and a "Hidden" mark.
- Footer "Showing N of M items · Items are never deleted. Hide an item to remove it from the local palette." and an
  empty-result message.
- Loading, error, forbidden and not-ready states stay.

## Out of scope
- Any API change; placed-copies count; "Local library" badge; app shell; reorder (as SIM-070).

## Acceptance criteria
- [ ] Header, stats bar, group tabs, search and card grid render as in the list mockup at desktop width. At 390 px
  the grid has one column and the page does not scroll sideways. Stats are correct for a fixture list with hidden,
  customised and fixed-size items.
- [ ] Group tabs and search narrow the grid client-side; "All N" and "Showing N of M items" stay correct; an empty
  result shows a short message.
- [ ] Each card shows the preview, `w × h`, name, library key, group, "Fixed size" when fixed, the art source and a
  hidden mark. The pencil opens the Item editor for that item.
- [ ] No API change; new tests cover stats, filter, art source and the card variants.

## Technical notes
- Files: `src/ui/mapItems/MapItemsView.tsx` (+ new `MapItemCard.tsx`), `map-items-state.ts`, `src/ui/TabBar.tsx`
  (a `variant="pill"`, default unchanged), `src/ui/copy/mapItems.ts`.
- SIM-071 (app-wide restyle) touches the same files; run this ticket first or rebase on it.

## Test plan
- Unit/render: stats fixture, filter, art source, card variants (fixed, hidden, customised, non-directional),
  tabs/search markup, 390 px classes.
- Manual: 1280 px and 390 px, light/dark.

## Notes / answers from Ming
- 2026-11-27: split from SIM-070 by its planner (slice 2).

## Handoff
