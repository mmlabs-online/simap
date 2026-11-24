# Review — SIM-018

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit=0, "All matched files use the correct format." (635 files).
- `pnpm typecheck && pnpm check:layers` — typecheck exit=0 (re-run after the implementer's last test-only edit; `next typegen` + `tsc --noEmit` clean); check:layers exit=0, "581 files, no violations".
- `pnpm test` — exit=0, Test Files 222 passed (222), Tests 2220 passed | 3 skipped (2223).
- `pnpm build` — exit=0, "Compiled successfully".
- `pnpm test:db` (local compose Postgres, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`) — exit=0, Test Files 13 passed (13), Tests 157 passed (157). `vitest.db.config.ts` includes `src/**/*.db.test.ts` and 13 such files are tracked, so `src/server/export/export.db.test.ts` ran.
- These results match the impl-log figures.

### Acceptance criteria
- [x] CSV opens in Excel with correct Vietnamese characters in names. Evidence: `csv.test.ts` › "starts with U+FEFF, uses CRLF…" and › "keeps Vietnamese text intact"; `route.test.ts` › "manager and admin get 200 with BOM body…" asserts `text/csv; charset=utf-8`, bytes `EF BB BF` and the decoded "Nguyễn Thị Ánh" row; `export-api.test.ts` shows the blob keeps the BOM. Ming still has to open the files in Excel himself (listed below).
- [x] Exports contain only the caller's org. Evidence: `export.ts:107` runs every statement through `orgQuery` (`$1` = `scope.orgId`) and every join also matches `org_id` (`export.ts:32-36, 70-72, 93`); `export.test.ts` › "every query goes through orgQuery with scope.orgId as $1"; `export.db.test.ts` › "two orgs: each export lists only its own rows" passes on a real database.
- [x] Users get 403 on CSV routes. Evidence: `route.ts:25` `{ tier: "manager" }`; `route.test.ts` › "user tier gets 403 and nothing is queried" (all three kinds, `exportRows` not called).
- [x] Unit tests cover CSV escaping. Evidence: `src/lib/export/csv.test.ts` covers quoting (comma, quote, CR, LF), the formula guard, guard+quote composition, safe mid-string symbols, and null/undefined/empty values.

Ming verification after merge (carry into the PR):
- Open each of the three downloaded files in Excel by double-clicking. Check that Vietnamese names show correctly, that columns split correctly, and that `=1+1` shows as the text `'=1+1`.
- On the hosted Dashboard, check that a Manager sees the Export buttons and can download, and that a plain User does not see them.

### Issues
None.

### Scope
Every changed source file is in the plan's file table. `src/lib/api/error.ts` is unchanged, as planned. No High path is touched (`src/server/http/**` and `with-auth.ts` are unchanged). The planned `failed` copy string was left out on purpose because errors reuse `apiErrorMessage`. The impl-log records this, so it is a reduction, not an unplanned change.

### Rules (CLAUDE.md)
No violations found.
- R1: the route imports only `@/server/*` and `@/lib/*`; UI imports only `@/lib/export/csv`, `@/lib/tier` and `@/lib/api/fetch`; `export.ts` starts with `import "server-only"`; check:layers is clean.
- R3: no env use. Route and server code log no row data.
- R6: see criterion 2.
- R7: auth codes come only from `withAuth`; the handler returns only 404 `not_found` and 503 `unavailable`; the route is a read-only GET.
- R5: new logic has unit, route, UI and DB tests.

### Blockers from review agents
None. `security-review.md` attempt 1 has no 🔴 or 🟡 findings, only three 🟢 notes.

### Nits (do not block)
- 💭 `csv.ts:13`: the formula guard does not cover a leading LF, a leading space, or full-width `＝＋－＠` (security-review N1). Excel does not evaluate these, but other importers may. A one-line widening (`/^[\s=+\-@＝＋－＠]/`) and two tests would close the gap.
- 💭 `rooms.floor` is text, so a floor `-1` exports as `'-1` (the accepted OWASP trade-off, security-review N2).
- 💭 `export.ts:10,107` uses `any` for row mapping. It is local and covered by tests, but a small row type per kind would let tsc catch column-name typos.

### Follow-ups (out of scope)
- Widen the CSV formula guard (N1 above) if Ming wants coverage beyond Excel.
- Room layout PNG export (D47), which comes with the map tickets.
