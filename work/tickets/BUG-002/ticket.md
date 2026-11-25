# BUG-002: Starting a transfer, return or extension always fails (orgQuery guard rejects the insert)

| Field | Value |
|---|---|
| Type | bug |
| State | IN_PROGRESS |
| Severity | S1 |
| Priority | P0 |
| Size | XS |
| Areas | api, db |
| Gate | none |
| Found in | unknown (found by the SIM-037.6 implementer on `main`, 2026-11-25) |
| Introduced in | v0.1.10 (transfer: SIM-037.3 d15230a; return: SIM-037.4 1f69d96); extension: SIM-037.5 6a6860b (unreleased) |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T14:32:15Z |
| PR | — |

## Report
Ming: "/bug cho lỗi orgQuery" (2026-11-25), after the SIM-037.6 run reported that `startTransfer`, `startReturn` and `startExtension` throw `orgQuery: SQL must filter org_id = $1` and that CI `test:db` is red on `main`.

## Environment
- `main` at the time of the report; local Postgres from `compose.dev.yml`; also CI `test:db` (red on main).

## Steps to reproduce
1. As a member who owns a device, open Devices and choose Transfer (or Give back, or Extend on an overdue device), fill the dialog and submit.
2. Or: run `pnpm test:db` and look at `src/server/devices/handoffs.db.test.ts`.

## Expected
- The handoff is created (`device_handoffs` row + `device.*_start` audit row) and the API answers 201 with the handoff.

## Actual
- The service throws `Error: orgQuery: SQL must filter org_id = $1` before reaching the database; the route answers 500 `internal`. No transfer, return or extension can ever be started. In `pnpm test:db` this is about 13 of the 19 failures on `main` (the error appears 32 times in the log).

## Root cause
**Confirmed** (reproduced by `pnpm test:db` on `origin/main` by the SIM-037.6 reviewer, and by reading the code).
- `src/server/devices/handoffs.ts:175-181` (`startTransfer`), `:233-237` (`startReturn`) and `:286-292` (`startExtension`) call `orgQuery` with `insert into device_handoffs (org_id, …) values ($1, $2, …)`.
- `orgQuery` (`src/server/http/org-scope.ts:21`) rejects any SQL text that does not match `/\borg_id\s*=\s*\$1\b/i`. A plain `values ($1, …)` insert has no `org_id = $1`, so it always throws.
- The codebase already has the accepted form for org-scoped inserts: `insert … select … from (select $1::uuid as org_id) o where o.org_id = $1::uuid` (`src/server/audit/write.ts:24`, `src/server/device-types/device-types.ts:89,109`).

## Scope
- Rewrite the three `device_handoffs` inserts in `src/server/devices/handoffs.ts` to the accepted `insert … select … from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form; nothing else.

## Out of scope
- Changing the `orgQuery` guard (`src/server/http/**` is a High path).
- The other pre-existing `test:db` failures on `main` (`devices.db.test.ts` `device_handoffs_decided_check`, `manage.db.test.ts` deactivate audit meta, `map-items.db.test.ts` ordering); they get their own bug if they are real.
- Switching `history.db.test.ts`'s `beginHandoff` helper to the real start functions (SIM-037.6, PR #102, not yet on main).

## Acceptance criteria
- [ ] A regression test reproduces the bug: it fails on `main` before the fix and passes after (the existing `handoffs.db.test.ts` start tests for transfer, return and extension, or a focused new one; name it in impl-log).
- [ ] Starting a transfer, a return and an extension each creates the handoff row and its `_start` audit row, scoped to the caller's org.
- [ ] All checks pass; the `orgQuery` error no longer appears in `pnpm test:db`.

## Technical notes
- Files: `src/server/devices/handoffs.ts` (three inserts).
- Test level: the bug test level in `.claude/loop.config.md` is a Vitest unit test, which cannot see SQL text against a real database; the regression evidence is `pnpm test:db` (`handoffs.db.test.ts`) on local Postgres, recorded in impl-log as failing before and passing after. A unit test that runs the start functions with a fake `Db` through the real `orgQuery` can also catch it at unit level.

## Notes / answers from Ming

## Handoff
