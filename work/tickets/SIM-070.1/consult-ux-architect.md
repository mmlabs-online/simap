## SIM-070.1 UX consult: list page (read-only)

Read for this consult: the ticket, `mockup-map-items-list.webp`, the SIM-070 `consult-ux-architect.md`, `src/ui/TabBar.tsx`, `MapItemsView.tsx`, and `globals.css` (the legacy compat layer over `src/styles/tokens.css`). Not opened: `tokens.css`, `Chip.tsx`, `Button.tsx` or `Card.tsx`. The token mappings below therefore come from the `globals.css` compat layer, and the plan should confirm them.

### Findings

**Current state**
- `MapItemsView` is an h1 plus intro, then one section per group with one `Card` row per item. It uses a local `BADGE` class and `page-library` for the container.
- The `MapItemsPage` editor (`MapItemEditor`, `MapItemEditorAppearance`, `MapItemEditorDetails`) is already on main. This ticket only changes the list, and the `onEdit(item)`, `thumbUrl` and `atlas` props can stay as they are.
- `TabBar` is an underline tab bar:
  - It has no variant prop.
  - It uses `border-divider`, `border-workspace-primary` for the active tab, and `flex-1 sm:flex-none`.
  - `role="tablist"` sits on an `overflow-x-auto` wrapper.
  - It has a roving tabindex and arrow/Home/End keys.
  - It requires `tabIdOf` and `panelIdOf`.
  - Its `chip` field renders a decorative accent `Pill`.

**Token reality on main**
- The legacy `--primary` is the ink colour (near-black), not green. `bg-primary` is therefore dark ink, not the mockup's dark green.
- Mapping the mockup's green:
  - The solid green active tab maps to `bg-primary-container text-on-primary-container`, which is `--color-workspace-action` and `--color-on-action`. Confirm in `tokens.css` that this is the green, not the orange accent.
  - The soft green chip maps to `bg-accent-orange-soft`, which is `--color-workspace-primary` at 10% on surface (the workspace accent tint). Check that it renders green in the mockup's workspace. If it does not, use a tint of the action colour.
- Other classes:
  - Surfaces: `bg-surface`, `bg-surface-container` (canvas), `bg-surface-high`.
  - Borders: `border-outline-variant` (divider), `border-outline` (border).
  - Text: `text-on-surface`, `text-on-surface-variant`.
  - Radius: `rounded-md3`, `rounded-md3-lg`, `rounded-md3-xl`.
  - Sizing: `min-h-control` (44 px floor), `page-library`.
  - Mono font: `font-mono`, from `tokens.css`.
- Pixel tokens: `px-floor` and `px-wall` flip in dark mode (`#d9dee5`/`#eef1f5` become `#1e2228`/`#2a2f37`). `--grid-line` is a tile-line colour with a dark override and is the natural tile-grid line colour. There is no tile-grid background utility yet.

**Mockup**
- Header: a mono uppercase eyebrow, a large title with an accent dot, and a one-line subtitle.
- Stats: one bordered card with three "big number + label" items on the left and an icon with a note on the right.
- Controls row: pill tabs on the left, with the active tab solid green and a small mono count. A search field with a magnifier on the right.
- Grid: 4 columns at 1280 px with a gap of about 12 px. Each card has:
  - a preview area of about 58% of the card height, on a tile grid;
  - a mono `w × h` badge at top-left and a round pencil at bottom-right;
  - a bold name and a mono key;
  - a footer row with a soft chip, the plain text "Fixed size", and the art source aligned right.
- A footnote below the grid.

### Recommendations

1. **Header and stats**
   - Put the header block in `flex flex-col sm:flex-row`, so a right-aligned badge can be added later. The ticket rules out the "Local library" badge, so do not add it now. The header needs no hidden state.
   - Eyebrow: `font-mono text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant`. Check the contrast of the 11 px text.
   - The h1 keeps the `text-h2` family (or the tokens' title size). Render the accent dot as `<span aria-hidden>.</span>`, so the accessible name stays "Map items".
   - Stats markup:
     - A `<dl>` with `flex flex-wrap items-baseline gap-x-6 gap-y-2`. Each item is a `<dt>` label and a `<dd>` number.
     - Do not rely on screen readers announcing `<dl>` as a list.
     - The DOM order should read "10 map items". Show the number first visually with `flex-row-reverse`, or use a single `<div>` per stat.
   - At 390 px, give the note its own row (`basis-full` or `w-full` plus a top border). Do not hide it; its text may wrap.
   - Numbers use `text-on-surface` at a heavier weight. The mockup uses 20 px numbers and 14 px labels.

2. **Group tabs (AC 1, 2)**
   - `TabBar` is the one ARIA-correct tab component. Extend it with `variant?: "underline" | "pill"` (default unchanged, as the ticket says) instead of forking it.
   - The pill variant:
     - removes `border-b`, `flex-1` and the underline;
     - uses `rounded-md3 px-4 min-h-control`, with `gap-2` between pills;
     - selected: `bg-primary-container text-on-primary-container`;
     - unselected: `text-on-surface-variant` with a hover state layer;
     - keeps `overflow-x-auto` on the wrapper, with `shrink-0` on each pill and `min-w-0` on the parent flex child, so the page never scrolls sideways.
   - The count:
     - The existing `chip` field renders a `Pill tone="accent"`. Instead, put a plain mono number in the tab: `All <span class="font-mono text-xs">10</span>`. The accessible name "All 10" reads fine.
     - Do not also put the count in a separate aria-label.
     - If you reuse `chip` for the count, check its contrast on the selected green.
   - Tab semantics:
     - A tab list over one filtered region is acceptable.
     - Give the single panel `role="tabpanel"`, with `aria-labelledby` set to the active tab's id.
     - There is one region (the grid), so `tabIdOf` and `panelIdOf` must return the same panel id for every tab. `aria-controls` then always points to a valid element.
     - The panel wraps the grid and the empty message. The footer sits outside it.
     - The panel contains the pencil buttons, so it must not get `tabIndex={0}`. That attribute is only for panels with no focusable content.
   - The selected group is `useState` in `MapItemsView`.
     - If the group disappears (for example, it was renamed in the editor and the list reloaded), fall back to "all".
     - Derive this rather than using an effect: `const group = groups.includes(g) ? g : "all"`.
   - At 390 px the tab row scrolls inside its own container.
     - Add a trailing fade, or let the next pill peek, so the scroll is discoverable.
     - Arrow-key focus scrolls the focused tab into view natively.
   - Keyboard: the existing automatic activation is fine, because filtering is instant and cheap.

3. **Search**
   - Markup:
     - A `<label>` with visible or sr-only text ("Search items or library key"); a placeholder alone is not a label.
     - Input attributes: `type="search"`, `autoComplete="off"`, a `name`.
     - `role="search"` on the wrapper (a `<search>`, or `<form role="search" onSubmit={preventDefault}>`).
   - The magnifier is decorative: use `Icon` with `aria-hidden`.
   - The field is at least `min-h-control` (44 px) tall. The mockup field looks about 40 px.
   - Reuse the shared field styles if a kit input exists. The editor's Appearance panel has a search input, so match it. The focus ring uses `--field-focus`.
   - Layout: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. At 390 px the search is `w-full` under the tabs; on desktop it is `sm:w-72` with `shrink-0`.
   - Use a controlled input without debounce. The filter is a pure local map over a few dozen items at most.
   - Announce the result count in one polite `role="status"` region:
     - The footer "Showing N of M items" can be that region (`aria-live="polite"`), updated with the filtered count.
     - The empty-result message can sit in the same region, or be a separate `<p>` inside the tabpanel.
     - Avoid two live regions announcing the same change.
   - Optional: a small "Clear search" button in the empty state.
   - Some browsers clear a `type="search"` input on Escape. Do not override that.

4. **Card (AC 3)**
   - **List and controls**
     - Each card is an `<li>` in a `<ul role="list">`; the card itself is an `<article>` or a plain `div`. Tailwind resets list style, and Safari/VoiceOver then drops the list role unless `role="list"` is explicit.
     - Do not wrap the whole card in a button (the earlier consult's alternative). The ticket wants the pencil to open the editor, so the pencil is the only control, and the preview must not add a second tab stop.
   - **Grid**
     - `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
     - The mockup has 4 columns at 1280 px, and `page-library` should give about 340 px per card. Check `--width-library` against the mockup.
     - If `page-library` is narrower than 1280 px minus the sidebar, 4 columns may be too tight at `xl`. Verify at 1280 px and 1440 px.
   - **Card shell:** `Card`, or `rounded-md3-lg border border-outline-variant bg-surface overflow-hidden min-w-0`.
   - **Preview area**
     - Give it a fixed height (`h-36` on mobile, `sm:h-40`, or an aspect ratio) so rows align, with a `bg-surface-container` base and the tile grid on top.
     - Tile grid:
       - Draw it with `repeating-linear-gradient` or `linear-gradient` using `var(--grid-line)` at 32 px.
       - Define it once in `globals.css` as `@utility tile-grid`. This is a small CSS addition, not an API change.
       - Confirm `--grid-line` has enough contrast in both themes. It is deliberately faint, which is right for a background.
     - Sprite:
       - Centre it with `object-contain max-h-full max-w-full`.
       - The thumb helpers produce a 32 px box, so pass a larger `box` (about 96) to `FramePreview`.
       - Use `image-rendering: pixelated` on custom images.
       - Large items (4 tiles) must scale down to fit, not clip.
     - When there is neither a custom image nor an atlas frame, use the library-frame fallback the ticket names. While the atlas is still loading, show a quiet placeholder of the same size, so the layout does not jump.
   - **`w × h` badge**
     - Top-left: `font-mono text-xs`, `rounded-md3-sm bg-surface/90 border border-outline-variant px-1.5`.
     - Some screen readers read plain "2 × 1" as "2 times 1". Give it `aria-label="2 by 1 tiles"`, or put the visible text in a `<span>` with an sr-only expansion.
   - **Pencil**
     - `absolute bottom-2 right-2`: a real `<button type="button">` with `aria-label={editLabel(name)}`, and `min-h-control min-w-control` (44 px) for the target.
     - The mockup's round 28 px pencil can stay visually smaller if the hit area is a transparent 44 px box: a `size-11` button with an inner `size-8` circle.
     - Keep a visible focus ring (`focus-visible:ring-2`) that `overflow-hidden` does not clip. Use an inset ring or a negative outline offset.
   - **Body**
     - Name: `font-bold text-sm truncate`, with a `title`.
     - Key: `font-mono text-xs text-on-surface-variant truncate`. `break-all` may suit long keys better.
     - Put `min-w-0` on every flex child.
   - **Footer row**
     - `flex flex-wrap items-center gap-x-2 gap-y-1`, holding the soft group chip (`rounded-md3-sm`), the plain text "Fixed size", and the art source with `ml-auto`.
     - At 390 px these wrap without overflow thanks to `flex-wrap`.
   - **"Hidden" mark**
     - A visible text pill ("Hidden", `border-outline` or the warning tone), not colour alone.
     - Dim the preview only slightly: `opacity-60` on the sprite, not on the text, so contrast holds.
     - Place it next to the name or at the top-right of the preview, so it does not collide with the pencil.
     - In DOM order it comes after the name, so screen readers hear "Single desk, Hidden".
   - **Card name and headings**
     - The visible name is the card's heading. Use `<h3>` (below the page `<h1>`) or a `<p>`.
     - Once the group sections go away, the page has no `<h2>`. Either add `<h2 class="sr-only">Items</h2>` above the grid, or make the card name a `<p>`. Do not skip heading levels.
   - **Custom image `alt`**
     - The preview is informational, and the existing alt is `mapItemsCopy.art.thumbAlt(name)`. But the name appears right below it, so a screen reader would hear it twice.
     - Recommendation: `alt=""` / `aria-hidden` on the card preview, and keep the art-source text visible.
   - **Art source** (`artSourceOf`)
     - Precedence stays as the ticket states: custom image, then package sprite, then library sprite.
     - The label must not be colour only. Copy: "Custom image", "Package sprite", "Library sprite".
     - Show "customised" only through the art-source label. Do not add a second badge as the old list did; it crowds the footer.

5. **Counts, filter, empty and footer (AC 2)**
   - `mapItemStats(items)`:
     - Returns `total`, `inPalette` (not hidden) and `customised` (`isCustomised`).
     - "Customised" must match `artSourceOf`: any custom image or package sprite.
     - Test it with a fixture that includes a chair, a hidden item and a fixed-size item.
   - The earlier consult left open whether items that cannot be hidden (chairs) count as in palette. The ticket says "not hidden", so yes.
   - `filterItems(items, group, query)`:
     - Returns a flat list in `catalogGroups` order.
     - "All N" is the total. Each group tab's count is that group's total, independent of the search text.
     - The plan should say this explicitly: counts must not change as you type, or the tab numbers jump around. The footer carries the filtered number.
   - Footer: `<p class="text-xs text-on-surface-variant">` below the grid, with "Showing N of M items" (M is the total) and the fixed sentence "Items are never deleted. Hide an item to remove it from the local palette."
   - Empty result:
     - A `Card` or a centred block inside the tabpanel with a short message ("No items match ..."). Not an alert role.
     - Keep the existing "no items at all" empty state (`list.empty`) separate from "the filter matched nothing".

6. **States**
   - **Loading**
     - Replace the two row skeletons with 4 card-shaped skeletons in the same grid (same preview height), and keep `aria-busy`.
     - Never show "0 map items" while loading. The header can render during loading. The simplest approach is to hide the stats, tabs and search until ready, so nothing shows a false "0".
   - **Error:** keep the existing card and the retry button.
   - **Forbidden:** keep the existing title plus `role="alert"`, and use the new header's h1 there, as in the ready state, so the page title stays consistent.
   - **Not-ready:** unchanged; do not touch it.

7. **Responsive at 390 px (AC 1)**
   - `page-library` already gives the page padding.
     - Confirm it uses `px-4` at small widths, and that the slice 4 app shell does not add a second horizontal scroll.
     - Check `min-w-0` on every flex or grid parent of the tab row. An `overflow-x-auto` child inside a flex item without `min-w-0` widens the page.
   - Expected layout at 390 px:
     - the stats card wraps;
     - the tabs scroll inside their own container;
     - the search is full width;
     - the grid has one column;
     - the card footer wraps;
     - long names truncate.
   - Fixture for the manual check: a 60-character name, the longest group name (40 characters), and a 40-character key.
   - A render test can only check class names. The plan should say this honestly:
     - Assert that `grid-cols-1`, `min-w-0` and `overflow-x-auto` are present.
     - Do the real no-sideways-scroll check by hand at 390 px and 1280 px, in both themes.

8. **Accessibility summary**
   - **Tabs:** `TabBar` ARIA with one shared panel.
   - **Search:** a label and `role="search"`.
   - **Cards:** a list with one control each. The pencil is 44 px, and its name includes the item.
   - **Result count:** one polite live region.
   - **Headings:** h1, then an sr-only h2 if the cards use h3.
   - **Hidden and fixed-size:** shown as text, not colour.
   - **Focus rings:** visible on the pills (the existing `state-layer`), the search field and the pencil.
   - **Contrast:** mono text at 11–12 px must reach 4.5:1 on `bg-surface-container` and on the tile grid in dark mode.
   - **Focus after the editor closes:**
     - The editor restores focus to its opener, and the cards are keyed by `builtinKey`.
     - Check that a list reload while the editor is open does not unmount the pencil that opened it. That needs a stable key and no remount on filter-state changes.

9. **Structure**
   - New `MapItemCard.tsx` with props `item`, `thumbUrl`, `atlas`, `onEdit`.
   - Optional `MapItemsStats.tsx` and `MapItemsControls.tsx`, to keep `MapItemsView.tsx` under about 150 lines.
   - Pure helpers in `map-items-state.ts`, as the ticket says.
   - Strings go in `src/ui/copy/mapItems.ts` (D36):
     - groups: `header`, `stats`, `tabs`, `search`, `card`, `footer`;
     - functions for the counts and the `w × h` labels.
     - Retire `intro` and the `BADGE` class, and remove the old `list.customised` string if nothing uses it any more.
   - Tests:
     - Port the existing `MapItemsView.test.tsx`; the grouped-section assertions go away.
     - Card variants as markup: fixed, hidden, customised, non-directional, custom image, no preview.
     - Tab markup: roles, counts, shared panel id.
     - Search label markup.
     - Filter-state behaviour, tested as pure functions.
   - Interactive tab and search changes in the view need either a small reducer, or a pure `visibleItems(items, group, query)` call in the render. `filterItems` already is that function.

### Risks

- **Green mapping.** On main, `bg-primary` is ink, not green. Using it for the active pill would make the page differ from the mockup and from SIM-071's intended look. Pick `primary-container`, or confirm from `tokens.css` and the other redesigned pages (the portal `PortalTabs`, `SeatCard`).
- **`TabBar` is shared.** The `pill` variant must not change the underline default, and the existing `TabBar` tests and every current caller must pass unchanged. Keep the variant prop-driven, with no copy.
- **Tab semantics with one panel.** Easy to get wrong, because `aria-controls` must resolve. Test it.
- **Contrast.** Mono text at 11–12 px, the soft chip on a surface, and the muted text over the tile grid are all borderline. Check both themes.
- **Layout width.** The mockup is a 1280 px canvas with a 216 px sidebar, leaving about 1060 px of content. Four columns fit at about 250 px each, as in the mockup, but `--width-library` may give fewer than 4 columns at 1280 px. Verify against the real width.
- **Large sprites.** Items up to 4×4 tiles, with overhang, can overflow the preview box. Scale them to fit.
- **Collision with SIM-071.** Slices 3 and 4 (the kit and the shell) are already merged, so the rebase risk is low. Slices 5 to 7 may touch the same files.
- **Focus loss.** Selecting a group tab re-renders the grid, so the card that opened the editor can unmount if it is filtered out. That is not a bug, because the editor owns focus restore. But the plan should say what receives focus when the opener card is gone: the search field or the tab.
- **False zeros while loading.** See the loading state in recommendation 6.

### Open questions

1. Should the group tab counts stay fixed while searching (recommended), or follow the search?
2. Does the active pill use `primary-container` (the workspace action colour)? Confirm against `tokens.css` and the portal tabs.
3. Do chairs and other items without a hidden flag count as "in palette"? The ticket's "not hidden" says yes.
4. Should the tile-grid background be a new global `@utility tile-grid` in `globals.css`, or a local class in the card? Recommend the global utility, because the mockup's editor preview uses the same background.
5. Card preview: `alt=""` (the name is adjacent text) or keep `thumbAlt`? Recommend `alt=""`.
6. Stats while loading: hide the stats, tabs and search until ready (recommended), or show skeletons?
7. Should the `pill` TabBar variant carry the count in the existing `chip` field or a new `count` field? A new `count` is cleaner, because the `Pill` tone does not suit a pill inside a pill.

Files: `src/ui/mapItems/MapItemsView.tsx`, `src/ui/TabBar.tsx`, `src/app/globals.css`, `work/tickets/SIM-070/mockup-map-items-list.webp`, `work/tickets/SIM-070/consult-ux-architect.md`.
