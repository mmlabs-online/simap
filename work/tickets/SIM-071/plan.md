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

## Slice 5 addendum — Management screens
Status: READY. Written against slices 1–4 as merged (#154, #155, #158, #160), Split proposal item 5 and Ming's approved
defaults Q1–Q17 (ticket.md:85, "theo mặc định hết"). No new decisions; open points are non-blocking questions at the end,
each with a default. Closes AC 2, AC 3 and AC 6b for the management screens (clean kit, coral; D52). The end-user and
pixel surfaces (`portal/**`, `checkin/**`, `roomlayout/**`, `mapItems/**`, `auth/**` chrome) stay in slice 6.

### Size and split
Measured on `main` after #160 (non-test `.tsx` in the slice-5 folders): ~430 lines carry a legacy alias, raw Tailwind
size, 700/800 weight or arbitrary value, in 63 files, plus 101 guard violations in 20 pending files. One PR would be
well over ~1000 changed lines, so slice 5 ships as **three PRs by screen group** (Split proposal allowed 5a/5b; 5b as
one PR would still be ~800 changed lines, so it is cut once more):

| Sub-slice | Screens (folders) | Pending files → 0 | Pending total |
|---|---|---|---|
| **5a** (this addendum, fully specified) | Members + invitations, Groups, Approvals, Audit, Org (profile, picker, switcher), Credits | 5 files, 17 violations | 261 → 244 |
| 5b (outlined) | Devices (incl. incoming transfers, returns, extensions, overdue), Device types | 16 files, 60 | 244 → 184 |
| 5c (outlined) | Dashboard, Search, Rooms, Seats / room-detail chrome (`SeatDetailPanel`, `SeatsView`, seat dialogs) | 8 files, 41 | 184 → 143 |

5a ≈ 470 changed lines (screens ~240, `table.ts` ~20, tests ~170, pending 5, impl-log ~40). 5b and 5c each get a short
addendum (files and line numbers re-read on the then-current `main`) using the rules below unchanged. "Admin pages
under `src/app/**/page.tsx`" have no class strings (`rg -l className src/app` → only `layout.tsx`, `dev/roommap`,
`dev/shell`), so no `src/app` page is edited in slice 5.

### Scope (from this plan, the brief and slice-4 review)
- Split proposal item 5: "Management screens (clean kit, coral; mechanical class sweep with a rename map, off-scale sizes
  snapped, 700/800 → 600) … and their `*.test.tsx` class assertions."
- Approved defaults: Q1 (filled = `workspace-action`, coral only non-text), Q2 (buttons 8 px, chips 6 px, badges full or
  4 px), Q6 (control boundaries `border-border-strong`), Q7 (600 headings/titles/metrics, 500 labels/buttons, 400 body),
  Q8 (no 13 px: labels/controls 14, metadata 12), Q13 (pending/warn → amber), Q15 (cards keep a divider border), Q16
  (page headings Display 32/40 · 600).
- AC 3: "Interactive targets are at least 44×44 px; body and control labels at least 14 px; metadata 12 px; every status
  has a text label". brief.md:132 "badges … Always include a text label".
- Slice-3 interim (plan, "Visible differences to log (slice 3)", last bullet): "`InvitePeople.tsx:123` (slice 5)" is a
  hand-built `bg-primary` (near-black) button.
- Slice-4 review follow-ups (review.md:220, 238–239): "Slice 5 should replace it with a recursive scan
  (`readdirSync(..., { recursive: true })`, filter `.tsx` and not `.test.`)"; "Possibly cramped layouts … (`md:` device
  cards/tables at 800 …): slices 5/6 if Ming confirms." The recursive scan is in 5a; the device tables are devices
  screens, so they are in 5b (rule below, default Q-S5-6).

### Rules for every slice-5 file (5a, 5b, 5c)
Same as slice 3 "Rules for every kit file" 1–5 and slice 4 rules 6–7 (token utilities only, no legacy alias, no
700/800, token transition string, `enabled:hover:` on buttons, no per-component focus classes, no Tailwind palette
colours, behaviour/props/copy/ids/`aria-*` unchanged). Plus:

**R-a Class rename map** (old → new; apply as whole class tokens, including after a variant prefix such as `hover:` or
`md:`; `text-primary` only where it is the whole class, never inside `text-text-primary`):

| Old | New |
|---|---|
| `text-on-surface`, `text-on-background`, `text-on-secondary-container`, `text-primary` (ink) | `text-text-primary` |
| `text-on-surface-variant`, `text-secondary` | `text-text-secondary` |
| `text-error`, `text-on-error-container`, `text-status-alert` · `bg-error-container` · `border-error` | `text-danger` · `bg-danger-tint` · `border-danger` |
| `text-on-success-container`, `text-status-online` · `bg-success-container` | `text-success` · `bg-success-tint` |
| `text-on-warning-container`, `text-status-warn` · `bg-warning-container` | `text-warning` · `bg-warning-tint` |
| `text-tertiary`, `text-on-tertiary-container` · `bg-tertiary-container` | `text-info` · `bg-info-tint` |
| `bg-status-online` / `-warn` / `-alert` (dots, bars) | `bg-success` / `bg-warning` / `bg-danger`, with an adjacent visible text label (R-e) |
| `bg-background`, `bg-surface-container`, `bg-surface-high`, `bg-secondary-container` | `bg-canvas` |
| `bg-surface-lowest`, `bg-surface-low` | `bg-surface` |
| `bg-surface-highest` (skeleton/track fills) | `bg-divider` |
| `border-outline-variant`, `divide-outline-variant` | `border-divider`, `divide-divider` |
| `border-outline` | `border-border-strong` on input/select/checkbox/radio boundaries (Q6), `border-border` elsewhere |
| `bg-primary text-on-primary` on a `<button>`/`<a>` | kit `<Button>` (`variant="filled"`), see R-f |
| `bg-primary text-on-primary`, `bg-inverse-surface text-inverse-on-surface` on a static badge | `bg-text-primary text-surface` (RoleBadge admin pattern, AA pair already tested) |
| `bg-`/`border-`/`text-accent-orange` on icons, bars, rings (non-text) | `bg-`/`border-`/`text-workspace-primary` |
| `text-accent-orange` on text | `text-text-primary` (coral text is below 4.5:1 on canvas) |
| `bg-accent-orange-soft` | `bg-canvas` |
| `var(--on-surface)` etc. inside `style` | `var(--color-…)` per the same rows |
| Tailwind palette (`red-600`, `amber-100`, …) | the matching status token (`danger`, `warning-tint`, …) |

**R-b Type snap (13 px and raw sizes; Q7, Q8, Q16).** Weights are preserved except 700/800 → 600:

| Old | New |
|---|---|
| `text-h2 …` on a page `<h1>`; `text-2xl`/`text-3xl` on a page `<h1>` | `text-display` (32/40 · 600; drop the weight class) |
| `text-h3`, `text-lg`, `text-xl` (section `<h2>`/`<h3>`, card titles) | `text-subtitle` (18/28 · 600; drop the weight class) |
| `text-2xl` metric values | `text-title` |
| `text-base` | `text-body` |
| `text-sm` (no weight) | `text-label font-normal` |
| `text-sm font-medium` | `text-label` |
| `text-sm font-semibold` / `font-bold` / `font-extrabold` | `text-label font-semibold` |
| `text-xs` (+ weight) | `text-caption` (+ `font-semibold` if it had 600–800, `font-medium` if 500) |
| `text-[13px]`, `text-[14px]` | `text-label` (weight per the `text-sm` rows) |
| `text-[10px]`, `text-[11px]`, `text-[12px]` | `text-caption` |
| `text-[15px]`, `text-[16px]` | `text-body` (`text-label` when it is a control label) |
| table header `text-[11px] font-extrabold uppercase` | `TABLE_HEAD` (R-g): 12 px · 600 uppercase `tracking-wide` |
| `font-bold`, `font-extrabold`, `font-black` anywhere else | `font-semibold` |
| `font-heading`, `font-[inherit]`, `leading-[…]` | delete; `tracking-[…]` → delete, or `tracking-wide` on uppercase text |

**R-c Arbitrary-value sweep.** `[Nrem]` on `w/min-w/max-w/h/min-h/max-h` → spacing step N×4 (`min-w-[56rem]` →
`min-w-224`, `[40rem]` → `min-w-160`, `[32rem]` → `min-w-128`, `[14rem]` → `min-w-56`); `[Npx]` sizes → N/4 step,
rounded to the nearest whole step (44 px controls → `min-h-control`/`size-control`); `rounded-[Npx]` → nearest radius
(≤ 5 `sm`, 6 `md`, 7–10 `lg`, 11–14 `xl`, ≥ 15 `2xl`); `rounded-md3-sm`/`rounded-md3` → `rounded-lg` on controls,
`rounded-xl` on cards; `rounded-md3-lg` → `rounded-xl`; `rounded-md3-xl` → `rounded-2xl`; `rounded-full` on a button →
`rounded-lg` (Q2); `shadow-[…]`, `shadow-sm|md|lg` → `shadow-card` (cards, popovers) or `shadow-dialog` (dialogs);
`duration-[…]`/`ease-[…]` → the `TRANSITION` string of `src/ui/Button.tsx:8–9`; hex/`rgb()` in screen code → the
matching token. Arbitrary values the guard does not flag (`z-[70]`, `max-w-[40vw]`, `w-[var(--x)]`) stay. A flagged
`rem`/`px` inside a grid template (e.g. `grid-cols-[1fr_300px]`) becomes the v4 spacing function
(`grid-cols-[1fr_--spacing(75)]`, same width), recorded in impl-log; 5a has none.

**R-d Spacing snap** (allowed 0, px, 1, 2, 3, 4, 5, 6, 8, 12): half steps round **up** for padding (keeps touch area:
`py-2.5` → `py-3`, `px-1.5` → `px-2`) and **down** for gap/margin/space (`gap-1.5` → `gap-1`, `mt-0.5` → `mt-1` is the
one exception: 0.5 → 1 everywhere because 0 would remove it); `7` → `8` padding / `6` gap; `9`, `10` → `8`; `11` → `12`;
`> 12` → `12`. Every snap that moves a visible edge by ≥ 4 px goes into impl-log "Visible differences".

**R-e Status text labels (AC 3).** Every status shown by colour (dot, tinted row, icon colour, ring) has visible text
next to it. Status values render as `Pill` (`src/ui/Chip.tsx:96`) with `dot` and this tone map, the label string
unchanged from the copy file: **success** — active, approved, available, returned/on time; **warning** — pending, due
soon, awaiting confirmation; **danger** — rejected, overdue, failed; **info** — in transfer/informational; **neutral** —
cancelled, deactivated, archived. Requests reuse `requestStatusLook` (`src/ui/portal/my-requests.ts:23–33`) so
Approvals and My requests agree. No `opacity-*` dimming of text rows (it drops text below 4.5:1); a dimmed state becomes
`bg-canvas` on the row plus the neutral pill.

**R-f 44 px row actions and hand-built controls.** Every row action is a kit `Button size="sm"` or `IconButton` (both
44 px since slice 3). Remove now-redundant height overrides (`className="min-h-11"`), never add a smaller height
(`h-8`, `h-9`, `py-1` on a button). Action groups: `flex flex-wrap items-center gap-2`. Any hand-built `<button>` with
its own fill/radius/padding becomes a kit `Button` with the same `type`, handler, label and `aria-*` (variant: filled →
`filled`, bordered → `outlined`, bare → `text`). Radio/checkbox rows: the `<label>` gets `min-h-control cursor-pointer`
and the input `size-5 flex-none` (Q-S3-5 default).

**R-g Shared table classes.** New `src/ui/table.ts` (pure constants, no imports) replaces the five copies of `CELL`/
`HEAD` (`AuditView.tsx:25–26`, `MembersView.tsx:40–42`, `PendingInvitations.tsx:8–9`, `DeviceTable.tsx:8–9` (5b),
`portal/MyDevicesTable.tsx:21–22` (slice 6)):
```ts
/** Table cell classes for management tables (brief type scale; 12 px uppercase head, 14 px cells). */
export const TABLE_HEAD =
  "px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary";
export const TABLE_CELL = "px-3 py-2 align-top text-label font-normal text-text-primary";
export const TABLE_ROW = "border-b border-divider last:border-b-0";
/** Small reference list under a cell value (seat codes, device refs). */
export const TABLE_REFS = "mt-1 list-none p-0 text-caption text-text-secondary";
```
Callers keep their extra classes (`${TABLE_CELL} break-all`, `${TABLE_CELL} whitespace-nowrap`).

**R-h Pending list.** Each touched pending file must reach 0 and its key is removed in the same PR. A file that cannot
reach 0 (a literal that must stay) stops the PR: the implementer records why in impl-log and the orchestrator decides
(allowlist entry with a reason, per slice 2 rules). No count may rise; no non-slice key may change.

### Files (slice 5a)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, `scripts/check-tokens.pending.json`, `*.test.ts(x)`
are not listed).

| File | Change (R-x = rule above) | Pending before → after |
|---|---|---|
| `src/ui/table.ts` | create (R-g) | new, 0 |
| `src/ui/members/MembersView.tsx` | delete local `CELL`/`HEAD`/`REFS` (40–42), use `TABLE_*`; h1 (51) → `text-display text-text-primary`; note (54) `text-label text-text-secondary`; search `min-w-[14rem]` → `min-w-56` (58); error (84) `text-label font-semibold text-danger`; empty (95) `text-label text-text-secondary`; table `min-w-[56rem]` → `min-w-224` (103); head row (105) `border-b border-divider`; row (144) `TABLE_ROW` + `bg-canvas` when deactivated, no `opacity-60` (R-e); name cell (146) `font-bold` → `font-semibold`; swatch (159) `border-divider`; status cell (168) → `<Pill dot tone={m.status === "active" ? "success" : "neutral"} label={membersCopy.statusLabels[m.status]} />` (R-e); action group (200) `flex flex-wrap items-center gap-2` | 4 → 0 (remove key) |
| `src/ui/members/PendingInvitations.tsx` | `TABLE_*` (8–9, 42, 51); h2 (16) `text-subtitle text-text-primary`; note (17), empty (35) `text-label text-text-secondary`; error (25) `text-label font-semibold text-danger`; `min-w-[32rem]` → `min-w-128` (40) | 3 → 0 (remove) |
| `src/ui/members/MemberPhotoSection.tsx` | 60 `text-label text-text-secondary`; 78 `text-label text-danger` | not pending |
| `src/ui/members/DeactivateMemberDialog.tsx` | 86 `text-label text-text-primary` | not pending |
| `src/ui/members/ReactivateMemberDialog.tsx` | 63 `text-label text-text-primary` | not pending |
| `src/ui/invitations/InvitePeople.tsx` | 120–126 hand-built near-black button → `<Button onClick={() => setOpen(true)}>{invitationsCopy.open}</Button>` (import `Button` from `../Button`; default `filled`, `md`, `type="button"`) (R-f) | 2 → 0 (remove) |
| `src/ui/invitations/InviteDialog.tsx` | notices (47, 53) `text-[13px] font-semibold text-on-surface` → `text-label font-semibold text-text-primary`; retry (56–62) → `<Button variant="outlined" size="sm" onClick={p.onRetryRecord}>` (R-f; import `Button`) | 5 → 0 (remove) |
| `src/ui/groups/GroupsView.tsx` | h1 (46) `text-display text-text-primary`; no-access (53) `text-label text-text-secondary`; RowActions wrapper (32) `flex flex-wrap items-center gap-2 shrink-0`; swatch (76) `border-divider`; group name (79) `text-label font-semibold text-text-primary`; project code (101) `text-label font-semibold text-text-primary`; project name (102) `text-label text-text-secondary` | not pending |
| `src/ui/groups/ListSection.tsx` | h2 (36) `text-h3 font-extrabold text-on-surface` → `text-subtitle text-text-primary` (`text-h3` is not defined anywhere: `rg "\.text-h3" src` → no hit, so it rendered at the inherited 16 px); error (54) `text-label font-semibold text-danger`; empty (65) `text-label text-text-secondary` | not pending |
| `src/ui/groups/DeleteDialog.tsx` | 35, 41 `text-label text-text-primary`; 48 `mt-2 text-text-secondary` | not pending |
| `src/ui/requests/ApprovalsView.tsx` | h1 (49) `text-display text-text-primary outline-none` (programmatic focus target, `tabIndex=-1`: keeps `outline-none`); no-access (59), empty (115) `text-label text-text-secondary`; error notices (73, 104) `text-label font-semibold text-danger`; status notice (77) `text-label font-semibold text-text-primary`; summary (91) `text-label font-normal text-text-secondary`; name (127) `text-label font-semibold text-text-primary`; status (130) `<Chip …>` → `<Pill dot tone={requestStatusLook(it.status).tone} label={requestsCopy.statusLabel[it.status]} />` (import `Pill` from `../Chip`, `requestStatusLook` from `../portal/my-requests`; R-e); seat line (132) `text-label font-normal text-text-primary`; occupant (138) `text-label font-normal text-text-secondary`; times (145, 151) `text-caption text-text-secondary` | not pending |
| `src/ui/requests/RequestRowActions.tsx` | remove `className="min-h-11"` (27, 37) (R-f) | not pending |
| `src/ui/requests/DecisionDialog.tsx` | 51, 55 `text-label font-normal break-words` | not pending |
| `src/ui/audit/AuditView.tsx` | `TABLE_*` (25–26, 149, 161); h1 (44) `text-display text-text-primary`; no-access (51), empty (139) `text-label text-text-secondary`; errors (115, 128) `text-label font-semibold text-danger`; `min-w-[40rem]` → `min-w-160` (147); entity id (168) `text-caption text-text-secondary`; meta (175) `text-caption` | 3 → 0 (remove) |
| `src/ui/credits/CreditsPage.tsx` | h1 (9) `font-heading text-2xl font-extrabold text-on-surface` → `text-display text-text-primary`; intro/empty (10, 12) `text-label font-normal text-text-secondary`; h2 (16) `text-subtitle text-text-primary`; rows (17, 21, 32, 36) `text-label font-normal text-text-primary`; link (27) `text-primary underline` → `text-text-primary underline` (inline link in a sentence: WCAG 2.5.8 inline exception, no 44 px box) | not pending |
| `src/ui/org/ProfileView.tsx` | intro (51) `break-words text-label font-normal text-text-secondary`; label (55) `text-label text-text-primary` (same as auth `Field`, slice 3); error (75) `text-caption text-danger`; hint (79) `text-caption text-text-secondary` | not pending |
| `src/ui/org/OrgPickerView.tsx` | support badge (40) `ml-2 text-caption text-text-secondary` | not pending |
| `src/ui/org/OrgSwitcherDialog.tsx` | legend (63) `mb-1 text-label font-semibold text-text-primary`; radio label (65) `flex min-h-control cursor-pointer items-center gap-2 text-label font-normal text-text-primary`; radio input (66–72) add `className="size-5 flex-none"` (R-f); marks (75, 80) `text-caption text-text-secondary` | not pending |
| `scripts/check-tokens.pending.json` | remove the 5 keys above (`--list` output) | 261 → 244 |
| `src/ui/page-container.test.ts` | first test → recursive scan (Tests) | test |
| `src/ui/screen-tokens.test.ts` | create (Tests) | test |
| `src/ui/members/MembersView.test.tsx`, `src/ui/requests/ApprovalsView.test.tsx`, `src/ui/requests/RequestRowActions.test.tsx`, `src/ui/invitations/InviteDialog.test.tsx`, `src/ui/audit/AuditView.test.tsx`, `src/ui/groups/GroupsView.test.tsx`, `src/ui/org/org-views.test.tsx` | update/extend (Tests) | test |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 5a": files, rename map (R-a/R-b copied once, reused by 5b/5c), pending before/after, visible differences, checks | deliverable |

Not touched (read, no class strings or nothing to change): `EditMemberDialog.tsx`, `TagFormDialog.tsx` (only kit
dialog fields), `MembersPage.tsx`, `GroupsPage.tsx`, `AuditPage.tsx`, `ApprovalsPage.tsx` (only `page-content`, slice 4),
`useRequestBadge.tsx`, `RequestsRedirect.tsx`, every `*-api.ts`/`*-state.ts`/`*-flow.ts`, `src/ui/copy/**` (no copy
change), `src/ui/Chip.tsx` (Pill already has every tone), `src/ui/portal/my-requests.ts` (imported only),
`src/app/**`, `src/app/globals.css` (no CSS change in 5a; stays 65), `src/styles/tokens.css`,
`scripts/check-tokens.mjs`. Line numbers above are from `main` after #160; the implementer re-reads each file first.

### Approach (slice 5a)
1. Create `src/ui/table.ts` (R-g).
2. Members, invitations, groups, requests, audit, credits, org: apply the Files table, which is R-a…R-f applied to
   every class string in those files. After each file, `rg -n "on-surface|outline-variant|text-error|text-\[|text-(xs|sm|base|lg|xl|2xl)\b|font-(bold|extrabold|heading)|text-h[23]|min-h-11|rounded-md3|<button" <file>` → no hits
   (in ApprovalsView `text-h2` must not remain either).
3. **InvitePeople** (slice-3 interim item): the near-black pill `bg-primary text-on-primary font-bold rounded-md3
   py-2.5 font-[inherit]` button becomes the kit primary `Button`; it now matches every other page-header primary action
   (coral action fill `#D3441F`, white text 4.55:1, 8 px radius, 44 px tall, 14 px · 500). Behaviour unchanged: same
   label, `onClick`, `type="button"`, still hidden for the User tier and dev-token mode (lines 31–33 untouched).
4. **Status pills** (R-e): member status and request status as above. `opacity-60` on deactivated member rows is
   replaced by `bg-canvas` (the row stays readable at AA; the neutral "Deactivated" pill carries the state). Pending
   approval rows keep showing no pill (unchanged: the selected filter chip names the status, `ApprovalsView.tsx:130`).
5. **Pending file:** `node scripts/check-tokens.mjs --list`; confirm the 5 keys are gone and every other count is
   unchanged (globals.css 65); delete the 5 keys; keys sorted; `node scripts/check-tokens.mjs` exits 0.
6. Tests (below), impl-log "Slice 5a", checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
   `pnpm build`.

Rules: R1 (ui only; new imports `../table`, `../Button`, `../Chip`, `../portal/my-requests` are ui → ui; `table.ts`
imports nothing), R3 (none), R4 (only the Files table), R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 5a)
`src/ui/screen-tokens.test.ts` (new, node; reads files like `page-container.test.ts:4`). `MIGRATED` = the 18 screen
files of the Files table plus `src/ui/table.ts` (5b and 5c append theirs; slice 7 replaces this test with the empty
guard). Patterns (JS, applied to file text; `(?<![\w-])` = not inside a longer class such as `text-text-primary`):
```ts
const LEGACY =
  /(?<![\w-])(?:bg|text|border|divide|outline|ring|fill|stroke|placeholder)-(?:primary|on-primary|on-surface(?:-variant)?|on-background|background|surface-(?:high|highest|low|lowest|container)|outline(?:-variant)?|error|secondary[\w-]*|tertiary[\w-]*|accent-orange[\w-]*|[\w-]*-container|status-(?:online|warn|alert)|inverse[\w-]*)(?![\w-])|var\(--(?:primary|on-|surface|outline|error|secondary|tertiary|accent-|status-|inverse-|card-shadow|field-focus)|rounded-md3/;
const RAW_TYPE = /(?<![\w-])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|h[1-3])|font-(?:bold|extrabold|black|heading))(?![\w-])/;
const LOW_TARGET = /(?<![\w-])(?:min-h-11|h-11|size-11|h-8|h-9)(?![\w-])/;
const PALETTE = /(?<![\w-])(?:bg|text|border)-(?:red|amber|orange|yellow|green|blue|gray|slate|zinc|neutral|stone)-\d{2,3}(?![\w-])/;
```

| Test (file › name) | Covers |
|---|---|
| `screen-tokens.test.ts` › every migrated file exists and matches none of `LEGACY`, `RAW_TYPE`, `LOW_TARGET`, `PALETTE`, `opacity-60`, `focus-visible:`, `focus-within:` (message names file and match) | R-a, R-b, R-f, Rules |
| screen-tokens › no migrated file is a key of `scripts/check-tokens.pending.json` (missing file treated as `{}`, for slice 7) | R-h: every touched file reached 0 |
| screen-tokens › `InvitePeople.tsx` and `InviteDialog.tsx` contain no `<button` (kit `Button` only) | R-f, slice-3 interim item |
| screen-tokens › `table.ts`: `TABLE_HEAD` has `text-caption` `font-semibold` `uppercase` `text-text-secondary`; `TABLE_CELL` has `text-label` `font-normal` `text-text-primary`; `TABLE_ROW` has `border-divider`; `TABLE_REFS` has `text-caption` (import from `./table`) | R-g |
| `page-container.test.ts` › "no page wrapper keeps the old padding" becomes a recursive scan: every non-test `.tsx` under `src/ui` and `src/app` (`readdirSync(new URL("../ui/", import.meta.url), { recursive: true, encoding: "utf8" })` and the same for `../app/`, backslashes → `/`, keep `.tsx` not `.test.tsx`) lacks `p-4 lg:p-6`; also asserts more than 100 files were scanned (guards an empty scan); the LIBRARY/CONTENT test unchanged | slice-4 review follow-up |
| `MembersView.test.tsx` › status pills: active row has `bg-success-tint` and "Active"; deactivated row (`gone`) has `bg-canvas` on its `<tr>`, the neutral pill with "Deactivated", and no `opacity-60` (extend the test at 97–130) | R-e |
| MembersView.test › page h1 has `text-display`; table header cells have `text-caption` and `uppercase`; table has `min-w-224`; row action buttons (manager) each contain `min-h-control` | R-b, R-c, R-f |
| `ApprovalsView.test.tsx` › decided rows (extend 76–94): approved → `bg-success-tint`, rejected → `bg-danger-tint`, cancelled → `bg-canvas`, each with its `requestsCopy.statusLabel` text (`>Approved<` still matches); pending rows render no pill (`bg-warning-tint` absent) | R-e |
| ApprovalsView.test › h1 has `text-display` and `tabindex="-1"` (extend 108–111) | Q16 |
| `RequestRowActions.test.tsx` › 30–37: title "… both enabled, 44 px", assert `min-h-control` and `not.toContain("min-h-11")` | R-f |
| `InviteDialog.test.tsx` › sentNotRecorded (extend 54–58): retry button has `data-variant="outlined"` and `min-h-control`; notices have `text-label`; markup has no `text-[` | R-b, R-f |
| `AuditView.test.tsx` › ready table: `<th>` has `text-caption`, table has `min-w-160`, no `text-[` | R-b, R-c |
| `GroupsView.test.tsx` › section h2 has `text-subtitle`; group name has `font-semibold`; no `font-bold`/`font-extrabold` | R-b |
| `org-views.test.tsx` › OrgSwitcherDialog (extend 49–55): each radio `<label>` has `min-h-control`, each radio input `size-5` | R-f, 44 px |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with the 5 keys removed | pending only shrinks |

### Acceptance → verification (slice 5a)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S5a-1 | 5a screens use token utilities only; rename map applied (R-a/R-b/R-c) | `screen-tokens.test.ts` green; `rg -n "on-surface\|outline-variant\|text-error\|text-\[\|font-(bold\|extrabold)\|text-h[23]\|rounded-md3" src/ui/{members,invitations,groups,requests,audit,credits,org}/*.tsx -g '!*.test.tsx'` → no hits |
| S5a-2 | No 13 px (or other off-scale) text; labels 14, metadata 12, page h1 Display, section titles Subtitle (Q8, Q16) | test rows above; `rg -n "text-(xs\|sm\|lg\|2xl)\b" <same glob>` → no hits |
| S5a-3 | Row actions and controls ≥ 44 px; no hand-built buttons left; org switcher radio rows 44 px (AC 3) | RequestRowActions, MembersView, InviteDialog, org-views tests; `rg -n "<button" src/ui/invitations` → no hits |
| S5a-4 | InvitePeople uses the kit primary Button (coral action, white text) | screen-tokens InvitePeople test; read `InvitePeople.tsx` diff: only the button JSX + import changed |
| S5a-5 | Every status has a text label; member and request statuses are toned pills; no opacity dimming of text (AC 3, R-e) | MembersView/ApprovalsView pill tests |
| S5a-6 | Pending shrinks by exactly the 5 keys (261 → 244), nothing else changes; every touched pending file at 0 | `git diff main -- scripts/check-tokens.pending.json` shows 5 removed keys only; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S5a-7 | Recursive container scan (slice-4 follow-up) | page-container test reads the directory tree, not a list; mutation: add `p-4 lg:p-6` to any unlisted `.tsx` → test fails |
| S5a-8 | No behaviour, copy, prop or `aria-*` change | existing tests in the 7 test files unchanged except the listed asserts; `git diff main -- src/ui/copy src/lib src/app` empty |
| S5a-9 | Only planned files | `git diff --stat main` ⊆ Files table |
| S5a-10 | Checks green; impl-log "Slice 5a" complete (rename map, pending, visible differences) | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 5a)
- Members: "Invite people" button near-black pill → coral action fill, 8 px corners, 44 px, 14 px · 500 (was 14 px ·
  700). Status column plain text → green "Active" / grey "Deactivated" pills with a dot; deactivated rows no longer
  faded to 60 % but sit on the light canvas background. Table headers 11 px · 800 → 12 px · 600 uppercase; member name
  700 → 600; borders divider. Pending invitations heading 18 px · 800 → 18 px · 600.
- Invite dialog: sent / not-recorded notices 13 → 14 px; "Retry" button pill → 8 px outlined, 44 px.
- Groups: section headings (were unstyled 16 px · 800 because `text-h3` does not exist) → 18 px · 600; names and project
  codes 700/800 → 600.
- Approvals: Approved / Rejected / Cancelled grey chip → green / red / grey pill with a dot; Approve/Reject row buttons
  unchanged in size (already 44 px); request times 12 px secondary.
- Audit: table headers as Members; entity id and metadata 12 px.
- Credits: page title 24 px · 800 → 32 px · 600 (Display, like every page title); pack names 18 px · 700 → 600.
- Profile (first visit) and org picker/switcher: field label 12 px secondary → 14 px ink; hint/error 12 px; switcher
  radio rows 44 px tall with a 20 px radio.
- Page titles on Members, Groups, Approvals, Audit: 32 px · 800 → 32 px · 600.

### Ming verification after merge (slice 5a)
- As Admin at 390 / 800 / 1280 px, light and dark: Members (Invite people is coral, status pills, a deactivated member
  row still easy to read, Edit/Deactivate 44 px), invite dialog including the "sent but not recorded" state if
  reproducible, Groups, Approvals with the Approved and Rejected filters (pills), Audit table (scrolls sideways at 390),
  Credits, the org switcher dialog (if you have two orgs) and a first-visit profile page.
- Keyboard-tab through Members: green ring on search, filter chips, row buttons, Invite people.

### Slice 5b outline — Devices and device types (addendum before it starts)
- Files: `src/ui/devices/**` (`DevicesView`, `DeviceTable`, `DeviceDetailView`, `DeviceHistory`, `device-labels`,
  `DeviceRowActions`, `IncomingTransfers`, `PendingReturns`, `PendingExtensions`, `OverdueBanner`, `NoteField`, and the
  dialogs `Assign`/`Delete`/`DeviceForm`/`Extend`/`Place`/`Return`/`TakeBack`/`Transfer`), `src/ui/deviceTypes/**`
  (`DeviceTypesView`, `DeviceTypeFormDialog`, `DeviceTypeImageField`, `DeviceTypeSpriteField`, `DeviceTypeThumb`,
  `DeskSlotDiagram`, `DeleteDeviceTypeDialog`), their tests, `screen-tokens.test.ts` `MIGRATED`, pending (16 keys, 60
  violations → 0), impl-log. Rules R-a…R-h unchanged; `DeviceTable` adopts `TABLE_*`.
- **Cramped device tables at 800–1023 (slice-4 follow-up, default Q-S5-6):** the 7–8 column `DeviceTable` and the
  row-card layouts get 536–759 px of content there. Switch the wide layout from `md` to `lg`: `DeviceTable.tsx:34`
  `hidden md:block` → `hidden lg:block`, `:83` `md:hidden` → `lg:hidden`; the `md:flex-row md:items-center
  md:justify-between` cards and `md:flex-row` action groups in `IncomingTransfers.tsx:60,75`, `PendingReturns.tsx:60,75`,
  `PendingExtensions.tsx:60,78`, `OverdueBanner.tsx:43` → `lg:`. Below 1024 they use the existing stacked list/cards
  (no new markup). Tests: the existing `md:` class asserts in their tests move to `lg:`.
- Status labels: device states in `device-labels.tsx` (overdue, due, returned, in transfer) → pills per R-e; overdue banner
  keeps its text.
- Device types is a sprite library (`page-library`, slice 4) but **not** pixel-green scope (Q4 list), so coral actions;
  sprite/thumbnail backgrounds stay as they are until slice 6 decides `bg-tile` for previews.
- Expected size ~450–500 changed lines; if larger, device types move to 5c.

### Slice 5c outline — Dashboard, search, rooms and seats chrome (addendum before it starts)
- Files: `src/ui/dashboard/{DashboardView,ExportCard}.tsx`, `src/ui/search/{SearchView,SearchPage}.tsx`,
  `src/ui/rooms/{RoomsView,RoomCard,OccupancyRing,RoomFormDialog,DeleteRoomDialog}.tsx`,
  `src/ui/seats/{SeatsView,SeatDetailPanel,SeatActions,MemberPickerDialog,AddSeatsDialog,SeatTagsDialog,
  CannotSeatDialog,ConfirmSeatDialog}.tsx`, their tests, `MIGRATED`, pending (8 keys, 41 → 0), impl-log.
- Dashboard metrics use `StatTile` (Title, slice 3); chart/occupancy colours → status tokens with text labels;
  `OccupancyRing` ring colours → `success/warning/danger` with the percentage text kept (R-e). Room cards: `rounded-xl
  shadow-card border-divider` via `Card`. Search result types → neutral pills with text.
- Seats: only the chrome around the map (`SeatDetailPanel` panel, seat dialogs, `SeatsView` header and lists);
  `RoomMap`, `SeatOverlay` and the editor stay in slice 6. `CheckinView` `1fr 300px` at 1024 (slice-4 follow-up) is
  check-in, so slice 6.
- After 5c the pending list holds only slice-6 files and `globals.css` (143 violations).

### Assumptions and non-blocking questions (slice 5)
- Hotspots: no other open ticket (IN_PROGRESS/REVIEW/DONE) edits 5a files; SIM-066.1 (DONE) touches `portal/**`, which 5a
  only imports from (`my-requests.ts`, unchanged). `scripts/check-tokens.pending.json` changes in every sub-slice;
  5a/5b/5c merge in order, so no conflict inside this ticket. `screen-tokens.test.ts` `MIGRATED` grows in 5b/5c.
- Q-S5-1 (non-blocking). **Default: three PRs 5a/5b/5c as above** (5b alone would be ~800 changed lines). Alternative:
  5a/5b with 5b ≈ 800 lines.
- Q-S5-2 (non-blocking). Page `<h1>`s move to `text-display` (token utility) instead of the legacy `.text-h2` class
  (same 32/40 · 600 result). **Default: `text-display` in slice-5 files; `.text-h2` stays for `PageSkeleton.tsx` and
  `AppShellView.tsx` until slice 7 removes it.**
- Q-S5-3 (non-blocking). Deactivated member rows: **default `bg-canvas` row + neutral "Deactivated" pill instead of 60 %
  opacity** (opacity puts secondary text below AA). Alternative: keep opacity (fails AC 6).
- Q-S5-4 (non-blocking). Approvals pending rows: **default no pill** (unchanged structure; the filter names the status).
  Adding an amber "Pending" pill is a one-line follow-up.
- Q-S5-5 (non-blocking). Credits title is 24 px today, other page titles 30 px. **Default: Display 32 like every page
  title (Q16).**
- Q-S5-6 (non-blocking, 5b). **Default: device tables and handoff cards switch to the wide layout at 1024 (`lg`)
  instead of 800**, so 800–1023 uses the stacked list. Alternative: keep `md` and let the table scroll sideways.
- Q-S5-7 (non-blocking). Table headers stay uppercase (CSS transform, copy unchanged) at 12 px · 600 with `tracking-wide`.
  **Default: keep uppercase.**
- Q-S5-8 (non-blocking). `src/ui/table.ts` is a small new shared module (not in the Split proposal file list) to avoid
  five drifting copies of the same class strings. **Default: add it in 5a; 5b and slice 6 adopt it.**

## Slice 5b addendum — Devices and device types
Status: READY. Written against `main` after #161 (slices 1–4 and 5a merged). Applies the "Slice 5 addendum" rules
R-a…R-h **unchanged** to the 5b screens outlined there ("Slice 5b outline"), plus the device-table breakpoint default
Q-S5-6 ("device tables and handoff cards switch to the wide layout at 1024 (`lg`) instead of 800, so 800–1023 uses the
stacked list"). No new decisions; open points are non-blocking questions at the end, each with a default. Closes AC 2,
AC 3 and AC 6b for Devices (list, detail, history, incoming transfers, pending returns, pending extensions, overdue
banner, all device dialogs) and Device types (list, form, image and sprite fields, delete). No `src/app/**`,
`src/app/globals.css`, `src/styles/tokens.css`, copy, `*-state.ts`/`*-api.ts`/`*-flow.ts` or kit change.

### Size
26 screen files (≈ 230 changed lines), `screen-tokens.test.ts` (≈ 50), 12 test files (≈ 160), pending (16 lines),
impl-log (≈ 40): ≈ 500 changed lines, inside the outline's 450–500 estimate, so device types stay in 5b (no move to 5c).

### Pending list (R-h): 16 keys, 60 violations → 0 (244 → 184)
Counts read from `scripts/check-tokens.pending.json` on `main`; the cause per file is what the guard flags today
(`text-[11px]` counts twice: `text-arb` + `arbitrary-px`; `tracking-[0.05em]` once; off-scale `gap-0.5/1.5`,
`px-0.5/3.5`, `py-1.5` once each).

| Key | Count | Cause (all removed by the Files table) |
|---|---|---|
| `src/ui/devices/AssignDeviceDialog.tsx` | 5 | `CAPTION` (27: 4), `HINT` `px-0.5` (29) |
| `src/ui/devices/DeviceDetailView.tsx` | 4 | `LABEL` (13: 3), `gap-1.5` (56) |
| `src/ui/devices/DeviceFormDialog.tsx` | 4 | `CAPTION` (21) |
| `src/ui/devices/DeviceHistory.tsx` | 1 | `gap-0.5` (34) |
| `src/ui/devices/DeviceRowActions.tsx` | 1 | `gap-1.5` (18) |
| `src/ui/devices/DeviceTable.tsx` | 2 | `HEAD` `text-[11px]` (9) |
| `src/ui/devices/ExtendDeviceDialog.tsx` | 5 | `CAPTION` (20: 4), `HINT` (21) |
| `src/ui/devices/NoteField.tsx` | 7 | `CAPTION` (7: 4), `HINT` (8), `gap-1.5` (26), `px-3.5` (37) |
| `src/ui/devices/OverdueBanner.tsx` | 1 | `gap-1.5` (49) |
| `src/ui/devices/PlaceDeviceDialog.tsx` | 1 | `py-1.5` (117) |
| `src/ui/devices/ReturnDeviceDialog.tsx` | 5 | `CAPTION` (13: 4), `HINT` (14) |
| `src/ui/devices/TransferDeviceDialog.tsx` | 5 | `CAPTION` (22: 4), `HINT` (23) |
| `src/ui/devices/device-labels.tsx` | 4 | `gap-1.5` (28, 52), `gap-0.5` (51, 86) |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` | 4 | `CAPTION` (29) |
| `src/ui/deviceTypes/DeviceTypeImageField.tsx` | 7 | `CAPTION` (10: 4), `BTN` `py-1.5` (12), Remove/Keep `py-1.5` (61, 71) |
| `src/ui/deviceTypes/DeviceTypeSpriteField.tsx` | 4 | `CAPTION` (9) |

All 16 keys are deleted; every other key keeps its count (`globals.css` stays 65; slice-5c and slice-6 keys untouched).

### Shared values used in 5b (from R-a/R-b; written out so every file uses the same strings)
- **Form caption** (control labels and legends in dialogs, and the label of a read-only value inside a dialog):
  `const CAPTION = "text-label text-text-primary";` — identical to the kit `FIELD_CAPTION`
  (`src/ui/EntityFormDialog.tsx:112`), so device dialogs match the `DialogField` captions next to them (Q-S5b-2).
  Replaces every `"text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5"`.
- **Form hint:** `const HINT = "text-caption text-text-secondary";` (was `text-xs … px-0.5`; 12 px unchanged, `px-0.5`
  dropped like the kit field hints).
- **Read-only value in a dialog** (holder, current owner, current expiry): `"text-label font-normal text-text-primary"`.
- **Detail-page field label** (`DeviceDetailView` `<dt>`): `"text-caption font-semibold uppercase tracking-wide
  text-text-secondary"` (same look as `TABLE_HEAD`, Q-S5-7).
- **Notices:** error `text-label font-semibold text-danger`; status `text-label font-semibold text-text-primary`;
  summary/hint/empty/truncated lines `text-label font-normal text-text-secondary` (`text-label text-text-secondary`
  where the old class had `font-medium`).
- **Section headings** (`<h2>`: history, incoming, returns, extensions, overdue, detail sections): `text-subtitle
  text-text-primary` (+ `outline-none` where the `<h2>` is a `tabIndex={-1}` focus target). **Page `<h1>`:**
  `text-display text-text-primary` (+ `outline-none` on the focusable ones).
- **Status pills (R-e)** — `Pill` from `../Chip` with `dot`, label string unchanged:
  `devicesCopy.overdueChip` → `tone="danger"`; `pendingText(d).chip` (Transfer / Return / Extension pending) →
  `tone="warning"` (Q-S5b-1). Not statuses, so they stay `Chip`: the "You" chip and the placement role chip
  (Primary/Secondary).
- **Kit textarea box** (NoteField): wrapper `field-box rounded-lg border border-border-strong bg-surface` + the
  `TRANSITION` string of `src/ui/Button.tsx:8–9`; the textarea itself `block w-full resize-y bg-transparent px-4 py-2
  text-label font-normal text-text-primary outline-none`. The focus ring comes from the existing
  `.field-box:focus-within` rule (`globals.css:344–347`, slice 3) — the global `:focus-visible` rule
  (`globals.css:339`) does not list `textarea`, so the ring must sit on the wrapper; no CSS change.
- **Radio/checkbox rows (R-f):** `<label>` gets `min-h-control cursor-pointer`, the input `className="size-5 flex-none"`.

### Files (slice 5b)
None matches a High path (`.github/risk-tiers.yml`; `src/ui/**`, `scripts/check-tokens.pending.json` and tests are not
listed). Line numbers are from `main` after #161; the implementer re-reads each file first. "→" = replace the whole
class string with the given one unless "add"/"drop" says otherwise.

**Devices — list, table, labels**

| File | Change | Pending |
|---|---|---|
| `src/ui/devices/DevicesView.tsx` | h1 (51) → `text-display text-text-primary outline-none`; error notices (65, 101) `text-label font-semibold text-danger`; status notice (69) `text-label font-semibold text-text-primary`; summary (84) `text-label font-normal text-text-secondary`; empty (112) `text-label text-text-secondary`; truncated (122) `text-label font-normal text-text-secondary` | not pending |
| `src/ui/devices/DeviceTable.tsx` | delete `CELL`/`HEAD` (8–9), import `TABLE_CELL, TABLE_HEAD, TABLE_ROW` from `../table` (R-g); `<th>` (41, 46) `TABLE_HEAD`; head `<tr>` (39) add `className="border-b border-divider"`; body `<tr>` (54) `TABLE_ROW`; cells (55–73) `TABLE_CELL` — the name cell (55) drops its extra `font-semibold` (the link already has it; avoids `font-normal`+`font-semibold` on one element); **breakpoint (Q-S5-6):** 34 `hidden md:block` → `hidden lg:block`, 83 `md:hidden flex flex-col gap-2` → `flex flex-col gap-2 lg:hidden`; doc comment (21) "at `md` and up" → "at `lg` (1024 px) and up"; card (86) `flex flex-col gap-1 p-3 text-label font-normal text-text-primary`; name (87) `font-bold` → `font-semibold`; type line (90) `text-text-secondary` | 2 → 0 (remove) |
| `src/ui/devices/device-labels.tsx` | import `Pill` with `Chip` (4); links (11, 30) `font-semibold text-text-primary underline`; inventory (25) `text-text-secondary`; gaps (28, 52) `gap-1.5` → `gap-1`, (51, 86) `gap-0.5` → `gap-1`; pending (55) → `<Pill dot tone="warning" label={pending.chip} />`; overdue (56–62) → `<Pill dot tone="danger" label={devicesCopy.overdueChip} />` (removes `var(--error-container)`/`var(--on-error-container)`); metadata (64, 67, 71, 88) `text-xs text-on-surface-variant` → `text-caption text-text-secondary` (keep `whitespace-pre-line ${clamp} ${CLIP}` on 71 and `break-all` on 88) | 4 → 0 (remove) |
| `src/ui/devices/DeviceRowActions.tsx` | wrapper (18) `flex flex-wrap items-center gap-2` (R-f) | 1 → 0 (remove) |
| `src/ui/devices/OverdueBanner.tsx` | import `Pill` instead of `Chip` (4); h2 (34) `text-subtitle text-text-primary`; hint (37) `text-label font-normal text-text-secondary`; card (43) `md:` → `lg:` (`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`); name line (45) `text-label font-normal text-text-primary`, (46) `font-bold` → `font-semibold`; expiry line (49) `inline-flex flex-wrap items-center gap-1 text-label font-normal text-text-secondary`; pending (53) → `<Pill dot tone="warning" label={pending.chip} />`; to-line (55) `text-caption text-text-secondary` | 1 → 0 (remove) |
| `src/ui/devices/IncomingTransfers.tsx` | h2 (39) `text-subtitle text-text-primary outline-none`; hint (43) `text-label font-normal text-text-secondary`; error (47) `text-label font-semibold text-danger`; card (60) `lg:` instead of `md:`; name line (62) `text-label font-normal text-text-primary`, (63) `font-semibold`; from (66) and note (70, keep `whitespace-pre-line line-clamp-3`) `text-label font-normal text-text-secondary`; actions (75) `flex flex-col gap-2 lg:flex-row`; truncated (114) `text-label font-normal text-text-secondary` | not pending |
| `src/ui/devices/PendingReturns.tsx` | same lines and changes as IncomingTransfers (39, 43, 47, 60, 62, 63, 66, 70, 75, 114) | not pending |
| `src/ui/devices/PendingExtensions.tsx` | same as IncomingTransfers at 39, 43, 47, 60, 62, 63, 66; change line (69) `text-label font-normal text-text-secondary`; note (73); actions (78) `flex flex-col gap-2 lg:flex-row`; truncated (117) | not pending |

**Devices — detail and history**

| File | Change | Pending |
|---|---|---|
| `src/ui/devices/DeviceDetailView.tsx` | import `Pill` instead of `Chip` (6); `LABEL` (13) → detail-page field label (above); `<dd>` (34) `break-all text-label text-text-primary`; section h2 (44) `text-subtitle text-text-primary`; pending line (56) `inline-flex flex-wrap items-center gap-1 text-label font-normal text-text-primary`; pending chip (57) → `<Pill dot tone="warning" label={text.chip} />`; requested-by (60) `text-caption text-text-secondary`; h1 (83) `text-display text-text-primary outline-none`; back link (90) `inline-flex min-h-control items-center self-start text-label font-semibold text-text-primary hover:underline` (standalone link → 44 px, AC 3); notices (97, 119) error, (101) status; not-found body (131) `text-label font-normal text-text-secondary`; where/holder (152, 157) `text-label font-normal text-text-primary`; holder since (161) `text-caption text-text-secondary` | 4 → 0 (remove) |
| `src/ui/devices/DeviceHistory.tsx` | entry (34) `flex flex-col gap-1 border-t border-divider py-3 text-label font-normal first:border-t-0`; kind (36) `font-semibold text-text-primary`; time/actor/expiry/cause/confirmed/note (37, 40, 45, 46, 48, 53; keep `whitespace-pre-line ${CLIP}` on 53) `text-caption text-text-secondary`; from-to (44) `text-text-primary`; h2 (74) `text-subtitle text-text-primary`; errors (84, 107) `text-label font-semibold text-danger`; empty (94) `text-label text-text-secondary` | 1 → 0 (remove) |

**Devices — dialogs**

| File | Change | Pending |
|---|---|---|
| `src/ui/devices/NoteField.tsx` | `CAPTION`/`HINT` (6–8) → shared values; wrapper (26) `gap-1.5` → `gap-1`; textarea (30–38) wrapped in `<div className={BOX}>` with `const BOX = "field-box rounded-lg border border-border-strong bg-surface transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out"` and textarea class `block w-full resize-y bg-transparent px-4 py-2 text-label font-normal text-text-primary outline-none` (drops `rounded-md3`, `border-outline-variant`, `focus:border-primary`, `px-3.5`); `id`, `rows`, `maxLength`, `aria-describedby`, `onChange` unchanged | 7 → 0 (remove) |
| `src/ui/devices/AssignDeviceDialog.tsx` | `CAPTION`/`HINT` (26–29) → shared values; holder value (59) read-only value class; checkbox label (65) `flex min-h-control cursor-pointer items-center gap-2 text-label text-text-primary`; checkbox input (66–70) add `className="size-5 flex-none"` | 5 → 0 (remove) |
| `src/ui/devices/ExtendDeviceDialog.tsx` | `CAPTION`/`HINT` (19–21); current expiry value (41) read-only value class | 5 → 0 (remove) |
| `src/ui/devices/TransferDeviceDialog.tsx` | `CAPTION`/`HINT` (21–23); current owner value (50) read-only value class; **52 unchanged** (`flex flex-col gap-3`, matched by `TransferDeviceDialog.test.tsx:64`) | 5 → 0 (remove) |
| `src/ui/devices/ReturnDeviceDialog.tsx` | `CAPTION`/`HINT` (12–14); current owner value (30) read-only value class | 5 → 0 (remove) |
| `src/ui/devices/DeviceFormDialog.tsx` | `CAPTION` (20–21); owner value (192) read-only value class; read-only note (193) `text-label font-normal text-text-secondary` | 4 → 0 (remove) |
| `src/ui/devices/PlaceDeviceDialog.tsx` | import `Button` from `../Button`; `HINT` (26) `text-text-secondary`; every `text-sm ${HINT}` (88, 90, 102, 138, 140, 143, 154, 175, 178) → `text-label font-normal ${HINT}`; return confirm (62) `text-label font-normal text-text-primary`; error alerts (93, 146) `flex flex-wrap items-center gap-2 text-label font-semibold text-danger`, the inline `<button className="underline cursor-pointer">` retries (95–97, 148–150) → `<Button variant="outlined" size="sm" onClick={onRetryRooms}>` / `onRetrySeats` (R-f; same label `devicesCopy.retry`, `type="button"` default); seat radio label (117) `flex min-h-control cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-label text-text-primary` (`rounded-md3` → `rounded-lg`, `py-1.5` → `py-2`); role radio label (163) `flex min-h-control cursor-pointer items-center gap-3 text-label text-text-primary`; both radio inputs (119–125, 164–170) add `className="size-5 flex-none"`; `max-h-[35dvh]` (112) stays (not flagged, R-c) | 1 → 0 (remove) |
| `src/ui/devices/DeleteDeviceDialog.tsx` | body (15) `flex flex-col gap-1 text-label text-text-primary` | not pending |
| `src/ui/devices/TakeBackDeviceDialog.tsx` | body (16) `flex flex-col gap-1 text-label text-text-primary` | not pending |

**Device types** (a sprite library page, `page-library` from slice 4, but not pixel-green scope (Q4): actions stay
workspace coral; thumbnails/previews unchanged until slice 6)

| File | Change | Pending |
|---|---|---|
| `src/ui/deviceTypes/DeviceTypesView.tsx` | h1 (25) `text-display text-text-primary`; no-access (32) `text-label text-text-secondary`; name (55) `truncate text-label font-semibold text-text-primary`; slot (56) `shrink-0 text-label text-text-secondary`; row actions (61) `flex flex-wrap items-center gap-2 shrink-0` (R-f) | not pending |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` | `CAPTION` (28–29); slot radio label (154) `flex min-h-control cursor-pointer items-start gap-2 text-label font-normal text-text-primary`; radio input (155–161) `className="mt-1"` → `"size-5 flex-none"` (20 px radio = one 20 px label line, so top-aligned without `mt-1`); option name (163) `font-medium` unchanged; option hint (164) `text-text-secondary` | 4 → 0 (remove) |
| `src/ui/deviceTypes/DeviceTypeImageField.tsx` | import `Button` from `../Button`; `CAPTION` (9–10); `BTN` (11–12) → `"field-box inline-flex min-h-control cursor-pointer items-center rounded-lg border border-border bg-surface px-4 text-label text-text-primary transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out"` (looks like the kit secondary button; focus ring of the hidden file input via `.field-box:focus-within`, replacing `focus-within:ring-2 focus-within:ring-primary`; Q-S5b-4); Remove (57–65) → `<Button variant="danger" size="sm" disabled={disabled} onClick={onRemove}>{copy.remove}</Button>`; Keep current (66–75) → `<Button variant="outlined" size="sm" disabled={disabled} onClick={onUndo}>{copy.keepCurrent}</Button>`; hint/pending notes (78, 80) `text-caption text-text-secondary`; error (83) `text-caption font-medium text-danger` (keep `id`, `role`) | 7 → 0 (remove) |
| `src/ui/deviceTypes/DeviceTypeSpriteField.tsx` | `CAPTION` (8–9); hint (31) `text-caption text-text-secondary`; hidden-by-image (33) `text-caption font-medium text-text-secondary`; unavailable (38) `text-caption font-medium text-danger`; option label (46) `flex min-h-control cursor-pointer items-center gap-2 text-label font-normal text-text-primary`; radio input (48–54) add `className="size-5 flex-none"`; sprite key (66) `font-mono text-caption` | 4 → 0 (remove) |
| `src/ui/deviceTypes/DeviceTypeThumb.tsx` | placeholder (35) `border-outline-variant text-on-surface-variant` → `border-divider text-text-secondary` (rest unchanged; inline `width/height` style is a number, not flagged) | not pending |
| `src/ui/deviceTypes/DeskSlotDiagram.tsx` | svg (12) `w-40 shrink-0 text-text-secondary`; desk (20) `fill-canvas stroke-divider` (`fill-surface-container-high` maps to no theme key: there is no `--color-surface-container-high`, so today the rect likely falls back to the SVG default fill — implementer checks in the browser and logs what it was); divider line (27) `stroke-divider`; chair (35) `fill-divider`; marker (41) `fill-none stroke-text-primary` / `fill-text-primary` (ink, same colour as today's `primary`) | not pending |
| `src/ui/deviceTypes/DeleteDeviceTypeDialog.tsx` | body (15) `text-label text-text-primary` | not pending |

**Pending, tests, log**

| File | Change |
|---|---|
| `scripts/check-tokens.pending.json` | delete the 16 keys above (244 → 184); nothing else changes |
| `src/ui/screen-tokens.test.ts` | extend (Tests) |
| `src/ui/devices/DevicesView.test.tsx`, `DeviceDetailView.test.tsx`, `DeviceHistory.test.tsx`, `IncomingTransfers.test.tsx`, `PendingReturns.test.tsx`, `PendingExtensions.test.tsx`, `OverdueBanner.test.tsx`, `AssignDeviceDialog.test.tsx`, `PlaceDeviceDialog.test.tsx`; `src/ui/deviceTypes/DeviceTypesView.test.tsx`, `DeviceTypeFormDialog.test.tsx`, `DeviceTypeImageField.test.tsx`, `DeviceTypeSpriteField.test.tsx` | extend (Tests); no existing assert is removed |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 5b": files, pending before/after (244 → 184, 16 keys), visible differences, the DeskSlotDiagram observation, checks |

Not touched (read; no class strings, or only kit components): `DevicesPage.tsx`, `DeviceDetailPage.tsx`,
`useDeviceDetailActions.tsx`, `useHandoffBadge.tsx`, `DeviceTypesPage.tsx`, every `*.ts` in both folders,
`src/ui/table.ts`, `src/ui/Chip.tsx`, `src/ui/Button.tsx`, `src/ui/EntityFormDialog.tsx`, `src/ui/groups/ListSection.tsx`
(5a), `src/ui/seats/MemberPickerDialog.tsx` (5c), `src/ui/mapItems/FramePreview.tsx` (slice 6), `src/ui/copy/**`,
`src/app/**`, `src/app/globals.css`, `src/styles/tokens.css`, `scripts/check-tokens.mjs`.

### Approach (slice 5b)
1. Device list: `DeviceTable` adopts `TABLE_*` and the `lg` switch; `device-labels` status pills; `DevicesView`,
   `DeviceRowActions`.
2. Handoff sections and the overdue banner: same class set in all four, `md:` → `lg:` on the card and its action group.
3. Detail page and history.
4. Dialogs: `NoteField` first (shared by assign/transfer/return/extend), then the CAPTION/HINT swap in each dialog, then
   `PlaceDeviceDialog` (kit retry buttons, 44 px radio rows).
5. Device types: view, form fields, image field (kit buttons, `field-box` file picker), sprite field, thumb, diagram,
   delete body.
6. After each file: `rg -n "on-surface|outline-variant|text-error|text-primary\b|text-\[|tracking-\[|text-(xs|sm|base|lg|xl|2xl)\b|font-(bold|extrabold|heading)|text-h[23]|rounded-md3|surface-container|secondary-container|focus(-within|-visible)?:|<button|\bmd:" <file>`
   → no hits (`text-primary\b` also matches inside `text-text-primary`; read those hits, only the bare class is wrong).
7. Pending: `node scripts/check-tokens.mjs --list`; confirm the 16 files report 0 and every other count is unchanged;
   delete the 16 keys (sorted order kept); `node scripts/check-tokens.mjs` exits 0.
8. Tests (below), impl-log "Slice 5b", checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
   `pnpm build`.

Rules: R1 (ui → ui only: new imports `../table`, `../Button`, `Pill` from `../Chip`), R3 none, R4 (Files tables only),
R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 5b)
| Test (file › name) | Covers |
|---|---|
| `screen-tokens.test.ts` › `MIGRATED` gains the 26 screen files of the Files tables (19 `ui/devices/…`, 7 `ui/deviceTypes/…`); the existing "every file exists and matches no legacy…" and "no migrated file is still on the pending list" tests then cover them | R-a…R-c, R-h |
| screen-tokens › `LEGACY`: `surface-(?:high\|highest\|low\|lowest\|container)` → `surface-(?:high\|highest\|low\|lowest\|container[\w-]*)` so `fill-surface-container-high` is caught (5a files have no such class; the 5a set stays green) | R-a gap found in DeskSlotDiagram |
| screen-tokens › "former hand-built buttons use the kit Button only": the existing invitation test's list gains `ui/devices/PlaceDeviceDialog.tsx` and `ui/deviceTypes/DeviceTypeImageField.tsx` (no `<button`) | R-f |
| screen-tokens › "device lists switch layout at lg": `DeviceTable`, `IncomingTransfers`, `PendingReturns`, `PendingExtensions`, `OverdueBanner` match no `/(?<![\w-])md:/` and each contains `lg:` | Q-S5-6 |
| screen-tokens › `DeviceTable.tsx` contains `TABLE_HEAD` and `TABLE_CELL` and no `const CELL`/`const HEAD` | R-g |
| `DevicesView.test.tsx` › new describe "tokens": h1 has `text-display` (plus the existing tabindex test); table wrapper class contains `hidden lg:block`, card list contains `lg:hidden`, markup has no `md:block`/`md:hidden`; `<th` has `text-caption` and `uppercase`; no `text-[` in the markup | R-b, R-g, Q-S5-6 |
| DevicesView.test › overdue row (extend 258–267): markup has `bg-danger-tint` and no `--error-container`; the split count of 4 stays; plain row has no `bg-danger-tint` | R-e |
| DevicesView.test › pending transfer (extend 299–304): `bg-warning-tint` present, chip count stays 2 | R-e |
| DevicesView.test › row actions (any test with actions, e.g. 269–280): each action button has `min-h-control`; wrapper has `gap-2` | R-f |
| `DeviceDetailView.test.tsx` › h1 `text-display` with `tabindex="-1"`; `<dt` has `text-caption` and `uppercase`; section `<h2` has `text-subtitle`; back link has `min-h-control`; overdue (extend 88–102) `bg-danger-tint`; pending (extend 104–125) `bg-warning-tint` | R-b, R-e, AC 3 |
| `DeviceHistory.test.tsx` › title `<h2` has `text-subtitle`; entries have `border-divider`; markup has no `font-bold`/`text-xs` | R-a, R-b |
| `IncomingTransfers.test.tsx`, `PendingReturns.test.tsx`, `PendingExtensions.test.tsx` › card has `lg:flex-row` and no `md:`; heading has `text-subtitle` and `tabindex="-1"`; buttons have `min-h-control` | Q-S5-6, R-b, R-f |
| `OverdueBanner.test.tsx` › card has `lg:flex-row`, no `md:`; pending extension (extend 57–70) shows its chip inside `bg-warning-tint` | Q-S5-6, R-e |
| `AssignDeviceDialog.test.tsx` › the no-expiry checkbox `<label` has `min-h-control`, the checkbox has `size-5`; the Expiry legend has `text-label` (existing regex at 43 still matches); the textarea sits inside an element with `field-box` and itself has `outline-none`; markup has no `text-[11px]` | R-f, NoteField |
| `PlaceDeviceDialog.test.tsx` › error states (extend 199–205): retry is a `<button` with `data-variant="outlined"` and `min-h-control`; seat and role radio `<label`s have `min-h-control`, radios `size-5` | R-f, AC 3 |
| `DeviceTypesView.test.tsx` › h1 `text-display`; type name `font-semibold`; no `font-bold`; Edit/Delete buttons have `min-h-control` | R-b, R-f |
| `DeviceTypeFormDialog.test.tsx` › slot radio `<label`s have `min-h-control`, radios `size-5`, no `mt-1`; legend `text-label` (the legend-first test at 29–33 unchanged) | R-f |
| `DeviceTypeImageField.test.tsx` › file label has `field-box` and `min-h-control` (regex at 31 still matches); with `showRemove` the Remove button has `data-variant="danger"`; with `showUndo` Keep current has `data-variant="outlined"`; no `focus-within:`; the disabled count of 2 at 71 unchanged | R-f, Rules |
| `DeviceTypeSpriteField.test.tsx` › option `<label`s have `min-h-control`, radios `size-5` | R-f |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with 16 keys removed | pending only shrinks |

Existing asserts that must keep passing unchanged (and why they do): `DevicesView.test.tsx:101/103` (`>You<`: "You"
stays a `Chip`), `:111` (5 `<button` = filter chips only), `:261/:301` (pill renders its label once per layout);
`TransferDeviceDialog.test.tsx:64` (class of line 52 untouched); `IncomingTransfers.test.tsx:69` (`whitespace-pre-line`
kept); `DeviceDetailView.test.tsx:98` (no `line-clamp` with `clamp=""`).

### Acceptance → verification (slice 5b)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S5b-1 | 5b screens use token utilities only; R-a/R-b/R-c applied | `screen-tokens.test.ts` green with 26 more files; `rg -n "on-surface\|outline-variant\|text-error\|text-\[\|tracking-\[\|font-(bold\|extrabold)\|text-h[23]\|rounded-md3\|surface-container\|secondary-container\|error-container" src/ui/devices src/ui/deviceTypes -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S5b-2 | No off-scale type: labels 14, metadata 12, h1 Display, h2 Subtitle, dialog captions 14 like `DialogField` | `rg -n "text-(xs\|sm\|lg\|2xl)\b" <same paths>` → no hits; DevicesView/DeviceDetailView/DeviceHistory/handoff tests |
| S5b-3 | Every interactive target ≥ 44 px: row actions, retry buttons, image-field buttons and file picker, all radio/checkbox rows, detail back link (AC 3) | tests above; `rg -n "<button\|min-h-11\|py-1\.5" <same paths>` → no hits |
| S5b-4 | Device table and handoff/overdue cards use the wide layout from 1024, stacked list/cards at 800–1023 (Q-S5-6) | screen-tokens lg test; `rg -n "\bmd:" src/ui/devices -g '!*.test.tsx'` → no hits; Ming check at 800 and 1024 |
| S5b-5 | Overdue and pending handoff states are toned pills with their text; no `var(--error-container)` | DevicesView/DeviceDetailView/OverdueBanner pill tests |
| S5b-6 | Focus stays visible without per-component focus classes: NoteField textarea and the image file picker ring via `.field-box:focus-within` | AssignDeviceDialog and ImageField tests; `rg -n "focus(-within\|-visible)?:" <same paths>` → no hits; manual Tab through the Assign dialog and the device-type form |
| S5b-7 | Pending shrinks by exactly the 16 keys (244 → 184); every touched pending file at 0 | `git diff main -- scripts/check-tokens.pending.json` shows 16 removed lines only; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S5b-8 | No behaviour, copy, prop, id or `aria-*` change; `data-handoff-confirm` attributes kept | existing tests unchanged except the listed additions; `git diff main -- src/ui/copy src/lib src/app` empty; read PlaceDeviceDialog/ImageField diffs: same handlers, labels, `disabled` |
| S5b-9 | Only planned files | `git diff --stat main` ⊆ Files tables |
| S5b-10 | Checks green; impl-log "Slice 5b" complete | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 5b)
- Devices list: at 800–1023 px the table is replaced by the stacked device cards (was a squeezed 7–8-column table);
  the table appears from 1024. Incoming transfers, pending returns, pending extensions and the overdue banner keep their
  stacked card layout (buttons under the text) up to 1023 and go side-by-side from 1024 (was 800).
- Table headers 11 px · 800 → 12 px · 600 uppercase; a divider under the header row; row borders divider.
- "Overdue" grey-red chip → red pill with a dot; "Transfer / Return / Extension pending" grey chip → amber pill with a
  dot (list, cards, detail page, overdue banner). "You" and Primary/Secondary chips unchanged.
- Device name and room links ink (unchanged colour, now a token); detail "Back" link 44 px tall.
- Page titles (Devices, device detail, Device types) 32 px · 800 → 32 px · 600; section headings (history, detail
  sections, handoff sections, overdue) 18 px · 800 → 18 px · 600 (history/detail `text-h3` was undefined, so they were
  16 px · 800 → now 18 px · 600). Device names in cards and history kinds 700 → 600.
- Small gaps in owner/details cells 2 → 4 px and chip rows 6 → 4 px.
- Dialogs (assign, note/expiry, transfer, give back, extend, device form, device type form): captions and legends
  uppercase 11 px · 800 grey → 14 px · 500 ink, matching the text-field captions already in the same dialogs; note box
  8 px corners, stronger border, green focus ring around the box (was a border-colour change); "No expiry" checkbox and
  every radio row 44 px tall with a 20 px control.
- Place dialog: "Retry" underlined text → 44 px outlined button next to the error; seat rows 8 px corners.
- Device types: "Choose/Replace image" pill (grey fill, 700) → 8 px secondary button with border, 44 px; "Remove" →
  red danger button, "Keep current image" → outlined button (were bare coloured text); type names 700 → 600; desk
  diagram uses canvas/divider colours (record what it looked like before, see Files table).

### Ming verification after merge (slice 5b)
- As Admin at 390 / 800 / 1024 / 1280 px, light and dark: Devices list (at 800 the card list, at 1024 the table —
  it may scroll sideways a little inside its card at exactly 1024), an overdue device (red "Overdue" pill), a device
  with a pending transfer (amber pill), the device detail page with history and "Load more", Incoming transfers /
  Pending returns / Pending extensions if any are open (buttons beside the text only from 1024).
- Open each device dialog (New/Edit device, Assign, Note / expiry, Transfer, Give back, Extend, Place/Move, Take back,
  Delete): captions readable, Tab shows a green ring on the note box, the checkbox and radio rows are easy to tap on a
  phone.
- Device types: list, New type form (slot radios, sprite options, Choose image → Remove / Keep current), delete
  dialog; keyboard Tab onto "Choose image" shows the green ring.

### Assumptions and non-blocking questions (slice 5b)
- Hotspots: no other ticket is IN_PROGRESS/REVIEW/DONE (`work/backlog.md`: only SIM-071). `screen-tokens.test.ts` and
  `scripts/check-tokens.pending.json` change again in 5c; 5b merges first.
- The `LEGACY` widening only adds `surface-container-*` names; the 18 5a files contain none
  (`rg surface-container src/ui` → only `checkin/**`, `roomlayout/SeatOverlay.tsx`, `DeskSlotDiagram.tsx`).
- Q-S5b-1 (non-blocking). Pending handoff chips ("Transfer/Return/Extension pending") are awaiting someone's
  confirmation: **default amber `warning` pill** (R-e "pending … awaiting confirmation", Q13). Alternative: blue `info`
  for "Transfer pending" only (R-e "in transfer").
- Q-S5b-2 (non-blocking). Dialog captions: **default 14 px label like the kit `DialogField`** so one dialog has one
  caption style; the detail page keeps uppercase 12 px labels (data sheet, like table headers). Alternative: uppercase
  12 px everywhere (then dialogs mix two caption styles).
- Q-S5b-3 (non-blocking). Device-name and room links inside table cells and cards stay text links (WCAG 2.5.8 spacing
  exception; making them 44 px would double every row). **Default: only the standalone detail "Back" link gets 44 px.**
- Q-S5b-4 (non-blocking). The image file picker is a `<label>` around a hidden file input; **default: reuse the
  `.field-box` class for its focus-within ring** (no CSS change in 5b). Alternative: a new CSS rule (globals.css
  change, slice 7).
- Q-S5b-5 (non-blocking). Desk diagram strokes on the divider token are faint but the diagram is decorative
  (`aria-hidden`). **Default: divider (R-a)**; `border-strong` is a one-word follow-up if Ming finds it too light.
- Q-S5b-6 (non-blocking). At exactly 1024 the content column is ~760 px (216 px sidebar), so the 8-column table may
  still scroll sideways inside its card. **Default: accept (Card already `overflow-x-auto`)**; a `xl` (1280) switch is
  the alternative if Ming finds it cramped.

## Slice 5c addendum — Dashboard, search, rooms and seats chrome
Status: READY. Written against `main` after #163 (slices 1–4, 5a, 5b merged). Applies the "Slice 5 addendum" rules
R-a…R-h and "Rules for every slice-5 file" **unchanged** to the screens in the "Slice 5c outline". Ming approved the plan
and the split with all defaults ("duyệt SIM-071, theo mặc định hết"). No new decisions; open points are non-blocking
questions at the end, each with a default. Closes AC 2, AC 3 and AC 6b for the Dashboard (tiles, deactivated-holders
warning, room grid, CSV export), Search, Rooms (list, card, occupancy ring, delete dialog) and the room page chrome
(`SeatsView` header and table, `SeatDetailPanel`, `SeatActions`, seat dialogs, member picker). `RoomMap`, `SeatOverlay`,
the layout editor and check-in stay in slice 6 (outline). Also folds in the three optional slice-5b review nits
(review.md:333–335), each a one- or two-line test/markup change. No `src/app/**`, `src/app/globals.css`,
`src/styles/tokens.css`, copy, `*-state.ts`/`*-api.ts`/`*-flow.ts`, `src/lib/**` or kit change.

### Size
14 screen files (≈ 200 changed lines), `screen-tokens.test.ts` (≈ 30), 9 test files (≈ 150), the 3 slice-5b nits (≈ 10),
pending (8 lines), impl-log (≈ 40): **≈ 440 changed lines**, below the ~600 limit, so 5c ships as **one PR** (no
sub-split).

### Pending list (R-h): 8 keys, 41 violations → 0 (183 → 142)
Counts read from `scripts/check-tokens.pending.json` on `main`. The JSON sums to **30 keys / 183** today (the "244 → 184"
and "184 → 143" totals in this plan were one too high, review.md:315; the 5b delta was right). After 5c: **22 keys /
142**, i.e. `globals.css` (65) plus slice-6 files only. Cause per key, as the guard counts it (`text-[Npx]` twice:
`text-arb` + `arbitrary-px`; `tracking-[0.05em]`, `[Nrem]`/`[Npx]` sizes, `font-[inherit]` and off-scale spacing once
each; `shadow-[0_12px_40px_…]` twice: `shadow-arb` + `arbitrary-px`):

| Key | Count | Cause (all removed by the Files table) |
|---|---|---|
| `src/ui/dashboard/DashboardView.tsx` | 6 | `text-[13px]` (38, 63, 148) |
| `src/ui/dashboard/ExportCard.tsx` | 4 | `text-[13px]` (23, 44) |
| `src/ui/rooms/OccupancyRing.tsx` | 2 | `text-[11px]` (40) |
| `src/ui/rooms/RoomCard.tsx` | 6 | `text-[18px]` (16), `text-[13px]` (27, 29) |
| `src/ui/search/SearchView.tsx` | 3 | `META` `text-[13px]` (27), badge `py-0.5` (72) |
| `src/ui/seats/MemberPickerDialog.tsx` | 1 | radio label `py-1.5` (70) |
| `src/ui/seats/SeatDetailPanel.tsx` | 9 | `LABEL` (15: 3), `gap-1.5` (52), `sm:max-w-[440px]` (216), `shadow-[…]` (216: 2), `text-[20px]` (224: 2) |
| `src/ui/seats/SeatsView.tsx` | 10 | `TH` (25: `py-2.5`, `text-[11px]` 2, `tracking-[…]`), `TD` `py-2.5` (26), `min-w-[34rem]` (130), `font-[inherit]` (161), `gap-1.5` (167), `max-w-[14rem]` (179), `max-w-[18rem]` (186) |

All 8 keys are deleted; every other key keeps its count (`globals.css` stays 65; slice-6 keys untouched).

### Shared values used in 5c (same strings as 5b "Shared values"; listed so every file agrees)
- **Page `<h1>`:** `text-display text-text-primary`. **Section / card / dialog `<h2>`:** `text-subtitle text-text-primary`
  (+ `outline-none` where the heading is a `tabIndex={-1}` focus target; kit dialog titles use the same class,
  `EntityFormDialog.tsx:77`).
- **Notices:** error `text-label font-semibold text-danger`; status `text-label font-semibold text-text-primary`;
  hint / empty / truncated / metadata lines `text-label text-text-secondary` (old class had `font-medium`) or
  `text-label font-normal text-text-secondary` (old class had no weight).
- **Detail field label** (`SeatDetailPanel` `<dt>`): `text-caption font-semibold uppercase tracking-wide
  text-text-secondary` (same as `DeviceDetailView` `<dt>`, 5b, and `TABLE_HEAD`, Q-S5-7).
- **Ink links** (`text-primary` was ink): `text-text-primary`, keeping each link's existing `font-*` (700/800 → 600) and
  its existing `underline` / `hover:underline`.
- **Standalone back link:** `inline-flex min-h-control items-center self-start text-label font-semibold
  text-text-primary hover:underline` (identical to `DeviceDetailView.tsx:88`, 5b).
- **Radio rows (R-f):** `<label>` `flex min-h-control cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-label
  text-text-primary` (identical to the `PlaceDeviceDialog` seat radio, 5b), input `className="size-5 flex-none"`.
- **Status pill (R-e):** `Pill` from `../Chip` with `dot`; "Deactivated" → `tone="neutral"` (R-e tone map, same as
  Members in 5a).

### Files (slice 5c)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, `scripts/check-tokens.pending.json` and tests are not
listed). Line numbers are from `main` after #163; the implementer re-reads each file first. "→" = replace the whole
class string with the given one unless "add"/"drop"/"keep" says otherwise.

**Dashboard**

| File | Change | Pending |
|---|---|---|
| `src/ui/dashboard/DashboardView.tsx` | HoldersWarning: title row (34) `flex items-center gap-2 text-danger`; title h2 (36) `text-label font-semibold`; hints (38, 63) `text-label text-text-secondary`; holder row (41) `flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal`; name (42) `font-semibold text-text-primary`; seat count / more seats (43, 55) `text-text-secondary`; seat link (47) `font-medium text-text-primary hover:underline`. Page: h1 (85) `text-display text-text-primary`; error (99) `text-label font-semibold text-danger`; rooms h2 (135) `text-subtitle text-text-primary`; no-rooms (138) and truncated (148) `text-label text-text-secondary`. Tiles already use `StatTile` (Title, slice 3): unchanged | 6 → 0 (remove) |
| `src/ui/dashboard/ExportCard.tsx` | h2 (22) `text-subtitle text-text-primary`; hint (23) and notice (44) `text-label text-text-secondary`; error (39) `text-label font-semibold text-danger` | 4 → 0 (remove) |
| `src/ui/dashboard/StatTile.tsx` | no change (already token-only); added to `MIGRATED` | not pending |

**Rooms**

| File | Change | Pending |
|---|---|---|
| `src/ui/rooms/RoomCard.tsx` | h2 (16) `text-subtitle text-text-primary`; code link (18) `hover:text-primary` → `hover:underline` (the ink-on-ink hover had no visible effect; Q-S5c-4); name (25) `truncate text-label text-text-primary`; floor (27) `text-label text-text-secondary`; seat summary (29) `mt-1 text-label text-text-secondary`; actions (35) `flex flex-wrap items-center gap-2` (R-f). Card already `Card as="article"` (rounded-xl, divider border, `shadow-card`): unchanged | 6 → 0 (remove) |
| `src/ui/rooms/OccupancyRing.tsx` | track (24) `stroke-outline-variant` → `stroke-divider`; arc (33) `stroke-primary` → `stroke-text-primary` (ink, same colour as today; Q-S5c-1); percent (40) `absolute inset-0 flex items-center justify-center text-caption font-semibold text-text-primary`. `role="img"`, `aria-label` and the percent text unchanged (R-e: the ring always has its number) | 2 → 0 (remove) |
| `src/ui/rooms/RoomsView.tsx` | h1 (36) `text-display text-text-primary`; error (56) `text-label font-semibold text-danger`; empty (67) `text-label text-text-secondary` | not pending |
| `src/ui/rooms/DeleteRoomDialog.tsx` | body (78) `text-label text-text-primary` | not pending |

**Search**

| File | Change | Pending |
|---|---|---|
| `src/ui/search/SearchView.tsx` | import `Pill` from `../Chip`; `LINK` (26) `font-semibold text-text-primary hover:underline`; `META` (27) `text-label text-text-secondary`; rows (32, 48, 66) `flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal`; seat code without link (38) `font-semibold text-text-primary`; occupant / owner (41, 54) `text-text-primary`; deactivated badge (72–74) → `<Pill dot tone="neutral" label={copy.deactivated} />` (R-e; was a red `error-container` badge); group h2 (96) `flex items-baseline gap-2 text-subtitle text-text-primary`; empty (103) and prompt (155) `text-label text-text-secondary`; errors (116, 166) `text-label font-semibold text-danger`; h1 (145) `text-display text-text-primary` | 3 → 0 (remove) |

**Seats / room page chrome**

| File | Change | Pending |
|---|---|---|
| `src/ui/seats/SeatsView.tsx` | delete `TH`/`TD` (24–26), import `TABLE_CELL, TABLE_HEAD, TABLE_ROW` from `../table` (R-g); `<thead>` (132) add `className="border-b border-divider"` (on `<thead>`, not the head `<tr>`, so `SeatsView.test.tsx:120` still counts 3 `<tr ` rows); `<th>` (134–143) `TABLE_HEAD`; body `<tr>` (153) `TABLE_ROW`; `<td>` (154–183) `TABLE_CELL`. BackLink (30) → standalone back link (shared value; 44 px). h1 (62) `text-display text-text-primary`; room name span (65) `` `block text-label ${CLIP} max-h-12` ``; notice (76) and error (99) `text-label font-semibold text-danger`; not-found icon (83) `text-text-secondary`, title (84) `text-body font-semibold text-text-primary`, body (85) `text-label text-text-secondary`; truncated (109) `text-label font-semibold text-text-secondary`; empty (118) `text-label text-text-secondary`. **Scroll region (123–128):** `<Card className="overflow-hidden">` → `<Card>`; region class `overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-primary` → `overflow-x-auto rounded-xl` (focus ring now from the global `:where(…, [tabindex]):focus-visible` rule, globals.css:339, which is unlayered and already beats `outline-none`; without `overflow-hidden` on the Card the 2 px offset ring is no longer clipped; `rounded-xl` keeps the table inside the card corners). Table (130) `min-w-[34rem]` → `min-w-136`. **Seat code button (155–164):** hand-built `<button>` → `<Button variant="text" size="sm" className="font-semibold" data-seat-code={seat.code} aria-haspopup="dialog" aria-label={seatsCopy.openSeat(seat.code)} onClick={() => onOpen(seat.code)}>{seat.code}</Button>` (R-f; import `Button` already present; `type="button"` is the kit default; 44 px). Status (167) `gap-1.5` → `gap-1`; occupant (179) `max-w-[14rem]` → `max-w-56`; devices (186) `max-w-[18rem]` → `max-w-72` | 10 → 0 (remove) |
| `src/ui/seats/SeatDetailPanel.tsx` | `LABEL` (15) → detail field label (shared value); `<dd>` (21) `text-label text-text-primary`; device link (29) `font-semibold text-text-primary underline`; device meta / owner (32, 36) `text-text-secondary`; status (52) `gap-1.5` → `gap-1`; dialog (216) `m-0 ml-auto h-dvh max-h-dvh w-full max-w-full sm:max-w-110 p-0 bg-surface text-text-primary overflow-y-auto shadow-dialog` (440 px unchanged; `bg-surface` + `shadow-dialog` like the kit `EntityFormDialog.tsx:72`, Q-S5c-3); title h2 (224) `` `text-subtitle text-text-primary max-h-14 outline-none ${CLIP}` `` (keeps `tabIndex={-1}`, `ref`, `id`); loading (232) `text-label text-text-secondary`; not-found title (238) `text-body font-semibold text-text-primary`, body (241) `text-label text-text-secondary`; error (248) `text-label font-semibold text-danger`. Seat status keeps icon + text (no pill; Q-S5c-2) | 9 → 0 (remove) |
| `src/ui/seats/MemberPickerDialog.tsx` | import `Button` from `../Button`; radio label (70) → radio row (shared value; `rounded-md3` → `rounded-lg`, `py-1.5` → `py-2`); radio input (72–79) add `className="size-5 flex-none"`; code / occupant suffix (83, 85) `text-text-secondary`; loading / empty (91, 94) `text-label font-normal text-text-secondary`; error (97) `flex flex-wrap items-center gap-2 text-label font-semibold text-danger`, `{copy.pickerError}` then `<Button variant="outlined" size="sm" onClick={onRetry}>{seatsCopy.retry}</Button>` (no `{" "}`: the flex gap spaces it; R-f); more-failed (105) `text-label font-semibold text-danger`; Load more (110–117) → `<Button variant="text" size="sm" className="self-start" disabled={!canMore} onClick={onMore}>{copy.pickerLoadMore}</Button>` (R-f: bare → `text`). Radiogroup wrapper (63) **unchanged** (`max-h-[35dvh]` is not flagged and `MemberPickerDialog.test.tsx:47` asserts it). Also rendered inside `AssignDeviceDialog`/`TransferDeviceDialog` (5b), which gain the same 44 px rows | 1 → 0 (remove) |
| `src/ui/seats/SeatActions.tsx` | alert (42) `text-label font-semibold text-danger`; status (47) `text-label font-semibold text-text-primary`; button row (61) **unchanged** (`flex flex-wrap gap-2` is token-only, every child is a 44 px kit `Button`, and `SeatActions.test.tsx:171` matches the exact class) | not pending |
| `src/ui/seats/ConfirmSeatDialog.tsx` | body (34) `` `max-h-32 text-label text-text-primary ${CLIP}` `` (`SeatActionDialogs.test.tsx:49` still matches) | not pending |
| `src/ui/seats/SeatTagsDialog.tsx` | loading (90) `text-label font-normal text-text-secondary` | not pending |

**Slice-5b review nits (review.md:333–335; optional, folded in because each is trivial)**

| File | Change |
|---|---|
| `src/ui/devices/DeviceDetailView.test.tsx` | 164: replace `expect(html).toMatch(/<a[^>]*min-h-control[^>]*>/)` with `const back = html.match(/<a[^>]*href="\/devices"[^>]*>/)?.[0]; expect(back).toBeDefined(); expect(back).toContain("min-h-control");` (pins the back link) |
| `src/ui/devices/DevicesView.test.tsx` | 382–384: `const edits = html.match(/<button[^>]*aria-label="Edit[^>]*>/g) ?? []; expect(edits.length).toBeGreaterThan(0);` then the existing per-button `min-h-control` loop |
| `src/ui/devices/PlaceDeviceDialog.tsx` | 100, 159: drop the `{" "}` after `{copy.roomsError}` / `{copy.seatsError}` (flex `gap-2` spaces the retry button; `PlaceDeviceDialog.test.tsx:204, 211` use `toContain` on the message and stay green) |

**Pending, tests, log**

| File | Change |
|---|---|
| `scripts/check-tokens.pending.json` | delete the 8 keys above (183 → 142, 30 → 22 keys); nothing else changes |
| `src/ui/screen-tokens.test.ts` | extend (Tests) |
| `src/ui/dashboard/DashboardView.test.tsx`, `src/ui/rooms/RoomsView.test.tsx`, `src/ui/search/SearchView.test.tsx`, `src/ui/seats/SeatsView.test.tsx`, `SeatDetailPanel.test.tsx`, `MemberPickerDialog.test.tsx`, `SeatActions.test.tsx`, `SeatActionDialogs.test.tsx`; plus the two 5b nit files above | extend (Tests); no existing assert is removed (the nit at `DeviceDetailView.test.tsx:164` replaces one assert with a stricter one) |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 5c": files, pending before/after (183 → 142, 8 keys, with the corrected totals note), visible differences, checks |

Not touched (read; no class strings, only kit components, or out of 5c): `DashboardPage.tsx`, `RoomsPage.tsx`,
`RoomFormDialog.tsx` (only `DialogField`s), `SearchPage.tsx` (only `page-content`), `AddSeatsDialog.tsx`,
`CannotSeatDialog.tsx` (no `className`), `SeatsPage.tsx` (only `page-library`), every `*.ts` in the four folders,
`src/ui/table.ts`, `src/ui/Chip.tsx`, `src/ui/Button.tsx`, `src/ui/Card.tsx`, `src/ui/clip.ts`, `src/ui/roomlayout/**`
(`RoomMap`, `SeatOverlay`, editor: slice 6), `src/ui/checkin/**` (slice 6; it renders `SeatDetailPanel`, which changes
here), `src/ui/copy/**`, `src/lib/**`, `src/app/**`, `src/app/globals.css`, `src/styles/tokens.css`,
`scripts/check-tokens.mjs`.

### Approach (slice 5c)
1. Dashboard: `DashboardView`, `ExportCard`.
2. Rooms: `RoomCard`, `OccupancyRing` (also seen on the Dashboard), `RoomsView`, `DeleteRoomDialog`.
3. Search: `SearchView` (Deactivated pill).
4. Room page: `SeatsView` (`TABLE_*`, scroll region, kit seat-code button, back link), then `SeatDetailPanel`,
   `MemberPickerDialog` (kit retry / Load more, 44 px radio rows), `SeatActions`, `ConfirmSeatDialog`, `SeatTagsDialog`.
5. The three 5b nits.
6. After each screen file: `rg -n "on-surface|outline-variant|text-error|error-container|text-primary\b|text-\[|tracking-\[|text-(xs|sm|base|lg|xl|2xl)\b|font-(bold|extrabold|heading)|font-\[|text-h[23]|rounded-md3|surface-(high|container)|shadow-\[|(min|max)-w-\[|focus(-within|-visible)?:|<button|py-(0|1|2)\.5|gap-1\.5" <file>`
   → no hits (`text-primary\b` also matches inside `text-text-primary`/`stroke-text-primary`; read those hits, only the
   bare class is wrong; `max-h-[35dvh]` is not matched).
7. Pending: `node scripts/check-tokens.mjs --list`; confirm the 8 files report 0 and every other count is unchanged;
   delete the 8 keys (sorted order kept); `node scripts/check-tokens.mjs` exits 0.
8. Tests (below), impl-log "Slice 5c", checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
   `pnpm build`.

Rules: R1 (ui → ui only: new imports `../table`, `../Button`, `Pill` from `../Chip`), R3 none, R4 (Files tables only),
R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 5c)
| Test (file › name) | Covers |
|---|---|
| `screen-tokens.test.ts` › `MIGRATED` gains 18 files: `ui/dashboard/{DashboardView,ExportCard,StatTile}.tsx`, `ui/rooms/{RoomCard,OccupancyRing,RoomsView,DeleteRoomDialog,RoomFormDialog}.tsx`, `ui/search/{SearchView,SearchPage}.tsx`, `ui/seats/{SeatsView,SeatDetailPanel,MemberPickerDialog,SeatActions,ConfirmSeatDialog,SeatTagsDialog,AddSeatsDialog,CannotSeatDialog}.tsx` (the five unchanged ones are already clean, `rg` checked); the existing "every file exists and matches no legacy…" and "no migrated file is still on the pending list" tests then cover them; the header comment "5b and 5c append theirs" → "slice 7 replaces this test" | R-a…R-c, R-h |
| screen-tokens › "the invitation entry points use the kit Button only": list gains `ui/seats/SeatsView.tsx` and `ui/seats/MemberPickerDialog.tsx` (no `<button`) | R-f |
| screen-tokens › `SeatsView.tsx` contains `TABLE_HEAD` and `TABLE_CELL` and no `const TH`/`const TD` (extend the DeviceTable shared-table test into a loop over both files) | R-g |
| `DashboardView.test.tsx` › new "tokens" test: h1 has `text-display`; rooms `<h2` has `text-subtitle`; with holders (fixture at 85–102) the warning h2 sits in a `text-danger` row and the hint has `text-label`; with `canExport` the export `<h2` has `text-subtitle`; markup has no `text-[`, `font-extrabold`, `text-on-surface` | R-a, R-b |
| `RoomsView.test.tsx` › new "tokens" test: h1 `text-display`; each card `<h2` has `text-subtitle`; ring has `stroke-divider` and `stroke-text-primary`, the percent `<span` has `text-caption`; no `text-[`; manager view: action wrapper `flex flex-wrap items-center gap-2`, Edit/Delete buttons (match `aria-label="Edit`/`aria-label="Delete`, length > 0) each contain `min-h-control` | R-b, R-f, R-e |
| `SearchView.test.tsx` › deactivated member (extend 138–146): markup has `bg-canvas` and the dot span next to `copy.deactivated`, no `bg-danger-tint`/`error-container`; ready state: h1 `text-display`, group `<h2` `text-subtitle`, no `text-[`/`py-0.5` | R-e, R-b |
| `SeatsView.test.tsx` › new "tokens" test: h1 `text-display`; back link (`<a[^>]*href="/rooms"[^>]*>`, defined) contains `min-h-control`; `<th` has `text-caption` and `uppercase`; table has `min-w-136`; each `data-seat-code` button tag (count = `seats.length`) contains `min-h-control` and `data-variant="text"`; the `role="region"` tag contains `rounded-xl` and no `focus-visible:`/`outline-none`; markup has no `text-[`, `max-w-[`, `font-[`. Existing 120 (`<tr ` × 3) and 121 (`data-seat-code`) unchanged and green | R-b, R-c, R-f, R-g, AC 3 |
| `SeatDetailPanel.test.tsx` › new "tokens" test: ready view `<dt` has `text-caption` and `uppercase`; `<dialog` tag has `bg-surface`, `shadow-dialog`, `sm:max-w-110`, no `shadow-[`; title `<h2` has `text-subtitle` (existing 120 tabindex test unchanged); device link has `font-semibold`, no `font-bold`. Existing 102 (one `<button`) unchanged | R-a, R-b, R-c |
| `MemberPickerDialog.test.tsx` › radio `<label`s have `min-h-control`, radios `size-5`; error state retry `<button` has `data-variant="outlined"`; Load more has `data-variant="text"` and `min-h-control`; no `rounded-md3`. Existing 39/41 (`<button type="button"[^>]*>Load more` / `Try again`: kit `Button` renders `type` first) and 47 (`max-h-[35dvh]`) unchanged | R-f, AC 3 |
| `SeatActions.test.tsx` › notices (extend 174–180): alert has `text-danger`, status has `text-text-primary`; no `text-error` | R-a |
| `SeatActionDialogs.test.tsx` › confirm body (extend 49): has `text-label`, no `text-sm` | R-b |
| `DeviceDetailView.test.tsx`, `DevicesView.test.tsx` › 5b nits (Files table) | review.md:333–334 |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with the 8 keys removed | pending only shrinks |

### Acceptance → verification (slice 5c)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S5c-1 | 5c screens use token utilities only; R-a/R-b/R-c applied | `screen-tokens.test.ts` green with 18 more files; `rg -n "on-surface\|outline-variant\|text-error\|error-container\|text-\[\|tracking-\[\|font-(bold\|extrabold)\|font-\[\|text-h[23]\|rounded-md3\|surface-high\|shadow-\[" src/ui/dashboard src/ui/rooms src/ui/search src/ui/seats -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S5c-2 | No off-scale type: labels 14, metadata 12, h1 Display, section/card/panel titles Subtitle (Q8, Q16) | `rg -n "text-(xs\|sm\|base\|lg\|2xl)\b" <same paths>` → no hits; Dashboard/Rooms/Search/SeatsView/SeatDetailPanel token tests |
| S5c-3 | Every interactive target ≥ 44 px: seat-code buttons, back link, picker retry and Load more, picker radio rows, room card actions (AC 3) | SeatsView, MemberPickerDialog, RoomsView tests; `rg -n "<button\|py-1\.5\|py-0\.5" <same paths>` → no hits |
| S5c-4 | Room table uses the shared table classes; keyboard focus on the scroll region is visible without per-component focus classes | screen-tokens shared-table test; SeatsView region test; `rg -n "focus(-within\|-visible)?:" <same paths>` → no hits; manual Tab onto the room table at 390 px shows the green ring |
| S5c-5 | Every status has text: Deactivated (search) is a neutral pill with its label; seat status keeps icon + text; occupancy ring keeps its percentage and `aria-label` (R-e) | SearchView pill test; SeatsView "status has text" (existing 128–133); RoomsView ring test + existing 66–69 |
| S5c-6 | Pending shrinks by exactly the 8 keys (183 → 142, 30 → 22 keys); every touched pending file at 0 | `git diff main -- scripts/check-tokens.pending.json` shows 8 removed lines only; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S5c-7 | No behaviour, copy, prop, id, `data-*` or `aria-*` change (`data-seat-code`, `data-add-seats`, `data-device-count`, `data-reason`, `aria-haspopup`, heading `tabIndex`/`ref`) | existing tests unchanged except the listed additions and the stricter nit assert; `git diff main -- src/ui/copy src/lib src/app` empty; read SeatsView/MemberPickerDialog diffs: same handlers, labels, `disabled` |
| S5c-8 | 5b review nits applied: back-link assert pinned to `href="/devices"`, Edit-button count check, no `{" "}` before the Place dialog retries | read the three diffs; `rg -n '\{" "\}' src/ui/devices/PlaceDeviceDialog.tsx` → no hits; mutation: remove `min-h-control` from `DeviceDetailView.tsx:88` → test fails |
| S5c-9 | Only planned files | `git diff --stat main` ⊆ Files tables |
| S5c-10 | Checks green; impl-log "Slice 5c" complete | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 5c)
- Page titles (Dashboard, Rooms, Search, room page) 32 px · 800 → 32 px · 600. Section headings (Dashboard "Rooms",
  CSV export, search groups) 18 px · 800 → 18 px · 600; room card codes 18 px · 800 → 18 px · 600.
- 13 px grey hints and metadata (dashboard hints, room floor and seat summary, search metadata, export notice) → 14 px.
- Occupancy ring: percentage 11 px · 800 → 12 px · 600; track on the divider colour; arc colour unchanged (ink).
- Search: the red "Deactivated" badge → grey pill with a dot (same as Members).
- Room page: "Back to rooms" link 44 px tall, 14 px · 600 (was 14 px · 700); table headers 11 px · 800 → 12 px · 600
  uppercase with a divider under the header row; cell padding 16/10 px → 12/8 px; seat codes become 44 px text buttons
  (14 px · 600, was 14 px · 800 in a smaller box), so rows are taller; the table's keyboard focus ring is the global
  green ring around the card (was an inset ring clipped by the card); occupant and devices columns keep their widths
  (224 / 288 px).
- Seat panel: white surface with the dialog shadow (was the slightly darker surface-high); title 20 px · 800 →
  18 px · 600; field labels 11 px · 800 → 12 px · 600 uppercase; device links 700 → 600. Also seen from check-in.
- Member picker (assign seat, and the device assign/transfer dialogs): radio rows 44 px with a 20 px radio, 8 px corners;
  "Try again" underlined text → outlined 44 px button; "Load more" bold coloured text → 44 px text button.
- Room card actions vertically centred; room code link underlines on hover.
- Place-device dialog (5b nit): no extra space before the "Retry" button (gap unchanged).

### Ming verification after merge (slice 5c)
- As Admin at 390 / 800 / 1280 px, light and dark: Dashboard (tiles, a room grid, the deactivated-holders warning if
  any, CSV export buttons as Manager+), Rooms (cards, ring readable in dark mode, Edit/Delete), Search for a seat, a
  device and a deactivated member (grey pill).
- Open a room: back link, room table (scrolls sideways at 390; Tab onto it shows the green ring, not clipped), click a
  seat code → panel (labels, device links, actions, Assign → member picker with 44 px rows, Load more / Try again if
  reproducible), Block/Unblock and Tags dialogs. Open a seat from check-in once to confirm the panel looks the same.

### Assumptions and non-blocking questions (slice 5c)
- Hotspots: no other ticket is IN_PROGRESS/REVIEW/DONE (`work/backlog.md`). `MemberPickerFields` is shared with the 5b
  device dialogs and `SeatDetailPanel` with check-in (slice 6); both change only in classes, so their tests stay green.
  `screen-tokens.test.ts` and `scripts/check-tokens.pending.json` change again in slice 6; 5c merges first.
- The outline's "Dashboard metrics use `StatTile`" and "Room cards … via `Card`" are already true on `main` (slice 3);
  nothing to do. "Search result types → neutral pills" maps to the only status-like badge in search results
  (Deactivated); result groups are already named by their headings, and adding type pills would be new markup.
- Q-S5c-1 (non-blocking). The outline said "`OccupancyRing` ring colours → `success/warning/danger`", but no occupancy
  thresholds exist in the spec (docs/spec-v1.md:627 "an occupancy ring as in seatMGT"), `work/decisions.md` or the brief,
  and the ring shows a quantity (with its number), not a status. **Default: mechanical R-a (track `stroke-divider`, arc
  `stroke-text-primary`, same ink as today).** Alternative: toned arc by threshold (e.g. < 80 % success, 80–99 %
  warning, 100 % danger) via a pure `occupancyTone` in `src/lib/rooms/occupancy.ts` with unit tests: a follow-up once
  Ming picks the thresholds.
- Q-S5c-2 (non-blocking). Seat status (Occupied / Empty / Cannot seat) is icon + text with no colour today, so R-e is
  already met. **Default: keep icon + text** in the table and panel. Alternative: toned pills (a follow-up; the map
  legend in slice 6 should agree first).
- Q-S5c-3 (non-blocking). The seat panel is a side-sheet `<dialog>`; R-a maps `bg-surface-high` to `bg-canvas`, but the
  kit dialogs use `bg-surface` + `shadow-dialog`. **Default: `bg-surface` + `shadow-dialog`** so every dialog reads the
  same. Alternative: `bg-canvas` (mechanical).
- Q-S5c-4 (non-blocking). Ink links keep their current underline behaviour (dashboard seat links and search links
  underline on hover only, as today). **Default: unchanged; the room card code link gets `hover:underline`** (its old
  `hover:text-primary` was ink on ink, no visible effect). Always-underlined links are a follow-up if Ming wants them.
- Q-S5c-5 (non-blocking). The seat-code button gets kit `px-4`, so codes sit 16 px further right than the header
  text. **Default: accept** (a negative margin to re-align it would be a one-off class). Alternative: a small negative
  left margin on that button, checked in the browser (it must not be clipped by the scroll region).

Status: READY

## Slice 6 addendum — End-user and pixel surfaces
Status: READY. Written against `main` after #164 (slices 1–4 and 5a–5c merged), Split proposal item 6 and Ming's
approval of the plan and split with all defaults ("duyệt SIM-071, theo mặc định hết"; Q10 answered: DM Sans, Fraunces
kept for the sign-in headline). Applies the "Slice 5 addendum" rules R-a…R-h and "Rules for every slice-5 file"
**unchanged**, plus one pixel-chrome rule R-i below. No new decisions; open points are non-blocking Q-S6-n at the end,
each with a default. Sprites, canvas paint and art colours (`--px-*`, `src/lib/sprites/**`, `paint.ts`,
`photo-canvas.ts`, `RoomThumb` fills) stay untouched. The globals.css entries that slice 7 owns (compat aliases in
`:root` and `@theme inline`, `rgba()` helpers, the `--px-*` art palette, `.i`, `.font-heading`, `.text-h2`) stay out of
scope.

### Size and split
Measured on `main` after #164 (non-test `.tsx` in the five slice-6 folders): 288 lines carry a legacy alias, raw
Tailwind size, 700/800 weight or arbitrary value, in 55 files, plus 77 guard violations in 21 pending files and 33 in
the `.aw-*`/`.px-*` part of `globals.css`. One PR would be about 1300 changed lines. The suggested 6a/6b split
(portal + check-in + auth + globals; then roomlayout + mapItems) still gives a 6a of about 800, so slice 6 ships as
**three PRs** (Q-S6-1):

| Sub-slice | Surfaces | Pending keys → 0 | Pending total | Expected size |
|---|---|---|---|---|
| **6a** (this addendum, fully specified) | Auth (every `AuthLayout` screen, sign-in scene and small world), check-in (page, popup, floating button, Who's here), globals.css `.aw-*`, `.px-card`/`.px-strip`/`.px-title`/`.px-frame`, `--aw-*` removal, `world-palette.test.ts` → `tokens.test.ts` | 6 keys, 16 violations, plus `globals.css` 65 → 32 | 142 → 93 | ≈ 490 changed lines |
| 6b (outlined) | Portal (My seat, My devices, My requests, Profile, pixel character picker) | 5 keys, 10 | 93 → 83 | ≈ 350 |
| 6c (outlined) | Room map and layout-editor chrome (`roomlayout/**`), Map items library and item editor (`mapItems/**`) | 10 keys, 51 | 83 → 32 | ≈ 450 (if over ~600: split into roomlayout and mapItems) |

After 6c the pending list holds only `src/app/globals.css` (32: the `--px-*` art palette 20, compat `rgba()` 10, `.i`
icon font-family 1, `.px-scene` 1), which is slice 7's.

6a ≈ 490: globals.css ≈ 150, `world-palette.test.ts` deleted (62), `tokens.test.ts` ≈ 60, auth screens ≈ 20, check-in
screens ≈ 50, screen tests ≈ 65, `screen-tokens.test.ts` ≈ 30, pending 7, impl-log ≈ 45.

### Pending list (R-h): all 21 slice-6 keys, 77 violations
Counts read from `scripts/check-tokens.pending.json` on `main` (22 keys / 142 = `globals.css` 65 + these 77). Cause
per key as the guard counts it (`text-[Npx]` twice: `text-arb` + `arbitrary-px`; `shadow-[…Npx…]` twice;
`tracking-[0.0Nem]`, `[Npx]`/`[Nrem]` sizes and off-scale spacing once each; `rgba(` once as `color-fn`):

| Key | Count | Sub-slice | Cause |
|---|---|---|---|
| `src/ui/auth/AuthLayout.tsx` | 3 | 6a | `max-w-[400px]` (26), `max-w-[816px]` (70), `gap-10` (70) |
| `src/ui/auth/DevGate.tsx` | 1 | 6a | `tracking-[0.06em]` (59) |
| `src/ui/auth/account-views.tsx` | 2 | 6a | `min-h-[65px]` (121, 190) |
| `src/ui/auth/views.tsx` | 1 | 6a | `min-h-[65px]` (138) |
| `src/ui/checkin/CheckinPopup.tsx` | 7 | 6a | `w-[min(32rem,calc(100vw-1.5rem))]` (67), `tracking-[0.12em]` (74), `border-[3px]` (96, 97, 180), `shadow-[0_4px_0_0_var(--px-shadow)]` (180: 2) |
| `src/ui/checkin/CheckinView.tsx` | 2 | 6a | `bottom-[calc(68px+…)]` (19), `lg:grid-cols-[minmax(0,1fr)_300px]` (71) |
| `src/ui/portal/MyDevicesTable.tsx` | 3 | 6b | `HEAD` `text-[11px]` (22: 2), `min-w-[960px]` (129) |
| `src/ui/portal/PixelLookPicker.tsx` | 3 | 6b | `gap-1.5` (48, 50 ×2) |
| `src/ui/portal/ProfilePhotoSection.tsx` | 2 | 6b | `BTN` `gap-1.5` (7), `py-1.5` (65) |
| `src/ui/portal/ProfileTabView.tsx` | 1 | 6b | `gap-1.5` (35) |
| `src/ui/portal/SeatCard.tsx` | 1 | 6b | `gap-1.5` (53) |
| `src/ui/mapItems/MapItemEditor.tsx` | 11 | 6c | `text-[11px]` + `tracking-[0.05em]` (64: 3), `text-[20px]` (67: 2), `text-[13px]` (104: 2), dialog `w-[calc(100%-1.5rem)]`, `max-w-[580px]`, `shadow-[0_12px_40px_…]` (332: 4) |
| `src/ui/mapItems/MapItemEditorAppearance.tsx` | 5 | 6c | `py-0.5` (171), `text-[11px]` (190: 2), `text-[13px]` (258: 2) |
| `src/ui/mapItems/MapItemEditorDetails.tsx` | 8 | 6c | `CAPTION` (15: 4), `text-[13px]` (130: 2, 168: 2) |
| `src/ui/mapItems/SpriteBrowser.tsx` | 4 | 6c | `text-[11px]` (114: 2, 117: 2) |
| `src/ui/roomlayout/EditorInspector.tsx` | 6 | 6c | `py-1.5` + `text-[13px]` (130: 3, 152: 3) |
| `src/ui/roomlayout/EditorViews.tsx` | 2 | 6c | `BTN` `text-[13px]` (15) |
| `src/ui/roomlayout/LayoutEditor.tsx` | 1 | 6c | `grid-cols-[minmax(0,1fr)_18rem]` (193) |
| `src/ui/roomlayout/Palette.tsx` | 2 | 6c | `text-[13px]` (55) |
| `src/ui/roomlayout/RoomMapSection.tsx` | 2 | 6c | `text-[13px]` (84) |
| `src/ui/roomlayout/SeatOverlay.tsx` | 10 | 6c | `gap-1.5`, `px-2.5` (18: 2), `bg-[rgba(22,27,37,.92)]` (20, 165, 166: 3), `gap-1.5`, `px-2.5` (165: 2, 166: 2), `px-2.5` (204) |

`src/app/globals.css` (65) by cause, from the slice-2 rules: `--px-*` hex 20 (lines 83–95, 109–115), compat `rgba()` 10
(74–80, 101–106), `.i` font-family 1 (254), `.px-frame` box-shadow 1 (378), `.px-title` font-size 1 (408), `.px-card`
box-shadows 2 (424, 433), `.px-scene` box-shadow 1 (452), `--aw-*` hex 16 (467–484), `.aw-*` literals 13 (font-size
493, 528, 550, 560, 573, 677, 693; border-radius 522, 577, 607; box-shadow 580, 650, 697). **6a removes 33** (every
`--aw-*`/`.aw-*`, `.px-title`, `.px-card`, `.px-frame` entry) → **32**, the slice-7 remainder listed in "Size and split".

### R-i Pixel chrome (new in slice 6; colour only, no new token)
Pixel-green scope is Q4 (approved): `AuthLayout` screens, check-in, Map items + item editor, the layout palette and the
pixel character picker. Pixel surfaces keep square edges where they are pixel frames (brief: "Pixel artwork and sprites
keep square edges"; D52), but every colour comes from tokens:

| Old | New |
|---|---|
| `--aw-bg` | `var(--color-cream)` (brief: "Login or marketing screens: `--color-cream`") |
| `--aw-ink` | `var(--color-text-pixel)` (brief: "login content") |
| `--aw-muted` | `var(--color-text-secondary)` |
| `--aw-line` | `var(--color-divider)` |
| `--aw-strip` | `var(--color-tile)` |
| `--aw-accent` | `var(--color-pixel-primary)` |
| `--aw-on-accent` | `var(--color-on-action)` |
| `--aw-serif-ink` | `var(--color-pixel-primary)` (large text only: Display/Hero ≥ 24 px, AA large 3:1; Q-S6-4) |
| `.px-card [data-variant="filled"]` (orange `--px-btn` square button) | kit `<Button variant="pixel">` (pixel-primary, white, `rounded-lg`, `shadow-pixel`, hover pixel-hover; Q-S6-2) |
| `.aw-card [data-variant="filled"]` | re-pointed in CSS to the same values as kit `pixel` (Q-S6-3) |
| `border-px-outline` on check-in chrome (frame lines, selected row) | `border-pixel-primary` |
| `bg-px-wall` title bar | `bg-tile text-text-pixel` |
| `accent-primary` on pixel-scope radios | `accent-pixel-primary` |
| `bg-surface-container(-high)` behind a sprite / pixel head | `bg-tile` (brief: "Sprite previews: `--color-tile`") |
| `border-[3px]` | `border-3` (v4 bare-number border width, same 3 px, not flagged) |
| `rounded-none`, `shadow-[0_4px_0_0_var(--px-shadow)]` overrides on kit buttons | delete (kit variant look) |

CSS in the `.aw-*`/`.px-*` blocks: colours, font sizes, radii and shadows only from `var(--color-*)`, `var(--text-*)`
(+ `--line-height`), `var(--radius-*)`, `var(--shadow-*)`; padding/gap/margin from `var(--space-*)` with R-d rounding
(padding half steps up, gap down); weights 700/800 → 600 (Q7). Geometry tied to the 384×224 canvases and 32 px sprites
(`width`, `height`, `top`/`left`/`right`/`bottom`, `grid-template-columns`, `max-width`) is unchanged. A 0-offset
`box-shadow` ring becomes `outline` (same pixels, not a shadow).

### Shared values used in 6a (same strings as 5b/5c "Shared values")
- **Page `<h1>`:** `text-display text-text-primary`. **Section `<h2>`:** `text-subtitle text-text-primary`. **Card title
  in `AuthLayout`:** `aw-heading text-subtitle` (colour from `.aw-heading`).
- **Notices:** error `text-label font-semibold text-danger`; status `text-label font-semibold text-text-primary` (or
  `text-text-secondary` where the old class was `text-on-surface-variant`); hint / empty / body lines `text-label
  font-normal text-text-secondary` (`text-label font-normal` when the old class had no colour).
- **Standalone link** (a link that is not inside a sentence): `inline-flex min-h-control items-center text-label
  font-semibold text-text-primary underline` (5c back-link classes, keeping the existing `underline`).
- **Radio rows (R-f):** `<label>` `min-h-control cursor-pointer`, input `size-5 flex-none`.

### globals.css (6a) — rule by rule
Line numbers from `main` after #164. Keep both marker comments (`/* SIM-068 auth world (aw-*) */`,
`/* SIM-068.1 small world (aw-world) */`): `SmallWorld.test.tsx:121` slices from the second one.

| Lines | Rule | Change |
|---|---|---|
| 375–386 | `.px-frame` (only user: CheckinPopup dialog) | → `position: relative; border: 4px solid var(--color-pixel-primary); box-shadow: var(--shadow-pixel);` (Q-S6-9) |
| 387–413 | `.px-strip`, `.px-strip > span`, `.px-strip > .px-title`, `.px-title` | delete (no element uses them: `rg "px-strip\|px-title" src --glob '!*.css'` hits only tests asserting absence; Q-S6-5) |
| 419–441 | `.px-card [data-variant="filled"]` and its `:active`, `:disabled`, `:focus-visible` | delete (check-in adopts `variant="pixel"`, Q-S6-2) |
| 371–374, 414–418, 442–463 | `.px-stage`, `.px-heading`, `.px-scene`, `.px-scene-canvas` | **unchanged** (art frame of the sign-in vignette on the `--px-*` art palette, or unused; slice 7, Q-S6-5) |
| 466–485 | `:root` / `[data-theme="dark"]` `--aw-*` blocks | delete (16 hex); the tokens already switch with the theme |
| 486–489 | `.aw-stage` | `background: var(--color-cream); color: var(--color-text-pixel);` |
| 490–494 | `.aw-header, .aw-footer` | `color: var(--color-text-secondary); font-size: var(--text-label); line-height: var(--text-label--line-height);` (13 → 14 px, Q-S6-15) |
| 495–501 | `.aw-header` | `gap: var(--space-2); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-divider);` |
| 502–509 | `.aw-footer` | `gap: var(--space-1) var(--space-6); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-divider);` |
| 515–525 | `.aw-logo` | `border-radius: var(--radius-lg); background: var(--color-workspace-primary); color: var(--color-on-action);` (same as the shell logo, `AppShellView.tsx:66`; drops the `--accent-orange`/`--on-accent` aliases; Q-S6-16) |
| 526–530 | `.aw-wordmark` | `font-size: var(--text-subtitle); line-height: var(--text-subtitle--line-height); font-weight: 600; color: var(--color-text-pixel);` |
| 531–535 | `.aw-divider` | `background: var(--color-divider);` |
| 540–547 | `.aw-hero` | `gap: var(--space-3);` |
| 548–555 | `.aw-eyebrow, .aw-strip-title` | `font-size: var(--text-caption); line-height: var(--text-caption--line-height); font-weight: 600;` (letter-spacing, uppercase kept) |
| 556–558 | `.aw-eyebrow` | `color: var(--color-text-secondary);` |
| 559–564 | `.aw-headline` | `font-size: var(--text-display); line-height: var(--text-display--line-height); font-weight: 600; text-wrap: balance;` then `@media (width >= 1024px) { .aw-headline { font-size: var(--text-hero); line-height: var(--text-hero--line-height); font-weight: 500; } }` (Q10 approved: Hero from `lg`, Display below) |
| 565–570 | `.aw-serif` | font-family **unchanged** `var(--font-serif), Georgia, serif` (Fraunces, D85; passes the guard: starts with `var(`), italic, 400; `color: var(--color-pixel-primary);` |
| 571–574 | `.aw-subline` | `color: var(--color-text-secondary); font-size: var(--text-body); line-height: var(--text-body--line-height);` |
| 575–581 | `.aw-frame` | `border: 1px solid var(--color-divider); border-radius: var(--radius-xl); background: var(--color-cream); box-shadow: var(--shadow-card);` (brief cards: `--radius-xl`, `--shadow-card`; Q-S6-6, Q-S6-7) |
| 582–590 | `.aw-strip` | `gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-tile); color: var(--color-text-pixel); border-bottom: 1px solid var(--color-divider);` |
| 591–596 | `.aw-strip-mark` | `background: var(--color-pixel-primary);` |
| 597–603 | `.aw-card`, `.aw-heading` | `background: var(--color-cream); color: var(--color-text-pixel);` / `color: var(--color-text-pixel);` |
| 604–608 | `.aw-card [data-variant="filled"]` | `background: var(--color-pixel-primary); color: var(--color-on-action); box-shadow: var(--shadow-pixel);` (no `border-radius`: kit `rounded-lg` applies); add `.aw-card [data-variant="filled"]:enabled:hover { background: var(--color-pixel-hover); }` and `.aw-card [data-variant="filled"]:disabled { box-shadow: none; }` (the unlayered override beats the layered kit hover/disabled utilities, so both states are restated here) |
| 611–622 | `.aw-world`, `.aw-world-center` | unchanged |
| 628–635 | `.aw-card-avatar` | `background: var(--color-tile); border: 1px solid var(--color-divider);` |
| 645–651 | `.aw-room` | `background: linear-gradient(to bottom, var(--color-divider) 0 64px, var(--color-tile) 64px); outline: 1px solid var(--color-divider);` (was `box-shadow: 0 0 0 1px …`) |
| 652–662 | `.aw-room::after` (+ dark opacity) | `background: var(--color-cream);` (dark `opacity: 0.35` rule unchanged) |
| 671–686 | `.aw-room-label` | `padding: var(--space-1) var(--space-2); font-size: var(--text-caption); line-height: var(--text-caption--line-height); font-weight: 600; color: var(--color-text-pixel); background: var(--color-tile); border: 1px solid var(--color-divider);` |
| 687–698 | `.aw-note` | `padding: var(--space-2) var(--space-3); font-size: var(--text-label); line-height: var(--text-label--line-height); font-weight: 400; color: var(--color-text-pixel); background: var(--color-tile); border: 1px solid var(--color-divider); box-shadow: var(--shadow-pixel);` (Q-S6-6) |
| 712–723, 767–780 | `.aw-world-gap::before`, `.aw-world-path` | `var(--aw-bg)` → `var(--color-cream)`, `var(--aw-line)` → `var(--color-divider)` (geometry unchanged) |
| 738–747 | `.aw-world` (≥ 1280) | `column-gap: var(--space-6);` |

Not touched in globals.css: lines 1–369 (compat aliases, `@theme inline`, base, utilities, focus, reduced motion:
slices 3–5 and 7), `.i` (254), the `.aw-*` display/position rules not listed above.

### Files (slice 6a)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, `src/app/globals.css`, `src/lib/**` tests and
`scripts/check-tokens.pending.json` are not listed). "→" = replace the whole class string unless "add"/"drop"/"keep"
says otherwise; the implementer re-reads each file first.

**Auth**

| File | Change | Pending |
|---|---|---|
| `src/app/globals.css` | per "globals.css (6a) — rule by rule" | 65 → 32 |
| `src/ui/auth/AuthLayout.tsx` | frame (26) `max-w-[400px]` → `max-w-100`; card titles h2 (37) and h1 (41) `font-heading aw-heading text-xl font-bold` → `aw-heading text-subtitle`; row (70) `max-w-[816px]` → `max-w-204`, `gap-10` → `gap-8` (R-d). Everything else unchanged (`aw-*` class names, `Card` overrides, structure) | 3 → 0 (remove) |
| `src/ui/auth/DevGate.tsx` | `ProdNotice` (59) → `fixed inset-x-0 top-0 z-50 border-b border-danger bg-danger-tint px-3 py-2 text-center text-caption font-semibold uppercase tracking-wide text-danger` (same tones as the shell prod badge, `AppShellView.tsx:146–148`; Q-S6-10) | 1 → 0 (remove) |
| `src/ui/auth/account-views.tsx` | Turnstile slots (121, 190) `min-h-[65px]` → `min-h-16.25` (65 px exact, Q-S6-8); body lines (174, 331) `text-sm` → `text-label font-normal` | 2 → 0 (remove) |
| `src/ui/auth/views.tsx` | other-account line (107) `text-center text-label font-normal text-text-secondary`; Turnstile slot (138) `min-h-16.25`; body (181) `text-label font-normal`; no-org how-to (253) `text-label font-normal text-text-secondary` | 1 → 0 (remove) |
| `src/ui/auth/accept-views.tsx` | sign-in hint (63) `text-label font-normal`; new-account hint (70) `text-label font-normal text-text-secondary` | not pending |

**Check-in**

| File | Change | Pending |
|---|---|---|
| `src/ui/checkin/CheckinPopup.tsx` | dialog (67) `px-frame m-auto w-[min(--spacing(128),calc(100vw-var(--space-6)))] max-h-[90dvh] overflow-hidden p-0 bg-surface text-text-primary` (same 32rem / 100vw − 1.5rem; `--spacing()` as R-c); title bar (70) `flex-none border-b-4 border-pixel-primary bg-tile px-4 py-3 text-text-pixel`; title h2 (74) `text-label font-semibold uppercase tracking-wide`; body wrapper (79) drop `px-card` → `flex min-h-0 flex-1 flex-col`; intro (81) `text-label font-normal text-text-secondary`; legend (85) `mb-2 text-label font-semibold text-text-primary`; room label (94–98) `flex min-h-control cursor-pointer items-center gap-3 bg-surface p-2` + `border-3 border-pixel-primary` (selected) / `border-3 border-transparent`; radio (106) `size-5 flex-none accent-pixel-primary`; text column (109, 144) `flex min-w-0 flex-1 flex-col text-label font-normal`; room names (110, 145) `font-semibold text-text-primary`; meta lines (114, 117, 118, 148) `text-text-secondary`; locked h3 (134) `mb-2 text-label font-semibold text-text-primary`; locked `<li>` (141) drop `opacity-90`, `min-h-11` → `min-h-control`; Request-a-seat link (150) standalone link + `self-start`; footer (162) `flex-none border-t-4 border-pixel-primary p-4`; error (164) `mb-3 text-label font-semibold text-danger`; primary Button (169–177) `variant="pixel"`, `className="w-full sm:w-auto"`; Just look (178–184) `variant="tonal"`, `className="w-full sm:w-auto"` (drop `min-h-11 rounded-none border-[3px] border-px-outline shadow-[…]`). Props, handlers, ids, `aria-*`, `onCancel`, focus return unchanged | 7 → 0 (remove) |
| `src/ui/checkin/CheckinButton.tsx` | wrapper (23) drop `px-card` → `pointer-events-auto flex flex-col items-end gap-2`; error (25) `text-label font-semibold text-danger`; Button (29) `variant="pixel"` | not pending |
| `src/ui/checkin/CheckinView.tsx` | slot (19) `bottom-[calc(68px+env(safe-area-inset-bottom)+1rem)]` → `bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))]` (tab bar is 64 + 1 px since slice 4, +16 px gap; Q-S6-13); error (50) `text-label font-semibold text-danger`; no-seat title (61) `text-body font-semibold text-text-primary`; link (62) standalone link; room h2 (70) and Who's-here h2 (75) `text-subtitle text-text-primary`; grid (71) `grid gap-4 lg:grid-cols-[minmax(0,1fr)_--spacing(75)]` (300 px unchanged, R-c; Q-S6-12); placeholder (79) `mt-2 text-label font-normal text-text-secondary`; h1 (91) `text-display text-text-primary` | 2 → 0 (remove) |
| `src/ui/checkin/CheckinPage.tsx` | move error (212) `text-label font-semibold text-danger`; Open-in-room link (271) standalone link | not pending |
| `src/ui/checkin/WhosHere.tsx` | loading (25) `mt-2 text-label font-normal text-text-secondary`; error (33) `text-label font-semibold text-danger`; stale (45) `text-label font-semibold text-text-secondary`; empty (50) `text-label font-normal text-text-secondary`; row button (62) → `flex min-h-control w-full items-center gap-3 rounded-lg px-2 text-left enabled:cursor-pointer enabled:hover:bg-canvas disabled:cursor-not-allowed` + the `TRANSITION` string of `src/ui/Button.tsx:8–9` (drops `focus-visible:ring-*`: the global ring applies; drops `disabled:opacity-70`: R-e, the row keeps its "not on map" text; Q-S6-11); name (66) `truncate text-label font-semibold text-text-primary`; meta (67) `text-caption text-text-secondary` | not pending |
| `src/ui/checkin/PixelHead.tsx` | head background (34) `bg-surface-container-high` → `bg-tile` (R-i) | not pending |

**Pending, tests, log**

| File | Change |
|---|---|
| `scripts/check-tokens.pending.json` | delete the 6 6a keys; `src/app/globals.css` 65 → 32; nothing else changes (142 → 93, 22 → 16 keys) |
| `src/ui/auth/world-palette.test.ts` | **delete** (its `--aw-*` tokens no longer exist; its checks move to `tokens.test.ts`, below) |
| `src/lib/color/tokens.test.ts` | extend (Tests) |
| `src/ui/screen-tokens.test.ts` | extend (Tests) |
| `src/ui/checkin/CheckinPopup.test.tsx`, `CheckinButton.test.tsx`, `CheckinView.test.tsx`, `WhosHere.test.tsx`, `src/ui/auth/views.test.tsx`, `account-views.test.tsx` | update/extend (Tests) |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 6a": files, R-i map, globals rule list, pending before/after (65 → 32, 142 → 93), visible differences, checks |

Not touched (read; no class strings, only `aw-*`/`px-scene` class names whose CSS changes, or out of 6a):
`SignInScene.tsx`, `SmallWorld.tsx` (class names unchanged; `SmallWorld.test.tsx` and `org-views.test.tsx` stay green
unchanged because they assert class names and the `display` rules, not colours), `fields.tsx` (slice 3), every auth
page wrapper (`SignInRoute`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`,
`AcceptInvitationPage`, `AuthGate`, `TurnstileWidget`, `api-fetch-context`), `checkin/RoomThumb.tsx` (pixel mini-map: art
fills and frame on `--px-*`; Q-S6-14), `checkin/HomePage.tsx`, `src/ui/org/**` (render inside `AuthLayout`, change
through CSS only), `src/ui/Button.tsx` (the `pixel` variant exists since slice 3), `src/styles/tokens.css` (no new
token), `src/app/layout.tsx` (Fraunces already loaded as `--font-serif`), `src/ui/copy/**`, `src/lib/**` except the
test, `scripts/check-tokens.mjs`, every 6b/6c file.

### Approach (slice 6a)
1. globals.css per the rule table (delete `--aw-*`, re-point `.aw-*`, delete `.px-card`/`.px-strip`/`.px-title`,
   re-point `.px-frame`). After it, `rg -n -- "--aw-|#[0-9a-fA-F]{3,8}\b|rgba?\(" src/app/globals.css` lists only the
   slice-7 lines (`--px-*`, compat `rgba()`), and `node scripts/check-tokens.mjs --list` reports `globals.css: 32`.
2. Auth screens (AuthLayout, DevGate, account-views, views, accept-views).
3. Check-in (CheckinPopup, CheckinButton, CheckinView, CheckinPage, WhosHere, PixelHead). After each screen file:
   `rg -n "on-surface|outline-variant|text-error|text-primary\b|text-\[|tracking-\[|border-\[|shadow-\[|text-(xs|sm|base|lg|xl|2xl)\b|font-(bold|extrabold|heading)|min-h-11|opacity-|focus(-within|-visible)?:|px-(card|outline|wall)|surface-(high|container)|accent-primary|rounded-none" <file>`
   → no hits (`text-primary\b` also matches inside `text-text-primary`; read those hits, only the bare class is wrong).
4. Confirm `pnpm build` output: `bottom-[calc(--spacing(20)+…)]`, `w-[min(--spacing(128),…)]`,
   `lg:grid-cols-[minmax(0,1fr)_--spacing(75)]`, `min-h-16.25` and `border-3` compile to 80 px / 32rem / 300 px / 65 px /
   3 px (grep the built CSS once, note in impl-log). Fallbacks if 4.3.x rejects one: `bottom-20` +
   `pb-[env(safe-area-inset-bottom)]` on the slot; `w-full max-w-128`; `min-h-16`; `border-2`; record which.
5. Delete `world-palette.test.ts`; extend `tokens.test.ts`, `screen-tokens.test.ts` and the screen tests.
6. Pending: `node scripts/check-tokens.mjs --list`; the 6 files report 0, `globals.css` 32, every other count
   unchanged; delete the 6 keys, set `globals.css` to 32 (sorted order kept); `node scripts/check-tokens.mjs` exits 0.
7. impl-log "Slice 6a", checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (no new imports; `Button` is already imported where used), R3 none, R4 (Files tables only), R5 (tests
below). R2/R6/R7 not touched.

### Tests to write / update (slice 6a)
| Test (file › name) | Covers |
|---|---|
| `tokens.test.ts` › `TEXT_PAIRS` gains `text-primary`/`text-secondary` on `cream` and `text-secondary` on `tile` (sign-in text, eyebrow, header/footer, notes); `NON_TEXT_PAIRS` gains `pixel-primary` on `cream`, `tile` and `surface` (frame lines, strip mark, check-in frame and selected row; ≥ 3) — both themes via the existing `describe.each` | AC 6 on the new tokens (light ≈ 5.8 / 5.6 / 6.5; dark ≈ 3.8 / 3.2 / 3.4) |
| tokens.test › new `LARGE_TEXT_PAIRS` `[["pixel-primary", "cream"]]` asserted ≥ 3 with the comment "serif part of the sign-in headline, Display/Hero ≥ 24 px (WCAG large text)" | replaces world-palette `--aw-serif-ink` 4.5 check (Q-S6-4) |
| tokens.test › describe "auth world and pixel chrome (replaces world-palette.test.ts)": (1) `globalsCss` contains no `--aw-`; (2) `aw` = `globalsCss.slice(globalsCss.indexOf(".aw-stage"))`: no hex, no `rgb(`/`rgba(`, no `animation`/`transition`/`@keyframes`, and every `var(--x)` in it matches `/^--(color\|text\|space\|radius\|shadow)-\|^--font-serif$/`; (3) `.aw-stage {` occurs once and `.aw-world {` comes after it; (4) `.aw-stage` and `.aw-card` rules set `background: var(--color-cream)`, `.aw-strip` `var(--color-tile)`; (5) `.aw-headline` rule has `var(--text-display)` and a `@media (width >= 1024px)` block with `var(--text-hero)`; (6) `.aw-serif` has `font-family: var(--font-serif)` and `color: var(--color-pixel-primary)`; (7) `.aw-card [data-variant="filled"]` has `var(--color-pixel-primary)` and `box-shadow: var(--shadow-pixel)`, its `:enabled:hover` rule `var(--color-pixel-hover)`, its `:disabled` rule `box-shadow: none`; (8) `.px-frame` has `var(--color-pixel-primary)` and `box-shadow: var(--shadow-pixel)`; (9) no `.px-card`, `.px-strip`, `.px-title` selector | AA source of truth moves to tokens; D85 Fraunces; Q10; reduced motion (AC 4) |
| `screen-tokens.test.ts` › `MIGRATED` gains 14 files: `ui/auth/{AuthLayout,DevGate,accept-views,account-views,views,fields,SignInScene,SmallWorld}.tsx`, `ui/checkin/{CheckinButton,CheckinPopup,CheckinView,CheckinPage,WhosHere,PixelHead}.tsx`; the existing legacy / raw-type / low-target / palette / `opacity-60` / focus and "not pending" tests then cover them | R-a…R-c, R-h |
| screen-tokens › "kit Button only" list gains `ui/checkin/{CheckinPopup,CheckinButton,CheckinView}.tsx` | R-f |
| screen-tokens › new "pixel chrome": the four check-in screen files (`CheckinPopup`, `CheckinButton`, `CheckinView`, `WhosHere`) match none of `/px-(card\|outline\|wall\|floor\|accent)\|--px-\|rounded-none\|border-\[\|opacity-\d/`; `CheckinPopup.tsx` and `CheckinButton.tsx` contain `variant="pixel"` and no `variant="filled"` | R-i, Q4, R-e |
| `CheckinPopup.test.tsx` › 44–55: title bar regex → `/class="[^"]*bg-tile[^"]*text-text-pixel[^"]*"><h2/` (test name updated to match), `px-frame` kept; 89–91: `'data-variant="pixel"'` present and no `px-card` (name updated); 102–108: width string → `w-[min(--spacing(128),calc(100vw-var(--space-6)))]`, `min-h-11` → `min-h-control`; new: selected label has `border-pixel-primary`, the other `border-transparent`, radios `size-5`, Just look `data-variant="tonal"` without `rounded-none`/`shadow-[`, markup has no `opacity-90`, `text-[`, `tracking-[`, `border-[` | R-i, R-f, R-e |
| `CheckinButton.test.tsx` › 12–20: `data-variant="pixel"`, no `px-card` (name updated); retry error has `text-danger` and `text-label` | Q4 |
| `CheckinView.test.tsx` › 23: `lg:grid-cols-[minmax(0,1fr)_--spacing(75)]`; new "tokens": h1 `text-display`, room `<h2` `text-subtitle`, no-seat link (`<a [^>]*href="/rooms"`) contains `min-h-control`, slot tag contains `bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))]`; no `text-[`, `font-extrabold` | R-b, R-f, Q-S6-13 |
| `WhosHere.test.tsx` › extend 33–50: each row `<button` has `min-h-control` and no `focus-visible:`; the disabled row has no `opacity-` and still shows the not-on-map hint (existing 45–50); name span `font-semibold` | R-f, R-e |
| `views.test.tsx` › new in "frame": `AuthLayout` frame has `max-w-100`, card `<h1` has `text-subtitle` and no `font-bold`/`text-xl`; Turnstile slot (`turnstileRequired`, existing variant at 243) is `min-h-16.25`; no `min-h-[` or `text-sm` in the plain sign-in markup. Existing 170–313 unchanged and green | R-b, R-c, Q-S6-8 |
| `account-views.test.tsx` › sign-up / forgot with a Turnstile slot: slot `<div` has `min-h-16.25` | Q-S6-8 |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with 6 keys removed and `globals.css` 32 | pending only shrinks |

### Acceptance → verification (slice 6a)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S6a-1 | Auth and check-in screens use token utilities only (R-a/R-b/R-c/R-i) | `screen-tokens.test.ts` green with the 14 files; `rg -n "on-surface\|outline-variant\|text-error\|text-\[\|tracking-\[\|border-\[\|shadow-\[\|font-(bold\|extrabold\|heading)\|min-h-\[\|max-w-\[\|px-(card\|outline\|wall)\|surface-(high\|container)\|red-[0-9]" src/ui/auth src/ui/checkin -g '*.tsx' -g '!*.test.tsx' -g '!RoomThumb.tsx'` → no hits |
| S6a-2 | No off-scale type: h1 Display, section titles Subtitle, labels 14, metadata 12; sign-in headline Display below 1024 and Hero from 1024 (Q8, Q10, Q16) | `rg -n "text-(xs\|sm\|base\|lg\|xl\|2xl)\b" <same paths>` → no hits; tokens.test `.aw-headline`; CheckinView/views token tests |
| S6a-3 | Targets ≥ 44 px: popup room rows and locked rows, Request-a-seat / Open-in-room / no-seat links, Who's here rows, all buttons (AC 3) | CheckinPopup, CheckinView, WhosHere tests; `rg -n "min-h-11" src/ui/checkin` → no hits |
| S6a-4 | Pixel green on pixel scope (Q4): check-in primary actions are kit `pixel`; every `AuthLayout` filled button is pixel-primary with pixel-hover and `--shadow-pixel` via `.aw-card`; check-in radios and frame pixel green | screen-tokens "pixel chrome"; tokens.test (7), (8); CheckinButton/CheckinPopup tests; `views.test.tsx:309–313` unchanged and green |
| S6a-5 | globals.css: no `--aw-*`; `.aw-*` read only tokens with on-scale spacing; `.px-card`/`.px-strip`/`.px-title` gone; `.px-frame` re-pointed; Fraunces kept on `.aw-serif`; slice-7 entries untouched | tokens.test "auth world and pixel chrome"; `git diff main -- src/app/globals.css` touches only lines 375–441 and 465–784 |
| S6a-6 | AA in both themes on the new pairs; `world-palette.test.ts` replaced, not just deleted (AC 6) | tokens.test pairs (light and dark); `git diff --stat main` shows `world-palette.test.ts` deleted in the same PR that adds the tokens.test describe |
| S6a-7 | Every state has text; no opacity dimming of text rows (R-e): locked rooms, disabled Who's here rows | CheckinPopup and WhosHere tests; `rg -n "opacity-" src/ui/checkin -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S6a-8 | Reduced motion: the auth world CSS has no animation or transition (AC 4) | tokens.test (2) |
| S6a-9 | Pending shrinks by exactly the 6 keys and `globals.css` 65 → 32 (142 → 93, 22 → 16 keys) | `git diff main -- scripts/check-tokens.pending.json`; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S6a-10 | No behaviour, copy, prop, id, `data-*` or `aria-*` change (`data-slot="checkin-button"`, `aria-busy`, `aria-labelledby/-describedby`, dialog `onCancel`, focus return, `aria-hidden` decorations) | existing tests unchanged except the listed asserts; `git diff main -- src/ui/copy src/lib src/app/layout.tsx` empty except `src/lib/color/tokens.test.ts` |
| S6a-11 | Only planned files | `git diff --stat main` ⊆ Files tables |
| S6a-12 | Checks green; impl-log "Slice 6a" complete (R-i map, globals list, pending, visible differences, build-output check of step 4) | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 6a)
- Every sign-in style screen (sign-in landing and plain, sign-up, forgot/reset password, verify email, accept
  invitation, org picker, first-visit profile, dev-token screens): background `#F3EFE4` → cream `#F5F3E9`; text
  `#26291F` → `#354235`; muted text `#585C4E` → `#475569` (14 px, was 13 in header/footer); strip `#E6ECDD` → tile
  `#F0F2E9`; lines `#D9D3C3` → divider `#E8ECE0` (lighter). Dark keeps the cream `#15170F` background; text and lines
  follow the dark tokens.
- Sign-in buttons: green `#3D5A35`, 6 px corners, no hover change → pixel green `#4D6540`, 8 px, 4 px dark-green ledge,
  hover `#3E5532`. Dark: light green `#A7C99B` with dark text → `#5E7A4E` with white text.
- Headline: fluid 30–48 px · 800 → 32 px · 600 below 1024 px, 46 px · 500 from 1024 px; the italic Fraunces part
  `#4F6B45` → `#4D6540` (dark `#B7D3AA` → `#5E7A4E`, darker).
- Wordmark 800 → 600; card title 20 px · 700 → 18 px · 600; eyebrow, strip title and room labels 700 → 600; card
  frame corners 10 → 12 px, the 8 px line-colour ledge → the soft card shadow; scene–card gap 40 → 32 px; header and
  footer 2 px taller (padding 14 → 16 px); room labels 2 px taller; world notes get a 4 px dark-green ledge (was 3 px
  line colour).
- Dev "Production data" notice: solid red with white text → red tint, red text and border (as the shell badge).
- Check-in popup: stepped grey-blue frame with a drop shadow → 4 px pixel-green border with the pixel ledge; title bar
  wall grey → tile with dark-green text, 14 px · 600 (was 14 · 800); selected room outline grey-blue → green; radios
  16 → 20 px and green; "Check in to …" orange square uppercase → pixel-green kit button (8 px, no uppercase transform;
  copy unchanged); "Just look" square with ledge → kit secondary button; locked rooms no longer at 90 % opacity;
  "Request a seat" link 44 px tall.
- Floating Check in / Check out button: orange square uppercase → pixel-green kit button; its error 12 → 14 px; on
  phones it sits 4 px lower (80 px above the bottom instead of 84; the tab bar is 65 px since slice 4).
- Check-in page: title 20 px · 800 → 32 px · 600; room and Who's here headings 16 px · 700 → 18 px · 600; no-seat
  title 600; Request-a-seat and Open-in-room links 44 px. Who's here rows: hover background canvas, 8 px corners,
  names 700 → 600, rows not on the map no longer faded (the "not on map" text stays); head background tile.

### Ming verification after merge (slice 6a)
- `/sign-in` at 390 / 800 / 1024 / 1280 px, light and dark: headline size switches at 1024, the small world appears at
  1280, the Sign in button is pixel green with a visible hover and a green focus ring; the italic headline word is
  readable in dark mode (Q-S6-4). Also sign-up and forgot password (no jump when the Turnstile box loads), an accept
  invitation link, the org picker.
- Check-in as a user with seats in two rooms: open the popup, Tab through the room radios and buttons, check in, check
  out, hover a Who's here row; at 390 px the floating button clears the tab bar; dark mode popup frame.

### Slice 6b outline — Portal (addendum before it starts)
- Files: `src/ui/portal/{PortalPage,PortalTabs,MySeatTab,MySeatView,SeatCard,MyRequestsPanel,MyRequestRow,MyDevicesTab,
  MyDevicesView,MyDevicesTiles,MyDevicesTable,ProfileTab,ProfileTabView,PersonalInfoCard,MembershipCard,
  ProfilePhotoSection,ProfilePhoto,PixelLookPicker,LookStage,LookPreview}.tsx` (only those with class strings), their
  tests, `MIGRATED`, pending (5 keys, 10 → 0; 93 → 83), impl-log. Rules R-a…R-i unchanged. `photo-canvas.ts`
  (allowlisted canvas colours) untouched.
- Known items: `PortalPage` h1 `text-h2 font-extrabold` → `text-display`; `MyDevicesTable` adopts `TABLE_*` (R-g, as
  planned in 5a) and `min-w-[960px]` → `min-w-240` (test at `MyDevicesTable.test.tsx:86`), filter select → 44 px
  `rounded-lg border-border-strong`, search `h-10!` override dropped; `MyDevicesTiles` value `text-title`;
  `MembershipCard` badge `bg-primary-container` → `bg-workspace-action text-on-action`; `SeatCard` icon tile
  `bg-accent-orange-soft text-accent-orange` → `bg-canvas text-workspace-primary`, `min-h-11` dropped;
  `MyRequestRow` icon tones → tint tokens (status Pill already per slice 3); `PersonalInfoCard` labels as the auth
  `Field` (`text-label text-text-primary`); `ProfilePhotoSection` file-input label keeps `<label>` (a file input cannot
  be a kit Button) with kit outlined classes, 44 px, ring via `.field-box`; Remove → kit `Button variant="text"`.
- Pixel green (Q4) only in `PixelLookPicker`: selected option `border-pixel-primary` + check icon
  `text-pixel-primary`, swatch/option targets 44 px; `LookStage`/`LookPreview`/`PixelLookPicker` sprite backgrounds
  `bg-tile`. Everything else in the portal is coral/ink (workspace).
- Expected ≈ 350 changed lines.

### Slice 6c outline — Room map, layout editor chrome and Map items (addendum before it starts)
- Files: `src/ui/roomlayout/{RoomMap,RoomMapSection,SeatOverlay,ZoomControl,GestureOverlay,LayoutEditor,
  LayoutEditorPage,EditorToolbar,EditorInspector,EditorViews,EditorWarnings,EditorCanvas,ShortcutList,Palette}.tsx`
  (chrome classes only; `paint.ts`, `WalkLayer.tsx` canvas and `src/lib/sprites/**` untouched) and
  `src/ui/mapItems/{MapItemsPage,MapItemsView,MapItemCard,MapItemEditor,MapItemEditorAppearance,MapItemEditorDetails,
  SpriteBrowser,FramePreview}.tsx`, their tests, `MIGRATED`, pending (10 keys, 51 → 0; 83 → 32), impl-log.
- Known items: chip-like toggles (`EditorViews` `BTN`, `RoomMapSection:84`) → kit `Button variant="outlined"
  size="sm"`; option lists (`EditorInspector:130,152`, `Palette:55`) → 44 px rows, `text-label`, pressed state
  `aria-pressed:bg-tile aria-pressed:font-semibold` (Palette pixel green indicator, Inspector ink); `LayoutEditor:193`
  `18rem` → `--spacing(72)`; `ZoomControl` 44 px; `SeatOverlay` tooltips `bg-[rgba(22,27,37,.92)] text-white` →
  `bg-text-primary text-surface` (AA pair already tested), `px-2.5`/`gap-1.5` snapped; the on-map count button
  (`SeatOverlay:204`, `min-h-6`) needs a decision on target size vs map density (6c addendum, Q); room backdrops use
  `--color-room-floor`/`--color-room-green` where chrome paints them in CSS (canvas paint stays as is).
- Map items (Q4 pixel green): library and editor primary actions `variant="pixel"`; `MapItemEditor:332` dialog → kit
  dialog (`rounded-2xl shadow-dialog bg-surface max-w-145`); `MapItemEditorDetails` `CAPTION` → the 5b form caption;
  sprite previews (`SpriteBrowser`, `FramePreview`, `MapItemCard`) `bg-tile`; library page already `page-library`
  (slice 4).
- Expected ≈ 450 changed lines; if over ~600, roomlayout and mapItems become 6c and 6d.

### Assumptions and non-blocking questions (slice 6)
- Hotspots: no other ticket is IN_PROGRESS/REVIEW/DONE (`work/backlog.md`: only SIM-071). `scripts/check-tokens.pending.json`,
  `screen-tokens.test.ts` and `tokens.test.ts` change again in 6b/6c/7; sub-slices merge in order. SIM-070 (Map items)
  is merged, so the 6c files are re-read on the then-current `main`.
- Approved defaults used: Q1, Q2, Q4 (pixel scope), Q5 (dark palette, incl. cream `#15170F`, tile `#23271C`,
  pixel-primary `#5E7A4E`), Q7, Q8, Q10 (Hero from `lg`, Display below), Q15, Q16.
- Q-S6-1 (non-blocking). **Default: three PRs 6a/6b/6c** (auth + check-in + globals; portal; roomlayout + mapItems).
  Alternative: the suggested 6a (with portal, ≈ 800 lines) and 6b.
- Q-S6-2 (non-blocking). Check-in buttons: **default: callers use kit `variant="pixel"` and the `.px-card` CSS
  override (orange, square, uppercase) is deleted** (the variant was added in slice 3 for this; two call sites).
  Alternative: keep `variant="filled"` and re-point the `.px-card` override.
- Q-S6-3 (non-blocking). Sign-in buttons: **default: re-point the `.aw-card [data-variant="filled"]` override** (one CSS
  rule covers about 12 filled buttons on every `AuthLayout` screen, including `org/ProfileView`; `views.test.tsx:309`
  stays). Alternative: `variant="pixel"` at every call site.
- Q-S6-4 (non-blocking). The italic headline word: pixel-primary on cream is 5.8:1 light but 3.8:1 dark, which passes
  only as large text (it is Display 32 / Hero 46 px). **Default: `--color-pixel-primary`, asserted ≥ 3 as large text.**
  Alternative: `--color-text-pixel` (≥ 4.5 in both themes, but the word is no longer green).
- Q-S6-5 (non-blocking). `.px-strip` and `.px-title` have no users (`rg` outside CSS: only absence asserts in tests).
  **Default: delete them** instead of re-pointing. `.px-stage`, `.px-heading` (also unused) and `.px-scene` (art frame of
  the sign-in vignette on the `--px-*` art palette; 1 violation) stay for slice 7, which moves `--px-*` into tokens.css.
- Q-S6-6 (non-blocking). **Default: `.aw-frame` uses `--shadow-card` (brief cards); the world notes use `--shadow-pixel`;
  the `.aw-room` 1 px ring becomes an `outline`.** Alternative: `--shadow-pixel` on the frame too (a 4 px dark-green
  ledge under the whole card).
- Q-S6-7 (non-blocking). `.aw-frame` 10 px corners: **default `--radius-xl` 12 px** (brief cards) rather than R-c's
  nearest step (`lg`, 8 px).
- Q-S6-8 (non-blocking). Turnstile slots: **default `min-h-16.25` (65 px, the widget height, no layout shift)**.
  Alternative: `min-h-16` (64 px, 1 px shift when the widget loads).
- Q-S6-9 (non-blocking). **Default: the check-in popup keeps a square pixel frame (4 px pixel-green border +
  `--shadow-pixel`) and 3 px selected-row outline**, not the kit dialog's 16 px corners and dialog shadow (D52 pixel
  style on end-user surfaces). Alternative: kit dialog look.
- Q-S6-10 (non-blocking). Dev "Production data" notice: white on dark-theme danger `#F08A84` is ≈ 2.4:1. **Default:
  danger tint, danger text and border** (as the shell badge). Alternative: solid `bg-danger text-on-action` (fails AA
  in dark).
- Q-S6-11 (non-blocking). Who's here rows stay a hand-built `<button>` (avatar + two text lines; the kit Button is one
  line, `whitespace-nowrap`). **Default: token classes, 44 px, global focus ring, no opacity on disabled rows.**
- Q-S6-12 (non-blocking). Check-in side column (slice-4 follow-up, "if Ming confirms", not confirmed): **default keep
  the two-column layout from `lg` (1024) with the 300 px column**. Alternative: from `xl` (1280).
- Q-S6-13 (non-blocking). Floating check-in button offset: the old 68 px matched the pre-slice-4 tab bar. **Default:
  80 px + safe area (65 px bar + 15 px gap).**
- Q-S6-14 (non-blocking). `RoomThumb` (64×40 pixel mini-map in the popup) is art: fills and its 2 px frame use the
  `--px-*` palette. **Default: untouched; slice 7 moves `--px-*` into tokens.css.**
- Q-S6-15 (non-blocking). Sign-in header tagline and footer lines 13 px: **default 14 px (`--text-label`, like the 13 px
  hints in 5c)**. Alternative: 12 px caption.
- Q-S6-16 (non-blocking). **Default: the sign-in logo tile stays coral (`--color-workspace-primary`, the shell logo)**,
  not pixel green.

Status: READY

## Slice 6b addendum — Portal
Status: READY. Written against `main` after #165 (slices 1–5c and 6a merged), the "Slice 6b outline — Portal" above and
Ming's approval of the plan and split with all defaults. Applies R-a…R-h ("Slice 5 addendum"), "Rules for every
slice-5 file" and R-i ("Slice 6 addendum") **unchanged**; the shared values are the 5b/5c/6a strings. No new decisions;
open points are non-blocking Q-S6b-n at the end, each with a default. Pixel green (Q4) only in the character picker
(`PixelLookPicker`, `LookStage`, `LookPreview`); everything else in the portal is workspace (coral/ink). Not touched:
`photo-canvas.ts` (allowlisted canvas colours), every `*.ts` in `src/ui/portal/`, `useOwnPhoto.tsx`, kit components
(`TabBar`, `SectionCard`, `PageHeader`, `FilledInput`, `FormFooterBar`, `Avatar`, `RoleBadge`, `Chip`, `Button`),
`src/ui/devices/**` (`DeviceNameLink`, `DeviceRowActions` etc. are 5b), `src/app/**`, `src/app/globals.css`,
`src/styles/tokens.css`, `src/ui/copy/**`, `scripts/check-tokens.mjs`, every 6c file.

### Size
16 screen files ≈ 190 changed lines (≈ 93 legacy lines, table below), `screen-tokens.test.ts` ≈ 35, 6 portal test
files ≈ 70, the 6a `CheckinPopup.test.tsx` nit 3, pending 5, impl-log ≈ 40: **≈ 345 changed lines** (outline ≈ 350).

### Pending list (R-h): 5 keys, 10 violations → 0 (93 → 83, 16 → 11 keys)
Counts read from `scripts/check-tokens.pending.json` on `main` after #165 (16 keys / 93).

| Key | Count | Cause (all removed by the Files table) |
|---|---|---|
| `src/ui/portal/MyDevicesTable.tsx` | 3 | `HEAD` `text-[11px]` (22: `text-arb` + `arbitrary-px`), `min-w-[960px]` (129) |
| `src/ui/portal/PixelLookPicker.tsx` | 3 | `gap-1.5` (48; 50 ×2) |
| `src/ui/portal/ProfilePhotoSection.tsx` | 2 | `BTN` `gap-1.5` (7), Remove `py-1.5` (65) |
| `src/ui/portal/ProfileTabView.tsx` | 1 | `gap-1.5` (35) |
| `src/ui/portal/SeatCard.tsx` | 1 | `gap-1.5` (53) |

All 5 keys are deleted; every other key keeps its count (`globals.css` 32, the 10 slice-6c keys 51).

### Legacy lines outside the guard (non-test `.tsx` in `src/ui/portal/`), before → after
"Legacy" = a line with an R-a alias, R-b raw size / 700–800 weight, R-c arbitrary value, a `LOW_TARGET` class, an
`opacity-60` or a hard-coded focus colour. Measured with `rg` on `main` after #165; every count goes to 0.

| File | Before | Lines |
|---|---|---|
| `PixelLookPicker.tsx` | 13 | 19, 22, 48, 49, 50, 77, 82, 89, 96, 113, 117, 139, 141 |
| `MyDevicesTable.tsx` | 12 | 21, 22, 89, 98, 110, 116, 129, 132, 147, 150, 176, 179 (+ the 9 `CELL` references renamed) |
| `SeatCard.tsx` | 11 | 26, 30, 31, 38, 40, 41, 44, 45, 49, 53, 65 |
| `MyRequestRow.tsx` | 9 | 11–14, 40, 41, 47, 53, 68 |
| `PersonalInfoCard.tsx` | 7 | 10, 41, 60, 64, 68, 73, 88 |
| `MyDevicesTiles.tsx` | 6 | 9, 10, 27, 31, 32, 53 |
| `MySeatView.tsx` | 6 | 45, 49, 63, 92, 99, 100 |
| `ProfilePhotoSection.tsx` | 6 | 7, 61–68 (hand-built `<button>`), 71, 74, 76, 81 |
| `LookStage.tsx` | 5 | 35, 40 (`var(--color-outline-variant)` in `style`), 45, 56, 70 |
| `MembershipCard.tsx` | 5 | 16, 22, 23, 26, 33 |
| `MyRequestsPanel.tsx` | 5 | 78, 83, 93, 104, 118 |
| `MyDevicesView.tsx` | 4 | 59, 63, 84, 95 |
| `LookPreview.tsx` | 1 | 43 |
| `PortalPage.tsx` | 1 | 27 |
| `ProfileTab.tsx` | 1 | 69 |
| `ProfileTabView.tsx` | 1 | 35 |
| **Total** | **93** | → **0** |

Clean today, no edit, added to `MIGRATED` only: `PortalTabs.tsx` (kit `TabBar`), `MySeatTab.tsx`, `MyDevicesTab.tsx`
(141 is layout only), `ProfilePhoto.tsx`.

### Rename map used in 6b (R-a…R-i; only the rows that occur in the portal)
| Old | New | Rule |
|---|---|---|
| `text-on-surface`, `text-primary` (ink) | `text-text-primary` | R-a |
| `text-on-surface-variant` | `text-text-secondary` | R-a |
| `text-error` | `text-danger` | R-a |
| `bg-success-container text-on-success-container` · `bg-warning-container text-on-warning-container` · `bg-error-container text-on-error-container` | `bg-success-tint text-success` · `bg-warning-tint text-warning` · `bg-danger-tint text-danger` | R-a |
| `bg-surface-high text-on-surface-variant` (neutral icon) | `bg-canvas text-text-secondary` | R-a |
| `bg-secondary-container text-on-secondary-container` | `bg-canvas text-text-primary` | R-a |
| `bg-tertiary-container text-on-tertiary-container` | `bg-info-tint text-info` | R-a |
| `bg-primary-container text-on-primary-container` (static badge/tile; same colours today, `globals.css:31–32`) | `bg-workspace-action text-on-action` | R-a, outline |
| `bg-accent-orange-soft text-accent-orange` (icon tile) | `bg-canvas text-workspace-primary` (non-text, pair tested at `tokens.test.ts:150`) | R-a |
| `bg-surface-container`, `bg-surface-high` (non-sprite) | `bg-canvas` | R-a |
| `bg-surface-container` behind a sprite (LookStage) | `bg-tile` | R-i |
| `border-outline-variant`, `divide-outline-variant`, `var(--color-outline-variant)` | `border-divider`, `divide-divider`, `var(--color-divider)` (same value today, `globals.css:68`) | R-a |
| `border-outline-variant` on a `<select>` | `border-border-strong` | R-a, Q6 |
| `ring-primary`, `text-primary` on picker selection / adornment | `ring-pixel-primary`, `border-pixel-primary`, `text-pixel-primary` | R-i, Q4 |
| `has-[:focus-visible]:outline-primary` | `has-[:focus-visible]:outline-focus` (Q-S6b-3) | Rules (focus colour token) |
| `has-[:disabled]:opacity-60` | `has-[:disabled]:cursor-not-allowed` (drop `cursor-default` and the opacity; Q-S6b-4) | R-e |
| `text-h2 font-extrabold` (page h1) | `text-display` | R-b |
| `text-base font-extrabold` (card title h4) | `text-body font-semibold` | R-b |
| `text-2xl font-extrabold` (metric) | `text-title` | R-b |
| `text-sm` / `text-sm font-medium` / `text-sm font-semibold\|bold\|extrabold` | `text-label font-normal` / `text-label` / `text-label font-semibold` | R-b |
| `text-xs` (+ weight) | `text-caption` (+ `font-semibold` / `font-medium`) | R-b |
| `text-[11px] font-extrabold uppercase` table head | `TABLE_HEAD` | R-b, R-g |
| `font-bold` inside text | `font-semibold` | R-b |
| `min-w-[960px]` | `min-w-240` | R-c |
| `rounded-md3` (12 px, `globals.css:174`) | `rounded-xl` on tiles, `rounded-lg` on the select | R-c |
| `h-11 w-11` / `size-11` on a decorative tile | `size-10` (Q-S6b-1) | R-c, LOW_TARGET |
| `min-h-11` / `min-w-11` on a target; `className="min-h-11"` on a kit Button | `min-h-control` / `min-w-control`; delete | R-f |
| `gap-1.5` | `gap-1` | R-d |
| `py-1.5` (Remove) | gone (kit Button) | R-d, R-f |
| hand-built `<button>` | kit `Button` | R-f |
| `CELL`/`HEAD` constants | `TABLE_CELL`/`TABLE_HEAD`/`TABLE_ROW` from `../table` | R-g |

### Shared values used in 6b (same strings as 5b/5c/6a)
- **Page `<h1>`:** `text-display text-text-primary`.
- **Notices:** error `text-label font-semibold text-danger`; status `text-label font-semibold text-text-primary`; empty
  lines `text-label text-text-secondary` (old `font-medium`) or `text-label font-normal text-text-secondary` (no weight).
- **Small hint / meta (12 px):** `text-caption text-text-secondary`; small error `text-caption text-danger` (+
  `font-medium` where it had it).
- **Form caption** (labels, legends): `text-label text-text-primary` (5b `CAPTION`, kit `FIELD_CAPTION`).
- **Standalone link:** `inline-flex min-h-control items-center … text-label font-semibold text-text-primary
  hover:underline` (5b back link; the portal links had `hover:underline`, kept).
- **File picker label** (5b `DeviceTypeImageField` `BTN`, + `gap-2` for the icon): `field-box inline-flex min-h-control
  cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 text-label text-text-primary
  transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out`.

### Files (slice 6b)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, tests and `scripts/check-tokens.pending.json` are not
listed). Line numbers from `main` after #165; the implementer re-reads each file first. "→" = replace the whole class
string unless "add"/"drop"/"keep" says otherwise. Props, handlers, ids, `aria-*`, `role`, `data-*`, copy unchanged.

**My seat**

| File | Change | Pending |
|---|---|---|
| `src/ui/portal/PortalPage.tsx` | h1 (27) `text-display text-text-primary` | not pending |
| `src/ui/portal/MySeatView.tsx` | error notices (45, 63), status notice (49); no-seat line (92) `text-label font-normal text-text-secondary`; empty (99) `text-label text-text-secondary`; empty link (100) `inline-flex min-h-control items-center text-label font-semibold text-text-primary hover:underline` | not pending |
| `src/ui/portal/SeatCard.tsx` | icon tile (26) `flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-workspace-primary`; code h4 (30) `text-body font-semibold text-text-primary`; room line (31) `flex items-center gap-1 text-label font-normal text-text-secondary`; tags `dl` (38) `mt-4 grid grid-cols-2 gap-4 rounded-xl bg-canvas p-4 text-label font-normal`; `dt` (40, 44) `text-text-secondary`; `dd` (41, 45) `font-semibold text-text-primary`; footer (49) `border-outline-variant` → `border-divider`; View-on-map link (53) `inline-flex min-h-control items-center gap-1 text-label font-semibold text-text-primary hover:underline`; Release (65) drop `className="min-h-11"` | 1 → 0 (remove) |
| `src/ui/portal/MyRequestsPanel.tsx` | skeleton (78) `h-32 animate-pulse rounded-xl bg-canvas`; error (83); empty lines (93, 118) `py-6 text-center text-label text-text-secondary`; list (104) `divide-y divide-divider` | not pending |
| `src/ui/portal/MyRequestRow.tsx` | `ICON_TONES` (11–14) → `success: "bg-success-tint text-success"`, `warning: "bg-warning-tint text-warning"`, `danger: "bg-danger-tint text-danger"`, `neutral: "bg-canvas text-text-secondary"` (the status `Pill` next to it keeps the text label, R-e; `size-9` icon unchanged, not a target); seat line (40) `text-label font-normal text-text-primary`; `strong` (41) `font-semibold`; time lines (47, 53) `text-caption text-text-secondary`; Cancel (68) `className="self-start"` | not pending |

**My devices**

| File | Change | Pending |
|---|---|---|
| `src/ui/portal/MyDevicesView.tsx` | error notices (59, 84), status notice (63); empty (95) `text-label text-text-secondary` | not pending |
| `src/ui/portal/MyDevicesTiles.tsx` | `TONES` (9–10) → `"bg-canvas text-text-primary"`, `"bg-info-tint text-info"`; icon tile (27) `flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`; value (31) `text-title text-text-primary`; label (32) `truncate text-label font-normal text-text-secondary`; total tone (53) `bg-workspace-action text-on-action` | not pending |
| `src/ui/portal/MyDevicesTable.tsx` | delete `CELL`/`HEAD` (21–22), import `TABLE_CELL, TABLE_HEAD, TABLE_ROW` from `../table` (R-g); search (89) `className="w-full sm:w-56"` (drop `h-10!`: kit 44 px); select (98) `min-h-control min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-label font-semibold text-text-primary` (focus: global `select:focus-visible` ring); footer (110) `flex flex-wrap items-center justify-between gap-3 text-caption text-text-secondary`; load-more error (116) `font-semibold text-danger`; table (129) `w-full min-w-240 border-collapse`; head `<tr>` (132) `border-b border-divider` (Q-S6b-6); `<th>` (134, 139) `TABLE_HEAD`; body `<tr>` (147, 176) `TABLE_ROW`; name cell (148) `TABLE_CELL` (drop `font-semibold`: `DeviceNameLink` has it, as 5b `DeviceTable`); type icon (150) `text-text-secondary`; other cells (154–169) `TABLE_CELL` / `` `${TABLE_CELL} font-mono` ``; empty cell (177) `` `${TABLE_CELL} text-center` ``; no-matches (179) `text-text-secondary` | 3 → 0 (remove) |

**Profile and character**

| File | Change | Pending |
|---|---|---|
| `src/ui/portal/ProfileTab.tsx` | error (69) `text-label font-semibold text-danger` | not pending |
| `src/ui/portal/ProfileTabView.tsx` | visibility aside (35) `inline-flex items-center gap-1 text-caption text-text-secondary` | 1 → 0 (remove) |
| `src/ui/portal/PersonalInfoCard.tsx` | `LABEL` (10) `flex items-center gap-1 text-label text-text-primary` (form caption, outline); required mark (41) `text-text-primary`; name error (60) `text-caption text-danger`; hints and counter (64, 68, 88) `text-caption text-text-secondary` (keep `flex-none` on 68); `hr` (73) `border-divider` | not pending |
| `src/ui/portal/MembershipCard.tsx` | badge (16) `flex size-10 flex-none items-center justify-center rounded-xl bg-workspace-action text-on-action text-label font-semibold` (white on workspace-action, AA pair tested); org name (22) `truncate text-label font-semibold text-text-primary`; your-org (23) `text-caption text-text-secondary`; fallback (26) `text-label font-semibold text-text-primary`; managed (33) `text-caption text-text-secondary` | not pending |
| `src/ui/portal/ProfilePhotoSection.tsx` | import `Button` from `../Button`; `BTN` (6–7) → the shared file-picker string (focus ring via `.field-box:focus-within`, `globals.css:344`; replaces `focus-within:ring-*`, `rounded-full`, `font-bold`); Remove (61–68) → `<Button variant="text" size="sm" disabled={busy !== null} onClick={onRemove}>…same label…</Button>` (Q-S6b-2); hint and load-failed (71, 74) `text-caption text-text-secondary`; error (76) `text-caption font-medium text-danger`; notice (81) `text-caption font-medium text-text-primary` | 2 → 0 (remove) |
| `src/ui/portal/PixelLookPicker.tsx` | `swatchClass` (18–19) → `"relative inline-flex min-h-control min-w-control cursor-pointer items-center justify-center rounded-md has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed"`; `cardClass` (21–22) → `"relative flex min-h-control min-w-control cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-divider bg-surface p-2 has-[:checked]:border-pixel-primary has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed"`; fieldset (48) `flex flex-col gap-1`; legend (49) `text-label text-text-primary`; options (50) `grid grid-cols-3 gap-1` / `flex flex-wrap gap-1`; style name (77) `text-label font-normal text-text-primary`; card check (82) `… text-pixel-primary`; swatch chip (89) `block size-8 rounded border border-divider` (inline `background: item.hex` unchanged, user-chosen art colour); swatch check (96) `pointer-events-none absolute text-on-action drop-shadow` (Q-S6b-7); adornment (113) `text-pixel-primary`; tagline, automatic, load-failed (117, 139, 141) `text-caption text-text-secondary` | 3 → 0 (remove) |
| `src/ui/portal/LookStage.tsx` | stage (35) `overflow-hidden rounded-lg border border-divider bg-tile` (R-i sprite preview); dot grid (40) `var(--color-outline-variant)` → `var(--color-divider)` (same value); stage label (45) `text-caption font-semibold uppercase tracking-wide text-text-secondary`; unavailable (56) `text-caption text-text-secondary`; maps caption (70) `border-t border-divider px-3 py-2 text-center text-caption text-text-secondary` | not pending |
| `src/ui/portal/LookPreview.tsx` | loading placeholder (43) `inline-block rounded bg-divider` (skeleton fill, R-a; Q-S6b-5) | not pending |

**Pending, tests, log**

| File | Change |
|---|---|
| `scripts/check-tokens.pending.json` | delete the 5 portal keys (93 → 83, 16 → 11 keys); nothing else changes |
| `src/ui/screen-tokens.test.ts` | extend (Tests) |
| `src/ui/portal/SeatCard.test.tsx`, `MySeatView.test.tsx`, `MyDevicesTable.test.tsx`, `PixelLookPicker.test.tsx`, `ProfilePhotoSection.test.tsx`, `MyRequestRow.test.tsx`, `MyDevicesTiles.test.tsx`, `LookStage.test.tsx` | update/extend (Tests) |
| `src/ui/checkin/CheckinPopup.test.tsx` | 6a review nit (Tests, last row); no behaviour change |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 6b": files, legacy-line and pending before/after (93 → 0 lines; 10 → 0, 93 → 83), visible differences, checks |

### Approach (slice 6b)
1. My seat: `PortalPage`, `MySeatView`, `SeatCard`, `MyRequestsPanel`, `MyRequestRow`.
2. My devices: `MyDevicesView`, `MyDevicesTiles`, `MyDevicesTable` (`TABLE_*`, select, `min-w-240`).
3. Profile: `ProfileTab`, `ProfileTabView`, `PersonalInfoCard`, `MembershipCard`, `ProfilePhotoSection` (kit Button,
   file-picker string).
4. Character: `PixelLookPicker`, `LookStage`, `LookPreview`.
5. After each file: `rg -n "on-surface|outline-variant|text-error|text-primary\b|ring-primary|outline-primary|text-\[|tracking-\[|text-(xs|sm|base|lg|xl|2xl)\b|text-h[23]|font-(bold|extrabold|heading)|rounded-md3|surface-(high|container)|-container\b|accent-orange|min-h-11|min-w-11|size-11|h-11|h-10!|opacity-|focus(-within|-visible)?:|<button|gap-1\.5|py-1\.5" <file>`
   → no hits (`text-primary\b` also matches inside `text-text-primary`; read those hits, only the bare class is wrong).
6. Pending: `node scripts/check-tokens.mjs --list`; the 5 files report 0, every other count unchanged; delete the 5
   keys (sorted order kept); `node scripts/check-tokens.mjs` exits 0.
7. Tests (below), impl-log "Slice 6b", checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
   `pnpm build`.

Rules: R1 (ui → ui only; new imports `../table` in `MyDevicesTable`, `../Button` in `ProfilePhotoSection`), R3 none, R4
(Files tables only), R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 6b)
| Test (file › name) | Covers |
|---|---|
| `screen-tokens.test.ts` › `MIGRATED` gains 20 files: `ui/portal/{PortalPage,PortalTabs,MySeatTab,MySeatView,SeatCard,MyRequestsPanel,MyRequestRow,MyDevicesTab,MyDevicesView,MyDevicesTiles,MyDevicesTable,ProfileTab,ProfileTabView,PersonalInfoCard,MembershipCard,ProfilePhotoSection,ProfilePhoto,PixelLookPicker,LookStage,LookPreview}.tsx`; the existing legacy / raw-type / low-target / palette / `opacity-60` / focus and "not pending" tests then cover them | R-a…R-c, R-h |
| screen-tokens › "kit Button only" list gains `ui/portal/ProfilePhotoSection.tsx` | R-f |
| screen-tokens › "shared table classes" list gains `ui/portal/MyDevicesTable.tsx` (contains `TABLE_HEAD`, `TABLE_CELL`; no `const CELL\|HEAD`) | R-g |
| screen-tokens › new "portal character picker uses pixel tokens": `PixelLookPicker`, `LookStage`, `LookPreview` match none of `/--px-\|outline-variant\|opacity-\d\|(?<![\w-])(?:ring\|outline\|text\|border)-primary(?![\w-])/`; `PixelLookPicker.tsx` contains `ring-pixel-primary`, `border-pixel-primary`, `text-pixel-primary` and `outline-focus`; `LookStage.tsx` contains `bg-tile`. Plus: no file in the 20 contains `outline-variant` (closes the `var(--color-outline-variant)` gap `LEGACY` does not see) | R-i, Q4, R-e |
| `SeatCard.test.tsx` › 48–55: name "Release is an outlined button with the kit 44 px height", `min-h-11` → `min-h-control` and `not.toContain("min-h-11")`; new: View-on-map `<a` has `min-h-control`; `<h4` has `text-body` and `font-semibold`; markup has no `font-extrabold`, `accent-orange`, `gap-1.5` | R-f, R-b |
| `MySeatView.test.tsx` › 42 `min-h-11` → `min-h-control`; new: empty state (`seats: []`, no requests) link `<a [^>]*href="/rooms"` contains `min-h-control` | R-f, AC 3 |
| `MyDevicesTable.test.tsx` › 86 `min-w-[960px]` → `min-w-240`; new "tokens": `<th` has `text-caption` and `uppercase`; `<select` has `min-h-control` and `border-border-strong`; search markup has no `h-10!`; no `text-[` in the markup | R-c, R-g, R-f |
| `PixelLookPicker.test.tsx` › 104–110: name "… carry the kit 44 px classes", `min-h-11`/`min-w-11` → `min-h-control`/`min-w-control`; new: every `<label` has `has-[:focus-visible]:outline-focus` and no `opacity-`; style-card labels have `has-[:checked]:border-pixel-primary`; the card check icon (style fieldset, `>check</span>`) has `text-pixel-primary` | R-f, R-i, R-e |
| `ProfilePhotoSection.test.tsx` › new: file `<label` has `field-box` and `min-h-control`, no `focus-within:`; with `url` the Remove `<button` has `data-variant="text"` and `min-h-control`; error `<p role="alert"` has `text-danger`. Existing 23–70 unchanged and green (no `<button` without a photo; `<button[^>]*disabled` when busy) | R-f, R-a |
| `MyRequestRow.test.tsx` › new: pending row icon `<span` has `bg-warning-tint text-warning`, cancelled `bg-canvas`; Cancel `<button` has `min-h-control` and no `min-h-11`; markup has no `-container`. Existing 35, 52, 61 unchanged | R-a, R-e, R-f |
| `MyDevicesTiles.test.tsx` › new: values have `text-title`; total tile has `bg-workspace-action`; no `font-extrabold`, `-container`. 28 unchanged | R-b, R-a |
| `LookStage.test.tsx` › new: stage wrapper has `bg-tile` and `border-divider`; markup has no `surface-container`, `outline-variant` | R-i |
| `CheckinPopup.test.tsx` › "pixel chrome" (119–121): drop the no-op `.replace("max-h-[90dvh]", "").replace(/w-\[min[^\s"]*/, "")` → `expect(html).not.toContain(bad)` (neither stripped class contains a forbidden string; 6a review nit) | test hygiene |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with 5 keys removed | pending only shrinks |

Existing asserts that keep passing unchanged: `PortalTabs.test.tsx:42–43` (kit `TabBar`, untouched),
`MySeatView.test.tsx:46, 53`, `MyDevicesTiles.test.tsx:28`, `MyDevicesTable.test.tsx:70, 82, 87`, the
`PixelLookPicker` count tests (labels, radios, checks), `ProfileTabView.test.tsx`, `MyRequestsPanel.test.tsx`.

### Acceptance → verification (slice 6b)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S6b-1 | Portal screens use token utilities only (R-a/R-c/R-i); legacy lines 93 → 0 | `screen-tokens.test.ts` green with the 20 files; `rg -n "on-surface\|outline-variant\|text-error\|-container\b\|accent-orange\|surface-high\|rounded-md3\|text-\[\|tracking-\[\|min-w-\[\|h-10!\|(?<![\w-])(ring\|outline)-primary(?![\w-])" --pcre2 src/ui/portal -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S6b-2 | No off-scale type: h1 Display, card titles Body 600, labels 14, metadata 12, metric values Title; no 700/800 (Q7, Q8, Q16) | `rg -n "text-(xs\|sm\|base\|lg\|xl\|2xl)\b\|text-h[23]\|font-(bold\|extrabold\|heading)" <same paths>` → no hits; SeatCard, MyDevicesTiles, MyDevicesTable tests |
| S6b-3 | Targets ≥ 44 px: Release, Cancel, View on map, empty-state link, type select, search, photo picker and Remove, every picker option (AC 3) | SeatCard, MySeatView, MyDevicesTable, ProfilePhotoSection, MyRequestRow, PixelLookPicker tests; `rg -n "min-h-11\|min-w-11\|size-11\|h-11\|<button\|py-1\.5" <same paths>` → no hits |
| S6b-4 | Pixel green only in the character picker (Q4): selected option ring/border and card check `pixel-primary`, adornment pixel green, stage `bg-tile`; the rest of the portal is workspace (coral/ink) | screen-tokens "portal character picker"; PixelLookPicker, LookStage tests; `rg -n "pixel-" src/ui/portal -g '!*.test.tsx'` hits only `PixelLookPicker.tsx`/`LookStage.tsx` (plus names such as `pixel-look-*` in ids/imports) |
| S6b-5 | Status icons in My requests use tint tokens next to the unchanged status `Pill` text (R-e); no opacity dimming in the picker | MyRequestRow test; `rg -n "opacity-" src/ui/portal -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S6b-6 | Focus visible without hard-coded colours: picker options ring `outline-focus` (same as the global rule), photo picker via `.field-box:focus-within`, select via the global rule | PixelLookPicker and ProfilePhotoSection tests; `rg -n "focus(-within\|-visible)?:" <same paths>` → no hits; manual Tab (Ming) |
| S6b-7 | My devices table uses `TABLE_*` (R-g) at `min-w-240` (960 px unchanged) | screen-tokens shared-table test; MyDevicesTable test |
| S6b-8 | Pending shrinks by exactly the 5 portal keys (93 → 83, 16 → 11 keys) | `git diff main -- scripts/check-tokens.pending.json` shows 5 removed lines only; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S6b-9 | No behaviour, copy, prop, id, `role`, `data-*` or `aria-*` change (`aria-describedby` on the name field, `aria-busy` skeletons, radio `name`/`aria-label`, `photo-canvas.ts`) | existing tests unchanged except the listed asserts; `git diff main -- src/ui/copy src/lib src/app src/ui/portal/*.ts` empty |
| S6b-10 | Only planned files | `git diff --stat main` ⊆ Files tables |
| S6b-11 | Checks green; impl-log "Slice 6b" complete (legacy and pending before/after, visible differences) | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 6b)
- My Portal title 32 px · 800 → 32 px · 600 (`.text-h2` already maps to Display, `globals.css:209–212`).
- Seat cards: chair tile orange-tinted 44 px → 40 px canvas tile with a coral chair; seat code 16 px · 800 → 16 px · 600;
  room line 14 px; "View on map" link 44 px tall (was text height), ink, 4 px icon gaps (were 6).
- My requests: status icon circles use the tint tokens (lighter fills, same hue family); seat name 700 → 600; loading
  block canvas.
- My devices: type tiles 44 → 40 px icons, values 24 px · 800 → 24 px · 600 (Title); the "total" tile keeps the coral fill;
  the second-type tile turns blue-tint (was tertiary). Table: header 11 px · 800 → 12 px · 600 with `tracking-wide`; a
  divider under the header instead of a grey header fill; rows tighter (cell padding 16 → 8 px vertical, 16 → 12 px
  horizontal), like the Devices table; search box and type filter 40 → 44 px, filter corners 12 → 8 px with a stronger
  border.
- Profile: field captions 12 px · 600 grey → 14 px · 500 ink; org badge 44 → 40 px, 800 → 600; "Upload/Replace photo"
  pill (full radius, 700) → 8 px secondary-style button, 44 px; "Remove photo" red bold text → ink kit text button
  (44 px; Q-S6b-2); visibility note gap 6 → 4 px.
- Character picker: selected swatch/style ring and the style check icon ink → pixel green; option grid gaps 6 → 4 px;
  layer legends 12 px · 600 grey → 14 px · 500 ink; options are no longer faded while the look is saving (cursor only;
  Q-S6b-4); the stage background grey canvas → tile; in dark mode the check mark on swatches is white (was dark).

### Ming verification after merge (slice 6b)
- `/portal` at 390 / 1024 / 1280 px, light and dark: My seat (a seat card, View on map, Release; the empty state link
  without seats), My requests with pending / approved / rejected / cancelled rows.
- My devices: tiles, search and type filter (same height side by side), the table scrolls sideways at 390 and fits at
  1280; Load more if available.
- Profile: Tab through the name field, the photo picker (green ring on "Upload photo") and Remove, then the character
  picker: arrow keys move within a layer and the focused option shows the green ring; pick a skin/hair/style and save;
  in dark mode the selected ring and check marks are visible on every swatch.

### Assumptions and non-blocking questions (slice 6b)
- Hotspots: no other ticket is IN_PROGRESS/REVIEW/DONE (`work/backlog.md`). `screen-tokens.test.ts` and
  `scripts/check-tokens.pending.json` change again in 6c and 7; 6b merges first. `CheckinPopup.test.tsx` is a 6a file;
  the nit only removes dead code in one assert.
- `outline-focus` resolves to `--color-focus` (`tokens.css:33`, 135), the colour of the global ring
  (`globals.css:339–342`); `min-w-control` exists (`--spacing-control`, `globals.css:170`; used at `AppShellView.tsx:136`).
- Approved defaults used: Q1, Q2, Q4 (pixel scope), Q5, Q6, Q7, Q8, Q15, Q16; Q-S5b-3 (links inside table cells stay
  text links), Q-S5b-4 (`.field-box` file picker).
- Q-S6b-1 (non-blocking). Decorative 44 px icon tiles (`SeatCard`, `MembershipCard`, `MyDevicesTiles`) trip
  `LOW_TARGET` (`size-11`/`h-11`). **Default: `size-10` (40 px, the shell logo tile, `AppShellView.tsx:66`).**
  Alternative: `size-control` (44 px, no visible change, but a control token on a non-control).
- Q-S6b-2 (non-blocking). Remove photo: **default kit `variant="text"` (outline; ink)**. Alternative: `variant="danger"`
  like "Remove image" in device types (5b).
- Q-S6b-3 (non-blocking). The picker radios are `sr-only`, so the global `:focus-visible` ring cannot show on them.
  **Default: restate the same ring on the label (`has-[:focus-visible]:outline-2 outline-offset-2 outline-focus`,
  keyboard focus only).** Alternative: `.field-box` on the label (ring also on mouse clicks).
- Q-S6b-4 (non-blocking). Disabled picker options (only while loading/saving): **default no opacity (R-e; the
  footer shows "Saving…"), `cursor-not-allowed` only.** Alternative: `has-[:disabled]:opacity-50` like the kit Button.
- Q-S6b-5 (non-blocking). The outline lists `LookPreview` under "sprite backgrounds `bg-tile`", but its only class is
  the loading placeholder, which sits on the tile stage and would vanish. **Default: `bg-divider` (skeleton fill,
  R-a); the stage itself is `bg-tile`.**
- Q-S6b-6 (non-blocking). My devices table: **default the `DeviceTable` pattern (divider under the header, no header
  fill, `TABLE_CELL` padding)** so both device tables match. Alternative: keep `bg-canvas` on the header row.
- Q-S6b-7 (non-blocking). Swatch check mark: **default `text-on-action` (white) with the existing `drop-shadow`** in
  both themes (was `text-on-primary` = surface, dark in dark mode). Alternative: `text-surface` (keeps today's
  behaviour).

Status: READY

## Slice 6c addendum — Roomlayout chrome and map items
Status: READY. Written against `main` after #166 (slices 1–5c, 6a and 6b merged) plus the solo commits 33f6700 and
8b27bfa (room switcher on check-in only; `fill` on `RoomMapSection`/`RoomMap`, `work/solo-log.md:11–12`). Every line
number below was read on that `main`. Expands "Slice 6c outline" above; Ming approved the plan and split with all
defaults. Applies R-a…R-h ("Slice 5 addendum"), "Rules for every slice-5 file" and R-i ("Slice 6 addendum")
**unchanged**; the shared values are the 5b/5c/6a/6b strings. No new decisions; open points are non-blocking Q-S6c-n at
the end, each with a default. Pixel green (Q4) only in the layout palette, the Map items editor and its sprite browser;
the room map, the rest of the layout editor and the Map items library stay workspace (ink/coral).

Not touched: `paint.ts`, `WalkLayer.tsx` canvas paint (no class to change; added to `MIGRATED` only), every `*.ts` in
`src/ui/roomlayout/` and `src/ui/mapItems/`, `src/lib/**` (incl. `STATUS_DOT` in `src/lib/sprites/overlay.ts`, the inline
hover-tag dot colour, and `TAG_H`/`TAG_PAD` in `src/lib/sprites/tag-layout.ts`), `src/lib/sprites/**`, sprites and art
colours (`--px-*`), `src/app/**`, `src/app/globals.css`, `src/styles/tokens.css`, `src/ui/copy/**`, kit components
(`Button`, `IconButton`, `Card`, `TabBar`, `FilledInput`, `EntityFormDialog`, `Chip`), `src/ui/RoomSwitcher.tsx` and the
check-in files of the solo commits, `scripts/check-tokens.mjs`.

### Size and split
23 screen files ≈ 300 changed lines (131 legacy lines, table below, ≈ 2 lines each, plus the Radios → kit Button and
close → `IconButton` swaps and oxfmt reflow), `screen-tokens.test.ts` ≈ 50, `tokens.test.ts` 2, 10 screen test files
≈ 75, pending 10, the `PersonalInfoCard` nit 2, impl-log ≈ 50: **≈ 490 changed lines**. Under the ~600 threshold, so
**6c ships as one PR and there is no 6d** (Q-S6c-1). If the implementer's diff passes 600, stop after the mapItems
files are done, record it in impl-log, and the orchestrator decides (roomlayout then becomes 6d with this addendum's
roomlayout rows unchanged).

### Pending list (R-h): 10 keys, 51 violations → 0 (83 → 32, 11 → 1 key)
Read from `scripts/check-tokens.pending.json` on `main` (11 keys / 83). Every cause is removed by the Files tables.

| Key | Count | Cause (line on current `main`) |
|---|---|---|
| `src/ui/mapItems/MapItemEditor.tsx` | 11 | `text-[11px]` + `tracking-[0.05em]` (64: 3), `text-[20px]` (67: 2), `text-[13px]` (104: 2), dialog `w-[calc(100%-1.5rem)]`, `max-w-[580px]`, `shadow-[0_12px_40px_…]` (332: 4) |
| `src/ui/mapItems/MapItemEditorAppearance.tsx` | 5 | `py-0.5` (171), `text-[11px]` (190: 2), `text-[13px]` (258: 2) |
| `src/ui/mapItems/MapItemEditorDetails.tsx` | 8 | `CAPTION` `text-[11px]`, `tracking-[0.05em]`, `px-0.5` (15: 4), `text-[13px]` (130: 2, 168: 2) |
| `src/ui/mapItems/SpriteBrowser.tsx` | 4 | `text-[11px]` (114: 2, 117: 2) |
| `src/ui/roomlayout/EditorInspector.tsx` | 6 | `py-1.5` + `text-[13px]` (130: 3, 152: 3) |
| `src/ui/roomlayout/EditorViews.tsx` | 2 | `LINK` `text-[13px]` (15) |
| `src/ui/roomlayout/LayoutEditor.tsx` | 1 | `grid-cols-[minmax(0,1fr)_18rem]` (193) |
| `src/ui/roomlayout/Palette.tsx` | 2 | `text-[13px]` (55) |
| `src/ui/roomlayout/RoomMapSection.tsx` | 2 | `text-[13px]` (88; was 84 before the solo commit) |
| `src/ui/roomlayout/SeatOverlay.tsx` | 10 | `TAG_BASE` `gap-1.5`, `px-2.5` (18: 2), `bg-[rgba(22,27,37,.92)]` (20, 165, 166: 3), `gap-1.5`, `px-2.5` (165: 2, 166: 2), `px-2.5` (204) |

All 10 keys are deleted; `src/app/globals.css` stays at 32 (slice 7's). After 6c the file holds that one key.

### Legacy lines outside the guard (non-test `.tsx` in `src/ui/roomlayout/` and `src/ui/mapItems/`), before → after
"Legacy" = the 6b definition (R-a alias incl. `var(--outline-variant)`, R-b raw size / 700–800 weight, R-c arbitrary
value, a `LOW_TARGET` class, `opacity-60`, a per-component or hard-coded focus colour) plus Tailwind palette colours
(`amber-*`, `emerald-*`, `teal-*`, `white`). Every count goes to 0.

| File | Before | Lines |
|---|---|---|
| `roomlayout/EditorViews.tsx` | 15 | 13, 15, 29, 37, 38, 42, 43, 46, 50, 54, 90, 92, 93, 96, 155 |
| `roomlayout/EditorInspector.tsx` | 12 | 61, 63, 64, 91, 121, 130, 141, 143, 145, 152, 217, 222 |
| `roomlayout/SeatOverlay.tsx` | 9 | 18, 20, 21, 23, 39, 158, 165, 166, 204 |
| `roomlayout/Palette.tsx` | 9 | 13, 28, 29, 33, 43, 46, 55, 92, 117 |
| `roomlayout/RoomMapSection.tsx` | 7 | 47, 60, 82, 83, 88, 98, 103 |
| `roomlayout/RoomMap.tsx` | 4 | 30, 42, 174, 182 |
| `roomlayout/EditorCanvas.tsx` | 4 | 232, 242, 266, 282 |
| `roomlayout/ShortcutList.tsx` | 4 | 10, 19, 27, 36 |
| `roomlayout/GestureOverlay.tsx` | 3 | 28, 36, 43 |
| `roomlayout/EditorToolbar.tsx` | 2 | 41, 54 |
| `roomlayout/ZoomControl.tsx` | 1 | 19 |
| `roomlayout/LayoutEditor.tsx` | 1 | 193 |
| `roomlayout/LayoutEditorPage.tsx` | 1 | 43 |
| `roomlayout/EditorWarnings.tsx` | 1 | 15 |
| `mapItems/MapItemEditorAppearance.tsx` | 21 | 18, 21, 80, 82, 83, 125, 137, 144, 149, 152, 168, 171, 181, 185, 190, 196, 228, 235, 258, 265, 270 |
| `mapItems/MapItemEditor.tsx` | 13 | 64, 67, 70, 76, 104, 150, 151, 157, 161, 166, 172, 175, 332 |
| `mapItems/MapItemEditorDetails.tsx` | 13 | 15, 16, 29, 41, 119, 130, 133, 152, 166, 168, 170, 176, 189 |
| `mapItems/SpriteBrowser.tsx` | 9 | 60, 62, 72, 76, 85, 94, 105, 114, 117 |
| `mapItems/MapItemCard.tsx` | 1 | 53 (`opacity-60`) |
| `mapItems/MapItemsView.tsx` | 1 | 188 (`text-error`) |
| **Total** | **131** | → **0** (roomlayout 73, mapItems 58) |

Clean today, no edit, added to `MIGRATED` only: `roomlayout/WalkLayer.tsx`, `mapItems/MapItemsPage.tsx`,
`mapItems/FramePreview.tsx`.

### Rename map used in 6c (R-a…R-i; only the rows that occur here)
| Old | New | Rule |
|---|---|---|
| `text-on-surface`, `text-primary` (ink) | `text-text-primary` | R-a |
| `text-on-surface-variant` | `text-text-secondary` | R-a |
| `text-error` · `border-error`, `border-error/40` · `bg-error/20` | `text-danger` · `border-danger`, `border-danger/40` · `bg-danger/20` | R-a |
| `border-outline-variant`, `var(--outline-variant)` (inline `style`) | `border-divider`, `var(--color-divider)` (same value, `globals.css:68`) | R-a |
| `border-outline` on an input/select | `border-border-strong` | R-a, Q6 |
| `hover:border-outline` on a link | `hover:border-border-strong` | R-a |
| `bg-surface-high` (row hover, badge) · `bg-surface-container` (kbd) | `bg-tile` on pixel/map surfaces and list rows (below) · `bg-canvas` (kbd, source badge) | R-a, R-i |
| `bg-surface-container-high` (map name tags) | `bg-tile` | R-i |
| `bg-[rgba(22,27,37,.92)] text-white` (map hover/name tags) | `bg-text-primary text-surface` (RoleBadge pattern; pair tested as `text-primary` on `surface`; Q-S6c-5) | R-c, R-a |
| `bg-primary text-on-primary` (Move-here tag) | `bg-pixel-primary text-on-action` (check-in only, Q4; pair tested) | R-i |
| `border-primary`, `bg-primary/20`, `bg-primary/10`, `outline-on-surface` (editor ghosts, selection) | `border-text-primary`, `bg-text-primary/20`, `bg-text-primary/10`, `outline-text-primary` (ink, as today; Q-S6c-13) | R-a |
| `aria-pressed:border-primary aria-pressed:text-primary aria-pressed:font-extrabold` (ZoomControl) | `aria-pressed:border-text-primary aria-pressed:font-semibold` (kit 44 px Button unchanged) | R-a, R-b |
| `aria-pressed:font-extrabold aria-pressed:text-primary` (Palette, Inspector rows) | `aria-pressed:bg-tile aria-pressed:font-semibold`; Palette adds the pixel-green bar `border-l-4 border-transparent aria-pressed:border-pixel-primary` | R-a, R-i, Q4 |
| `bg-primary` changed dot · `border-primary bg-primary-container` selected option · `has-[:checked]:border-primary has-[:checked]:bg-primary-container` | `bg-pixel-primary` · `aria-checked:border-pixel-primary aria-checked:bg-tile aria-checked:font-semibold` · `has-[:checked]:border-pixel-primary has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary` | R-i, Q4 |
| `bg-surface` / `bg-surface-high` behind a sprite (editor preview, browser tiles) | `bg-tile` (brief: "Sprite previews: `--color-tile`") | R-i |
| `bg-emerald-400` (present dot) | `bg-current` (filled shape; Q-S6c-4) | Rules (no palette) |
| `border-amber-300 bg-amber-50` (editor warnings) | `border-warning/40 bg-warning-tint` | R-a (palette row) |
| `hover:outline-white` (seat buttons) | `hover:outline-surface` | Rules (token colour) |
| `focus-visible:outline-white focus-visible:ring-2 focus-visible:ring-teal-500` · `outline-none focus-visible:ring-2 focus-visible:ring-primary` · `focus-visible:ring-2 focus-visible:ring-white` · `peer-focus-visible:ring-*` span | delete: the global `:focus-visible` ring (`globals.css:339–342`, `--color-focus`) applies to buttons, `[tabindex]` regions and inputs; the sprite tiles restate it on the label as `has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus` (Q-S6b-3 pattern; Q-S6c-3) | Rules (no per-component focus) |
| `text-base font-extrabold` (section/panel `<h2>`) | `text-body font-semibold` (6b card-title row) | R-b |
| `text-h2 font-extrabold` (page `<h1>`) | `text-display` | R-b |
| `text-[20px] font-extrabold` (dialog title) | `text-subtitle` (kit dialog title, `EntityFormDialog.tsx:77`) | R-b |
| `text-sm` / `text-sm font-medium` / `text-sm font-semibold\|bold\|extrabold` / `text-[13px]` (+ weight) | `text-label font-normal` / `text-label` / `text-label font-semibold` / `text-label` (weight per the same rows) | R-b |
| `text-xs` (+ weight), `text-[11px]` | `text-caption` (+ `font-semibold` / `font-medium`) | R-b |
| `text-[11px] font-extrabold tracking-[0.05em] uppercase`, `text-xs font-extrabold uppercase` | `text-caption font-semibold uppercase tracking-wide` | R-b |
| `font-bold`, `font-extrabold` elsewhere | `font-semibold` | R-b |
| `grid-cols-[minmax(0,1fr)_18rem]` | `grid-cols-[minmax(0,1fr)_--spacing(72)]` (288 px unchanged) | R-c |
| `w-[calc(100%-1.5rem)] max-w-[580px]` · `shadow-[0_12px_40px_var(--shadow)]` · `rounded-md3-xl` | `w-[calc(100%-var(--space-6))] max-w-145` (same widths) · `shadow-dialog` · `rounded-2xl` | R-c |
| `rounded-md3` | `rounded-lg` on controls (search), `rounded-xl` on boxes/tiles | R-c |
| `rounded-full` on a link or option button | `rounded-lg` (Q2) | R-c |
| `shadow` (Tailwind default, Move-here tag) | `shadow-card` | R-c |
| `size-11 rounded-full` hand-built close button | kit `IconButton` (Q-S6c-14) | R-f |
| `min-h-11` on a label/input · `className="min-h-11"` on a kit Button | `min-h-control` · delete | R-f |
| `gap-1.5` · `px-2.5` · `py-0.5` · `py-1.5` · `px-0.5` | `gap-1` · `px-3` · `py-1` · `min-h-control` row (the vertical padding goes) · delete | R-d, R-f |
| `disabled:opacity-50` / `disabled:opacity-40` on text rows and options · `disabled:opacity-60` (Move here) · `opacity-60` (hidden item art) | delete, `disabled:cursor-not-allowed` only (Q-S6b-4) · `disabled:opacity-50` (kit `DISABLED` strength) · `opacity-50` (decorative art, Q-S6c-6) | R-e |
| hand-built option `<button>` (Appearance `Radios`) | kit `Button variant="outlined" size="sm"` | R-f |

**Room backdrops (`--color-room-floor` / `--color-room-green`):** `rg -n "room-floor|room-green|px-floor|px-wall" src/ui/roomlayout src/ui/mapItems`
→ no hits. No chrome class or CSS paints a room backdrop here; the backdrop is canvas paint (`paint.ts`, untouched).
**So 6c changes nothing for this item** (Q-S6c-9). **Library page:** `MapItemsView.tsx:165` and `LayoutEditorPage.tsx:42`
already use `page-library` (`max-width: var(--width-library)`, `globals.css:239–250`, asserted at
`tokens.test.ts:216` and `MapItemsView.test.tsx:79`); no change.

### Shared values used in 6c (same strings as 5b/5c/6a/6b)
- **Page `<h1>`:** `text-display text-text-primary`. **Panel/section `<h2>`:** `text-body font-semibold
  text-text-primary`. **Group `<h3>` inside a panel:** `font-semibold` (inherits `text-label`).
- **Notices:** error `text-label font-semibold text-danger`; status `text-label font-semibold text-text-secondary` (old
  `text-on-surface-variant`) or `text-text-primary`; hint / body lines `text-label font-normal text-text-secondary`;
  small hint / meta `text-caption text-text-secondary` (+ `font-medium` / `font-semibold` where it had it); small error
  `text-caption font-semibold text-danger`.
- **Form caption** (legends): `text-label text-text-primary` (kit `FIELD_CAPTION`).
- **Checkbox rows (R-f):** `<label>` (or the row span inside it) `flex min-h-control cursor-pointer items-center gap-2
  text-label text-text-primary`; input `className="size-5 flex-none"`.
- **Small number input** (`Palette.tsx` `inputClass`, reused by `EditorInspector`): `w-16 min-h-control rounded-lg
  border border-border-strong bg-surface px-2 text-label font-normal text-text-primary` (Q6; global focus ring).
- **Secondary link button** (a `<Link>` that looks like the kit secondary button; a kit Button cannot be a link;
  Q-S6c-7): `state-layer inline-flex min-h-control shrink-0 items-center justify-center rounded-lg border border-border
  bg-surface px-4 text-label text-text-primary hover:border-border-strong
  transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out`.
- **List option row** (hand-built `<button>` with `aria-pressed`, Q-S6c-8): `flex min-h-control w-full cursor-pointer
  items-center rounded-lg px-3 text-left text-label font-normal text-text-primary enabled:hover:bg-tile
  disabled:cursor-not-allowed aria-pressed:bg-tile aria-pressed:font-semibold` + the `TRANSITION` string of
  `src/ui/Button.tsx:8–9`. Palette rows: `px-2` and add `border-l-4 border-transparent aria-pressed:border-pixel-primary`.
- **Map frame** (RoomMap and EditorCanvas scroll region): keep every layout class (`max-h-[70vh]`, the `fill` classes
  of 8b27bfa, `overflow-auto overscroll-contain`), `rounded-md border border-divider`; drop `outline-none
  focus-visible:ring-2 focus-visible:ring-primary`.

### Files (slice 6c)
None matches a High path (`.github/risk-tiers.yml`: `src/ui/**`, tests and `scripts/check-tokens.pending.json` are not
listed). "→" = replace the whole class string unless "add"/"drop"/"keep" says otherwise; the implementer re-reads each
file first. Props, handlers, ids, `aria-*`, `role`, `data-*`, inline `style` geometry and copy unchanged unless stated.

**Room map (room page and check-in)**

| File | Change | Pending |
|---|---|---|
| `src/ui/roomlayout/RoomMap.tsx` | `STATUS` (30) `rounded-md border border-divider p-4 text-label font-normal text-text-primary`; error (42) `border-danger/40`; zoom-limited (174) `text-label font-normal text-text-secondary`; region (182) map-frame string (both `fill` branches kept as is) | not pending |
| `src/ui/roomlayout/RoomMapSection.tsx` | error (47) notice error; empty (60) `text-label text-text-secondary`; h2 (82) panel h2; pan hint (83) `text-label text-text-secondary`; Edit layout `<Link>` (88) secondary link button; truncated / unplaced (98, 103) `text-label font-semibold text-text-secondary`. `fill` classes (79) unchanged | 2 → 0 (remove) |
| `src/ui/roomlayout/ZoomControl.tsx` | (19) `className="aria-pressed:border-text-primary aria-pressed:font-semibold"` | not pending |
| `src/ui/roomlayout/SeatOverlay.tsx` | `TAG_BASE` (17–18) `pointer-events-none absolute items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold whitespace-nowrap` (Q-S6c-12); `TAG_LOOK` (20–21) `present: "bg-text-primary text-surface"`, `away: "bg-tile text-text-secondary"`; `TAG_NEUTRAL` (23) `"bg-tile text-text-primary"`; present dot (39) `size-2 shrink-0 rounded-full bg-current` (Q-S6c-4); seat button (158) `group absolute cursor-pointer rounded-sm hover:outline-2 hover:outline-surface` (Q-S6c-3); hover tags (165, 166) the same strings with `gap-1.5` → `gap-1`, `bg-[rgba(22,27,37,.92)]` → `bg-text-primary`, `px-2.5` → `px-3`, `text-xs` → `text-caption`, `text-white` → `text-surface` (keep `hidden`, `group-hover:flex`, `group-focus-visible:flex`, `max-w-40`, `SIDE`/`ALIGN`); Move-here button (204) `absolute z-30 min-h-6 cursor-pointer rounded-full bg-pixel-primary px-3 text-caption font-semibold whitespace-nowrap text-on-action shadow-card before:absolute before:inset-x-0 before:top-1/2 before:h-control before:-translate-y-1/2 disabled:cursor-wait disabled:opacity-50` (44 px tall hit area, visible tag unchanged; Q-S6c-2). Hover-tag dot inline `STATUS_DOT` (171–172) unchanged | 10 → 0 (remove) |

**Layout editor (`/rooms/<code>/edit`, desktop only)**

| File | Change | Pending |
|---|---|---|
| `src/ui/roomlayout/LayoutEditorPage.tsx` | h1 (43) `text-display text-text-primary` | not pending |
| `src/ui/roomlayout/LayoutEditor.tsx` | grid (193) `grid grid-cols-[minmax(0,1fr)_--spacing(72)] items-start gap-4` | 1 → 0 (remove) |
| `src/ui/roomlayout/EditorToolbar.tsx` | unsaved (41) `text-label font-semibold text-text-primary`; save reason (54) `text-label font-normal text-text-secondary`. Save stays kit `filled` (the editor is workspace; Q4 lists only its palette) | not pending |
| `src/ui/roomlayout/EditorViews.tsx` | `BOX` (13) `flex max-w-xl flex-col items-start gap-3 rounded-md border border-divider p-4`; `LINK` (14–15) secondary link button; checking/loading (29) `text-label font-normal text-text-secondary`; h2 (37, 42) panel h2; bodies (38, 43) `text-label font-normal text-text-secondary`; read-only (46) `text-label font-normal text-text-primary`; missing / error (50, 54) notice error; banner (90) `flex flex-col items-start gap-2 rounded-md border border-danger/40 p-3 text-label font-normal`; banner title (92) `font-semibold text-danger`; detail / conflict note (93, 96) `text-text-secondary`; status line (155) `min-h-5 text-label font-normal text-text-secondary` | 2 → 0 (remove) |
| `src/ui/roomlayout/EditorWarnings.tsx` | box (15) `rounded-md border border-warning/40 bg-warning-tint p-2 text-label font-normal text-text-primary` (pair added to tokens.test); heading (16) `font-medium` unchanged | not pending |
| `src/ui/roomlayout/EditorCanvas.tsx` | zoom-limited (232) as RoomMap 174; region (242) map-frame string; place ghost (266) `${preview.ok ? "border-text-primary bg-text-primary/20" : "border-dashed border-danger bg-danger/20"}`; selection outline (282) `pointer-events-none absolute border-2 border-text-primary outline-2 -outline-offset-4 outline-dashed outline-text-primary` | not pending |
| `src/ui/roomlayout/GestureOverlay.tsx` | drag ghost (28) same ternary as EditorCanvas 266; marquee (36) `… border border-dashed border-text-primary bg-text-primary/10`; marquee item (43) `… border border-text-primary` | not pending |
| `src/ui/roomlayout/Palette.tsx` | `inputClass` (12–13) small number input; section (28) `flex flex-col gap-2 text-label font-normal text-text-primary`; h2 (29) `text-body font-semibold`; error (33) `text-danger`; list box (43) `border-divider`; group h3 (46) `font-semibold`; entry button (55) list option row with `px-2` and the pixel-green bar (drops `disabled:opacity-50`, `hover:bg-surface-high`, `py-1`); place form (92) `flex flex-col gap-2 text-label font-normal text-text-primary`; bad tile (117) `text-danger` | 2 → 0 (remove) |
| `src/ui/roomlayout/EditorInspector.tsx` | aside (61) `flex flex-col gap-4 text-label font-normal text-text-primary`; h2 (63) `text-body font-semibold`; none / delete note / empty (64, 91, 143) `text-text-secondary`; h3 (121, 141) `font-semibold`; tray rows (130) and item rows (152) list option row (no pixel bar: ink, outline); item list box (145) `border-divider`; size errors (217, 222) `text-danger` | 6 → 0 (remove) |
| `src/ui/roomlayout/ShortcutList.tsx` | kbd (10) `rounded border border-divider bg-canvas px-1 font-mono text-caption`; details (19) `text-label font-normal text-text-primary`; summary (20) `cursor-pointer py-3 font-semibold` (20 + 24 = 44 px target; keeps the native marker; Q-S6c-16); dd (27, 36) `text-text-secondary` | not pending |

**Map items (Q4 pixel green in the editor)**

| File | Change | Pending |
|---|---|---|
| `src/ui/mapItems/MapItemsView.tsx` | error (188) `text-label font-semibold text-danger`. The library has no primary action (Retry is `tonal`), so no `variant="pixel"` here | not pending |
| `src/ui/mapItems/MapItemCard.tsx` | hidden art (53) `opacity-60` → `opacity-50` (aria-hidden art next to the "Hidden" pill; Q-S6c-6). Edit pencil `<button>` (59–68: 44 px hit area, 32 px circle) unchanged | not pending |
| `src/ui/mapItems/MapItemEditor.tsx` | import `IconButton` from `../Button` (drop the `Icon` import if unused); eyebrow (64) `text-caption font-semibold uppercase tracking-wide text-text-secondary`; h2 (67) `text-subtitle text-text-primary`; key (70) `font-mono text-caption text-text-secondary`; close (72–79) → `<IconButton icon="close" label={copy.close} onClick={p.onRequestClose} className="shrink-0" />` (Q-S6c-14); error (104) `mb-3 text-label font-semibold text-danger`; footer (150) `border-divider`; status (151) `text-caption font-semibold text-text-secondary`; discard title (157) `text-label font-semibold text-text-primary`; drop `className="min-h-11"` (161, 166, 172, 175); Save (175) `variant="pixel"`; dialog (332) `m-auto w-[calc(100%-var(--space-6))] max-w-145 overflow-hidden rounded-2xl bg-surface p-0 text-text-primary shadow-dialog` and `style={{ animation: "popin var(--duration-ui) ease-out" }}` (kit dialog, `EntityFormDialog.tsx:72–73`; Q-S6c-11) | 11 → 0 (remove) |
| `src/ui/mapItems/MapItemEditorAppearance.tsx` | `CHANGED_DOT` (18) `… bg-pixel-primary …`; `GRID` (21) both `var(--outline-variant)` → `var(--color-divider)` (as `MapItemCard.tsx:13`); `Radios` option (64–94) → `<Button variant="outlined" size="sm" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled} onClick=… onKeyDown=… className="flex-1 aria-checked:border-pixel-primary aria-checked:bg-tile aria-checked:font-semibold">` (same children; `role` before `aria-checked` keeps the test regex at `MapItemEditorAppearance.test.tsx:50`), import `Button` already present; preview-NA lines (125, 137), size and only-updates hints (228, 265) `text-caption font-medium text-text-secondary`; atlas failed (144) and the sub-caption (152) `text-caption font-semibold text-text-secondary`; h3 (149) `text-label font-semibold text-text-primary`; preview box (168) `relative flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-divider bg-tile p-4` (R-i); source badge (171) `absolute top-2 left-2 rounded-full bg-canvas px-2 py-1 text-caption font-semibold text-text-primary`; figcaptions (181, 185) `text-caption text-text-secondary`; preview caption (190) `font-mono text-caption tracking-wide text-text-secondary`; removed-on-save (196) small error; drop `className="min-h-11"` (235, 270); dir note (258) notice error | 5 → 0 (remove) |
| `src/ui/mapItems/MapItemEditorDetails.tsx` | `CAPTION` (14–15) `text-label text-text-primary`; `HINT` (16) `text-caption font-medium text-text-secondary`; reset body (29) `flex flex-col gap-2 text-label text-text-primary`; in-use note (41) `text-text-secondary`; size value (119) `text-label font-semibold text-text-primary`; warnings (130, 168) notice error; confirm-resize label (133) and shown row (152) checkbox-row string, inputs (134, 153) `className="size-5 flex-none"`; reset box (166) `flex flex-col gap-3 rounded-xl border border-divider p-3`; reset confirm (170) `variant="pixel"` (Q-S6c-10); drop `className="min-h-11"` (170, 176, 189) | 8 → 0 (remove) |
| `src/ui/mapItems/SpriteBrowser.tsx` | search (60) `min-h-control min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-label text-text-primary`; all-types label (62) checkbox-row string, input (63) `className="size-5 flex-none"`; count (72) `text-caption font-medium text-text-secondary`; smaller (76) `text-caption text-text-secondary`; group h4 (85) `text-caption font-semibold uppercase tracking-wide text-text-secondary`; tile label (94) `relative flex min-h-control cursor-pointer flex-col items-center gap-1 rounded-xl border border-divider bg-tile p-2 has-[:checked]:border-pixel-primary has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus`; radio (103) `className="sr-only"` (drop `peer`); delete the focus span (105); key (114) `break-all text-center font-mono text-caption text-text-pixel`; size (117) `text-caption text-text-secondary` | 4 → 0 (remove) |

**Pending, tests, log, nit**

| File | Change |
|---|---|
| `scripts/check-tokens.pending.json` | delete the 10 keys (83 → 32, 11 → 1 key); `src/app/globals.css` 32 unchanged |
| `src/ui/screen-tokens.test.ts` | extend (Tests) |
| `src/lib/color/tokens.test.ts` | `TEXT_PAIRS` gains `["text-primary", "tile"]` (name tags, pressed rows, Radios) and `["text-primary", "warning-tint"]` (editor warnings) |
| `src/ui/roomlayout/RoomMap.test.tsx`, `SeatOverlay.test.tsx`, `LayoutEditorViews.test.tsx`, `EditorWarnings.test.tsx`; `src/ui/mapItems/MapItemCard.test.tsx`, `MapItemEditor.test.tsx`, `MapItemEditorAppearance.test.tsx`, `MapItemEditorDetails.test.tsx`, `SpriteBrowser.test.tsx` | update/extend (Tests) |
| `src/ui/portal/PersonalInfoCard.tsx` | 6b review nit: (68) `flex-none text-caption text-text-secondary` (sorted order; no visible change) |
| `work/tickets/SIM-071/impl-log.md` | append "Slice 6c": files, legacy-line and pending before/after (131 → 0; 51 → 0, 83 → 32), the build-output check, visible differences, checks |

### Approach (slice 6c)
1. Room map: `RoomMap`, `RoomMapSection`, `ZoomControl`, `SeatOverlay`.
2. Layout editor: `LayoutEditorPage`, `LayoutEditor`, `EditorToolbar`, `EditorViews`, `EditorWarnings`, `EditorCanvas`,
   `GestureOverlay`, `Palette`, `EditorInspector`, `ShortcutList`.
3. Map items: `MapItemsView`, `MapItemCard`, `MapItemEditor`, `MapItemEditorAppearance`, `MapItemEditorDetails`,
   `SpriteBrowser`.
4. After each file: `rg -n --pcre2 "on-surface|outline-variant|text-error|border-error|bg-error|(?<![\w-])(text|bg|border|ring|outline)-primary(?![\w-])|-container\b|surface-(high|container)|rounded-md3|rounded-full|text-\[|tracking-\[|shadow-\[|bg-\[|text-(xs|sm|base|lg|xl|2xl)\b|text-h[23]|font-(bold|extrabold|heading)|min-h-11|size-11|opacity-(40|60)|focus(-within|-visible)?:|outline-none|(amber|emerald|teal)-\d|-white\b|gap-1\.5|px-2\.5|py-(0|1)\.5|px-0\.5" <file>`
   → no hits, except `rounded-full` on the map tags and the Move-here pill (`SeatOverlay`), the changed dot
   (`MapItemEditorAppearance:18`), the source badge (171) and the `MapItemCard` pencil, which stay round (pills/dots,
   not buttons with a fill; read each hit).
5. `pnpm build`, then grep the built CSS once for `max-w-145`, `grid-template-columns:minmax(0,1fr) calc(var(--spacing)*72)`
   (or the compiled equivalent), `w-[calc(100%-var(--space-6))]`, `bg-text-primary/20`, `before:h-control` and
   `aria-checked:border-pixel-primary`; note the result in impl-log. Fallbacks if 4.3.x rejects one: `max-w-145` →
   `max-w-xl` (576 px, log it); `--spacing(72)` → `grid-cols-[minmax(0,1fr)_calc(var(--spacing)*72)]`;
   `bg-text-primary/20` → `bg-[color-mix(in_srgb,var(--color-text-primary)_20%,transparent)]`; record which.
6. Pending: `node scripts/check-tokens.mjs --list`; the 10 files report 0, `globals.css` 32; delete the 10 keys
   (sorted order kept); `node scripts/check-tokens.mjs` exits 0.
7. Tests (below), the `PersonalInfoCard` nit, impl-log "Slice 6c", checks: `pnpm format:check`,
   `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 (ui → ui only; the only new import is `IconButton` from `../Button` in `MapItemEditor`), R3 none, R4 (Files
tables only), R5 (tests below). R2/R6/R7 not touched.

### Tests to write / update (slice 6c)
| Test (file › name) | Covers |
|---|---|
| `screen-tokens.test.ts` › `MIGRATED` gains 23 files: `ui/roomlayout/{RoomMap,RoomMapSection,SeatOverlay,ZoomControl,GestureOverlay,LayoutEditor,LayoutEditorPage,EditorToolbar,EditorInspector,EditorViews,EditorWarnings,EditorCanvas,ShortcutList,Palette,WalkLayer}.tsx`, `ui/mapItems/{MapItemsPage,MapItemsView,MapItemCard,MapItemEditor,MapItemEditorAppearance,MapItemEditorDetails,SpriteBrowser,FramePreview}.tsx`; the existing legacy / raw-type / low-target / palette / `opacity-60` / focus and "not pending" tests then cover them | R-a…R-c, R-h |
| screen-tokens › "kit Button only" list gains `ui/roomlayout/{ZoomControl,EditorToolbar,EditorViews}.tsx`, `ui/mapItems/{MapItemEditor,MapItemEditorAppearance,MapItemEditorDetails,SpriteBrowser}.tsx` | R-f |
| screen-tokens › new "map, editor and map items chrome": none of the 23 files matches `/--px-\|outline-none\|peer-focus\|rgba\(\|(?<![\w-])(?:bg\|text\|border\|ring\|outline)-(?:white\|black)(?![\w-])\|-(?:emerald\|teal\|amber)-\d/`; `Palette.tsx` contains `aria-pressed:border-pixel-primary`; `MapItemEditor.tsx` and `MapItemEditorDetails.tsx` contain `variant="pixel"`; `SpriteBrowser.tsx` contains `has-[:checked]:border-pixel-primary`, `outline-focus` and `bg-tile`; `MapItemEditorAppearance.tsx` contains `bg-tile` and `aria-checked:border-pixel-primary`; `LayoutEditor.tsx` contains `--spacing(72)` | R-i, Q4, R-c, focus rule |
| `tokens.test.ts` › the two new `TEXT_PAIRS` pass in both themes (existing `describe.each`) | AC 6 |
| `RoomMap.test.tsx` › 32–38: `border-outline-variant` → `border-divider` (name "status views use the divider token …"); new: `ZoomControl` pressed `<button` has `aria-pressed:border-text-primary`, no `font-extrabold` | R-a, R-b |
| `SeatOverlay.test.tsx` › 67–72: keep `hover:outline-2`, replace `focus-visible:outline-2` with `not.toMatch(/focus-visible:/)` and `hover:outline-surface` (name "… hover outline token; focus from the global ring"); 152 `bg-surface-container-high` → `bg-tile`; new: present tag has `bg-text-primary` and `text-surface`, its dot `bg-current`; markup has no `rgba(`, `text-white`, `emerald`, `teal`; open tag `<button` has `bg-pixel-primary`, `before:h-control`, `disabled:opacity-50` and no `opacity-60`. 189 (`bg-emerald-400` absent) unchanged | R-i, R-e, Q-S6c-2…4 |
| `LayoutEditorViews.test.tsx` › 299 `border-primary` → `border-text-primary`; 303 → `border-dashed border-danger`; 309 → `border-dashed border-text-primary`; new: gate view `<h2` has `text-body` and `font-semibold`, back link `<a` has `min-h-control` and `rounded-lg`; palette entry `<button` has `min-h-control`, `aria-pressed:border-pixel-primary`, no `opacity-`; inspector item rows have `min-h-control`, no `py-1.5`; place-panel inputs have `min-h-control` and `border-border-strong`; shortcut `<summary` has `py-3`. Existing count/aria asserts (190–196, 233–239) unchanged | R-f, R-i, R-e |
| `EditorWarnings.test.tsx` › new: box has `bg-warning-tint`, no `amber-` | palette rule |
| `MapItemCard.test.tsx` › 51–58: `opacity-60` → `opacity-50` (name unchanged) | Q-S6c-6 |
| `MapItemEditor.test.tsx` › new "tokens": `<h2 id="ed-title"` has `text-subtitle`; close `<button` has `size-control` (IconButton) and `aria-label`; Save `<button` has `data-variant="pixel"`; markup has no `min-h-11`, `text-[`, `font-extrabold`. Existing 31–84 unchanged | R-b, R-f, Q4 |
| `MapItemEditorAppearance.test.tsx` › new: each `role="radio"` `<button` has `data-variant="outlined"` and `min-h-control`, the checked one `aria-checked:border-pixel-primary`; preview box has `bg-tile`; no `opacity-40`, `rounded-md3`, `text-[`. `radios()` (46–59) and 156–171 unchanged | R-f, R-i |
| `MapItemEditorDetails.test.tsx` › new: legend has `text-label` and no `tracking-[`; checkbox inputs have `size-5`; confirming-reset render: the confirm `<button` has `data-variant="pixel"`. 83–86 unchanged | R-b, R-f |
| `SpriteBrowser.test.tsx` › new: tile `<label` has `bg-tile`, `has-[:checked]:border-pixel-primary`, `has-[:focus-visible]:outline-focus`; markup has no `peer-focus`, `text-[11px]`, `primary-container`. 46 unchanged | R-i, Q-S6c-3 |
| `scripts/check-tokens.test.ts` (unchanged) › repo ratchet green with 10 keys removed | pending only shrinks |

Existing asserts that keep passing unchanged: `RoomMapSection.test.tsx:36–37` (`fill` classes), 42–87; the rest of
`SeatOverlay.test.tsx` (labels, positions, zoom-stable classes, open-tag behaviour); `MapItemsView.test.tsx:79`
(`page-library`); `RoomMap.test.tsx:42–54`.

### Acceptance → verification (slice 6c)
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| S6c-1 | Room map, layout editor and Map items screens use token utilities only (R-a/R-c/R-i); legacy lines 131 → 0 | `screen-tokens.test.ts` green with the 23 files; `rg -n --pcre2 "on-surface\|outline-variant\|text-error\|-container\b\|surface-high\|rounded-md3\|text-\[\|tracking-\[\|shadow-\[\|bg-\[\|(?<![\w-])(text\|bg\|border\|ring\|outline)-primary(?![\w-])\|(amber\|emerald\|teal)-\d\|-white\b" src/ui/roomlayout src/ui/mapItems -g '*.tsx' -g '!*.test.tsx'` → no hits |
| S6c-2 | No off-scale type: page h1 Display, dialog title Subtitle, panel titles Body 600, labels 14, metadata 12; no 700/800 (Q7, Q8, Q16) | `rg -n "text-(xs\|sm\|base\|lg\|xl\|2xl)\b\|text-h[23]\|font-(bold\|extrabold\|heading)" <same paths>` → no hits; MapItemEditor, LayoutEditorViews tests |
| S6c-3 | Targets ≥ 44 px: Edit layout / back links, palette and inspector rows, number inputs, search, checkbox rows, sprite tiles, direction/source options, editor close, shortcut summary; the Move-here tag has a 44 px tall hit area (AC 3) | LayoutEditorViews, MapItemEditor, Appearance, Details, SpriteBrowser, SeatOverlay tests; `rg -n "min-h-11\|size-11\|py-1\.5\|py-1 text-left" <same paths>` → no hits |
| S6c-4 | Pixel green only in the layout palette (pressed bar), the Map items editor (Save, reset confirm, selected options, changed dot, selected sprite tile) and the check-in Move-here tag (Q4); sprite previews on `bg-tile` (R-i) | screen-tokens "map, editor and map items chrome"; `rg -n "pixel-" src/ui/roomlayout src/ui/mapItems -g '!*.test.tsx'` hits only `Palette.tsx`, `SeatOverlay.tsx:204`, `MapItemEditor.tsx`, `MapItemEditorAppearance.tsx`, `MapItemEditorDetails.tsx`, `SpriteBrowser.tsx` |
| S6c-5 | Focus visible without per-component or hard-coded colours: seat buttons, map frames, inputs and links use the global `--color-focus` ring; sprite tiles restate it with `outline-focus` | `rg -n "focus(-within\|-visible)?:\|outline-none" <same paths>` → no hits (`has-[:focus-visible]:` does not match); `rg -n "outline-focus" <same paths>` hits only `SpriteBrowser.tsx`; SeatOverlay, SpriteBrowser tests; manual Tab (Ming) |
| S6c-6 | No opacity dimming of text rows or options (R-e); the hidden-item art dim and the busy Move-here tag use the kit strength 50 | `rg -n "opacity-" <same paths>` hits only `MapItemCard.tsx:53` and `SeatOverlay.tsx:204`; MapItemCard, SeatOverlay, LayoutEditorViews tests |
| S6c-7 | AA in both themes on every new pair (name tags, pressed rows, warnings) | `tokens.test.ts` green, light and dark |
| S6c-8 | Map items editor dialog is the kit dialog (16 px corners, `shadow-dialog`, surface), same widths (580 px cap, 12 px side gap) | MapItemEditor test; read `MapItemEditor.tsx:332` |
| S6c-9 | Pending shrinks by exactly the 10 keys (83 → 32, 11 → 1 key) | `git diff main -- scripts/check-tokens.pending.json` shows 10 removed lines only; `node scripts/check-tokens.mjs` exits 0; screen-tokens pending test |
| S6c-10 | No behaviour, copy, prop, id, `role`, `data-*` or `aria-*` change (roving tab index and arrow keys in `Radios`, `aria-pressed`, `aria-keyshortcuts`, `data-map-seat`, `data-open-tag`, `data-testid`, dialog `onCancel`/scrim close, focus return, `fill` layout of 8b27bfa, inline geometry) | existing tests unchanged except the listed asserts; `git diff main -- src/ui/copy src/lib src/app src/ui/roomlayout/*.ts src/ui/mapItems/*.ts` empty except `src/lib/color/tokens.test.ts` |
| S6c-11 | Only planned files | `git diff --stat main` ⊆ Files tables |
| S6c-12 | Checks green; impl-log "Slice 6c" complete (legacy and pending before/after, build-output check of Approach 5, visible differences) | `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`; read impl-log |

### Visible differences to log (slice 6c)
- Room page and check-in map card: title 16 px · 800 → 16 px · 600; pan hint and notes 14 px; "Edit layout" pill
  (full radius, 13 px · 700) → 8 px-corner secondary button, 44 px tall (was about 36), 14 px · 500. Map frame border
  divider (same colour); the map frame's extra inner focus ring is gone, the standard green outline stays.
- Zoom buttons: the pressed level is ink-bordered and 600 (was 800).
- Map tags: hover/focus tags and present name tags navy 92 % → solid ink in light mode; **in dark mode they turn light
  with dark text** (Q-S6c-5); 2 px wider side padding, 4 px marker gap (was 6). Away and pre-presence tags: grey →
  tile. The present marker is a dot in the tag's text colour instead of emerald green (Q-S6c-4). Seat buttons: hover
  outline white (unchanged in light; dark-surface colour in dark), no teal ring on keyboard focus (the global green
  outline remains).
- "Move here" tag (check-in): ink pill, 700 → pixel-green pill with white 600 text and a soft shadow; same visible
  size; it now also reacts to taps up to 10 px above and below it; while busy it fades to 50 % (was 60 %).
- Layout editor: page title 32 px · 800 → 600; panel titles 16 px · 800 → 600, group titles 700 → 600; palette and
  item rows 13 → 14 px and 44 px tall (were about 28/32): the palette list (max 256 px) shows fewer rows before it
  scrolls; the pressed palette entry gets a 4 px pixel-green bar and a tile background (was ink text, 800); pressed
  inspector rows a tile background and 600; rows no longer fade when disabled. Number inputs 44 px tall, 8 px corners,
  stronger border. Drag/place ghosts and the selection outline keep ink; refused ghosts red (same hue, danger token).
  Warnings box amber → warning tint with a warning border. Shortcut keys on canvas grey, 12 px; "Keyboard shortcuts"
  summary 44 px tall. Gate and save-error views: back links as 44 px secondary buttons.
- Map items editor: dialog corners 20 → 16 px, background grey-tinted → white surface, the dialog shadow token; side
  gap at 390 px unchanged; title 20 px · 800 → 18 px · 600; eyebrow 11 px · 800 → 12 px · 600; close button round →
  8 px square-ish kit icon button (44 px, icon 20 → 22 px, a native tooltip). Save and "Reset to library defaults"
  confirm: ink → pixel green. Direction and source options: full-radius pills 700 with a coral fill when selected →
  8 px kit secondary buttons, selected = pixel-green border on tile, 600; changed dot ink → pixel green; disabled
  options 40 % → kit 50 %. Preview area: white → tile with 12 px corners; source badge grey → canvas, 12 px · 600.
  Sprite tiles: white → tile, selected = coral fill → pixel-green border + ring; focus ring green outline (was ink
  ring); key and size 11 → 12 px. Search 44 px with 8 px corners and a stronger border. Checkboxes 16 → 20 px. Field
  legends 11 px · 800 uppercase grey → 14 px · 500 ink (as the dialog fields). Warnings 13 → 14 px.
- Map items library: hidden items' art 60 % → 50 % opacity; the load error red text is the danger token (same colour).

### Ming verification after merge (slice 6c)
- A room page at 390 / 1024 / 1280 px, light and dark: map card, Edit layout button (admin), zoom buttons, hover and
  Tab across seats (focus outline visible on the map art, Q-S6c-3), the seat panel opens.
- Check-in with presence: present and away name tags in both themes (dark-mode light tags, Q-S6c-5; present dot vs
  away ring readable, Q-S6c-4); tap "Move here" on a phone and confirm it does not steal taps meant for a nearby
  seat (Q-S6c-2).
- Layout editor at 1280 px: arm a palette entry (green bar), place, select from the Items list, drag a desk (ghost
  visible), resize the room, open Keyboard shortcuts, trigger the no-door warning; save.
- Map items: open an item, switch direction and source with the arrow keys, pick a sprite tile with the keyboard
  (green outline), upload a PNG, change size (resize warning + checkbox), reset to defaults, discard changes; at 390 px
  the dialog fits with the same side gap.

### Assumptions and non-blocking questions (slice 6c)
- Hotspots: no other ticket is IN_PROGRESS/REVIEW/DONE (`work/backlog.md:161`: only SIM-071). `screen-tokens.test.ts`,
  `tokens.test.ts` and `scripts/check-tokens.pending.json` change again in slice 7; 6c merges first.
  `RoomMap.tsx`/`RoomMapSection.tsx` were last changed by 8b27bfa; the `fill` classes are kept byte for byte.
- `bg-current` resolves to `currentColor` (the tag's `text-surface`); `outline-focus`, `size-control`, `min-h-control`
  and `max-w-145` resolve through the existing theme (`globals.css:170`, `tokens.css:33`); the v4 `before:` variant adds
  `content: var(--tw-content)` itself, so no `before:content-['']` is needed.
- Approved defaults used: Q1, Q2, Q4 (pixel scope), Q5, Q6, Q7, Q8, Q15, Q16; Q-S6-11 (hand-built multi-part rows),
  Q-S6b-3 (focus restated on the label of an `sr-only` input), Q-S6b-4 (no opacity on disabled options).
- Q-S6c-1 (non-blocking). Size ≈ 490: **default one PR (6c), no 6d.** Alternative: roomlayout and mapItems as two PRs.
- Q-S6c-2 (non-blocking). The "Move here" tag is placed by `tag-layout.ts` at 22 px (`TAG_H`, `min-h-6` renders 24) among
  obstacles; a 44 px visible tag needs a `src/lib` layout change. **Default: visible tag unchanged, a 44 px tall
  invisible hit area via `before:`** (it may overlap a seat edge by 10 px; the tag sits above seats, z-30).
  Alternative: keep 24 px (meets WCAG 2.5.8 AA minimum, not the ticket's 44 px) and log the exception.
- Q-S6c-3 (non-blocking). Seat buttons and the map frames drop their own focus classes; the global 2 px
  `--color-focus` outline (already shown today, it wins over the layered utilities) stays. On light map art it may sit
  near 2.6:1 (e.g. on `#d9dee5`). **Default: global ring only (brief: focus ring 2 px `--color-focus`).** Alternative:
  keep a 2 px inner `ring-surface` on seat buttons with an exemption in the screen-tokens focus check.
- Q-S6c-4 (non-blocking). Present dot `bg-emerald-400` has no token that reaches 3:1 on the ink tag in both themes
  (`success` ≈ 2.2:1 light). **Default: `bg-current`** (the state stays a shape: filled dot vs ring, D80; the word is in
  the seat's `aria-label`). Alternative: present tags `bg-success-tint text-success` (green pill, AA pair tested).
- Q-S6c-5 (non-blocking). `bg-text-primary text-surface` follows the theme, so the tags turn light in dark mode (was
  navy in both). **Default: accept (same as the RoleBadge admin pattern).** Alternative: a new fixed-dark token in
  slice 7.
- Q-S6c-6 (non-blocking). Hidden item art (`aria-hidden`, next to the "Hidden" pill): **default `opacity-50` (kit
  disabled strength; R-e is about text)**. Alternative: no dim (the pill alone).
- Q-S6c-7 (non-blocking). The outline says "kit `Button variant="outlined" size="sm"`" for the Edit layout and back
  links, but they are `<Link>`s (navigation). **Default: keep `<Link>` with the "Secondary link button" string (same
  look, 44 px).** Alternative: `router.push` from a kit Button (loses link semantics).
- Q-S6c-8 (non-blocking). Palette and Inspector rows stay hand-built `<button>`s (full-width, left-aligned list rows
  with `aria-pressed`; the kit Button is centred and `whitespace-nowrap`). **Default: the "List option row" string,
  44 px, global focus ring, no opacity.** Same for the `SeatOverlay` seat and Move-here buttons (absolutely placed,
  inline size) and the `MapItemCard` pencil (unchanged).
- Q-S6c-9 (non-blocking). Room backdrops: no chrome paints one (`rg` above). **Default: no change in 6c**; the map
  scroll frame keeps the card surface behind a canvas narrower than the frame. Alternative: `bg-room-green` on the map
  frame (new visible change, not asked for).
- Q-S6c-10 (non-blocking). "Reset to library defaults" confirm: **default `variant="pixel"`** (the editor's primary
  style). Alternative: `variant="danger"` (it discards custom art).
- Q-S6c-11 (non-blocking). Editor dialog width: **default keep 100 % − 24 px and the 580 px cap** (`var(--space-6)`,
  `max-w-145`), not the kit's 100 % − 40 px; the `popin` animation takes the kit timing (150 ms ease-out, already
  cancelled by reduced motion, `globals.css:360–368`).
- Q-S6c-12 (non-blocking). Name tags: `px-2.5 gap-1.5` → `px-3 gap-1` makes the tag's inner budget 36 px against
  `TAG_PAD = 34` (`tag-layout.ts:7`); the 2 px fall inside the 12 px right padding. **Default: R-d snap, `src/lib`
  untouched.** Alternative: `px-2` (28 px, 4 px tighter pills).
- Q-S6c-13 (non-blocking). Editor drag/place ghosts and the selection outline: **default ink (R-a, as today)**, not
  pixel green (Q4 lists only the palette).
- Q-S6c-14 (non-blocking). Editor close button → kit `IconButton` (44 px, 8 px corners, `title` tooltip). **Default:
  yes (R-f).** Alternative: keep the hand-built round button with token classes.
- Q-S6c-15 (non-blocking). Two `TEXT_PAIRS` added (`text-primary` on `tile`, on `warning-tint`) instead of switching
  that text to `text-pixel` / `warning`. **Default: add the pairs** (both pass by a wide margin; the test proves it).
- Q-S6c-16 (non-blocking). Shortcut `<summary>`: **default `py-3`** (44 px, keeps the native disclosure marker that
  `display: flex` would remove).
- Q-S6c-17 (non-blocking). The 6b nit (`PersonalInfoCard.tsx:68` class order) is folded in: one class string, no
  visible change. **Default: yes.**

Status: READY
