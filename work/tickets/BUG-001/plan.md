Status: READY

High path: NONE. Both files are `*.db.test.ts` under `src/server/`; none matches a High path (not `src/server/**/auth*`, not `identity/`, not `http/`, no SQL, no config). Gate none, Size XS, fast lane (no consult).

# Plan — BUG-001: `pnpm test:db` red on main after SIM-037.2

## Scope summary
Ticket Scope: "Update the three DB-test assertions to the current rules and columns. No product code change unless the reviewer finds the code wrong."
Out of scope: "Any change to export columns, device permissions or SIM-037.x behaviour."

Root cause verified against the code (confirmed, no correction needed; the code is right, the tests are stale):
- Export columns: `src/server/export/export.ts:54-68` is Name(0), Type(1), Inventory number(2), MAC(3), Serial(4), Manufacturer(5), Brand(6), Role(7), Owner name(8), Owner employee code(9), Location(10), Room code(11), Seat code(12). `map` at `export.ts:79-93` matches, and the owner join is `m.id = d.owner_id` (`export.ts:73`). `exportRows` already returns `columns` (`export.ts:119`), so tests can look indices up by name. Stale reads: `export.db.test.ts:51` (`[5]`), `:52` (`[7]`), `:53` (`[9]`), `:70-73` (`[7]`, `[5]`, `[6]`, `[9]`).
- Update permission: `canEdit = isOwner || tier === "admin"` (`src/lib/devices/rules.ts:9`, D19); `updateDevice` checks it right after the row lock and before any uniqueness work (`src/server/devices/devices.ts:398-399`), so a `"user"` on an Admin-created, unowned device (D63: "Devices an Admin adds have no owner and sit in the org inventory") gets 422 `not_allowed`. The test creates `b` via `createDevice(..., "admin", ...)` (`devices.db.test.ts:517`), so it is unowned.
- Extra find: `devices.db.test.ts:525` (the `mac_taken` update) has the same stale `"user"` tier. It is not in the ticket's failure list only because the test aborts at 523 first. It would fail next, so it must be fixed in the same change (same cause, same test).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Regression: the three named tests fail on main before the fix, pass after | impl-log records `pnpm test:db` BEFORE edits (expect 3 failed, 187 passed: `devices.db.test.ts` uniqueness test; `export.db.test.ts` "two orgs..." and "an unowned device row...") and AFTER (all green). Needs local Postgres (`docker compose -f compose.dev.yml up -d`, `DATABASE_URL=postgres://simap:simap@127.0.0.1:5432/simap`). |
| 2 | Devices export DB test asserts owner name, owner code, location, room code at current positions, looked up by column name | Read the diff: a helper builds `col = (name) => result.columns.indexOf(name)` (fail if -1) and all device assertions use it; no numeric index remains for devices rows. `pnpm test:db` green on `export.db.test.ts`. |
| 3 | Uniqueness test reaches the uniqueness check with an allowed tier and still proves 409 `inventory_number_taken` / `mac_taken` on update | Diff: both `updateDevice` calls at `:522` and `:525` use `"admin"`. Test asserts `{ ok:false, status:409, code:"inventory_number_taken" }` and `mac_taken`, and `kept.inventory_number === "INV-2"`. |
| 4 | All checks pass incl. `pnpm test:db` locally | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, `pnpm test:db` all green; output in impl-log. |

## Ming verification after merge
Confirm the `ci` job (step `db integration tests`) is green on the PR/main, then release 0.1.8 handling (held deployment PR `release/simap-v0.1.8`) is Ming's step. Otherwise None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/export/export.db.test.ts` | Look device columns up by name from `result.columns`; fix assertions at lines 49-53 and 65-74 | stale indices after SIM-037.2 inserted Serial/Manufacturer/Brand | No |
| `src/server/devices/devices.db.test.ts` | Lines 522 and 525: tier `"user"` -> `"admin"` | `canEdit` allows only owner or Admin; device is unowned (D63) | No |

No product code changes (code verified correct).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| FIRST: run `pnpm test:db` unchanged on main; record the 3 failures (regression evidence, before) | Bug reproduces: `devices.db.test.ts` › "uniqueness: duplicate inventory number -> 409 ..." (422 `not_allowed`); `export.db.test.ts` › "two orgs: each export lists only its own rows" (`null` vs "Nguyễn a"); `export.db.test.ts` › "an unowned device row has empty Owner name ..." (TypeError) |
| `export.db.test.ts` › "two orgs..." (edit) | Placed device: Owner name = "Nguyễn a", Owner employee code = "E1", Location = "placed", Room code = "R-a-01" via named columns. Note `Nguyễn` diacritics preserved. |
| `export.db.test.ts` › "an unowned device row ..." (edit) | Row found by Location === "inventory"; Owner name, Owner employee code, Room code all `null`. Also assert the helper's `columns` contains the expected names so a rename fails loudly. |
| `devices.db.test.ts` › "uniqueness: ..." (edit) | Admin update to duplicate inventory number -> 409 `inventory_number_taken`; Admin update to same MAC in another spelling -> 409 `mac_taken`; value unchanged afterwards. |

Optional (not required, skip unless trivial): none; the existing permission refusal is already covered elsewhere (`not_allowed` for user) and the unit tests in `rules`.

## Approach
1. Start local Postgres; run `pnpm test:db` on unchanged main; save the 3-failure output summary for impl-log (before).
2. Edit `export.db.test.ts`: add a small local helper `colIndex(columns, name)` that throws if the name is missing; use `devA.columns` / `r.columns`; replace numeric indices for devices only (seats/members assertions at lines 44-46, 56-61 are unaffected and stay).
3. Edit `devices.db.test.ts` lines 522 and 525 to `"admin"`.
4. Run `pnpm format` (oxfmt) then all checks, then `pnpm test:db`; record after output (expect 190 passed, 0 failed) in impl-log.
CLAUDE.md: R4 (stay in the two files), R5 (no PASS without green checks incl. test:db; do not skip it as SIM-037.2 did).

## Specialist input used
None (fast lane: Size XS, Gate none).

## Assumptions
- Postgres is available locally to the implementer; if not, the implementer must say so and the ticket cannot PASS (R5), since the bug lives in the DB suite.
- Hotspots: none known; SIM-037.x tickets are merged. Check `work/backlog.md` for open tickets touching these two test files before rebase.
- Bug test level: the loop config says Vitest unit, but the bug is only visible at the DB integration level, so the "regression test" is the existing three DB tests, shown red before and green after.

## Blocking questions
None.

## Split proposal
None.
