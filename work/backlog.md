# Backlog

States: BACKLOG → PLANNING → IN_PROGRESS → REVIEW → DONE → MERGED · plus REWORK, BLOCKED, ESCALATED.
**Row order is run order.** `/run` with no ID picks the first runnable row: every `Depends on` ticket is `MERGED`,
every `Needs Ming` item is ticked in `work/ming-todo.md`, and nobody holds a claim (S1 bugs first).
Gate `plan-approval` = the loop stops after PLAN until Ming approves (see `.claude/loop.config.md`).
This board is changed only on `main`; each ticket's `ticket.md` is the source of truth for its state.

| ID | Title | State | Priority | Size | Areas | Depends on | Gate | Attempts | Updated |
|---|---|---|---|---|---|---|---|---|---|
| SIM-001 | Scaffold the Next.js app, tooling and CI | MERGED | P0 | M | architecture, security | — | plan-approval | 1 | 2026-11-20 |
| SIM-002 | Database client, tudocuatui migrator and readiness | MERGED | P0 | M | db, security | SIM-001 | plan-approval | 0 | 2026-11-20 |
| SIM-003 | App shell and UI kit ported from seatMGT | DONE | P1 | M | ui, ux | SIM-001 | none | 1 | 2026-11-20 |
| SIM-022 | Switch UI copy to English by default | BACKLOG | P1 | S | ui | SIM-003 | none | 0 | 2026-11-20 |
| SIM-004 | Production image and tudocuatui-style deploy | DONE | P1 | M | architecture, security | SIM-002 | plan-approval | 0 | 2026-11-20 |
| SIM-005 | Verify Identity tokens on the server and guard /api routes | DONE | P0 | M | security, api, architecture | SIM-001 | plan-approval | 0 | 2026-11-20 |
| SIM-008 | v1 database schema | DONE | P0 | M | db, security | SIM-002 | plan-approval | 0 | 2026-11-20 |
| SIM-006 | Browser sign-in with mmlabs Identity | BACKLOG | P0 | M | security, ui | SIM-003, SIM-005 | plan-approval | 0 | 2026-11-20 |
| SIM-007 | Org picker, org switcher and first-visit member profile | BACKLOG | P0 | M | api, ui, security | SIM-006, SIM-008 | none | 0 | 2026-11-20 |
| SIM-009 | Invite people to an org | BACKLOG | P1 | M | security, ui, api | SIM-007 | none | 0 | 2026-11-20 |
| SIM-010 | Rooms: CRUD, seat codes and room list | BACKLOG | P1 | M | api, ui, db | SIM-003, SIM-005, SIM-008 | none | 0 | 2026-11-20 |
| SIM-015.1 | Room layout API and read-only room view | BACKLOG | P1 | M | api, ui | SIM-010 | none | 0 | 2026-11-20 |
| SIM-011 | Members page, profile fields and deactivation | BACKLOG | P1 | M | api, ui, security | SIM-007 | none | 0 | 2026-11-20 |
| SIM-015.2 | Free-form layout editor | BACKLOG | P1 | M | ui, ux | SIM-015.1 | none | 0 | 2026-11-20 |
| SIM-012 | Seat detail and occupancy | BACKLOG | P1 | M | api, ui | SIM-010, SIM-011 | none | 0 | 2026-11-20 |
| SIM-019 | Audit-log screen for org admins | BACKLOG | P2 | S | api, ui | SIM-010 | none | 0 | 2026-11-20 |
| SIM-013 | Devices | BACKLOG | P1 | M | api, ui | SIM-012 | none | 0 | 2026-11-20 |
| SIM-014 | Seat requests and approvals | BACKLOG | P1 | M | api, ui, ux | SIM-012 | none | 0 | 2026-11-20 |
| SIM-016 | Groups, projects and seat tags | BACKLOG | P2 | S | api, ui | SIM-012 | none | 0 | 2026-11-20 |
| SIM-017 | Dashboard and search | BACKLOG | P2 | M | api, ui | SIM-013, SIM-014 | none | 0 | 2026-11-20 |
| SIM-018 | CSV export and layout image export | BACKLOG | P2 | S | api, ui | SIM-017, SIM-015.2 | none | 0 | 2026-11-20 |
| SIM-021 | Go-live checklist and first production deploy | BACKLOG | P1 | S | architecture, security | SIM-004, SIM-009, SIM-015.2, SIM-016, SIM-017, SIM-018, SIM-019 | none | 0 | 2026-11-20 |
| SIM-020 | Sync members from Identity and remove from org | BACKLOG | P3 | M | api, security | SIM-011 | plan-approval | 0 | 2026-11-20 |
