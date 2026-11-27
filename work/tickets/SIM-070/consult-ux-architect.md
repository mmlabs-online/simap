# SIM-070 consult: Map items redesign and Item editor (UX/architecture, read-only)

Checked: the ticket, all three mockups, LAY-07 and D52/D66/D67, and the current `src/ui/mapItems/**` (View, Page, Form/Art/Reset dialogs, SpriteBrowser, state/form/image helpers). Also checked the shared kit (`TabBar`, `EntityFormDialog`, `Card`, `Chip`/`Pill`) and `globals.css` tokens, and the portal pattern (`PortalTabs`, `SeatCard`). I did not open the SIM-066/069 tickets themselves.

## Findings

**Current state**
- The page has no stats, tabs or search. `MapItemsView` is a list grouped by `catalogGroups` (sorted by name, D67), with one `Card` row per item and separate Art and Edit buttons.
- `MapItemsPage` holds a `Dialog` union (`edit`, `reset`, `art`) and mounts three components:
  - `MapItemFormDialog` wraps `EntityFormDialog` (440 px wide) and has `patchFrom` and `resizeEffects` with a `confirmResize` checkbox.
  - `MapItemArtDialog` is its own native `<dialog>` (760 px wide) where every art action calls the API at once, reloads the list and shows a per-direction status or alert.
  - `ResetMapItemDialog` is a third dialog, a confirm over `api.reset`.
- Art is saved immediately today, one request per action. The Appearance tab must change this to staged edits, which is the main design change.
- Pure helpers are reusable: `artDirs`, `artPanelView`, `expectedImageSize`, `spriteChoices`, `panelFrameKey`, `thumbSprite`, `thumbDir`, `isCustomised`, `isLibraryDefault`, `settleMapItem`, `artErrorMessage` and `artOutcome`.
- `checkMapItemImage` validates the PNG against the item's saved `w`/`h`. With a pending resize this must use the pending size, or it will accept or reject the wrong images.
- The API returns `rooms` on a refusal, and `mapItemErrorMessage("item_in_use", rooms)` already formats it.
- `isCustomised` exists. Its definition has to match the ticket's "any direction with a package sprite or custom image". I only saw its export line, not its body, so the planner should check it.

**Mockups**
- **List page**
  - Eyebrow in mono uppercase tracking ("BUILD YOUR LITTLE WORLD"), then a large title with an accent dot, then a subtitle.
  - A single bordered white stats card: three "big number + label" items on the left, and an icon + note on the right.
  - A pill tab row where the active tab is solid dark green with a small count, plus a search field with a magnifier on the right.
  - A 4-column card grid. Each card has a tile-grid preview area (about 55% of the card height) with a mono `w × h` badge at top-left and a round pencil button at bottom-right. Below that: bold name, mono key, then a footer row with a soft green group chip, plain "Fixed size" text and the right-aligned art source.
  - A footnote under the grid.
  - Not in scope per the ticket: the app shell, the "Local library" badge and "Production".
- **Editor popup**
  - About 580 px wide, rounded-xl, with a mono "ITEM EDITOR" eyebrow, "Edit <name>", the mono key and a square outline close button.
  - Underline tabs (Appearance, Details) with a green underline on the active tab, and a footer separated by a rule.
  - Appearance:
    - A "Directional artwork" label with "Never auto-rotated" on the right.
    - A 4-up segmented button row with the active one tinted green.
    - A wide preview on the tile-grid background, with a "Library sprite" tag at top-right and a mono "NORTH · 2× PREVIEW" caption at bottom-left.
    - A two-segment toggle, Sprite library / Upload image, with a white raised active segment.
    - A subsection title ("Office essentials"), an "All types" checkbox, a search input, and sprite tiles with names (the active one is tinted).
    - A rule, then "Only updates the north view." with a "Restore default" text button.
  - Details: stacked fields; width and height in two native selects; a muted fixed-footprint hint; a "Show in item palette" tile with a checkbox and a hint; a muted info strip (the "6 placed copies" line is out of scope, but "Library key stays unchanged." is useful); and a full-width outlined "Reset item to library defaults".
  - Footer: "No unsaved changes" at the left, then outlined Cancel and a solid green Save with a check icon.
  - In the mockup the fixed-size item still shows a 2/1 select pair with the hint beneath, so the selects appear disabled (not visibly greyed). Render them disabled with the hint.

**Tokens**
- Use the existing tokens: `bg-surface`, `bg-surface-container` and `bg-surface-high`, `border-outline-variant`, `text-on-surface` and `text-on-surface-variant`, `text-primary`, `bg-primary-container`, `rounded-md3` (12), `rounded-md3-lg` (16) and `rounded-md3-xl` (20), `shadow-[0_12px_40px_var(--shadow)]`, `text-h2`, and `Card`, `Pill`, `Chip`, `Button`, `Icon` (the portal `SeatCard` uses these).
- The mockup's solid dark green maps to `bg-primary`/`text-on-primary`, and the soft green chip to `bg-primary-container`/`on-primary-container` or `Pill`. Check the exact values against both themes; don't hardcode hex.
- The tile-grid background has no token. I found no tile-grid or `px-*` background utility. Add one small local class or inline `background-image` using `--outline-variant`, so it works in dark mode. The `px-floor`/`px-outline` colours exist as tokens and are a candidate.
- Mono uppercase eyebrow: reuse the `CAPTION` pattern already in `MapItemFormDialog` (11px, extrabold, tracked uppercase). Add `font-mono` if needed. Check how other redesigned pages do their eyebrow so they stay consistent.
- Tabs: `TabBar` is the shared, ARIA-correct component (roving tabindex, arrow keys, `tabIdOf`/`panelIdOf`). Use it for the group tabs (pills, one panel region) and, if its styling allows, for the editor tabs. If its underline/pill look doesn't match, add a `variant` prop to `TabBar` rather than forking it.

**Dialog shell**
- `EntityFormDialog` is 440 px, has a fixed submit/cancel footer and is not tabbed. The editor needs its own shell. The Art dialog's `<dialog>` pattern is the better base: showModal, `aria-labelledby`, `onCancel`→close handler, scrim-press-to-close, focus restored to the opener, `max-h-[85vh]` column with a scrolling middle.
- Extract a small shared `ModalShell` or reuse the Art dialog's wrapper inside `MapItemEditor.tsx`. Do not edit `EntityFormDialog` for this.

## Recommendations

1. **List layout (AC1–3)**
   - New state in `MapItemsView`: `group` ("all" or a group name), `query`.
   - Pure helper `filterItems(items, group, query)` in `map-items-state.ts`, plus `catalogStats(items)` returning `{total, inPalette, customised}`. Both are unit-testable.
   - Group tabs come from `catalogGroups`, which keeps the D67 alphabetical order. "All" first, count in a small badge.
   - Search is case-insensitive over name and `builtinKey`, trimmed.
   - Render a flat grid of the filtered items (sorted by `catalogGroups` order), not per-group sections.
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`, with `min-w-0` on cards.
   - The footer reads "Showing N of M" with the filtered and total counts.
   - Empty result: a short message plus, nice to have, a "Clear" button.
   - If the selected group disappears after a reload, fall back to "all".
   - Keep the loading, error, empty and forbidden states.
   - The pencil is the only edit control. Give it `aria-label={editLabel(name)}` and make it at least 44 px (it is about 28 px in the mockup).
   - Consider making the whole card a button. Keep it one control, or the preview and pencil become two tab stops.

2. **Card content**
   - Preview: reuse `thumbUrl`/`thumbSprite` plus `FramePreview`, with a scaling box. Large sprites (up to 4×4 tiles plus overhang) must fit the area, so use `object-contain` with a `max-w`/`max-h`. `FramePreview` takes `box` for this.
   - Art source label: "Library sprite", "Package sprite" or "Custom image". Define precedence for mixed directions (any custom image → "Custom image", else any package sprite → "Package sprite", else "Library sprite"), and use the same rule as the stats' customised count.
   - "Hidden" mark: a `Pill` or a badge next to the name, and not colour only. Optionally dim the preview a little.
   - `desk.single` and chairs may omit the palette flag. For chairs `patchFrom` already skips `hidden`, so the Details checkbox should hide and show the `chairNote` hint instead.

3. **Editor state model (AC4–5)**
   - A single draft in `MapItemEditor`:
     - `form: MapItemForm` (existing)
     - `art: Partial<Record<Direction, PendingArt>>`, where `PendingArt` is `{kind:"sprite", key}`, `{kind:"library"}` or `{kind:"image", bytes, previewUrl}` (create the object URL in an effect and revoke it on removal or unmount)
   - "Unsaved changes" = `patchFrom(...).kind` is not `"unchanged"` **or** `art` has any entry. Don't treat `needsConfirm` as "no changes". It counts as changed.
   - Status text lives in `role="status"` (polite): "No unsaved changes" / "Unsaved changes" (add a count if cheap).
   - Move the staged-sprite flow into the tab itself. Picking a tile in the browser stages immediately, since the "Use sprite" button is gone in the mockup. Restore default stages `{library}`. Switch to Upload stages `{image}` after the client check passes.
   - Restore default is disabled when the direction already shows the library sprite and nothing is pending. If an image is staged, it undoes the staging first.
   - Per direction, show a small "changed" dot on the N/E/S/W buttons when that direction has a pending change, and a dot on the Appearance and Details tab labels. This lets users on the other tab see what changed, and it supports the unsaved-changes confirm.
   - "Only updates the <direction> view" for directional items. For non-directional items show a single image label ("Same image in every direction"), as today's `sameForAll`.
   - Keep tab content mounted while switching, so staged state, file inputs and the sprite search survive. Hide the inactive panel with `hidden`.

4. **Save flow**
   - Order:
     1. `api.patch` (details) when there is a patch.
     2. Art calls per direction, in N, E, S, W order. Each is `putArt` (sprite or `null` for library), `putImage`, or `deleteImage`.
   - Why details first: a size change removes custom images (OQ-52) and may drop sprites that no longer fit. Art for the new size must therefore be applied after.
   - **Pending resize while art is staged:**
     - Image uploads must be checked against the pending `w`/`h`.
     - Sprite choices must come from `spriteChoices` for the pending size (it currently takes `item`, so pass `{...item, w, h}`).
     - Existing custom images show a "will be removed on save" note. Add this to the preview tag.
     - If the draft staged "Restore default" or "Remove" on an image that the resize will delete, treat that as redundant and skip the call (else it returns `not_found` or a no-op).
   - **Partial failure (the part the ticket leaves open):**
     - Stop on the first error, since the order matters and later calls may depend on it.
     - After each success, mark that piece as saved: drop it from the draft and update the baseline. Simplest way: reload the list (`items.reload()`) and rebase the form and draft on the fresh `item`.
     - This needs `onReload` to return the fresh item or the editor to take the item by key from the list. The Art dialog already does the latter through `findArtItem`. Do the same.
     - The status then reads "Unsaved changes" with only the failed piece left. Show the error in a persistent `role="alert"` banner above the footer, inside the popup, naming the failed step ("Size not changed: this item is placed in 3 rooms."), and **also** switch to the tab that owns it (or highlight the direction).
     - The success case: every call ok → reload → close the popup, or stay open with "No unsaved changes" and a short "Saved" status. Choose one. The AC says the status reads "No unsaved changes" after a full save, which suggests staying open. Ming's mockup footer implies stay-open, with Cancel as "Close". Recommend stay-open with a polite "Saved." and rename Cancel to "Close" when there are no changes (still the same button).
     - `not_found` on any call means the item is gone. `settleMapItem` and `artOutcome` already treat it as done or "gone", so close and reload.
     - `image_changed` (artOutcome "reload"): reload and keep the draft entry. Show its message.
   - Disable the footer buttons, the tabs and the close button while saving (`busy`, `aria-busy`), but keep the dialog focusable and keep focus on Save.
   - A concurrent reload in the page (`items.reload`) must not reset the draft. Key the draft on `builtinKey` only, not on the item object (the old code used `key={item.builtinKey}` for this).

5. **Size-change warnings and refusals inside the popup**
   - Warning (Details tab): keep `resizeEffects` text and the `confirmResize` checkbox, in a `role="note"` warning block (`bg-warning-container`/`on-warning-container`, not just red text) directly under the size selects. Make the checkbox label specific ("Remove N custom images and M sprites that no longer fit").
   - Save with an unconfirmed resize: do not call the API. Block with the same message and focus the checkbox. Switch to Details if the user is on Appearance. Don't silently save without the size change.
   - Refusals (item_in_use with room count, name clash, 422 image rules): one `role="alert"` region in the body above the footer, always visible whichever tab is active. Map the field errors to inline errors too: name and group errors under their inputs with `aria-invalid` and `aria-describedby`, and image rules under the preview of the failing direction. Switch to the relevant tab and move focus to the offending control, or at least to the alert.
   - Client image check errors: same per-direction message (`artErrorMessage`), shown immediately on file choose, without staging.
   - Reset (Details): do not open a nested `<dialog>`. Show the reset confirm inline in the Details panel (`ResetMapItemBody` text with "Reset" and "Keep editing" buttons), replacing the reset button. After a confirm it calls `api.reset` immediately (it is a separate destructive action, not part of Save). If there are pending edits, warn that they will be discarded, then rebase the draft. Disable reset while saving. `isLibraryDefault` still disables it when nothing would change.
   - Chairs: `desk.single`/`chair.office` keep today's rules (size fixed, hidden control hidden for chairs).

6. **Unsaved-changes UX**
   - Cancel, the X, Esc and scrim press all go through one `requestClose()`. With no changes it closes at once. With changes it shows an inline confirm bar in the footer ("Discard changes?" + "Keep editing" / "Discard"), with focus on "Keep editing". Inline avoids a second modal stacked on a modal and keeps focus management simple.
   - Scrim press-to-close is risky with edits. Either ignore it when dirty or route it through the confirm. Esc with the confirm already open should dismiss the confirm, not close the editor.
   - `onCancel` must `preventDefault` and call `requestClose()` (the Art dialog already does).
   - Consider `beforeunload` while dirty. Optional.
   - Save is enabled whenever the draft is dirty. When clean, disable it (or keep it enabled but a no-op that closes, as the old form did with `unchanged`; disabling is clearer).

7. **Responsive at 390 px**
   - Page padding `p-4`. Header stacks. The stats card wraps: the three numbers in a `flex flex-wrap gap-x-6 gap-y-2` and the note on its own row below (do not hide it). The tabs row scrolls horizontally inside its own container (`overflow-x-auto`, `shrink-0` tabs, with `min-w-0` on the parents). Verify this does not scroll the page. The search goes full width below the tabs.
   - Grid: one column. The card preview height should be fixed (e.g. `h-36`) so cards align.
   - Long names and keys: `truncate` or `break-words` with `min-w-0`. The footer chips wrap.
   - Editor: `w-[calc(100%-1.5rem)] max-w-[580px]`, `max-h-[92dvh]` (use `dvh`, not `vh`, so mobile browser bars don't cut off the footer), a scrolling middle and a sticky footer. At 390 px the footer needs `flex-wrap`: status on its own line, then Cancel and Save at the right, or both stretched. Direction buttons stay 4-up (grid-cols-4 at about 80 px each is OK). The sprite tiles use `grid-cols-2 sm:grid-cols-3`. The preview is the full width with `overflow-hidden`. Width/height selects stay two columns (about 160 px each is fine). All tap targets at least 44 px.
   - Test fixtures: a long name (60 chars) and the longest group name (40 chars).

8. **Accessibility**
   - Dialog: native `<dialog>` with showModal gives the focus trap and inert background. Keep `aria-labelledby` pointing at the "Edit <name>" heading, and add `aria-describedby` for the key line. Initial focus: the first tab (or the selected tab), not the close button. Restore focus to the opener card's pencil on close. After a reload the card may re-render, so key cards by `builtinKey` (stable) and store the opener key to re-focus by `data-` attribute or ref map if the node changes.
   - `showModal` must run once on mount, and the dialog must be unmounted or closed on exit (the existing pattern).
   - Editor tabs: `role="tablist"` with `aria-label`, `role="tab"` with `aria-selected`, `aria-controls`, roving `tabIndex`, Left/Right/Home/End, `role="tabpanel"` with `aria-labelledby`, `tabIndex={0}` on the panel. Use the shared `TabBar` (it has this) rather than a new copy. The direction buttons (N/E/S/W) are a radiogroup or a second tablist. A `role="radiogroup"` with `aria-checked` buttons and arrow-key roving is the simplest honest model, since they select a "which view am I editing" value and the preview updates. The Sprite library / Upload image switch is the same pattern.
   - Sprite tiles: the existing `role="radiogroup"` with native radios keeps keyboard support. Style the `label` as a tile and keep the native radio visually hidden but focusable (`sr-only` plus `peer-focus-visible` ring), so the focus ring shows on the tile. Each tile's accessible name is the sprite name, and `frameAlt` on the image should be empty or the same name, not duplicated.
   - Preview: `role="img"` with an alt of the direction + source + scale, as today's `frameAlt`. The "NORTH · 2× PREVIEW" caption is decorative text, so mark it `aria-hidden` if the image alt already says it.
   - Live regions: one polite `role="status"` for the dirty/saved state (don't also announce on every keystroke: update it when the boolean flips), one `role="alert"` for errors. Don't use the status area for both.
   - Visible focus rings on every control, `Icon`-only buttons need `aria-label` (close X, pencil). The "changed" dot needs a text alternative (`sr-only` "changed").
   - Don't rely on colour for the active direction, hidden state or tile selection: use a `aria-checked`/`aria-selected` state plus a check icon or border weight.
   - Contrast: the muted mono hints at 11px (`NORTH · 2× PREVIEW`, "Never auto-rotated") must hit 4.5:1 against the tile-grid background in both themes. Check this in dark mode.
   - `prefers-reduced-motion`: the `popin` animation should respect it (check the existing rule).

9. **The 1×/2× preview (ticket question)**
   - LAY-07 (spec) says each direction is "previewed at 1× and 2×". The spec wins if the ticket conflicts, and it is a spec requirement, so dropping 1× needs Ming's answer. Today's Art dialog shows both.
   - Recommendation: keep the mockup's big 2× preview as the hero **and add a small 1× preview** beside the caption inside the same preview area (e.g. bottom-right, "1×" over a 32 px-per-tile render), as the true on-map size. That satisfies LAY-07 with one cheap extra element and no layout change to the mockup.
   - The card's thumbnail is not a reliable 1×: it is scaled to fit a box, can show a different direction (`thumbDir`), and doesn't show the pending change. So "the card counts as 1×" is the weaker answer.
   - Both previews must render the *staged* art (sprite key from the draft, `previewUrl` for a staged image), not the saved one, or the preview lies before Save.
   - `FramePreview` already takes `scale`. For custom images, `<img>` with `imageRendering: pixelated` and `width: size.w * scale` as in today's code.
   - Ask Ming whether the card-as-1× is acceptable (open question 1). Default to adding the small 1×.

10. **Files and structure**
   - New `MapItemEditor.tsx` (shell, tabs, footer, save orchestration), plus smaller presentational parts to keep it reviewable: `ItemEditorAppearance.tsx` (replaces `MapItemArtBody`) and `ItemEditorDetails.tsx` (replaces `MapItemFormFields`), and `MapItemCard.tsx`, `MapItemsStats.tsx` for the list.
   - Put the save orchestration in a pure, testable function, e.g. `saveItemDraft(api, item, form, art)` in a new `map-item-save.ts` that returns `{ok, steps, failed?}`. Tests: order, stops on first failure, skips redundant art after a resize, `not_found`.
   - Pure helpers for dirty state: `isDirty(item, form, art)`.
   - Delete the three old dialogs and their tests (or port them). Per the AC, no other edit, art or reset dialog may remain. Keep `MapItemFormFields` markup tests if the markup is the same, or port them.
   - Copy: all strings in `src/ui/copy/mapItems.ts` (D36). I could not confirm the existing structure beyond `list`, `form`, `art`, `reset`, `errors`, `fieldErrors`. Add `header`, `stats`, `tabs`, `search`, `card`, `editor` and `footer` groups with function entries for counts.
   - R1: UI only imports `@/lib` and `src/ui`. Reuse `@/lib/map-items/art` (as `SpriteBrowser` does).
   - No API, schema or rule change (R4). No new dependency.

11. **Tests (R5)**
   - Pure: `catalogStats` (fixture with hidden, customised and fixed-size items), `filterItems` (group, name, key, case, empty), source label precedence, `isDirty`, `saveItemDraft` (order, stop on failure, resize skip, `not_found`).
   - Render (repo uses Vitest with `renderToStaticMarkup`-style tests, since the dialogs have "props only so the markup can be tested without effects"): header, stats, tab list (roles, counts), card variants (fixed size, hidden, customised, non-directional), editor tabs and ARIA wiring, details (fixed size disabled with hint, resize warning), footer status text, the refusal banner with the room count, the discard confirm bar.
   - The existing tests of the old dialogs (`MapItemArtDialog.test.tsx`, `MapItemFormDialog.test.tsx`, `ResetMapItemDialog.test.tsx`, `MapItemsView.test.tsx`) need porting or removal. Since the AC says "change only for markup", keep the logic tests and port the markup assertions.
   - Interactive behaviours (focus, keyboard) are hard in a static-render setup. Either extract state reducers and test them as pure code, or check whether `@testing-library/react` or jsdom is already in the repo. I didn't verify this.

## Risks

- **Staged art is a behaviour change.** Today art saves instantly. Staging adds object URLs (leaks if not revoked), bytes held in memory (64 KB max each, fine) and the pending-size interaction above. This is the biggest source of bugs, so test it well.
- **Partial failure** can leave the server in a half-applied state (details saved, art not). The plan must define the rebase on reload. A stale `item` after a successful PATCH is the likely bug: the draft compares against the old item and shows already-saved changes as unsaved (the AC calls this out).
- **Resize plus images**: PATCH with a size change deletes custom images server-side. If the draft also staged images validated against the old size, they would fail the 422 or be wrong. Validate against the pending size and apply details first. Also, a refused resize (`item_in_use`) leaves the old size, and the staged images (validated against the new size) are now wrong for the old size. After a details failure **do not run art calls**, and re-validate or drop staged images when the size reverts.
- **Dialog on a reload**: the list reloads behind the popup after each partial step. Card re-renders must not unmount the editor (it is rendered in the page, outside the grid).
- **Mockup gaps**: the 1× preview, the 44 px targets and the "changed" indicators are not in the mockups and are added for LAY-07 and accessibility. Mockup contrast at 11px is borderline.
- **Native `<dialog>` and mobile**: `dvh` and the on-screen keyboard (the search field, display name) can cover the footer. Make the middle section scroll and keep the footer in the flex column, not `position: fixed`.
- **Tab styling**: reusing `TabBar` for the pill and underline looks may need a variant. If skipped, a forked tab component would diverge on keyboard behaviour.
- **Scope creep**: "6 placed copies", the "Local library" badge and reorder are out of scope (ticket). Don't add them.

## Open questions

1. **1×/2×:** keep a small 1× preview in the editor (recommended, satisfies LAY-07), or accept the card as the 1× preview and amend LAY-07 wording? The spec wins by default.
2. **After a full successful save:** stay open with "No unsaved changes" (recommended, matches the AC wording) or close? If it stays open, should Cancel become "Close"?
3. **Reset with pending edits:** confirm that discarding the pending edits is acceptable (recommended: warn, then reset, then rebase). Or must the editor refuse reset while dirty?
4. **Size change with a pending resize and staged images:** OK to validate against the pending size and drop staged images that the resize would remove? (Recommended.)
5. **Sprite browser "All types" and the subsection title** ("Office essentials" in the mockup): is this the item's current group of sprites from `spriteChoices` (the sprites that fit this item) with "All types" widening it? I read it that way (today's `spriteChoices` groups); the planner should confirm against `spriteChoices` semantics, since I only saw its export signature.
6. **Customised count and source label for mixed directions** (e.g. north custom image, east package sprite): confirm the precedence above (custom image wins).
7. **Hidden items in the stats:** "N in palette" = not hidden. For chair items (never in the palette, no hidden flag) should they count as in palette? The ticket says "not hidden", so chairs would count. Confirm or exclude non-placeable rows.
8. **Group tab for a group that has only hidden items**, and **group rename in the editor** while a tab for the old group is active: falls back to "All" (recommended). Confirm.
9. **Editor tabs look:** is a `TabBar` variant for underline tabs acceptable, or should the editor use a local underline tab strip?

Relevant files: `/home/user/simap/work/tickets/SIM-070/ticket.md`, `/home/user/simap/src/ui/mapItems/MapItemsView.tsx`, `MapItemsPage.tsx`, `MapItemFormDialog.tsx`, `MapItemArtDialog.tsx`, `ResetMapItemDialog.tsx`, `SpriteBrowser.tsx`, `map-item-form.ts`, `map-items-state.ts`, `map-item-image.ts`, `/home/user/simap/src/ui/TabBar.tsx`, `/home/user/simap/src/ui/EntityFormDialog.tsx`, `/home/user/simap/src/ui/Chip.tsx`, `/home/user/simap/src/ui/portal/PortalTabs.tsx`, `/home/user/simap/src/ui/portal/SeatCard.tsx`, `/home/user/simap/src/app/globals.css`.
