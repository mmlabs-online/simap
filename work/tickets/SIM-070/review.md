## Attempt 1 — 2026-11-27
Verdict: PASS

Scope of this review: slice 1 of the plan (Item editor). Ticket AC 1, AC 2 and the card content of AC 3 belong to
slice 2 (planned follow-up SIM-070.1) and are not judged here.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1055 files)
- `pnpm typecheck` — exit 0 (route types generated, tsc clean)
- `pnpm check:layers` — exit 0, "check-layers: 1000 files, no violations"
- `pnpm test` — exit 0, "Test Files 381 passed | 1 skipped (382); Tests 3738 passed | 7 skipped (3745)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only, needs Postgres); no file under `src/server`, `db` or `src/lib` changed.

### Acceptance criteria (plan verification table, slice 1)
- [x] 1 Shell: eyebrow, "Edit <name>", key, close button, Appearance/Details tablist — evidence:
  `MapItemEditor.test.tsx › shell: eyebrow, h2 Edit <name>, key, close button with aria-label, tablist …` (pass);
  `MapItemEditor.tsx:62-101`.
- [x] 2 Appearance: N/E/S/W (n/s, single), "Never auto-rotated", 2× and 1× preview of staged art with source label,
  Sprite library / Upload switch, browser with search and All types, "Only updates the <dir> view", Restore default —
  evidence: `MapItemEditorAppearance.test.tsx` (8 cases), `SpriteBrowser.test.tsx` (7 cases),
  `map-item-editor.test.ts › effectiveArt`, `› stageSprite / restore`, `map-item-art.test.ts › browserChoices` (pass).
- [x] 3 Details: name, group, 1–4 selects (disabled + "This item uses a fixed footprint." when fixed), "Show in item
  palette" / chair note, resize warning + confirm, reset with inline confirm — evidence: `MapItemEditorDetails.test.tsx`
  (8 cases incl. ported `ResetMapItemBody`) (pass); `MapItemEditorDetails.tsx:66-196`.
- [x] 4 No other edit/art/reset dialog — evidence: the three dialogs and their tests are deleted in the diff;
  `rg -n "MapItemFormDialog|MapItemArtDialog|ResetMapItemDialog|onArt" src` only hits the unrelated
  `onArtEntries` prop in `src/ui/roomlayout/LayoutEditor*.tsx`; `MapItemsView.test.tsx › each row has one Edit button
  … and no Art button` (pass); `MapItemsPage.tsx` renders only `MapItemEditor`.
- [x] 5 Save order PATCH first, then art in `artDirs` order, stop at first failure — evidence:
  `map-item-editor.ts:154-218`; `map-item-editor.test.ts › saveEditor › order …`, `› {library} expands against the
  post-PATCH item …`, `› blocked …` (pass).
- [x] 6 Refusals shown in the popup, nothing saved shown as unsaved, `not_found` closes — evidence:
  `› PATCH 409 item_in_use rooms 3`, `› item_name_taken`, `› PATCH ok, art e 422 image_bad_size`, `› image_changed`,
  `› not_found on any step → gone`, `applySaveResult › failed after PATCH …` (pass); `MapItemEditor.test.tsx › error
  banner is role=alert with the item_in_use room-count message` (pass); `MapItemEditor.tsx:262-276` keeps
  `phase: saving` until the reload resolved.
- [x] 7 "No unsaved changes" / "Unsaved changes", confirm on Cancel, X, Esc, scrim — evidence:
  `› isDirty`, `› closeDecision`, `applySaveResult › done → … clean`, `MapItemEditor.test.tsx › footer status …`,
  `› discard confirm bar …` (pass); every close path goes through `requestClose` (`MapItemEditor.tsx:256-260, 320-331`).
- [x] 8 Today's rules: OQ-52 warning, client image checks against the pending size, Admin-only — evidence:
  `› form resize drops …`, `› pendingItem uses the form w and h to check an upload …` (pass); upload path
  `MapItemEditor.tsx:299-314` uses `checkMapItemImage(file, pendingItem(...))`; `MapItemsView.test.tsx › forbidden`
  kept; `map-item-image.ts`, `map-item-form.ts` unchanged.
- [x] 9 No API change — evidence: `git diff --stat origin/main...HEAD -- src/app src/server src/lib db` is empty; all
  Checks green.

Ticket AC outside slice 1 (for SIM-070.1): AC 1 (header, stats, 390 px grid), AC 2 (group tabs, search, "Showing N of M"),
AC 3 card content (preview, `w × h` badge, chip, Fixed size, art source, Hidden).

Ming verification after merge (carry to the PR):
- Visual check against `mockup-item-editor-appearance.webp` / `mockup-item-editor-details.webp` at 1280 px and 390 px,
  light and dark (footer reachable at 390 px, no horizontal scroll inside the popup, 11 px hints readable in dark mode).
- With a real local DB: resize an item placed in a room and Save (room-count message, size stays pending); upload a
  wrong-size PNG (per-direction message, nothing staged).
- Answers to the plan's **(Ming)** assumptions 2, 4, 5, 6, 7 (and 9 for slice 2).

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found. R1: all new files are under `src/ui/**` and import only `@/lib/**` and `src/ui/**`
(`check:layers` clean). R4: every changed file is in the plan's file table; the only other changes are the ticket's
work files. R5: new pure logic (`map-item-editor.ts`, `browserChoices`) has unit tests. R7 (client side): Save and
Reset share an in-flight guard (`MapItemEditor.tsx:262-264, 278-280`); each step is idempotent. D36: all new strings are
in `src/ui/copy/mapItems.ts`.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `map-item-editor.ts:212` — `reload` is false when a "Restore default" on the first staged direction succeeds its
  `deleteImage` and then fails its `putArt(null)` (no PATCH, `i === 0`). The image is already deleted server-side but the
  list (row thumbnail) is not reloaded; a retry is safe (DELETE is idempotent). Tracking a "something succeeded" flag per
  call instead of per direction would cover it.
- `applySaveResult` `blocked` keeps the current tab; the banner is visible on both tabs, but switching to Details (where
  the field is) would match the "switch to the owning tab" behaviour of the other errors.
- The old `MapItemArtDialog.test.tsx › atlas loading: no note, no canvas` case was not ported to the Appearance tests.
- While the inline reset confirm is open, a close request replaces it with the discard bar (phase is a single value);
  harmless.
- An upload resolving after a resize that happened during its check is staged without `dropMisfits`; very unlikely.

### Follow-ups (out of scope)
- SIM-070.1 (slice 2): header, stats bar, group tabs, search, card grid (ticket AC 1, 2, card content of AC 3).
- Reload failure after a save: `useList` sets `items: []` on error, so the editor closes because the item vanished;
  consider keeping the editor open with a retry note (impl-log already lists the stale-draft case).
