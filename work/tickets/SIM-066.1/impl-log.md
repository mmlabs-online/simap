# Impl log — SIM-066.1

## Attempt 1

### Files touched
- `src/ui/portal/LookStage.tsx` (new): dotted stage, Front/Back `FilterChips`, 4x figure, corner 1x/2x, caption. Required because: stage + toggle.
- `src/ui/portal/LookPreview.tsx`: `scale` widened to 4; optional `decorative` prop (aria-hidden, no role=img). Required because: 4x figure, card previews without duplicate img roles.
- `src/ui/portal/PixelLookPicker.tsx`: `"use client"`, `view` state, `LookStage`, 44 px swatches (32 px box) with check icon, hairstyle card grid with 1x previews (text only without atlas). Required because: all three scope bullets.
- `src/ui/copy/portal.ts`: `stageLabel`, `viewToggleLabel`. Required because: D36. (`stylePreviewLabel` from the plan not added: the card canvas is decorative, so no label is needed.)
- `src/ui/portal/LookStage.test.tsx` (new), `src/ui/portal/PixelLookPicker.test.tsx`: tests per plan; the Reset test now picks the last `<button>` because the Front/Back chips now precede it.

### Tests added
LookStage: front view, back view, atlasFailed, atlas null. Picker: stage canvases (3 stage + 3 cards), hairstyle cards with and without atlas, 4 check icons (3 swatches + selected style card; skin group has 1), 44 px label classes.

### Check results
- format:check: All matched files use the correct format.
- typecheck + check:layers: no errors; "check-layers: 1028 files, no violations"
- test: Test Files 396 passed | 1 skipped; Tests 3846 passed | 9 skipped
- build: compiled and type-checked, route table printed (success)

### Out-of-plan files
None.

### Follow-ups
- Name tag under the figure (mockup) not included; needs the draft name from `ProfileTab.tsx`.
- Selected hairstyle card also shows a check icon (plan only named swatches; same not-colour-alone rule).

### Scope self-check
Only plan files touched; no API, data or token changes.
