# SIM-071: Restyle the whole app to the Simap design tokens

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | L |
| Areas | ui, ux, architecture |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-27 |
| Claimed by | claude@2026-11-27T07:41:33Z |
| PR | slice 1: https://github.com/mmlabs-online/simap/pull/154 (merged); slice 2: https://github.com/mmlabs-online/simap/pull/155 (merged) |

## Goal
Every screen of simap uses one set of design tokens (colours, type, spacing, radius, elevation, layout, motion) from
Ming's brief (`brief.md` in this folder), with no feature, route, data or copy change, and better accessibility
(44 px targets, visible focus, text labels for status, reduced motion).

## Scope reference
`brief.md` (Ming, 2026-11-27) and decision D87; D52 (pixel style only on end-user surfaces, clean kit elsewhere),
D85 (sign-in `--aw-*` palette), D41/D46/D48 (pixel art rules), D36 (copy). Amends D46's UI-shell colours (teal/blue →
workspace coral) via D87.

## Scope
- **Tokens:** one global `src/styles/tokens.css` (all brief tokens, light values) imported at the app root, plus
  derived **dark** values for every colour token (AA contrast) under the existing `[data-theme="dark"]`. Tailwind is
  v4 (CSS-first): map the tokens in the `@theme` block in `globals.css` (the v4 equivalent of `theme.extend`) so
  utilities like `bg-canvas`, `text-primary`, `rounded-lg`, `p-4` resolve to the variables.
- **Migration of existing tokens:** today's MD3-style tokens (`--primary`, `--surface-low`, …) and the sign-in
  `--aw-*` tokens are either re-pointed to the new tokens or replaced; no component keeps a hard-coded hex, px
  radius, shadow or font stack.
- **Fonts:** DM Sans (via `next/font`, self-hosted at build, no CSP change) replaces Manrope everywhere; Fraunces stays
  for the sign-in headline (Ming); Material Symbols icons unchanged.
- **Components:** UI kit (Button primary/secondary/disabled, inputs/selects/radios/checkboxes, cards, dialogs,
  chips/pills/badges with text labels, focus ring 2 px `--color-focus` with offset, 44 px targets, transitions at
  `--duration-ui`) per the brief's component mapping.
- **Screens:** all screens (shell and sidebar, portal, rooms and room map chrome, devices, members, approvals,
  dashboard, search, audit, admin pages, sign-in and other `AuthLayout` screens), keeping layout and IA; snap
  spacing/radius/type to the scale only where needed.
- **Motion:** reduced motion disables animations, including walking/idle characters.
- **Deliverables:** changelog (files changed and every visible difference forced by the scale), a grep showing no
  leftover hard-coded hex colours or off-scale px values, and the self-check list from the brief.

## Out of scope
- Features, routes, data models, copy, business logic; pixel art and sprites (they keep square edges and their own
  palette; only UI chrome around them changes); new dependencies other than DM Sans.

## Acceptance criteria
- [ ] `src/styles/tokens.css` defines every brief token once (light) plus a dark value for each colour token; Tailwind
  `@theme` maps them; no component file contains a hard-coded hex colour, px radius, box-shadow or font stack (grep
  check in a test or script).
- [ ] Workspace primary actions use coral (`--color-workspace-primary`/hover); pixel-library actions use pixel green;
  secondary, disabled, inputs, cards, dialogs and badges follow the brief's component mapping.
- [ ] Interactive targets are at least 44×44 px; body and control labels at least 14 px; metadata 12 px; every status
  has a text label; focus ring is visible on every interactive element.
- [ ] `prefers-reduced-motion: reduce` disables every animation (CSS and canvas-driven character motion).
- [ ] DM Sans is the app font; Fraunces remains only for the sign-in headline; no other new dependency.
- [ ] Light and dark text/background pairs pass WCAG AA; layout checked at 390 / 800 / 1024 / 1280 px; existing tests
  pass (updated only for markup/classes); changelog delivered in `impl-log.md`.

## Technical notes
- Tailwind v4: no `tailwind.config` `theme.extend`; use `@theme` (already `@theme inline` in `globals.css`).
- The brief's breakpoints (md 800 / lg 1024 / xl 1280) differ from Tailwind's default `md` (768): changing `md`
  moves every `md:` utility — the planner must decide and list affected screens.
- Size L: the planner slices this into ordered steps/PRs (e.g. tokens+fonts → UI kit → shell and management screens →
  end-user pixel surfaces → grep audit) under this one ticket (Ming: one ticket).
- Open questions (planner proposes defaults, Ming confirms at the plan gate):
  1. Which features count as "pixel library" (pixel green)? Default proposal: the Map items library and layout
     editor palette, the pixel character picker, and the sign-in/check-in game buttons (`--shadow-pixel`); everything
     else uses workspace coral.
  2. Sidebar width 216 px from 800 px: confirm it replaces today's nav rail sizing and breakpoint.
  3. Dark values: derived by the planner and listed for approval.

## Test plan
- Unit/render: kit components (classes/tokens, 44 px, focus, disabled), token file presence, grep test for hex/px.
- Manual: every screen at 390 / 800 / 1024 / 1280 px, light and dark, keyboard focus, reduced motion.

## Notes / answers from Ming
- 2026-11-27: brief given (`brief.md`). Answers: one ticket (planner slices); keep dark mode with derived values;
  DM Sans everywhere, keep Fraunces for the sign-in headline.

- Plan approved (2026-11-27): Ming "duyệt SIM-071, theo mặc định hết" — all 7 slices and defaults Q1–Q17.

## Handoff

### 2026-11-27 — claude — BLOCKED
- Agent calls: 3 (frontend-developer×1 50k, ux-architect×1 47k, planner×1 113k; default models)
- Done: consults; plan READY with 7 slices (slice 1 fully specified: tokens.css + compatibility layer + DM Sans + md 800 + focus ring + reduced motion + contrast tests); plan gate; M-95 added.
- In progress / next: Ming answers Q1–Q17 (or accepts defaults) → implement slice 1.
- Gotchas: white on coral fails AA (Q1); brief and AC conflict until Ming decides.

### 2026-11-27 — claude — IN_PROGRESS (slice 1 PR open)
- Agent calls: 2 (implementer×1 70k, reviewer×1 64k; default models)
- Done: slice 1 (tokens foundation) implemented, review PASS attempt 1, PR #154.
- In progress / next: Ming merges #154; then `/run SIM-071` for slice 2 (token guard).
- Gotchas: border-strong #889282 (plan value failed 3:1); DM Sans has no vietnamese subset.

### 2026-11-27 — claude — IN_PROGRESS (slice 2 PR open)
- Agent calls: 3 (planner×1 sonnet 45k addendum, implementer×1 42k, reviewer×1 sonnet 39k)
- Done: slice 2 (token guard, 65 files / 373 violations pending) implemented, review PASS attempt 1, PR #155.
- In progress / next: Ming merges #155; then `/run SIM-071` for slice 3 (UI kit).
- Gotchas: slice 7 must read the pending file tolerantly; hex rule widened (accepted).
