# SIM-008: v1 database schema

| Field | Value |
|---|---|
| State | DONE |
| Priority | P0 |
| Size | M |
| Areas | db, security |
| Gate | plan-approval |
| Depends on | SIM-002 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T06:36:18Z |
| PR | — |

## Goal
Create every v1 table in one forward-only migration, scoped by org, with the locked invariants backed by constraints where Postgres allows.

## Scope reference
spec §4 Domain model, §5 Locked invariants, §8 Database; D3, D12, D26, D29, D30, D34; CLAUDE.md R2, R6.

## Scope
- Tables: rooms (code unique per org, seat counter), seats (code unique per org, seq unique per room, occupant, group/project tags, geometry, cannot-seat flag + reason), members (org + `sub` unique, email, display name, employee code unique per org, group, status active/deactivated), devices, seat_requests, groups, projects, layout fixtures, invitations sent from simap (no token), audit_log.
- `org_id uuid not null` on every table; unique keys and foreign keys include `org_id` (composite FKs).
- Constraints: one occupant per seat (column), one primary device per seat (partial unique index), primary owner = occupant (checked in the service + trigger or documented app-only), no stored seat status.
- Dev seed script with fake data only (never production data).

## Out of scope
- Domain services and routes (SIM-010 and later). Row-level security (not in D2's tooling).

## Acceptance criteria
- [ ] `pnpm migrate` on an empty database creates the schema; a second run changes nothing.
- [ ] Every table has `org_id not null`, and no FK can point to a row of another org (composite keys).
- [ ] Inserting a second primary device on a seat fails at the DB.
- [ ] Room code and seat code are unique per org, not globally.
- [ ] `db/migrations/README.md` documents the tables and the org rule; the seed contains no real data.

## Technical notes
- Files: `db/migrations/<ts>_init.sql`, `db/migrations/README.md`, `db/seed-dev.*`; reference seatMGT `prisma/schema.prisma` (drop the 3 overlapping position sets, stored status, layoutMeta).
- Risks / open questions: High path (migration). Consult database-optimizer. Pick ID format (uuid) here.

## Test plan
- Unit: pure helpers only (e.g. seat code format); schema checked by the manual run.
- Manual: migrate a local DB, try the constraint violations by hand with psql.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-1) — Ming: "duyệt hết theo mặc định" (every default in plan.md accepted).

## Handoff
