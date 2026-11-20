# simap — Spec v1

**Status:** v0.6 (2026-11-20), all open questions answered. Platform, auth, org and data questions answered by Ming (D1–D38 in
`work/decisions.md`); remaining items in [Open questions](#11-open-questions).
**Owner:** Ming. **Scope source:** this file is the first scope source in `.claude/loop.config.md`; `work/decisions.md`
records later decisions. If a ticket and this spec disagree, the spec wins and the conflict is flagged.

References used to write this spec (not shipped, not authoritative over this file):
- seatMGT code, branch `ming_dev`: `features.md` (confirmed feature backlog, 8 locked invariants), `tracking.md`
  (implementation status), `prisma/schema.prisma`, `src/lib/actions/*`, `src/app/(app)/*`, `src/components/*`, `e2e/*`.
- tudocuatui (sibling mmlabs project): Identity token verification (`server/identity.js`, `server/README.md`),
  browser auth (`src/features/auth/`), deploy (`deployment-repo/apps/tudocuatui/compose.yml`), `db/migrations/`
  and its migrator. simap copies its stack choices (D2).
- org-admin-api `docs/consumers.md` (the Identity contract): token claims, Organizations (`org_mode = required`,
  USR-06a), invitations (USR-06b), entitlements. calechip is the first org-mode consumer.
- ricotdin AUT-05: how an mmlabs app takes its admin role from Identity instead of managing it in-app.
- A seatMGT draft PRD (generic hot-desk booking) on another branch. It was written without looking at the code and is
  **not** authoritative. Its ideas are listed only as later candidates in section 10.

---

## 1. Purpose

simap is a seat (network port) and device tracking app in the mmlabs ecosystem, run as a multi-organization service:
each organization (a company or office using simap) has its own data, its own admins and its own users, and mmlabs'
Super Admin manages the organizations (D5). It replaces seatMGT, which is being retired (Ming, 2026-11-20); it starts
with an empty database, and no seatMGT data is moved (D6). Inside one organization, simap records the rooms, the seats
in each room (one seat per network
port, coded `<room>-NN`), who sits at each seat, and which devices sit where: one primary device owned by the
occupant, plus any number of borrowed (secondary) devices. Users ask for a seat and a Manager approves the request.
Admins draw each room's layout on a drag-and-drop canvas. A dashboard shows capacity and use. v1 is a rebuild of
seatMGT's confirmed features on the mmlabs platform: Next.js, mmlabs Identity sign-in, the shared mmlabs Postgres and
tudocuatui-style deploy. It is not a new product.

## 2. Users and roles

Everyone signs in with an **mmlabs Identity** account. simap has no local accounts, no passwords and no self-signup
(Ming, 2026-11-20).

**Organizations (D5).** simap is an Identity app with `org_mode = required` (org-admin-api USR-06a), like calechip:
- An *organization* (org) is the tenant. Every simap row except global config belongs to exactly one org, and every
  read and write is scoped by the `org` claim of the caller's token. Data of one org is never visible to another.
- mmlabs **Super Admin** (Identity staff, in the mmlabs admin portal) creates orgs and appoints each org's admin. simap
  has no Super Admin screen of its own.
- An org's **admin** manages that org inside simap. Admins are appointed in the admin portal, never inside simap (as
  ricotdin's admin role, D5).
- Managers and users join an org by **invitation** (D11): an org admin or manager invites an email from simap
  (Identity invitations, `simap:org:invite`; an inviter cannot grant more than they hold), and Super Admin can also
  add people in the admin portal. The role is chosen when inviting; changing the role of someone already in the org
  is done in the admin portal (Identity v1 has no app-side member management).
- Only Super Admin creates orgs (D10); simap has no "create organization" screen.

**Roles.** Roles come from the token's `org_roles` claim (the roles held in that org only), mapped through simap's role
catalog. Per the contract, org data is never authorized from `roles`, and a token with `org` but no `org_roles` is
refused. Role keys registered in org-admin-api (D14):
- `simap:member`: app-scope default role on join; grants no org access.
- `simap:admin` (org owner role), `simap:manager`, `simap:user`: org scope. Admin and manager hold `simap:org:invite`.


| seatMGT role | Identity org role (proposed) | Granted by | Can do (from seatMGT `features.md` + code) |
|---|---|---|---|
| Admin | `simap:admin` | Super Admin, admin portal | Everything a Manager can do, plus create/edit/delete rooms and seats and edit layouts. Manages any device in the org. |
| Manager | `simap:manager` | Invitation (admin) or admin portal | Approves or rejects seat requests. Assigns and removes occupants directly. Manages members, groups/projects and seat tags. Sees the Approvals page. Places, moves and returns any device of the org (D19). |
| User | `simap:user` | Invitation (admin, manager) or admin portal | Views all rooms, seats, members and devices of the org. Requests an empty seat. Manages own devices. |

- Roles are per org; there are no per-room roles (seatMGT decision, kept).
- A token without `org`, or with no simap role in `org_roles`, cannot read or write org data (403). Such a token is
  only used to list or pick the user's orgs (AUT-06).
- Several roles in one org: the highest tier wins, Admin > Manager > User (D15).
- **Role changes (D7).** A role change or removal is made in Identity. It reaches simap when the browser gets a new
  token. simap makes that fast instead of waiting for the token to expire: the client re-mints the token
  (`/auth/token`) after a 403 from simap and retries once, on org switch and on every sign-in, and the shell offers
  "refresh permissions". Identity can also revoke the session (logout or token deletion), after which `/auth/token`
  fails and the user is signed out. A demoted user who keeps an old token keeps old rights until it is re-minted or
  expires (up to 12 h); Ming accepted this, with re-mint/revocation as the remedy.

**Member = org account (D12).** Every person in simap is an mmlabs Identity account (the shared user service); simap
keeps **no** person records without an account. A *Member* is simap's profile of one account in one org, keyed by
(`org`, `sub`): email from the token, plus simap fields (display name, employee code, group). simap never stores
passwords or Identity data beyond these. How simap learns about accounts (D16): a member appears on the account's first visit (now), and simap syncs the
org's member list from an app-facing Identity endpoint once org-admin-api ships it (requested). Display name (D17): the
member fills it on first visit (default: email local part), Managers can edit it; an Identity display name becomes the
default once the members endpoint or a token claim provides it.

## 3. Platform (decided by Ming, 2026-11-20)

- **App:** one Next.js app (App Router) that serves both the UI and the API. One app, one deploy. Node 22, pnpm,
  TypeScript (CLAUDE.md).
- **Auth (D4):** mmlabs Identity (org-admin-api, `https://api.mmlabs.online`), **token in the browser** (the
  tudocuatui pattern, OQ-6 option A):
  - The browser signs in through `/api/v1/auth/login`, lists accounts (`/auth/accounts`), joins
    (`/auth/apps/simap/join`), lists its orgs (`/auth/orgs`), and gets an access token from `/auth/token` with
    `audience: "simap"` and the chosen `org_id`. The token lives in memory only (never in a cookie or `localStorage`;
    it can be ~5 KB) and is renewed before `exp`.
  - Every simap API call is a Next.js **route handler** under `/api/*`, called with `Authorization: Bearer <token>`.
    The handler verifies the token (port of tudocuatui `server/identity.js` + `jwks.js`) and reads `sub`, `email`,
    `org`, `org_roles`.
  - Consequence: pages that show org data render on the client and fetch from `/api/*`. Server Components and server
    actions do not see the token, so they never read or change org data.
- **Database (D3):** the shared self-hosted mmlabs PostgreSQL, with its own database and role `simap`.
- **Deploy (D8):** as tudocuatui. A Docker image runs on the home server behind a Cloudflare Tunnel at
  `simap.mmlabs.online`. A one-shot `migrate` container runs before the app container is replaced; the app never
  migrates. Ming registers the Identity app and the hostname later (`work/ming-todo.md`).

**Tooling (D2): the same as tudocuatui, no extra layers.**
- Data access: `pg` (node-postgres) with hand-written SQL. No ORM, no query builder.
- Migrations: tudocuatui's migrator and rules, copied: plain SQL files `db/migrations/YYYYMMDDHHMMSS_name.sql`,
  forward-only, checksums recorded, one transaction per file, advisory lock, expand-then-contract so the previous image
  still works (D3). No down files.
- Tokens: `jose`. Styling: Tailwind CSS v4. Formatter: oxfmt. Tests: Vitest.
- Tests in the first phase: **light unit tests only** (pure logic: invariant checks, code generation, validation, token
  verification, role mapping). No e2e runner and no DB integration suite yet.
- Still for the scaffold ticket to settle within these lines: Next.js layout and R1 layering, validation approach,
  icons/fonts, ID format, health endpoint names. seatMGT's dnd-kit for the layout editor is a reference.

## 4. Domain model (conceptual)

This lists entities, not tables. The DB ticket chooses the schema. Every entity carries `org_id` (the Identity org
UUID from the token's `org` claim); "unique" below means unique **within the org**, and references never cross orgs
(composite keys or checks with `org_id`). simap does not copy org names or memberships from Identity beyond what it
needs to show.

| Entity | Key fields | Notes |
|---|---|---|
| Room | org, code (unique, e.g. `C302`), name, description, floor | Layout fixtures belong to the room (LAY-03). |
| Seat | org, code (unique, `<room code>-NN`), sequence no. (unique within the room), room, occupant (member, optional), group tag, project tag, layout geometry (x, y, rotation, width, height) | Status is **not stored** (invariant 6). |
| Member | org, Identity `sub` (unique in the org, required), email (from the token), display name, employee code (unique, optional), group (optional) | Profile of one org account (D12). |
| Device | org, name, type, inventory number (unique), MAC (unique, optional), owner (member, required), seat (optional; empty = in inventory), role at the seat (primary / secondary) | |
| SeatRequest | org, seat, subject member (who will sit there), created by, status (pending / approved / rejected / cancelled), note, decided by, decided at | |
| Group | org, name (unique), colour | Label only. |
| Project | org, code (unique), name | Label only. |
| AuditLog | org, actor (Identity `sub`), action, entity, entity id, meta, time | One row per change (SYS-03). |

## 5. Locked invariants (seatMGT, kept unchanged)

The server enforces all of these (SYS-02). Where Postgres can express an invariant as a constraint, the DB enforces it
too.

1. A seat has at most one occupant.
2. One person may occupy several seats.
3. A seat has at most one primary device, and it must be owned by the seat's current occupant.
4. A seat may hold any number of secondary ("borrowed") devices, owned by anyone.
5. A device may be unassigned, in inventory.
6. Seat status (empty / occupied) is *derived* from the occupant and never stored.
7. Seat codes are generated from room code + port sequence (e.g. `C302-01`) and never typed in by hand.
8. When an occupant leaves a seat, the primary device on that seat becomes secondary.

## 6. v1 scope: seatMGT parity

v1 covers every ✅ feature in seatMGT `features.md`, with the same IDs, plus the features seatMGT built that
`tracking.md` lists as "not previously tracked" (LAY-03, LAY-05, SYS-03, SYS-04, SHL-01, SHL-02). Features that
depend on a 🟡 open decision link to their open question. "Manager+" means Manager or Admin.

### AUT — Authentication and account

**AUT-01 Sign in / sign out**
- [ ] The sign-in page signs in against Identity (email + password at Identity). simap never sees or stores a password.
- [ ] An Identity account that has not joined app `simap` gets the join step (`/auth/apps/simap/join`) when the app's
  join policy allows it. The join runs only after the user clicks (tudocuatui D8 pattern). Joining the app alone gives
  no org access (AUT-06).
- [ ] Wrong credentials show a clear message. No message reveals whether the email exists.
- [ ] Sign-out calls Identity `/auth/logout` and drops the access token. The next request to a protected page or API
  is refused.
- [ ] simap has no sign-up form of its own. The sign-in page links to Identity's sign-up and forgot-password flows
  and lists accounts already signed in on this browser as "Continue as <email>" (`/auth/accounts`) (D33).

**AUT-02 Session**
- [ ] A signed-in user stays signed in across page loads and tabs until the Identity session ends. The access token is
  renewed before it expires.
- [ ] Every `/api/*` route handler gets the caller's verified identity: `sub`, email, `org`, simap tier (from
  `org_roles`), linked member. Org data is read and written only with that `org`.
- [ ] Token rules, following org-admin-api `consumers.md` as tudocuatui applies them: ES256 only; keys from the JWKS
  URL, cached; a header carrying `jku`/`x5u`/`jwk`/`x5c` is refused; exact `iss`; `aud` = `simap`; `typ` = `at+jwt`;
  `exp`/`iat`/`sub`/`jti` required; small clock leeway; `email_verified` true; `sub` is a UUID. Any failure is 401.
  `org` present without `org_roles` is 401. A valid token without `org` or without a simap org role gets 403 on org
  routes. If the JWKS is unavailable the answer is 503, so the client keeps the session instead of signing out.
- [ ] The token is kept in browser memory and sent as a bearer header (D4). It is never put in a cookie, in
  `localStorage` or in a URL, and never logged. Several tabs stay in step (tudocuatui refresh lock + channel).
- [ ] After a 403 from simap the client re-mints the token once and retries; a second 403 shows "no permission" (D7).

**AUT-03 Account management**
- [ ] Accounts are created, edited and removed in mmlabs Identity, not in simap (Ming, 2026-11-20: "no local
  passwords, no self-signup in simap itself").
- [ ] Orgs and org admins are managed by mmlabs Super Admin in the admin portal (D5). simap has no screen for creating
  orgs or appointing admins.
- [ ] Admins and managers invite people by email with a role (D11): simap implements the invitation form and the
  `/accept-invitation` page from the contract (fragment token cleared, `Referrer-Policy: no-referrer`, sign-in with
  exactly the invited address). An inviter never offers a role above their own.

**AUT-04 Role assignment**
- [ ] Each account maps to exactly one simap tier per org: the highest simap role in `org_roles` (OQ-4).
- [ ] Roles are granted in Identity. simap shows them read-only ("managed in mmlabs"). A change takes effect when the
  token is re-minted (D7).

**AUT-05 Role tiers**
- [ ] Three tiers, User < Manager < Admin. Each tier can do only what section 2 lists.
- [ ] No Viewer tier in v1 (D25).

**AUT-06 Pick and switch org** (new; D5)
- [ ] After sign-in the client lists the account's orgs for simap (`GET /auth/orgs`). With one org it enters it
  directly; with several it shows a picker (D13); with none it shows "You are not in any organization yet" and how to get
  access. The chosen org is remembered on the device (an id, not a token).
- [ ] The shell shows the current org's name and lets a user with several orgs switch; switching re-mints the token
  with the new `org_id` and reloads all data. Nothing from the previous org stays on screen.
- [ ] `403 org_access_denied` from Identity (org suspended or access removed) drops the remembered org and goes back to
  the picker.

### ROO — Room

**ROO-01 Manage rooms** (Admin)
- [ ] An Admin creates a room with code, name, description and floor. A duplicate code is rejected with a clear
  message.
- [ ] An Admin edits a room's code, name, description and floor. The code stays unique within the org. Changing the
  code regenerates every seat code of the room (`C302-01` → `C303-01`) in one transaction, with an audit row (D29).
- [ ] Deleting a room first shows its impact: the number of occupied seats and placed devices.
- [ ] If the room is empty, delete works directly. If not, the Admin must confirm a forced delete. A forced delete
  turns primary devices in the room into secondary, returns them to inventory, deletes the room's seats and drops
  their pending requests. This is seatMGT `deleteRoom(force)` behaviour.

**ROO-02 Automatic port codes**
- [ ] A new seat's code is `<room code>-<NN>`. NN is the highest existing sequence number in the room plus 1, padded
  to 2 digits. Numbers are never reused: the room keeps a counter of the highest number ever issued (D30).
- [ ] No API or form lets anyone type in a seat code.

### SEA — Seat

**SEA-01 Manage seats** (Admin)
- [ ] Seats are created and deleted from the layout designer (LAY-02). Each seat belongs to exactly one room.
- [ ] Deleting a seat that has an occupant or any device is refused with a clear message (seatMGT guard).
- [ ] An Admin or Manager marks a seat "cannot seat" with a reason (broken, storage…). Such a seat cannot be
  assigned or requested and shows grey with the reason; its status is still derived (D26).

**SEA-02 Derived seat status**
- [ ] Every view shows a seat as empty or occupied, computed from its occupant. No status column exists.

**SEA-03 Assign / remove occupant** (Manager+)
- [ ] A Manager+ sets a seat's occupant to any member, or clears it.
- [ ] Clearing the occupant turns the seat's primary device into secondary (invariant 8).
- [ ] Assigning a different member to an occupied seat asks for confirmation ("X sits here. Replace with Y?");
  on confirm it replaces the occupant and demotes the primary (D18).
- [ ] Only members known to simap can be assigned (D16).
- [ ] Assigning the current occupant again changes nothing.

**SEA-04 / GRP-02 Tag seat with group / project** (Manager+)
- [ ] A Manager+ sets or clears a seat's group and its project. Tags never affect permissions. seatMGT only displayed
  tags and had no way to set them.
- [ ] On assign, a seat with no group takes the occupant's group; a Manager+ can change it afterwards (D32).

**SEA-05 Seat detail**
- [ ] Any user opens a seat's detail: code, room, status, occupant, primary device, secondary devices with their
  owners, group/project tags.
- [ ] The detail is addressable by URL (seatMGT `?seat=<code>` drawer) and always shows current data.
- [ ] Actions in the panel show only to roles allowed to use them.

### DEV — Device

**DEV-01 Manage devices**
- [ ] A device type is picked from a suggested list (PC, Laptop, Monitor, IP phone, Other) or typed freely (D37).
- [ ] A device has type, inventory number (unique), MAC (unique if set; format checked), name and owner (exactly one
  member).
- [ ] A User or Manager creates devices only for their own member and edits or deletes only their own devices. An
  Admin can do this for any member. Editing or deleting a device: its owner or an Admin only (D19).
- [ ] New devices start in inventory. Editing a device cannot change its owner (seatMGT).
- [ ] Deleting a device that is placed at a seat is blocked: a warning says it must go back to inventory first and
  offers "Move to inventory"; delete is allowed once it is in inventory (D31).

**DEV-02 Placement status**
- [ ] Every device list and device detail shows "at seat X" or "in inventory". The Devices page filters by
  all / placed / inventory.

**DEV-03 Role at seat**
- [ ] Placing a device as primary is refused unless the seat has an occupant, that occupant owns the device, and the
  seat has no primary yet (invariant 3). The check runs in the app and again in the DB.
- [ ] Secondary placement has no ownership check.

**DEV-04 Lend a device to another seat**
- [ ] The device's owner places it as secondary on any seat. A borrowed device is never primary.
- [ ] A Manager+ may do this for any device of the org (D19).

**DEV-05 Move device**
- [ ] A device moves seat to seat (it takes the chosen role; the DEV-03 rules apply) or back to inventory.
- [ ] The owner moves their own devices; a Manager+ moves any device of the org (D19).

**DEV-06 Auto-demote when the occupant leaves**
- [ ] Every path that removes or replaces an occupant turns the seat's primary device into secondary, in the same
  transaction. Those paths are unassign, reassign, approving a request and a forced room delete.

### MEM — Member

**MEM-01 Manage members** (Manager+)
- [ ] A Manager+ edits a member's simap fields (display name, employee code (unique in the org if set), group).
- [ ] simap never deletes an Identity account; only the admin portal does (D34).
- [ ] A Manager+ can **deactivate** a member in simap: the member keeps their history, cannot request seats or own new
  devices, is hidden from pickers, and simap refuses their calls to org data (app-local deny list, `consumers.md`
  item 11). Reactivation undoes it (D34).
- [ ] An Admin can **remove a member from the org** (their org roles in Identity). This needs an Identity endpoint
  that does not exist yet (requested with the members endpoint, D16, D34); until then removal is done in the admin
  portal and simap offers deactivation.
- [ ] Deactivating or removing a member who still occupies seats or owns placed devices warns with the counts and
  offers to release the seats and return the devices to inventory in the same step (D34).
- [ ] Every member is an org account (D12). Managers edit simap fields (display name, employee code, group); the
  account itself is managed in Identity.
- [ ] A member is created on the account's first visit to the org and asked for a display name (D16, D17).
- [ ] The Members page also lists the org's pending invitations sent from simap (read-only; no seat can be assigned to
  them) (D16).
- [ ] Once Identity offers the app-facing members endpoint, simap syncs the org's members from it so Managers can
  assign people who have not visited yet (D16, later ticket).

**MEM-02 Member overview**
- [ ] The member page or card lists every seat the member occupies and every device they own, with counts. It is
  searchable.

### GRP — Group / Project

**GRP-01 Manage groups / projects** (Manager+)
- [ ] A Manager+ creates, edits and deletes groups (name unique, colour) and projects (code unique, name). Both are
  labels only. seatMGT never built this.
- [ ] Deleting a group or project that is in use warns with the number of seats tagged; on confirm it clears the tag
  on its seats (and on members, for groups) (D34).

**GRP-02** is covered by SEA-04.

### LAY — Layout designer (Admin)

**LAY-01 Drag-and-drop layout that saves**
- [ ] An Admin opens a room's editor, drags seats on a canvas and saves. Positions survive reloads and sessions.
- [ ] v1 targets the free-form editor seatMGT ships today (move, resize, rotate, multi-select, zoom/pan, optional
  fine snap; LAY-05). Free-form confirmed; a floor-plan background image is later (D20).

**LAY-02 Canvas tile = seat**
- [ ] Each seat tile on the canvas is one seat record. Adding a tile creates a seat and its code (ROO-02). Deleting a
  tile deletes the seat, with the SEA-01 guard.

**LAY-03 Layout fixtures**
- [ ] An Admin adds, moves, rotates and deletes fixtures: door, window, room, stairs, elevator, server, cabinet,
  pillar, blocked area, label. They are saved with the room.

**LAY-05 Editor controls**
- [ ] Moving a group of tiles, resizing, rotating, marquee and multi-select, zoom and pan, and optional 8 px snap. All
  of this is saved in one layout save.

**Room view (all roles)**
- [ ] `/rooms/<code>` shows the saved layout read-only, with seat status, and opens the seat detail (SEA-05).

### REG — Seat requests

**REG-01 Request a seat** (any signed-in user with a linked member)
- [ ] From the detail of an empty seat, a user requests it, and a pending request is created.
- [ ] A second identical pending request (same seat and member) creates nothing new.
- [ ] A request for an occupied seat is refused.
- [ ] A User may request a seat in any room of the org (D21), for themselves only (D23).

**REG-02 Approve, reject or assign directly** (Manager+)
- [ ] The Approvals page lists requests and filters them by status.
- [ ] Approving seats the subject (demoting any primary, DEV-06), marks the request approved, and rejects every other
  pending request for that seat, all in one transaction.
- [ ] Rejecting marks the request rejected. Approving or rejecting a request that is not pending changes nothing.
- [ ] Manager+ assign directly without a request (SEA-03). Only Users go through the approval flow.
- [ ] The requester can cancel their own pending request (D24).
- [ ] "My requests" lists the user's requests with their status; a badge counts requests decided since the user
  last opened it. No email (D24).

**REG-03 Release own seat / device** (in v1, D22)
- [ ] A user releases a seat they occupy without approval; the occupant is cleared and DEV-06 runs.
- [ ] A user returns their own device from a seat to inventory.

### DSH — Dashboard

**DSH-01 Overview numbers**
- [ ] The dashboard shows rooms, seats, occupied seats, occupancy rate, and devices placed vs. in inventory.
  Everything is computed from the database when the page loads, with no cached counters (seatMGT's
  `layoutMeta.seatCount` is not carried over).
- [ ] It breaks occupancy down per room, with room cards and an occupancy ring as in seatMGT.

**DSH-02 Search and filter** (all roles)
- [ ] Search runs on the server across seats (code, occupant), devices (name, inventory no., MAC, owner) and members
  (name, employee code). Results are always current.
- [ ] Search ignores case and Vietnamese diacritics: "nguyen" finds "Nguyễn".
- [ ] Result lists have bounded page sizes.
- [ ] Manager+ export CSV (opens in Excel, UTF-8 with BOM for Vietnamese) of seats with occupants, devices and
  members of the org (D27).
- [ ] If feasible in v1, any user exports a room's layout as an image (PNG) from the room view (D27; Should).

### SYS — System

**SYS-01 Role checks on server and UI**
- [ ] Every mutation and every protected read checks the caller's tier on the server. A forbidden call is refused
  with 403 or the app's single error shape, and changes nothing.
- [ ] The UI hides or disables actions the role cannot use. Nav entries such as Approvals are hidden below Manager.
- [ ] Unit tests cover the role mapping and the role gate helper (light tests, D2).
- [ ] Every query of org data is filtered by the caller's `org`; an id from another org answers 404, as if it did not
  exist. A unit test covers the org-scoping helper.

**SYS-02 Business-rule checks**
- [ ] All inputs are validated at the server boundary. Every invariant in section 5 is checked inside the same
  transaction as the write.
- [ ] Errors are shown to the user in plain English (copy files, D36). The error shape carries a code and never a stack trace.

**SYS-03 Audit log**
- [ ] Every change writes an audit row in the same transaction: actor `sub`, action, entity, id, small meta. The row
  holds no secrets and no tokens.
- [ ] Audit rows are kept indefinitely in v1 (D38).
- [ ] Admins of the org see an audit-log screen: newest first, filter by actor, entity type and date range,
  paginated (D28).

**SYS-04 Health**
- [ ] A liveness endpoint (no DB) and a readiness endpoint (DB `select 1`) exist, as in tudocuatui. The compose
  healthcheck uses readiness.

### SHL — Shell

**SHL-01 App shell with role-aware nav**
- [ ] Nav rail on desktop and bottom bar on mobile, org name and switcher (AUT-06), room switcher, avatar and role
  badge, "refresh permissions", sign-out.
- [ ] Pages: Dashboard, Rooms, Room detail, Room editor (Admin), Members, Devices, Approvals (Manager+).

**SHL-02 Light/dark theme**
- [ ] The user switches between light and dark, and the choice is kept on the device.

**Visual style:** follow seatMGT's look: its UI kit (Card, Button, Chip, Avatar, RoleBadge, FilledInput,
EntityFormDialog), seat tiles, room cards, fonts and icons. UI copy is English by default (D36).

### v1 done means
- Every acceptance criterion above passes, except those waiting on an open question that Ming has deferred.
- Light unit tests cover each locked invariant check, seat code generation, token verification, role mapping and org
  scoping (D2). seatMGT's e2e flows (sign in, manager assigns, devices, seat-request flow, layout designer) are checked
  by hand before go-live; an e2e suite is a later candidate.
- The app is deployed to production at `simap.mmlabs.online` through the `migrate` → replace flow, and seatMGT can be
  switched off. simap starts empty; orgs enter their data from scratch (D6).

## 7. What changes vs. seatMGT

| Area | seatMGT | simap |
|---|---|---|
| Tenancy | One office, global data | Multi-org: every row belongs to an Identity org, scoped by the token's `org` claim (D5) |
| Auth | better-auth with email/password, local `Account`, `Session`, `AuthCredential`, `Verification` tables, server session cookie | mmlabs Identity tokens held in browser memory, bearer calls to route handlers (D4). No local credential or session tables. The account is the token `sub`. |
| Roles | `Account.role` column, changed in-app (`setAccountRole`) | Org roles (`org_roles`) granted in Identity; admins appointed by mmlabs Super Admin (D5) |
| Data access | Prisma, server actions, whole DB loaded into a client store | `pg` + SQL behind route handlers; pages fetch what they show (D2, D4) |
| Database | Prisma on its own Postgres | Its own database and role `simap` on the shared mmlabs Postgres (D3) |
| Migrations | Prisma migrations, forward only | tudocuatui migrator: plain SQL, forward-only, expand/contract (D3). Applied by the one-shot `migrate` container. |
| Tests | Vitest against a real DB + Playwright e2e | Light Vitest unit tests only in the first phase (D2) |
| Data | seatMGT production data | None moved; start empty (D6) |
| Deploy | Its own Dockerfile and compose | tudocuatui pattern: image, home server, Cloudflare Tunnel, `migrate` before replace, config through the deployment repo |
| Seat status | Stored `SeatStatus` column kept in sync by hand | Not stored; derived (invariant 6) |
| Room metadata | `layoutMeta` JSON (`podCols`, `podRows`, `seatCount`, `floor`, `features`) | Real `floor` field. Seat count is computed. Pod/grid capacity fields are dropped along with the legacy editor. |
| Seat geometry | Three overlapping sets (`posX/posY`, `col/row/colSpan/rowSpan`, `x/y/rotation/w/h`) | One set, owned by the single layout editor |
| UI language | English | English by default, all copy in per-feature copy files so another language can be added (D36) |

**Not carried over:**
- The legacy layout editors: route `edit-legacy`, redirect `edit-new`, `components/seatmap/_legacy`,
  `RoomFeatureTile`, and the `@deprecated` actions `saveSeatPositions`, `addRoomRow`, `addRoomColumn`,
  `addRoomFeature`, `moveRoomFeature`, `deleteRoomFeature` (LAY-04 capacity "walls").
- Mock data (`src/lib/mock/data.ts`, the client `AppStore` fed from it), `dev.log`, and seed files with real-looking
  data. Dev and test seeds may exist but contain no production data.
- better-auth (`/api/auth/[...all]`, `lib/auth/*`). (The `cannotSeat` flag is kept and now blocks assignment, D26.)

## 8. Non-functional requirements

- **Language (D36):** UI copy is **English** by default. All user-facing text lives in copy files (no literals in
  components) so another language can be added later. People's names and data stay as entered: Vietnamese diacritics
  must display, sort and search correctly. Text is stored as Unicode NFC. Code, comments, docs and commits in English.
- **Time (D35):** stored in UTC, shown in Asia/Ho_Chi_Minh (UTC+7) for every org in v1; a per-org time zone is a later candidate.
- **Security:**
  - Role checks run on the server for every route handler, server action and protected page (SYS-01). The UI only
    hides what the server already refuses.
  - Token verification fails closed (AUT-02).
  - No secrets, tokens, raw claims or personal data in logs or client bundles. Logs carry only fixed error codes.
  - Mutating requests are protected against cross-site use.
- **Config:** from environment variables only. Names go in `.env.example` with no values (R3). The `DATABASE_URL`
  secret comes from the deployment repo's env file, never from the image.
- **Database:**
  - Every schema change ships with a reviewed forward-only migration that keeps the previous image working
    (expand/contract). An applied migration is never edited (R2, D3). Rollback = previous image, or fix forward, or
    restore the pre-release backup.
  - Every org table has `org_id NOT NULL` and every unique key and foreign key includes it.
  - Invariants are backed by constraints where Postgres allows, for example a partial unique index for one primary
    device per seat.
  - All multi-row changes run in one transaction.
- **Availability:** a single instance on the home server is acceptable. A short window during deploy is acceptable.
  The app needs outbound network access to `api.mmlabs.online` (JWKS).
- **Size:** a handful of orgs at first, each with tens of rooms and hundreds of seats, members and devices. Lists are
  paginated or bounded.
- **Accessibility:** forms and actions work by keyboard. Status is never shown by colour alone.
- **Browsers:** current desktop Chrome, Edge, Safari and Firefox. The room view and seat detail must work on mobile;
  the layout editor is desktop only.

## 9. Non-goals (v1)

- Local accounts, passwords, sign-up, password reset or SSO/AD inside simap. Identity owns all of these.
- Time-based booking, reservations, QR check-in, auto-release, waitlists, meeting-room booking.
- Buildings/floors/zones as separate entities (a room has a `floor` text field only). Multi-org **is** in scope
  (D5); several sites inside one org are modelled only through room names and the `floor` field.
- Creating orgs, appointing org admins, billing or plans inside simap (the admin portal owns these). Entitlements
  (`ent`) are not read or enforced in v1 (D9).
- Moving seatMGT data (D6).
- Notifications (email, push, in-app), calendar integrations, visitor/guest flows.
- Analytics beyond DSH-01 (utilisation history, trends, scheduled reports).
- Native mobile apps or offline mode.
- Bulk CSV/Excel import of rooms/seats (later candidate). `.xlsx` export (CSV is in v1, D27).

## 10. Later candidates (not v1; need Ming's decision to move up)

- From seatMGT open items: `.xlsx` export, Viewer tier (D25: not v1), floor-plan background
  image (D20).
- Playwright e2e suite and DB integration tests (after the first phase, D2).
- Plan limits from Identity entitlements (`ent.limits`, e.g. max seats per org) (D9: not now).
- From the non-authoritative draft PRD: bulk import of seats from CSV/Excel; in-app notification centre (for example
  when a request is decided); building/floor hierarchy; time-based booking with QR check-in and auto-release. None of
  these is in seatMGT, and none is in v1.

## 11. Open questions

Owner: Ming for all of them. Each blocks the tickets named after it. IDs are stable: an answered question moves to
`work/decisions.md` and keeps its number here, marked answered. Gaps in the numbering are intentional.

**Answered (see `work/decisions.md`)**
- **OQ-1 Data migration** — answered D6: no seatMGT data is moved; simap starts empty.
- **OQ-2 Member ↔ account link** — partly answered D5/D6: users belong to the org in Identity. Remaining detail is OQ-34.
- **OQ-3 Join policy and role grants** — answered D5: org admins are appointed by mmlabs Super Admin in the admin
  portal (as ricotdin). How managers/users enter an org: OQ-33.
- **OQ-5 Role-change delay** — answered D7: re-mint or revoke the token on role change.
- **OQ-6 Session location** — answered D4: option A, token in browser memory, bearer to route handlers.
- **OQ-7 Hostname and app key** — answered D8: `simap.mmlabs.online`; Ming registers the app later.
- **OQ-24 Down migrations** — answered D3: forward-only, as tudocuatui. CLAUDE.md R2 updated.
- **OQ-31 Scaffold choices** — answered D2: same tooling as tudocuatui, no extras, light unit tests only.

- **OQ-4** — answered D15 (highest tier wins). **OQ-32** — answered D10 (Super Admin only). **OQ-33** — answered D11
  (invite from simap + admin portal). **OQ-34** — answered D12 (no records without an account). **OQ-35** — answered
  D13 (several orgs per account). **OQ-36** — answered D9 (no plan limits for now). **OQ-37** — answered D14.

- **OQ-38** — answered D16 ((a) now + (b) request to org-admin-api). **OQ-39** — answered D17.

**Behaviour (seatMGT 🟡 items and gaps found in its code)**
- **OQ-8 Viewer tier.** Add a read-only `simap:viewer` tier (AUT-05)?
- **OQ-9 Request scope.** *Answered D21.* In which rooms may a User request a seat: any room, or a limited set (REG-01)?
- **OQ-10 Self-release.** *Answered D22.* Is REG-03 in v1: can a User release their own seat and remove their own device from a seat?
- **OQ-11 Request for someone else.** *Answered D23.* seatMGT lets any user file a request with another member as the subject. Keep
  that, or self only?
- **OQ-12 Assign to an occupied seat.** *Answered D18.* Replace the occupant (seatMGT behaviour, which demotes the primary), or refuse
  until the seat is released?
- **OQ-13 Manager and other people's devices.** *Answered D19.* `features.md` says a Manager can place and move any device (DEV-04/05).
  seatMGT code lets only the owner or an Admin manage a device. Which is right?
- **OQ-14 Layout style.** *Answered D20.* Keep the free-form editor (what seatMGT ships today), or use a simple grid? Is a floor-plan
  background image in v1?
- **OQ-15** — D26. **OQ-16** — D27. **OQ-17** — D28. **OQ-18** — D29. **OQ-19** — D30. **OQ-21** — D31.
  **OQ-26** — D32. **OQ-29** — D33. **OQ-30** — D34. **OQ-8** — D25.

All v1 open questions are answered as of 2026-11-20. New questions get the next free number (OQ-40).

## 12. Change log

| Date | Change |
|---|---|
| 2026-11-20 | First draft from Ming's `/idea` brief: seatMGT rebuild on Next.js + mmlabs Identity + shared Postgres, deployed like tudocuatui. |
| 2026-11-20 | v0.6 (D35–D38): UTC+7 for all orgs; English UI copy by default in copy files; suggested device types; audit kept indefinitely. |
| 2026-11-20 | v0.5 from Ming's answers (D25–D34): no Viewer; cannot-seat flag blocks; CSV export + layout PNG if feasible; audit screen for Admins; room code editable (unique in org, seat codes follow); seat numbers never reused; placed device must go to inventory before delete; seat takes occupant's group; Identity sign-in links + account picker; members are deactivated or removed from the org, never deleted. No open questions left. |
| 2026-11-20 | v0.4 from Ming's answers (D16–D24): member directory now + Identity members endpoint later; display name; confirm-replace on assign; Manager moves any device; free-form editor; requests in any room, self only, cancellable, in-app status; self-release in v1. |
| 2026-11-20 | v0.3 from Ming's answers (D9–D15): Super Admin creates orgs; invitations from simap; every member is an Identity org account; several orgs per account; no plan limits; role keys; highest tier wins. Added OQ-38, OQ-39. |
| 2026-11-20 | v0.2 from Ming's answers (D1–D8): multi-org service with Identity orgs (`org_mode = required`), admins appointed by mmlabs Super Admin; token in browser + route handlers; tudocuatui tooling (pg, SQL forward-only migrations, Vitest light unit tests); no data migration; `simap.mmlabs.online`. Added AUT-06, OQ-32–37; closed OQ-1/2/3/5/6/7/24/31. |
