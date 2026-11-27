Status: READY

# Plan — SIM-066.1: Pixel character card polish (stage, Front/Back toggle, hairstyle cards)

## Scope summary
- Ticket scope: "Dotted 'A little you' stage with one large figure and a Front/Back toggle; small 1× and 2× previews in the corner (keeps POR-06's 'front and back at 1× and 2×', question 6 default)." / "Hairstyle option cards with a small preview of each style (names stay 'Style 1/2/3')." / "Swatch selected state with a check mark (not colour alone) and 44 px touch targets."
- Out of scope (ticket): "New avatar parts or colours; any API change."
- SIM-066 plan, Q-A default (approved in batch 2026-11-26-7): "one large preview (4×) of the selected view on the dotted stage, plus small 1× and 2× previews of the same view in the stage corner. The toggle reaches front and back at both sizes." Slice 2 list: "Hairstyle option cards with a `LookPreview` at 1× per style (text-only when the atlas is missing)", "Swatches at 32 px with a 44 px hit area and a check mark plus ring for the selected state", "Widening `LookPreview.scale` to include 4".
- Reference: `work/tickets/SIM-066/mockup-profile.png` (stage with "A LITTLE YOU" label, Front/Back toggle top right, figure, caption strip "This is how you appear on room maps"; hairstyle cards in a 3-column row; swatches with ring + check).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Dotted stage, large figure, working Front/Back toggle, plus 1×/2× previews | `LookStage.test.tsx` (static render per view: canvas labels, `aria-checked`); `pnpm dev` Profile tab: toggle switches figure and corner previews |
| 2 | Hairstyle options are cards with a preview; no atlas falls back to text | `PixelLookPicker.test.tsx › hairstyle cards` (3 canvases with atlas; none and text names without atlas) |
| 3 | Selected swatches show a check mark; touch targets >= 44 px | `PixelLookPicker.test.tsx › selected swatch` (check icon only in the checked label; label class has `min-h-11 min-w-11`) |
| 4 | Render tests cover toggle, hairstyle cards, selected state | The three tests above; `pnpm test` green |

## Ming verification after merge
- Visual match to the mockup on a real browser and on a touch device (44 px targets feel right). Not a reviewer gate.

## Files to create / modify
High path touched: **none** (all files under `src/ui/**`; none match `loop.config.md` High paths).

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/LookStage.tsx` | New. Props `{atlas, atlasFailed, look, view, onViewChange}`. Dotted stage (CSS radial-gradient dots, "A LITTLE YOU" label), `FilterChips` Front/Back (from `../Chip`), 4× `LookPreview` of `view`, corner 1×/2× previews of `view`, caption strip `copy.mapsCaption`. Pure view, controlled. | Stage + toggle; separate so the toggle state is testable via static render | no |
| `src/ui/portal/LookPreview.tsx` (line 14) | Widen `scale: 1 \| 2` to `1 \| 2 \| 4` | Slice 2 list | no |
| `src/ui/portal/PixelLookPicker.tsx` (lines 14-19, 21-22, 47-73, 99-122) | Remove `PREVIEWS` and the four-preview block; hold `view` state (`useState<AvatarView>("front")`, add `"use client"`); render `LookStage`; swatch class to 44 px target (`min-h-11 min-w-11`, 32 px colour box `h-8 w-8`) with `Icon name="check"` overlay on checked (`has-[:checked]` / render from `p.draft[key] === item.value`); hairstyle group rendered as card grid (`grid grid-cols-3`), each card a label with `LookPreview` (`{...p.draft, style: n}`, front, 1×) + `styleName`; no atlas / atlasFailed: text only | All three scope bullets | no |
| `src/ui/copy/portal.ts` (lines 123-142, `character`) | Add `stageLabel: "A little you"`, `viewToggleLabel: "Character view"`, `stylePreviewLabel: (n) => ...`; keep existing keys | UI copy rule D36 | no |
| `src/ui/portal/LookStage.test.tsx` | New render tests | AC 1, 4 | no |
| `src/ui/portal/PixelLookPicker.test.tsx` | Update: the "four canvases" test becomes stage canvases (4×, 1×, 2×) + 3 hairstyle canvases; add card and selected-state tests | AC 2-4 | no |

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `LookStage.test.tsx › front view: large 4x canvas, corner 1x and 2x, Front chip aria-checked` | AC 1 |
| `LookStage.test.tsx › back view: labels use "Back"; Back chip aria-checked, Front not` | toggle state |
| `LookStage.test.tsx › atlasFailed: no canvas, previewUnavailable shown, toggle still present` | fallback |
| `LookStage.test.tsx › atlas null (loading): aria-busy placeholders, no canvas` | loading edge |
| `PixelLookPicker.test.tsx › hairstyle cards: 3 radios, each card has a canvas with atlas` | AC 2 |
| `PixelLookPicker.test.tsx › hairstyle cards without atlas: text names only, no canvas` | AC 2 fallback |
| `PixelLookPicker.test.tsx › selected swatch shows check icon; unselected do not; exactly 4 checks` | AC 3 |
| `PixelLookPicker.test.tsx › swatch and card labels carry min 44 px classes` | AC 3 |
| Existing picker tests (radio count, fieldsets, reset, aria-busy, disabled) stay green; "four canvases" test rewritten | regression |

## Approach
1. Widen `LookPreview` scale to 4.
2. Add copy keys; build `LookStage` using existing `FilterChips` and current tokens on `main` (`bg-surface-container`, `border-outline-variant`, `text-on-surface-variant`, `primary`); dots via inline `backgroundImage: radial-gradient(...)` with a token colour (no new tokens).
3. In `PixelLookPicker`, keep the radio inputs (`sr-only`, same names/values/aria-labels, so a11y and the existing tests hold); restyle labels only. Check mark is an `Icon` next to the input, so state is not colour alone. Radios keep `disabled={locked}`.
4. Hairstyle cards: label + 1× front `LookPreview` using draft with `style: n`; the radio's accessible name stays the text (`Style n`), the canvas gets `aria-hidden`-style decorative handling by passing a label equal to the style name only if needed (avoid duplicate `role="img"` noise; prefer an optional `decorative` prop on `LookPreview`, a small addition in the same file).
5. Run `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
Rules: R1 (ui imports lib/ui only), R4 (no files outside list), R5 (tests). No new copy outside `src/ui/copy`.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- Name tag under the figure (mockup shows "Ming") is not in the ticket scope or acceptance criteria; omitted. A follow-up can add it (needs the draft name passed from `ProfileTab.tsx`).
- Hairstyle names stay "Style 1/2/3" (mockup's Classic/Side sweep/Long is SIM-066 Q-B, default kept).
- View state is local to the picker (not persisted, not part of dirty/save state).
- Corner previews show the currently selected view at 1× and 2× (Q-A default); the toggle reaches front and back at both sizes.
- Hotspot / overlap: SIM-071 (restyle to Simap design tokens, IN_PROGRESS in slices on main) may restyle `src/ui/Chip.tsx`, `src/styles/tokens.css`, `src/ui/portal/PixelLookPicker.tsx` and the swatch/surface classes. Use current tokens on main; expect a rebase and class-name conflicts in `PixelLookPicker.tsx`. This ticket does not edit `Chip.tsx` or `tokens.css`.
- Size: about 200 product lines plus tests, within one cycle.

## Blocking questions
None.

## Split proposal
None.
