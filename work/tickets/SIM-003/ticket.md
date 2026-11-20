# SIM-003: App shell and UI kit ported from seatMGT

| Field | Value |
|---|---|
| State | REWORK |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-001 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T04:52Z |
| PR | — |

## Goal
Give simap seatMGT's look: the UI kit and an app shell with role-aware navigation, light/dark theme and Vietnamese
copy, so feature tickets only add page content.

## Scope reference
- `docs/spec-v1.md` §6 SHL-01 (shell, role-aware nav, org name/switcher slot), SHL-02 (theme), "Visual style",
  §8 Non-functional (Language, Accessibility, Browsers), SYS-01 (UI hides what the role cannot use).
- `work/decisions.md` D1, D2 (Tailwind v4), D4 (pages that show org data render on the client), D5 (org in the shell).

## Scope
- Port seatMGT (`ming_dev`) UI kit to `src/ui/`: Card, Button, Chip, Avatar, RoleBadge, FilledInput, EntityFormDialog,
  Icon, plus its fonts, colour tokens and `globals.css` theme; Tailwind v4.
- App shell: nav rail on desktop, bottom bar on mobile; slots for org name + switcher, avatar + role badge,
  "refresh permissions" and sign-out (wired by the auth ticket).
- Route skeletons with Vietnamese titles and empty states: Dashboard, Rooms, Room detail, Room editor, Members,
  Devices, Approvals.
- Nav visibility from the tier: a pure function `navItemsFor(tier)` (Approvals Manager+, editor Admin only).
- The shell reads the user through a typed session interface (`{ tier, email, orgName } | null`) provided by a
  context; until the auth ticket lands the shipped app shows the signed-out state. No mock data in the shipped build
  (spec §7 "Not carried over").
- Light/dark toggle kept on the device (SHL-02).
- Central Vietnamese copy file for shell strings.

## Out of scope
- Identity sign-in, token handling, org picker logic (auth ticket). Any data fetching or domain page content.
- seatmap / roomlayout components (their feature tickets). Legacy editors (spec §7).

## Acceptance criteria
- [ ] UI kit components render in light and dark theme with seatMGT's look; copy is Vietnamese with correct diacritics.
- [ ] At ≥ 1024 px the shell shows a nav rail; at 390 px a bottom bar; every nav entry is reachable by keyboard.
- [ ] `navItemsFor("user")` hides Approvals and the editor; `"manager"` shows Approvals; `"admin"` shows all
  (unit test).
- [ ] The theme choice survives a reload and does not flash the wrong theme on load.
- [ ] No component under `src/ui/` imports server modules (R1), and no mock data file ships.

## Technical notes
- Files: `src/ui/**`, `src/app/(app)/layout.tsx`, `src/app/(app)/**/page.tsx` skeletons, `src/app/globals.css`,
  `src/ui/copy/*.ts`.
- References: seatMGT `ming_dev` `src/components/ui/*`, `src/components/shell/AppShell.tsx`, `src/app/globals.css`,
  `src/app/layout.tsx`, `src/lib/icons.ts`.
- Risks: seatMGT `AppShell` reads the global `AppStore` (not carried over); replace with the session context.

## Test plan
- Unit: `navItemsFor` per tier; theme preference read/write helper.
- Manual: 390 px and desktop, light and dark, keyboard tab through the nav.

## Notes / answers from Ming
—

## Handoff
