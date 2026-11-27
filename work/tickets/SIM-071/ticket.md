# SIM-071: Restyle the whole app to the Simap design tokens

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | L |
| Areas | ui, ux, architecture |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-27 |
| Claimed by | |
| PR | slice 1: https://github.com/mmlabs-online/simap/pull/154 (merged); slice 2: https://github.com/mmlabs-online/simap/pull/155 (merged); slice 3: https://github.com/mmlabs-online/simap/pull/158 (merged); slice 4: https://github.com/mmlabs-online/simap/pull/160 (merged); slice 5a: https://github.com/mmlabs-online/simap/pull/161 (merged); slice 5b: https://github.com/mmlabs-online/simap/pull/163 (merged); slice 5c: https://github.com/mmlabs-online/simap/pull/164 (merged); slice 6a: https://github.com/mmlabs-online/simap/pull/165 (merged); slice 6b: https://github.com/mmlabs-online/simap/pull/166 |

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

### 2026-11-27 — claude — IN_PROGRESS (slice 3 PR open)
- Agent calls: 5 (planner×1 138k addendum, implementer×2 70k+31k, reviewer×2 63k + sonnet 20k)
- Done: slice 3 (UI kit) implemented; REWORK on attempt 1 (DecisionDialog regex always passed; kit disabled test too weak); PASS on attempt 2; PR #158.
- In progress / next: Ming merges #158; then `/run SIM-071` for slice 4 (216 px sidebar).
- Gotchas: Attempts now 1 (one rework used on this ticket).

### 2026-11-27 — claude — IN_PROGRESS (slice 4 PR open)
- Agent calls: 3 (planner×1 129k addendum, implementer×1 55k, reviewer×1 54k)
- Done: slice 4 (shell, 216 px sidebar, page containers) implemented, review PASS attempt 1, PR #160.
- In progress / next: Ming merges #160; then `/run SIM-071` for slice 5 (management screens).
- Gotchas: width table is computed, not measured; one rework left on this ticket.

### 2026-11-27 — claude — IN_PROGRESS (slice 5a PR open)
- Agent calls: 3 (planner×1 183k addendum, implementer×1 76k, reviewer×1 78k)
- Done: slice 5 split into 5a/5b/5c; 5a (members, invitations, groups, approvals, audit, org, credits) implemented, review PASS attempt 1, PR #161; pending 261 → 244.
- In progress / next: Ming merges #161; then `/run SIM-071` for 5b (devices, device types) — needs a short addendum first.
- Gotchas: one rework left on this ticket.

### 2026-11-27 — claude — IN_PROGRESS (slice 5b PR open)
- Agent calls: 3 (planner×1 154k slice 5b addendum, implementer×1 95k, reviewer×1 86k)
- Done: slice 5b (Devices + Device types, 26 screen files, 16 files off the pending list) PASS on the first try; PR https://github.com/mmlabs-online/simap/pull/163.
- In progress / next: after Ming merges #163, `/run SIM-071` → slice 5c (Dashboard, Search, Rooms, room-detail chrome; needs an addendum), then slice 6 and slice 7.
- Gotchas: Ming should check the DeskSlotDiagram fill in a browser (the old class had no theme key). 1 rework left on the ticket.

### 2026-11-27 — claude — IN_PROGRESS (slice 5c PR open)
- Agent calls: 3 (planner×1 151k slice 5c addendum, implementer×1 81k, reviewer×1 79k)
- Done: slice 5c (Dashboard, Search, Rooms, seat chrome; 8 pending keys removed, 183 → 142) passed review on attempt 1. PR https://github.com/mmlabs-online/simap/pull/164.
- In progress / next: after Ming merges #164, run `/run SIM-071` for slice 6 (end-user/pixel surfaces; needs an addendum), then slice 7.
- Gotchas: Q-S5c-1..5 took their defaults. The seat panel and member picker changes also show in check-in and in the device dialogs. 1 rework left on the ticket.

### 2026-11-27 — claude — IN_PROGRESS (slice 6a PR open)
- Agent calls: 4 (planner×1 225k slice 6 addendum, implementer×1 86k, reviewer×1 92k, security-ai-generated-code-auditor×1 57k)
- Done: slice 6 is split into 6a/6b/6c. Slice 6a (auth, check-in, globals `.aw-*`/`.px-*`, world-palette test moved to tokens.test) passed review on attempt 1 (security: no 🔴/🟡). Pending 142 → 93. PR https://github.com/mmlabs-online/simap/pull/165.
- In progress / next: after Ming merges #165, run `/run SIM-071` for 6b (portal; the outline is in plan.md, it needs the full addendum), then 6c, then slice 7.
- Gotchas: Q-S6-1..16 took their defaults (see Q-S6-4/5/10 in the PR). Follow-up: possible Turnstile clipping at ≤380 px (from SIM-068). 1 rework left on the ticket.

### 2026-11-27 — claude — IN_PROGRESS (slice 6b PR open)
- Agent calls: 3 (planner×1 144k slice 6b addendum, implementer×1 77k, reviewer×1 78k)
- Done: slice 6b (portal, 16 screen files, pending 93 → 83) passed review on attempt 1. PR https://github.com/mmlabs-online/simap/pull/166.
- In progress / next: after Ming merges #166, run `/run SIM-071` for 6c (roomlayout chrome + mapItems; the outline is in plan.md and needs a full addendum), then slice 7.
- Gotchas: Q-S6b-1..7 took their defaults. 1 rework left on the ticket.
