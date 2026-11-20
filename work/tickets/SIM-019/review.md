## Attempt 1 — 2026-11-20
Verdict: PASS

Scope of this review: Slice A (API) only, per the split Ming approved on 2026-11-20 (ticket.md Notes). Slice B is
SIM-019.2 and is not judged here. Environment: Windows, Node 24.20.0 with `--config.engine-strict=false` (CI uses
Node 22). No Postgres was available, so real-DB behaviour is marked pending below.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (154 files).
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0; "check-layers: 131 files, no violations".
- `pnpm test` — exit 0, "Test Files 52 passed (52)", "Tests 489 passed | 3 skipped (492)". Matches impl-log.
- `pnpm build` — exit 0, "Compiled successfully"; `ƒ /api/audit` and `ƒ /api/audit/facets` listed as dynamic.

### Acceptance criteria
- [x] 1 Only Admins can use the route (403 otherwise). Route half only; the page half is SIM-019.2. Evidence:
  `src/app/api/audit/route.test.ts` › "user and manager get 403 forbidden, service not called; admin passes the gate"
  (both handlers, body `{error:{code:"forbidden"}}`, service mocks not called) and › "no Authorization -> 401 on both
  handlers". Both routes use `withAuth(..., { tier: "admin" })` (`src/app/api/audit/route.ts:20`,
  `src/app/api/audit/facets/route.ts:16`).
- [x] 2 Filters combine and paginate correctly. Unit evidence: `src/server/audit/audit.test.ts` › "actor + entity + from
  + to combine with AND, values bound not interpolated", "cursor adds (a.created_at, a.id) < keyset predicate",
  "limit+1 rows -> nextCursor from the last kept row, page trimmed", "last page has nextCursor null", "unfiltered: ...
  order by a.created_at desc, a.id desc, limit = limit+1"; `src/lib/audit/cursor.test.ts` › "round trip keeps
  microseconds"; route test › "filters reach the service ...". SQL checked by hand against
  `db/migrations/20261120150000_init.sql`:
  - `audit_log` columns used (`id, org_id, actor_sub uuid, action, entity, entity_id uuid null, meta jsonb null,
    created_at timestamptz`) all exist (init.sql lines 209-218); casts `::uuid` on `actor_sub` and `::text` on
    `entity` match the column types.
  - Keyset: `order by a.created_at desc, a.id desc` with `(a.created_at, a.id) < ($n::timestamptz, $m::uuid)` is the
    correct strict predicate for that order; rows that share `created_at` (e.g. several audit rows written in one
    transaction, same `now()`) are ordered and split by `id`, so no row is skipped or repeated. The cursor `at` comes
    from `to_char(a.created_at at time zone 'UTC', '...HH24:MI:SS.US"Z"')` (`src/server/audit/audit.ts:56`), which is
    exact to the microsecond (Postgres's own precision) and independent of the session TimeZone, and
    `decodeCursor` requires exactly 6 fractional digits (`src/lib/audit/cursor.ts:5`), so the cursor value compares
    equal to the stored value.
  - Shape matches `audit_log_org_created_idx (org_id, created_at desc, id desc)` (init.sql line 219).
  - UTC: `from`/`to` accept only `...Z` instants (`src/lib/validate/audit-query.ts:8`), are canonicalised via
    `toISOString`, `from` inclusive / `to` exclusive (`audit.ts:43-44`), `+07:00` and date-only rejected (test ›
    "from/to: ..."). No time-zone logic in the API, as planned (A3).
  - **Pending (real DB)**: execution of both statements against Postgres, index use (`EXPLAIN`) for the row-compare
    predicate, and paging across a tie set. To be covered by the SIM-026 integration-test follow-up (plan A6).
- [x] 3 Rows show only the caller's org. Evidence: every statement goes through `orgQuery` with `ctx.scope`
  (`audit.ts:49, 70, 80`), `where a.org_id = $1` first; members join is
  `m.org_id = a.org_id and m.sub = a.actor_sub` (`audit.ts:58`, `:74`), matching `members_org_sub_key unique
  (org_id, sub)` (init.sql line 50), so the join cannot fan out or pull another org's name. Tests: audit.test.ts ›
  "query is bound to scope.orgId as $1 and the members join also matches org_id"; route test › "... org in the query
  string is ignored, token org is the scope". **Pending (real DB)**: cross-org isolation proof (SIM-026 follow-up).
- [x] 4 Unit tests cover filter parsing. Evidence: `src/lib/validate/audit-query.test.ts`, 10 cases (defaults, limit
  bounds, actor, entity incl. diacritics, from/to validity, range, repeated param, blank = absent, bad cursor, all
  filters combined); all pass.
- [x] 5 (SYS-03) DTO exposes no `org_id`. Evidence: audit.test.ts › "DTO maps only id, actor, action, entity,
  entityId, meta, at; null meta stays null" (fake row carries `org_id`; output keys asserted).

Ming verification after merge (not reviewer's): plan says nothing for Slice A alone; the end-to-end check (sign in as
Admin/Manager/User, open Audit, filters, Load more) belongs to SIM-019.2 after SIM-006.2. The PR should carry that note.

### Scope
Changed files: `src/lib/audit/{types,cursor,cursor.test}.ts`, `src/lib/validate/audit-query{,.test}.ts`,
`src/server/audit/audit{,.test}.ts`, `src/app/api/audit/route{,.test}.ts`, `src/app/api/audit/facets/route.ts`, and
ticket work files. All are in the plan's Slice A file list; no out-of-plan files. No High path touched
(`src/server/audit/**` does not match `src/server/**/auth*` or `src/server/http/**`).

### Issues
#### Issue 1 — 🟡 should-fix — boundary validation (tampered cursor -> 500)
- **Where**: `src/lib/audit/cursor.ts:24`
- **Expected**: any cursor that Postgres would reject is refused at the boundary with 400 `invalid_request`.
- **Actual**: the check is `AT_RE` + `Date.parse`. V8 accepts impossible calendar dates in this format
  (`Date.parse("2026-02-30T08:46:02.123456Z")` returns a number, verified on Node 24), so a hand-crafted cursor with
  `at` = Feb 30 passes, and `'2026-02-30...'::timestamptz` raises 22008 in Postgres -> `withAuth` returns 500
  `internal`. Only reachable by tampering (the server never issues such a cursor), no data exposure, so not a blocker.
- **Fix instruction** (can ride with SIM-019.2 or a follow-up): reuse the round-trip check from
  `audit-query.ts:12-17` — compare `new Date(at).toISOString().slice(0, 19)` with `at.slice(0, 19)` and return null on
  mismatch; add `enc({ at: "2026-02-30T08:46:02.123456Z", id: ID })` to the "garbage ..." test.

### Rules (CLAUDE.md)
No violations found. R1: route -> server/lib, `lib` files import only `@/lib/**` (check:layers green);
`src/server/audit/audit.ts:1` starts with `import "server-only"`. R2: no schema change. R3: no config added. R4: inside
plan. R5: checks green, new logic tested. R6: all SQL via `orgQuery`, join on `org_id`, admin tier from `withAuth`.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 0 🟡, 5 💭.

### Nits (do not block)
- Route test "filters reach the service" does not pass a `cursor`; plan row 2 named "filters and cursor reach the
  service". The cursor path is covered by the parser and service tests, so this is only a gap in the wiring test.
- impl-log follow-up already notes the 400-before-503 order in `route.ts:14-17`; harmless.
- `fakeDb` in `audit.test.ts` defaults `values` to `[]`, which hides whether `orgQuery` is called without values for
  facets; behaviour is correct (`orgQuery` defaults to `[]`).

### Follow-ups (out of scope)
- SIM-026 (or a follow-up): add DB integration cases for audit — cross-org isolation, paging across rows with equal
  `created_at`, `EXPLAIN` showing `audit_log_org_created_idx` used with the row-compare predicate (plan A6).
- Facets actors/entities run `select distinct` over the org's whole `audit_log` (kept forever, D38). Fine at v1 size;
  if it grows, read actors from `members` plus a bounded distinct, or cache. Worth a `debt` issue.
- Facets cap actors at 200; an org with more distinct actors cannot pick the rest in the UI. Revisit with SIM-019.2 /
  SIM-011 (members directory).
