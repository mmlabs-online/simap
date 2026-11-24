# Security review — SIM-017.2

## Attempt 1

**Verdict: PASS from security. No 🔴 blockers, no 🟡 should-fix.** I read the code only; I ran no checks myself (I had Read/Grep/Glob only).

Files read: `src/server/search/search.ts`, `src/lib/search/fold.ts`, `src/lib/search/cursor.ts`, `src/lib/search/types.ts`, `src/lib/validate/search-query.ts`, `src/app/api/search/route.ts`, `src/server/members/manage.ts:137-172`, and the test names in the search, search-query and dashboard route test files.

### 🔴 Blockers
None.

### 🟡 Should-fix
None.

### 🟢 Notes and verified properties

1. **SQL injection: clean.**
   - `foldSql` (`fold.ts:40-42`) puts only `FOLD_FROM` and `FOLD_TO` into the SQL. Both are built at module load from fixed code-point ranges U+00C0–U+024F and U+1E00–U+1EFF (`fold.ts:14-37`).
   - A character is kept only if it folds to a single a-z letter (`fold.ts:25`), so neither `'` nor `\` can ever be in the map. `fold.test.ts:51` checks this.
   - Every `col` passed in is a constant column name in server code (`search.ts:103, 127-130, 161`, `manage.ts:152`).
   - User text reaches SQL only as bound values:
     - the pattern `%${escapeLike(f.folded)}%` (`search.ts:72`), with `escapeLike` escaping `\ % _` (`src/lib/members/search.ts:2-4`) and `escape '\'` added in `search.ts:51`;
     - the MAC pattern (`search.ts:132`), which is hex only per `fold.ts:47`;
     - the cursor `k::text` and `id::uuid` (`search.ts:75`);
     - the limit (`search.ts:77`).
   - Bind numbering starts at `$2`, because `orgQuery` puts `orgId` first (`org-scope.ts:24`).
   - 💭 `escape '\'` assumes `standard_conforming_strings=on` (the Postgres default since 9.1). This is the same pattern as the existing member list, so I am only noting it.

2. **Org scoping (R6): clean.**
   - Each base table filters on `org_id = $1` (`search.ts:100, 122, 158`), and `orgQuery` also checks for that filter at runtime (`org-scope.ts:21`).
   - Every join is keyed on org as well as id: rooms `r.org_id = s.org_id` (`:98`); occupant `m.org_id = s.org_id` (`:99`); owner `m.org_id = d.org_id` (`:119`); seat `s.org_id = d.org_id` (`:120`); room through seat `r.org_id = s.org_id` (`:121`).
   - `scope` comes from `ctx.scope` in `withAuth` (`route.ts:15`), never from the request.
   - The DB test "never returns another org's rows" (`search.db.test.ts:185`) covers this.

3. **Cursor tampering: clean.**
   - `decodeSearchCursor` (`cursor.ts:15-31`) checks the base64url alphabet first and wraps `JSON.parse` in try/catch; that the value is a plain object with exactly the keys `t`, `k`, `id`; that `t` is in a whitelist; that `k` is a string of at most 320 code points; that `id` is a canonical UUID.
   - Any failure returns null, which the route turns into a 400 `invalid_request` (`search-query.ts:54-56`, `route.ts:12`), so a bad cursor never causes a 500 or a uuid cast error.
   - Cursors of another kind, and any cursor with `kind=all`, are rejected (`search-query.ts:55`). `search.ts:74` checks the kind again.
   - A forged `k` or `id` only moves the keyset position inside the caller's own org. It cannot widen scope.
   - 320 code points is well above the longest sort key, so real cursors always decode again (device name 120, `devices/types.ts:1`; room code 32, `room.ts:1`).

4. **Result caps: clean.**
   - `limit` must match `^[1-9]\d{0,2}$` and be at most 50 (`search-query.ts:16, 42-48`). The SQL fetches `limit+1` rows and returns `limit` (`search.ts:77-84`).
   - `kind=all` returns at most 3 × 50 rows.
   - Duplicate parameters are rejected (`search-query.ts:21-25`).
   - The response has `Cache-Control: no-store` (`route.ts:16`).

5. **What a User-tier caller sees: acceptable.**
   - Member hits contain only id, displayName, employeeCode and status (`types.ts:22-27`, `search.ts:156, 162-167`). No email or sub is selected, and email is not a match column, so search cannot be used to guess email addresses (`search.db.test.ts:81` asserts "email not matched").
   - Seat hits carry the occupant's id and display name. Device hits carry MAC, inventory number and owner name. All of these are what DSH-02 says every role can search (`docs/spec-v1.md:399-403`).
   - Deactivated members are returned and labelled with their status (`search.db.test.ts:171`), which is consistent with that.
   - 💭 Context, not new in this diff: `GET /api/members` is User tier (`src/app/api/members/route.ts:18`) and already returns `email` (`manage.ts:90, 113`) and matches `?q=` on `m.email` (`manage.ts:152`). This ticket only changed the fold on that query, not who can see it. If Users should not see other members' emails, that needs a separate ticket (see Follow-ups).

6. **DoS: low risk, note only.**
   - `q` is NFC-normalized, its whitespace collapsed, and capped at 80 code points (`search-query.ts:29-30`, `types.ts:4`). A query of only combining marks, which folds to an empty string, is rejected (`:32`).
   - The leading `%` wildcard plus `lower(translate(...))` per column cannot use an index. Each request therefore does up to 3 sequential scans inside the org, folding 2–4 columns per row against a constant map of a few hundred characters.
   - This is acceptable at single-org office scale. The run is read-only and repeatable-read (`search.ts:173`), so it takes no write locks.
   - 💭 There is no rate limit on `/api/search` or on the existing member list. If orgs grow large, consider a `pg_trgm` index on stored folded columns, or a per-user rate limit (see Follow-ups).

7. **R1/R3/R7: clean.**
   - The route is the only entry into `src/server/search`, and `search.ts:1` starts with `import "server-only"`.
   - The 400 and 503 come before any database work. All 401/403 responses come from `withAuth` (`tier: "user"`, `route.ts:18`), and the endpoint has no side effects.
   - No secrets or env reads were added.

### Follow-ups (out of scope)
- Decide whether User tier should receive other members' `email` from `GET /api/members`, and be able to match on it (`manage.ts:90, 152`). This is a spec question for Ming and predates this ticket.
- If orgs grow large: add a trigram index on folded columns, and/or a rate limit on search-style endpoints.
