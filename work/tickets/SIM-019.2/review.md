## Attempt 1 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
Run locally in WSL on `ticket/SIM-019.2` (HEAD 2ca7197, branch contains `origin/main` 188af0a).
- `pnpm format:check` — exit 0, "All matched files use the correct format." (256 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 219 files, no violations"
- `pnpm test` — exit 0, 82 files passed, 772 tests passed (matches impl-log)
- `pnpm build` — exit 0, route `○ /audit` listed next to `/api/audit`, `/api/audit/facets`
- `pnpm test:db` (CI-only) — CI run 44846566442 (workflow `ci`, head 2ca7197 = PR #27 head): jobs `ci` success, `image` success. `risk-tier` run 44846566501 success; PR #27 label `risk:medium` (matches the plan's predicted tier).

### Acceptance criteria
- [x] 1 Only Admins can open the page — evidence: `AuditView.test.tsx` › "forbidden status shows no-access and no filters/table"; `audit-state.test.ts` › "canViewAudit: admin true; manager, user, null session false"; `nav.test.ts` › "audit is admin only". No-request guarantee confirmed by reading `src/ui/audit/AuditPage.tsx:16-36`: the non-admin branch returns `<AuditView status="forbidden">` before `AuditLoaded` (the only caller of `useApiFetch` / `useAudit`) is rendered, so no `/api/audit` or `/api/audit/facets` request is made. The API also enforces `{ tier: "admin" }` (`src/app/api/audit/route.ts`).
- [x] 2 Newest first, filter by actor / entity / date range, paginated — evidence: `AuditView.test.tsx` › "ready renders rows in the given order…", "filter selects list facet options; selected values reflect state", "Load more button only when hasMore; disabled while loadingMore"; `audit-api.test.ts` › "list sends actor, entity, from, to, limit, cursor as query params, omits blanks". The plan's verification table also named `audit-state.test.ts` › "load more appends and keeps filters" / "changing a filter resets the list and cursor"; these do not exist because that logic lives in the hook `useAudit.ts` (the plan's own Tests table did not list them and B6 rules out DOM tests). I reviewed `useAudit.ts:47-91` by reading: filter change -> new `query` -> `reload` bumps the counter, resets to LOADING and drops stale responses; `loadMore` appends with the same `query` and drops its result if a reload started meanwhile. Correct; see Follow-ups.
- [x] 3 Dates are UTC+7 (D35) — evidence: `src/lib/audit/day-range.test.ts` (6 tests: from 2026-03-05 -> 2026-03-04T17:00:00.000Z, exclusive to -> 2026-03-05T17:00:00.000Z, month/year/leap rollover, blanks, invalid days incl. 2026-02-30, from > to -> null, from = to valid). Implementation `day-range.ts:5-14` uses `Date.UTC` minus a fixed 7 h offset, independent of host TZ. Output format `YYYY-MM-DDTHH:mm:ss.000Z` passes the API's `INSTANT_RE` and canonical check (`src/lib/validate/audit-query.ts:8-18`). Display: `audit-state.test.ts` › "formatAuditTime…" and `AuditView.test.tsx:66-71` (`2026-03-05T17:30:00.123456Z` -> "06 Mar 2026, 00:30", microsecond input).
- [x] 4 Actor display names, null-safe — evidence: `AuditView.test.tsx` › "Vietnamese display name renders intact", "null displayName shows Unknown member plus first 8 chars of sub".
- [x] 5 Loading / empty / error states, no HTML injection from `meta` — evidence: `AuditView.test.tsx` › "loading shows aria-busy and no rows", "empty (no filters) vs empty with filters show different text", "error shows apiErrorMessage text and a retry button", "null entityId and null meta render without 'null' or 'undefined' text", "meta containing <script> is escaped".
- [x] 6 Copy convention (SIM-022), clean UI kit — evidence: `no-literals.test.ts` and `copy.test.ts` pass in the 772-test run; all strings in `src/ui/copy/audit.ts` / `shell.ts`; no pixel font class in `AuditView.tsx` (grep), and `AuditView.test.tsx:73` asserts no `font-pixel`.
- [x] 7 All loop checks green — see Checks.

Ming verification after merge (not reviewer-verifiable; carry into the PR):
- Sign in as Admin, change a room, open Audit from the nav, confirm the new row, actor display name, filters (actor, entity, from/to) and "Load more". Sign in as Manager and User: no Audit nav entry; opening `/audit` directly shows the no-access message.
- Visual check of the table on a narrow (mobile) width.

### Scope
- Every changed file is in the plan's file list, except `src/ui/AppShellView.test.tsx`, justified under impl-log "Out-of-plan files". Judgement: **accepted**. It is a test-only change (5 -> 6 rail links, `/audit` appended) forced by the planned nav item; the plan correctly said `AppShellView.tsx` needs no edit but missed that its test pins the admin link list. No production code outside the plan.
- No High path changed (all under `src/lib/**`, `src/ui/**`, `src/app/(app)/**`); CI tier `risk:medium`.
- Invalid-range behaviour (not spelled out in the plan's view description): judgement **accepted, in scope**. The plan specified `dayRangeToInstants` returns `null` for an invalid day or from > to "so the API is never sent from >= to"; the implementation carries that through: `toApiFilter` -> `null` (tested in `audit-state.test.ts:23-25`), `useAudit` makes no request for a `null` query (`useAudit.ts:49-52`), and the view shows `auditCopy.rangeInvalid` instead of the empty card (`AuditView.tsx:113-117, 135`). This matches the API, which rejects from >= to with 400, so without it the user would see a generic error. One extra copy string, no new feature.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found. R1: `src/ui/audit/**` imports only `@/lib/**` and `../` ui modules; no `@/server` / `server-only` import (grep), `check:layers` clean. R3: no config. R4: see Scope. R5: checks green, new logic tested (hook logic reviewed by reading, see criterion 2). R6: unchanged server side. D36: copy in `src/ui/copy/audit.ts`. D52: no pixel font.

### Blockers from review agents
None (no trigger matched).

### Nits (do not block)
- 💭 The `rangeInvalid` alert in `AuditView.tsx:113-117` has no view test (the `null` mapping is tested in `audit-state.test.ts`, the rendering is not). A one-line `render({ rangeInvalid: true })` assertion would pin it.
- 💭 A failed "Load more" (`useAudit.ts:84-89`) switches the whole view to the error state and hides the rows already loaded; "Try again" restarts from page 1. Acceptable for v1, but an inline error next to the Load more button would be friendlier.
- 💭 The date inputs reuse the `history` icon; a calendar icon would read better (would need a new icon name).

### Follow-ups (out of scope)
- Extract the list/append/reset transitions of `useAudit.ts` into a pure reducer in `audit-state.ts` and unit-test "load more appends and keeps filters" / "changing a filter resets the list and cursor" (named in the plan's verification table but not testable in the hook without a DOM test library, B6).
