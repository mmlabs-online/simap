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
