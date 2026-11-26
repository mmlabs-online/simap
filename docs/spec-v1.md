# simap — Spec v1

**Status:** v0.8 (2026-11-20), no open questions. Platform, auth, org and data questions answered by Ming (D1–D51 in
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
| User | `simap:user` | Invitation (admin, manager) or admin portal | Views all rooms, seats and members of the org (members list: OQ-58). Sees only the devices they hold (owner = their member), never the org's device list (D69, DEV-12). Requests an empty seat. Places, edits, transfers and returns own devices (D63). Uses My Portal (POR, D70). |

- Every tier has My Portal (POR) for its own seats, devices and profile; Manager and Admin also keep the full Devices
  page (D70).

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
| Room | org, code (unique, e.g. `C302`), name, description, floor | Layout fixtures belong to the room (LAY-03); a placed fixture keeps its library `sprite_key`, which also names its map item (LAY-07). |
| Seat | org, code (unique, `<room code>-NN`), sequence no. (unique within the room), room, occupant (member, optional), group tag, project tag, layout geometry (x, y, rotation, width, height) | Status is **not stored** (invariant 6). |
| Member | org, Identity `sub` (unique in the org, required), email (from the token), display name, employee code (unique, optional), group (optional), profile photo (optional; stored file reference, POR-05), pixel character look (optional; preset part per layer: skin, hair colour, hair style, shirt colour, POR-06) | Profile of one org account (D12). No photo = fallback (OQ-57); no stored look = look derived from `sub` as before (D71). |
| Device | org, name, type, inventory number (unique), MAC (unique, optional), serial number (unique, optional), manufacturer, brand, owner (member, optional; empty = org inventory, D63), expiry date and note of the current holding, seat (optional; empty = not placed), role at the seat (primary / secondary) | Owner changes only through assign, transfer and return (DEV-07 to DEV-09). |
| DeviceHandoff | org, device, kind (transfer / return / extension), from member, to member (transfer), requested by, note, new expiry (extension), status (pending / confirmed / declined / cancelled), decided by, decided at | At most one pending per device (DEV-08 to DEV-10). Device history (DEV-11) is read from these rows and the audit log. |
| SeatRequest | org, seat, subject member (who will sit there), created by, status (pending / approved / rejected / cancelled), note, decided by, decided at | |
| DeviceType | org, name (unique, case- and space-insensitive), desk slot, optional image | Org catalog (D61); devices match it by name, no reference. |
| MapItem | org, library key (unique; a base key of the sprite library, e.g. `door`, `table.meeting`, `plant.small`, `floor.wood`, `desk.single`, `chair.office`), name (unique, case- and space-insensitive), palette group, order, size (width × height in tiles), shown in palette (yes/no), art per direction: library sprite, another bundled package sprite, or a custom image | Per-org catalog of the existing library items (LAY-07, D64, D66). One row per library item, seeded per org; phase 1 has no Admin-created item kinds. Placed fixtures keep `sprite_key`; the catalog row is found by (org, library key). |
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
5. A device may be unassigned, in inventory. A device with no owner (org inventory, D63) is never at a seat.
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
- [ ] simap hosts sign-up, forgot-password, verify-email and reset-password pages that call Identity (D53). The
  sign-in page links to them and lists accounts already signed in on this browser as "Continue as <email>"
  (`/auth/accounts`) (D33).

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
  passwords"). simap only hosts the Identity sign-up and password screens (D53).
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
- [ ] An Admin adds seats to a room and deletes them through the API and a plain seat list on the room page (D47);
  the map editor (LAY-02) places existing seats and can also add new ones. Each seat belongs to exactly one room.
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
  owners, group/project tags. For a User, device details at the seat follow DEV-12: only the devices they hold are
  shown in full; what the panel shows about other devices is OQ-55.
- [ ] The detail is addressable by URL (seatMGT `?seat=<code>` drawer) and always shows current data.
- [ ] Actions in the panel show only to roles allowed to use them.

### DEV — Device

Device lifecycle (D63, Ming 2026-11-25; replaces seatMGT's fixed owner). Two places a device can be when it is not
at a seat: the **org inventory** (no owner; Admins hold it) and a **member's inventory** (owned by that member, not
placed). "Return to inventory" from a seat (DEV-05, REG-03) moves a device into its owner's inventory; only DEV-09
gives it back to the org inventory.

Device visibility (D69, Ming 2026-11-26): Admins and Managers see every device of the org; a User sees only the
devices they hold (owner = their member). "Devices page" below means the Manager+ page; a User works with their own
devices in My Portal (POR-03).

**DEV-01 Manage devices**
- [ ] A device type is picked from the org's device type catalog or typed freely (D37, D61). Each org starts with PC,
  Laptop, Monitor, IP phone and Other.
- [ ] An Admin manages the catalog: add, rename, change the desk slot, delete (name unique in the org, case- and
  space-insensitive, at most 60 characters, at most 100 types; an optional square PNG image, 24 × 24 to 100 × 100 px, at most 100 KB (D68), SIM-036.5, or a
  device sprite picked from the bundled package, D66; image first, then the picked sprite, then the slot's built-in
  sprite). A device's
  type matches a catalog type by name; renaming or deleting a type never changes devices, which then draw as the
  placeholder until their type matches again.
- [ ] A device has name, type, inventory number (unique), and optional MAC (unique if set; format checked), serial
  number (unique if set, trimmed, at most 100 characters), manufacturer and brand (free text, at most 100 characters
  each). Owner is optional: empty means the device is in the org inventory.
- [ ] Only an Admin creates devices (OQ-41); a new device has no owner and is in the org inventory. An Admin edits any
  device's fields; the owner edits their own device's fields. Editing never changes the owner: only DEV-07 to DEV-09
  do.
- [ ] Only an Admin deletes a device, and only while it is in the org inventory with no pending handoff. Deleting a
  device that is placed at a seat is blocked: a warning says it must go back to inventory first and offers "Move to
  inventory" (D31).

**DEV-02 Placement and custody status**
- [ ] Every device list and device detail shows where the device is ("at seat X", "in <member>'s inventory" or "in org
  inventory") and any pending transfer or return. The Devices page (Manager+, D69) filters by all / placed / not
  placed / org inventory / overdue.

**DEV-03 Role at seat**
- [ ] A device in the org inventory (no owner) is never placed at a seat; the app and the DB refuse it.
- [ ] Placing a device as primary is refused unless the seat has an occupant, that occupant owns the device, and the
  seat has no primary yet (invariant 3). The check runs in the app and again in the DB.
- [ ] A Manager+ placing an owned device as secondary has no ownership check beyond the device having an owner (D19).
  A User may place a device only on a seat they occupy (D72); an empty seat or another member's seat is refused 422
  `seat_not_yours`, before any write.

**DEV-04 Lend a device to another seat**
- [ ] Lending to a seat someone else occupies, or to an empty seat, is Manager+ only (D19, D72): a Manager+ places any
  owned device of the org as secondary on any seat. A borrowed device is never primary.
- [ ] A User places their own device only on a seat they occupy (D72). Devices a User lent before D72 stay where they are.

**DEV-05 Move device**
- [ ] A device moves seat to seat (it takes the chosen role; the DEV-03 rules apply) or back to its owner's inventory.
- [ ] The owner moves their own devices, seat to seat only onto a seat they occupy (D72); back to inventory is always
  allowed. A Manager+ moves any owned device of the org to any seat (D19).

**DEV-06 Auto-demote when the occupant leaves**
- [ ] Every path that removes or replaces an occupant turns the seat's primary device into secondary, in the same
  transaction. Those paths are unassign, reassign, approving a request and a forced room delete.

**DEV-07 Assign from the org inventory**
- [ ] An Admin or Manager assigns a device in the org inventory to an active member, with an optional note (at most
  500 characters) and an optional expiry date (empty = no expiry; a calendar date, not in the past). The device then
  belongs to that member and is in their inventory, not placed; the member places it themselves. No confirmation by
  the member is needed. An owned device cannot be assigned (it must be transferred or returned first).
- [ ] An Admin or Manager edits the current assignment's note and expiry date (this is also how an extension is
  granted, DEV-10).

**DEV-08 Transfer to another member**
- [ ] Any owner (every role) starts a transfer of their own device to another active member of the org, with an
  optional note. A Manager+ may start one for any owned device. A device has at most one pending handoff (transfer,
  return or extension).
- [ ] Until the recipient confirms, nothing changes: the device stays with the sender and keeps its seat. The sender
  (or a Manager+) can cancel; the recipient can decline.
- [ ] When the recipient confirms receipt, in one transaction the device leaves its seat (if placed) and lands in the
  recipient's inventory, not placed; the recipient places it themselves. The expiry date carries over (OQ-43).
- [ ] The recipient sees pending transfers to them (badge in the nav, OQ-59; list in My Portal → My devices for
  every tier, POR-03, and on the Devices page for Manager+). A pending transfer shows the recipient the device's name,
  type and inventory number, the sender and the note, so they can confirm or decline before they hold it (D69).

**DEV-09 Return to the org inventory**
- [ ] The owner (or a Manager+) starts a return of an owned device to the org inventory, with an optional note.
- [ ] Until an Admin confirms the device was received, nothing changes; the owner (or a Manager+) can cancel.
- [ ] When an Admin confirms, in one transaction the device leaves its seat (if placed), loses its owner and is in the
  org inventory. Admins see pending returns (badge in the nav, list on the Devices page).
- [ ] An Admin can also take a device back directly, without a request (e.g. the owner was deactivated or removed,
  OQ-44); the history records it as an Admin return.

**DEV-10 Overdue and reminder**
- [ ] A device whose expiry date has passed (UTC+7 calendar day, D35) shows **Overdue** wherever it is listed.
  Overdue is computed when read, never stored.
- [ ] Its owner sees an in-app reminder (nav badge, OQ-59, and a banner in My Portal → My devices, POR-03; Manager+
  also on the Devices page) to ask for an extension or return it; no email in v1. The owner can request an extension (new date, optional note); an Admin or Manager
  approves (sets the new expiry) or rejects it (OQ-42).

**DEV-11 Device detail and history**
- [ ] A Manager+ can open the detail page of any device of the org; a User only of a device they hold (D69): all
  fields, where it is, the current holder (since, note, expiry, overdue), any pending handoff, and its history. For a
  device a User does not hold, the detail and history API answer 404, as for an id from another org (SYS-01).
- [ ] The history lists, newest first, every create, assign, transfer (started, cancelled, declined, confirmed),
  return (started, cancelled, confirmed, Admin return), extension and expiry change: who did it, from and to member,
  when, note, expiry date, and who confirmed. History is kept when members are deactivated or removed.

**DEV-12 Device visibility by tier and "my devices"** (D69, Ming 2026-11-26)
- [ ] The server enforces visibility; the UI only hides what the API already withholds. For a User: the device list
  (`GET /api/devices`) returns only devices they hold; device detail and history (`/api/devices/[id]`,
  `/api/devices/[id]/history`) answer 404 for any device they do not hold; device results in search (DSH-02) contain
  only devices they hold. Other device data a User reaches through seats, members or the room map is limited as
  SEA-05, MEM-02 and LAY-06 say.
- [ ] A "my devices" endpoint returns the devices held by the caller's member, for every tier: name, type, inventory
  number, placement (seat code and role, or "in my inventory"), expiry date and overdue flag, and any pending handoff.
  It is bounded (paged) and scoped by the token's `org` (R6).
- [ ] Admins and Managers keep the full org list and detail (DEV-01 to DEV-11) and also get their own list from the
  same "my devices" endpoint.
- [ ] Unit tests cover the visibility rule per tier (list, detail, history, search).

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
  searchable. For a User the API omits the devices (and device counts) of other members (D69); whether Users see the
  members list at all is OQ-58.

### GRP — Group / Project

**GRP-01 Manage groups / projects** (Manager+)
- [ ] A Manager+ creates, edits and deletes groups (name unique, colour) and projects (code unique, name). Both are
  labels only. seatMGT never built this.
- [ ] Deleting a group or project that is in use warns with the number of seats tagged; on confirm it clears the tag
  on its seats (and on members, for groups) (D34).

**GRP-02** is covered by SEA-04.

### LAY — Layout designer (Admin)

**Visual style of rooms (D41, D43, D46, D48).** The room view and the editor are **pixel-art, top-down, on a 32 px tile
grid**, drawn from a sprite atlas (desks, chairs, devices, walls, floors, fixtures). Everything else in the app keeps
the clean UI kit, with small pixel accents (logo, icons, empty states). Sprites scale by whole numbers only (2×, 3×,
4×, `image-rendering: pixelated`). No game engine or new library: DOM or plain canvas (stack unchanged). The art comes
from an atlas plus a manifest, so the art can be replaced without code changes (asset rules D45). Art style "modern
office" (D46) in UI shell A: clean UI around the map. Quality bar: name tags as dark pills with crisp (non-pixel)
text, soft shadows under furniture, pastel floors per zone, walls with a top face (3/4 view), rich decor (D46).
One map per room in v1; a whole-floor map is v2 (D49).
The pixel style is limited to end-user surfaces (sign-in, room browser and map, my seat, requests); management screens
use the clean UI kit (D52). Art rules: `docs/art/style-guide.md`.

**Art per item (D64, D66, Ming 2026-11-25).** No single art pack is picked for simap. Each map item (LAY-07) and each
device type (DEV-01) gets its art from a sprite of the **bundled package** (the licence-checked pack whose packed atlas
is committed to the repo, D66) or from a **custom image** the Admin uploads (stored in Google Drive as for device
types, D61). Fallback order for each direction of an item: custom image → chosen package sprite → the library's
built-in frame → the square placeholder. The overlay sprites (seat state, avatars, device placeholder) stay built-in
and are not chosen per item. Every bundled third-party package is credited on the in-app Credits page (D45).

**LAY-01 Tile-grid layout that saves** (supersedes D20's free-form editor)
- [ ] A room has a size in tiles (width × height). An Admin opens the room's editor, places items on whole tiles and
  saves. Positions survive reloads and sessions.
- [ ] Items: seat desks (a desk sprite may cover several tiles), fixtures, and walls/floor, all from the org's map item
  catalog (LAY-07). Rotation in 4 directions only, for directional items; a non-directional item saves rotation 0.
  An item's footprint is its catalog size (width × height at rotation 0; 90° and 270° swap width and height); no
  per-placement resize.
- [ ] Items cannot overlap where the library says they block (e.g. two desks on one tile), and no fixture is placed
  on a desk tile (D61, D62). The validator, layout read and editor take footprints from the org's catalog, not from
  the sprite registry alone.

**LAY-02 Desk = seat**
- [ ] Each desk on the grid is one seat record. Placing a desk creates a seat and its code (ROO-02). Removing a desk
  deletes the seat, with the SEA-01 guard.

**LAY-03 Layout fixtures**
- [ ] An Admin adds, moves, rotates and deletes fixtures from the editor's "Add items" palette. The palette is the
  org's map item catalog (LAY-07): only items marked "shown in palette", under the Admin's group names, in the
  Admin's order, with the Admin's item names, sizes and art. Fixtures are saved with the room, still as `sprite_key`
  (no change to saved layouts).
- [ ] Each org starts with a catalog seeded with one row per base key of today's palette (cabinet, circulation, door,
  label, lamp, marker, partition, plant, prop, rack, shelf, sofa, table, wall, whiteboard, window groups, plus
  `desk.single`), every `floor.*` key and `chair.office`; each row has the library's group, a readable name from the key
  (e.g. "wall t s", "window double"), the library footprint as its size and no custom art. Existing layouts keep
  drawing exactly as before.

**LAY-05 Editor controls**
- [ ] Sprite palette, click/drag to place, rotate (R), delete, multi-select and move a group by whole tiles, zoom
  2×/3×/4× and pan, undo of the last steps before save. All of this is saved in one layout save. Desktop only.

**LAY-06 Seats and people drawn on the map** (D41, D44)
- [ ] Each seat shows its state with a sprite overlay, not colour alone: empty, occupied (a pixel avatar sits there),
  mine (highlight), cannot-seat (blocked sign), pending request (marker).
- [ ] Every device placed at a seat is drawn on its desk, one sprite per device, at its catalog type's slot and
  image (built-in sprite when the type has no image); a device whose type is not in the catalog draws as the square
  placeholder (D37, D61, D62). Whether Users still see the sprites of devices they do not hold (sprite only, no
  details) is OQ-55; the layout API never gives a User more about such a device than that answer allows (D69).
- [ ] Every placed fixture, desk, chair and floor tile is drawn with its map item's current art for the placed
  direction, using the fallback order of "Art per item": a custom image is drawn 1:1 in room pixels with
  nearest-neighbour zoom and is never rotated; a package or built-in sprite smaller than the item's size is drawn at
  its own size, bottom-left aligned in the footprint. A custom image that cannot be loaded falls back the same way.
  Art changes show at the next layout load (LAY-07, D64, D66).
- [ ] Occupants are 32 px layered avatars (body/hair/shirt): the member's chosen pixel character when set (POR-06),
  else colours derived from `sub`, stable per person (D51, amended by D71). The map never shows the profile photo
  (D44 kept for the map; where the photo shows: OQ-57). Name tags appear only on hover or keyboard focus, at every
  zoom (D50).

**LAY-07 Map item catalog (Admin)** (D64; Ming 2026-11-25: "admin có thêm nơi setup và lựa chọn các item được add
vào sơ đồ phòng kèm ảnh cho item đó"; "idea là để admin có quyền điều chỉnh list items này và cách nó hiển thị (ảnh)
trên layout")
**Phase 1 (D66): the Admin manages the existing library items.** Creating new item kinds, several desk looks per
org and a per-desk look choice are a later phase.
- [ ] An Admin has a "Map items" management page (clean UI kit, D52), beside Device types, that controls the editor's
  "Add items" palette (LAY-03) and how each item looks on the map. Any member can read the catalog (the map needs
  it); only an Admin changes it.
- [ ] Each item shows its library key (read only), name (unique in the org, case- and space-insensitive, at most 60
  characters), group (at most 40 characters; the palette groups by it), order (within its group; groups are ordered
  too), **size in tiles, always visible as `w × h`**, shown in palette (yes/no) and its art per direction (n/e/s/w
  for directional items, one image otherwise), previewed at 1× and 2×.
- [ ] The Admin can rename, regroup and reorder items and groups, hide or show an item, change its size, set its art,
  and reset an item to the library defaults. Items are never deleted. Hiding only removes an item from the palette:
  placed fixtures of a hidden item keep drawing and can still be moved, rotated and deleted, and a save that keeps
  them is accepted; a save that places a hidden item anew is refused (422).
- [ ] **Size.** Default is the library footprint (e.g. plant 1 × 1, meeting table 3 × 2, door 1 × 2). The Admin can
  set 1–4 × 1–4 tiles (e.g. door 2 × 2). Size is stored for rotation 0 (direction `n`, or the only frame); at 90° and
  270° width and height swap. A size change is refused with 409 `item_in_use` while any room has the item placed (the
  message says how many rooms and that the fixtures must be removed first), so a saved layout never starts to
  overlap. A size change removes the item's custom images, because they no longer fit (the page warns first, OQ-52).
  Fixed sizes: `desk.single` (seat footprint and device slots, D61/D62), `chair.office` and `floor.*` (1 × 1) cannot
  be resized.
- [ ] **Art per direction.** For each direction the Admin picks a sprite from the bundled package browser (its frame
  must fit the item's size for that direction), or uploads a custom image, or leaves the library sprite. A missing
  direction falls back as in "Art per item"; one image is never rotated to fill another direction.
- [ ] **Custom image rules** (walls, windows and floors included): PNG only (no APNG: an `acTL` chunk is refused),
  width = 32 × the item's width in tiles for that direction, height = 32 × its height, or up to 32 px taller for an
  upward overhang (floors: exactly 32 × 32, no overhang); transparent background allowed; at most 64 KB. Stored in
  Google Drive and served behind the bearer exactly like device type images (SIM-036.5: header checked on the server
  before any DB or Drive call, server-chosen file name, org-scoped, ETag, `private, no-cache`). Removing an image
  falls back to the next art source.
- [ ] **Desk and chair.** The `desk.single` row can be renamed and given art per direction; its size and device slots
  do not change, and the look applies to every desk in the org. `chair.office` is not placeable (never in the
  palette): it only sets the art of the chair drawn at each seat.
- [ ] Every catalog change is audited (SYS-03) and is refused for any org but the token's (R6). Item art changes show
  in open maps at the next layout load.

**Room view (all roles)**
- [ ] `/rooms/<code>` shows the saved pixel layout read-only with LAY-06 overlays, zoom and pan (works at 390 px), and
  opens the seat detail (SEA-05) on click or keyboard focus.

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

### POR — My Portal (every tier)

D70 (Ming 2026-11-26). One page, "My Portal", for every tier, with three horizontal tabs: **My seat**, **My devices**,
**Profile**. It shows only the caller's own data and reuses the existing APIs and components (seat detail, map view,
requests, device actions, display name). Clean UI kit (D52); copy in `src/ui/copy/<feature>.ts` (D36).

**POR-01 Page and tabs**
- [ ] My Portal is in the nav for every tier (SHL-01). The three tabs are horizontal, keyboard-operable and
  addressable by URL (e.g. `?tab=seat|devices|profile`); the default tab is My seat. Works at 390 px.
- [ ] Every tab reads only the caller's own member (token `sub` + `org`, R6); there is no way to open another
  member's portal.
- [ ] A member with no linked member record, or a deactivated member, gets the same refusal as other org pages.

**POR-02 My seat**
- [ ] Lists every seat the member occupies (one person may have several, invariant 2): seat code, room, group/project
  tags, and "View on map", which opens `/rooms/<code>` with that seat selected (SEA-05 URL).
- [ ] Lists the member's seat requests with status, using "My requests" (REG-02): pending ones can be cancelled (D24).
- [ ] "Release seat" releases an occupied seat without approval after a confirmation (REG-03; DEV-06 runs).
- [ ] With no seat and no request, an empty state links to Rooms to request a seat (REG-01).

**POR-03 My devices**
- [ ] Lists the devices the member holds, from the "my devices" endpoint (DEV-12): name, type, inventory number,
  placement (seat code and role, or "in my inventory"), expiry date and **Overdue** (DEV-10).
- [ ] Per device, the owner actions that already exist: move / place at a seat or back to my inventory (DEV-03 to
  DEV-05), transfer to a member (DEV-08), return to the org inventory (DEV-09), request an extension (DEV-10), and
  cancel a pending handoff they started. Each action shows only when the rules allow it (e.g. none while a handoff is
  pending, except cancel).
- [ ] A "Waiting for my confirmation" list shows transfers to the member (device name, type, inventory number,
  sender, note) with Confirm and Decline (DEV-08).
- [ ] The overdue banner of DEV-10 shows here.
- [ ] Manager and Admin see their own devices here; the full org list stays on the Devices page (D70).

**POR-04 Profile: display name, email, role**
- [ ] The member edits their own display name (existing own-display-name API, D17; same validation).
- [ ] Email and simap role are shown read-only with "managed in mmlabs" (AUT-04).
- [ ] The profile photo (POR-05) and pixel character (POR-06) are edited here once those tickets ship.

**POR-05 Profile photo** (D71)
- [ ] The member uploads a real image as their profile photo, replaces it or removes it. Who else may remove it:
  OQ-61.
- [ ] Format and size limits: OQ-56 (precedent: device type images, D68, and SIM-036.5 storage: header checked on
  the server before any DB or Drive call, server-chosen file name, org-scoped, served behind the bearer with ETag and
  `private, no-cache`).
- [ ] Where the photo shows (shell avatar, member list, seat panel, ...) and the fallback without a photo: OQ-57. The
  photo is never drawn on the room map (LAY-06).
- [ ] Every change is audited (SYS-03) without the image bytes.

**POR-06 Pixel character** (D71)
- [ ] The member customises the 32 px layered avatar used on the room map (LAY-06) from preset choices per layer:
  skin, hair colour, hair style, shirt colour (the existing avatar ramps and frames; more parts only with new art). No
  free colour input and no upload.
- [ ] A live preview shows the character front and back at 1× and 2× before saving. "Reset" goes back to the look
  derived from `sub`.
- [ ] The choice is stored on the member (Member entity). A member without a stored look keeps the derived look, so
  existing members change nothing until they choose. The server accepts only preset values (422 otherwise).
- [ ] Open maps show the new look at the next layout load. Every change is audited (SYS-03).

### DSH — Dashboard

**DSH-01 Overview numbers**
- [ ] The dashboard shows rooms, seats, occupied seats, occupancy rate, and devices placed vs. in inventory
  (counts only; whether Users still get the org device counts is OQ-60).
  Everything is computed from the database when the page loads, with no cached counters (seatMGT's
  `layoutMeta.seatCount` is not carried over).
- [ ] It breaks occupancy down per room, with room cards and an occupancy ring as in seatMGT.

**DSH-02 Search and filter** (all roles)
- [ ] Search runs on the server across seats (code, occupant), devices (name, inventory no., MAC, owner) and members
  (name, employee code). Results are always current. For a User, device results contain only devices they hold
  (D69, DEV-12).
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
- [ ] Pages: Dashboard, Rooms, Room detail, Room editor (Admin), Members (Users: OQ-58), Devices (Manager+, D69),
  Approvals (Manager+), My Portal (every tier, D70). The home page stays the Dashboard unless OQ-54 changes it. The
  device-count badge for Users: OQ-59.

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

- **Language (D36, D40):** UI copy is **English** by default and v1 ships English only. All user-facing text lives in copy files (no literals in
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

- Local accounts, passwords or SSO/AD inside simap. Identity owns accounts and passwords; simap only hosts the
  Identity sign-up and password-reset screens (D53).
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
- **OQ-40** — answered D45, D46, D48. (Was: **OQ-40 Pixel-art assets.**) D42 sets free assets customised in-house as the direction. Open: sourcing
  rules (licences allowed), who customises and with which tool, where sources live, credits page. *Blocks: the sprite
  atlas ticket's final art (placeholder art can start).*
- **OQ-15** — D26. **OQ-16** — D27. **OQ-17** — D28. **OQ-18** — D29. **OQ-19** — D30. **OQ-21** — D31.
  **OQ-26** — D32. **OQ-29** — D33. **OQ-30** — D34. **OQ-8** — D25.

**Device lifecycle (D63, 2026-11-25).** Each has a default the tickets follow until Ming answers (reversible).
- **OQ-41 Who creates devices.** Ming: "khi admin thêm device". Default: Admin only; Users and Managers no longer
  create devices (supersedes D19 for create). *Blocks: SIM-037.1.*
- **OQ-42 Extension.** Default: the owner requests a new date, an Admin or Manager approves or rejects; an Admin or
  Manager can also edit the expiry directly. *Blocks: SIM-037.5.*
- **OQ-43 Expiry on transfer.** Default: the expiry date carries over to the recipient; an Admin or Manager can change
  it. *Blocks: SIM-037.3.*
- **OQ-44 Owner deactivated or removed.** Default: the device stays assigned (deactivation already returns placed
  devices to the owner's inventory, D34), pending handoffs to or from that member are cancelled, and an Admin can take
  the device back directly (DEV-09). *Blocks: SIM-037.4.*
- **OQ-45 Existing devices.** simap is not live, so only dev/test data exists. Default: the migration keeps each
  device's owner with no expiry; no backfill. *Blocks: SIM-037.1.*

**Map item catalog (LAY-07, D64, D66, 2026-11-25).**
- **OQ-46** — answered D66: 32 px per tile of the item's size, up to 32 px upward overhang, at most 64 KB, PNG, no APNG.
- **OQ-47** — answered D66: `desk.single` is a catalog row (rename, art per direction; size and slots fixed; one desk
  look per org); `chair.office` is a non-placeable row for chair art. Per-desk looks are a later phase.
- **OQ-48** — answered D66: custom images per direction (n/e/s/w); a missing direction falls back; never rotated.
- **OQ-49** — answered D66: the packed atlas of the licensed pack is committed; Credits page (SIM-033 re-scoped).
- **OQ-50** — answered D66: device types can also pick a bundled package sprite.
- **OQ-51** — answered D66: walls, windows and floors are catalog rows; custom upload allowed for them.

Still open (defaults stand until Ming answers; reversible):
- **OQ-52 Resizing an item that has custom images.** Answered 2026-11-25 (Ming: "mặc định"): the default below. Default: a size change (only possible while the item is not
  placed anywhere) deletes the item's custom images after a warning, since they no longer fit. Alternative: refuse
  the resize until the Admin removes the images. *Blocks: SIM-039.2.*
- **OQ-53 Package sprite on a resized item.** Answered 2026-11-25 (Ming: "mặc định"): the default below. Default: when the item's size differs from the sprite's frame, the
  sprite draws at its own size, bottom-left aligned in the footprint, and the whole footprint blocks; the Admin page
  suggests uploading fitted art. Alternative: nearest-neighbour stretch by whole tiles. *Blocks: SIM-039.4.*

**Device visibility and My Portal (D69–D71, 2026-11-26).** Each has a default the tickets follow until Ming answers
(reversible).
- **OQ-54 Home page.** Is My Portal the User's home page instead of the Dashboard? Default: the Dashboard stays the
  home page for every tier; My Portal is a nav entry. *Blocks: the My Portal page ticket (nav only).*
- **OQ-55 Devices at seats for Users.** Do room-map device sprites at seats still show to Users (sprite only, no
  details), and what does the seat panel show about devices a User does not hold? Default: sprites still draw for
  every tier, and for a User the layout API returns per such device only its type/slot (no id, name, inventory
  number, MAC or owner); the seat panel lists the User's own devices in full and only "N other devices" for the rest.
  *Blocks: the device visibility ticket (layout and seat APIs).*
- **OQ-56 Profile photo limits.** Default: PNG or JPEG (no APNG or other animation), square, 64 × 64 to 512 × 512 px,
  at most 256 KB, stored and served like device type images (SIM-036.5); no server-side resizing (no image library,
  stack unchanged). *Blocks: the profile photo ticket.*
- **OQ-57 Where the photo and the character show.** Default: the photo shows in the shell avatar, the Members list and
  member card, the seat panel's occupant row and the Profile tab; without a photo those places show the pixel
  character's head (or initials). The pixel character shows only on the room map and in its Profile preview.
  *Blocks: the profile photo ticket.*
- **OQ-58 Members list for Users.** Do Users still see the Members page? Default: yes (names, employee code, seats),
  without other members' devices (MEM-02, D69); the member picker for transfers (DEV-08) stays either way.
  *Blocks: the device visibility ticket (MEM-02 API), the My Portal page ticket (nav).*
- **OQ-59 Device badge in the nav for Users.** Default: Users have no Devices entry; the badge moves to the My Portal
  entry and counts transfers waiting for their confirmation plus their overdue devices. Manager+ keep the Devices badge
  (Admins: pending returns too) and get the same My Portal badge for their own items. *Blocks: the My Portal page
  ticket.*
- **OQ-60 Dashboard device counts for Users.** DSH-01 shows org-wide "devices placed vs. in inventory". Default: Users
  keep these counts (numbers only, no lists); device rows never appear. *Blocks: the device visibility ticket.*
- **OQ-61 Who may change a member's photo or character.** Default: only the member sets their own photo and
  character; a Manager+ can remove another member's photo (audited) but not upload one; the character is the
  member's alone. *Blocks: the profile photo ticket.*

New questions get the next free number (OQ-62).

## 12. Change log

| Date | Change |
|---|---|
| 2026-11-26 | D69–D71: Users see only the devices they hold (API-enforced on the device list, detail, history and search; a "my devices" endpoint for every tier); new My Portal page for every tier with My seat, My devices and Profile tabs; profile photo upload and a customisable pixel character stored on the member. Roles table, Member entity, SEA-05, DEV intro, DEV-02/08/10/11, MEM-02, LAY-06, DSH-01/02, SHL-01 amended; DEV-12 and POR-01 to POR-06 added; OQ-54 to OQ-61 open. |
| 2026-11-25 | D68 (SIM-040): device type images may be square PNGs from 24 × 24 to 100 × 100 px, at most 100 KB; the map scales them to the slot. |
| 2026-11-25 | D66: map item catalog, phase 1. Per-org rows for the existing library items (keyed by library key, seeded per org; placed fixtures keep `sprite_key`) drive the editor palette: Admins rename, regroup, reorder, hide/show, resize (1–4 × 1–4 tiles, refused while placed) and set art per direction (package sprite or custom PNG, fallback chain). Desk (one look per org), chair (art only), walls, windows and floors included; device types can pick a package sprite; the licensed atlas is committed. Art-per-item paragraph, LAY-01/03/06 amended, LAY-07 added, DEV-01 amended, MapItem entity; OQ-46 to OQ-51 answered; OQ-52, OQ-53 open. |
| 2026-11-25 | D63: device lifecycle. Devices start unowned in the org inventory (Admin creates); Admin/Manager assigns with note and optional expiry; owners transfer to a member who confirms (device lands unplaced in their inventory); owners return to the org inventory and an Admin confirms; unowned devices are never placed; overdue, in-app reminder and extension request; optional serial, manufacturer, brand; device detail page with history (DEV-01 to DEV-03, DEV-07 to DEV-11; OQ-41 to OQ-45). |
| 2026-11-24 | SIM-036.2 (D61): per-org device type catalog (name, desk slot, optional image) replaces the fixed suggested list; devices match a type by name; unknown types draw as a placeholder. |
| 2026-11-20 | First draft from Ming's `/idea` brief: seatMGT rebuild on Next.js + mmlabs Identity + shared Postgres, deployed like tudocuatui. |
| 2026-11-20 | v0.8 (D45–D51): asset rules; style 2 + UI A; seats managed without the map, logic/API first; 32 px tiles; per-room map in v1, floor map v2; name tags on hover/focus; 32 px layered avatars. |
| 2026-11-20 | v0.7 (D41–D44): pixel-art tile-grid room view and editor (supersedes D20), avatars; OQ-40 assets open. |
| 2026-11-20 | v0.6 (D35–D40; D39 SIM-022 English copy follow-up, D40 English only in v1): UTC+7 for all orgs; English UI copy by default in copy files; suggested device types; audit kept indefinitely. |
| 2026-11-20 | v0.5 from Ming's answers (D25–D34): no Viewer; cannot-seat flag blocks; CSV export + layout PNG if feasible; audit screen for Admins; room code editable (unique in org, seat codes follow); seat numbers never reused; placed device must go to inventory before delete; seat takes occupant's group; Identity sign-in links + account picker; members are deactivated or removed from the org, never deleted. No open questions left. |
| 2026-11-20 | v0.4 from Ming's answers (D16–D24): member directory now + Identity members endpoint later; display name; confirm-replace on assign; Manager moves any device; free-form editor; requests in any room, self only, cancellable, in-app status; self-release in v1. |
| 2026-11-20 | v0.3 from Ming's answers (D9–D15): Super Admin creates orgs; invitations from simap; every member is an Identity org account; several orgs per account; no plan limits; role keys; highest tier wins. Added OQ-38, OQ-39. |
| 2026-11-20 | v0.2 from Ming's answers (D1–D8): multi-org service with Identity orgs (`org_mode = required`), admins appointed by mmlabs Super Admin; token in browser + route handlers; tudocuatui tooling (pg, SQL forward-only migrations, Vitest light unit tests); no data migration; `simap.mmlabs.online`. Added AUT-06, OQ-32–37; closed OQ-1/2/3/5/6/7/24/31. |
