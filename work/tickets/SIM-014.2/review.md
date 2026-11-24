# Review — SIM-014.2

## Attempt 1 — 2026-11-24
Verdict: PASS

Scope reviewed: slice 1 only (read-only Approvals list, `?status=` filter, Load more, no-access view), per Ming's approved split (ticket Notes 2026-11-24, M-39). The Approve/Reject dialogs are SIM-014.4 and were not expected here.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0; "All matched files use the correct format." (535 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc, no errors)
- `pnpm check:layers` — exit 0; "check-layers: 481 files, no violations"
- `pnpm test` — exit 0; "Test Files 189 passed (189) / Tests 1977 passed | 3 skipped (1980)"
- `pnpm build` — exit 0; "Compiled successfully"; `/approvals` listed as a route (the `useSearchParams` Suspense boundary is in place)
- `pnpm test:db` — not run (CI-only, needs Postgres); this ticket changes no server or DB code.

All match the implementer's impl-log summary.

### Acceptance criteria
- [x] AC1 The Approvals page lists requests with a status filter (default pending) — evidence: `requests-state.test.ts` › "parseStatusParam: missing, unknown, duplicate -> pending; each valid status kept", › "statusHref: pending drops the param, others set ?status="; `requests-api.test.ts` › "list: GET /api/requests?status=pending&limit=50; cursor appended and encoded"; `requests-state.test.ts` › "appendPage: …"; `ApprovalsView.test.tsx` › "ready: one card per item with requester, seat line, time; pending chip checked", › "pending row: occupant shows the warning, none shows seat empty", › "decided row: …", › "hasMore shows Load more; …". Wiring: `src/ui/requests/ApprovalsPage.tsx:31` (`router.replace(statusHref(...), {scroll:false})`), `:56` (`parseStatusParam(searchParams.getAll("status"))`), `src/app/(app)/approvals/page.tsx`. All pass in `pnpm test`.
- [x] AC2 Static-render and pure-logic tests (no jsdom) cover the view and the filter — evidence: `ApprovalsView.test.tsx` uses `renderToStaticMarkup` only; `requests-state.test.ts` / `requests-api.test.ts` are plain function tests; no `@vitest-environment jsdom` comment in any new test file. 18 tests across 3 files, all pass.
- [x] Plan AC3 A `user`-tier visit makes no request and shows a no-access message — evidence: `requests-state.test.ts` › "canViewApprovals: manager/admin true, user/null/undefined false"; `ApprovalsView.test.tsx` › "forbidden: no-access message, no radiogroup, no list"; `ApprovalsPage.tsx:41-55` returns the forbidden view before `ApprovalsLoaded` (and so `useRequests`) is mounted, same gate as `src/ui/audit/AuditPage.tsx:16-36`.

Ming verification after merge (not verified by the reviewer; carry into the PR):
- Look at `/approvals` at 390 px width and on desktop with real requests (chips do not overflow, cards stack, long Vietnamese names wrap). Until SIM-014.3, create requests with `POST /api/requests` and a user token (`pnpm seed:dev` seeds none).
- The manual test "request → approve with two rival requests" moved to SIM-014.4.

### Scope
Every changed source file is in the plan's file list (11 files: copy, api, state, hook, view, page, barrel export, route page, 3 tests). Other changes are workflow files only (ticket/plan/consults/impl-log, and the M-39 line in `work/ming-todo.md` recording the plan approval). No High path touched. Nothing under `src/server/**`, `src/app/api/**` or `src/lib/**` changed, as the plan states.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/ui/requests/*` imports only `@/lib/requests/types`, `@/lib/api/fetch`, `@/lib/tier` and `src/ui` siblings; the route page imports only `@/ui`; `check:layers` clean.
- R2/R6: no schema or server change.
- R3: no config or secrets.
- R7: read-only slice (GET only); no route handler changed.
- D36: all strings in `src/ui/copy/requests.ts` (plus existing `shellCopy` / `apiErrorMessage`); the no-literals test passes.
- R5: new logic has tests.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `src/ui/requests/useRequests.ts:62` — a failed Load more switches the whole list to the error state and hides the loaded items; Retry reloads from page 1. Same behaviour as `useAudit` (copied on purpose), so consistent, but an inline error under the list would keep context. Could be done for both pages later.
- `src/ui/requests/ApprovalsView.tsx:47` — the static no-access text uses `role="alert"`, which makes screen readers announce it right away. `AuditView` may do the same; a plain `<p>` would be enough.
- `src/ui/requests/requests-api.ts:47-56` — only the page shape is checked, not each item. Same as `audit-api.ts`; fine while the API is ours.

### Follow-ups (out of scope)
- As listed in plan Assumptions: optional `rivalCount` on `RequestListItemDto`; remove `shellCopy.pages.approvals.empty` once unused; relative-age display; link from a card to the room/seat.
- Possibly: an inline Load-more error for list pages (Audit and Approvals) instead of replacing the list.
