# SIM-070: Redesign the Map items page and merge item edit and art into one Item editor

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T03:48Z |
| PR | — |

## Goal
The Admin "Map items" page follows Ming's mockups (in this folder: `mockup-map-items-list.webp`,
`mockup-item-editor-appearance.webp`, `mockup-item-editor-details.webp`): a header with a stats bar, group tabs and
search over a card grid. One "Item editor" popup with Appearance and Details tabs replaces today's separate edit,
art and reset dialogs.

## Scope reference
`docs/spec-v1.md` LAY-07 (Map item catalog, phase 1), "Art per item"; decisions D52 (clean UI kit on management
screens), D64, D66, D67 (alphabetical list, hidden items only for Admins), D36 (copy in `src/ui/copy/`). Request:
Ming 2026-11-27 with three mockup images. Same principle as SIM-068/SIM-069: take the visual idea; keep today's
features, rules and API.

## Scope
- **Header:** eyebrow "Build your little world", title "Map items", subtitle "Small details. A space that feels like
  yours. Manage your room's sprites and objects."
- **Stats bar:** N map items, N in palette (not hidden), N customized (any direction with a package sprite or custom
  image instead of the library sprite), and the note "32 px tile system · 4 directional sprites". All computed
  client-side from the loaded list.
- **Group tabs** ("All N" plus one tab per group in the data) and a **search** over name and library key, both
  client-side.
- **Card grid:** the sprite preview on a tile-grid background, a `w × h` badge (LAY-07: size always visible), a
  pencil button that opens the editor, name, library key, group chip, "Fixed size" for fixed-size items, the art
  source ("Library sprite", "Package sprite" or "Custom image"), and a "Hidden" mark for hidden items. Footer:
  "Showing N of M items · Items are never deleted. Hide an item to remove it from the local palette."
- **Item editor popup** ("Item editor", "Edit <name>", library key), two tabs:
  - **Appearance:** direction tabs N/E/S/W with the note "Never auto-rotated" (one image only for non-directional
    items), a 2× preview with its art-source label, a Sprite library / Upload image switch, today's sprite browser
    (search, "All types"), "Only updates the <direction> view", and "Restore default" (that direction back to the
    library sprite).
  - **Details:** display name, group, footprint width and height (1–4, disabled with "This item uses a fixed
    footprint." for fixed-size items), "Show in item palette", and "Reset item to library defaults" (today's reset,
    with its confirm step).
  - **Footer:** unsaved-changes status ("No unsaved changes" / changed), Cancel, Save changes. One Save sends the
    pending detail edit and art changes with today's endpoints; a refusal (e.g. 409 `item_in_use` with its room
    count, 422 image rules) is shown in the popup and nothing already saved is shown as unsaved. Cancel or close
    with unsaved changes asks first.
- Today's rules stay: the size-change warning that custom images are removed (OQ-52), image checks (PNG, size,
  64 KB) before upload, Admin-only edits.
- Copy in `src/ui/copy/mapItems.ts`.

## Out of scope
- Any API, schema or rule change. The mockup's "6 placed copies in sample rooms" line needs a placed count the API
  does not return: not shown (a follow-up if Ming wants it). The mockup's "Local library · Browser preview" badge
  and app-shell parts (sidebar, breadcrumb, "Production" chip) are not part of this ticket.
- Reordering items or groups (D67 lists items alphabetically; the mockup has no order control).

## Acceptance criteria
- [ ] Header, stats bar, group tabs, search and card grid render as in the list mockup at desktop width; at 390 px
  the grid is one column with no horizontal page scroll; stats are correct for a fixture list (hidden, customized,
  fixed-size items).
- [ ] Group tabs and search narrow the grid client-side; "All N" and "Showing N of M items" stay correct; an empty
  result shows a short empty message.
- [ ] Each card shows the preview, `w × h`, name, library key, group, "Fixed size" when fixed, the art source and a
  hidden mark; the pencil opens the Item editor for that item.
- [ ] The Item editor holds both tabs: Appearance sets art per direction (package sprite, upload, restore default)
  and Details edits name, group, size and palette visibility and offers reset to library defaults; there is no
  other edit, art or reset dialog left on the page.
- [ ] Save changes applies all pending changes through today's endpoints, shows refusals (409 `item_in_use` with
  room count, 422 image rules, name clash) in the popup, and the status reads "No unsaved changes" after a full
  save; Cancel/close with unsaved changes asks for confirmation.
- [ ] No API change; existing map item tests pass or change only for markup; new render tests cover the stats,
  tabs/search, card variants and the editor's save, refusal and unsaved-changes paths.

## Technical notes
- Files: `src/ui/mapItems/MapItemsView.tsx`, `MapItemsPage.tsx`, a new `MapItemEditor.tsx` that takes over
  `MapItemFormDialog.tsx`, `MapItemArtDialog.tsx` and `ResetMapItemDialog.tsx` (their pure helpers
  `map-item-form.ts`, `map-item-art.ts`, `map-item-image.ts` stay), `SpriteBrowser.tsx`, `FramePreview.tsx`,
  `src/ui/copy/mapItems.ts`.
- LAY-07 says art is "previewed at 1× and 2×"; the mockup shows 2× in the editor and the card preview is the 1×
  view. Planner: confirm the card counts as the 1× preview or keep a small 1× preview in the editor.
- Saving detail and art changes in one click means several requests; the plan must define the order (details first,
  since a size change removes custom images) and what the popup shows after a partial failure.

## Test plan
- Unit/render (Vitest): stats counts, tab and search filter, card variants (fixed size, hidden, customized,
  non-directional), editor tabs, combined save order, partial failure, unsaved-changes confirm.
- Manual: 1280 px and 390 px, light/dark, an item placed in a room (size change refused), upload of a wrong-size PNG.

## Notes / answers from Ming
- 2026-11-27: requested with three mockup images ("refactory layout của page map item theo design này. Edit thông
  tin và hình ảnh chung 1 popup").

## Handoff
