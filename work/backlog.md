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
| SIM-028 | Signed-in local dev with a server-side dev token | MERGED | P1 | M | architecture, ui, security | SIM-006.2, SIM-007.2 | plan-approval | 0 | 2026-11-21 |
| SIM-028.1 | Browser dev-token mode (AuthGate skips Identity under pnpm dev) | MERGED | P1 | M | ui, security | SIM-028 | plan-approval | 3 | 2026-11-21 |
| SIM-029 | Guard dev scripts against the production DB and add dev:prod | MERGED | P1 | M | db, security | SIM-028 | plan-approval | 2 | 2026-11-21 |
| SIM-030 | Pin the dev:prod org for the running server | MERGED | P1 | S | security | SIM-029 | plan-approval | 1 | 2026-11-21 |
| SIM-031 | Pin the Identity issuer for pnpm dev:prod | MERGED | P1 | S | security | SIM-028.1 | none | 1 | 2026-11-21 |
| SIM-032 | One-command local start on production data | MERGED | P1 | M | security | SIM-031 | none | 4 | 2026-11-22 |
| SIM-009 | Invite people to an org | MERGED | P1 | M | security, ui, api | SIM-007 | none | 1 | 2026-11-22 |
| SIM-009.2 | Accept-invitation page | MERGED | P1 | M | security, ui | SIM-009 | none | 1 | 2026-11-22 |
| BUG-001 | `pnpm test:db` red on main after SIM-037.2 (devices uniqueness, CSV export columns) | DONE | P0 | XS | db | — | none | 1 | 2026-11-25 |
| SIM-034 | Run simap's GitHub Actions on the Mac self-hosted runner | BACKLOG | P1 | S | security, architecture | — | plan-approval | 0 | 2026-11-23 |
| SIM-011 | Members page, profile fields and deactivation | MERGED | P1 | M | api, ui, security | SIM-007 | plan-approval | 1 | 2026-11-22 |
| SIM-024 | Sprite atlas, manifest, placeholder art and map renderer | MERGED | P1 | M | ui, architecture | SIM-003 | none | 1 | 2026-11-21 |
| SIM-024.1 | Room map renderer, avatars, name tags and dev demo | MERGED | P1 | M | ui, architecture | SIM-024 | none | 2 | 2026-11-22 |
| SIM-012 | Seat list, add/delete seats, seat detail and occupancy | MERGED | P1 | L | api, ui | SIM-010, SIM-011 | none | 3 | 2026-11-22 |
| SIM-012.2 | Room detail page, seat table and seat panel | MERGED | P1 | M | ui | SIM-012 | none | 2 | 2026-11-22 |
| SIM-012.3 | Add and delete seats, release and role gating | MERGED | P1 | M | ui | SIM-012.2 | none | 3 | 2026-11-22 |
| SIM-012.5 | Room switcher in the app shell | MERGED | P1 | S | ui | SIM-012.2 | none | 1 | 2026-11-22 |
| SIM-012.4 | Member picker, assign, replace, remove and cannot-seat | MERGED | P1 | M | ui | SIM-012.3 | none | 1 | 2026-11-22 |
| SIM-012.6 | Remove occupant and set or clear cannot-seat | MERGED | P1 | S | ui | SIM-012.4 | none | 0 | 2026-11-22 |
| SIM-015.1 | Room layout tile-grid schema and validator | MERGED | P1 | M | db, api, security | SIM-010, SIM-012, SIM-024.1 | plan-approval | 1 | 2026-11-22 |
| SIM-015.4 | Default room layout and stored-layout resolver | MERGED | P1 | M | api, security | SIM-015.1 | none | 0 | 2026-11-22 |
| SIM-015.6 | Room layout read API | MERGED | P1 | M | api, security | SIM-015.4 | none | 1 | 2026-11-23 |
| SIM-015.3 | Read-only pixel room map on the room page | MERGED | P1 | M | ui, ux | SIM-015.6 | plan-approval | 0 | 2026-11-23 |
| SIM-015.5 | Save a room layout through the API | MERGED | P1 | M | api, security | SIM-015.6 | plan-approval | 0 | 2026-11-23 |
| SIM-015.2 | Tile-based layout editor (slice 1: editor core) | MERGED | P1 | M | ui, ux | SIM-015.3, SIM-015.5 | plan-approval | 0 | 2026-11-23 |
| SIM-015.7 | Layout editor UI and save of placement | MERGED | P1 | M | ui, ux | SIM-015.2 | plan-approval | 0 | 2026-11-23 |
| SIM-015.9 | Layout editor palette, tray placement and room resize | MERGED | P1 | M | ui, ux | SIM-015.7 | plan-approval | 0 | 2026-11-23 |
| SIM-015.10 | Layout editor drag, marquee and keyboard shortcuts | MERGED | P1 | M | ui, ux | SIM-015.7 | plan-approval | 0 | 2026-11-23 |
| SIM-015.8 | Layout editor desk add and delete | MERGED | P1 | S | ui | SIM-015.7, SIM-015.9 | plan-approval | 0 | 2026-11-23 |
| SIM-033 | Ship the real room art and an in-app Credits page | BACKLOG | P1 | S | ui, architecture | SIM-015.3 | none | 0 | 2026-11-22 |
| SIM-011.2 | Members page UI: list, edit and deactivate dialogs | MERGED | P1 | M | ui | SIM-011 | plan-approval | 1 | 2026-11-24 |
| SIM-013 | Devices: placement rules, read and placement API | MERGED | P1 | M | api | SIM-012 | plan-approval | 0 | 2026-11-23 |
| SIM-013.1 | Device create, edit and delete API | MERGED | P1 | S | api | SIM-013 | plan-approval | 0 | 2026-11-24 |
| SIM-013.2 | Devices page (read-only list and filter) | MERGED | P1 | M | ui, ux | SIM-013.1 | plan-approval | 0 | 2026-11-24 |
| SIM-013.3 | Device place, move and return dialog | MERGED | P1 | S | ui | SIM-013.2 | plan-approval | 0 | 2026-11-24 |
| SIM-013.4 | Device create and edit dialog | MERGED | P1 | S | ui | SIM-013.2 | plan-approval | 0 | 2026-11-24 |
| SIM-013.5 | Device delete dialog with Move to inventory | MERGED | P1 | S | ui | SIM-013.2 | plan-approval | 0 | 2026-11-24 |
| SIM-035 | Draw a seat's devices on its desk and keep other items off desks | MERGED | P1 | M | ui, api, security | SIM-015.8, SIM-013 | plan-approval | 0 | 2026-11-24 |
| SIM-036.1 | Google Drive image storage client (tudocuatui pattern) | MERGED | P2 | M | architecture, security | — | plan-approval | 0 | 2026-11-24 |
| SIM-036.2 | Device type catalog: schema and API | MERGED | P2 | M | db, api, security | SIM-035, SIM-036.1 | plan-approval | 0 | 2026-11-24 |
| SIM-036.5 | Device type image upload, remove and serve | MERGED | P2 | M | api, security | SIM-036.2, SIM-036.1 | plan-approval | 1 | 2026-11-25 |
| SIM-036.3 | Device types admin page | MERGED | P2 | M | ui, ux | SIM-036.2, SIM-036.5 | none | 0 | 2026-11-25 |
| SIM-036.6 | Device type images in the admin page | MERGED | P2 | M | ui, ux | SIM-036.3 | none | 0 | 2026-11-25 |
| SIM-036.4 | Draw catalog device images and slots on the map | MERGED | P2 | S | ui | SIM-036.2, SIM-036.5 | none | 0 | 2026-11-25 |
| SIM-037.1 | Device lifecycle schema and unowned devices | MERGED | P1 | M | db, api, security | — | plan-approval | 1 | 2026-11-25 |
| SIM-037.2 | Assign from org inventory and new device fields | MERGED | P1 | M | api, ui | SIM-037.1 | plan-approval | 0 | 2026-11-25 |
| SIM-037.7 | Devices UI: assign dialog, note/expiry edit and new device fields | IN_PROGRESS | P1 | M | ui, ux | SIM-037.2 | plan-approval | 0 | 2026-11-25 |
| SIM-037.3 | Transfer a device with recipient confirmation | BACKLOG | P1 | M | api, ui, security | SIM-037.2 | plan-approval | 0 | 2026-11-25 |
| SIM-037.4 | Return a device to the org inventory with Admin confirmation | BACKLOG | P1 | M | api, ui, security | SIM-037.3 | plan-approval | 0 | 2026-11-25 |
| SIM-037.5 | Overdue badge, reminder and extension request | BACKLOG | P2 | S | api, ui | SIM-037.2, SIM-037.3 | none | 0 | 2026-11-25 |
| SIM-037.6 | Device detail page with history | BACKLOG | P2 | M | ui, api, ux | SIM-037.4, SIM-037.5 | none | 0 | 2026-11-25 |
| SIM-014 | Seat requests: state machine and write API | MERGED | P1 | M | api | SIM-012 | plan-approval | 1 | 2026-11-24 |
| SIM-014.1 | Requests read API and decided badge | MERGED | P1 | S | api | SIM-014 | plan-approval | 0 | 2026-11-24 |
| SIM-014.2 | Approvals page UI | MERGED | P1 | M | ui, ux | SIM-014.1 | plan-approval | 0 | 2026-11-24 |
| SIM-014.4 | Approvals: Approve and Reject dialogs | MERGED | P1 | M | ui, ux | SIM-014.2 | plan-approval | 0 | 2026-11-24 |
| SIM-014.3 | Request a seat, My requests and nav badge | MERGED | P1 | M | ui, ux | SIM-014.1 | plan-approval | 0 | 2026-11-24 |
| SIM-016 | Groups, projects and seat tags | MERGED | P2 | S | api, ui | SIM-012 | none | 0 | 2026-11-24 |
| SIM-016.2 | Groups and Projects management page | MERGED | P2 | M | ui | SIM-016 | none | 0 | 2026-11-24 |
| SIM-016.3 | Tag and untag a seat from the seat detail | MERGED | P2 | S | ui, api | SIM-016 | none | 0 | 2026-11-24 |
| SIM-019 | Audit-log screen for org admins | MERGED | P2 | S | api, ui | SIM-010 | none | 0 | 2026-11-20 |
| SIM-019.2 | Audit-log page UI for org admins | MERGED | P2 | S | ui | SIM-019, SIM-006.2, SIM-022 | none | 0 | 2026-11-20 |
| SIM-017 | Dashboard and search | MERGED | P2 | M | api, ui | SIM-013, SIM-014 | none | 0 | 2026-11-24 |
| SIM-017.2 | Search API, diacritics-insensitive | MERGED | P2 | M | api | SIM-017 | none | 0 | 2026-11-24 |
| SIM-017.3 | Search page UI | MERGED | P2 | M | ui | SIM-017.2 | none | 0 | 2026-11-24 |
| SIM-018 | CSV export | MERGED | P2 | S | api, ui | SIM-017 | none | 0 | 2026-11-24 |
| SIM-027 | Security headers, CSP and apiFetch hardening before go-live | MERGED | P1 | M | security, architecture | SIM-006.2 | plan-approval | 0 | 2026-11-20 |
| SIM-038 | Sync the deploy-simap draft with the deployment repo (Drive secrets) | PLANNING | P2 | XS | security | — | plan-approval | 0 | 2026-11-25 |
| SIM-021 | Go-live checklist and first production deploy | BACKLOG | P1 | S | architecture, security | SIM-004, SIM-009, SIM-015.2, SIM-016, SIM-017, SIM-018, SIM-019.2, SIM-027 | none | 0 | 2026-11-20 |
| SIM-020 | Sync members from Identity and remove from org | BACKLOG | P3 | M | api, security | SIM-011 | plan-approval | 0 | 2026-11-20 |

D47 is lifted for the room map tickets (D58). SIM-033 needs re-scoping to D64 (per-item art chosen by Admins) before it runs.
