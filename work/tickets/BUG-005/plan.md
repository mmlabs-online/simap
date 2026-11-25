Status: READY

# Plan — BUG-005: map-items list order differs between Postgres collation and the test's JS sort

## Scope summary
Bug report in ticket.md: "Expected: The map item list order is deterministic and the test checks it the same way the database orders it." Scope: "Make the list order independent of the database locale (or make the test use the database's rule), keeping D67 'sort by name'."
D67 (1): "catalog items are listed alphabetically by name".

Root cause confirmed: `src/server/map-items/map-items.ts:75` has `order by lower(name), builtin_key` under the database default collation (locale-aware: en_US ignores spaces and punctuation at the first level). The test at `src/server/map-items/map-items.db.test.ts:74-83` compares with JS default sort (UTF-16 code points), so it fails on any non-C database (CI and local compose).

## Decision: change the SQL, then fix the test (not test-only)
- Production order must not depend on the server's locale. A test-only change would pin the test to whatever the DB locale happens to be, and prod, CI and local could still order differently. The spec/D67 only says "alphabetically by name" and does not name a locale rule.
- The UI does its own sort: `src/ui/mapItems/map-items-state.ts:14,23-26` and `src/lib/layout-editor/palette.ts:38,50-54` re-sort with `localeCompare(b, "en", { sensitivity: "base" })`, then `builtinKey`. So the SQL order is only a stable baseline (and the `limit` window order); the visible alphabetical order comes from the UI. This makes a locale-independent SQL order safe: no visible change in the UI, and the API order becomes reproducible.
- Chosen rule: `order by lower(name) collate "C", builtin_key collate "C"`. "C" is always available on Postgres (no ICU/locale dependency), is deterministic, and matches the code-point order the test already uses. Known limit, accepted: non-ASCII names (Vietnamese diacritics) sort by byte value in the API baseline (e.g. "đ" after "z"); the UI re-sort gives the linguistic order. `lower()` itself still follows the database ctype; this is not changed (out of scope).
- Not chosen: `"und-x-icu"` (not guaranteed on the shared self-hosted Postgres, would need a migration/check); matching the UI exactly in SQL (not possible without ICU).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Regression test reproduces the bug: fails on `main`, passes after | New test `map-items (db) › list order does not depend on the database locale` in `map-items.db.test.ts`. Run `pnpm test:db` on the old `map-items.ts` (fails) and on the fix (passes); impl-log records both runs. Its names ("!!a b", "!!a-c", "!!ab") order differently under en_US than under C, so it fails under a locale collation. |
| 2 | Expected behaviour: deterministic list order, test checks it the same way as the DB | The updated test "list is ordered by lower(name), then builtin_key" passes under `pnpm test:db`; the SQL uses `collate "C"`. |
| 3 | All checks pass | `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm format:check`, `pnpm check:layers`. |

## Ming verification after merge
None (CI `test:db` going green on main is observable in the CI run).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/map-items/map-items.ts` (line 75) | `order by lower(name) collate "C", builtin_key collate "C"`; update the comment at line 65 to state the rule | Root cause | No |
| `src/server/map-items/map-items.db.test.ts` (lines 74-83) | Fix existing test to compare with the code-point rule explicitly; add the regression test | Test used a rule that differs from the DB; regression evidence | No |

No file matches a High path (no `*.sql`, no migration, no auth/config/deploy file touched). Does not touch BUG-003 or BUG-004 files.

## Data model / migration
None. No schema change; `collate` is a query-time clause.

## API contract
None. The response shape is unchanged; only the (baseline) item order is now locale-independent.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-items.db.test.ts › list order does not depend on the database locale` (FIRST; fails before the fix) | In a seeded org, rename `wall.base`, `door`, `chair`-like three existing keys (pick any three builtin keys) to "!!ab", "!!a b", "!!a-c" (all other names start with a letter, so these sort first under "C"). Assert the first three `builtinKey`s are, in order, the "!!a b", "!!a-c", "!!ab" items. Under en_US spaces/hyphens are ignored, so "!!ab" would not come last and the test fails. Also asserts the tie-break: two items with the same lower(name) differing in case order by `builtin_key`. |
| `map-items.db.test.ts › list is ordered by lower(name), then builtin_key` (modify) | Keep first/last assertions; replace `[...names].sort()` with an explicit comparator `(a, b) => (a < b ? -1 : a > b ? 1 : 0)` and a comment that it is the "C" code-point rule the SQL enforces. |

## Approach
1. Write the regression test first; run `pnpm test:db` against local Postgres (compose.dev.yml) and capture the failure in impl-log. If the local DB happens to use the C locale, create the throwaway DB check with `select datcollate from pg_database` and record it; the CI run (en_US) is then the fail-before evidence (CI run 45664750414 already shows the diff).
2. Change the SQL order clause (R6 scoping untouched; `orgQuery` still scopes by org).
3. Update the existing test comparator and the doc comment.
4. Run typecheck, `pnpm test`, `pnpm test:db`, `pnpm format:check`, `pnpm check:layers`; record in impl-log.
Rules: R4 (only the two listed files), R5 (new test), R2 not applicable (no schema change).

## Specialist input used
None.

## Assumptions
- Test names of the form "!!..." are accepted by the DB (no check constraint on name content beyond what `setName` already bypasses via direct SQL). If a constraint rejects them, use another prefix that sorts before letters under "C" (e.g. "0").
- No hotspot overlap expected with other open tickets (BUG-003/004 touch other files); if SIM-039.x edits `map-items.ts`, expect a trivial rebase.
- Other `order by` clauses on map data (e.g. device types) are not in scope; any similar locale issue goes to follow-ups.

## Blocking questions
None.

## Split proposal
None. Size XS (about 30 changed lines).
