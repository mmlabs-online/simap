# SIM-054: Move "My requests" into My Portal → My seat

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-045.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T08:28Z |
| PR | — |

## Goal
A member finds their seat requests only in My Portal → My seat: the sidebar loses its "My requests" entry, old links
still work, and the request-decision badge moves to My Portal (D74).

## Scope reference
`docs/spec-v1.md` REG-02, POR-01, POR-02, SHL-01, OQ-59 (amended); decision D74 (amends D24 and the OQ-59 default).

## Scope
- Remove the "My requests" nav entry (`/requests`) for every tier (desktop rail and mobile bar).
- `/requests` redirects client-side to `/portal?tab=seat`.
- My Portal badge = incoming transfers + my overdue devices + request decisions not yet seen.
- Opening the My seat tab (incl. landing on `/portal`) marks decisions seen through the existing mark-seen API; other tabs do not. Remove the old My requests page mark-seen path.

## Out of scope
- Approvals (Manager+) and its badge; any API change.

## Acceptance criteria
- [ ] No "My requests" nav link for User, Manager or Admin, on desktop or mobile.
- [ ] `/requests` lands on `/portal?tab=seat`.
- [ ] The My Portal badge sums incoming transfers, overdue devices and unseen request decisions correctly.
- [ ] Opening My seat clears the decision count; My devices and Profile do not.
- [ ] The Approvals badge is unchanged.
- [ ] Unit tests cover the badge sum and the mark-seen-on-tab rule; nav tests updated.

## Technical notes
- Files: `src/lib/nav.ts` (+ tests), `src/ui/AppShell.tsx`, `src/ui/AppShellView.test.tsx`, `src/app/(app)/requests/page.tsx`, `src/ui/requests/MyRequestsPage.tsx`, `src/ui/portal/**`, `src/ui/copy/shell.ts`.
- Risk: overlaps SIM-053 (My Portal polish) files; do not run both at once.

## Test plan
- Unit: badge sum, mark-seen rule, nav per tier.
- Manual: as a User, get a request decided, see the My Portal badge, open My seat, badge clears.

## Notes / answers from Ming
- 2026-11-26 Ming: spec D74 accepted; create and run ("2").

## Handoff
