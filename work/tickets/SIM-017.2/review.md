# Review — SIM-017.2: Search API, diacritics-insensitive

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit=0, "All matched files use the correct format." (614 files)
- `pnpm typecheck`: exit=0
- `pnpm check:layers`: exit=0, "check-layers: 560 files, no violations"
- `pnpm test`: exit=0, "Test Files 215 passed (215); Tests 2163 passed | 3 skipped (2166)"
- `pnpm build`: exit=0
- `pnpm test:db` (local compose Postgres 17, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`; I started it and stopped it afterwards): exit=0, "Test Files 12 passed (12); Tests 155 passed (155)"
- These match the impl-log Attempt 1 numbers.
- Mutation check (AC 4; the implementer had not run it). I edited `src/app/api/dashboard/route.ts:14` and reverted it with `git checkout`; the tree was clean afterwards.
  - `includeHolders: atLeast(ctx.tier, "user")`: `vitest run src/app/api/dashboard/route.test.ts` fails, "1 failed | 2 passed". The failing test is "user tier: includeHolders false and deactivatedHolders null" (`expected { includeHolders: true } to deeply equal { includeHolders: false }`).
  - `includeHolders: true`: the same test fails, "1 failed | 2 passed".
  - Reverted: "3 passed (3)", exit=0.

### Acceptance criteria
- [x] "nguyen" finds "Nguyễn" (and đ/Đ matches d). Evidence:
  - `fold.test.ts` › "folds Nguyễn, NGUYỄN and NFD input to nguyen; Đ/đ to d" passes.
  - `search.db.test.ts` › "nguyen finds Nguyễn in every kind; dung finds Đặng/Dũng" passes locally.
  - `manage.db.test.ts:296-298`: `nguyen` and `NGUYEN` return the three Nguyễn ids, and `le binh` returns ids[4].
- [x] Search results are limited and paginated. Evidence:
  - `search-query.test.ts` covers default 20 and max 50; 0, 51, abc, 1e1, -1 and 01 are rejected.
  - `cursor.test.ts` passes.
  - `search.db.test.ts` › "pages each kind by keyset with equal names, no gaps or repeats" (5 equal names, limit 2, 3 pages, no repeats) passes.
  - `search.db.test.ts` › "kind=all caps each group at limit with its own nextCursor" passes.
  - The keyset `(sortExpr, id) > ($k::text, $id::uuid)` is at `search.ts:75`, and `limit + 1` at `search.ts:77`.
- [x] Unit tests cover the diacritics normalisation, incl. a check that the TS fold and the SQL map agree. Evidence:
  - `fold.test.ts`: "Vietnamese alphabet: 12 vowels x 6 tones, both cases, NFC and NFD", "every FOLD_FROM char folds to the FOLD_TO char at the same index", and "map has equal lengths, no duplicates, no quote or backslash, ASCII a-z targets".
  - On real Postgres: `search.db.test.ts` › "SQL fold equals foldText on the whole map" passes.
- [x] A route test pins the dashboard tier gate (User gets no deactivated-holders data). Evidence:
  - `src/app/api/dashboard/route.test.ts` has 3 passing tests: user tier, manager and admin, and no-store.
  - Both mutations above make the user-tier test fail.
- [x] Plan AC 5: spec fields only, no email, MAC separators ignored. Evidence:
  - `search.db.test.ts` › "fields: …" passes. It covers aa:bb, aa-bb, aabb, AA-BB:cc and ddeeff; `secret.mail` gives an empty member list; the member hit has no `email` key.
  - The member query selects no email (`search.ts:155-158`).
- [x] Plan AC 6: org isolation (R6). Evidence:
  - `search.db.test.ts` › "never returns another org's rows" passes.
  - Every query goes through `orgQuery`, and every join repeats `org_id` (`search.ts:96-100, 117-122`).
  - `search.test.ts` asserts the join predicates.
- [x] Plan AC 7: validation at the boundary, one error shape. Evidence:
  - `search-query.test.ts` covers missing, blank, 81-char, combining-only and duplicate params, a bad kind, a cursor with `kind=all`, a cursor of another kind, and a garbage cursor.
  - `search/route.test.ts` › "bad query -> 400 invalid_request without calling search" passes.
- [x] Plan AC 8: results are always current. Evidence:
  - `search/route.test.ts` › "200 carries Cache-Control: no-store" passes.
  - `dynamic = "force-dynamic"` is set at `src/app/api/search/route.ts:7`.
- [x] Plan AC 9: all checks green (see above).
- Ming verification after merge: none (per plan).

### Issues
None.

### Scope
- All 16 changed source/test files are in the plan's file list; there are no out-of-plan files.
- No High path was touched: no `db/migrations/**`, nothing under `src/server/http/**` (imports only) and no config.
- `src/app/api/dashboard/route.ts` is unchanged, as the plan requires.
- `listMembers` keeps email matching for the members list, as the plan states (approach step 6). Only the global search leaves email out.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/server/search/search.ts:1` is `import "server-only"`. Fold, cursor, types and validator are in `src/lib`, and the route is the only entry into server code. `check:layers` is clean.
- R2: no schema change.
- R3: no env and no secrets.
- R6: covered above.
- R7: both routes are read-only, and 401/403 come only from `withAuth`.
- R5: new logic has unit and DB tests.
- SQL safety: user text is only ever a bound value. `FOLD_FROM`/`FOLD_TO` are module constants with no quote or backslash (tested). Columns passed to `foldSql` are constants.

### Blockers from review agents
None. `security-review.md` Attempt 1: PASS, no 🔴, no 🟡.

### Nits (do not block)
- 💭 `search.ts:114`: `macCompact(f.q)` runs on any query, so every short hex-only query (e.g. "a", "be", "cafe") adds a second MAC alternative to the device query. The results are correct, but the predicate is redundant for queries without separators. No change needed.
- 💭 `search.ts:74`: `f.cursor.t === kind` is always true once the validator has run, because a cursor requires a single matching kind. It is harmless as defence in depth.

### Follow-ups (out of scope)
- Trigram or functional index on the folded columns, only if search turns out slow (already noted in the ticket's out-of-scope list).
