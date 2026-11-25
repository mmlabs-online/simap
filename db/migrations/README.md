# Database migrations

Plain SQL applied by `node db/migrate.js` (`pnpm migrate` locally; the one-shot `migrate` container in production).
The app never migrates.

- File name: `YYYYMMDDHHMMSS_snake_case.sql`. Any other `.sql` name is a configuration error.
- Forward-only, no down files. Never edit an applied migration (its checksum is recorded); add a new file.
- Each file runs in its own transaction. Do not write `begin`/`commit`, `create index concurrently`,
  `create extension`, `grant` or `create role`. The runner refuses a file with a transaction-control statement before
  it connects. `create extension`, `grant` and `create role` are Ming's steps on the shared server, not migrations.
- Expand then contract: every prefix of the sequence must work with the previous app image, so a rollback to an older
  image stays safe. Add columns/tables first, remove them in a later release. Rollback = previous image, fix forward,
  or restore the pre-release backup.
- In `do $$ ... $$` blocks close with `end $$;`, never a bare `end;`; `end if;` is fine.
- R6: every org table has `org_id NOT NULL`, and every unique key and foreign key includes `org_id`.
- The migrator holds a session advisory lock: run it over a direct connection, never through a transaction-mode pooler.

## Schema (v1)

`20261120150000_init.sql` creates every v1 table (spec section 4): `groups`, `projects`, `members`, `rooms`, `seats`,
`devices`, `seat_requests`, `layout_fixtures`, `invitations`, `audit_log`.

- Org rule: every table has `org_id uuid not null` (the Identity org; no FK, orgs live in Identity). Every FK target has
  `unique (org_id, id)` and every FK is `foreign key (org_id, x) references t (org_id, id)`, so a reference never
  crosses orgs. Every unique key and index except the `id` primary key starts with `org_id`. `pnpm schema:check` verifies
  this from the catalogue.
- Ids are `uuid default gen_random_uuid()` (PostgreSQL 13+). Enums are `text` plus a named check. Constraints and
  indexes have explicit names (`<table>_<cols>_key|_fkey|_check|_idx`) so services can map errors.
- Delete rules: group, project and occupant references are NO ACTION (the service clears them in the same
  transaction, D34); seats to rooms and devices to seats and owners are RESTRICT; `seat_requests` to seats and
  `layout_fixtures` to rooms are CASCADE.
- No stored seat status (derived). `rooms.seat_counter` only grows (D30).
- Invariant 3 (a primary device is owned by the seat occupant) is a deferred constraint trigger on `devices` and
  `seats`: it raises at COMMIT with SQLSTATE `23514`, constraint `devices_primary_owner_is_occupant`. A service that
  changes the occupant must demote the old primary in the same transaction (invariant 8). Services map this error.
- `audit_log` is append-only (update, delete and truncate raise `55000`).
- `members.profile_confirmed_at` (SIM-007, `20261120190000_members_profile_confirmed_at.sql`): null = profile not
  confirmed yet; set once by the member's first `PATCH /api/me`, never reset.
- Tile layout (SIM-015.1, `20261122120000_room_tile_layout.sql`): `rooms.grid_w/grid_h` (both null = no saved layout),
  `rooms.floor_zones` (jsonb array), `rooms.layout_version`; `seats` and `layout_fixtures` get `tile_x`, `tile_y`,
  `tile_rotation`, `sprite_key` (all four null or all four set). `layout_fixtures.kind` is nullable: a tile-placed
  fixture stores `kind = null` and is identified by `sprite_key`; legacy rows keep `kind` and have no tile placement.
  The old free-form columns stay until a later contract migration. Bounds and overlap are checked in `src/lib`.
- Device types (SIM-036.2, `20261124160000_device_types.sql`): `device_types` is the per-org catalog (name, desk slot,
  optional Drive image id and `image_version`). The name is unique per org through `device_type_key()` (ASCII
  whitespace collapsed, Vietnamese capitals lowered by a map, `lower()`; diacritics kept), which is also how
  `devices.type` matches a type (no FK, D61). `device_type_catalogs` marks an org whose catalog was seeded (PC, Laptop,
  Monitor, IP phone, Other): an insert trigger on `members` seeds an org once, so a deleted seed type stays deleted.
- Device lifecycle (SIM-037.1, `20261125120000_device_lifecycle.sql`, D63): `devices.owner_id` is nullable (null = org
  inventory). New nullable columns `serial` (unique per org when set), `manufacturer`, `brand`, `holding_note`,
  `holding_expires_on` (a `date`). Invariant 5 is the immediate check `devices_unowned_not_placed_check` (unowned =>
  no seat), plus `devices_unowned_no_holding_check`. The invariant 3 trigger is deferred, so returning a device to the
  org inventory must clear owner, seat and holding data in one UPDATE. `device_handoffs` (transfer / return /
  extension; at most one pending per device) cascades from `devices`; the service refuses a device delete while one is
  pending.
  Rollback note: the migration is forward-only. Rolling the app back to the previous image after unowned devices
  exist is unsafe, because the old code assumes every device has an owner; return or delete the org-inventory
  devices first (or restore from backup). Re-adding `owner_id not null` needs that cleanup first.
- Dev seed: `pnpm seed:dev` loads fake data (fixed UUIDs, `@simap.example` emails, invented names) into a local
  database only; it refuses non-local hosts and `NODE_ENV=production`. Never put real data in the seed.
