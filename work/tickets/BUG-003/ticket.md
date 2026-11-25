# BUG-003: devices.db test violates device_handoffs_decided_check (return flags test)

| Field | Value |
|---|---|
| Type | bug |
| State | DONE |
| Severity | S2 |
| Priority | P1 |
| Size | XS |
| Areas | db |
| Gate | none |
| Found in | main (CI `test:db`, run 45664750414 and later; also local Postgres) |
| Introduced in | SIM-037.4 (1f69d96, v0.1.10), against the SIM-037.1 constraint (c629b42) |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/110 |

## Report
Ming: "ok" (2026-11-26) to fixing the 3 `pnpm test:db` failures that keep CI red on `main`. Found during BUG-002 and SIM-034 (reviewers verified that they fail the same way on `origin/main`). While `test:db` fails, the later CI steps (format, build, the `image` job) never run on the self-hosted runner (SIM-034 AC2).

## Environment
- `main`, `pnpm test:db` against a throwaway Postgres (CI on MacBookPro, or local `compose.dev.yml`).

## Steps to reproduce
1. `pnpm test:db` with a local `DATABASE_URL`.

## Expected
- The test sets up a closed handoff the same way the product does, and its assertions run.

## Actual
- The test "return flags › canReturn for the owner and a Manager…" errors with `new row for relation "device_handoffs" violates check constraint "device_handoffs_decided_check"`.

## Root cause
**Confirmed** (CI log of run 45664750414). `src/server/devices/devices.db.test.ts:889-892` closes a transfer with a raw `update device_handoffs set status = 'cancelled', decided_by_id = $2` but does not set `decided_at`. The lifecycle migration's `device_handoffs_decided_check` needs the decided fields to be set together for a non-pending row. This is a test-data bug; product code is not involved.

## Scope
- Make the test's raw update set every field the check constraint needs (e.g. `decided_at = now()`), or use the existing fixture that closes a handoff correctly; do not weaken the constraint.

## Out of scope
- The other two `test:db` failures (their own BUG tickets in this batch). Any product behaviour change not needed for the fix.

## Acceptance criteria
- [ ] A regression test reproduces the bug: it fails on `main` before the fix and passes after (name the test).
- [ ] The expected behaviour above holds.
- [ ] All checks pass.

## Technical notes
- Files: `src/server/devices/devices.db.test.ts` (test data only).
- Test level: `pnpm test:db` on local Postgres (the bug only shows against a real database); record fail-before / pass-after in impl-log.

## Notes / answers from Ming

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: shared across the BUG-003/004/005 batch, 6 total, ~147k tokens (in/out split not reported): planner×3 sonnet 18k+19k+23k (fast lane), implementer×1 36k (all three, one commit each), reviewer×1 sonnet 33k (a review.md per bug), security-ai-generated-code-auditor×1 18k.
- Done: the regression test failed before the fix and passes after (recorded in impl-log). Review PASS, security 🟢. With all three, `pnpm test:db` has 0 failures. Batch PR #110 (branch bug/BUG-003, from the `/bug` "fix now" path).
- In progress / next: Ming merges #110. This PR's CI is the first run of format, build and the `image` job on MacBookPro (SIM-034 AC2).
- Gotchas: `pnpm test:db` does not pass a test filter through, so it always runs the whole suite.
