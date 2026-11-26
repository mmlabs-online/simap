# SIM-042: Restrict User device visibility and add a "my devices" API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
A User's API calls return only the devices they hold, and every tier gets a "my devices" endpoint for its own list,
so device data of other members stays private (Ming, 2026-11-26).

## Scope reference
`docs/spec-v1.md` DEV-12 (new), §2 roles table (User line), DEV-02, DEV-08, DEV-11, DSH-01, DSH-02, MEM-02, SEA-05,
LAY-06, SHL-01; decisions D69, D70. Open questions with proposed defaults: OQ-55 (devices at seats for Users), OQ-58
(members list for Users), OQ-59 (nav badge), OQ-60 (dashboard device counts).

## Scope
- `GET /api/devices`, `/api/devices/[id]`, `/api/devices/[id]/history` and device search results restricted for the
  User tier to devices whose owner is the caller's member.
- New paged "my devices" endpoint for every tier (name, type, inventory number, placement, expiry/overdue, pending
  handoff), scoped by `org` (R6).
- Member overview, seat detail and room layout device fields limited for Users per MEM-02, SEA-05, LAY-06 (OQ-55,
  OQ-58 defaults unless Ming answers otherwise at the plan gate).
- Hide the Devices nav entry and page for Users (the page redirects; the API is the real guard).

## Out of scope
- The My Portal page (SIM-043).
- Changes to device actions themselves (move, transfer, return, extension).

## Acceptance criteria
- [ ] For a User, `GET /api/devices` returns only devices they hold; Manager and Admin still get the full org list.
- [ ] For a User, detail and history of a device they do not hold answer 404 (same as an id from another org, SYS-01);
  no 403 is returned after any side effect (R7).
- [ ] For a User, search (DSH-02) returns only devices they hold.
- [ ] The "my devices" endpoint returns the caller's held devices for every tier, paged and org-scoped, with the fields
  listed in DEV-12.
- [ ] Seat, member and layout responses for a User carry no id, name, inventory number, MAC or owner of devices they
  do not hold (per the OQ-55 / OQ-58 answer).
- [ ] The Devices nav entry is hidden for Users; Manager+ keep it.
- [ ] Unit tests cover the visibility rule per tier for list, detail, history, search and the new endpoint.

## Technical notes
- Files: `src/app/api/devices/**`, `src/server/devices/**`, `src/server/search/**`, `src/server/members/**`,
  `src/server/seats/**`, `src/server/layout/**`, `src/ui/AppShellView.tsx`, `src/app/(app)/devices/**`, `src/lib/devices/**`.
- Risks / open questions: P1, so the plan needs Ming's approval. Becomes High if `src/server/http/**` changes. Confirm
  the spec choices "404 for a device not held" and "a former holder loses access".

## Test plan
- Unit: server device list/detail/history/search per tier; new endpoint (paging, scope, empty); route tests.
- Manual: sign in as User and Manager; compare the Devices page, search and a seat panel.

## Notes / answers from Ming

## Handoff
