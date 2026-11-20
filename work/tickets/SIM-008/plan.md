Status: READY

# Plan — SIM-008: v1 database schema

## Scope summary
Ticket goal: "Create every v1 table in one forward-only migration, scoped by org, with the locked invariants backed by
constraints where Postgres allows." Scope reference: spec §4, §5, §8; D3, D12, D26, D29, D30, D34; CLAUDE.md R2, R6.

- spec §4: "Every entity carries `org_id` (the Identity org UUID from the token's `org` claim); "unique" below means
  unique **within the org**, and references never cross orgs (composite keys or checks with `org_id`)." Entity table
  (Room, Seat, Member, Device, SeatRequest, Group, Project, AuditLog) at `docs/spec-v1.md:123-132`.
- spec §5 (`docs/spec-v1.md:134-146`): "Where Postgres can express an invariant as a constraint, the DB enforces it
  too." Invariants 1 (one occupant), 3 (one primary device, owned by the occupant), 6 (status never stored),
  7 (seat codes from room code + sequence), 8 (primary becomes secondary when the occupant leaves).
- spec §8 Database (`docs/spec-v1.md:468-475`): "Every org table has `org_id NOT NULL` and every unique key and foreign
  key includes it." "Invariants are backed by constraints where Postgres allows, for example a partial unique index for
  one primary device per seat."
- spec §7 (`docs/spec-v1.md:442-444`): no stored status, real `floor` field, seat count computed, "One set" of seat
  geometry; "Dev and test seeds may exist but contain no production data" (`:451-452`).
- spec LAY-03 (`:333-335`): fixtures "door, window, room, stairs, elevator, server, cabinet, pillar, blocked area,
  label". REG-01 (`:348`): "A second identical pending request (same seat and member) creates nothing new." REG-02
  (`:359-360`): "a badge counts requests decided since the user last opened it". MEM-01 (`:292`): deactivate, keep
  history. MEM-01 (`:303-304`): pending invitations sent from simap are listed. SYS-03 (`:399-402`): audit row with
  actor `sub`, action, entity, id, small meta; filter by actor, entity type and date range, paginated. DEV-01
  (`:258`): "MAC (unique if set; format checked)". DEV-03 (`:271-272`): "The check runs in the app and again in the DB."
- D3: "plain SQL, forward-only, checksummed, expand/contract … no down files." D12: "simap keeps no person records
  without an account. A member is simap's profile of one account in one org." D26: "per-seat 'không xếp chỗ' flag with
  a reason; it blocks assignment and requests; status stays derived." D29: "Room code is editable; unique within the
  org; changing it regenerates the room's seat codes in one transaction." D30: "Seat numbers are never reused (per-room
  counter)." D34: "Members are never deleted in simap … Unused-group/project delete warns and clears tags."
- `db/migrations/README.md:8-15`: no `begin`/`commit`, `create index concurrently`, `create extension`, `grant`;
  `do $$ … end $$;`; R6 rule.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `pnpm migrate` on an empty database creates the schema; a second run changes nothing. | CI step "migrate CLI" (`.github/workflows/ci.yml:38-44`) now applies the real init file and greps "up to date" on the second run. Locally: `docker compose -f compose.dev.yml up -d`, then `pnpm schema:check` prints `pass: 1 first run applies init` and `pass: 1 second run is up to date`. |
| 2 | Every table has `org_id not null`, and no FK can point to a row of another org (composite keys). | `pnpm schema:check` catalogue checks: `pass: 2 every table has org_id not null`, `pass: 2 every FK includes org_id on both sides`, `pass: 2 every unique key/index except the id PK includes org_id`; behavioural checks `pass: 2 cross-org seat→room FK refused (23503)` and `pass: 2 cross-org device→owner FK refused (23503)`. Also read the migration: every `references` is `(org_id, x) references t (org_id, id)`. |
| 3 | Inserting a second primary device on a seat fails at the DB. | `pnpm schema:check`: `pass: 3 second primary device on a seat refused (23505 devices_one_primary_per_seat)`. |
| 4 | Room code and seat code are unique per org, not globally. | `pnpm schema:check`: `pass: 4 same room code in two orgs accepted`, `pass: 4 duplicate room code in one org refused (23505)`, same pair for seat code. |
| 5 | `db/migrations/README.md` documents the tables and the org rule; the seed contains no real data. | Read `db/migrations/README.md` (new "Schema" section: table list, org rule, `(org_id, id)` convention, deferred triggers). Read `db/seeder.js`: only fixed fake UUIDs, `@simap.example` emails, invented names. `pnpm schema:check` runs the seed twice: `pass: 5 seed is idempotent`. `db/seeder.test.ts` proves the seed refuses non-local hosts and `NODE_ENV=production`. |
| 6 | (ticket scope) Primary owner = occupant backed by the DB (invariant 3, DEV-03 "again in the DB"). | `pnpm schema:check`: `pass: 6 primary device owned by a non-occupant refused at commit (23514)`, `pass: 6 occupant change without demote refused at commit (23514)`, `pass: 6 occupant change with demote in the same transaction accepted`. |
| 7 | (ticket scope) No stored seat status; cannot-seat flag + reason; seat counter. | `pnpm schema:check`: `pass: 7 seats has no status column`, `pass: 7 reason without cannot_seat refused (23514)`, `pass: 7 seq <= 0 refused (23514)`. |
| 8 | All standard checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- The shared mmlabs Postgres server is PostgreSQL 13 or newer (`gen_random_uuid()` is built in from 13), and the
  `simap` role owns the `simap` database so it can create tables, functions and triggers. Check with
  `select version();` before the first production `migrate` (SIM-021). The implementer adds this as a line in
  `work/ming-todo.md`.
- None other: the migration is applied to production only by the `migrate` container (SIM-004/SIM-021), never in
  this ticket.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/<YYYYMMDDHHMMSS>_init.sql` | Create: all v1 tables, constraints, indexes, 3 trigger functions + triggers (timestamp = implementation time) | Goal, AC1-4, 6, 7 | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | Add a "Schema (v1)" section: table list, org rule, `(org_id, id)` FK convention, FK delete rules, deferred triggers raise at COMMIT, append-only audit, seed rules | AC5 | **Yes** (`db/migrations/**`) |
| `db/seeder.js` | Create (`// @ts-check`, plain ESM like `db/migrator.js`): `assertDevSeedTarget({ databaseUrl, nodeEnv })` (pure guard) and `seedDev(client)` (fake data, `on conflict do nothing`) | Ticket scope "Dev seed script"; AC5 | No |
| `db/seed-dev.js` | Create: CLI entry like `db/migrate.js` — reads `DATABASE_URL`, calls the guard, runs `seedDev` in one transaction, never prints the URL | Ticket scope | No |
| `db/seeder.test.ts` | Create: Vitest unit tests for `assertDevSeedTarget` | R5, ticket "Unit: pure helpers only" | No |
| `scripts/schema-check.mjs` | Create: scripted DB check modelled on `scripts/migrate-smoke.mjs` (throwaway DB, real `db/migrations`, catalogue + constraint cases, seed twice, drop DB) | Makes AC1-7 reproducible for the reviewer and CI instead of hand psql | No |
| `package.json` | Add scripts `"seed:dev": "node --env-file-if-exists=.env.local db/seed-dev.js"` and `"schema:check": "node --env-file-if-exists=.env.local scripts/schema-check.mjs"` | Run the seed and the check | No |
| `.github/workflows/ci.yml` | Add a step "schema check" after "migrate smoke" (lines 45-48), same `DATABASE_URL` env, `run: node scripts/schema-check.mjs` | AC1-7 checked on every PR | No (only `release*`/`deploy*` workflows are High) |
| `CLAUDE.md` (project) | Commands line: add `pnpm schema:check` (needs a DB) and `pnpm seed:dev` (local DB only, fake data) | CLAUDE.md "Keep … in sync" | No |
| `.claude/loop.config.md` | Prepare section (line 22): note that db tickets also run `pnpm schema:check` against the local compose DB. Not added to Checks (Checks need no DB). | Keep loop config in sync with commands | No |
| `work/ming-todo.md` | Add one unchecked line: confirm production Postgres ≥ 13 and the `simap` role owns the database before the first production migrate | Ming verification above | No |

No file under `src/` changes. No `.env.example` change (no new env names).

## Data model / migration
One file `db/migrations/<ts>_init.sql`, no `begin`/`commit`, no extensions, no `if not exists` (the migrator records
the file; a second run is a no-op by checksum). PG13+ features only: no `on delete set null (col)` and no
`nulls not distinct` (PG15). Every enum is `text` + `check`. Every table: `id uuid primary key default
gen_random_uuid()`, `org_id uuid not null` (no FK: orgs live in Identity), `created_at timestamptz not null default
now()`; mutable tables also `updated_at timestamptz not null default now()` (the app sets it; no trigger). Every FK
target also has `unique (org_id, id)` and every FK is `foreign key (org_id, x) references t (org_id, id)` (MATCH
SIMPLE: a null `x` skips the check, so nullable composite FKs work). Required text columns get
`check (btrim(col) <> '')`. Give every constraint and index an explicit name (`<table>_<cols>_key|_fkey|_check|_idx`)
so services can map errors.

Create in this order.

**groups** — `name text not null`, `color text not null default '#5B6CF0'` check `color ~ '^#[0-9A-Fa-f]{6}$'`.
Unique `(org_id, name)`; unique `(org_id, id)`.

**projects** — `code text not null`, `name text not null`. Unique `(org_id, code)`; unique `(org_id, id)`.

**members** — `sub uuid not null` (Identity sub; AUT-02 requires a UUID), `email text not null`, `display_name text
not null`, `employee_code text null`, `group_id uuid null`, `status text not null default 'active'` check in
(`active`, `deactivated`), `requests_seen_at timestamptz null` (REG-02 badge), `created_at`, `updated_at`.
Unique `(org_id, sub)`; partial unique index `(org_id, employee_code) where employee_code is not null`; unique
`(org_id, id)`. FK `(org_id, group_id)` → groups, NO ACTION (D34: the service clears tags in the same transaction).
Index `(org_id, group_id) where group_id is not null`.

**rooms** — `code text not null`, `name text not null`, `description text null`, `floor text null`,
`seat_counter integer not null default 0` check `>= 0` (D30, never decremented), `created_at`, `updated_at`.
Unique `(org_id, code)`; unique `(org_id, id)`.

**seats** — `room_id uuid not null`, `seq integer not null` check `> 0`, `code text not null`, `occupant_id uuid
null`, `group_id uuid null`, `project_id uuid null`, `x double precision not null default 0`, `y double precision not
null default 0`, `rotation double precision not null default 0`, `w double precision null`, `h double precision null`,
`cannot_seat boolean not null default false`, `cannot_seat_reason text null`, `created_at`, `updated_at`.
**No status column** (invariant 6); one occupant column (invariant 1). Unique `(org_id, code)`; unique
`(org_id, room_id, seq)`; unique `(org_id, id)`. Check `cannot_seat_reason is null or cannot_seat`. FKs: room →
rooms RESTRICT; occupant → members NO ACTION; group → groups NO ACTION; project → projects NO ACTION. Partial
indexes `(org_id, occupant_id)`, `(org_id, group_id)`, `(org_id, project_id)` where the column is not null.

**devices** — `name text not null`, `type text not null`, `inventory_number text not null`, `mac text null` check
`mac ~ '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'` (stored lowercase, colon-separated), `owner_id uuid not null`, `seat_id uuid
null`, `role text not null default 'secondary'` check in (`primary`, `secondary`), `created_at`, `updated_at`.
Check `seat_id is not null or role = 'secondary'` (inventory is never primary). Unique `(org_id, inventory_number)`;
partial unique `(org_id, mac) where mac is not null`; **`create unique index devices_one_primary_per_seat on devices
(org_id, seat_id) where role = 'primary' and seat_id is not null;`** FKs: owner → members RESTRICT; seat → seats
RESTRICT (SEA-01 / D31: a seat with devices cannot be deleted; a placed device is returned to inventory first).
Indexes `(org_id, owner_id)`, `(org_id, seat_id) where seat_id is not null`.

**seat_requests** — `seat_id uuid not null`, `subject_id uuid not null`, `created_by_id uuid not null`, `status text
not null default 'pending'` check in (`pending`, `approved`, `rejected`, `cancelled`), `note text null`,
`decided_by_id uuid null`, `decided_at timestamptz null`, `created_at`, `updated_at`. Check
`(status = 'pending') = (decided_at is null)`. FKs: seat → seats **ON DELETE CASCADE** (forced room delete "drops
their pending requests", ROO-01; history stays in audit_log); subject, created_by, decided_by → members NO ACTION.
Partial unique `seat_requests_one_pending_idx (org_id, seat_id, subject_id) where status = 'pending'` (REG-01).
Indexes `(org_id, status, created_at desc)`, `(org_id, seat_id)`, `(org_id, subject_id, created_at desc)`.

**layout_fixtures** — `room_id uuid not null`, `kind text not null` check in (`door`, `window`, `room`, `stairs`,
`elevator`, `server`, `cabinet`, `pillar`, `blocked`, `label`), `x`, `y`, `rotation` (`double precision not null
default 0`), `w`, `h` (`double precision null`), `label text null`, `created_at`, `updated_at`. FK room → rooms
**ON DELETE CASCADE** (fixtures belong to the room, LAY-03). Index `(org_id, room_id)`.

**invitations** — `email text not null`, `role text not null` check in (`simap:admin`, `simap:manager`, `simap:user`)
(D14), `invited_by_sub uuid not null`, `status text not null default 'pending'` check in (`pending`, `accepted`,
`revoked`, `expired`), `identity_invitation_id text null`, `expires_at timestamptz null`, `created_at`, `updated_at`.
**No token column** (AUT-03). Partial unique `(org_id, lower(email)) where status = 'pending'`. Index
`(org_id, created_at desc)`.

**audit_log** — `actor_sub uuid not null`, `action text not null`, `entity text not null`, `entity_id uuid null` (no
FK: the row may be gone), `meta jsonb null`, `created_at`. No `updated_at`. Indexes `(org_id, created_at desc, id
desc)` (keyset pagination), `(org_id, entity, entity_id, created_at desc)`, `(org_id, actor_sub, created_at desc)`.

**Triggers** (plpgsql, `create function … as $$ … $$ language plpgsql;` — the migrator skips dollar-quoted bodies,
`db/migrator.js:136-146`):
1. `devices_primary_owner_check()` + `create constraint trigger devices_primary_owner_trg after insert or update of
   role, owner_id, seat_id on devices deferrable initially deferred for each row execute function …`. At fire time
   **re-read the device by `(org_id, id)`** (NEW is stale under deferral); if it is gone or not primary, return null;
   otherwise raise unless `exists (select 1 from seats s where s.org_id = d.org_id and s.id = d.seat_id and
   s.occupant_id = d.owner_id)`. Raise with `errcode = '23514', constraint = 'devices_primary_owner_is_occupant'`.
2. `seats_primary_owner_check()` + `create constraint trigger seats_primary_owner_trg after update of occupant_id on
   seats deferrable initially deferred for each row …`. Re-read the seat; raise the same error if a primary device on
   it has `owner_id is distinct from` the current `occupant_id`. Invariant 8's demotion stays in the service
   transaction (DEV-06); the trigger is the safety net, checked at COMMIT.
3. `audit_log_append_only()` + `before update or delete on audit_log for each row` and `before truncate on audit_log
   for each statement`; raises `audit_log is append-only`.

**Downgrade:** none (D3, forward-only). Expand/contract is trivially met: every object is new and no previous image
reads them. Rollback = previous image (it ignores the tables) or fix forward.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `db/seeder.test.ts` › `assertDevSeedTarget › accepts localhost, 127.0.0.1 and ::1` | Seed guard happy path |
| `db/seeder.test.ts` › `assertDevSeedTarget › refuses any other host` (e.g. a LAN IP, a hostname, a host that merely starts with `localhost.`) | Seed never touches shared/prod DB |
| `db/seeder.test.ts` › `assertDevSeedTarget › refuses NODE_ENV=production even on localhost` | Guard |
| `db/seeder.test.ts` › `assertDevSeedTarget › refuses a missing or unparsable DATABASE_URL without echoing it` | Guard; no URL in error messages (R3) |
| `db/seeder.test.ts` › `seed data › uses only @simap.example emails and fixed fake ids` (inspect the exported data constants) | AC5 "no real data" |
| `scripts/schema-check.mjs` (scripted, needs Postgres; run by CI and `pnpm schema:check`) — steps named as in the AC table: 1 first run / second run; 2 org_id not null on every table, FK and unique catalogue checks (`pg_constraint`, `pg_index`), cross-org seat→room and device→owner FK refusals; 3 second primary; 4 room and seat code per-org; 5 seed twice → equal row counts; 6 trigger cases (non-occupant primary at commit, occupant change without demote at commit, with demote accepted, primary without seat refused 23514); 7 no `status` column on seats, reason-without-flag and `seq <= 0` refused; extra: duplicate pending request refused (23505) and allowed again after reject; audit_log update and delete refused; MAC upper-case refused (23514). Each case runs in its own transaction and checks the SQLSTATE, never prints row values or the URL. | AC1-7 and the invariants |

No `src/` unit tests: no pure TypeScript logic is added (seat code generation belongs to SIM-010, ROO-02).

## Approach
1. Write `db/migrations/<ts>_init.sql` in the order above; comment each table with the spec ID it serves. Run
   `docker compose -f compose.dev.yml up -d` and `pnpm migrate` twice.
2. Write `db/seeder.js`: export `assertDevSeedTarget` (parse with `new URL`, allow hostnames `localhost`,
   `127.0.0.1`, `::1`/`[::1]` only, refuse `nodeEnv === "production"`, error messages never contain the URL) and
   `seedDev(client)` with constant data: two fake orgs (fixed UUIDs such as `00000000-0000-4000-8000-0000000000a1`),
   per org: 2 groups, 1 project, 4 members (fake subs, `@simap.example` emails, invented Vietnamese names with
   diacritics in NFC, one `deactivated`), room `C302` **in both orgs** plus one more room, seats with `seq`
   1..n and `seat_counter` = n (codes written literally, e.g. `C302-01`), one `cannot_seat` seat with a reason, one
   primary device owned by its seat's occupant, one secondary (borrowed) device, one inventory device, one pending
   request, a few fixtures, one pending invitation, a couple of audit rows. Every insert uses `on conflict do nothing`.
3. Write `db/seed-dev.js` (pattern of `db/migrate.js`): no `DATABASE_URL` → exit 2; guard; `begin` → `seedDev` →
   `commit` (deferred triggers fire here) → print counts only.
4. Write `db/seeder.test.ts`.
5. Write `scripts/schema-check.mjs` from `scripts/migrate-smoke.mjs` (throwaway `simap_schema_<hex>` database, drop
   `with (force)` in `finally`, `check(step, ok)` output). Import `runMigrations` and `seedDev`.
6. `package.json` scripts, CI step, project `CLAUDE.md` Commands line, `.claude/loop.config.md` Prepare note,
   `work/ming-todo.md` line, README "Schema (v1)" section.
7. Run `pnpm schema:check`, `pnpm seed:dev` twice locally, then all Checks.

Rules: **R2** one forward-only file, no down, not edited after apply. **R6** `org_id not null` everywhere, every unique
and FK includes `org_id`, enforced by schema-check catalogue queries. **R3** no new env names; scripts never print
`DATABASE_URL`, SQL text or PG `detail`. **R1** untouched (no `src/` change). **R5** the guard has unit tests and the
SQL has the scripted check in CI. **R4** no services, routes, RLS or seat-code helper here.

## Specialist input used
From `consult-database-optimizer.md`:
- Adopted: uuid + `gen_random_uuid()` (rec. 1); no orgs table (2); `primary key (id)` + `unique (org_id, id)` with
  composite FKs (3); text + check enums; NO ACTION for group/project tags, service clears them (D34, Risk 2); all
  table shapes, with the changes listed below; one geometry set; no status column; `check (cannot_seat_reason is null
  or cannot_seat)`; `devices_one_primary_per_seat`; `seat_id is not null or role = 'secondary'`; partial unique pending
  request (REG-01 already requires it, so not optional); audit indexes; no FK on `audit_log.entity_id`; deferred
  constraint triggers for invariant 3 on both tables (open question 2 default); append-only audit trigger (5); seed
  with two fake orgs, idempotent, refusing non-local hosts; README extension; the verification cases (turned into
  `scripts/schema-check.mjs` instead of hand psql).
- Changed: `members.sub`, `audit_log.actor_sub`, `invitations.invited_by_sub` are `uuid` instead of `text` (AUT-02
  verifies `sub` is a UUID; v1 has no system actor — every SYS-03 change has a user). Added
  `members.requests_seen_at` (REG-02 badge needs it). Added an audit index on `(org_id, actor_sub, created_at desc)`
  (D28 actor filter). MAC format check adopted as a DB check (DEV-01 "format checked"). `seat_requests` → seats is
  CASCADE and `layout_fixtures` → rooms is CASCADE (consult left these open). Strict check
  `(status = 'pending') = (decided_at is null)` instead of the lighter one: cancel also sets `decided_at`.
- Rejected: `check (not cannot_seat or occupant_id is null)` (consult default too; D26 says only "blocks
  assignment"); a display-name search index (diacritic-insensitive search needs `unaccent` or a folded column, which
  SIM-017 decides; at hundreds of rows a scan is fine); the seed script in TypeScript (plain `// @ts-check` JS matches
  `db/migrator.js` and runs on Node 22 without a loader).

## Assumptions
Each is a decision Ming can override at plan approval; the stated default is what the implementer builds.
1. **Invariant 3 in the DB with deferred constraint triggers** (consult Q2). Default: yes. Errors surface at COMMIT
   with SQLSTATE 23514 and constraint `devices_primary_owner_is_occupant`; the README tells SIM-012/013 to map that.
   Alternative: app-only, triggers in a follow-up.
2. **Request history on seat delete:** `seat_requests` → seats `on delete cascade`. Default: yes (seatMGT behaviour;
   history stays in `audit_log`). Alternative: RESTRICT and the service deletes requests first.
3. **Fixtures on room delete:** `layout_fixtures` → rooms `on delete cascade`. Default: yes.
4. **Append-only `audit_log` trigger** (update, delete, truncate refused). Default: yes. A future org-purge feature
   would need a new migration to relax it.
5. **`sub` columns as `uuid`**, `audit_log.actor_sub not null`, no "system" actor. Default: yes.
6. **`members.requests_seen_at`** added now for REG-02. Default: yes (avoids a second migration in SIM-014).
7. **MAC DB check** (lowercase, colon-separated). Default: yes; the API normalises input before insert.
8. **Codes compare exactly** (`C302` ≠ `c302` in the unique keys); SIM-010's validator normalises codes (e.g.
   upper-case, trim). Default: exact. Group names likewise exact.
9. **`cannot_seat` vs occupant:** service-only, no DB check (consult Q6). Default: service-only.
10. **Seat code consistency** (`code` = room code + `-NN`) is enforced by the service (ROO-02, D29), not the DB.
    Default: service-only; the unique `(org_id, code)` still prevents duplicates. D29's code rewrite of one room cannot
    collide with itself (consult Risk 1).
11. **Postgres version:** production is PG13+ (dev and CI use `postgres:17`, `compose.dev.yml:5`, `ci.yml:21`).
    Default: assume it; no PG15-only syntax is used. Ming confirms (see Ming verification).
12. **Schema check in CI.** Default: add `schema:check` as a CI step (adds a few seconds against the existing service
    container).
13. **Seed location** `db/seeder.js` + `db/seed-dev.js`: if SIM-004's image copies all of `db/`, the seed ships in the
    image but refuses any non-local host. Default: accept; SIM-004 may exclude it.
14. **Hotspots (expect a rebase):** batch 2026-11-20-1 runs SIM-004 and SIM-005 alongside. `package.json` (SIM-005
    likely adds `jose`; SIM-004 may add scripts), `.github/workflows/ci.yml` (SIM-004 may add image steps), project
    `CLAUDE.md` Commands line (SIM-004) and `work/ming-todo.md` (both) may conflict. All edits here are additive
    single lines/steps, so conflicts are trivial. SIM-003 (DONE) does not touch these db files.

## Blocking questions
None.

## Split proposal
None, with a note: the estimate is ~650-800 changed lines (migration ~280, schema check ~250, seed + guard + test
~200, docs ~60), above the ~400 guide. Most of it is declarative SQL and test scaffolding, and the ticket requires
one migration, so splitting the SQL is not possible. Default: one PR. If Ming wants a smaller High PR, the option is to
move the seed (`db/seeder.js`, `db/seed-dev.js`, `db/seeder.test.ts`, `seed:dev`, AC5 seed half, schema-check step 5)
to a follow-up ticket SIM-008.1 (Low/Medium, no High path).
