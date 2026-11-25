## Attempt 1 — 2026-11-25
Verdict: PASS

Reviewed commit f633418 against `origin/main` (diff: `src/ui/**` and `work/tickets/SIM-039.10/**` only).

### Checks (run by reviewer)
- `pnpm format:check`: exit=0
- `pnpm typecheck`: exit=0
- `pnpm check:layers`: exit=0, "check-layers: 799 files, no violations"
- `pnpm test`: exit=0, "Test Files 303 passed | 1 skipped (304); Tests 3068 passed | 7 skipped (3075)". This matches impl-log.
- `pnpm build`: exit=0
- `pnpm test:db`: CI-only, and no DB code changed.

### Acceptance criteria
- [x] Package and library art show 1× and 2× previews, and the browser shows frame thumbnails.
  - Evidence: `MapItemArtDialog.tsx:104-124` renders two `FramePreview`s at scale 1 and 2 with captions. They render only when the atlas is ready and the frame exists; otherwise `previewNA` is shown.
  - `SpriteBrowser.tsx:67-74` adds a 32 px box thumb on each row, and `SpriteBrowser.tsx:86-93` adds a 1× preview on the staged step.
  - Tests: `MapItemArtDialog.test.tsx:115` "atlas previews" and `SpriteBrowser.test.tsx:65` "thumbnails" pass. The library key comes from `panelFrameKey` (`map-item-art.ts:81-87`, tested per direction at `map-item-art.test.ts` "panelFrameKey"). `DIR_ROTATION` is the correct inverse of `ROTATION_TO_DIR` (`src/lib/sprites/placement.ts:18`).
- [x] If the atlas fails, the page still works with the text list and shows a note.
  - Evidence: `MapItemArtDialog.tsx:46-50` shows a `<p role="status">` with `copy.atlasFailed`. While the atlas is null, no canvas renders: every `FramePreview` use is guarded by `atlas &&`.
  - Tests: `MapItemArtDialog.test.tsx:135` "atlas failed" (the note, 4 fieldsets and Choose still render) and `:143` "atlas loading" pass.
- [x] Checks green; the frame rect logic has unit tests.
  - Evidence: `frame-preview.test.ts` covers `frameRect` (source/dest at 1 and 2, rejected scales 0/-1/1.5/NaN, zero size), `containRect` (large frame scaled down and centred with smooth=true, small frame at 1× with smooth=false, 1×1 frame, zero w/h gives null) and `atlasFrame` (own keys only).
- Ming verification after merge (not verified here): how the canvases look in a real browser (pixel sharpness, alignment), and blocking `/sprites/office.json` to see the note. Carry this into the PR.

### Canvas component review (`src/ui/mapItems/FramePreview.tsx`, no DOM tests)
- **Smoothing:** `FramePreview.tsx:32` sets `imageSmoothingEnabled = fit?.smooth ?? false`. It is always off at integer scales. In box mode it is on only when a frame is scaled below 1 (`frame-preview.ts:46`, `smooth: scale < 1`), as the plan says. The CSS uses `imageRendering: "pixelated"`.
- **Canvas size:** `FramePreview.tsx:25-26` and `:44-45`. In scale mode the backing size and the CSS size are both `w*scale × h*scale`. In box mode both are `box × box`, with the frame centred by `containRect`. Because the CSS size equals the backing size, the browser does not rescale.
- **Redraw:** the effect deps are `[atlas, r, width, height]` (`:34`). `r` is a new object on every render, so the effect redraws on every render. That covers changes to the atlas and the frame key, at the cost of extra redraws (see Nits).
- **Missing frame or failed atlas:** `atlasFrame` uses `Object.hasOwn` (`frame-preview.ts:21`), so `r` is null. The component then returns null (`:36`), and the effect exits early when there is no context or no rect (`:30`). `useAtlas` only sets the atlas after the image has loaded and the manifest is valid (`loadAtlas.ts`), so `drawImage` never gets an unloaded image. On failure the atlas stays null and no `FramePreview` mounts.
- **One atlas load:** `useAtlas()` is called once, in `MapItemsLoaded` (`MapItemsPage.tsx:43`). The atlas is passed as props to the view, the dialog and the browser; `grep useAtlas src/ui/mapItems` finds only that one call. `useAtlas` runs its effect with `[]` deps.

### Scope (R4)
- Every changed file is in the plan's file list. `work/` changes are the ticket's own plan, impl-log and ticket files.
- Deviations are logged and acceptable:
  - `frameRect` rejects bad scales (the plan allowed either rejecting or clamping).
  - The staged block shows the frame at 1×, so large frames are not shrunk on the confirm step.
- No High path touched.

### Rules (CLAUDE.md)
No violations found.
- R1: the ui code imports only lib (`@/lib/sprites/placement`, which pulls only lib modules) and ui (`../roomlayout/*`), and `check:layers` is clean.
- D36: new strings live in `src/ui/copy/mapItems.ts:93-94`.
- R5: the new logic has tests.
- R3, R6, R7: not touched.

### Blockers from review agents
None. No review trigger paths changed.

### Nits (do not block)
- 💭 `FramePreview.tsx:34`: `r` is recomputed on every render, so the effect redraws on every parent render. This is harmless (one `drawImage`, no state set), but deps on the primitive fields (`r?.sx`, …, `fit?.smooth`) or a `useMemo` would avoid redundant draws.
- 💭 `MapItemsView.tsx:111`: the sprite-only row thumbnail reuses `thumbAlt` ("Custom art of {name}"). It is a package sprite, not custom art. A neutral label such as `frameAlt(key)` or "Art of {name}" would be more accurate.
- 💭 `MapItemsView.tsx:106`: while a custom-image blob URL is still loading (`thumbUrl` returns null), an item that also has a sprite briefly shows the sprite canvas before the `<img>` replaces it.

### Follow-ups (out of scope)
- None.
