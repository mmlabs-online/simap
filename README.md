# simap

mmlabs app (replaces the inactive SeatMGT). Purpose and scope: to be written in `docs/spec-v1.md` (start with `/idea`).

## Local database

1. `docker compose -f compose.dev.yml up -d` (Postgres 17 on `127.0.0.1:5432`, trust auth, no password).
2. Put `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` in `.env.local` (never commit it).
3. `pnpm migrate` applies `db/migrations/*.sql` (rules: `db/migrations/README.md`); `pnpm migrate:smoke` runs a
   scripted check in a throwaway database.
4. `pnpm dev`, then `curl -i localhost:3000/api/readyz`: 200 when the database answers, 503 otherwise.

Deployed to the mmlabs home server through `mmlabs-online/deployment` like the other mmlabs apps.

Agent workflow: see `CLAUDE.md`.
