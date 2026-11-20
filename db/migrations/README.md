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
- Dev seed: `pnpm seed:dev` loads fake data (fixed UUIDs, `@simap.example` emails, invented names) into a local
  database only; it refuses non-local hosts and `NODE_ENV=production`. Never put real data in the seed.
