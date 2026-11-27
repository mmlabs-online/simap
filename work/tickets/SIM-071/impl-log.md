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
