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
| SIM-003 | App shell and UI kit ported from seatMGT | MERGED | P1 | M | ui, ux | SIM-001 | none | 1 | 2026-11-20 |
| SIM-004 | Production image and tudocuatui-style deploy | MERGED | P1 | M | architecture, security | SIM-002 | plan-approval | 0 | 2026-11-20 |
| SIM-005 | Verify Identity tokens on the server and guard /api routes | MERGED | P0 | M | security, api, architecture | SIM-001 | plan-approval | 0 | 2026-11-20 |
| SIM-008 | v1 database schema | MERGED | P0 | M | db, security | SIM-002 | plan-approval | 0 | 2026-11-20 |
| SIM-023 | Harden org scope, guarded-routes test and dev-seed guard | MERGED | P0 | S | security | SIM-005, SIM-008 | plan-approval | 0 | 2026-11-20 |
| SIM-022 | Switch UI copy to English by default | MERGED | P1 | S | ui | SIM-003 | none | 1 | 2026-11-20 |
| SIM-006 | Browser sign-in with mmlabs Identity | MERGED | P0 | M | security, ui | SIM-003, SIM-005 | plan-approval | 0 | 2026-11-20 |
| SIM-010 | Rooms: CRUD, seat codes and room list | MERGED | P1 | M | api, ui, db | SIM-003, SIM-005, SIM-008 | none | 0 | 2026-11-20 |
| SIM-025 | Fix rooms API security findings (streamed body cap, delete lock order) | MERGED | P1 | S | security, api | SIM-010 | none | 0 | 2026-11-20 |
| SIM-026 | Run service SQL against Postgres in CI (DB integration tests) | MERGED | P1 | M | db, security | SIM-010 | none | 0 | 2026-11-20 |
| SIM-006.2 | Sign-in gate UI (AuthGate, sign-in screen, /sign-in) | MERGED | P0 | M | security, ui | SIM-006, SIM-022 | none | 0 | 2026-11-20 |
| SIM-010.2 | Rooms page UI: cards, occupancy ring, create/edit/delete dialogs | MERGED | P1 | M | ui | SIM-010, SIM-006.2, SIM-022 | none | 0 | 2026-11-20 |
| SIM-006.3 | Account pages: sign-up, verify email, forgot and reset password | MERGED | P1 | M | security, ui | SIM-006.2 | none | 0 | 2026-11-20 |
| SIM-007 | Org picker, org switcher and first-visit member profile | MERGED | P0 | M | api, ui, security | SIM-006.2, SIM-008 | plan-approval | 1 | 2026-11-20 |
| SIM-007.2 | Org entry: org list, picker, switcher and org_access_denied | MERGED | P0 | M | ui, security | SIM-006.2, SIM-006.3 | none | 0 | 2026-11-20 |
| SIM-007.3 | First-visit profile screen | MERGED | P0 | S | ui | SIM-007, SIM-007.2 | none | 0 | 2026-11-20 |
| SIM-028 | Signed-in local dev with a server-side dev token | BACKLOG | P1 | M | architecture, ui, security | SIM-006.2, SIM-007.2 | plan-approval | 0 | 2026-11-21 |
| SIM-029 | Guard dev scripts against the production DB and add dev:prod | BACKLOG | P1 | S | db, security | SIM-028 | none | 0 | 2026-11-21 |
| SIM-009 | Invite people to an org | BACKLOG | P1 | M | security, ui, api | SIM-007 | none | 0 | 2026-11-20 |
| SIM-011 | Members page, profile fields and deactivation | BACKLOG | P1 | M | api, ui, security | SIM-007 | none | 0 | 2026-11-20 |
| SIM-012 | Seat list, add/delete seats, seat detail and occupancy | BACKLOG | P1 | L | api, ui | SIM-010, SIM-011 | none | 0 | 2026-11-20 |
| SIM-013 | Devices | BACKLOG | P1 | M | api, ui | SIM-012 | none | 0 | 2026-11-20 |
| SIM-014 | Seat requests and approvals | BACKLOG | P1 | M | api, ui, ux | SIM-012 | none | 0 | 2026-11-20 |
| SIM-016 | Groups, projects and seat tags | BACKLOG | P2 | S | api, ui | SIM-012 | none | 0 | 2026-11-20 |
| SIM-019 | Audit-log screen for org admins | MERGED | P2 | S | api, ui | SIM-010 | none | 0 | 2026-11-20 |
| SIM-019.2 | Audit-log page UI for org admins | IN_PROGRESS | P2 | S | ui | SIM-019, SIM-006.2, SIM-022 | none | 0 | 2026-11-20 |
| SIM-017 | Dashboard and search | BACKLOG | P2 | M | api, ui | SIM-013, SIM-014 | none | 0 | 2026-11-20 |
| SIM-018 | CSV export | BACKLOG | P2 | S | api, ui | SIM-017 | none | 0 | 2026-11-20 |
| SIM-027 | Security headers, CSP and apiFetch hardening before go-live | IN_PROGRESS | P1 | M | security, architecture | SIM-006.2 | plan-approval | 0 | 2026-11-20 |
| SIM-021 | Go-live checklist and first production deploy | BACKLOG | P1 | S | architecture, security | SIM-004, SIM-009, SIM-015.2, SIM-016, SIM-017, SIM-018, SIM-019.2, SIM-027 | none | 0 | 2026-11-20 |
| SIM-020 | Sync members from Identity and remove from org | BACKLOG | P3 | M | api, security | SIM-011 | plan-approval | 0 | 2026-11-20 |
| SIM-024 | Sprite atlas, manifest, placeholder art and map renderer | MERGED | P1 | M | ui, architecture | SIM-003 | none | 1 | 2026-11-21 |
| SIM-015.1 | Room layout API and read-only room view | BLOCKED | P1 | M | api, ui | SIM-010 | none | 0 | 2026-11-20 |
| SIM-015.2 | Free-form layout editor | BLOCKED | P1 | M | ui, ux | SIM-015.1 | none | 0 | 2026-11-20 |

Blocked (D47; SIM-024 unblocked by D55): SIM-015.1, SIM-015.2 and any later sprite/atlas/map ticket — waiting for pixel-art decisions (D41–D46).
