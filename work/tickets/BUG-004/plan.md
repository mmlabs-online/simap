Status: READY

# Plan — BUG-004: manage.db deactivate test expects the old audit meta (no cancelledHandoffs)

## Scope summary
Bug ticket (fast lane); scope reference is ticket.md:
- "Update the expected audit meta to include `cancelledHandoffs` (0 in that scenario, or assert the real count); do not change `manage.ts`."
- Root cause confirmed: `src/server/members/manage.ts:461` writes `cancelledHandoffs: cancelled.length` (added in SIM-037.4). `src/server/members/manage.db.test.ts:145-151` still does `expect(a[0].meta).toEqual({released, seats, devices, demoted, cancelledRequests})`, and `toEqual` fails on the extra key.
- The scenario in the test at line 109 (`world()` plus `deactivateMember(..., true)`) creates no handoffs. Only the separate test at line 359 calls `addTransfer`/`addHandoff`. So the real count here is 0.
- Out of scope: the other two `test:db` failures (BUG-003, BUG-005) and any product change.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The regression test fails before the fix and passes after | The test is `manage.db.test.ts › deactivate with release: seats cleared, primary demoted, owned placed devices returned, others untouched, requests cancelled, one audit row`. Run `pnpm test:db` on the base: this test fails on the meta mismatch (`cancelledHandoffs: 0` unexpected). Run it again after the fix: it passes. Both runs are recorded in impl-log. |
| 2 | The expected audit meta matches what `deactivateMember` writes | Diff shows only `cancelledHandoffs: 0` added to the expected object at lines 145-151, and `manage.ts` is untouched. |
| 3 | All checks pass | `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm test:db` (this test green; any remaining failures are only BUG-003/BUG-005's tests, named in impl-log). |

## Ming verification after merge
None. CI `test:db` on `main` is the final confirmation, but it stays red until BUG-003 and BUG-005 also land.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/members/manage.db.test.ts` | Lines 145-151: add `cancelledHandoffs: 0,` to the expected meta object | Stale expectation | No |

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/members/manage.db.test.ts` › "deactivate with release: seats cleared, … one audit row" (existing test, expectation updated) | Audit meta includes `cancelledHandoffs: 0`. This is the regression test: it fails before the edit and passes after. |

The test at line 359 already asserts `cancelledHandoffs: 3` for the non-zero case, so no new test is needed.

## Approach
1. Run `pnpm test:db` with a local `DATABASE_URL` (`docker compose -f compose.dev.yml up -d`). Record the failure of the test above in impl-log (fail-before).
2. Edit `manage.db.test.ts` lines 145-151 to add `cancelledHandoffs: 0`.
3. Rerun `pnpm test:db`. Record that the test passes (pass-after). Then run `pnpm format:check`, `pnpm typecheck` and `pnpm test`.
4. Rules: R4 (only the listed file), R5 (green checks). No product code, schema, or auth is touched.

## Specialist input used
None (no consult files; the `db` consult is not needed for a one-line test expectation).

## Assumptions
- High path: none touched. The only file is a test under `src/server/members/`, which matches no High path pattern in `.claude/loop.config.md`. It is not under `src/server/**/auth*`, `identity/` or `http/`.
- Hotspot: BUG-003 and BUG-005 are planned in parallel. They are expected to edit other tests, not this line range. If one of them also edits `manage.db.test.ts`, expect a trivial rebase.
- The security review trigger matches `src/server/` paths, but a test-only diff of one line is Low risk. The orchestrator decides whether to run it.

## Blocking questions
None.

## Split proposal
None.
