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
