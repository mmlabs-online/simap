# Review — SIM-066.1

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0 (oxfmt, 1086 files, no diffs).
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 1028 files, no violations".
- `pnpm test` — exit 0; "Test Files 396 passed | 1 skipped (397)", "Tests 3846 passed | 9 skipped (3855)". Matches impl-log.
- `pnpm build` — exit 0; "Compiled successfully", route table printed.
- `pnpm test:db` — CI-only; no DB/SQL change in this ticket.

### Acceptance criteria
- [x] Dotted stage with a large figure, a working Front/Back toggle and 1x/2x previews — evidence: `src/ui/portal/LookStage.tsx` (radial-gradient dots, `copy.stageLabel`, `FilterChips` toggle, 4x figure + corner 1x/2x, caption strip); wiring `PixelLookPicker.tsx` `useState<AvatarView>("front")` → `LookStage view/onViewChange={setView}`; tests `LookStage.test.tsx › front view…`, `› back view…`, `› atlasFailed…`, `› atlas null (loading)…` all pass.
- [x] Hairstyle options are cards with a preview; no atlas falls back to text — evidence: `PixelLookPicker.tsx` style group `grid grid-cols-3`, card label with decorative 1x `LookPreview` only when `p.atlas && !p.atlasFailed`; tests `PixelLookPicker.test.tsx › hairstyle cards: 3 radios, each card has a canvas with atlas` and `› hairstyle cards without atlas: text names only, no canvas` pass.
- [x] Selected swatches show a check mark; touch targets at least 44 px — evidence: `swatchClass`/`cardClass` carry `min-h-11 min-w-11` (44 px), colour box `h-8 w-8`, `Icon name="check"` only when `checked` (Icon is aria-hidden by default; ring kept, so state is not colour alone); tests `› selected swatch shows check icon…` (4 checks, 1 in skin fieldset) and `› swatch and card labels carry min 44 px classes` pass.
- [x] Render tests cover the toggle, the hairstyle cards and the selected state — evidence: the tests above, 16/16 in the two files.

Ming verification after merge (from plan, not a reviewer gate): visual match to `../SIM-066/mockup-profile.png` in a real browser and on a touch device (44 px targets feel right; the toggle switches the figure and the corner previews).

### Deviations from the plan (judged)
- `stylePreviewLabel` copy key not added: accepted. The card canvas is decorative (`aria-hidden`), the radio's name comes from the visible "Style n" text, so no label is needed.
- `decorative` prop on `LookPreview`: accepted; plan step 4 named it explicitly.
- Check icon also on the selected hairstyle card: accepted; same file, same not-colour-alone rule, tiny.
- Reset test now takes the last `<button>`: accepted; the Front/Back chips now precede Reset in markup.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `LookStage.tsx` imports only `@/lib/**` and `src/ui/**` (check:layers green). D36: new copy (`stageLabel`, `viewToggleLabel`) in `src/ui/copy/portal.ts`. R4: changed source files exactly match the plan's file list; no High path touched. R5: checks green, new logic tested.

### Blockers from review agents
None.

### Nits (do not block)
- `PixelLookPicker.tsx` swatch check icon uses `text-on-primary drop-shadow` over the swatch colour; on very light swatches the white check may be faint. The ring still carries the state; worth a look during Ming's visual check.
- `cardClass` starts `"flex relative …"`; other class strings list `relative` first. Cosmetic.
- The plan's verification for AC 1 mentions a click check in `pnpm dev`; the tests cover the toggle via controlled static render per view, and the `setView` wiring is visible in code. No interaction test (the repo's UI tests are static render).

### Follow-ups (out of scope)
- Name tag under the figure (mockup shows "Ming"); needs the draft name passed from `ProfileTab.tsx`.
- `FilterChips` buttons (`src/ui/Chip.tsx`, `px-4 py-2`, 13 px text) are about 34 px tall, below 44 px; the ticket's 44 px rule covers swatches only, and `Chip.tsx` is shared (SIM-071 hotspot).
