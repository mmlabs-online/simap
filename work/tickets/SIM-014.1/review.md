# Review — SIM-014.1

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (500 files).
- `pnpm typecheck && pnpm check:layers` — both exit 0; "check-layers: 446 files, no violations".
- `pnpm test` — exit 0; Test Files 176 passed (176), Tests 1868 passed | 3 skipped (1871). Matches impl-log.
- `pnpm build` — exit 0; `/api/requests`, `/api/requests/mine`, `/api/requests/mine/seen` built as dynamic routes.
- `pnpm test:db` (CI, PR #60, run 45334318154, headSha 4a5d374 = branch HEAD, conclusion success) — Test Files 9 passed (9),
  Tests 126 passed (126); `src/server/requests/requests.db.test.ts` ✓ 18 tests, `src/server/requests/read.db.test.ts` ✓ 12 tests.
  The jobs `ci`, `image` and `tier` are all green.

### Acceptance criteria
- [x] The Approvals list filters by status and pages with a cursor; Users get 403 from the auth wrapper. Evidence:
  `read.db.test.ts:64` (each status, other org excluded), `:86` (5 rows with the same created_at, pages 2/2/1, `id desc`,
  no duplicates or gaps), `:111` (occupant join / null); `requests-read-routes.test.ts:69` (tier user list -> 403, service
  not called), `:81` (manager passes status/limit/cursor); `request-query.test.ts:8-69`. The route uses `withAuth(..., { tier: "manager" })`
  (`src/app/api/requests/route.ts:30-41`).
- [x] My requests shows only the caller's requests, with `isNew` and an `unseen` count of newly approved or rejected requests.
  Evidence: `read.db.test.ts:124` (only the caller's rows, newest first, another member and another org excluded), `:144` (approved,
  rejected and the auto-rejected rival via `approveRequest` are new; pending and cancelled are not; unseen = 3 = the isNew count), `:170`
  (limit 1, unseen 3), `:181` (no member row -> empty page); `rules.test.ts` › isUnseen.
- [x] Mark seen never moves `requests_seen_at` backwards and never past now. Evidence: `read.ts:148-151` (one atomic
  `greatest(coalesce(..,'-infinity'), least(coalesce($3, now()), now()))`); `read.db.test.ts:192` (null -> set; no seenUpTo -> now,
  unseen 0), `:206` (T2 then T1 stays T2), `:213` (2999 capped at <= now()), `:223` (µs equality clears r1 but not r2 decided
  1 µs later), `:240` (no member, no-op); `request.test.ts` › validateSeenBody (µs accepted unchanged; ms form, no fraction,
  offset, 2026-02-30, non-string, extra key, non-object refused).
- [x] Unit, route and DB tests cover the filter, the cursor and the unseen count. All exist and pass (pnpm test locally, test:db in CI).

Ming verification after merge: none (plan).

### Specific checks requested by the orchestrator
- **read.db.test.ts is complete**: 247 lines, 3 describe blocks, 12 `it`s, balanced and ending cleanly; CI ran all 12 green.
  It covers every DB case in the plan's test table except a separate "list default (no status) returns only pending" DB case.
  The default is applied in the parser (`request-query.ts:60`; `request-query.test.ts:9` "no params -> pending, limit 50"), and
  the service always receives an explicit status, so a DB case would add no coverage (nit below).
- **loadRequest refactor**: the diff of `src/server/requests/requests.ts` only moves text. `REQUEST_SELECT` and `REQUEST_FROM`
  hold the same columns, the same 4 org-scoped joins and the same `ISO` format. `where q.org_id = $1 and q.id = $2` is unchanged,
  and `toRequestDto` maps the same fields line for line. The only other changes are the added `export` keywords on `RequestRow` and `ISO`. `requests.db.test.ts`
  (18 tests) and `requests-routes.test.ts` stay green without edits. No behaviour change.
- **µs round-trip of seenUpTo**: the validator keeps the string as sent (`request.ts:37`), and the string is bound as `$3::timestamptz`
  (Postgres stores µs). The value comes back via `to_char(... US)` and the ISO helper. The decidedAt -> seenUpTo -> isNew path is pinned
  in the DB test at `read.db.test.ts:223` with rows decided 1 µs apart, and the test is green in CI.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: routes -> server/lib, `read.ts` starts with `import "server-only"`, validators and `isUnseen` in lib;
check:layers clean. R6: every query in `read.ts` goes through `orgQuery` with `org_id = $1`, and the occupant join repeats `org_id`.
Mine and seen are scoped by the token `sub` (route test `:114`). R7: handlers return only 200/400/503; 401/403 come from
`withAuth` only. The seen update is idempotent and forward-only, so an `apiFetch` re-send is safe. R2: no migration. R3: no config. R4: every changed
source file is in the plan's file list. Out-of-plan changes are limited to `work/` bookkeeping (`ming-todo.md`, ticket files). No High path is touched.

### Blockers from review agents
None.

### Nits (do not block)
- The plan's "list default (no status) returns only pending" exists as unit and route coverage, not as a DB case.
- `isUnseen` (`rules.ts:44`) is not used by production code (the SQL is the authority), and no test asserts that it agrees with the SQL
  predicate. It is intended for the UI slice. Consider adding such an assertion there.
- `src/app/api/requests/route.ts` GET inlines `{ "Cache-Control": "no-store" }`, while the sibling routes use a `NO_STORE` constant.

### Follow-ups (out of scope)
- From the plan: an oldest-first pending queue for Approvals (if wanted), moving the cursor codec out of `src/lib/audit/`, and sharing the
  query `get()` helper between the audit and requests validators.
