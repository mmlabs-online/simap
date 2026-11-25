# BUG-005: map-items list order differs between Postgres collation and the test's JS sort

| Field | Value |
|---|---|
| Type | bug |
| State | PLANNING |
| Severity | S2 |
| Priority | P1 |
| Size | XS |
| Areas | db, api |
| Gate | none |
| Found in | main (CI `test:db`, run 45664750414 and later; also local Postgres) |
| Introduced in | SIM-039.1 (0403587) |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-25T17:59:30Z |
| PR | — |

## Report
Ming: "ok" (2026-11-26) to fixing the 3 `pnpm test:db` failures that keep CI red on `main`. Found during BUG-002 and SIM-034 (reviewers verified that they fail the same way on `origin/main`). While `test:db` fails, the later CI steps (format, build, the `image` job) never run on the self-hosted runner (SIM-034 AC2).

## Environment
- `main`, `pnpm test:db` against a throwaway Postgres (CI on MacBookPro, or local `compose.dev.yml`).

## Steps to reproduce
1. `pnpm test:db` with a local `DATABASE_URL`.

## Expected
- The map item list order is deterministic and the test checks it the same way the database orders it.

## Actual
- The test "list is ordered by lower(name), then builtin_key" fails: Postgres returns `…"wall t e", …, "wall top"` in an order that differs from JS `[...names].sort()` (spaces and punctuation are ordered differently under the database's locale collation than by code point).

## Root cause
**Confirmed** (CI log shows the diff around `"wall t e"` / `"wall top"`). `src/server/map-items/map-items.ts:75` orders by `lower(name), builtin_key` with the database default collation (locale-aware, e.g. en_US.UTF-8 ignores spaces at the first level). The test at `src/server/map-items/map-items.db.test.ts:74-83` compares with JS default sort (UTF-16 code points). Which side to change is a planner decision: make the SQL order explicit (e.g. `collate "C"`, or another stated rule consistent with D67 "sort by name") so it does not depend on the server locale, or compare in the test with the same rule. Note that the UI may also sort; keep them consistent.

## Scope
- Make the list order independent of the database locale (or make the test use the database's rule), keeping D67 "sort by name".

## Out of scope
- The other two `test:db` failures (their own BUG tickets in this batch). Any product behaviour change not needed for the fix.

## Acceptance criteria
- [ ] A regression test reproduces the bug: it fails on `main` before the fix and passes after (name the test).
- [ ] The expected behaviour above holds.
- [ ] All checks pass.

## Technical notes
- Files: `src/server/map-items/map-items.ts` and/or `src/server/map-items/map-items.db.test.ts`.
- Test level: `pnpm test:db` on local Postgres (the bug only shows against a real database); record fail-before / pass-after in impl-log.

## Notes / answers from Ming

## Handoff
