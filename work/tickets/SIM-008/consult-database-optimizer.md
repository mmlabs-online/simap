# Consult — database-optimizer (SIM-008, 2026-11-20)

## Findings

- seatMGT uses cuid strings, global uniques, stored `Seat.status`, `layoutMeta`, and three position sets (posX/posY, col/row/span, x/y/rotation/w/h). The app-only rules are "primary owner = occupant" and the partial index (only a comment in the schema). It has no org_id, no composite keys, and Member and Account are separate.
- The spec (§4, §5, §8) and D12, D26, D29, D30 and D34 settle everything else. Members are 1:1 with an Identity (`org`, `sub`), are never deleted (deactivate only), and room-code edits regenerate seat codes in one transaction. Seat numbers are never reused, so each room needs a counter.
- The migrator forbids begin/commit, `create index concurrently`, `create extension` and `grant`. So `gen_random_uuid()` (built in since PG13) is usable, but pgcrypto is not. All objects are new, so expand/contract is trivially satisfied for this first migration.

## Recommendations

**IDs and general**
1. Use `uuid primary key default gen_random_uuid()` on every table. Confirm the server is PG13+ in the plan. Use `timestamptz not null default now()` for `created_at`/`updated_at` (app sets `updated_at`; no trigger).
2. `org_id uuid not null` on every table, with no FK to an orgs table (orgs live in Identity).
3. On every table that is a FK target, declare both `primary key (id)` and `unique (org_id, id)`. Composite FKs reference `(org_id, id)`. Plain `id` stays the PK for app lookups, but every query also filters by `org_id` (R6). Alternative: `primary key (org_id, id)` only. That is stricter, but `where id =` without org then uses no index. Recommend the PK plus unique pair; the extra index is cheap at this size.

**Tables** (enums as `text` + `check`, since adding a value to a check later is expand-safe, while `alter type` is awkward in a transaction)
- `groups(id, org_id, name, color, created_at)`; unique `(org_id, name)`. Add `unique(org_id, id)`.
- `projects(id, org_id, code, name, created_at)`; unique `(org_id, code)`.
- `members(id, org_id, sub, email, display_name, employee_code null, group_id null, status text check in ('active','deactivated') default 'active', created_at, updated_at)`.
  - unique `(org_id, sub)`; partial unique `(org_id, employee_code) where employee_code is not null`.
  - FK `(org_id, group_id)` → groups `(org_id, id)`, `on delete set null` is not allowed for a composite FK that includes org_id. Use `on delete set null (group_id)` (PG15+) or the default NO ACTION and let the service clear tags in the same transaction, as D34 says. Default: NO ACTION, service clears tags.
  - Index `(org_id, lower(display_name))`, or a plain `(org_id, display_name)`, for search.
- `rooms(id, org_id, code, name, description, floor, seat_counter int not null default 0, created_at, updated_at)`; unique `(org_id, code)`. D29: a code change is an update plus a seat code rewrite in one transaction, so seat codes must not be a unique-deferred problem (see Risks).
- `seats(id, org_id, room_id, seq int, code, occupant_id null, group_id null, project_id null, x, y, rotation default 0, w, h (double precision null), cannot_seat bool not null default false, cannot_seat_reason text null, created_at, updated_at)`.
  - Keep one position set (x, y, rotation, w, h).
  - unique `(org_id, code)`, unique `(org_id, room_id, seq)`, unique `(org_id, id)`.
  - Composite FKs for room, occupant, group and project. Room: `on delete restrict`. Seat delete is guarded by the service (SEA-01).
  - check `seq > 0`; check `(cannot_seat_reason is null or cannot_seat)`.
  - Do not add a status column.
  - Optionally enforce "cannot-seat blocks assignment" with `check (not cannot_seat or occupant_id is null)`. It does hold for new assignments, but flagging an occupied seat would need an unassign first. Default: leave it to the service; the spec only says "blocks assignment".
  - Indexes: `(org_id, room_id)` is covered by the seq unique. Add `(org_id, occupant_id) where occupant_id is not null`, plus partial indexes on `group_id` and `project_id` for the FK checks.
- `devices(id, org_id, name, type, inventory_number, mac null, owner_id not null, seat_id null, role text not null default 'secondary' check in ('primary','secondary'), created_at, updated_at)`.
  - unique `(org_id, inventory_number)`; partial unique `(org_id, mac) where mac is not null`.
  - Store MAC normalised (lowercase, colon-separated; a check on the format is optional).
  - FKs `(org_id, owner_id)` → members and `(org_id, seat_id)` → seats.
  - check `(seat_id is not null or role = 'secondary')`: inventory devices are never primary.
  - **One primary per seat:** `create unique index devices_one_primary_per_seat on devices (org_id, seat_id) where role = 'primary' and seat_id is not null;`
  - Indexes: `(org_id, owner_id)`, `(org_id, seat_id)`.
- `seat_requests(id, org_id, seat_id, subject_id, created_by_id, status text check in ('pending','approved','rejected','cancelled') default 'pending', note, decided_by_id null, decided_at null, created_at, updated_at)`.
  - Composite FKs to seats and to members (three member FKs).
  - check `(status = 'pending') = (decided_at is null)`. This is optional, because cancel by the requester may or may not set decided_by. Default: add a lighter check that `decided_at` is null when pending.
  - Recommended: partial unique `(org_id, seat_id, subject_id) where status = 'pending'` to stop duplicate pending requests. Confirm against REG scope.
  - Indexes: `(org_id, status, created_at desc)` for the Approvals page, `(org_id, seat_id)`, `(org_id, subject_id)`.
- `layout_fixtures(id, org_id, room_id, kind text check in the LAY-03 list, x, y, rotation, w, h, label null, created_at, updated_at)`. Composite FK to rooms, `on delete restrict` or a cascade that the service handles. Index `(org_id, room_id)`. Use real columns, not JSON, so the room view is queryable.
- `invitations(id, org_id, email, role text, invited_by_sub, status text check in ('pending','accepted','revoked','expired'), identity_invitation_id text null, created_at, expires_at null)`. No token column. Partial unique `(org_id, lower(email)) where status = 'pending'`.
- `audit_log(id uuid, org_id, actor_sub text not null, action text, entity text, entity_id uuid null, meta jsonb null, created_at timestamptz default now())`.
  - Do not FK `entity_id` (the rows may be gone later).
  - Indexes `(org_id, created_at desc, id desc)` for the paginated list and `(org_id, entity, entity_id, created_at desc)`.
  - Append-only: optionally add a trigger that rejects update/delete. Default: document append-only; add the trigger only if cheap (it is a few lines).
  - `meta` must never hold tokens or raw claims (spec §8).

**Primary owner = occupant (invariant 3)**
- A DB-level enforcement is feasible with a trigger, but two tables are involved. Changing the occupant, or the device's owner/seat/role, can each break it. A constraint trigger would have to run on both `devices` and `seats` and handle invariant 8 (the primary becomes secondary when the occupant leaves). That demotion belongs in the service transaction; the trigger would only be a safety net.
- Recommended default: a `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` on devices (after insert or update of role, owner_id, seat_id) that raises if `role='primary'` and the seat's `occupant_id` is distinct from the device's `owner_id`. Add a matching one on seats (after update of occupant_id) that checks the seat's primary device. Deferred, so the service can reorder statements inside its transaction. Write the trigger functions in `do $$ ... end $$;` or `create function ... $$ ... $$ language plpgsql` with care, because the README rules about `end $$;` apply. Test both paths manually.
- If the plan wants less risk: document it as service-only, and put the trigger in a follow-up. Because this is the High path and the acceptance criteria only demand the partial index, the trigger is optional. Default: include the triggers and test them (the ticket says "service + trigger or documented app-only").

**Migration and seed**
- One file `db/migrations/<ts>_init.sql`, with a timestamp later than SIM-002's file. Create the tables in dependency order: groups, projects, members, rooms, seats, devices, seat_requests, layout_fixtures, invitations, audit_log. No `if not exists` is needed, because the migrator tracks applied files; "second run changes nothing" is satisfied by the checksum record.
- Seed `db/seed-dev.ts` or `.mjs` (plain Node with `pg`, using `DATABASE_URL`). Refuse to run if `NODE_ENV=production` or the host is not local. Insert fake data for two fake orgs (hard-coded fake uuids, `*.example` emails, fake `sub`s), so cross-org isolation can be checked by hand. Make it idempotent (`on conflict do nothing`) and run inside one transaction. Add a `seed:dev` script; add it to the Commands doc and `.claude/loop.config.md` only if it counts as a check.
- Extend `db/migrations/README.md` with the table list, the org rule and the PK-plus-`(org_id, id)` convention.
- Verification SQL for the manual test plan: second primary insert fails; a cross-org FK insert fails; the same room code in two orgs succeeds; the same code in one org fails.

## Risks

1. D29: the room-code change rewrites seat codes. With a non-deferrable unique `(org_id, code)`, an update of many rows in one statement can fail transiently when codes swap. Codes derive from the room code plus the number, so a rename to a new unused code never collides with itself. The collision case is another room already using the target code; that is the legitimate failure. No fix needed, but note it.
2. A composite FK with `org_id` means `on delete set null` nulls `org_id` too (not allowed, since it's NOT NULL). That is why the plan above uses NO ACTION or `set null (col)`. Check the server major version (the column-list form needs PG15+).
3. Member deletion never happens (D34), so `restrict` everywhere on member FKs is correct.
4. Deferred constraint triggers add subtle behaviour and need careful tests, because the unit tests only cover pure helpers. A mistake here makes the schema block valid writes. Mitigate with the manual psql cases listed.
5. Per-org unique on `inventory_number` and MAC means one physical device cannot appear twice in an org. That matches the spec. If a device moves to another org, the old row stays; this is out of scope.
6. High path: the PR needs Ming's review and the PLAN gate.

## Open questions (with proposed defaults)

1. Server version PG15+? Default: assume 15; avoid PG15-only syntax, use NO ACTION.
2. Enforce primary owner = occupant with deferred triggers in this ticket? Default: yes, with manual tests; fall back to app-only if the triggers prove awkward.
3. Unique pending request per (seat, subject)? Default: yes, partial unique index.
4. `audit_log.actor_sub` NOT NULL (system actions use a fixed value such as `system`)? Default: not null.
5. Should audit_log be made append-only with a trigger? Default: yes, a small trigger.
6. Should `cannot_seat` be a hard DB check against an occupant? Default: no, service only.
7. Are floor and the seat counter needed as columns on rooms? Default: yes; `floor text null`, `seat_counter int not null default 0` (never decremented, D30).
