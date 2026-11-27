## Findings

**Current state (read from src/app/globals.css, AppShellView.tsx)**
- Tokens are MD3-style, defined in `globals.css`. Dark is `[data-theme="dark"]` and neutral grey. `--aw-*` sign-in tokens (pale cream and green) and `--px-*` tokens (teal and orange) are also in that file. The `@theme inline` block maps `--color-*`, `--font-manrope`, and `--radius-md3*` (10/12/16/20 px).
- The existing `--primary` is near-black `#1c1c1c`. It is also the focus ring colour. The primary button is therefore dark, and orange `#fb5729` is only an accent. The brief makes coral the primary fill, so every `bg-primary` / `text-primary` use needs reviewing, not just re-pointing.
- `--status-warn` is blue `#4fb0e5`. It must be remapped to `--color-warning`. Status dots are 8px and always have labels in the markup, which is OK.
- The shell uses `lg:` (1024px). Today's rail is `lg:w-[88px]` with a bottom tab bar below 1024. The brief's sidebar is 216px from 800px.
- `md:` is used in only about 13 places (9 files). `lg:` is used in about 70 places. Files using `md:`:
  - `Button.tsx`
  - `AuthLayout.tsx`
  - `SignInScene.tsx`
  - `DeviceTable.tsx`
  - `IncomingTransfers.tsx`
  - `OverdueBanner.tsx`
  - `PendingExtensions.tsx`
  - `PendingReturns.tsx`
  - `MyDevicesTable.test.tsx`
- `globals.css` has hard-coded `@media (max-width: 639px)` and `min-width: 1280px`. The 1280 one is the SmallWorld grid.
- Reduced motion today only shortens animation durations to 0.001ms. It does not stop canvas or JS-driven walkers. The `.aw-walker`, SmallWorld and SignInScene canvases need a JS `matchMedia` check.
- Magic values in `globals.css` and components to remove:
  - radii: 8, 10, 6, 50%
  - shadows: `.px-frame`, `.aw-frame`, `.aw-note`, `.aw-room`
  - sizes: 13px, 14px, 18px, 30/48px clamp, 80px hero
  - durations: .18s, .14s, .3s
  - the `shadow-[0_4px_12px_var(--accent-shadow)]` in the shell
  - the `min-h-[68px]` and `text-[13px]` seen in the shell
- Pixel art and sprites keep their own palette (`px-*` art colours, `aw-room`), per the ticket.

**Pixel-library question (OQ1)**
- Where the pixel style appears today: sign-in `AuthLayout`/`SmallWorld` (`.aw-card [data-variant=filled]`, green `--aw-accent`), `CheckinPopup`/`CheckinButton`, and the `.px-card` filled button (orange `#c2410c` with `0 4px 0` ledge). MapItemsView and LayoutEditorPage have no `px-*` markup today, so making them pixel green is a new visual change, not a re-point.
- The brief says green is "pixel/library features" and `--shadow-pixel` is the "game-like primary button". D52 limits pixel style to end-user surfaces.

**Contrast checks (computed from the hex values, WCAG relative luminance)**

| Pair | Ratio | Result |
|---|---|---|
| White on coral `#ED5B35` | 3.4 | FAIL for 14px/16px text. Needs 4.5. Passes only as large text (24px, or 18.66px bold) |
| White on hover `#D94B26` | 4.2 | FAIL |
| White on pixel green `#4D6540` | 6.5 | pass |
| White on pixel hover `#3E5532` | about 8 | pass |
| Success `#326646` on white | 6.7 | pass |
| Warning `#855C15` on white | 5.9 | pass |
| Warning `#855C15` on canvas | about 5.6 | pass |
| Danger `#B44C46` on white | 5.2 | pass |
| Danger `#B44C46` on canvas | about 4.9 | pass |
| Danger `#B44C46` on a 10% tinted badge | about 4.5 | marginal |
| Info `#45648F` on white | 6.1 | pass |
| Secondary text `#475569` on white or canvas | about 7.5 | pass |
| Pixel text `#354235` on cream | about 11 | pass |
| Focus `#7A915C` on white | 3.5 | pass (3:1 non-text) |
| Focus `#7A915C` on canvas | about 3.3 | pass |
| Focus `#7A915C` on cream or tile | about 3.1 | marginal |
| Border `#E1E4DE` on white | about 1.3 | FAIL as a control boundary (1.4.11 asks for 3:1) |

- Warning `#855C15` is fine as text. Nothing to change.

**Derived dark palette (proposed). Backgrounds: canvas `#14161C`, surface `#1C1F27`. Ratios were computed against surface.**
- `--color-canvas` `#14161C`
- `--color-surface` `#1C1F27`
- `--color-cream` `#15170F` (keeps today's `--aw-bg`)
- `--color-tile` `#23271C`
- `--color-text-primary` `#ECEEF2` (about 14)
- `--color-text-secondary` `#A9B2C0` (about 7.7)
- `--color-text-pixel` `#DDE5D8` (on cream, about 13)
- `--color-border` `#3A3F4A` (decorative, 1.6)
- `--color-divider` `#2A2E37`
- `--color-focus` `#A8C48A` (about 8 on surface)
- `--color-success` `#7FD39B` (about 9)
- `--color-warning` `#E5B456` (about 8.7)
- `--color-danger` `#F08A84` (about 6.8)
- `--color-info` `#8DB0E3` (about 7.4)
- Fills: `--color-pixel-primary` `#5E7A4E` (white on it 4.8, hover `#4D6540`). Workspace fill as in recommendation 1 below.
- Room map: `--color-room-floor` `#3A3226`, `--color-room-green` `#2A3222`. These are only chrome backdrops. The sprite palette is unchanged. Please check them on screen.
- `--shadow-card` becomes `0 4px 20px #00000066`. `--shadow-dialog` is `0 24px 100px #000000a0`. `--shadow-pixel` is `0 4px 0 #0f1a0c`.
- Light tinted badge backgrounds should be derived with `color-mix(in srgb, var(--color-x) 12%, var(--color-surface))`. That needs no extra hex, and the dark ones follow automatically. Verify that each badge text colour reaches 4.5 on that mix. Danger is the marginal one.

**Targets, focus and type**
- Existing nav items are `min-h-11` (44px), which is OK. Many `h-8`/`h-9` buttons, icon buttons, checkboxes and radios, table row actions and chips will fall under 44px. This is the main L-size work item. `Button.tsx` and the input primitives should get `min-h-[--size-control-min]` once.
- For the global focus ring, replace the current `--primary` outline and `--focus-ring` shadow with `outline: 2px solid var(--color-focus); outline-offset: 2px`. The `.px-card` 3px outline override should use the same token.
- Focus ring on canvas, cream and tile is about 3.1 to 3.3 against 3:1, which is thin. Consider a double ring (focus plus a surface-coloured inner gap) if a manual check shows poor visibility.
- Type snapping: 13px (`aw-header`, shell `text-[13px]`) becomes 12 (caption) or 14. 80px `--text-hero` becomes 46/52 (Hero). `.aw-headline` clamp 30–48 becomes 32 mobile and 46 desktop. `.text-h2` 30 becomes 24/32 Title or 32/40 Display. Each of these is a visible change to list in the changelog.

## Recommendations

1. **Coral and white.** Ming's `#ED5B35` and `#D94B26` fail AA with white 14px labels (3.4 and 4.2). Keep the brief tokens `--color-workspace-primary` and `--color-workspace-hover` for non-text uses (icons, accent borders, large Display text). Add `--color-workspace-action` `#D3441F` (white 4.55) and hover `#B93B19` (white 5.7) for filled buttons and white text. This is a deviation from the brief, and Ming must approve it at the plan gate. Fallback if he refuses: label at 18.66px bold or larger, which breaks the 14px Label spec. Use the same action pair in dark.
2. **Pixel library (default for OQ1).** Pixel green `--color-pixel-primary`, `--shadow-pixel`, `--radius-0` and square edges apply to:
   - the `.px-card` / `.aw-card` filled buttons on sign-in and the other `AuthLayout` screens
   - `CheckinButton` and `CheckinPopup`
   - the Map items library page (`MapItemsView`)
   - the layout editor's item palette
   - the character picker, if it exists (grep found no such component; confirm it exists)

   Everything else uses coral. This includes the room list, device list, approvals, dashboard, admin, search, audit and the shell. Note that Map items and layout editor palettes get a new green look, so list that in the changelog. Use `--color-text-pixel` on cream surfaces. The sign-in surface is cream (`--aw-bg`).
3. **Tokens and file layout.** `src/styles/tokens.css` is imported once in `layout.tsx`. It holds `:root` light values and `[data-theme="dark"]` dark values. `globals.css` keeps `@theme inline` pointing to those variables, with the `--breakpoint-md: 800px` addition. Keep short aliases (`--primary` and friends) only for a staged migration, and remove them in the last PR. Delete `--aw-*` by mapping them as follows:
   - `--aw-bg` → cream
   - `--aw-ink` → text-pixel
   - `--aw-muted` → text-secondary
   - `--aw-line` → divider
   - `--aw-strip` → tile
   - `--aw-accent` → pixel-primary
   - Note that the `--px-*` art colours are the pixel art's own palette and stay.
4. **Breakpoints (OQ2).** Set `--breakpoint-md: 800px` in `@theme`. The only affected `md:` users are the 9 files above, which move from 768 to 800. This affects `Button`, `AuthLayout`, `SignInScene`, `DeviceTable`, `IncomingTransfers`, `OverdueBanner`, `PendingExtensions` and `PendingReturns`. All of them are to be re-checked at 768–799px. In `AppShellView`, change the shell's `lg:` to `md:` (sidebar at 800, bottom bar below), and `lg:w-[88px]` to `md:w-(--size-sidebar)` (216px). 216px is wider than 88px, so the nav item needs a label next to the icon (today it is stacked icon over label at 64px wide). That changes `AppShellView.test.tsx` markup only. Content width shrinks by 128px at 800–1023px, so check tables there at 800px. Leave other `lg:` and `xl:` uses alone.
5. **Dark values (OQ3).** Submit the palette above for Ming to approve. Verify the ratios with a script as part of the grep test, then include the pair table in `impl-log.md`.
6. **Input and checkbox borders.** Add `--color-border-strong`: light `#8A9484` (about 3.1 on white), dark `#6B7383` (about 3.5). Use it for input, select, checkbox and radio borders so 1.4.11 passes. Keep `--color-border` (`#E1E4DE`) for cards, as the brief says. This is another small deviation for Ming to approve. Selected state must be filled indicator plus border or background change.
7. **Fonts.** Use `next/font/google` for DM Sans with `variable: "--font-dm-sans"`, subsets `["latin","latin-ext","vietnamese"]`. Check that this covers Vietnamese, because the current font comment says Manrope covers it. Set `--font-family-sans` to `var(--font-dm-sans), sans-serif`. Fraunces stays for `.aw-serif` only. The brief's `"DM Sans", sans-serif` stack must be changed to the `next/font` variable.
8. **Reduced motion.** The brief's `.animated-character { animation:none }` is not enough. Add a `usePrefersReducedMotion` hook in `src/ui/`. The SmallWorld, SignInScene and walker code should stop the requestAnimationFrame loop and render one frame. Also keep the global CSS rule, and keep the `.aw-note` rotate transform (static, fine). Add a unit test that mocks `matchMedia`.
9. **Slicing (D87).**
   - PR1: `tokens.css`, `@theme`, DM Sans, global focus ring, reduced motion, grep script.
   - PR2: UI kit (Button, inputs, cards, dialogs, badges, 44px).
   - PR3: shell and sidebar, plus the management screens (devices, members, approvals, dashboard, search, audit, admin).
   - PR4: pixel surfaces (sign-in, check-in, map items, layout editor).
   - PR5: audit, removing alias tokens, the changelog.
   - PRs 1 to 4 must keep CI and tests green and the app visually consistent.
10. **Grep guard.** Add `scripts/check-tokens.ts` (or a Vitest test) that fails on `#[0-9a-f]{3,8}` and `rounded-\[`, `shadow-\[`, `font-\[` and `\d+px` in `src/ui/**`, `src/app/**/*.tsx`. Allowed files are `tokens.css`, sprite and canvas drawing code, and the `px-*` art rules. List an explicit allowlist and wire it into `Checks` in `.claude/loop.config.md` and CLAUDE.md. A canvas code allowlist is needed because sprite palettes will legitimately contain hex values.

## Risks

- A white-on-coral fail is certain for the brief's literal hex values, so a wrong default gets PASS-blocked at review under R5 and the ticket's own AC. Resolve with Ming at the gate.
- Changing `md` to 800px shifts 8 files' layout between 768 and 799px. A wider sidebar (216px vs 88px) shrinks content from 800 to about 1000px. Tables may overflow.
- The pixel button style is `border-radius: 0` with a thick border and `0 4px 0` ledge. The brief's 44px min-height and `--radius-lg` conflict with `.px-card` square styling. Keep the square edges (brief: "Pixel artwork and sprites keep square edges") and apply the ledge via `--shadow-pixel`.
- A primary-button colour swap (black to coral) is a large visible change on every screen. List it first in the changelog.
- `--shadow-card: 0 4px 20px #53613e08` has about 3% alpha (`08`), so it is nearly invisible. The brief makes it the card boundary, so cards on a white canvas may look flat. Cards (surface `#FFFFFF`) on canvas `#F8F9FB` are about 1.06:1. The border/divider help. This is the brief's design intent, but note it in the changelog.
- Canvas and rAF animations (SmallWorld) are not covered by the brief's CSS rule. See recommendation 8.
- Tests: `AppShellView.test.tsx`, `SmallWorld.test.tsx`, `CheckinView.test.tsx` and `MyDevices*.test.tsx` match classes and markup. Expect small updates, which the ticket allows.

## Open questions

1. Does Ming accept the darker workspace action fill `#D3441F` (hover `#B93B19`) so white labels reach AA 4.5, keeping the brief's coral for non-text? Default: yes.
2. Does Ming accept `--color-border-strong` for form controls (3:1 requirement)? Default: yes.
3. Pixel green scope per recommendation 2. Default: sign-in and `AuthLayout` screens, check-in, Map items library, layout editor palette, character picker (if it exists). Note: map items and layout editor are not pixel-styled today.
4. Sidebar: 216px from 800px replaces the 88px rail at 1024 and the bottom bar below 800. Default: yes, with icon plus label in a row. Does Ming want it collapsible? Default: no, out of scope.
5. Dark values: approve the palette above. Dark room-map backdrop colours need a visual check.
6. Hero 46px replaces the 80px `--text-hero` and the 48px headline. Is that acceptable? Default: yes (the brief says so).
7. Is a Vietnamese subset needed for DM Sans? Default: yes, as copy may include Vietnamese names.

Relevant files:
- /home/user/simap/src/app/globals.css
- /home/user/simap/src/ui/AppShellView.tsx
- /home/user/simap/src/ui/Button.tsx
- /home/user/simap/src/ui/auth/AuthLayout.tsx
- /home/user/simap/src/ui/auth/SmallWorld.tsx
- /home/user/simap/src/ui/checkin/CheckinButton.tsx
- /home/user/simap/work/tickets/SIM-071/ticket.md
- /home/user/simap/work/tickets/SIM-071/brief.md

I could not read D87, D52, D85 and D46 in `work/decisions.md` in full. The grep output omitted their long lines, so I relied on the ticket's summaries of them.
