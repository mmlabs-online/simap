Status: READY (Gate: plan-approval. Ming answers the plan-gate questions Q1–Q17 below or accepts the defaults; slice 1 is written against the defaults.)

# Plan — SIM-071: Restyle the whole app to the Simap design tokens

## Scope summary
- D87 (work/decisions.md:94): "The whole app is restyled to the Simap design tokens (SIM-071, brief in
  `work/tickets/SIM-071/brief.md`): one `src/styles/tokens.css` mapped in Tailwind `@theme`; workspace coral for main
  actions, pixel green for pixel/library features; DM Sans replaces Manrope (Fraunces kept for the sign-in headline);
  dark mode kept with derived token values; no feature, route, data or copy change. Amends D46 (UI shell colours) and
  the D85 sign-in palette where they conflict."
- brief.md Rules 1–7 (lines 13–20), Tokens (lines 22–123), Component mapping (lines 125–136), Deliverables
  (lines 142–146).
- D52 (decisions.md:59): pixel/game style only on end-user surfaces; management screens and "the layout editor's
  chrome" use the clean UI kit. D85 (decisions.md:92): Fraunces italic, self-hosted via `next/font`, CSP unchanged.
- Ticket: "one ticket (planner slices)", "keep dark mode with derived values", "DM Sans everywhere, keep Fraunces for
  the sign-in headline" (ticket.md:82–83); Technical notes 1–3 (ticket.md:64–75).

Delivery (Ming, via orchestrator): one ticket, **7 ordered slices**, each a separate PR on this ticket with green
checks. Slice 1 is fully specified below; slices 2–7 are outlined in `## Split proposal` with their file lists and get
a short plan addendum (appended to this file) before each starts.

## Acceptance criteria → verification
Ticket ACs, with the slice that closes each. Slice-1 rows are verified on the slice-1 PR; the others on their slice.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `tokens.css` defines every brief token once (light) plus a dark value per colour token; `@theme` maps them | Slice 1: `src/lib/color/tokens.test.ts` › "defines every brief token exactly once" and "every colour token has a dark value"; `pnpm build` succeeds and `grep -c -- "--color-canvas" .next/static/css/*.css` ≥ 1 |
| 1b | No component file contains a hard-coded hex colour, px radius, box-shadow or font stack (grep check) | Slice 2 adds `scripts/check-tokens.test.ts` with a shrinking pending list; slice 7: pending list empty, test green |
| 2 | Workspace primary actions coral, pixel-library actions pixel green; secondary/disabled/inputs/cards/dialogs/badges per mapping | Slice 3 `src/ui/kit.test.tsx` (variant → token classes); slice 6 pixel surfaces render tests; KitGallery at `/dev/shell` in `pnpm dev` |
| 3 | Targets ≥44×44; body/control labels ≥14 px; metadata 12 px; status has text; focus ring visible | Slice 1: global focus rule test (tokens.test.ts › "focus ring uses --color-focus, 2px, offset"); slices 3–6: kit/screen render tests assert `min-h-control`/`min-w-control` and `text-label`/`text-caption`; slice 2 guard flags `text-[13px]` and other arbitrary sizes |
| 4 | Reduced motion disables every animation (CSS and canvas) | Slice 1: tokens.test.ts › "reduced-motion block sets animation and transition to none"; existing `src/lib/sprites/idle.test.ts:44` and `walk.test.ts:190` (canvas walkers already gated, see Approach 7) stay green |
| 5 | DM Sans is the app font; Fraunces only for the sign-in headline; no other new dependency | Slice 1: `rg -n "Manrope\|manrope" src` → no hits; `git diff main -- package.json pnpm-lock.yaml` empty; `layout.tsx` loads `DM_Sans` + `Fraunces` only |
| 6 | Light and dark text/background pairs pass WCAG AA | Slice 1: tokens.test.ts › "light pairs pass AA" and "dark pairs pass AA" (computed from tokens.css, pair list in the test) |
| 6b | Layout checked at 390/800/1024/1280; existing tests pass (markup/class updates only); changelog in impl-log.md | Each slice: `pnpm test` green, test diffs touch only class/markup assertions; `impl-log.md` has a "Visible differences" list per slice; viewport check → Ming verification |

## Ming verification after merge
- Each slice: open the app (light and dark) at 390 / 800 / 1024 / 1280 px, keyboard-tab through one screen, toggle
  OS reduced motion. Slice 1 specifically: font is DM Sans (also a Vietnamese member name such as "Nguyễn Thị Ngọc
  Ánh" renders without odd glyphs), page background is the new canvas, focus ring is green, sign-in vignette appears
  from 800 px (was 768).
- Slice 7: the brief's self-check list in `impl-log.md` matches what Ming sees.

## Files to create / modify (slice 1)
No file matches a High path in `loop.config.md` (checked: `layout.tsx`, `globals.css`, `src/styles/**`, `src/lib/**`
are not listed). Later slices' files are in `## Split proposal`.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/styles/tokens.css` | create: all brief tokens (light) + derived tokens (Q1, Q6, Q11), dark values under `[data-theme="dark"]` | brief Rule 1, AC 1 | no |
| `src/app/globals.css` | `@import "../styles/tokens.css"` after line 1; re-point old tokens (lines 11–102, 104–162) to new ones; drop colliding `@theme inline` keys (lines 188, 212–214) and add utility aliases; fonts (lines 234–250); `.text-h2` (257–260); focus rule (369–374); reduced motion (376–385); durations (239, 339, 354); `.px-card` focus outline (455–458); `@utility shadow-card/dialog/pixel` | token mapping, compat layer so no component edit is needed in slice 1 | no |
| `src/app/layout.tsx` | `Manrope` → `DM_Sans` (lines 3, 9–13, 30) | AC 5 | no |
| `src/lib/color/contrast.ts` | create: `parseHex`, `relativeLuminance`, `contrastRatio`, `mixSrgb` (pure, no deps) | AA check without a new package (rule 7) | no |
| `src/lib/color/contrast.test.ts` | create: unit tests for the above | R5 | no |
| `src/lib/color/tokens.test.ts` | create: reads `src/styles/tokens.css` and `src/app/globals.css`; token presence, dark coverage, AA pairs, focus and reduced-motion rules | AC 1, 3, 4, 6 | no |
| `src/lib/breakpoints.ts` | create: `MEDIA = { md: "(min-width: 800px)", lg: "(min-width: 1024px)", xl: "(min-width: 1280px)" }` | one source for JS media queries (brief Layout note) | no |
| `src/lib/breakpoints.test.ts` | create: values equal `--breakpoint-md/lg/xl` in tokens.css | drift guard | no |
| `src/ui/auth/SignInScene.tsx` | line 9: `WIDE = MEDIA.md` (768 → 800) so JS gate matches `md:block` at line 51 | md becomes 800 | no |
| `src/ui/auth/SmallWorld.tsx` | line 27: `WORLD_MEDIA = MEDIA.xl` (same string; `SmallWorld.test.tsx:123` stays green) | single source | no |
| `src/ui/roomlayout/LayoutEditorPage.tsx` | line 22: `DESKTOP = MEDIA.lg` (same string) | single source | no |
| `work/tickets/SIM-071/impl-log.md` | changelog + "Visible differences" for slice 1, contrast table copied from the test output | Deliverable 3 | no |

## Data model / migration
None.

## API contract
None.

## Tests to write (slice 1)
| Test (file › name) | Covers |
|---|---|
| `src/lib/color/contrast.test.ts` › parses #rgb, #rrggbb, #rrggbbaa (alpha ignored for opaque check, rejected by `isOpaque`) | parser edge cases |
| contrast.test.ts › white/black ratio is 21, same colour is 1, order-independent | WCAG formula |
| contrast.test.ts › known pairs: white on #ED5B35 ≈ 3.41, white on #D3441F ≥ 4.5, #272931 on #ED5B35 ≈ 4.25 | pins the Q1 numbers |
| contrast.test.ts › `mixSrgb("#B44C46", "#FFFFFF", 0.08)` matches CSS `color-mix(in srgb, …)` per channel (rounded) | tint derivation |
| `src/lib/color/tokens.test.ts` › defines every brief token exactly once (light) | AC 1; list of the brief's names hard-coded in the test |
| tokens.test.ts › every `--color-*` token has a value in `[data-theme="dark"]`, and dark defines nothing that light lacks | AC 1, dark coverage |
| tokens.test.ts › light pairs pass AA / dark pairs pass AA (pair table below; tints resolved with `mixSrgb` from the % parsed out of tokens.css) | AC 6 |
| tokens.test.ts › focus ring: globals.css `:focus-visible` rule uses `outline: 2px solid var(--color-focus)` and an offset; `--color-focus` ≥ 3:1 on canvas, surface, cream, tile in both themes | AC 3 (1.4.11) |
| tokens.test.ts › `--color-border-strong` ≥ 3:1 on surface and canvas in both themes | Q6 |
| tokens.test.ts › reduced-motion block in globals.css sets `animation: none` and `transition: none` | AC 4 |
| tokens.test.ts › globals.css `@theme inline` does not redefine any token defined in tokens.css | name-collision guard (consult-frontend Findings) |
| `src/lib/breakpoints.test.ts` › MEDIA md/lg/xl equal tokens.css `--breakpoint-*` | drift guard |

AA pair table asserted (both themes; text ≥ 4.5, non-text ≥ 3):
text-primary on canvas/surface; text-secondary on canvas/surface; text-pixel on cream/tile; on-action on
workspace-action, workspace-action-hover, pixel-primary, pixel-hover; success/warning/danger/info on surface, canvas
and on their own tint; focus on canvas/surface/cream/tile (3); border-strong on surface/canvas (3). Explicitly **not**
asserted and recorded as a non-text use only: on-action on the brief coral `--color-workspace-primary`/`-hover`
(Q1).

## Approach (slice 1)
1. **tokens.css layout** (R3 not affected; CSS only):
   - `@theme static { … }` with the brief's literal light values for the namespaces Tailwind turns into utilities:
     all `--color-*` (brief + derived), `--radius-sm…2xl/full`, `--breakpoint-md: 800px; --breakpoint-lg: 1024px;
     --breakpoint-xl: 1280px`, the type scale as `--text-caption: 12px; --text-caption--line-height: 20px;
     --text-caption--font-weight: 400` … through `--text-hero: 46px / 52px / 500`, `--font-sans:
     var(--font-family-sans)`, `--font-mono: var(--font-family-mono)`. Plain `@theme` (not `inline`) makes
     utilities read `var(--color-x)`, so the dark block can override them; `static` makes Tailwind emit every
     variable even if no utility uses it yet. Implementer verifies once in the built CSS that `bg-canvas` compiles to
     `var(--color-canvas)` and that `[data-theme=dark]` switches it; if `static` is not supported by the installed
     Tailwind (4.3.x), drop the keyword and record it.
   - Plain `:root { … }` for the non-utility tokens: `--font-family-sans: var(--font-dm-sans), sans-serif` (the
     brief's `"DM Sans"` literal would not match the `next/font` hashed family; see consult-frontend Findings),
     `--font-family-mono: ui-monospace, monospace`, `--space-1…12`, `--size-control-min: 44px`,
     `--size-sidebar: 216px`, `--width-content: 1320px`, `--width-library: 1600px`, `--duration-ui/step/arrival`,
     and the three shadows (`--shadow-card/dialog/pixel`). Shadows stay out of `@theme` because Tailwind v4 inlines
     shadow values into `--tw-shadow`, so a dark override would not reach a `shadow-card` utility; globals.css adds
     `@utility shadow-card { box-shadow: var(--shadow-card); }` (and dialog, pixel) instead.
   - `[data-theme="dark"] { … }`: dark value for every `--color-*` token and the three shadows (table in Q5).
   - Derived tokens (pending Q1, Q6, Q11): `--color-workspace-action: #D3441F`, `--color-workspace-action-hover:
     #B93B19`, `--color-on-action: #FFFFFF`, `--color-border-strong: #8A9484`, and tints
     `--color-success-tint: color-mix(in srgb, var(--color-success) 8%, var(--color-surface))` (same for warning,
     danger, info; 8 % because danger on a 12 % tint is about 4.4:1 and fails).
   - Tailwind's default spacing (`--spacing: 0.25rem`) already gives the 4 px base, so `--space-*` are CSS-only;
     `--radius-*` values equal Tailwind v4 defaults (sm 4, md 6, lg 8, xl 12, 2xl 16), so no existing `rounded-*`
     changes. `md` moves 768 → 800 (only `md:` users change, listed under Visible differences).
2. **globals.css mapping and compat layer** (no component edits in slice 1):
   - Line 1 stays `@import "tailwindcss";`, then `@import "../styles/tokens.css";`.
   - In the `@theme inline` block: delete `--color-surface` (line 188, now from tokens.css) and the three font lines
     (212–214); add `--font-heading: var(--font-family-sans)`; add `--container-content: var(--width-content)`,
     `--container-library: var(--width-library)`, `--spacing-control: var(--size-control-min)`,
     `--spacing-sidebar: var(--size-sidebar)` (gives `max-w-content`, `min-h-control`, `w-sidebar` for later slices).
     Keep every other old `--color-*` alias.
   - Re-point the old variables (light block; delete the matching lines in the dark block, since the new tokens
     already switch):

     | Old | New |
     |---|---|
     | `--background`, `--surface-container` | `var(--color-canvas)` |
     | `--surface`, `--surface-container-lowest`, `--surface-container-low`, `--inverse-on-surface`, `--on-primary` | `var(--color-surface)` |
     | `--on-background`, `--on-surface`, `--on-secondary-container`, `--inverse-surface`, `--primary` | `var(--color-text-primary)` |
     | `--on-surface-variant`, `--secondary` | `var(--color-text-secondary)` |
     | `--surface-container-high`, `--secondary-container` | `color-mix(in srgb, var(--color-text-primary) 5%, var(--color-surface))` |
     | `--surface-container-highest` | `color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface))` |
     | `--outline` | `var(--color-border)` · `--outline-variant` → `var(--color-divider)` |
     | `--accent-orange`, `--inverse-primary` | `var(--color-workspace-primary)` · `--accent-orange-soft` → `color-mix(in srgb, var(--color-workspace-primary) 10%, var(--color-surface))` |
     | `--primary-container` | `var(--color-workspace-action)` · `--on-primary-container`, `--on-accent` → `var(--color-on-action)` |
     | `--status-online` / `--status-warn` / `--status-alert` | `var(--color-success)` / `var(--color-warning)` / `var(--color-danger)` |
     | `--error`, `--on-error-container` | `var(--color-danger)` · `--error-container` → `var(--color-danger-tint)` |
     | `--success-container` / `--on-success-container` | `var(--color-success-tint)` / `var(--color-success)` (same for warning) |
     | `--tertiary`, `--on-tertiary-container` | `var(--color-info)` · `--tertiary-container` → `var(--color-info-tint)` |
     | `--card-shadow` | `var(--shadow-card)` |
     | `--focus-ring` | delete (only used by the focus rule, replaced) |

     `--primary` intentionally maps to the ink colour, not coral: today's `bg-primary` buttons are near-black and
     stay near-black (#272931 light, #ECEEF2 dark) in slice 1; coral arrives with the Button rework in slice 3, so
     `text-primary` keeps meaning "ink" (brief: `text-primary` resolves to the text colour). Left untouched until
     slices 3/6/7: `--scrim`, `--shadow`, `--shadow-strong`, `--grid-line`, `--card-shadow-hover`, `--field-focus`,
     `--radius-md3*`, `--ease-md3`, all `--px-*` and `--aw-*` (so `world-palette.test.ts` is unchanged).
   - Delete the old plain `--text-hero/--text-h2/--text-body/--text-small` (lines 97–101): an unlayered
     `--text-hero: 80px` would override the theme's 46 px. `.text-hero` class (unused in components) is deleted;
     `.text-h2` becomes `font-size: var(--text-display); line-height: var(--text-display--line-height)` (30 → 32 px,
     used by 17 page headings and `StatTile.tsx:13`; StatTile moves to `text-title` in slice 5).
   - `body`, `h1–h3`, `.font-heading`: `font-family: var(--font-family-sans)`; body transition
     `background-color var(--duration-ui) ease-out`; `.state-layer::after` and `dialog::backdrop` durations →
     `var(--duration-ui)`.
   - Focus (brief: "2px `--color-focus` with offset"): `outline: 2px solid var(--color-focus); outline-offset: 2px;`
     no box-shadow; `.px-card [data-variant="filled"]:focus-visible` uses `var(--color-focus)` (keeps its 3 px).
   - Reduced motion: replace the 0.001 ms rule with `animation: none !important; transition: none !important;
     scroll-behavior: auto !important;` on `*, *::before, *::after`. This subsumes the brief's
     `.animated-character { animation: none }` (no element uses that class).
3. **layout.tsx:** `DM_Sans({ subsets: ["latin", "latin-ext", "vietnamese"], variable: "--font-dm-sans", display:
   "swap" })` with no `weight` (variable font). If `pnpm typecheck` rejects `"vietnamese"` (the `next/font` subset
   type lists what Google ships), use `["latin", "latin-ext"]`, add a comment, and record it under Q9. Fraunces block
   unchanged. `next/font` self-hosts at build: no CSP change (D85).
4. **Breakpoints:** `src/lib/breakpoints.ts` (lib, pure) and the three one-line swaps (ui → lib via `@/`, R1 ok).
5. **Contrast helper** in `src/lib/color/` (pure lib, R1); the old local `lum/ratio` in `world-palette.test.ts` stays
   until slice 6 replaces that test.
6. **Changelog** in `impl-log.md`: files, "Visible differences (slice 1)": font Manrope → DM Sans; canvas #F6F6F5 →
   #F8F9FB; ink #1C1C1C → #272931; secondary text #6B6B6B → #475569; borders #DADADA/#ECECEC → #E1E4DE/#E8ECE0;
   status "warn" blue → amber #855C15; errors #DC2626 → #B44C46; focus ring black+orange halo → green 2 px; dark
   theme neutral greys → blue-grey; `font-mono` users (10 files: keys, coordinates) become real monospace; page
   headings 30 → 32 px; `md:` layouts switch at 800 instead of 768 (Button, AuthLayout, SignInScene, DeviceTable,
   IncomingTransfers, OverdueBanner, PendingExtensions, PendingReturns); orange accents #FB5729 → coral #ED5B35;
   reduced motion now removes skeleton pulse and dialog pop entirely.
7. **Canvas motion check (no code change expected):** room walkers already honour reduced motion
   (`RoomMap.tsx:96` → `useWalks.ts:40,46` skip walks; `idleOn` false when reduced, `idle.ts:23`); `SmallWorld` and
   `SignInScene` paint once with no loop. Implementer confirms with `rg -n "requestAnimationFrame|setInterval"
   src/ui` (only `WalkLayer.tsx` and `EditorCanvas.tsx:199`, a one-shot paint) and notes it in impl-log.
8. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (new lib files import nothing outside lib; ui imports `@/lib/breakpoints`); R3 (no env, no secrets);
R4 (only the files above); R5 (contrast/tokens/breakpoint tests). R2/R6/R7 not touched.

## Specialist input used
- consult-frontend-developer: adopted the compat-alias layer first (rec 2), `--font-family-sans: var(--font-dm-sans)`
  (Findings: Fonts), `--breakpoint-md: 800px` and the `md:` file list, the single breakpoints module (Findings: JS
  media queries), contrast and grep checks without packages, the allowlist idea for the grep guard (slice 2).
  Corrected: "dark text on coral ≈ 5.2:1" is wrong, it is ≈ 4.25:1 (fails); "Tailwind `rounded-sm` 2 → 4 px" is a v3
  default, v4's `--radius-sm` is already 4 px so no radius changes; `--primary` maps to ink, not coral, in slice 1
  (re-pointing to coral would silently recolour every `text-primary` use, 70 hits in 47 files). Rejected plain
  `@theme` for shadows (v4 inlines shadow values; dark would not apply) in favour of `@utility`.
- consult-ux-architect: adopted the darker action fill `#D3441F`/`#B93B19` (rec 1, as Q1 default),
  `--color-border-strong` (rec 6), the dark palette (Findings, Q5), `color-mix` tints (with 8 % instead of 10–12 %,
  since danger fails at 12 %), the pixel-green scope (rec 2) and the sidebar default (rec 4). Rejected a new
  `usePrefersReducedMotion` hook (rec 8): `useReducedMotion` already exists and every looping canvas already uses it
  (Approach 7). Moved the grep guard from PR1 to slice 2 to keep slice 1 reviewable.

## Assumptions
- Slice 1 is about 550 changed lines, most of it declarative token data and tests; accepted as one PR. Slices 2–7
  each target ≤ ~400 lines of hand edits (class-rename sweeps may be larger but mechanical; the implementer keeps a
  rename map in impl-log).
- Tailwind 4.3.x supports `@theme static`, `--text-*--font-weight` and `@utility`; verified in the build output in
  slice 1 (fallbacks in Approach 1).
- `--px-*` art colours, sprite/canvas code (`src/lib/sprites/**`, `src/ui/roomlayout/paint.ts`, `photo-canvas.ts`,
  `Avatar.tsx` art colours) and group colour data (`group-form.ts`) are pixel art or user data and stay exempt from
  the hex rule (ticket Out of scope). Slice 7 moves `--px-*` into a labelled "pixel art palette" section of
  tokens.css so every colour variable is still defined in that one file.
- Hotspots: SIM-070 (DONE, Map items page and Item editor) touched `src/ui/mapItems/**`; slice 6 edits the same
  files, so expect a rebase if SIM-070's PR merges later. SIM-063 (IN_PROGRESS, check-in provider adapter) is
  server/API work; if it adds check-in UI, slice 6 rebases on it. Every slice edits `src/app/globals.css` and
  later slices touch most of `src/ui/**`, so other UI tickets started during SIM-071 should expect rebases.
- The `dev/shell` KitGallery (`src/app/dev/shell/KitGallery.tsx`) is the manual check surface for the kit.

## Blocking questions
None blocking slice 1 (it uses the defaults below). The plan gate answers these.

## Plan-gate questions (Ming; default in bold is what the plan assumes)
1. **White on coral fails AA.** White on `#ED5B35` ≈ 3.4:1, on hover `#D94B26` ≈ 4.2:1; dark ink `#272931` on coral
   ≈ 4.25:1 also fails (14 px/500 labels need 4.5). Options: (a) **add `--color-workspace-action #D3441F` (white
   4.55:1) and hover `#B93B19` (5.7:1) for filled buttons and any white text; keep the brief coral for non-text
   (accent borders, active-nav indicator, icons, ≥24 px Display text)**; (b) keep brief coral and record an AA
   exception (fails ticket AC 6); (c) enlarge labels to 18.66 px bold (breaks the Label spec).
2. **Button radius pill → 8 px.** **Yes: every Button and IconButton uses `--radius-lg` 8 px (brief); chips
   `--radius-md` 6 px; badges `--radius-full` or `--radius-sm`; avatars stay round.** Visible on every screen.
3. **Sidebar.** **216 px sidebar from 800 px replaces the 88 px rail at ≥1024; icon and label in one row; the
   bottom tab bar stays below 800 px (its `min-h-[68px]` snaps to the control scale); not collapsible.** Content
   gets 128 px narrower at 800–1023 (room map, layout editor, tables re-checked in slice 4).
4. **Pixel-green scope.** **Pixel green (`--color-pixel-primary`, `Button variant="pixel"`, `--shadow-pixel`
   on game-style buttons) for: sign-in and every `AuthLayout` screen, check-in (`CheckinButton`, `CheckinPopup`),
   the Map items library and Item editor (`src/ui/mapItems/**`), the layout editor's item palette
   (`roomlayout/Palette.tsx`), and the pixel character picker (`portal/PixelLookPicker.tsx`). Everything else coral.**
   Note: Map items and the layout palette are not pixel-styled today, so they get a new green look; this is colour
   only (no pixel art in that chrome), consistent with D52.
5. **Dark palette (derived).** **Approve:** canvas `#14161C`, surface `#1C1F27`, cream `#15170F`, tile `#23271C`,
   text-primary `#ECEEF2`, text-secondary `#A9B2C0`, text-pixel `#DDE5D8`, border `#3A3F4A`, border-strong
   `#6B7383` (≈3.5:1 on surface), divider `#2A2E37`, focus `#A8C48A`, success `#7FD39B`, warning `#E5B456`, danger
   `#F08A84`, info `#8DB0E3`, workspace-primary/hover = light values, workspace-action/hover = light values (white
   text stays ≥ 4.5), pixel-primary `#5E7A4E` (white ≈ 4.8:1), pixel-hover `#4D6540`, on-action `#FFFFFF`,
   room-floor `#3A3226`, room-green `#2A3222`; shadows card `0 4px 20px #00000066`, dialog `0 24px 100px
   #000000A0`, pixel `0 4px 0 #0F1A0C`; tints 8 % of the dark feedback colour over dark surface. All AA pairs are
   enforced by `tokens.test.ts`; room-map backdrops need Ming's visual check.
6. **Control borders.** Brief `--color-border #E1E4DE` is ≈ 1.3:1 on white, below the 3:1 WCAG 1.4.11 asks of
   control boundaries. **Add `--color-border-strong #8A9484` (≈ 3.2:1) for inputs, selects, checkboxes and radios;
   keep `--color-border` for cards, secondary buttons and other non-control edges.**
7. **Font weights.** **Snap `font-bold`/`font-extrabold` (700/800, 159 uses in 78 files) to the brief's weights:
   600 for headings/titles/metrics, 500 for labels and buttons, 400 body.** (Also `.aw-*` 700/800 in slice 6.)
8. **13 px text.** **Labels and controls → 14 px (`text-label`), metadata → 12 px (`text-caption`).** No 13 px left.
9. **DM Sans Vietnamese.** **Request the `vietnamese` subset if `next/font` offers it for DM Sans; if not, accept
   per-glyph fallback to the system sans for stacked tone marks (ế, ộ, ữ) in member names** (D36: names keep
   diacritics). Ming checks a Vietnamese name after slice 1.
10. **Hero size.** **Sign-in headline: Hero 46/52 · 500 from `lg` up, Display 32/40 · 600 below (replaces
    `clamp(30px, 6vw, 48px)` · 800).** The unused 80 px `--text-hero` is deleted.
11. **New tokens beyond the brief.** **Approve `--color-workspace-action`, `-action-hover` (Q1),
    `--color-on-action` (white text on fills), `--color-border-strong` (Q6), `--color-{success,warning,danger,info}-tint`
    (badge backgrounds; brief gives only text colours), all defined in tokens.css.**
12. **Interim look.** **Slices 1–2 keep near-black primary buttons; coral filled buttons appear in slice 3.** (No
    half-coral state ships.)
13. **Status colours.** **"Pending/warn" changes from blue `#4FB0E5` to amber `--color-warning`** (brief: Pending →
    warning); status dots keep their text labels.
14. **Monospace.** **`font-mono` (keys, coordinates; 10 files) becomes `ui-monospace` per the brief** (today it is
    Manrope).
15. **Card edge.** `--shadow-card` is 3 % alpha and white cards on `#F8F9FB` are ≈ 1.06:1. **Keep the brief shadow
    and add a 1 px `--color-divider` border on cards (today's cards already have a hairline).**
16. **Page headings.** **30 px `.text-h2` → Display 32/40 · 600 for page headings; dashboard metrics → Title
    24/32.**
17. **Breakpoint `md` 768 → 800.** **Accept: the 8 `md:` files listed in Approach 6 switch at 800; `lg`/`xl`
    unchanged.**

## Split proposal
Seven slices, in order, each its own PR from `ticket/SIM-071` (or the session branch) with all Checks green. Each
later slice gets a short addendum to this plan (files, tests, visible differences) before it starts. This plan fully
covers **slice 1**.

1. **Tokens foundation** (this plan): tokens.css, `@theme` mapping, compat aliases, DM Sans, `md` 800, focus ring,
   reduced motion, contrast tests, breakpoints module.
2. **Token guard (ratchet).** Create `scripts/check-tokens.mjs` (exports `findViolations(path, text)`; CLI prints
   `file:line rule`), `scripts/check-tokens.test.ts` (unit cases per rule + "repo has no violations outside
   `PENDING`" + "every `PENDING` file still has a violation" so the list only shrinks), `scripts/check-tokens.pending.json`
   (files still to migrate). Rules over `src/**/*.{ts,tsx,css}` non-test: hex colours, `rgb(a)/hsl(a)(`, `shadow-[`,
   `rounded-[`, `font-[`, `text-[`, `ease-[`, `duration-[`, any arbitrary `[Npx]`, off-scale spacing steps on
   p/m/gap/space (allowed 0, px, 1, 2, 3, 4, 5, 6, 8, 12), and in CSS literal `border-radius`/`box-shadow`/
   `font-size` px and non-var `font-family`. Permanent allowlist: `src/styles/tokens.css`, `src/lib/sprites/**`,
   `src/ui/roomlayout/paint.ts`, `src/ui/portal/photo-canvas.ts`, sprite/avatar art colours, group colour data, tests,
   with a one-line reason each. Runs inside `pnpm test` (no new Checks row). Docs: one line in CLAUDE.md Commands is
   not needed (no new script). ~250 lines.
3. **UI kit.** `src/ui/Button.tsx` (variants: primary → workspace-action, `pixel` → pixel-primary + `shadow-pixel`,
   secondary → surface + border, disabled → opacity + `cursor-not-allowed`, no hover/shadow; `rounded-lg`,
   `min-h-control`, `text-label`; `sm` raised to 44 px; IconButton 44×44), `Chip.tsx`, `Card.tsx`, `SectionCard.tsx`,
   `FilledInput.tsx`, `EntityFormDialog.tsx` (dialog `rounded-2xl shadow-dialog`, fields `border-border-strong`),
   `RoleBadge.tsx`, `SegmentedFilter.tsx`, `TabBar.tsx`, `FormFooterBar.tsx`, `PageHeader.tsx`, `PageSkeleton.tsx`,
   `Avatar.tsx` (chrome only), `ThemeToggle.tsx`, `src/ui/auth/fields.tsx` (shared inputs, checkbox/radio selected
   state filled + border), `src/ui/dashboard/StatTile.tsx`, `src/app/dev/shell/KitGallery.tsx`; globals.css
   `.state-layer`, `.status-dot`, scrollbar, `--field-focus`, `--radius-md3*` (kit uses dropped); tests
   `src/ui/kit.test.tsx`, `src/ui/layout-blocks.test.tsx`, `src/ui/SegmentedFilter.test.tsx` (class updates + new
   asserts for 44 px, focus, disabled, variant tokens). Pending list shrinks by these files.
4. **Shell and sidebar** (after Q3): `src/ui/AppShellView.tsx` (lines 51–213: `lg:` → `md:` for the nav, `w-sidebar`,
   icon+label row, header/page padding to `--space-6/8`, `max-w-content`), `src/ui/AppShell.tsx`,
   `src/ui/RoomSwitcher.tsx`, `src/ui/AppShellView.test.tsx`, `src/ui/RoomSwitcher.test.tsx`; re-check
   `src/ui/roomlayout/LayoutEditorPage.tsx` and `RoomMap.tsx` widths at 800–1023.
5. **Management screens** (clean kit, coral; mechanical class sweep with a rename map, off-scale sizes snapped,
   700/800 → 600): `src/ui/members/**`, `src/ui/invitations/**`, `src/ui/groups/**`, `src/ui/devices/**`,
   `src/ui/deviceTypes/**`, `src/ui/requests/**`, `src/ui/audit/**`, `src/ui/dashboard/**`, `src/ui/search/**`,
   `src/ui/rooms/**`, `src/ui/seats/**` (tables, dialogs, `SeatDetailPanel.tsx`), `src/ui/org/**`,
   `src/ui/credits/**`, admin pages under `src/app/**/page.tsx` that carry classes, and their `*.test.tsx` class
   assertions. May be split into 5a (members, invitations, groups, requests, audit, org, credits) and 5b (devices,
   deviceTypes, dashboard, search, rooms, seats) if the diff exceeds ~400 hand-edited lines.
6. **End-user and pixel surfaces:** `src/ui/portal/**` (incl. `PixelLookPicker.tsx` pixel green,
   `MyRequestRow.tsx` badges), `src/ui/checkin/**` (pixel green buttons), `src/ui/roomlayout/**` chrome
   (`RoomMap.tsx`, `SeatOverlay.tsx`, `ZoomControl.tsx` 44 px, `GestureOverlay.tsx`, `EditorToolbar.tsx`,
   `EditorInspector.tsx`, `EditorViews.tsx`, `ShortcutList.tsx`, `Palette.tsx` pixel green; room backdrops use
   `--color-room-floor/green`; sprites untouched), `src/ui/mapItems/**` (pixel green, library page
   `max-w-library`, sprite previews `bg-tile`), `src/ui/auth/**` (`AuthLayout.tsx`, `SignInScene.tsx`,
   `SmallWorld.tsx`, account/accept views): globals.css `.aw-*` and `.px-card/.px-title/.px-strip` re-pointed to
   cream/text-pixel/text-secondary/divider/tile/pixel-primary/`--shadow-pixel` with px values on the scale, `--aw-*`
   deleted, Fraunces kept on `.aw-serif`, Hero/Display headline (Q10); `src/ui/auth/world-palette.test.ts`
   replaced by assertions in `src/lib/color/tokens.test.ts` (same AA thresholds, now on the new tokens) and
   `SmallWorld.test.tsx` class updates.
7. **Cleanup and audit:** remove every compat alias and dead token from globals.css (`--primary…`, `--surface-*`,
   `--accent-*`, `--status-*`, `--scrim`/`--shadow*` → tokens, `--ease-md3`), move `--px-*` art palette into
   tokens.css, `check-tokens.pending.json` empty then deleted (test asserts zero violations), final changelog and the
   brief's self-check (contrast table, focus, 44 px, reduced motion, 800/1024/1280 layouts) in `impl-log.md`.

## Slice 2 addendum — Token guard (ratchet)
Status: READY. Written against slice 1 as merged (PR #154) and the Split proposal item 2. No new decisions; open
points are non-blocking questions below with defaults. Closes AC 1b only partly: the guard exists and ratchets; AC 1b
is fully met in slice 7 (empty pending list). No product code, CSS or markup changes in this slice.

### Scope (from this plan)
- Split proposal item 2 (above): `scripts/check-tokens.mjs` exporting `findViolations`, `scripts/check-tokens.test.ts`,
  `scripts/check-tokens.pending.json`; rules and permanent allowlist as listed there; "Runs inside `pnpm test` (no new
  Checks row)"; no CLAUDE.md change; about 250 lines.
- AC 1b: "No component file contains a hard-coded hex colour, px radius, box-shadow or font stack (grep check)"; AC 3:
  "slice 2 guard flags `text-[13px]` and other arbitrary sizes".
- Q7/Q8 (default): 13 px text and 700/800 weights are removed in later slices; this guard only flags arbitrary
  `text-[`, not weights (weights are not in the Split proposal rule list, so not added here).

### Files (slice 2)
None matches a High path in `loop.config.md` (only `scripts/check-layers.mjs` is listed under `scripts/`).

| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/check-tokens.mjs` | create: rules, `findViolations(path, text)`, `isScanned(path)`, `ALLOWLIST`, `main()` CLI | the guard | no |
| `scripts/check-tokens.test.ts` | create: rule unit tests, repo scan, ratchet tests, allowlist tests, CLI smoke | R5, AC 1b | no |
| `scripts/check-tokens.pending.json` | create: files still to migrate, with violation counts, generated once from the real repo | ratchet | no |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 2": rules, allowlist reasons, initial pending table (file, count) | Deliverable 3 | no |

Not touched: `package.json` (no new script; the test runs inside `pnpm test` because `vitest.config.ts:19` already
includes `scripts/**/*.test.ts`), `CLAUDE.md`, `.claude/loop.config.md` (Checks unchanged), any file under `src/`.
Style follows `scripts/check-layers.mjs`: Node built-ins only, `export function`, `main()` run only when the file is
the entry point (`import.meta.url === pathToFileURL(resolve(process.argv[1])).href`), JSDoc types.

### Module contract (`scripts/check-tokens.mjs`)
- `isScanned(path: string): boolean` — posix path relative to the repo root; true when it starts with `src/`, ends in
  `.ts`, `.tsx` or `.css`, and does not match `/\.test\.[cm]?[jt]sx?$/` (tests are exempt).
- `findViolations(path: string, text: string): { line: number; rule: string; match: string }[]` — pure; no fs. Returns
  `[]` when `!isScanned(path)` or `isAllowed(path)`. One entry per match (two matches on one line are two entries),
  sorted by line then rule. Line numbers are 1-based.
- `isAllowed(path: string): boolean` — checks `ALLOWLIST`.
- `ALLOWLIST: { pattern: string; reason: string }[]` — `pattern` is an exact posix path, or a prefix ending in `/**`
  (matches everything under that directory). Permanent, one-line reason each (entries, in this order):

  | pattern | reason |
  |---|---|
  | `src/styles/tokens.css` | the one file that defines token values (brief Rule 1) |
  | `src/lib/sprites/**` | pixel-art sprite data and art colours (ticket Out of scope) |
  | `src/ui/roomlayout/paint.ts` | canvas paint of the room layout, art colours |
  | `src/ui/portal/photo-canvas.ts` | canvas photo rendering colours |
  | `src/ui/groups/group-form.ts` | default group colour is user data, not UI chrome |

  `Avatar.tsx` and `SeatOverlay.tsx` are deliberately **not** allowlisted (they mix chrome and art); they start in the
  pending list and slices 3 and 6 either migrate them or add a justified allowlist entry in that slice's PR.
- CLI (`node scripts/check-tokens.mjs`): scans `src/` like `check-layers.mjs` (`readdirSync("src", { recursive: true })`,
  backslashes to `/`, files only), prints `file:line rule match` to stderr for every violation in a file that is not
  allowlisted and not pending-covered, exits 1 if any; otherwise prints `check-tokens: N files, no violations outside
  the pending list`. `--list` prints JSON `{ "<path>": <violation count> }` for every scanned file with at least one
  violation (used once to generate the pending file, and by implementers when shrinking it); exit 0.
  The pending/ratchet comparison lives in an exported `compareToPending(counts, pending)` returning
  `{ newViolations: string[]; stale: string[]; shrunk: { path: string; was: number; now: number }[] }` so the CLI and
  the test share it.

### Rules (exact patterns)
Applied to the text after comment stripping. `stripComments(path, text)`: for `.css` remove `/* … */`; for `.ts/.tsx`
remove `/* … */` and `//` line comments where the `//` is at line start or preceded by whitespace (so `http://` in
strings survives). Removed characters are replaced by spaces and newlines kept, so line numbers stay correct.
`(?<![\w-])` below is the lookbehind "not part of a longer word or class name"; a Tailwind variant prefix such as
`md:` or `hover:` and a leading `!` are allowed before it because `:` and `!` are not in `[\w-]`.

| Rule id | Applies to | Regex (JS, flags `g`) | Notes |
|---|---|---|---|
| `hex` | ts, tsx, css | `/(?<![\w&])#(?=[0-9a-fA-F]*\d)(?:[0-9a-fA-F]{8}\|[0-9a-fA-F]{6}\|[0-9a-fA-F]{3,4})(?![\w-])/g` | needs a digit, so `href="#bad"` and `&#123;` do not match |
| `color-fn` | ts, tsx, css | `/\b(?:rgba?\|hsla?)\(/g` | `\b` keeps `mixSrgb(` (src/lib/color/contrast.ts:40) clean |
| `shadow-arb` | ts, tsx | `/(?<![\w-])shadow-\[/g` | |
| `rounded-arb` | ts, tsx | `/(?<![\w-])rounded(?:-(?:[trblse]\|tl\|tr\|bl\|br\|ss\|se\|ee\|es))?-\[/g` | |
| `font-arb` | ts, tsx | `/(?<![\w-])font-\[/g` | |
| `text-arb` | ts, tsx | `/(?<![\w-])text-\[/g` | flags `text-[13px]` and `text-[var(--x)]` alike |
| `ease-arb` | ts, tsx | `/(?<![\w-])ease-\[/g` | |
| `duration-arb` | ts, tsx | `/(?<![\w-])duration-\[/g` | |
| `arbitrary-px` | ts, tsx | `/\[[^\]\s]*\d(?:px\|rem\|em)[^\]\s]*\]/g` | any `[…Npx]`, e.g. `min-h-[68px]`, `grid-cols-[1fr_44px]` |
| `spacing-scale` | ts, tsx | `/(?<![\w-])-?(?:p\|px\|py\|pt\|pr\|pb\|pl\|ps\|pe\|m\|mx\|my\|mt\|mr\|mb\|ml\|ms\|me\|gap\|gap-x\|gap-y\|space-x\|space-y)-(\d+(?:\.\d+)?)(?![\w.-])/g` | violation when capture group 1 is not in `0, 1, 2, 3, 4, 5, 6, 8, 12`; so `px-2.5`, `gap-1.5`, `p-7`, `mt-10` flag; `p-4`, `px-card`, `gap-px`, `p-[…]` (other rule) do not |
| `css-radius` | css | `/(?<![\w-])border-radius\s*:\s*([^;}]*)/g` | violation when the value matches `/\d(?:px\|rem\|em)\b/`; `var(--radius-lg)`, `inherit`, `50%` pass |
| `css-shadow` | css | `/(?<![\w-])box-shadow\s*:\s*([^;}]*)/g` | violation unless the value (trimmed) is `none`, `inherit`, or consists only of `var(...)` terms (comma-separated allowed) |
| `css-font-size` | css | `/(?<![\w-])font-size\s*:\s*([^;}]*)/g` | violation when value matches `/\d(?:px\|rem\|em)\b/`; `var(--text-…)` passes |
| `css-font-family` | css | `/(?<![\w-])font-family\s*:\s*([^;}]*)/g` | violation unless value starts with `var(` or is `inherit`; custom properties such as `--font-family-sans:` never match (lookbehind) |

The CSS rules match whole declarations (value up to `;` or `}`, may span lines); the reported `line` is the line of the
property name. `hex`/`color-fn` also apply to `@theme`/`:root` blocks in `globals.css`, which is why `globals.css` is
pending until slice 7 (no CSS file other than `tokens.css` may define colour values at the end).

Known gaps (recorded in impl-log, not fixed here, R4): inline style objects with numbers (`borderRadius: 12`), `style=`
strings that are not hex/rgb/hsl, and weights `font-bold/extrabold` (handled by the slice sweeps, Q7).

### Pending list format (`scripts/check-tokens.pending.json`)
```json
{
  "src/app/globals.css": 120,
  "src/ui/Avatar.tsx": 3
}
```
- A flat JSON object: key = posix path of a scanned, non-allowlisted file; value = its current number of violations
  (positive integer). Keys sorted alphabetically (the test checks this so diffs stay small). Generated once with
  `node scripts/check-tokens.mjs --list` on the slice-2 branch (numbers above are placeholders, not real).
- Ratchet semantics: for every scanned non-allowlisted file, actual count `n` and pending value `p` (0 if absent):
  `n > p` fails ("new violations, fix the code, do not raise the list"); `n < p` fails with "lower the pending value to
  n" (or "remove the entry" when `n == 0`). So each later slice must update the file in the same PR as the code it
  cleans, and the list can only shrink. A pending key whose file no longer exists fails.
- Slice 7 deletes the file; `compareToPending` then treats the pending map as `{}` and the repo scan must have zero
  violations (the test already handles a missing file as `{}`).

### Tests to write (`scripts/check-tokens.test.ts`, Vitest, node)
Imports `findViolations`, `isScanned`, `isAllowed`, `ALLOWLIST`, `compareToPending` from `./check-tokens.mjs`, same as
`scripts/check-layers.test.ts:2`.

| Test (describe › name) | Covers |
|---|---|
| rules › flags each rule once with the right id and 1-based line | one fixture line per rule id above: `bg-[#ED5B35]` (hex), `style={{ color: "rgba(0,0,0,.5)" }}` (color-fn), `shadow-[0_1px_2px_#000]` (shadow-arb; also yields hex), `rounded-[10px]` and `rounded-t-[4px]`, `font-[Georgia]`, `text-[13px]`, `ease-[cubic-bezier(.2,0,0,1)]`, `duration-[120ms]`, `min-h-[68px]`, and each spacing case |
| rules › hex: accepts `#bad`, `&#123;`, `#12`, `#12345` (5 digits) and a hex in a `//` or `/* */` comment; flags `#fff`, `#FFFF`, `#ed5b35`, `#ED5B35AA` | hex edge cases, comment stripping |
| rules › color-fn: flags `rgb(`, `rgba(`, `hsl(`, `hsla(`; ignores `mixSrgb(` and `color-mix(in srgb, …)` | `\b` guard |
| rules › spacing-scale: allows `p-0 px-1 gap-2 mt-3 py-4 m-5 gap-x-6 space-y-8 p-12 -mt-4 md:px-6 px-px px-card`; flags `p-7 mt-10 px-2.5 gap-1.5 -mt-0.5 md:gap-16 space-x-9` | allowed scale (0, px, 1, 2, 3, 4, 5, 6, 8, 12) |
| rules › arbitrary values: `top-[3px]` flagged by `arbitrary-px`; `w-[var(--x)]` and `grid-cols-[1fr_1fr]` not flagged; `text-[var(--x)]` flagged by `text-arb` | arbitrary rules |
| rules › css: `border-radius: 8px`, `border-radius: 0 0 4px 4px`, `box-shadow: 0 1px 2px var(--c)`, `font-size: 13px`, `font-family: "Manrope", sans-serif` flagged; `border-radius: var(--radius-lg)`, `border-radius: 50%`, `box-shadow: var(--shadow-card)`, `box-shadow: none`, `font-size: var(--text-label)`, `font-family: var(--font-family-sans)`, `--font-family-sans: ui-monospace, monospace` pass | CSS declaration rules; a multi-line `box-shadow:` reports the property's line |
| rules › class-name look-alikes are not flagged: `px-card`, `p-card-x`, `shadow-card`, `rounded-lg`, `text-label`, `font-heading`, `ease-out`, `duration-150`, `top-2`, `group-hover:flex` | no false positives on token utilities |
| rules › `.test.ts(x)` files, non-`src/` files and non-ts/tsx/css files return no violations | `isScanned` |
| rules › two matches on one line give two entries; results sorted by line | counting contract |
| allowlist › every entry has a non-empty reason, is an exact path or ends in `/**`, and matches at least one file in the repo | stale-entry guard |
| allowlist › `isAllowed("src/lib/sprites/avatar.ts")` and `isAllowed("src/styles/tokens.css")` true; `isAllowed("src/ui/Avatar.tsx")` false | pattern matching (prefix vs exact) |
| pending › file is a flat object, keys sorted, values positive integers, every key is a scanned non-allowlisted file that exists | format |
| pending › `compareToPending` returns `newViolations` for count above pending, `shrunk` for count below, `stale` for a pending key with count 0 or missing file | ratchet unit cases with synthetic maps |
| repo › every scanned file satisfies `count === pending[path] ?? 0` (messages list file, was, now) | the real ratchet: new violations fail, unrecorded shrink fails |
| cli › `node scripts/check-tokens.mjs` exits 0 and prints `check-tokens:`; `--list` prints parseable JSON equal to the pending file | wiring; run with `spawnSync(process.execPath, …)` like other script tests |

### Approach (slice 2)
1. Write `check-tokens.mjs` (rules table as a const array `{ id, exts, re, test? }`; one `matchAll` loop per rule).
2. Run `node scripts/check-tokens.mjs --list`, review the output (expected: `src/app/globals.css` large, `Avatar.tsx`,
   `SeatOverlay.tsx`, plus the many files with `text-[`, `rounded-[`, `[Npx]`, off-scale spacing and `p-/gap-` steps),
   save it as `check-tokens.pending.json` (sorted keys). Spot-check three entries by hand with `rg` to confirm the
   counts and that no allowlisted file sneaked in.
3. Write the tests; confirm the repo-ratchet and CLI tests pass.
4. Mutation check (record in impl-log): add `bg-[#fff]` to a non-pending file and `p-7` to a pending file; the test
   must fail for both; revert.
5. Append "Slice 2" to `impl-log.md` (rules, allowlist with reasons, pending table, known gaps, mutation check result).
6. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (build unaffected;
   run for the Checks row).

Rules: R1 (`scripts/` is outside the layers; no `src/` imports); R3 (no env); R4 (only the files above, no `src/`
edits); R5 (the guard is itself tested). R2/R6/R7 not touched. Size: about 250 lines (mjs ~110, test ~140, json 10 to
40 lines).

### Acceptance → verification (slice 2)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S2-1 | Guard flags hex, `rgb(a)/hsl(a)(`, `shadow-[`, `rounded-[`, `font-[`, `text-[`, `ease-[`, `duration-[`, `[Npx]`, off-scale p/m/gap/space, CSS literal radius/shadow/font-size/font-family (AC 1b, AC 3 "flags `text-[13px]`") | `pnpm test scripts/check-tokens.test.ts` › rules (all tests listed above green); read the rules table against the Split proposal list |
| S2-2 | Permanent allowlist is exactly tokens.css, sprites, paint.ts, photo-canvas.ts, group-form.ts, each with a reason | allowlist tests green; reviewer reads `ALLOWLIST` |
| S2-3 | Ratchet: new violations anywhere fail; pending only shrinks | repo test green; reviewer's mutation (`bg-[#fff]` in any non-pending `src/ui` file, `p-7` in a pending one) makes `pnpm test` fail, and removing a violation from a pending file without lowering its value also fails |
| S2-4 | Runs inside `pnpm test`, no new Checks row, no package.json or CLAUDE.md change | `git diff main -- package.json CLAUDE.md .claude/loop.config.md` empty; `pnpm test` output lists `scripts/check-tokens.test.ts` |
| S2-5 | No product change | `git diff --stat main` shows only the four files in the table |
| S2-6 | Existing checks green | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build` |

Ming verification after merge: none for this slice (no visible change).

### Assumptions and non-blocking questions (slice 2)
- Hotspots: none; the slice adds new files only. Later slices each edit `check-tokens.pending.json`; two slice PRs open
  at once will conflict there and need a rebase (counts are re-generated with `--list`).
- Q-S2-1 (non-blocking). The Split proposal says "every `PENDING` file still has a violation" (file-level). **Default:
  store a count per file** (above), which also stops new violations creeping into files that are still pending, at the
  cost of updating the number in each slice. If Ming prefers the literal file-level list (`string[]`), only
  `compareToPending` and the JSON shape change.
- Q-S2-2 (non-blocking). `Avatar.tsx:33` (`"#ffffff"` text on a user-chosen group colour) and `SeatOverlay.tsx`
  tooltip colour start as pending. **Default: slice 3 replaces the Avatar hex with `var(--color-on-action)` (white,
  same value) or, if it must stay a literal, adds an allowlist entry with the reason "text on user data colour"; slice
  6 migrates SeatOverlay to tokens.**
- Q-S2-3 (non-blocking). Off-scale spacing allowed steps are 0, px, 1, 2, 3, 4, 5, 6, 8, 12 exactly as in the Split
  proposal; `gap-1.5`/`px-2.5` (common today) are therefore violations and are cleaned in slices 3 to 6 with the rename
  map. **Default: keep as specified.**
- The file-level `// token-ok` escape comment is not added (not in the approved plan); anything that must stay literal
  goes into `ALLOWLIST` with a reason.

## Slice 3 addendum — UI kit
Status: READY. Written against slices 1 (#154) and 2 (#155) as merged, Split proposal item 3 and Ming's approved
defaults Q1–Q17 (ticket.md:85, "theo mặc định hết"). No new decisions; open points are non-blocking questions at the end,
each with a default. Closes AC 2 for the kit (screens follow in slices 4–6) and the kit part of AC 3. One PR, about
400 changed lines (most of it class strings and tests), so no 3a/3b split.

### Scope (from this plan and the brief)
- Split proposal item 3: Button (primary → workspace-action, `pixel` → pixel-primary + `shadow-pixel`, secondary →
  surface + border, disabled → opacity + `cursor-not-allowed` with no hover/shadow; `rounded-lg`, `min-h-control`,
  `text-label`; `sm` raised to 44 px; IconButton 44×44), Chip, Card, SectionCard, FilledInput, EntityFormDialog (dialog
  `rounded-2xl shadow-dialog`, fields `border-border-strong`), RoleBadge, SegmentedFilter, TabBar, FormFooterBar,
  PageHeader, PageSkeleton, Avatar (chrome only), `auth/fields.tsx`, `dashboard/StatTile.tsx`, KitGallery; globals.css
  `.state-layer`, `.status-dot`, scrollbar.
- brief.md Component mapping (lines 126–136): primary "white text, `--radius-lg`, min-height `--size-control-min`,
  Label style. Pixel variant may add `--shadow-pixel`"; secondary "`--color-surface` background, 1px `--color-border`,
  `--color-text-primary`"; disabled "reduced opacity, `not-allowed` cursor, no hover/shadow"; inputs "`--color-surface`
  background, 1px `--color-border`, `--radius-lg`, min-height 44px, Label-style labels … Selected state must be explicit
  (filled indicator plus a border or background change)"; cards "`--radius-xl`, `--shadow-card`"; dialogs "`--radius-2xl`,
  `--shadow-dialog`"; badges "pill (`--radius-full`) or `--radius-sm`, Caption style … Always include a text label";
  transitions "`color, background-color, border-color, box-shadow, transform` at `--duration-ui` ease-out".
- Approved defaults used: Q1 (filled = `--color-workspace-action` `#D3441F` / hover `#B93B19`, brief coral only for
  non-text: tab indicator), Q2 (Button/IconButton 8 px, chips 6 px, badges full or 4 px, avatars round), Q4 (pixel
  variant exists in the kit; callers adopt it in slice 6), Q6 (`border-border-strong` on control boundaries), Q7 (700/800
  → 600 headings/metrics, 500 labels/buttons), Q8 (13 px → `text-label` 14 / `text-caption` 12), Q11 (tints for badges),
  Q12 (coral filled buttons appear in this slice), Q15 (cards keep a 1 px divider border), Q16 (metrics → Title).
- **`--primary` re-point for buttons** is done per component, not globally: the kit's filled fills (`Button` filled,
  `FilterChips` selected, the EntityFormDialog submit) move from `bg-primary` to `bg-workspace-action`. The global
  `--primary` alias stays ink until slice 7, because re-pointing it would also recolour every `text-primary` use (slice 1
  Approach 2; 70 hits in 47 files).

### Rules for every kit file in this slice
1. Only token utilities from `src/styles/tokens.css` / the `@theme inline` size aliases: colours `canvas`, `surface`,
   `text-primary`, `text-secondary`, `border`, `border-strong`, `divider`, `focus`, `workspace-primary`,
   `workspace-action(-hover)`, `pixel-primary`, `pixel-hover`, `on-action`, `success|warning|danger|info` and their
   `-tint`; sizes `min-h-control`, `size-control`; type `text-caption|label|body|subtitle|title|display`; radius
   `rounded-sm|md|lg|xl|2xl|full`; shadows `shadow-card|dialog|pixel`. **No legacy aliases** (`*-primary` other than
   `text-text-primary`/`workspace-*`/`pixel-primary`, `on-primary`, `on-surface*`, `surface-high/highest/low/lowest/
   container`, `outline*`, `error*`, `*-container`, `secondary*`, `tertiary*`, `accent-orange*`, `rounded-md3*`,
   `--field-focus`, `--card-shadow*`, `--shadow`). Exception: Avatar's default initials background (Q-S3-2).
2. No `font-bold`/`font-extrabold`; no `font-[inherit]` (Tailwind v4 preflight already sets `font: inherit` on
   buttons, inputs and selects; implementer confirms in the built CSS once).
3. Transitions: `transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui)
   ease-out` (v4 `(--var)` shorthand; the guard only flags `duration-[`). If 4.3.x rejects the shorthand, use
   `duration-150` (same value) and record it.
4. Hover styles are written `enabled:hover:…` on buttons so disabled controls get no hover; disabled =
   `disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none` (no `pointer-events-none`, so the cursor shows).
5. Focus: no per-component focus classes; the global `:focus-visible` rule (globals.css:333–336) applies. Text fields
   show the ring on their box via `.field-box` (Approach 2).
6. Keep every prop, variant name and `data-variant` value: `filled` stays the primary variant name (113 call sites in
   57 files, `.px-card`/`.aw-card [data-variant="filled"]` selectors at globals.css:398–420, 583–587, and
   `views.test.tsx:312`, `CheckinButton.test.tsx:20`, `CheckinPopup.test.tsx:91`, `SeatCard.test.tsx:51` depend on it).
   Only additions: Button `variant="pixel"`, Pill `tone="info"`. Only removal: IconButton's `size` prop (no caller passes
   it: KitGallery.tsx:44–45, AppShellView.tsx:158/173/180, ThemeToggle.tsx:24, SeatDetailPanel.tsx:228).

### Files (slice 3)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, `src/app/globals.css`, `src/app/dev/**`,
`scripts/check-tokens.pending.json` are not listed; `*.test.ts(x)` are Low).

| File | Change | Pending before → after |
|---|---|---|
| `src/ui/Button.tsx` | Button and IconButton per Approach 1 | 12 → 0 (remove key) |
| `src/ui/Chip.tsx` | FilterChips, Chip, Pill (+ `info` tone) per Approach 3 | 16 → 0 (remove) |
| `src/ui/Card.tsx` | `rounded-xl border border-divider bg-surface shadow-card`; interactive: token transition + `hover:-translate-y-0.5 hover:border-border-strong` (lines 21–23) | 3 → 0 (remove) |
| `src/ui/SectionCard.tsx` | `gap-0.5` → `gap-1` (line 42); `border-outline-variant` → `border-divider` (39, 55); icon `text-primary` → `text-text-primary` (44); h3 `text-base font-extrabold text-on-surface` → `text-body font-semibold text-text-primary` (45); subtitle `text-xs text-on-surface-variant` → `text-caption text-text-secondary` (50) | 1 → 0 (remove) |
| `src/ui/FilledInput.tsx` | box (lines 19–24) → `field-box group flex h-12 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4` + token transition; drop `focus-within:*`; input (31) `text-label text-text-primary placeholder:text-text-secondary outline-none disabled:cursor-not-allowed disabled:opacity-50`, drop `font-medium`; icons `text-text-secondary` (27, 34) | 4 → 0 (remove) |
| `src/ui/EntityFormDialog.tsx` | dialog, header, error, footer, `FIELD_BOX`, `FIELD_CAPTION`, inputs per Approach 4 | 28 → 0 (remove) |
| `src/ui/RoleBadge.tsx` | inline styles → token classes per Approach 5 | 6 → 0 (remove) |
| `src/ui/SegmentedFilter.tsx` | per Approach 6 | 2 → 0 (remove) |
| `src/ui/TabBar.tsx` | container `border-outline-variant` → `border-divider` (32); tab (57–61): `min-h-11` → `min-h-control`, `text-sm font-semibold` → `text-label`, selected `border-workspace-primary text-text-primary font-semibold`, unselected `border-transparent text-text-secondary` | not pending (stays 0) |
| `src/ui/FormFooterBar.tsx` | `border-outline-variant` → `border-divider` (32); status `text-sm font-semibold` → `text-label font-semibold`, `text-error` → `text-danger`, `text-on-surface` → `text-text-primary` (36–37); saved check icon `text-primary` → `text-success` (40); detail `text-on-surface-variant` → `text-text-secondary` (43) | not pending |
| `src/ui/PageHeader.tsx` | heading `text-xl font-extrabold text-on-surface` → `text-subtitle text-text-primary` (31; 20 px is off-scale, nearest step 18); subtitle `text-sm text-on-surface-variant` → `text-label font-normal text-text-secondary` (37) | not pending |
| `src/ui/PageSkeleton.tsx` | h1 `font-extrabold text-on-surface` → `font-semibold text-text-primary` (17); icon and text `text-on-surface-variant` → `text-text-secondary`, `text-sm font-medium` → `text-label` (19–20) | not pending |
| `src/ui/Avatar.tsx` | `font-extrabold` → `font-semibold` (28); `"#ffffff"` → `"var(--color-on-action)"` (33, Q-S2-2 default); default background/colour unchanged (Q-S3-2) | 1 → 0 (remove) |
| `src/ui/auth/fields.tsx` | Notice (17–25): `rounded-md3` → `rounded-lg`, `text-sm` → `text-label font-normal`, error tone `border-danger/40 bg-danger-tint text-danger`, info tone `border-border bg-canvas text-text-primary`; `linkClass` (32) `text-sm` → `text-label`, `text-on-surface` → `text-text-primary`; Field label (54) `text-xs font-semibold text-on-surface-variant` → `text-label text-text-primary`; error (66) `text-xs text-error` → `text-caption text-danger`; ShowPasswordToggle (82) `min-h-[44px]` → `min-h-control`, `text-xs text-on-surface-variant` → `text-label font-normal text-text-secondary` | 1 → 0 (remove) |
| `src/ui/dashboard/StatTile.tsx` | label (9–11) `text-on-surface-variant` → `text-text-secondary`, `text-[13px] font-medium` → `text-label`; value (13) `text-h2 font-extrabold text-on-surface` → `text-title text-text-primary` (Q16) | 2 → 0 (remove) |
| `src/app/globals.css` | per Approach 2: `.state-layer` hover/active skip disabled; delete unused `.status-dot` block (lines 260–278, no element uses it: `rg status-dot src` hits only globals.css); scrollbar thumb `border-radius: 8px` → `var(--radius-lg)` (251) and `--surface-container-highest` → `var(--color-border)`, hover `--outline` → `var(--color-border-strong)` (250, 256); add `.field-box` focus rules and the checkbox/radio `accent-color` rule | 69 → 65 |
| `scripts/check-tokens.pending.json` | remove the 11 kit keys above; `src/app/globals.css` → 65 (exact values from `node scripts/check-tokens.mjs --list`) | total 373 → 293 expected |
| `src/app/dev/shell/KitGallery.tsx` | add `<Button variant="pixel">`, a Pill row with all six tones, a native checkbox and a SegmentedFilter; h1 `font-extrabold` → `font-semibold` (33); Avatar sample `var(--accent-orange)` → `var(--color-workspace-primary)` (57) | not pending |
| `src/ui/copy/gallery.ts` | dev-only gallery strings for the new samples: `buttons.pixel: "Pixel"`, `pills: { accent: "New", neutral: "Draft", success: "Approved", warning: "Pending", danger: "Rejected", info: "Info" }`, `checkbox: "Checkbox"`, `segments: { ariaLabel: "View", list: "List", grid: "Grid" }` (D36; no product copy changes) | not scanned (no violations) |
| `src/ui/kit.test.tsx` | new kit asserts (Tests below) | test |
| `src/ui/layout-blocks.test.tsx` | class updates: TabBar (28, 36, 39), SectionCard (105), Pill (121–126) + new asserts | test |
| `src/ui/SegmentedFilter.test.tsx` | class update (25–28) + `min-h-control` | test |
| `src/ui/Avatar.test.tsx` | add: `color` given → `color:var(--color-on-action)` | test |
| `src/ui/portal/MyRequestRow.test.tsx` | Pill class updates only: `bg-warning-container` → `bg-warning-tint` (35), `bg-success-container` → `bg-success-tint` (52), `bg-error-container` → `bg-danger-tint` (61) | test |
| `src/lib/color/tokens.test.ts` | add non-text pairs and the globals.css rule checks (Tests below) | test |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 3": files, rename map, pending before/after, visible differences, checks | deliverable |

Not touched: `ThemeToggle.tsx` (no change needed; it gets the new IconButton look through `IconButton`),
`src/ui/index.ts` (exports unchanged), `src/styles/tokens.css` (no new token), `scripts/check-tokens.mjs` (rules
unchanged), any screen file (`AppShellView.tsx`, `RoomSwitcher.tsx`, feature folders: slices 4–6). Tests outside the
table may change only if a kit class string they assert changed; the implementer lists each in impl-log. Expected:
`PortalTabs.test.tsx:42–43` stays green unchanged (`text-text-primary` contains `text-primary`;
`text-text-secondary` does not).

### Approach (slice 3)
1. **Button.tsx.**
   - Base (lines 50–53): `state-layer inline-flex items-center justify-center gap-2 rounded-lg min-h-control text-label
     whitespace-nowrap select-none cursor-pointer` + transition (rule 3) + `enabled:active:scale-95` + disabled (rule 4).
   - Variants (8–16):
     | Variant | Classes |
     |---|---|
     | `filled` (primary) | `bg-workspace-action text-on-action enabled:hover:bg-workspace-action-hover` |
     | `pixel` (new) | `bg-pixel-primary text-on-action shadow-pixel enabled:hover:bg-pixel-hover` |
     | `tonal`, `outlined` | `bg-surface text-text-primary border border-border enabled:hover:border-border-strong` |
     | `text` | `bg-transparent text-text-primary` (hover = state layer) |
     | `danger` | `bg-danger-tint text-danger border border-danger/30` |
   - Sizes (18–22): `sm: "px-4"`, `md: "px-5"`, `lg: "min-h-12 px-6"` (48 px CTA; all sizes `text-label` from the base,
     so 13 → 14 px and 15 → 14 px). Icon sizes unchanged (62).
   - IconButton (68–104): drop the `size` prop and the inline `style`; classes `state-layer inline-flex size-control
     flex-none items-center justify-center rounded-lg cursor-pointer` + transition + `enabled:active:scale-95` + disabled;
     `active` → `bg-canvas text-text-primary border border-border`, else `text-text-secondary enabled:hover:bg-canvas
     enabled:hover:text-text-primary`. Update the doc comment ("Square 44 px icon-only button").
   - Docblock (24–27): replace "MD3 pill button" with the brief mapping in one line.
2. **globals.css.**
   - `.state-layer:hover::after` / `:active::after` (322–327) → `.state-layer:not(:disabled):hover::after` /
     `.state-layer:not(:disabled):active::after` (brief: disabled has no hover).
   - Insert **after** the global `:where(…):focus-visible` rule (333–336), never before it (`tokens.test.ts:171`
     matches the first `:focus-visible {` in the file):
     ```css
     /* Text fields: the ring sits on the whole box (icon + input), not on the bare input. */
     .field-box:focus-within {
       outline: 2px solid var(--color-focus);
       outline-offset: 2px;
     }
     .field-box :where(input, select):focus-visible {
       outline: none;
     }
     /* Checkboxes and radios: native filled indicator in the action colour (brief: explicit selected state). */
     @layer base {
       input[type="checkbox"],
       input[type="radio"] {
         accent-color: var(--color-workspace-action);
       }
     }
     ```
     (`@layer base` so screen utilities and the slice 6 pixel scopes can override it; sizes are not set globally because
     several radios are visually hidden with `sr-only`.)
   - Delete `.status-dot` (260–278); scrollbar per the Files table.
3. **Chip.tsx.**
   - FilterChips track (29): `flex items-center gap-1 rounded-lg border border-border bg-canvas p-1`; chip (41–46):
     `state-layer inline-flex min-h-control items-center gap-2 rounded-md px-4 text-label cursor-pointer` + transition;
     checked `bg-workspace-action text-on-action`, unchecked `text-text-secondary enabled:hover:text-text-primary`.
   - Chip (71–75): `inline-flex items-center gap-1 rounded-md border border-divider px-2 py-1 text-caption font-medium`;
     inline defaults `var(--secondary-container)` → `var(--color-canvas)`, `var(--on-secondary-container)` →
     `var(--color-text-primary)` (the `color`/`onColor` props are group colours, user data, unchanged).
   - Pill (83–116): base `inline-flex items-center gap-1 rounded-full px-2 text-caption font-medium`; tones `accent:
     bg-workspace-action text-on-action`, `neutral: bg-canvas text-text-secondary`, `success: bg-success-tint
     text-success`, `warning: bg-warning-tint text-warning`, `danger: bg-danger-tint text-danger`, new `info:
     bg-info-tint text-info`; dot `size-1.5 rounded-full bg-current` unchanged (`size-*` is not a spacing-scale rule).
4. **EntityFormDialog.tsx.**
   - `<dialog>` (71–72): `m-auto w-[calc(100%_-_2*var(--space-5))] max-w-md overflow-hidden rounded-2xl bg-surface p-0
     text-text-primary shadow-dialog`; style `animation: "popin var(--duration-ui) ease-out"`. (`max-w-md` = 448 px,
     was 440; the calc keeps the 20 px gutter without a px literal.)
   - Header (75–83): `px-6 pt-6 pb-3`; h2 `text-subtitle text-text-primary`; subtitle `mt-1 text-label font-normal
     text-text-secondary`.
   - Error (90): `px-1 text-label text-danger`.
   - Footer (95–110): replace both hand-rolled buttons with kit Buttons: `<Button variant="tonal" onClick={onClose}>` and
     `<Button type="submit" disabled={submitting}>` (import `./Button`), same labels; wrapper classes unchanged.
   - `FIELD_BOX` (117–118): `field-box group flex min-h-control items-center gap-2 rounded-lg border border-border-strong
     bg-surface px-3` + transition (rule 3); drop `focus-within:*`.
   - `FIELD_CAPTION` (119–120): `text-label text-text-primary` (brief: Label-style labels; drops uppercase/tracking, the
     copy string is unchanged). Label wrappers (129, 150) `gap-1.5` → `gap-1`.
   - Icons (132, 153) `text-text-secondary`; input/select (134, 155) `flex-1 min-w-0 bg-transparent outline-none
     text-label text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50`.
5. **RoleBadge.tsx.** Replace `TIER_STYLES` (4–20) with a class map and drop the `style` prop:
   `user: "border-border bg-canvas text-text-secondary"`, `manager: "border-info/40 bg-info-tint text-info"`,
   `admin: "border-transparent bg-text-primary text-surface"` (inverse of text-primary on surface, so the AA pair already
   tested in slice 1 applies). Span (27): `inline-flex flex-none items-center rounded-sm border px-2 text-caption
   font-medium uppercase tracking-wide ${TIER_CLASSES[tier]} ${className}`. Text label unchanged.
6. **SegmentedFilter.tsx.** Track (20): `inline-flex flex-wrap gap-1 rounded-xl border border-border bg-canvas p-1`;
   button (31–35): `min-h-control cursor-pointer rounded-lg border px-3 text-label` + transition; drop the
   `focus-visible:*` classes and `font-[inherit]`; pressed `border-border-strong bg-surface text-text-primary
   shadow-card`, unpressed `border-transparent text-text-secondary hover:text-text-primary` (selected = background +
   border change, brief).
7. **Pending file.** After the edits run `node scripts/check-tokens.mjs --list`, confirm none of the 11 kit keys
   appears, copy the new `src/app/globals.css` count, delete the 11 keys, keep keys sorted. No other key may change; if
   one does, a non-kit file was edited by mistake.
8. **impl-log.md "Slice 3":** files; rename map (old class → new) for slices 4–6 to reuse; pending table before/after;
   visible differences (below); built-CSS confirmations (rule 2 preflight, rule 3 shorthand); checks output.
9. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (all edits stay in ui/pages/lib layers; KitGallery imports `@/ui`, unchanged), R3 (none), R4 (only the files
above), R5 (kit tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 3)
Helper in `kit.test.tsx`: `classes(html, selector)` returns the class tokens of the first matching element;
`LEGACY = /^(?:[\w-]+:)*(?:bg|text|border|outline|shadow)-(?:primary|on-primary|on-surface(?:-variant)?|surface-(?:high|highest|low|lowest|container)|outline(?:-variant)?|error|secondary[\w-]*|tertiary[\w-]*|accent-orange[\w-]*|[\w-]*-container)(?:\/\d+)?$|^rounded-md3/`
(anchored per class token, so `text-text-primary` and `bg-workspace-action` do not match).

| Test (file › name) | Covers |
|---|---|
| `kit.test.tsx` › Button: `filled` has `bg-workspace-action text-on-action` and `enabled:hover:bg-workspace-action-hover`; `pixel` has `bg-pixel-primary`, `shadow-pixel`, `enabled:hover:bg-pixel-hover`; `tonal` and `outlined` have `bg-surface`, `border-border`, `text-text-primary`; `danger` has `bg-danger-tint text-danger`; each renders `data-variant` equal to its variant | AC 2 variant → tokens |
| kit.test › Button: every size has `min-h-control`, `rounded-lg`, `text-label`; `lg` also `min-h-12`; no `rounded-full`, `font-bold`, `font-extrabold`, `text-[` | AC 3 (44 px, 14 px), Q2, Q7, Q8 |
| kit.test › Button disabled: has `disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`, no `pointer-events-none`; every class token containing `hover:` starts with `enabled:` | brief Disabled |
| kit.test › IconButton: `size-control rounded-lg`, `aria-label` and `title` equal `label`, no `style=` attribute; `active` adds `border-border` | 44×44, Q2 |
| kit.test › FilterChips: radiogroup; each radio `min-h-control rounded-md text-label`; checked radio has `bg-workspace-action text-on-action`, unchecked does not | selected state explicit |
| kit.test › Chip: `rounded-md text-caption border-divider`; default style uses `var(--color-canvas)` and `var(--color-text-primary)`; given `color` is passed through | Q2 chips 6 px |
| kit.test › Card: `rounded-xl border-divider bg-surface shadow-card`; `interactive` adds `hover:border-border-strong` | brief Cards, Q15 |
| kit.test › RoleBadge (extend existing): each tier has its class set from Approach 5, `rounded-sm text-caption uppercase`, no `style=` | badge tints, text label |
| kit.test › EntityFormDialog (extend): dialog has `rounded-2xl shadow-dialog bg-surface max-w-md`; submit button `type="submit"` + `data-variant="filled"`; cancel `data-variant="tonal"`; with `submitting` the submit is `disabled=""` | brief Dialogs, kit buttons |
| kit.test › DialogField / DialogSelect / FilledInput: box has `field-box`, `border-border-strong`, `rounded-lg`, and `min-h-control` (DialogField/Select) or `h-12` (FilledInput); caption `text-label`; no `focus-within:` class | Q6, focus on box |
| kit.test › StatTile: label `text-label`, value `text-title`, no `text-h2` | Q16 |
| kit.test › auth fields: Field label `text-label`, error `text-caption text-danger`; ShowPasswordToggle label `min-h-control`; Notice error has `bg-danger-tint` and `role="alert"` | Q8, 44 px |
| kit.test › no legacy alias or weight: render Button (all variants), IconButton, FilterChips, Chip, Pill (all tones), Card, SectionCard, FilledInput, EntityFormDialog with DialogField + DialogSelect, RoleBadge (all tiers), SegmentedFilter, TabBar, FormFooterBar, PageHeader, PageSkeleton, StatTile, Field, Notice; no class token matches `LEGACY`, `font-bold` or `font-extrabold` | Rules 1–2 for the whole kit |
| `layout-blocks.test.tsx` › TabBar (update 28–39): selected has `border-workspace-primary text-text-primary`, unselected has `border-transparent text-text-secondary`; both `min-h-control` | Q1 non-text coral |
| layout-blocks › SectionCard (update 105): `border-b border-divider` | |
| layout-blocks › Pill (update 121–126): tones → `bg-workspace-action`, `bg-canvas`, `bg-success-tint`, `bg-warning-tint`, `bg-danger-tint`, `bg-info-tint`; base `text-caption rounded-full` | badge tints |
| `SegmentedFilter.test.tsx` (update 25–28): pressed has `border-border-strong bg-surface text-text-primary shadow-card`; unpressed lacks `shadow-card`; both `min-h-control` | selected explicit |
| `Avatar.test.tsx` › `color` given → style contains `color:var(--color-on-action)`; no `#` colour in the markup | Q-S2-2 |
| `MyRequestRow.test.tsx` (update 35, 52, 61) | class rename only |
| `src/lib/color/tokens.test.ts` › add to `NON_TEXT_PAIRS`: `workspace-primary` on `surface` and `canvas` (tab indicator), `workspace-action` on `surface` and `canvas` (checkbox/radio fill); both themes ≥ 3 (computed now: light ≈ 3.4/3.3 and 4.55/4.4, dark ≈ 4.8 and 3.6) | WCAG 1.4.11 |
| tokens.test › globals.css: `.field-box:focus-within` rule has `outline: 2px solid var(--color-focus)` and `outline-offset: 2px`; the first `:focus-visible {` rule is still the global one; `accent-color: var(--color-workspace-action)` present; `.state-layer:not(:disabled):hover::after` present; no `.status-dot` | Approach 2 |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with the shrunk pending file | pending only shrinks |

### Acceptance → verification (slice 3)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S3-1 | Workspace filled buttons are `--color-workspace-action`/hover with white text; `pixel` variant uses pixel green + `--shadow-pixel`; secondary, danger, disabled follow the brief (AC 2, Q1, Q4) | kit.test Button tests green; `/dev/shell` in `pnpm dev`, light and dark |
| S3-2 | Kit targets ≥ 44 px (Button all sizes, IconButton, FilterChips, SegmentedFilter, TabBar, fields, ShowPasswordToggle); labels 14 px, metadata 12 px; no 700/800 weights in kit files (AC 3, Q7, Q8) | kit/layout-blocks/SegmentedFilter tests; `rg -n "font-(bold\|extrabold)\|text-\[\|min-h-11\|rounded-full" src/ui/{Button,Chip,Card,SectionCard,FilledInput,EntityFormDialog,RoleBadge,SegmentedFilter,TabBar,FormFooterBar,PageHeader,PageSkeleton,Avatar}.tsx src/ui/auth/fields.tsx src/ui/dashboard/StatTile.tsx` → only `rounded-full` in Pill, the Pill dot and Avatar |
| S3-3 | Inputs/selects have the strong border, 8 px radius, 44 px height, Label-style captions; the focus ring is on the field box; checkboxes/radios fill with the action colour (Q6) | tests above; keyboard-tab through the KitGallery dialog: one green ring around each field box, none doubled |
| S3-4 | Cards 12 px + `shadow-card` + divider border; dialog 16 px + `shadow-dialog`; badges caption, tints, text label (Q2, Q11, Q15) | Card/EntityFormDialog/RoleBadge/Pill tests |
| S3-5 | No legacy alias classes in kit files (Rule 1) | kit.test "no legacy alias or weight" green; `rg -n "on-surface\|outline-variant\|surface-high\|primary-container\|error-container\|rounded-md3\|field-focus\|card-shadow" <kit files above>` → no hits (Avatar default style excepted, Q-S3-2) |
| S3-6 | Pending list shrinks exactly for the kit (373 → 293 expected) and nothing else changes | `git diff main -- scripts/check-tokens.pending.json` shows only the 11 removed keys and `globals.css` 69 → 65; `node scripts/check-tokens.mjs` exits 0; `--list` output has none of the 11 kit paths |
| S3-7 | No API change for callers: variant names, `data-variant`, props kept (only `pixel`, `info` added; IconButton `size` removed with no caller) | `pnpm typecheck`; `git diff --stat main` lists only the Files table |
| S3-8 | Contrast: new non-text pairs pass 3:1 in both themes | tokens.test green |
| S3-9 | Checks green; existing tests changed only for class strings | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; reviewer reads test diffs |
| S3-10 | impl-log "Slice 3" has files, rename map, pending before/after, visible differences | read impl-log |

### Visible differences to log (slice 3)
- Every filled Button, the selected FilterChip, the EntityFormDialog Save button and the Tab "You" pill turn from
  near-black/ink to coral action `#D3441F` (hover `#B93B19`), white text (Q1, Q12). Sign-in/check-in buttons do **not**
  change colour yet: `.aw-card`/`.px-card [data-variant="filled"]` (unlayered) still override them until slice 6; they do
  get 14 px labels (was 15) and 44/48 px height.
- Buttons and IconButtons: pill → 8 px corners (Q2); `sm` buttons 36 → 44 px tall, so table rows with row actions
  (devices, members, requests, rooms, device types, incoming transfers, pending returns/extensions) grow by ~8 px; label
  13/15 → 14 px; weight 700 → 500; press no longer hides the cursor when disabled (not-allowed cursor shows); disabled
  opacity 40 % → 50 %.
- Secondary (tonal/outlined) border: divider `#E8ECE0` → border `#E1E4DE`, hover border-strong; danger button text
  `#B44C46` on 8 % tint (unchanged tokens, new classes).
- FilterChips: pill track → 8 px track with 6 px chips, 44 px tall (was ~38 px).
- Cards: 16 → 12 px radius; hover no longer adds the larger shadow, border darkens instead.
- Dialogs: 20 → 16 px radius, surface (was 5 % grey), brief dialog shadow; title 20 → 18 px · 600 (was 800); subtitle and
  error 13 → 14 px; width 440 → 448 px; field captions 11 px uppercase 800 → 14 px sentence case 500 (same strings);
  field borders darker (`#889282`, Q6); focus ring moves from an orange glow to the green 2 px ring around the box.
- Search/text fields (FilledInput): same border/ring change; text weight 500 → 500 label scale (unchanged size).
- Role badges: 10 px 800 → 12 px 500, 8 → 4 px radius; Manager is info blue tint, Admin stays solid ink.
- Pills/badges: 11 → 12 px; neutral pill on canvas instead of grey.
- Page headers (PageHeader) 20 px 800 → 18 px 600; section card titles 16 px 800 → 600; dashboard stat values 32 px →
  24 px Title, stat labels 13 → 14 px.
- Auth fields: labels 12 → 14 px ink; errors 12 px danger; notices 8 px radius.
- Tabs: active underline ink → coral (non-text, 3:1), active label ink 600, inactive secondary 500.
- Scrollbar thumb colours follow the border tokens.
- Interim (until slices 4–6): hand-rolled `bg-primary` buttons outside the kit stay ink — `InvitePeople.tsx:123`
  (slice 5), the AppShellView skip link `AppShellView.tsx:54` (slice 4), the SeatOverlay tag `SeatOverlay.tsx:204`
  (slice 6).

Ming verification after merge: open `/dev/shell` and two management screens (Members, Devices) at 390 / 800 / 1280 px
in light and dark; check coral buttons, 44 px row actions, a dialog with keyboard focus, and badges.

### Assumptions and non-blocking questions (slice 3)
- Hotspots: `scripts/check-tokens.pending.json` and `src/app/globals.css` are edited by every slice; SIM-070 (DONE, not
  merged) touches `src/ui/mapItems/**`, which uses `Button` but no kit file; if it merges first, only the pending file
  needs a rebase (`--list`). SIM-063 (IN_PROGRESS) is server work; no overlap.
- Size ≈ 400 changed lines (kit ~230, globals ~25, gallery ~30, tests ~110, pending ~12); no 3a/3b split needed. If the
  diff exceeds ~450 lines, the implementer moves KitGallery/gallery copy into slice 4 and records it.
- Q-S3-1 (non-blocking). Variant names stay `filled/tonal/outlined/text/danger` (+ `pixel`) instead of the brief's
  "primary/secondary". **Default: keep the names** (113 call sites, CSS selectors and tests); `filled` is documented as
  the brief's primary, `tonal`/`outlined` as secondary (now identical; merging them is a follow-up).
- Q-S3-2 (non-blocking). Avatar's default initials background is `--secondary-container` (5 % ink on surface), which has
  no brief token; `--color-canvas` would make avatars disappear on white cards. **Default: leave the two default
  inline values on the compat alias in this slice; slice 7, which removes the alias, maps them to
  `color-mix(in srgb, var(--color-text-primary) 5%, var(--color-surface))` defined once as a derived token in
  tokens.css, or Ming picks a brief token then.**
- Q-S3-3 (non-blocking). PageHeader and dialog titles are 20 px today, between Subtitle 18 and Title 24. **Default: the
  nearest step, Subtitle 18 px · 600** (Q16 reserves Display for page `h1`s and Title for metrics).
- Q-S3-4 (non-blocking). SectionCard/FormFooterBar icons: **default ink for the section icon (no coral on non-action
  icons), success green for the "saved" check** (status colour with its text label).
- Q-S3-5 (non-blocking). Checkbox/radio sizing (20 px box inside a 44 px label row) is per screen; **default: only the
  colour is global in this slice; screens get `min-h-control` label rows in slices 4–6.**

## Slice 4 addendum — Shell, sidebar and page containers
Status: READY. Written against slices 1–3 as merged (#154, #155, #158), Split proposal item 4 and Ming's approved
defaults (ticket.md:85, "theo mặc định hết"), especially Q3. No new decisions; open points are non-blocking questions at
the end, each with a default. Closes the shell part of AC 2 and AC 3, the brief's Sidebar and Page container rows, and
the shell part of AC 6b (layout at 390 / 800 / 1024 / 1280). One PR of about 300 changed lines (shell ~110, tests ~110,
31 one-line container swaps, globals ~20, pending 1). **No 4a/4b split**: the container swaps are one class string per
wrapper, with no logic and no test churn.

### Scope (from this plan and the brief)
- Split proposal item 4: "`src/ui/AppShellView.tsx` (lines 51–213: `lg:` → `md:` for the nav, `w-sidebar`, icon+label
  row, header/page padding to `--space-6/8`, `max-w-content`), `src/ui/AppShell.tsx`, `src/ui/RoomSwitcher.tsx`,
  `src/ui/AppShellView.test.tsx`, `src/ui/RoomSwitcher.test.tsx`; re-check `src/ui/roomlayout/LayoutEditorPage.tsx` and
  `RoomMap.tsx` widths at 800–1023."
- Q3 (approved): "216 px sidebar from 800 px replaces the 88 px rail at ≥1024; icon and label in one row; the bottom tab
  bar stays below 800 px (its `min-h-[68px]` snaps to the control scale); not collapsible. Content gets 128 px narrower
  at 800–1023 (room map, layout editor, tables re-checked in slice 4)." (At 800–1023 there was no rail before, so the
  content actually loses the full 216 px there; at ≥1024 it loses 128 px.)
- brief.md:134 "**Sidebar**: `--size-sidebar` wide, shown from `md` (800px) up." brief.md:135 "**Page container**:
  max-width `--width-content` (`--width-library` for library or grid-heavy pages), centered, `--space-6` to `--space-8`
  horizontal padding." brief.md:136 transitions; brief.md:132 badges (Caption, text label).
- Slice 3 interim note (plan, "Visible differences to log (slice 3)", last bullet): the AppShellView skip link
  (`AppShellView.tsx:54`) is the slice-4 hand-rolled `bg-primary` control.
- `src/ui/AppShell.tsx` (Split proposal) has **no class strings** (read: lines 1–59 only wire props); it is not
  modified. Named here so the reviewer does not expect a diff.

### Rules for every file in this slice
Same as slice 3 "Rules for every kit file" 1–5 (token utilities only, no legacy aliases, no 700/800 weights, token
transition `transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out`,
`enabled:hover:` only on `<button>`, no per-component focus classes). Plus:
6. No Tailwind palette colours (`red-*`, `amber-*`, …) and no inline `style` in the shell (the brand mark's inline
   `style` goes).
7. Behaviour, props, copy, hrefs, `aria-*`, ids, landmark order and the `lg:` RoleBadge wrapper
   (`AppShellView.test.tsx:169–173`) are unchanged. Only class strings and the new `data-slot="nav-indicator"` element
   change.
8. In the 21 page-wrapper files (20 feature files plus `PageSkeleton.tsx`, container table), **only** the wrapper's `p-4 lg:p-6` changes; any other class on that
   line and every other line stay for slices 5/6.

### Files (slice 4)
None matches a High path (`.github/risk-tiers.yml` high list: migrations, server auth, config, `next.config.*`,
`src/proxy.*`, `src/server/identity|http/**`, `scripts/check-layers.mjs`, `.env.example`, Docker/deploy, risk-tiers;
`src/ui/**`, `src/app/globals.css`, `src/app/dev/**` and `scripts/check-tokens.pending.json` are not listed).

| File | Change | Pending before → after |
|---|---|---|
| `src/ui/AppShellView.tsx` | outer, skip link, nav (sidebar/bottom bar), brand mark, nav links, indicator, badge, header, Credits link, org name, dev badge, room-switcher bar, signed-out placeholder per Approach 1; doc comment line 17 → "sidebar (>= 800 px) or bottom bar" | 32 → 0 (remove key) |
| `src/ui/RoomSwitcher.tsx` | select (line 37) per Approach 2 | not pending (stays 0) |
| `src/app/globals.css` | add `@utility page-content` and `@utility page-library` after the shadow utilities (after line 224); delete `--accent-shadow` (line 27, its only user is the brand mark) | 65 → 65 (no flagged value added or removed; confirm with `--list`) |
| `scripts/check-tokens.pending.json` | remove `src/ui/AppShellView.tsx` | total −32 |
| Page wrappers (21 files, 29 lines, table in Approach 3) | `p-4 lg:p-6` → `page-content` or `page-library` | unchanged counts (the replaced classes were on-scale) |
| `src/app/dev/shell/KitGallery.tsx` | line 35 `p-4 lg:p-6` → `page-content` | not pending |
| `src/ui/AppShellView.test.tsx` | dev-badge class asserts (75, 79, 87) + new tests (Tests below) | test |
| `src/ui/RoomSwitcher.test.tsx` | new select class test | test |
| `src/ui/page-container.test.ts` | create: wrapper scan (Tests below) | test |
| `src/lib/color/tokens.test.ts` | add `page-content`/`page-library` rule checks to the `globals.css` describe (line 173) | test |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 4": files, rename map additions, pending before/after, built-CSS confirmation (Approach 3), width table (Approach 4), visible differences, checks | deliverable |

Not touched: `src/ui/AppShell.tsx` (no classes), `ThemeToggle.tsx`, `Button.tsx`, `Avatar.tsx`, `RoleBadge.tsx` (kit,
slice 3), `src/lib/nav.ts`, `src/ui/copy/shell.ts` (no copy change), `src/styles/tokens.css` (no new token; `w-sidebar`,
`max-w-content`, `max-w-library`, `min-h-control` already exist from slice 1, globals.css:168–172),
`RoomMap.tsx`, `LayoutEditor.tsx`, `EditorCanvas.tsx`, `src/lib/breakpoints.ts` (width check only, Approach 4; no code
change expected).

### Approach (slice 4)
1. **AppShellView.tsx** (class strings; JSX structure unchanged except the indicator span and removal of the brand
   mark's `style`):
   - Outer (51): `flex flex-col-reverse md:flex-row h-dvh w-full overflow-hidden text-text-primary`.
   - Skip link (54): `sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:inline-flex
     focus:min-h-control focus:items-center focus:rounded-lg focus:bg-workspace-action focus:px-4 focus:text-label
     focus:text-on-action` (coral action fill, white text 4.55:1, the global green focus ring sits outside it with its
     2 px offset; `z-[70]` is not a guard violation and stays).
   - `<nav>` (62–65): `flex-none flex md:flex-col md:w-sidebar md:gap-2 md:px-3 md:pt-4 md:pb-4 md:overflow-y-auto
     pb-[env(safe-area-inset-bottom)] bg-surface border-t md:border-t-0 md:border-r border-divider z-10`. Drops
     `items-center justify-around lg:justify-start`, `lg:w-[88px]`, `lg:py-3.5`, `min-h-[68px] lg:min-h-0`,
     `lg:pb-3.5`. `overflow-y-auto` keeps all 11 admin entries reachable on short windows.
   - Brand mark (67–74): wrapper `hidden md:flex px-3 pb-2`; mark `flex size-10 items-center justify-center rounded-lg
     bg-workspace-primary text-on-action shadow-card` (no `style`; white icon on coral 3.4:1 is a non-text pair already
     ≥ 3, slice 3 `NON_TEXT_PAIRS`). Icon unchanged.
   - Link list (75): `flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible` (`gap-1.5` → `gap-1`; drops
     `justify-start`, the default).
   - Nav link (85–86): `state-layer relative flex flex-col md:flex-row items-center gap-1 md:gap-3 flex-1 md:flex-none
     min-w-16 md:w-full min-h-16 md:min-h-control px-1 py-2 md:px-3 md:py-0 rounded-lg no-underline text-text-secondary
     hover:text-text-primary aria-[current=page]:bg-canvas aria-[current=page]:font-semibold
     aria-[current=page]:text-text-primary` + token transition. Bottom bar (< 800): icon above label, 64 px tall cell
     (replaces `min-h-11` + `min-h-[68px]` bar); sidebar (≥ 800): icon and label in one 44 px row, full sidebar width.
   - Active indicator (new, rendered only when `active`, first child of the link): `<span aria-hidden="true"
     data-slot="nav-indicator" className="absolute rounded-full bg-workspace-primary inset-x-3 top-0 h-1
     md:inset-x-auto md:left-0 md:inset-y-2 md:h-auto md:w-1" />` (coral bar, non-text, 3.4:1 on surface; top edge in
     the bottom bar, left edge in the sidebar). Together with the filled icon, 600 weight and canvas background, the
     selected state does not rely on colour alone.
   - Icon wrapper (88–95): `relative flex size-8 flex-none items-center justify-center` for every entry (drops the
     `w-14 h-8 rounded-md3` pill and the active `bg-secondary-container … border-outline-variant`; the indicator
     replaces it). `Icon` call unchanged.
   - Count badge (100): `absolute -top-1 -right-2 min-w-5 h-5 px-1 rounded-full border border-surface bg-danger-tint
     text-danger text-caption leading-4 font-semibold text-center` (must still start with `absolute`: tests at 242, 247,
     263, 279, 285, 310 match `class="absolute`). Same colours as today through the slice-1 aliases (`danger` on
     `danger-tint` is an asserted AA pair); 10 → 12 px.
   - Nav label (106): `text-caption md:text-label whitespace-nowrap` (11 px → 12 px bottom bar, 14 px sidebar; drops
     `font-semibold tracking-[0.02em]`; active weight comes from the link).
   - Header (123): `h-16 flex-none flex items-center gap-2 px-4 md:px-6 bg-surface border-b border-divider z-[5]`.
   - Brand (124): `text-subtitle text-text-primary whitespace-nowrap` (18 px · 600; drops `font-heading
     text-[18px] font-extrabold tracking-[-0.01em]`).
   - Version (131): `flex-none whitespace-nowrap text-caption text-text-secondary`.
   - Credits link (138): `inline-flex min-h-control min-w-control flex-none items-center justify-center
     whitespace-nowrap text-caption text-text-secondary underline hover:text-text-primary
     aria-[current=page]:text-text-primary` (44×44 target, AC 3).
   - Org name (142): `ml-2 min-w-0 max-w-[40vw] truncate text-label text-text-secondary` (`max-w-[40vw]` is not a guard
     violation and stays).
   - Dev badge (148–152): `inline-flex flex-none items-center whitespace-nowrap rounded-sm border px-2 text-caption
     font-semibold uppercase tracking-wide` + dev `border-warning bg-warning-tint text-warning`, prod `border-danger
     bg-danger-tint text-danger` (Q-S4-2; text label unchanged: "Production data" vs the dev label).
   - Room-switcher bar (200): `flex-none flex items-center gap-2 px-4 md:px-6 py-2 bg-surface border-b border-divider`.
   - Signed-out placeholder (213–221): wrapper `page-content`; icon `text-text-secondary`; h1 `text-h2 font-semibold
     text-text-primary` (same as `PageSkeleton.tsx:17`); p `text-label text-text-secondary`. Card and Button unchanged.
2. **RoomSwitcher.tsx** select (37): `min-w-0 flex-1 md:max-w-xs min-h-control rounded-lg border border-border-strong
   bg-surface px-3 text-label text-text-primary cursor-pointer` + token transition (control boundary 3:1, Q6; 40 → 44 px
   tall, same as the kit's `DialogSelect`). The Go `Button size="sm"` is already 44 px (slice 3). Focus: global ring.
3. **Page containers.** globals.css, after `@utility shadow-pixel` (line 224):
   ```css
   /* Page container (brief): centred, capped width, --space-6 to --space-8 side padding from md. 800/1280 are the
      md/xl breakpoints (CSS variables cannot be used in media queries). */
   @utility page-content {
     width: 100%;
     max-width: var(--width-content);
     margin-inline: auto;
     padding: var(--space-4);
     @media (width >= 800px) {
       padding: var(--space-6);
     }
     @media (width >= 1280px) {
       padding-inline: var(--space-8);
     }
   }
   @utility page-library {
     /* same body with max-width: var(--width-library) */
   }
   ```
   (`page-library` is written out in full, not via `@apply`.) Implementer confirms once in the built CSS that both
   classes are emitted with the two media blocks; if Tailwind 4.3.x does not accept nested `@media` in `@utility`,
   use `@variant md { … }` / `@variant xl { … }` inside the utility instead and record it. `max-width` includes the
   padding (global `box-sizing: border-box`, globals.css:182–184).

   Wrapper swaps (`p-4 lg:p-6` → the class; the rest of the class string unchanged):

   | File:line | Class |
   |---|---|
   | `src/ui/AppShellView.tsx:213`, `src/ui/PageSkeleton.tsx:16`, `src/app/dev/shell/KitGallery.tsx:35` | `page-content` |
   | `src/ui/audit/AuditView.tsx:48, 63` | `page-content` |
   | `src/ui/checkin/CheckinPage.tsx:288`, `src/ui/checkin/CheckinView.tsx:90` | `page-content` |
   | `src/ui/credits/CreditsPage.tsx:8` | `page-content` |
   | `src/ui/dashboard/DashboardView.tsx:84` | `page-content` |
   | `src/ui/devices/DeviceDetailView.tsx:89`, `src/ui/devices/DevicesView.tsx:46` | `page-content` |
   | `src/ui/groups/GroupsView.tsx:50, 61` | `page-content` |
   | `src/ui/members/MembersView.tsx:49` | `page-content` |
   | `src/ui/portal/PortalPage.tsx:26, 47` | `page-content` |
   | `src/ui/requests/ApprovalsPage.tsx:145`, `src/ui/requests/ApprovalsView.tsx:56, 68` | `page-content` |
   | `src/ui/rooms/RoomsView.tsx:34` | `page-content` |
   | `src/ui/search/SearchPage.tsx:39`, `src/ui/search/SearchView.tsx:144` | `page-content` |
   | `src/ui/deviceTypes/DeviceTypesView.tsx:29, 40` | `page-library` (sprite library grid, Q-S4-1) |
   | `src/ui/mapItems/MapItemsView.tsx:42, 53` | `page-library` (library page) |
   | `src/ui/seats/SeatsPage.tsx:298`, `src/ui/seats/SeatsView.tsx:59` | `page-library` (room detail with the room map) |
   | `src/ui/roomlayout/LayoutEditorPage.tsx:42` | `page-library` (layout editor) |

   Before editing, the implementer re-runs `rg -n "p-4 lg:p-6" src` (expected: exactly the 31 lines in the
   table, in 23 files including AppShellView and KitGallery) and `rg -ln "lg:p-|md:p-" src/ui src/app` to catch any page wrapper with a different padding;
   any extra hit is listed in impl-log and either swapped (same rule) or left with a reason. A file's loading/error
   wrapper uses the same class as its main view.
4. **Width check at 800–1023 and 1024 (no code change expected).** Content width = viewport − 216 − 2 × 24:
   800 → 536 px; 1023 → 759; 1024 → 760; 1280 → 1280 − 216 − 2 × 32 (xl padding) = 1000.
   - Layout editor: gate stays `MEDIA.lg` (`LayoutEditorPage.tsx:23`), so 800–1023 shows the existing "desktop only"
     state (unchanged). At 1024 the grid `grid-cols-[minmax(0,1fr)_18rem] gap-4` (`LayoutEditor.tsx:193`) leaves the
     canvas column 760 − 288 − 16 = 456 px (was 1024 − 88 − 48 − 304 = 584). `EditorCanvas.tsx:242` scrolls
     (`max-h-[70vh] overflow-auto`), and `EditorToolbar.tsx:26` wraps (`flex-wrap`), so it stays usable. Accepted per
     Q3; Ming checks (Q-S4-4).
   - Room map (`RoomMap.tsx:179`): `overflow-auto` region; at 800 the region is 536 px wide and scrolls horizontally.
   - Other viewport-breakpoint layouts that now get less room (re-check only, no edit in this slice, R4; fixes go to
     slices 5/6 or follow-ups): `md:` cards/tables in `DeviceTable.tsx:34/83`, `IncomingTransfers.tsx:60,75`,
     `OverdueBanner.tsx:43`, `PendingExtensions.tsx:60,78`, `PendingReturns.tsx:60,75` (switch to the wide layout at
     800 with 536 px of content); `lg:` grids in `CheckinView.tsx:71` (`1fr 300px` → 1fr = 444 px at 1024),
     `DashboardView.tsx:28`, `MySeatView.tsx:83`, `ProfileTabView.tsx:41`, `MyDevicesTiles.tsx:49`; `xl:` grids in
     `AuditView.tsx:66`, `DashboardView.tsx:29`, `RoomsView.tsx:20`.
   - Implementer runs `pnpm dev` and records a width table in impl-log (screen × 390 / 800 / 1024 / 1280: fine / scrolls
     / cramped, with one line on anything cramped). Anything cramped becomes a follow-up, not a fix here.
5. **Pending file.** After the edits run `node scripts/check-tokens.mjs --list`; confirm `src/ui/AppShellView.tsx` is
   absent and every other count is unchanged (globals.css stays 65); delete that key; keep keys sorted.
6. **impl-log.md "Slice 4"**: files; rename map additions (`border-outline-variant` → `border-divider`,
   `text-on-surface(-variant)` → `text-text-primary/secondary`, `bg-error-container text-on-error-container` →
   `bg-danger-tint text-danger`, `p-4 lg:p-6` → `page-content`/`page-library`); pending before/after; built-CSS
   confirmation for the two utilities; width table; visible differences (below); checks output.
7. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (ui and dev-page files only; no new imports; globals.css is CSS), R3 (none), R4 (only the files above;
wrapper lines only in the 20 feature files), R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 4)
Helpers in `AppShellView.test.tsx`: `classesOf(html, re)` returns the class tokens of the first tag matching `re`;
`LEGACY` copied from `src/ui/kit.test.tsx` (slice 3) plus `PALETTE = /^(?:[\w-]+:)*(?:bg|text|border)-(?:red|amber|orange|yellow|green|blue|gray|slate|zinc|neutral|stone)-\d{2,3}$/`.

| Test (file › name) | Covers |
|---|---|
| `AppShellView.test.tsx` › devToken (update 75, 79, 87): dev badge has `bg-warning-tint text-warning border-warning`, prod `bg-danger-tint text-danger border-danger`; "no devToken" asserts `not.toContain("bg-warning-tint")`; both `rounded-sm text-caption` | Rule 6, badge mapping |
| AppShellView › sidebar from md: outer `div` has `flex-col-reverse md:flex-row`; `<nav>` has `md:w-sidebar md:flex-col md:border-r border-divider bg-surface md:overflow-y-auto`; no class token inside `<nav>…</nav>` starts with `lg:` | Q3 (216 px from 800, replaces rail) |
| AppShellView › nav links: every `<a>` in the nav has `min-h-16`, `md:min-h-control`, `md:flex-row`, `md:w-full`, `rounded-lg`; every nav label span has `text-caption md:text-label` | 44 px targets, icon + label row, 12/14 px |
| AppShellView › active entry: on `/rooms/A1` exactly one `data-slot="nav-indicator"`, inside the `/rooms` link, `aria-hidden="true"`, class has `bg-workspace-primary`; on `/` (user) it sits in the `/` link | selected state explicit, coral non-text |
| AppShellView › nav badge (extend 240–336 group): badge class has `bg-danger-tint text-danger text-caption`; existing `class="absolute` regexes unchanged and green | badge mapping, 12 px |
| AppShellView › header controls: Credits link has `min-h-control min-w-control`; brand span has `text-subtitle`; version `text-caption`; header has `md:px-6 border-divider` | AC 3, type scale |
| AppShellView › skip link: `href="#main"` element has `focus:bg-workspace-action focus:text-on-action focus:min-h-control focus:rounded-lg` and `sr-only` | slice 3 interim item |
| AppShellView › tokens only: for admin, manager, user (with badges, devToken dev and prod, roomSwitcher) and signed out, no class token matches `LEGACY`, `PALETTE`, `font-bold`, `font-extrabold`, `/^(?:[\w-]+:)*(?:text\|rounded\|shadow\|tracking\|leading)-\[/` or `/\[[^\]\s]*\d(?:px\|rem\|em)[^\]\s]*\]/`; the `<nav>` markup has no `style=` | Rules 1, 6 |
| AppShellView › signed out: the placeholder wrapper has `page-content`; existing test 133–139 unchanged | page container |
| AppShellView › existing tests 27–60, 91–131, 141–213 unchanged and green (hrefs, aria-current count, RoleBadge `hidden lg:inline-flex` wrapper, switcher order) | Rule 7 (no behaviour change) |
| `RoomSwitcher.test.tsx` › select styling: `<select>` has `min-h-control rounded-lg border-border-strong bg-surface text-label text-text-primary md:max-w-xs`; no `h-10`, `rounded-md3`, `lg:` class | Q6, 44 px |
| `src/ui/page-container.test.ts` (new, node, reads files like `tokens.test.ts:5`) › no file under `src/ui` or `src/app` (non-test `.tsx`) contains `p-4 lg:p-6` | container adopted everywhere |
| page-container.test › `DeviceTypesView.tsx`, `MapItemsView.tsx`, `SeatsPage.tsx`, `SeatsView.tsx`, `LayoutEditorPage.tsx` contain `page-library` and not `page-content`; the 18 other files in Approach 3 (incl. `AppShellView.tsx`, `PageSkeleton.tsx`, `KitGallery.tsx`) contain `page-content` | Q-S4-1 width split |
| `src/lib/color/tokens.test.ts` › globals.css (add to describe at 173): `@utility page-content` block has `max-width: var(--width-content)`, `margin-inline: auto`, `var(--space-6)` and `var(--space-8)`; `@utility page-library` has `max-width: var(--width-library)`; no `--accent-shadow` | brief Page container |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with `AppShellView.tsx` removed from pending | pending only shrinks |

### Acceptance → verification (slice 4)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S4-1 | 216 px sidebar from 800 px replaces the 88 px rail; icon and label in one row; bottom bar below 800; not collapsible (Q3, brief:134) | AppShellView sidebar/nav-links tests; `rg -n "88px\|lg:w-\|lg:flex-col" src/ui/AppShellView.tsx` → no hits; no toggle/collapse state added (`git diff` of AppShellView has no `useState`) |
| S4-2 | Selected nav entry is explicit (indicator + weight + background + filled icon), not colour only; coral only as non-text | active-entry test; slice 3 `NON_TEXT_PAIRS` still green |
| S4-3 | Shell targets ≥ 44 px (nav links, Credits, skip link, room select, IconButtons); labels 14 px in sidebar, metadata 12 px; no text below 12 px | nav-links, header-controls, skip-link, RoomSwitcher tests; `rg -n "text-\[" src/ui/AppShellView.tsx src/ui/RoomSwitcher.tsx` → no hits |
| S4-4 | Shell uses tokens only: no legacy alias, palette colour, arbitrary px/radius/shadow/size, 700/800 weight, inline style in the nav | "tokens only" test; `node scripts/check-tokens.mjs --list` has no `AppShellView.tsx` key |
| S4-5 | Pages sit in a centred container capped at 1320 px (1600 for library/grid-heavy), 24 px side padding from 800, 32 px from 1280 (brief:135) | page-container tests; tokens.test globals rule; `pnpm build` then `grep -o "\.page-content{[^}]*" .next/static/css/*.css` shows `max-width:var(--width-content)` and the media blocks exist |
| S4-6 | No behaviour, copy, href or landmark change | existing AppShellView/RoomSwitcher tests unchanged and green; `git diff main -- src/ui/copy src/lib` empty; in the 20 feature files `git diff -U0` shows only `p-4 lg:p-6` → `page-*` changes |
| S4-7 | Pending shrinks exactly by AppShellView (−32), nothing else changes | `git diff main -- scripts/check-tokens.pending.json` shows one removed key; `node scripts/check-tokens.mjs` exits 0 |
| S4-8 | Width check at 800–1023/1024/1280 recorded, nothing outside the plan edited for it | impl-log width table; `git diff --stat main` lists only the Files table |
| S4-9 | Checks green; existing tests changed only for class strings | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; reviewer reads test diffs |
| S4-10 | impl-log "Slice 4" complete (files, rename map, pending, built CSS, width table, visible differences) | read impl-log |

### Visible differences to log (slice 4)
- Navigation: from 800 px a 216 px white sidebar with icon + label rows (14 px) replaces the 88 px icon-over-label rail,
  which used to appear only from 1024 px; 800–1023 px windows switch from the bottom bar to the sidebar. Active entry:
  coral bar on the left edge, light canvas row, 600 label, filled icon (was a grey pill around the icon).
- Bottom bar (< 800 px): 68 → 64 px cells, labels 11 → 12 px, coral bar on top of the active entry instead of the grey
  icon pill; still scrolls sideways for admins (11 entries).
- Brand mark: rounded 12 → 8 px, orange glow shadow → card shadow, same coral fill and icon.
- Nav count badges: 10 px 800 → 12 px 600, 18 → 20 px circle, same danger tint colours.
- Header: brand 18 px 800 → 18 px 600; version and Credits 11 → 12 px; Credits now a 44 × 44 target; org name 13 →
  14 px; side padding 20 → 24 px from 800 (was from 1024); bottom border divider `#E8ECE0`.
- Dev/prod token badge: solid amber/red Tailwind colours → warning/danger tint with coloured border and text, 10 → 12
  px, 8 → 4 px corners (label text unchanged).
- Room switcher select: 40 → 44 px, 12 → 8 px corners, strong control border, 14 px label weight 500 (was 600);
  capped at 320 px from 800 (was from 1024).
- Skip link: ink pill → coral action fill, 8 px corners, 44 px tall, 14 px 500.
- Pages: content capped at 1320 px (Map items, Device types, room detail and layout editor at 1600 px) and centred;
  padding 24 px from 800 (was 24 from 1024), sides 32 px from 1280. The cap shows on windows wider than 1536 px
  (1320 + 216; padding is inside the cap) and 1816 px for the library width, and as extra padding at 800–1023.
- Content area 216 px narrower at 800–1023 and 128 px narrower at ≥ 1024: layout editor canvas column 584 → 456 px at
  1024; `md:` device cards and tables switch to the wide layout with 536 px of content at 800 (width table in impl-log).

### Ming verification after merge
- Open the app as Admin at 390, 800, 1023, 1024 and 1280 px (light and dark): bottom bar below 800, sidebar from 800,
  all 11 entries reachable (scroll the sidebar on a short window), active entry clearly marked, badges readable.
- Tab from the address bar: the first Tab shows the coral "Skip to main content" link with the green ring; Enter jumps to
  the page.
- Room detail with the map and the layout editor at 1024 px: the editor canvas (456 px column) and the map scroll and
  stay usable; if too cramped, say so (follow-up, Q-S4-4).
- Devices list and My Portal at 800 px: the wide card/table layout fits 536 px of content.
- A wide monitor (≥ 1600 px): pages are centred at 1320 px; Map items and room detail use 1600 px.
- `pnpm dev` with a dev token: the dev badge (amber tint) is still obvious; with a prod token the red-tint "Production
  data" badge is still obvious (Q-S4-2).

### Assumptions and non-blocking questions (slice 4)
- Hotspots: the 20 feature page-wrapper files are edited again (more broadly) in slices 5 and 6; slice 4 merges first, so no
  conflict inside this ticket. `scripts/check-tokens.pending.json` and `src/app/globals.css` as in every slice. SIM-066.1
  (DONE, pixel character card polish) may touch `src/ui/portal/**`; if it merges first, `PortalPage.tsx` may need a
  one-line rebase. No other open ticket edits the shell.
- Size ≈ 300 changed lines; if it exceeds ~450, the implementer moves the 20 feature-file wrapper swaps (and
  `page-container.test.ts`'s first two cases) to the start of slice 5 and records it; the shell and the two utilities
  stay in slice 4.
- Q-S4-1 (non-blocking). Which pages are "library or grid-heavy" (brief:135)? **Default: Map items and Device types
  (sprite libraries), room detail (`SeatsPage`/`SeatsView`, room map) and the layout editor use `page-library` (1600);
  every other page `page-content` (1320), including Rooms (a card grid of at most three columns).**
- Q-S4-2 (non-blocking). The dev/prod token badge used Tailwind amber/red fills; white text on `--color-danger` fails AA
  in dark (≈ 2.5:1). **Default: tint fills (`warning-tint`/`danger-tint`) with coloured border and text, both asserted AA
  pairs; the label text distinguishes them.** A stronger solid prod badge would need a new token (slice 7 or Ming).
- Q-S4-3 (non-blocking). Below 800 px the brief gives no padding; **default: 16 px (`--space-4`) on phones, 24 px from
  800, 32 px from 1280** (brief's 24–32 applies where the sidebar is shown).
- Q-S4-4 (non-blocking). The layout editor at 1024–1279 gets a 456 px canvas column. **Default: accept (the canvas
  scrolls, the editor gate stays at `lg`); a narrower inspector or a gate change is a follow-up if Ming finds it
  cramped.**
- Q-S4-5 (non-blocking). The sidebar shows the brand mark only; the "simap" word, version and Credits stay in the header.
  **Default: keep the header as is (no IA change).**
- Q-S4-6 (non-blocking). `LEGACY` is duplicated from `kit.test.tsx` into `AppShellView.test.tsx`. **Default: accept the
  copy; slice 7 (which removes the aliases) replaces both with the token guard.**
