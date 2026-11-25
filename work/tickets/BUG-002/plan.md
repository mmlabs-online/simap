Status: READY

# Plan — BUG-002: Starting a transfer, return or extension always fails (orgQuery guard rejects the insert)

## Scope summary
From ticket.md `## Scope`: "Rewrite the three `device_handoffs` inserts in `src/server/devices/handoffs.ts` to the accepted `insert … select … from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form; nothing else."
Out of scope (ticket): changing the `orgQuery` guard (`src/server/http/**` is a High path); other pre-existing `test:db` failures; `history.db.test.ts` helper.

Root cause confirmed at file:line:
- `src/server/http/org-scope.ts:21` rejects SQL not matching `/\borg_id\s*=\s*\$1\b/i`.
- `src/server/devices/handoffs.ts:175-181` (`startTransfer`), `:231-237` (`startReturn`), `:285-292` (`startExtension`) use a bare `values ($1, …)` insert, so the guard throws before the DB is reached.
- Accepted form exists at `src/server/audit/write.ts:22-24`, `src/server/devices/devices.ts:350-353`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A regression test reproduces the bug: fails on `main` before the fix, passes after | New unit test `handoffs.test.ts` (fails on the unfixed code with `orgQuery: SQL must filter org_id = $1`, passes after); plus `pnpm test:db` on `handoffs.db.test.ts` start tests (transfer, return, extension) recorded in impl-log as failing before and passing after |
| 2 | Starting a transfer, a return and an extension each creates the handoff row and its `_start` audit row, scoped to the caller's org | `pnpm test:db`: `handoffs.db.test.ts` › "owner (user) starts: pending row, device unchanged, one audit row", `handoffs (db): return` › "owner starts; nothing else changes; …", and the extension start test in the same file |
| 3 | All checks pass; the `orgQuery` error no longer appears in `pnpm test:db` | `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`, `pnpm test:db`; grep the `test:db` output for `orgQuery: SQL must filter` = 0 hits |

## Ming verification after merge
None. (Optional smoke: transfer a device in a deployed environment.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/devices/handoffs.ts` | Rewrite the 3 inserts (lines ~175-181, ~231-237, ~285-292) to the `insert … select … from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id` form; renumber/cast params | The fix | No |
| `src/server/devices/handoffs.test.ts` (new) | Unit regression test with a fake Db through the real `orgQuery` | First test of a bug ticket at the bug test level | No |

No High path is touched: `src/server/http/**` (the `orgQuery` guard) is read only, not edited; `src/server/devices/**` is not listed as High in the ticket or in what I read. Checked against the High paths in `.claude/loop.config.md` (lines 44-45): neither `src/server/devices/handoffs.ts` nor its tests match (`src/server/**/auth*`, `**/config.*`, `src/server/identity/**`, `src/server/http/**`, etc. do not). Tier: not High.

## Data model / migration
None. The SQL selects the same columns into the same table; no schema change (R2 n/a).

## API contract
None (the 201 response already documented; only the 500 is removed).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/devices/handoffs.test.ts` › "startTransfer reaches the device_handoffs insert through orgQuery" (FIRST; regression) | Fake `Db` (pattern as `src/server/groups/groups.test.ts:33`: `{ query, connect: async () => ({ query, release }) }`) returning canned rows (active actor member, active recipient, device row with owner, no pending, insert returning `{id}`; then loadOne rows). Before fix: rejects with `orgQuery: SQL must filter org_id = $1`. After: resolves; the insert call has `$1` = scope.orgId. |
| same file › "startReturn reaches the insert" | Same for return |
| same file › "startExtension reaches the insert" | Same for extension |
| same file › "each insert filters org_id = $1 and binds the org first" | Assert insert SQL text matches `/org_id\s*=\s*\$1::uuid/` and `values[0] === scope.orgId`, with the expected param positions (transfer: $2 device, $3 from, $4 to, $5 requested_by, $6 note; return; extension incl. new_expires_on) |
| `src/server/devices/handoffs.db.test.ts` (existing start tests, unchanged) | Real-DB proof: row + `device.*_start` audit row; run before the fix (fail) and after (pass), evidence in impl-log |

If the fake-Db sequence for `actorMemberId`/`loadOne` proves too brittle, route the fake by SQL-text matching (a `query` that switches on `text.includes(...)`) rather than call order.

## Approach
1. Write `handoffs.test.ts` first; run `pnpm test` and confirm it fails with the orgQuery error. Run `pnpm test:db` (local Postgres via `docker compose -f compose.dev.yml up -d`, `DATABASE_URL` local) and record the failing start tests in impl-log (fail-before).
2. Rewrite the three inserts, keeping parameter order meaning identical:
   - transfer: `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note) select o.org_id, $2::uuid, 'transfer', $3::uuid, $4::uuid, $5::uuid, $6::text from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id` with values `[deviceId, owner_id, v.toMemberId, me, v.note]` (unchanged).
   - return: same shape; `to_member_id` literal `null`, values `[deviceId, owner_id, me, v.note]` → `$2::uuid, 'return', $3::uuid, null, $4::uuid, $5::text`.
   - extension: `$2::uuid, 'extension', $3::uuid, null, $3::uuid, $4::text, $5::date` (verify the `new_expires_on` column type in `db/migrations` before choosing the cast); values `[deviceId, me, v.note, v.newExpiresOn]` (unchanged).
   The extension insert reuses `$3` twice (from and requested_by): use the same cast (`$3::uuid`) both times to avoid a Postgres "inconsistent types deduced" error. Param mapping to preserve (`$1` = org is bound by `orgQuery`): `$2` = deviceId, `$3` = me, `$4` = note, `$5` = newExpiresOn.
3. Re-run `pnpm test`, `pnpm test:db` (pass-after, record), `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`. Run `pnpm format` only on touched files.
4. Do not edit `org-scope.ts`, other `test:db` failures, or `history.db.test.ts` (R4). Rules: R6 (insert still scoped by the verified `scope.orgId`), R7 (no auth codes added), R5 (tests green).

## Specialist input used
None (no consult files).

## Assumptions
- `test:db` failures in `devices.db.test.ts`, `manage.db.test.ts`, `map-items.db.test.ts` remain after this fix; they are not in scope, so criterion 3 means "the orgQuery error is gone", not "test:db fully green". The implementer lists the remaining failures in impl-log.
- Hotspot: SIM-037.6 (PR #102) is already merged (a4548e9 on main); `history.db.test.ts`'s `beginHandoff` helper is untouched. No other open ticket was found editing `handoffs.ts`; the orchestrator should check for open SIM-037.x tickets.
- A unit test with a fake Db is a valid bug-level regression here because the failure is thrown by the pure-JS guard before any DB access.

## Blocking questions
None

## Split proposal
None (XS, about 40 changed lines in source plus a small test).
