# SIM-044: Restrict User device visibility and add a "my devices" API

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/119 |

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
- The My Portal page (SIM-045).
- Changes to device actions themselves (move, transfer, return, extension).

## Acceptance criteria
- [ ] For a User, `GET /api/devices` returns only devices they hold; Manager and Admin still get the full org list.
- [ ] For a User, detail and history of a device they do not hold answer 404 (same as an id from another org, SYS-01);
  no 403 is returned after any side effect (R7).
- [ ] For a User, search (DSH-02) returns only devices they hold.
- [ ] The "my devices" endpoint returns the caller's held devices for every tier, paged and org-scoped, with the fields
  listed in DEV-12.
- [ ] *(moved to SIM-044.1, plan Q9)* Seat, member and layout responses for a User carry no id, name, inventory number, MAC or owner of devices they
  do not hold (per the OQ-55 / OQ-58 answer).
- [ ] *(moved to SIM-045, plan Q1)* The Devices nav entry is hidden for Users; Manager+ keep it.
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
- Plan approved (2026-11-26), Ming: "duyệt plan SIM-044, dùng mặc định" — every default in plan.md "Questions for Ming at approval": Q1 nav hide + /devices redirect move to SIM-045; Q2 /devices/[id] stays for held devices; Q3 404 for a device not held (incl. pending recipient, org inventory); Q4 former holder loses detail/history; Q5 OQ-55 spec default; Q6 OQ-58 spec default, other members' email → follow-up; Q7 OQ-60 no change; Q8 `GET /api/devices/mine` with full DeviceDto; Q9 slice A here, slice B = SIM-044.1; Q10 write-action existence oracle → follow-up; Q11 badge stays with SIM-045.

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 9 (api-platform-engineer×1 47k, software-architect×1 78k, planner×1 138k, implementer×2 88k+22k, reviewer×2 71k+31k, security-ai-generated-code-auditor×2 68k+39k; all default models)
- Done: slice A — User device visibility in list/detail/history/search (404 = cross-org), `GET /api/devices/mine`; review REWORK attempt 1 (two DB-test mistakes), PASS attempt 2 with test:db 307/307 on a local Postgres; security PASS both attempts. PR #119.
- In progress / next: Ming merges PR #119; then SIM-044.1 (slice B) and SIM-045 (My Portal + nav hide).
- Gotchas: run local Postgres with the data dir outside /tmp/claude-0 (it gets reset to 700 and the server PANICs at teardown).
