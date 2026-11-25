Status: READY

# Plan — BUG-003: devices.db test violates device_handoffs_decided_check (return flags test)

## Scope summary
Bug report (ticket.md): "The test 'return flags › canReturn for the owner and a Manager…' errors with `new row for relation "device_handoffs" violates check constraint "device_handoffs_decided_check"`."
Scope: "Make the test's raw update set every field the check constraint needs (e.g. `decided_at = now()`) ... do not weaken the constraint." Out of scope: the other two `test:db` failures (BUG-004, BUG-005) and any product change.

Root cause confirmed. `src/server/devices/devices.db.test.ts:888-891` runs `update device_handoffs set status = 'cancelled', decided_by_id = $2 where id = $1` and leaves `decided_at` null. The constraint at `db/migrations/20261125120000_device_lifecycle.sql:55` is `check ((status = 'pending') = (decided_at is null))`. A non-pending row therefore needs `decided_at` set, and the update leaves a cancelled row with `decided_at` null, so the update fails. `decided_at timestamptz null` is defined at line 49. This is a test-data bug only. Product code is not involved.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Regression test fails before the fix and passes after | The regression test is the existing `devices (db): return flags › canReturn for the owner and a Manager, not another user, not while pending; canTakeBack for an Admin, not while a return is pending`. Run `pnpm test:db -- src/server/devices/devices.db.test.ts -t "return flags"` on a local Postgres. Before the fix it errors with `device_handoffs_decided_check`, and after the fix it passes. The implementer records both runs in impl-log. |
| 2 | The test closes the handoff the way the product does and its assertions run | Diff shows only `decided_at = now()` added to the raw update. The assertions at lines 893-896 execute and pass. |
| 3 | All checks pass | `pnpm test:db` (full), `pnpm test`, `pnpm typecheck`, `pnpm format:check`. Failures from BUG-004 and BUG-005 may remain until those tickets merge. The reviewer confirms that any remaining failures are those two and not this test. |

## Ming verification after merge
CI `test:db` on the self-hosted runner no longer fails on this test. Full green also needs BUG-004 and BUG-005.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/devices/devices.db.test.ts` (lines 888-891 only) | Change the raw update to `set status = 'cancelled', decided_by_id = $2, decided_at = now() where id = $1` | The check constraint needs `decided_at` for a non-pending row | No |

No High path is touched. The `.sql` migration is only read. The constraint is not changed.

## Data model / migration
None. The constraint is not weakened and no migration is added (R2 is not triggered).

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/devices/devices.db.test.ts` › `devices (db): return flags › canReturn for the owner and a Manager, ...` (existing, fixed) | Fail before and pass after, with a closed transfer fixture that satisfies `device_handoffs_decided_check`. No new test is added. |

## Approach
1. Before editing, run `pnpm test:db -- src/server/devices/devices.db.test.ts -t "return flags"` against the local `compose.dev.yml` Postgres. Record the `device_handoffs_decided_check` failure in impl-log.
2. Add `decided_at = now()` to the update at lines 888-891.
3. Re-run the same command and then the full `pnpm test:db`. Record the pass in impl-log.
4. Run `pnpm format:check` and `pnpm typecheck`.
Rules: R4 (test data only), R5 (checks run), and the constraint stays as is.

## Specialist input used
None (fast lane, no consult).

## Assumptions
- Hotspot: BUG-004 and BUG-005 may also edit `src/server/devices/devices.db.test.ts` or other `*.db.test.ts` files. This plan touches only lines 888-891, so any rebase conflict should be trivial. I did not check their plans.
- `addHandoff` and `addTransfer` fixtures already set `decided_at` correctly for non-pending rows. Only this raw update is wrong. Not re-verified beyond the failing line.

## Blocking questions
None

## Split proposal
None
