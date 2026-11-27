Status: READY

# Plan — SIM-070: Redesign the Map items page and merge item edit and art into one Item editor

This plan covers **slice 1 of 2** (see `## Split proposal`): the **Item editor** popup that replaces today's edit, art
and reset dialogs, opened from today's list. Slice 2 (SIM-070.1: header, stats, group tabs, search, card grid) is
outlined below for a follow-up ticket. No High path is touched in either slice.

## Scope summary
- `docs/spec-v1.md` LAY-07 (l. 499-502): "Each item shows its library key (read only), name (unique in the org, case-
  and space-insensitive, at most 60 characters), group (at most 40 characters …), **size in tiles, always visible as
  `w × h`**, shown in palette (yes/no) and its art per direction (n/e/s/w for directional items, one image otherwise),
  **previewed at 1× and 2×**."
- LAY-07 (l. 503-504): "The Admin can rename, regroup … hide or show an item, change its size, set its art, and reset an
  item to the library defaults. Items are never deleted."
- LAY-07 Size (l. 507-513): "A size change is refused with 409 `item_in_use` while any room has the item placed (the
  message says how many rooms …). A size change removes the item's custom images, because they no longer fit (the page
  warns first, OQ-52). Fixed sizes: `desk.single` …, `chair.office` and `floor.*` (1 × 1) cannot be resized."
- LAY-07 Art per direction (l. 514-516): "For each direction the Admin picks a sprite from the bundled package browser
  (its frame must fit the item's size for that direction), or uploads a custom image, or leaves the library sprite. …
  one image is never rotated to fill another direction."
- LAY-07 Custom image rules (l. 517-519): PNG only, no APNG, 32 px per tile (+32 px overhang; floors exactly 32 × 32),
  at most 64 KB.
- "Art per item" (l. 434-439): fallback "custom image → chosen package sprite → the library's built-in frame".
- D52: management screens use the clean UI kit. D36: copy in `src/ui/copy/<feature>.ts`. D67 (1): items listed
  alphabetically by name (no reorder control; LAY-07's "reorder" is not built, as today).
- Ticket SIM-070 Scope, "Item editor popup" and "Footer" bullets, and "Today's rules stay" bullet.
- **Spec over mockup:** the mockup shows only a 2× preview; LAY-07 requires 1× and 2×, so the editor shows both (the big
  2× hero plus a small 1× inset). The card thumbnail is not counted as the 1× preview (it is box-fitted, may show
  another direction and never shows staged art).

## Acceptance criteria → verification
Slice 1 covers ticket AC 4, 5 and 6 (editor parts) in full, and the "pencil opens the Item editor" part of AC 3 (in
slice 1 the existing row's Edit button opens it). AC 1, 2 and the card content of AC 3 are slice 2.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Item editor has the header ("Item editor" eyebrow, "Edit <name>", library key, close button) and two tabs, Appearance and Details, as a WAI-ARIA tablist. | `MapItemEditor.test.tsx › shell: eyebrow, h2 "Edit <name>", key line, close button with aria-label, tablist with Appearance selected, both tabpanels rendered (inactive one hidden)` |
| 2 | Appearance: direction choice N/E/S/W (n/s for NS-only items, one panel and no direction choice for non-directional items) with "Never auto-rotated"; 2× and 1× preview of the **staged** art with its source label; Sprite library / Upload image switch; sprite browser with search and "All types"; "Only updates the <direction> view"; "Restore default". | `MapItemEditorAppearance.test.tsx` cases listed under Tests; `SpriteBrowser.test.tsx` cases; `map-item-editor.test.ts › effectiveArt` and `› restore` cases |
| 3 | Details: name, group, width/height 1–4 (disabled with "This item uses a fixed footprint." for fixed-size items), "Show in item palette" (chair note instead for chairs), resize warning + confirm (OQ-52), "Reset item to library defaults" with an inline confirm step. | `MapItemEditorDetails.test.tsx` cases listed under Tests |
| 4 | No other edit, art or reset dialog is left on the page. | `MapItemFormDialog.tsx`, `MapItemArtDialog.tsx`, `ResetMapItemDialog.tsx` (and their tests) deleted; `rg -n "MapItemFormDialog\|MapItemArtDialog\|ResetMapItemDialog\|onArt" src` returns nothing; `MapItemsView.test.tsx › each row has one Edit button (aria-label "Edit map item <name>") and no Art button` |
| 5 | Save changes applies pending changes through today's endpoints in a fixed order (PATCH details first, then art per direction in `artDirs` order); stops at the first failure. | `map-item-editor.test.ts › saveEditor` cases (fake api records calls) |
| 6 | Refusals are shown in the popup: 409 `item_in_use` with room count, `item_name_taken`, 422 image rules (client check and server), `image_changed`; nothing already saved stays shown as unsaved after a partial failure; `not_found` closes the editor. | `map-item-editor.test.ts › saveEditor partial failure / refusal` cases and `› applySaveResult` cases; `MapItemEditor.test.tsx › error banner role=alert with the room-count message` |
| 7 | Footer status reads "No unsaved changes" when clean (including right after a full save) and "Unsaved changes" when dirty; Cancel, close button, Esc and scrim press with unsaved changes ask first (inline "Discard changes?" with Keep editing / Discard). | `map-item-editor.test.ts › isDirty`, `› closeDecision`, `› applySaveResult done → clean`; `MapItemEditor.test.tsx › footer status texts`, `› discard confirm bar` |
| 8 | Today's rules stay: size-change warning (images removed), client image checks (PNG, size for the **pending** size, 64 KB) before upload, Admin-only page. | `map-item-editor.test.ts › pendingItem / form resize drops staged art that no longer fits`; existing `map-item-image.test.ts` and `map-item-form.test.ts` pass unchanged; `MapItemsView.test.tsx › forbidden` kept |
| 9 | No API change; existing pure tests pass unchanged; old dialog markup tests are ported. | `git diff --stat main -- src/app src/server src/lib db` is empty; all Checks green (`pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`) |

## Ming verification after merge
- Visual check against `mockup-item-editor-appearance.webp` / `mockup-item-editor-details.webp` at 1280 px and 390 px,
  light and dark (footer reachable at 390 px, no horizontal scroll inside the popup, 11 px mono hints readable on the
  tile-grid preview in dark mode).
- With a real local DB: an item placed in a room — change its size and Save: the popup shows the room-count message
  and the size stays pending; upload a wrong-size PNG: the per-direction message shows and nothing is staged.
- Answers to the assumptions marked **(Ming)** under `## Assumptions`.

## Files to create / modify
All under `src/ui/` (layer ui → lib only, R1). None is a High path.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/mapItems/map-item-editor.ts` (new) | Pure editor model: `ArtEdit`, `EditorState`, `initEditor(item)`, `editorReducer`, `pendingItem(item, form)`, `isDirty(item, state)`, `effectiveArt(item, state, dir)`, `closeDecision(item, state)`, `stagedUrls(art)`, `saveEditor(api, item, state)`, `applySaveResult(state, result)`. No React. | Staged model + one Save (ticket Footer bullet); testable without a DOM (repo tests are `renderToStaticMarkup` + pure). | No |
| `src/ui/mapItems/map-item-editor.test.ts` (new) | Unit tests (see Tests). | R5. | No |
| `src/ui/mapItems/MapItemEditor.tsx` (new, `"use client"`) | Native `<dialog>` shell (showModal on mount, close + focus restore on unmount, `onCancel` preventDefault → `requestClose`, scrim press → `requestClose`), header, `TabBar` for Appearance/Details, both panels mounted (inactive `hidden`), error banner `role="alert"`, footer with `role="status"` text, Cancel, Save changes, inline discard confirm. Owns `useReducer(editorReducer)`, the upload handler, object-URL lifecycle and the save/reset orchestration. Also exports `MapItemEditorFrame` (props-only body markup) for tests. | Replaces the three dialogs (ticket Scope). | No |
| `src/ui/mapItems/MapItemEditor.test.tsx` (new) | Markup tests of `MapItemEditorFrame`. | R5, AC 1, 6, 7. | No |
| `src/ui/mapItems/MapItemEditorAppearance.tsx` (new) | Props-only Appearance panel: "Directional artwork" label + "Never auto-rotated", direction radiogroup (4-up / 2-up), preview area (tile-grid background, source tag, 2× hero, 1× inset, `aria-hidden` caption "NORTH · 2× PREVIEW"), "removed on save" note, size rule text, Sprite library / Upload image switch (radiogroup), `SpriteBrowser` or upload panel, per-direction error `role="alert"`, "Only updates the <dir> view" / "Same image in every direction", "Restore default". Atlas-failed note kept. | Ticket Appearance bullet; replaces `MapItemArtBody`. | No |
| `src/ui/mapItems/MapItemEditorAppearance.test.tsx` (new) | Ported `MapItemArtDialog.test.tsx` cases + new ones. | R5, AC 2. | No |
| `src/ui/mapItems/MapItemEditorDetails.tsx` (new) | Props-only Details panel (fields from `MapItemFormFields` re-laid out), info line "Library key stays unchanged.", Reset button and inline reset confirm; `ResetMapItemBody` moves here unchanged. | Ticket Details bullet; replaces `MapItemFormFields` and `ResetMapItemDialog`. | No |
| `src/ui/mapItems/MapItemEditorDetails.test.tsx` (new) | Ported `MapItemFormDialog.test.tsx` and `ResetMapItemDialog.test.tsx` cases + new ones. | R5, AC 3. | No |
| `src/ui/mapItems/SpriteBrowser.tsx` | Becomes a staging picker: drops the staged block and "Use this sprite"/"Cancel" (picking a tile stages at once); adds a section title (the shown group, or "All types"), an "All types" checkbox, a labelled search input ("Find a sprite…"); tiles = `label` around a visually hidden but focusable radio (`sr-only` + `peer-focus-visible` ring), sprite key as the name, `w × h` tiles; grid `grid-cols-2 sm:grid-cols-3`. Props: `item` (the pending item), `dir`, `selected`, `query`, `allTypes`, `busy`, `atlas`, `onPick`, `onQuery`, `onAllTypes`. | Mockup sprite browser; ticket "sprite browser (search, 'All types')". | No |
| `src/ui/mapItems/SpriteBrowser.test.tsx` | Rewrite the confirm-step case; keep radiogroup, bundled-keys, no-atlas and missing-frame cases; add search/All types cases. | R5. | No |
| `src/ui/mapItems/map-item-art.ts` | Add pure `browserChoices(item, dir, bundled, { allTypes, query })` → `{ title: string \| null; groups: { group; keys }[]; count }`, built on `spriteChoices`. Keep every existing export. | Search and "All types" filtering, testable. | No |
| `src/ui/mapItems/map-item-art.test.ts` | Add `browserChoices` cases. | R5. | No |
| `src/ui/mapItems/MapItemsPage.tsx` | `Dialog` becomes `{ kind: "none" } \| { kind: "editor"; key: string }`; resolve the item with `findArtItem(items.items, key)`; close when it vanished (existing effect); render `<MapItemEditor key={key} item groups api imageUrl atlas atlasFailed onReload={items.reload} onClose onGone />`; drop the three dialog imports and `onArt`. | Wire the editor. | No |
| `src/ui/mapItems/MapItemsView.tsx` | Remove the `onArt` prop and the Art button; the Edit button (same `editLabel`) opens the editor. No other layout change in slice 1. | AC 4 (no art dialog entry left). | No |
| `src/ui/mapItems/MapItemsView.test.tsx` | Remove the Art-button case; change the ready case to "one Edit button per row, no Art button"; drop `onArt` from props. | AC 4; markup-only change. | No |
| `src/ui/copy/mapItems.ts` | Add `editor` group (see Approach step 7); add `form.fixedFootprint`, `form.shown` → "Show in item palette", `form.keyNote`; keep `edit` and `editLabel` (row button); remove entries that become unused (`artLabel`, `art.button/title/hint/close/choose/useLibrary/useLibraryHint/remove/saved/removed`, `art.browser.staged/use/cancel`, `form.title`, `form.reset`, `form.fixedReason`, `reset.title`). Keep `art.dirs/single/sameForAll/source/size/scale1/scale2/previewNA/upload/thumbAlt/atlasFailed/frameAlt/errors`, `art.browser.label/count/empty/tiles/smaller`, `reset.*` body strings, `fieldErrors`, `errors`. | D36. | No |
| `src/ui/mapItems/MapItemFormDialog.tsx`, `MapItemFormDialog.test.tsx` | **Delete** (fields → `MapItemEditorDetails.tsx`, tests ported). | AC 4. | No |
| `src/ui/mapItems/MapItemArtDialog.tsx`, `MapItemArtDialog.test.tsx` | **Delete** (panel → `MapItemEditorAppearance.tsx`, tests ported). | AC 4. | No |
| `src/ui/mapItems/ResetMapItemDialog.tsx`, `ResetMapItemDialog.test.tsx` | **Delete** (`ResetMapItemBody` → `MapItemEditorDetails.tsx`, test ported). | AC 4. | No |

Not changed: `map-item-form.ts`, `map-item-image.ts`, `map-items-state.ts`, `map-items-api.ts`, `FramePreview.tsx`,
`frame-preview.ts`, `useMapItemImages.ts`, `TabBar.tsx`, `EntityFormDialog.tsx` (only its exported `DialogField` /
`DialogSelect` are reused), everything under `src/app`, `src/server`, `src/lib`, `db`.

## Data model / migration
None.

## API contract
None (no endpoint change). The editor uses today's calls from `map-items-api.ts`: `patch` (PATCH
`/api/map-items/:key`, returns the item), `putArt` (PUT `…/art/:dir` `{sprite}`, returns the item), `putImage` (PUT
`…/art/:dir/image`, returns the item), `deleteImage` (DELETE `…/art/:dir/image`, idempotent: a second remove returns
ok, `src/server/map-items/map-items-image.db.test.ts:134-157`), `reset` (POST `…/reset`, returns the item).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-item-editor.test.ts › initEditor: Appearance tab, first artDirs direction, form from item, no art, clean` | AC 1, 7 |
| `› isDirty: false for a fresh state; true for a name edit, a whitespace-only name edit (invalid), a staged sprite, a staged library, a staged image; false again after reverting the name` | AC 7 |
| `› stageSprite equal to the saved sprite (no saved image) removes the entry instead of staging` | AC 7 |
| `› restore: saved library + nothing staged → no entry (disabled in view); staged entry over saved library → entry removed; saved sprite or image → {library} staged` | AC 2 |
| `› effectiveArt: staged image > staged sprite > staged library > saved image > saved sprite > library; a pending resize marks a saved image (and a saved sprite that no longer fits) removedOnSave and falls back to the next source` | AC 2, 8 |
| `› form resize drops a staged image whose px no longer fits and a staged sprite that no longer fits, with a per-direction note; keeps those that fit` | AC 8 |
| `› pendingItem uses form w/h for checkMapItemImage and spriteChoices (2 × 1 item enlarged to 2 × 2: 64 × 64 image accepted, 64 × 32 refused)` | AC 8 |
| `› closeDecision: clean → "close"; dirty → "confirm"; saving → "ignore"` | AC 7 |
| `› saveEditor order: name + size patch and art on n and s → calls patch, then n, then s (artDirs order); nothing sent when only art is staged except art calls` | AC 5 |
| `› saveEditor: invalid name → blocked on Details with the field error, no call; unconfirmed resize → blocked with confirmFirst, no call` | AC 5, 8 |
| `› saveEditor: {library} expands against the post-PATCH item: deleteImage only when it still has an image, then putArt(null) only when a sprite is set; neither → no call` | AC 5 |
| `› saveEditor: PATCH 409 item_in_use rooms 3 → failed, error on Details with "placed in 3 rooms", no art calls, patched null, all art remaining` | AC 6 |
| `› saveEditor: PATCH 409 item_name_taken → failed with "Another map item already has this name.", no art calls` | AC 6 |
| `› saveEditor: PATCH ok, art e 422 image_bad_size → failed, patched = returned item, remaining = e and later dirs only, error names East and is on Appearance with dir e` | AC 6 |
| `› saveEditor: 409 image_changed on an art step → failed with the image_changed message and reload` | AC 6 |
| `› saveEditor: not_found on any step → gone` | AC 6 |
| `› applySaveResult done → form from the patched item, art empty, status clean against the patched item, notice "Saved."` | AC 6, 7 |
| `› applySaveResult failed after PATCH → form from the patched item (patchFrom(patched, form) is unchanged), remaining art kept, tab and dir switched to the error` | AC 6 |
| `› stagedUrls lists the object URLs of staged images (for revoke on replace, drop, discard and unmount)` | memory hygiene |
| `map-item-art.test.ts › browserChoices: default shows the group of the item's library frame with that group as title; allTypes shows every fitting group, title null; query filters keys case-insensitively and trimmed; no fitting key in own group → falls back to all` | AC 2 |
| `SpriteBrowser.test.tsx › tiles are a radiogroup; selected key is checked; picking calls onPick (no Use/Cancel buttons); search input labelled; All types checkbox; empty text when nothing matches` | AC 2 |
| `SpriteBrowser.test.tsx` existing: bundled-keys only, no atlas → names only, missing frame → no canvas (kept, markup-adjusted) | regression |
| `MapItemEditorAppearance.test.tsx › directional item: radiogroup with North, East, South, West, North checked, "Never auto-rotated"; n/s item: North and South only; non-directional: no direction group, "Same image in every direction"` | AC 2 |
| `› preview shows a 2× and a 1× render: two canvases for library/sprite with atlas; two pixelated imgs (width w×1, w×2) for a staged or saved image URL; "Preview not available" for an image without URL; source tag text Library sprite / Package sprite: <key> / Custom image` | AC 2 (LAY-07 1×/2×) |
| `› pending resize with a saved image shows the "removed on save" note` | AC 8 |
| `› Sprite library / Upload image switch: library shows SpriteBrowser; upload shows the size rule and the file input accept="image/png"` | AC 2 |
| `› "Only updates the north view." and Restore default (disabled when effective art is library and nothing staged)` | AC 2 |
| `› a direction error is role=alert in that panel; busy disables directions, switch, tiles, upload and restore; atlas failed note` | AC 6, regression |
| `MapItemEditorDetails.test.tsx › name (maxLength 60), group (maxLength 40) with datalist, width/height selects 1–4, rotation hint only when directional` | AC 3 |
| `› fixed-size item: selects rendered disabled with its w and h and "This item uses a fixed footprint."` | AC 3 |
| `› chair: no "Show in item palette" checkbox, the chair note instead` | AC 3 |
| `› resize with effects: role=note warning and the confirm checkbox; unchanged size: none` | AC 8 |
| `› Reset button disabled for a library default; confirm view shows ResetMapItemBody, the unsaved-changes line when dirty, "Reset item" and "Keep editing"` | AC 3 |
| `› ResetMapItemBody lists library values, deleted images, cleared sprites; in-use note only when size differs` (ported) | regression |
| `MapItemEditor.test.tsx › shell: eyebrow, h2 "Edit <name>", key, close aria-label, tablist Appearance/Details` | AC 1 |
| `› footer status "No unsaved changes" when clean, "Unsaved changes" when dirty (role=status); Save disabled when clean or saving` | AC 7 |
| `› discard confirm bar: "Discard changes?", Keep editing, Discard` | AC 7 |
| `› error banner role=alert with the item_in_use room-count message` | AC 6 |
| `MapItemsView.test.tsx › each row has one Edit button (aria-label "Edit map item <name>") and no Art button` (changed) | AC 4 |

## Approach
1. **Pure model first** (`map-item-editor.ts`, rule 6). Types:
   ```ts
   type ArtEdit =
     | { kind: "sprite"; key: string }
     | { kind: "library" }                       // "Restore default" for that direction
     | { kind: "image"; bytes: Uint8Array<ArrayBuffer>; url: string; px: { width: number; height: number } };
   type EditorState = {
     tab: "appearance" | "details"; dir: Direction; source: "library" | "upload";
     form: MapItemForm; art: Partial<Record<Direction, ArtEdit>>;
     query: string; allTypes: boolean;
     phase: "idle" | "saving" | "confirmDiscard" | "confirmReset" | "resetting";
     error: { message: string; tab: "appearance" | "details"; dir?: Direction } | null;
     dirNotes: Partial<Record<Direction, string>>;   // client image check errors, "dropped by resize" notes
     notice: string | null;                           // "Saved." after a full save
   };
   ```
   - `pendingItem(item, form) = { ...item, w: form.w, h: form.h }`; used for `checkMapItemImage`, `artErrorMessage`,
     `expectedImageSize`, `browserChoices` and `effectiveArt` so a resize and an upload in one go are checked against the
     new size (consult risk 1).
   - `isDirty = patchFrom(item, form).kind !== "unchanged" || Object.keys(art).length > 0` (`needsConfirm` and
     `invalid` count as dirty).
   - Reducer actions: `tab`, `dir`, `source`, `form(patch)` (on w/h change drop staged images that fail
     `mapItemImageFits(item, dir, w, h, px)` and staged sprites that fail `spriteFits`, with a `dirNotes` entry),
     `stageSprite`, `stageImage`, `dirNote`, `restore(dir)`, `query`, `allTypes`, `askDiscard`, `keepEditing`,
     `askReset`, `saveStart`, `saveApplied(result)`, `resetApplied(item)`.
   - `saveEditor(api, item, state)` returns `{ kind: "blocked"; message } | { kind: "done"; patched } |
     { kind: "failed"; patched; remaining; error; reload } | { kind: "gone" }`:
     1. `patchFrom(item, form)`: `invalid` → blocked (`fieldErrors[field]`), `needsConfirm` → blocked
        (`form.confirmFirst`); nothing is sent.
     2. If `kind === "patch"`: `api.patch` first (a size change removes custom images and clears non-fitting sprites
        server-side, OQ-52). Failure → `failed` with `mapItemErrorMessage(code, rooms)` on Details, **no art calls**,
        all art remaining. `not_found` → `gone`.
     3. `base = patched ?? item`. For each `dir` of `artDirs(item)` (n, e, s, w; n, s for NS-only; s alone) with a staged
        entry, sequentially: `sprite` → `putArt(key)`; `image` → `putImage(bytes)`; `library` → `deleteImage` if
        `base.art[dir].hasImage`, then `putArt(null)` if `base.art[dir].sprite !== null`. Each result through
        `artOutcome(result, pendingItem, dir)`: `saved` → continue (base = returned item; after `deleteImage` set
        `hasImage: false` locally); `gone` → gone; `reload`/`error` → `failed` with this dir and later dirs remaining,
        error on Appearance with `dir`, `reload: true` for `image_changed`.
   - `applySaveResult`: `done` → form from `patched` (when patched), art `{}`, notice "Saved."; `failed` → form from
     `patched` when the PATCH succeeded (so it no longer reads as unsaved; `patchFrom(patched, form)` is unchanged),
     `art = remaining`, `error` set, `tab`/`dir` switched to the error; `blocked` → error on Details.
2. **Editor component** (`MapItemEditor.tsx`): `Save` → guard with an in-flight ref (R7: `apiFetch` re-sends once on
   401/403; every step is idempotent: PATCH/PUT by value, DELETE image returns ok when already gone), dispatch
   `saveStart`, `await saveEditor`, `gone` → `onGone()`; otherwise dispatch `saveApplied`, then `await onReload()`
   when at least one step succeeded or the result asks for `reload` (`image_changed`); a blocked save or a refused
   first PATCH sends nothing that changed, so no reload. Then phase back to idle. `saving` stays on until the reload resolved, so the status never shows
   saved changes as unsaved. The editor is keyed by `builtinKey` in the page, so the list reload does not reset the
   draft; dirty is always computed against the fresh `item` prop.
   - Reset: `askReset` shows the inline confirm in Details (with "Unsaved changes will be lost." when dirty);
     "Reset item" → `settleMapItem(await api.reset(key))`; ok → `resetApplied(value)` (form from item, art `{}`, revoke
     URLs) + reload; `not_found` → `onGone`; error → banner. Reset is an immediate action, not part of Save. Disabled
     while saving and when `isLibraryDefault(item)`.
   - Upload: file → `checkMapItemImage(file, pendingItem(item, form), dir)`; not ok → `dirNote` with `artErrorMessage`;
     ok → `URL.createObjectURL(new Blob([bytes], { type: "image/png" }))` → `stageImage`. An effect revokes URLs that
     left `stagedUrls(state.art)` and all on unmount.
   - Close: `requestClose()` for Cancel, the X, Esc (`onCancel` + `preventDefault`) and scrim press:
     `closeDecision` → close / `askDiscard` / ignore. Esc while the discard bar is open → `keepEditing`. Focus: on open the
     selected tab; on close restore the opener (existing `previous.focus()` pattern from `MapItemArtDialog.tsx:240-249`).
   - Layout: `w-[calc(100%-1.5rem)] max-w-[580px]`, inner column `max-h-[92dvh]` with a scrolling middle and the footer
     in the flex column (not fixed), footer `flex-wrap` (status on its own line at 390 px). Tokens only (`bg-surface-high`,
     `border-outline-variant`, `bg-primary`/`text-on-primary` for Save, `bg-primary-container` for the active direction,
     `rounded-md3-xl`); tile-grid background as an inline `background-image` linear-gradient using
     `var(--outline-variant)` (works in dark mode, no asset). All targets ≥ 44 px. `TabBar` as is (its underline style
     matches the mockup) for Appearance/Details; direction and source switch are `role="radiogroup"` with arrow keys via
     `nextTabIndex` from `src/ui/tab-keys.ts`, plus `aria-checked` and a visible state (not colour only). A small "changed"
     dot (`sr-only` "changed") on direction buttons and tab labels with pending edits.
3. **Appearance panel**: preview area renders `effectiveArt`: image → `<img>` at 2× and 1× (`imageRendering:
   pixelated`, `width: expectedImageSize(pending, dir).w * scale`) from the staged `url` or `imageUrl(item, dir)`;
   sprite/library → `FramePreview` with `scale={2}` and `scale={1}` (frame = staged/saved sprite or
   `resolveFrameKey(builtinKey, rotation)` as `panelFrameKey` does). Source tag uses `copy.art.source.*`; caption is
   `aria-hidden`, alt via `copy.art.frameAlt`.
4. **Details panel**: `DialogField`/`DialogSelect` reused; fixed-size → both selects `disabled` with `item.w`/`item.h`
   and `form.fixedFootprint`; size warning in a `role="note"` block; reset confirm inline.
5. **SpriteBrowser + `browserChoices`**: own group = `REGISTRY[resolveFrameKey(item.builtinKey, 0)]?.group`; if that
   group has no fitting key, show all. Query matches the frame key (substring, case-insensitive, trimmed).
6. **Page and list wiring** (`MapItemsPage.tsx`, `MapItemsView.tsx`) as in the file table.
7. **Copy** (`mapItemsCopy.editor`): `eyebrow: "Item editor"`, `title: (name) => \`Edit ${name}\``, `close: "Close
   item editor"`, `tabs: { appearance: "Appearance", details: "Details" }`, `tabsLabel`, `directional: "Directional
   artwork"`, `neverRotated: "Never auto-rotated"`, `dirsLabel`, `previewCaption: (dir) => \`${dir} · 2× preview\``,
   `removedOnSave: "Removed when you save the new size"`, `sourceLabel`, `sourceLibrary: "Sprite library"`,
   `sourceUpload: "Upload image"`, `choosePng: "Choose PNG file"`, `onlyUpdates: (dir) => \`Only updates the
   ${dir.toLowerCase()} view.\``, `restore: "Restore default"`, `allTypes: "All types"`, `search: "Find a sprite…"`,
   `searchLabel`, `noMatch: "No sprite matches."`, `droppedByResize: (dir) => …`, `status: { clean: "No unsaved
   changes", dirty: "Unsaved changes", saving: "Saving…", saved: "Saved." }`, `cancel: "Cancel"`, `save: "Save
   changes"`, `discard: { title: "Discard changes?", keep: "Keep editing", discard: "Discard" }`, `changed: "changed"`,
   `reset: { button: "Reset item to library defaults", lost: "Unsaved changes will be lost.", keep: "Keep editing" }`;
   `form.fixedFootprint: "This item uses a fixed footprint."`, `form.shown: "Show in item palette"`, `form.keyNote:
   "Library key stays unchanged."`. Final wording may follow the mockups; every string lives in this file (D36).
8. Port tests, delete the old dialogs, run all Checks.

Rules: R1 (ui imports only `@/lib/**` and `src/ui/**`; `pnpm check:layers`), R3 (no config), R4 (scope: no API,
placed-count line, "Local library" badge, app shell or reorder), R5 (pure logic tested; Checks green), R7 (client side:
re-entry guard and idempotent steps). R2/R6 not touched.

## Specialist input used
- frontend-developer: adopted the staged `EditorState` / `ArtEdit` model, the pure `saveEditor` with a fake api, the
  PATCH-first sequential order, post-PATCH expansion of "Restore default", the partial-failure ledger (`remaining`),
  rebuilding `form` from the returned item, the re-entry guard, the inline discard confirm, deleting the three
  dialogs, keying by `builtinKey`, keeping all pure helpers. Adopted "search and All types are new" (findings 4).
  Rejected leaving the 1× preview open: the spec decides it. Rejected separate `map-item-save.ts`: one pure module is
  enough.
- ux-architect: adopted pending-size validation, dropping staged art that a resize invalidates, "removed on save" note,
  details-failure stops art, alert banner + switch to the owning tab/direction, stay open after a full save with
  "No unsaved changes" + "Saved.", inline reset confirm, radiogroups for direction/source, `sr-only` radios in sprite
  tiles, changed dots, `dvh` sizing and wrapping footer, 44 px targets, tile-grid via token gradient, `TabBar` reuse,
  2× hero + 1× inset (LAY-07). Deferred to slice 2: list header, stats, tabs, cards, the `TabBar` pill variant.
- `deleteImage` idempotence (both consults asked) confirmed in `src/server/map-items/map-items-image.db.test.ts:151-156`.
- `isCustomised` body checked (`map-item-art.ts:76-77`): it matches the ticket's "customized" definition (used in slice 2).

## Assumptions
Defaults taken from the consults where spec and decisions are silent; marked **(Ming)** for Ming to confirm. None blocks.
1. 1×/2×: resolved by the spec (LAY-07 l. 502 wins over the mockup): the editor shows the 2× hero and a small 1× inset;
   the card is not the 1× preview.
2. **(Ming)** After a fully successful Save the editor stays open, shows "No unsaved changes" and a polite "Saved.";
   Cancel keeps its label and closes without a prompt when clean (ticket AC wording).
3. Restore default = that direction back to the library sprite (ticket text): removes both a custom image and a package
   sprite for that direction (DELETE image + PUT `sprite: null`, only the calls needed).
4. **(Ming)** Reset with unsaved edits is allowed; the confirm warns "Unsaved changes will be lost." and the draft is
   rebuilt from the reset item.
5. **(Ming)** Fixed-size items show the single sentence "This item uses a fixed footprint." (ticket); the per-kind
   `fixedReason` texts are dropped.
6. **(Ming)** Sprite browser search and "All types" are new (today's browser has neither): by default it shows the
   registry group of the item's own library frame (the mockup's "Office essentials"); "All types" shows every group
   that fits; if the own group has nothing that fits, all groups show.
7. **(Ming)** A pending resize drops staged images / sprites that do not fit the new size (with a note); a refused
   resize keeps the size edit pending, so staged art stays consistent with it.
8. Save is disabled when there are no unsaved changes.
9. Slice 2 defaults (recorded now so SIM-070.1 need not re-ask): **(Ming)** "In palette" counts `!hidden` literally
   (chairs count); **(Ming)** the card art source for mixed directions uses image > package sprite > library over the
   allowed directions; "customized" = `isCustomised`; a selected group tab that disappears falls back to "All".
10. Hotspots: no other open ticket (IN_PROGRESS/REVIEW/DONE: only SIM-061.1, typing animation) edits
    `src/ui/mapItems/**` or `src/ui/copy/mapItems.ts`. SIM-070.1 will edit `MapItemsView.tsx`, `MapItemsView.test.tsx`
    and `copy/mapItems.ts` after this slice.
11. No `@testing-library`/jsdom in the repo (`package.json` has only `vitest`): interaction paths are tested through the
    pure reducer/`saveEditor`/`closeDecision`, views through static markup. No new dependency.

## Blocking questions
None.

## Split proposal
The full ticket is clearly larger than one implement/review cycle (estimate: ~900 changed production lines plus ~600
test lines). Split:
- **Slice 1 (this plan, SIM-070):** the Item editor (pure model, save orchestration, Appearance and Details, sprite
  browser search/All types), deletion of the three dialogs, wiring from today's list (one Edit button per row). Still
  above ~400 lines (~600 production + tests), but it cannot be split further without leaving two edit paths.
- **Slice 2 (follow-up SIM-070.1, depends on SIM-070):** ticket AC 1, 2 and the card content of AC 3:
  - `map-items-state.ts`: `mapItemStats(items)` → `{ total, inPalette (!hidden), customised (isCustomised) }`,
    `filterItems(items, group, query)` (name and key, case-insensitive, trimmed; flat list in `catalogGroups` order),
    `artSourceOf(item)` (image > sprite > library over `artDirs`), with tests.
  - `MapItemsView.tsx` split into header (eyebrow, h1 "Map items" from `shellCopy.pages.mapItems.title`, new subtitle
    replacing `intro`), stats card (wraps at 390 px, note "32 px tile system · 4 directional sprites"), group tabs
    (`TabBar` with a new `variant="pill"`, default unchanged; "All N" + groups; `overflow-x-auto` inside its own box),
    labelled `type="search"` input, card grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, `MapItemCard`
    (tile-grid preview with fallback to `panelFrameKey(item, "s")`, `w × h` badge, 44 px pencil with `editLabel`, name,
    key, group chip, "Fixed size", art source, "Hidden" pill), footer "Showing N of M items · Items are never
    deleted. Hide an item to remove it from the local palette.", empty-result message; loading, error, forbidden
    and not-ready states kept.
  - Tests: stats fixture (hidden, customised, fixed-size), filter, card variants (fixed, hidden, customised,
    non-directional), tabs/search markup, 390 px classes (`grid-cols-1`, no page-level overflow).
