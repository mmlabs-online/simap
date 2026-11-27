**SIM-070.1 consult (frontend, read-only)**

## Findings
- **State on main.** Branch `ticket/SIM-070.1` is clean.
  - SIM-071 slices 3 (UI kit) and 4 (shell, 216 px sidebar, page containers) are merged. Slices 5-7 are still to come, and SIM-071 is IN_PROGRESS.
  - `src/styles/tokens.css` already holds the Simap token set: `workspace-primary`/`workspace-action`, `pixel-primary`, `canvas`, `surface`, `cream`, `tile`, `text-primary/secondary`, `border`, `border-strong`, `divider`, `radius-*`, `text-caption/label/body/subtitle/title/display`, `size-control-min` (44 px) and `shadow-card`.
  - `globals.css` still carries the legacy aliases (`on-surface`, `on-surface-variant`, `outline-variant`, `text-h2`, `page-library`), so old class names still resolve.
- **`src/ui/TabBar.tsx`.**
  - It already uses the new tokens: `border-divider`, `min-h-control`, `text-label`, `state-layer`, accent underline.
  - It has no `variant` prop. Its props today are `tabs`, `active`, `onSelect`, `ariaLabel`, `tabIdOf` and `panelIdOf`.
  - Its only other consumer is `src/ui/portal/PortalTabs.tsx`.
  - Tab ids need `tabIdOf`/`panelIdOf`, so the card grid needs `role="tabpanel"` with a matching id and `aria-labelledby`.
- **`src/ui/mapItems/MapItemsView.tsx`.**
  - It is still the pre-restyle list, with legacy classes: `text-h2`, `text-on-surface`, `BADGE` with `border-outline-variant`, and `page-library`.
  - Its props are `access`, `items`, `onEdit`, `thumbUrl`, `atlas` and `onRetry`.
  - It already has loading, error, empty and forbidden states, and an Edit button per row. It has no search or tabs.
- **`map-items-state.ts`** has `catalogGroups` (name order, groups sorted) and `isLibraryDefault`. `mapItemStats`, `filterItems` and `artSourceOf` do not exist yet.
- **`map-item-art.ts`** already exports everything needed: `artDirs`, `isCustomised`, `thumbDir`, `panelFrameKey(item, dir)`, `thumbSprite`, `libraryFrameKey` and `artPanelView`. Build `artSourceOf` on `artDirs` and on `item.art[d].hasImage` / `.sprite`, the same way `isLibraryDefault` does.
- **Defaults already fixed by the SIM-070 plan (Assumptions 9):**
  - "In palette" means `!hidden`, and chairs count.
  - For mixed-direction art, the source priority is image > package sprite > library, over the allowed directions.
  - If the selected tab vanishes, the view falls back to "All".
- **Test setup (SIM-070 Assumption 11).** There is no `@testing-library`, so view tests use static markup. `useState` is not available in a pure static-markup test, so either keep the group and query state in the parent, or export a pure `MapItemsList` that takes `group` and `query` as props.

## Recommendations
1. **Order of work.** Run this ticket now, before the remaining SIM-071 slices, and rebase on main right before starting.
   - The two tickets overlap only in `MapItemsView.tsx`, `MapItemCard.tsx` (new), `TabBar.tsx` and `copy/mapItems.ts`.
   - The likely conflicts are in `TabBar` and `MapItemsView`.
2. **Write the new markup directly on the Simap tokens** (AC 1, R4).
   - Use these:
     - surfaces and text: `bg-surface`, `border-border`, `text-text-primary/secondary`;
     - type: `text-title`/`text-display`, `text-label`, `text-caption`;
     - shape: `rounded-xl`, `shadow-card`;
     - `bg-tile` for the tile-grid preview;
     - `workspace-primary` for the pencil and accent, non-text only;
     - `min-h-control` / `size-control-min` for the 44 px pencil.
   - Do not use `on-surface`, `outline-variant` or `text-h2` in new code. Then SIM-071 slices 5-7 have nothing to redo on this page except the container.
   - `page-library` may already be handled by slice 4 if it renamed it. Check that `page-library` still exists in `globals.css` (line 239).
   - Use the existing kit components from slice 3 (`Card`, `Button`, `Pill`/`Chip`) instead of hand-rolled `BADGE` spans where they fit.
3. **`TabBar`.** Add one optional `variant?: "underline" | "pill"` with default "underline".
   - With the default, the markup is unchanged, so the `PortalTabs` and `kit.test.tsx` snapshots do not change. Keep the diff purely additive.
   - Pill style:
     - wrapper: `gap-2 overflow-x-auto`, without the bottom border;
     - selected: `bg-workspace-action text-on-action`;
     - unselected: `bg-surface border border-border-strong text-text-secondary`.
   - Keep `min-h-control`, `rounded-full`, the roving tabIndex and the keys unchanged.
   - At 390 px the wrapper must scroll inside its own box, not the page.
   - Add a test for both variants.
   - If SIM-071 has a TabBar change in flight, ask that it keeps the prop signature.
4. **State helpers** (AC 2, AC 4).
   - `mapItemStats` returns `{ total, inPalette, customised }`.
   - `filterItems(items, group | null, query)` applies `trim().toLowerCase()` to the name and `builtinKey`, and returns a flat list in `catalogGroups` order. Flatten that function so the order is reused.
   - `artSourceOf` returns a union such as `"image" | "sprite" | "library"`, mapped to copy in `copy/mapItems.ts`.
   - "Showing N of M" comes from the filtered and total lengths. "All N" uses the total, not the filtered count.
   - Derive the effective group at render time, with no effect: `groups.includes(group) ? group : "All"`.
5. **`MapItemCard`.**
   - Preview, in this order:
     1. `thumbUrl(item)`: the custom image, as an `img` with `imageRendering: pixelated`;
     2. otherwise `FramePreview` with `thumbSprite(item)`;
     3. otherwise the library frame from `panelFrameKey(item, "s")`.
   - Draw the preview on a tile-grid background through the token gradient.
   - Fixed-size and non-directional items must not crash `panelFrameKey`. Check that it returns null, and show an empty tile in that case.
   - The pencil button keeps `aria-label={mapItemsCopy.editLabel(item.name)}` and calls `onEdit`. Existing tests rely on that label, so keep the `MapItemsView.test.tsx` expectations.
   - Hidden items show a "Hidden" pill plus reduced emphasis. Do not rely on opacity alone, so contrast holds.
6. **Responsive** (AC 1).
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
   - The stats card uses `flex flex-wrap`.
   - Put `min-w-0` and `truncate` on the name and key, so long keys do not push the page sideways.
   - No fixed widths over 390 px.
   - Use the breakpoints defined in the tokens: `breakpoint-md` 800, lg 1024, xl 1280. Tailwind's `sm` default is 640 unless overridden, which is fine for one-to-two columns.
7. **Copy** goes in `src/ui/copy/mapItems.ts` (D36), not hard-coded in JSX.
   - Strings: eyebrow, subtitle, stats labels and note, the "All" tab, search label and placeholder, footer, empty result, art-source labels, "Fixed size".
   - The subtitle replaces `intro`. Grep to check nothing else references `intro`.
8. **Search.** A `<label>` (visible or `sr-only`) plus a `type="search"` input. Put `aria-live="polite"` on the "Showing N of M" line so filtering is announced.
9. **Tests.**
   - Stats: a fixture with hidden, customised and fixed items.
   - Filter: case, trim, name and key, group and query combined, vanished group.
   - `artSourceOf`: image > sprite > library, mixed directions, a non-directional item with one allowed direction.
   - Card variants, as static markup.
   - Tab markup: `role="tablist"`, `aria-selected`, pill classes.
   - Layout classes: `grid-cols-1` and `flex-wrap`.
   - Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` and `pnpm test`.

## Risks
- **`TabBar` conflict with SIM-071.** Mitigated by the additive prop and by rebasing first.
- **`MapItemsView.test.tsx` needs a rewrite, not a patch.** It asserts the old per-group row markup (an h2 per group, an Edit text button). Plan for this in the diff size: the ticket is M, likely 400+ lines.
- **Unclear "not-ready" state.** `ListState` has `loading`/`error`/`ready`, and `MapItemsView` only adds `forbidden`, so the "not-ready" state in the ticket scope is not obviously there. Confirm what it refers to before coding; it is likely the editor or the atlas not being loaded. A null atlas must fall back gracefully in the card.
- **Tab panel ids.** The `aria-controls`/`tabpanel` ids must exist even when "All" is selected, or the a11y reviewer will flag them.
- **Contrast.** `workspace-primary` (#ed5b35) is 3.4:1 under white text. Do not use it for text or as a background under white text; use `workspace-action` for the filled pill.
- **Dark mode.** Use tokens only. The tile-grid gradient must use `--color-divider`/`--color-tile`, not hex.

## Open questions
- What exactly is the "not-ready" state in scope (see the risk above)?
- Should the search and the selected tab survive a reload or live in the URL? Assumed no: local state only.
- Do SIM-071 slices 5-7 plan to touch `MapItemsView.tsx` only for container classes, or a full restyle? If a full restyle is planned, ask Ming to drop this page from that slice so this ticket owns it.
- This consult did not check the mockup (`work/tickets/SIM-070/mockup-map-items-list.webp`) visually. The planner or implementer should compare card spacing against it.
