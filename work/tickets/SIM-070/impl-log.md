## Attempt 1 — 2026-11-27 (slice 1: Item editor)

### Files touched
| File | Required because |
|---|---|
| src/ui/mapItems/map-item-editor.ts (new) | Pure editor model: staged art, reducer, isDirty, effectiveArt, closeDecision, saveEditor (PATCH first, then art in artDirs order), applySaveResult |
| src/ui/mapItems/MapItemEditor.tsx (new) | Dialog shell, tabs, footer, discard confirm, save/reset/upload orchestration, object-URL lifecycle; exports MapItemEditorFrame |
| src/ui/mapItems/MapItemEditorAppearance.tsx (new) | Appearance panel (directions, 2x/1x preview, source switch, browser, upload, restore) |
| src/ui/mapItems/MapItemEditorDetails.tsx (new) | Details panel, inline reset confirm, ResetMapItemBody moved here |
| src/ui/mapItems/SpriteBrowser.tsx | Staging picker with search and All types; no Use/Cancel |
| src/ui/mapItems/map-item-art.ts | browserChoices, libraryFrameKey (panelFrameKey reuses it) |
| src/ui/mapItems/MapItemsPage.tsx, MapItemsView.tsx | Wire the editor; Art button and onArt removed |
| src/ui/copy/mapItems.ts | editor copy group; unused dialog strings removed (D36) |
| MapItemFormDialog, MapItemArtDialog, ResetMapItemDialog (+ tests) | Deleted (AC 4) |

### Tests added / changed
- map-item-editor.test.ts (new): init, isDirty, stageSprite/restore, effectiveArt, resize drops, pendingItem upload check, closeDecision, stagedUrls, saveEditor (order, blocked, library expansion, item_in_use, name taken, 422 partial, image_changed, not_found), applySaveResult
- MapItemEditor.test.tsx, MapItemEditorAppearance.test.tsx, MapItemEditorDetails.test.tsx (new; old dialog tests ported)
- SpriteBrowser.test.tsx (rewritten), map-item-art.test.ts (browserChoices), MapItemsView.test.tsx (one Edit button, no Art button)

### Checks (actual output summary)
- typecheck: `pnpm typecheck` ok; `pnpm check:layers`: 1000 files, no violations
- format:check: All matched files use the correct format.
- test: Test Files 381 passed | 1 skipped; Tests 3738 passed | 7 skipped
- build: `pnpm build` exit 0

### Out-of-plan files
None. (`git diff --stat main -- src/app src/server src/lib db` is empty.)

### Follow-ups (noticed, not done)
- Slice 2 (SIM-070.1): header, stats, group tabs, search, card grid.
- Reload failure after a save leaves the draft showing as unsaved (item prop stays stale); rare, not handled.
- Visual check at 390/1280 px, light/dark not run here (needs a browser).

### Scope self-check
- Could the diff be smaller? No: one editor replaces three dialogs; tests ported.
- Diff size: see git diff --stat.
