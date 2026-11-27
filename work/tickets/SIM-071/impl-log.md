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

## Slice 3 (attempt 1) — UI kit

### Files touched
Kit (per plan Files table): `src/ui/{Button,Chip,Card,SectionCard,FilledInput,EntityFormDialog,RoleBadge,SegmentedFilter,TabBar,FormFooterBar,PageHeader,PageSkeleton,Avatar}.tsx`, `src/ui/auth/fields.tsx`, `src/ui/dashboard/StatTile.tsx`, `src/app/globals.css` (`.state-layer:not(:disabled)`, `.field-box` focus rules, checkbox/radio accent-color, `.status-dot` removed, scrollbar tokens), `src/app/dev/shell/KitGallery.tsx` + `src/ui/copy/gallery.ts` (pixel button, six pills, checkbox, SegmentedFilter), `scripts/check-tokens.pending.json`.
Tests: `kit.test.tsx`, `layout-blocks.test.tsx`, `SegmentedFilter.test.tsx`, `Avatar.test.tsx`, `portal/MyRequestRow.test.tsx`, `lib/color/tokens.test.ts`.
Defaults used for Q-S3-1..5.

### Out-of-plan files
`src/ui/requests/DecisionDialog.test.tsx:76`: asserted attribute order `<button type="submit" disabled`; the kit Button now emits `class`/`data-variant` between, so the regex became `/<button type="submit"[^>]*disabled/`. Assertion intent unchanged (plan allows tests asserting changed kit markup).

### Rename map (old -> new)
`bg-primary text-on-primary` (filled) -> `bg-workspace-action text-on-action` (hover `enabled:hover:bg-workspace-action-hover`); `text-on-surface` -> `text-text-primary`; `text-on-surface-variant` -> `text-text-secondary`; `border-outline-variant` -> `border-divider` (cards, dividers) / `border-border` (controls); `border-outline` -> `border-border-strong`; `bg-surface-high|low` -> `bg-canvas|bg-surface`; `rounded-md3(-lg)` -> `rounded-lg|rounded-xl`; `rounded-full` buttons -> `rounded-lg`; `*-container` pills -> `bg-{success,warning,danger,info}-tint text-{...}`; `text-error` -> `text-danger`; `font-extrabold|bold` -> `font-semibold|font-medium`; `text-[13px]|text-sm` -> `text-label`, `text-[11px]|text-xs` -> `text-caption`; `min-h-11|min-h-[44px]` -> `min-h-control`; `focus-within:*` field glow -> `.field-box`.

### Pending before -> after
373 -> 293. Removed keys (11): Avatar 1, Button 12, Card 3, Chip 16, EntityFormDialog 28, FilledInput 4, RoleBadge 6, SectionCard 1, SegmentedFilter 2, auth/fields 1, StatTile 2. `globals.css` 69 -> 65. Regenerated with `node scripts/check-tokens.mjs --list`; diff confirmed only these changes. `node scripts/check-tokens.mjs` exits 0.

### Built-CSS confirmations
Tailwind accepts `duration-(--duration-ui)` (emitted `transition-duration:var(--duration-ui)`); preflight `font:inherit` present, so `font-[inherit]` was safely dropped; `.field-box` in the built CSS.

### Visible differences
- Filled buttons, selected FilterChip, dialog Save, Tab "You" pill: ink -> coral action #D3441F (hover #B93B19), white text. Sign-in/check-in buttons keep their colour (`.aw-card`/`.px-card` overrides until slice 6) but get 14 px labels and 44/48 px height.
- Buttons/IconButtons: pill -> 8 px corners; `sm` 36 -> 44 px tall (row actions grow ~8 px); labels 13/15 -> 14 px; weight 700 -> 500; disabled opacity 40 -> 50 % with not-allowed cursor and no hover/state layer.
- Secondary border divider -> border, hover border-strong; danger button on danger-tint.
- FilterChips: 8 px track, 6 px chips, 44 px tall. SegmentedFilter: bordered canvas track, selected = border + surface + card shadow, 44 px.
- Cards 16 -> 12 px radius; hover darkens border instead of a larger shadow.
- Dialogs 20 -> 16 px, surface background, dialog shadow, title 18 px/600, width 448 px, captions 14 px sentence case, strong field borders, green 2 px focus ring on the field box (no glow); footer uses kit Buttons.
- Role badges 12 px/500, 4 px radius, Manager info-blue tint, Admin solid ink. Pills 12 px, neutral on canvas, new `info` tone.
- PageHeader 18 px/600; section card titles 600; stat values 24 px Title, labels 14 px; auth labels 14 px ink, errors 12 px danger, notices 8 px radius.
- Tabs: underline coral (workspace-primary), active label ink 600. Scrollbar thumb uses border tokens. Checkbox/radio fill with the action colour.
- Interim: hand-rolled `bg-primary` buttons outside the kit stay ink (InvitePeople, AppShellView skip link, SeatOverlay tag).

### Checks
- format:check: `All matched files use the correct format`
- typecheck: pass
- check:layers: `1009 files, no violations`
- test: `387 passed | 1 skipped (388) files; 3809 passed | 7 skipped (3816)`
- build: pass

### Scope self-check
Only the planned files plus the one test noted above. Follow-ups: none.
