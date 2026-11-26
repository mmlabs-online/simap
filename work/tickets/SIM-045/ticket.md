# SIM-045: My Portal part 1: My seat, My devices, display name

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-044 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
Every member has one page, My Portal, with three horizontal tabs showing their own seat, the devices they hold and
their profile, so a User no longer needs the org Devices page.

## Scope reference
`docs/spec-v1.md` POR-01 to POR-04, SHL-01; decision D70. Open questions with proposed defaults: OQ-54 (home page:
Dashboard stays home, My Portal is a nav entry), OQ-59 (badge moves to My Portal for Users).

## Scope
- New page `/portal` (name per plan) with tabs My seat, My devices, Profile, addressable by `?tab=`.
- My seat: occupied seats, "View on map", my requests with cancel, release seat, empty state.
- My devices: list from the "my devices" endpoint, existing owner actions, "Waiting for my confirmation", overdue banner.
- Profile: display name edit (existing API), email and role read-only "managed in mmlabs".
- Nav entry for every tier and the badge per OQ-59. Copy in `src/ui/copy/portal.ts` (D36).

## Out of scope
- Profile photo (SIM-046) and pixel character (SIM-047).
- New APIs or migrations (reuse SIM-044 and existing endpoints).

## Acceptance criteria
- [ ] My Portal is in the nav for every tier; three horizontal, keyboard-operable tabs, addressable by URL, default
  My seat; works at 390 px.
- [ ] My seat lists the member's seats with "View on map" (opens `/rooms/<code>` with the seat selected), their requests
  with cancel for pending ones, release seat after confirmation, and an empty state linking to Rooms.
- [ ] My devices lists held devices with placement, expiry and Overdue, offers only the actions the rules allow, and
  shows "Waiting for my confirmation" with Confirm / Decline.
- [ ] Profile edits the display name with the existing validation; email and role are read-only.
- [ ] Only the caller's own data shows; a deactivated member gets the same refusal as other org pages.
- [ ] The Devices nav entry is hidden for Users (`src/lib/nav.ts` minTier manager) and `/devices` redirects Users to My Portal client-side; `/devices/[id]` stays reachable for devices they hold (moved from SIM-044, plan Q1/Q2).
- [ ] Unit tests for the tab state / URL parsing and the per-device action rules.

## Technical notes
- Files: `src/app/(app)/portal/page.tsx`, `src/ui/portal/**`, `src/ui/copy/portal.ts`, `src/ui/AppShellView.tsx`,
  reuse `src/ui/devices/**`, `src/ui/requests/**`, `src/ui/seats/**`, `src/ui/org/profile-form.ts`.
- Risks / open questions: size may grow past M; if so the planner proposes SIM-043.1 / .2 (e.g. My devices separate).

## Test plan
- Unit: tab parsing, action visibility rules, badge count.
- Manual: User and Manager at desktop and 390 px; each action from My devices.

## Notes / answers from Ming

## Handoff
