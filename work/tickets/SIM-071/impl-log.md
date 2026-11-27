## Attempt 1 — 2026-11-27 (SLICE 1 of 7: tokens foundation)

Plan approved with defaults Q1–Q17. Slices 2–7 not started.

### Files touched
| File | Required because |
|---|---|
| `src/styles/tokens.css` | new: all brief tokens (light), derived tokens (Q1, Q6, Q11), dark values; `@theme static` for utilities, `:root` for non-utility tokens and shadows |
| `src/app/globals.css` | imports tokens.css; old token names re-pointed to the new tokens (compat layer); DM Sans family; `.text-h2` 32/40; focus ring 2px `--color-focus`; reduced motion `animation/transition: none`; durations; `@utility shadow-card/dialog/pixel`; `--container-*`, `--spacing-control/sidebar` aliases |
| `src/app/layout.tsx` | Manrope -> DM_Sans (`--font-dm-sans`) |
| `src/lib/color/contrast.ts` (+ test) | pure WCAG helpers for the AA tests, no new package |
| `src/lib/color/tokens.test.ts` | token presence/once, dark coverage, AA pairs both themes, focus/border 3:1, focus rule, reduced motion, `@theme inline` collision guard |
| `src/lib/breakpoints.ts` (+ test) | one source for JS media queries (md 800, lg 1024, xl 1280); test pins them to tokens.css |
| `src/ui/auth/SignInScene.tsx`, `SmallWorld.tsx`, `src/ui/roomlayout/LayoutEditorPage.tsx` | use `MEDIA.*` (SignInScene 768 -> 800 to match `md:`) |

### Tests added / changed
- `src/lib/color/contrast.test.ts` (parseHex/isOpaque, contrast formula, Q1 numbers, mixSrgb)
- `src/lib/color/tokens.test.ts` (all plan rows; 9 tests)
- `src/lib/breakpoints.test.ts`
- No existing test changed.

### Checks (actual output summary)
- format:check: pass (oxfmt run on changed files)
- typecheck: pass (after the layout.tsx fix below)
- check:layers: `1009 files, no violations`
- test: `386 passed | 1 skipped (387) files; 3779 passed | 7 skipped` (full run before the layout fix; layout.tsx has no tests; the 3 color/breakpoint files re-run green, 14 tests)
- build: pass. Built CSS: `.bg-canvas{background-color:var(--color-canvas)}`, `[data-theme=dark]` overrides colours, `.shadow-card{box-shadow:var(--shadow-card)}`, `--breakpoint-md:800px`, no "manrope". `@theme static` is supported.
- `git diff main -- package.json pnpm-lock.yaml`: empty.

### Deviations from the plan
- `--color-border-strong` is `#889282` (plan `#8A9484`): the plan value measured 2.998:1 on canvas, below 3:1; the test caught it.
- DM Sans: `next/font` types reject the `vietnamese` subset, so `subsets: ["latin", "latin-ext"]` (plan Approach 3 / Q9 fallback). Ming checks "Nguyễn Thị Ngọc Ánh" after the slice.

### Canvas motion check
`rg "requestAnimationFrame|setInterval" src/ui`: only `WalkLayer.tsx` (already gated by reduced motion via `useWalks`/`idleOn`) and `EditorCanvas.tsx:199` (one-shot paint). No code change.

### Visible differences (slice 1)
Font Manrope -> DM Sans; canvas #F6F6F5 -> #F8F9FB; ink #1C1C1C -> #272931; secondary text #6B6B6B -> #475569; borders -> #E1E4DE / #E8ECE0; "warn" blue -> amber #855C15; errors #DC2626 -> #B44C46; focus ring black+orange halo -> green 2px; dark theme neutral greys -> blue-grey; `font-mono` users become real monospace; `.text-h2` headings 30 -> 32px; `md:` layouts switch at 800 not 768 (Button, AuthLayout, SignInScene, DeviceTable, IncomingTransfers, OverdueBanner, PendingExtensions, PendingReturns); orange accents #FB5729 -> #ED5B35; reduced motion removes skeleton pulse and dialog pop entirely. Buttons stay near-black until slice 3. Contrast: all pairs in the plan table are asserted >= 4.5 (text) / 3 (non-text) in both themes by `tokens.test.ts`.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `--accent-shadow` and `--field-focus` still derive from `--accent-orange`; removal belongs to slices 3/7.

### Scope self-check
- Could the diff be smaller? No; mostly declarative tokens and tests.
- Diff size: see commit.

## Slice 2 — Token guard (attempt 1)

### Files touched
- `scripts/check-tokens.mjs` (new): rules table, `findViolations`, `isScanned`, `isAllowed`, `ALLOWLIST`, `compareToPending`, `scanRepo`, CLI (`--list`). Required because: the guard.
- `scripts/check-tokens.test.ts` (new): rule, allowlist, pending, ratchet, repo and CLI tests (15 tests). Required because: R5, AC 1b.
- `scripts/check-tokens.pending.json` (new): generated with `node scripts/check-tokens.mjs --list`: 65 files, 373 violations in total. Required because: ratchet.
- No `package.json`, `CLAUDE.md`, loop.config or `src/` change; the test runs inside `pnpm test`.

### Rules
hex, color-fn, shadow-arb, rounded-arb, font-arb, text-arb, ease-arb, duration-arb, arbitrary-px, spacing-scale (allowed steps 0,1,2,3,4,5,6,8,12 and px), css-radius, css-shadow, css-font-size, css-font-family; patterns as in the plan, comments stripped first.
Permanent allowlist: `src/styles/tokens.css` (defines token values), `src/lib/sprites/**` (pixel-art data), `src/ui/roomlayout/paint.ts` (canvas art colours), `src/ui/portal/photo-canvas.ts` (canvas photo colours), `src/ui/groups/group-form.ts` (default group colour is user data).

### Deviation
- The plan's `hex` regex required a digit, which contradicts its own test list (`#fff`, `#FFFF` must flag; `#bad` must not) and missed `"#ffffff"` in Avatar.tsx. Used: 6 or 8 hex digits always; 3 or 4 digits need a digit or one repeated letter (`#fff`, `#FFFF`). `href="#bad"` and `&#123;` still pass.

### Pending list (file: count)
Largest: `src/app/globals.css` 69, `AppShellView.tsx` 32, `EntityFormDialog.tsx` 28, `Chip.tsx` 16, `Button.tsx` 12, `MapItemEditor.tsx` 11, `SeatOverlay.tsx` 10, `SeatsView.tsx` 10, `SeatDetailPanel.tsx` 9, `MapItemEditorDetails.tsx` 8. `Avatar.tsx` 1 (`"#ffffff"`, Q-S2-2). The other 55 files have 1 to 7 each; full table = `scripts/check-tokens.pending.json`. Spot-checked: Chip.tsx and Button.tsx (arbitrary hits consistent with rg), SeatOverlay.tsx (rgba tooltip, lines 20/165/166), Avatar.tsx:33; no allowlisted file is listed (test enforces).

### Mutation check
`bg-[#fff]` appended to non-pending `src/ui/AppShell.tsx` and `p-7` to pending `src/ui/Chip.tsx`: the repo test failed for both ("now 1, pending 0", "now 17, pending 16"); reverted (git status clean of src changes).

### Known gaps (not fixed, R4)
Inline style numbers (`borderRadius: 12`), non-hex/rgb/hsl style strings, `font-bold/extrabold` weights (slice sweeps, Q7).

### Checks
- format:check: pass (`All matched files use the correct format`)
- typecheck: pass
- check:layers: `1009 files, no violations`
- test: `387 passed | 1 skipped (388) files; 3794 passed | 7 skipped (3801)`
- build: pass

### Out-of-plan files
None. Follow-ups: none.

### Scope self-check
Only the four planned files; no `src/` edits.
