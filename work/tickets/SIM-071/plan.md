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
