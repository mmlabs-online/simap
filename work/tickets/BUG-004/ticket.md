# BUG-004: manage.db deactivate test expects the old audit meta (no cancelledHandoffs)

| Field | Value |
|---|---|
| Type | bug |
| State | IN_PROGRESS |
| Severity | S2 |
| Priority | P1 |
| Size | XS |
| Areas | db |
| Gate | none |
| Found in | main (CI `test:db`, run 45664750414 and later; also local Postgres) |
| Introduced in | SIM-037.4 (1f69d96, v0.1.10) added `cancelledHandoffs` to the deactivate audit meta |
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
- The test's expected audit meta matches what `deactivateMember` writes.

## Actual
- The test "deactivate with release: seats cleared, … one audit row" fails: the audit row's meta has `cancelledHandoffs: 0`, which the expected object lacks.

## Root cause
**Confirmed** (CI log; `src/server/members/manage.ts:461` writes `cancelledHandoffs: cancelled.length` since SIM-037.4). `src/server/members/manage.db.test.ts:109+` still expects the older meta shape. A test expectation is stale; product behaviour is intended (SIM-037.4).

## Scope
- Update the expected audit meta to include `cancelledHandoffs` (0 in that scenario, or assert the real count); do not change `manage.ts`.

## Out of scope
- The other two `test:db` failures (their own BUG tickets in this batch). Any product behaviour change not needed for the fix.

## Acceptance criteria
- [ ] A regression test reproduces the bug: it fails on `main` before the fix and passes after (name the test).
- [ ] The expected behaviour above holds.
- [ ] All checks pass.

## Technical notes
- Files: `src/server/members/manage.db.test.ts` (expectation only).
- Test level: `pnpm test:db` on local Postgres (the bug only shows against a real database); record fail-before / pass-after in impl-log.

## Notes / answers from Ming

## Handoff
