# Review — SIM-014.3

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit=0, "All matched files use the correct format."
- `pnpm typecheck` — exit=0, "Types generated successfully", tsc no errors.
- `pnpm check:layers` — exit=0, "check-layers: 489 files, no violations".
- `pnpm test` — exit=0, "Test Files 191 passed (191); Tests 2015 passed | 3 skipped (2018)".
- `pnpm build` — exit=0, "Compiled successfully"; route `ƒ /requests` present.
- `pnpm test:db` — CI only; no server or migration change in this diff.

All five match the implementer's impl-log summary.

### Acceptance criteria
- [x] AC1: A User sees "Request this seat" on an empty seat that can be seated, and a duplicate request shows "already requested". Evidence:
  - `seat-actions.ts` `request: tier === "user" && seat.occupant === null && !seat.cannotSeat`.
  - `seat-actions.test.ts` › "seatButtons.request: user only, empty, not cannot-seat", "requestResult maps created/duplicate/failure", "actionOutcome request: sent and duplicate are info notices without reload", "actionOutcome request failures" (`not_allowed` falls into the request branch, not the release fall-through), and "other actions still reload on success…".
  - `SeatActions.test.tsx` › the four request-button tests, including role=status vs role=alert and busy `disabled=""`.
  - `requests-api.test.ts` › create 201 gives created true and 200 gives created false, plus the error cases.
- [x] AC2: My requests lists the caller's requests with their status, and Cancel works on pending rows. Evidence:
  - `MyRequestsView.test.tsx` covers loading, error, empty, rows with a chip for every status, Cancel only on pending rows, `cancellingId` disabling every Cancel, notice roles and Load more.
  - `requests-state.test.ts` › the `cancelOutcome` table and "appendPage works for MyRequestDto pages".
  - `requests-api.test.ts` › cancel and mine.
  - `nav.test.ts` › id lists, rail order, and `isActive` for `/requests`.
  - The route `src/app/(app)/requests/page.tsx` imports only `@/ui`.
- [x] AC3: The nav badge shows the number of newly decided requests and clears after My requests is opened. Evidence:
  - `request-badge.test.ts` › `newestDecidedAt`: string compare, with µs `…123457Z` beating `…123456Z` while the `Date` values are equal, and the input returned verbatim. Also `after`, `mergeNewIds` and `badgeText` (9+).
  - `requests-api.test.ts` › markSeen: the body is exactly `JSON.stringify({ seenUpTo: at })`.
  - `AppShellView.test.tsx` › the "nav badge" block (4 tests).
  - Seen-flow wiring, checked by reading the code:
    - `MyRequestsPage.tsx:35-45`: `markSeen` is called only with the non-null result of `newestDecidedAt(items, markedUpTo.current)`, and the ref is set before the call.
    - `requests-api.ts` `markSeen(seenUpTo: string)` takes a required argument. Grep finds exactly one non-test call site, so `{}` is never sent.
    - The server's `decidedAt` uses the same `ISO` `to_char` (`requests.ts:54,59`) that the seen validator accepts (`MICRO_RE`).
  - Race guard (`useRequestBadge.tsx`), checked by reading the code. `refresh` takes `++seq` and writes only if `seq` is unchanged, and the provider's `set` bumps `seq`. I traced three orders and each ends on the post-seen count:
    - The pathname refresh answers before markSeen: the badge shows 1, then 0.
    - The refresh answers after markSeen's `set(0)`: the response is discarded.
    - The refresh starts after markSeen is sent and returns stale: it is discarded because the later `set` bumps `seq`.
  - There is no interval or polling. The focus and visibility listeners are removed on unmount.
- [x] AC4: Static-render and pure-logic tests cover the button rules, the page and the badge, with no jsdom. All tests listed in plan `## Tests to write` exist and pass. The diff adds no jsdom import; the only jsdom matches are in the existing `src/ui/auth/*.test.ts`, untouched here.

Plan "Local run" steps were not performed by the implementer (impl-log follow-ups say so). The thin hook and container wiring was checked by code reading plus typecheck and build. The end-to-end run is in the PR's Ming checks below.

Ming verification after merge (carry into the PR):
- Sign in as a real User with a linked member, then:
  - request an empty seat;
  - see it in My requests, cancel it, and request it again;
  - have a Manager approve it through the API;
  - focus the tab or change page and see badge "1";
  - open My requests and see "Approved", the "decided by" line and the "New" chip;
  - check that the badge clears.
- At about 360 px as a Manager (6 rail items) and an Admin (7): the bottom bar scrolls, the first item is not clipped, and the badge is not clipped.
- A screen reader announces the link as "My requests, 1 new decision".

### Scope
All changed source files are in the plan's file list. `work/ming-todo.md` (M-40) and the ticket and plan files are workflow files. No High path was touched.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` is clean. The UI imports only `@/lib` and `../`, and the page imports `@/ui`.
- R2, R3, R6, R7: no server, schema or config change.
- R4: in plan.
- R5: green checks, and the new logic has tests.
- D36: all new strings are in `copy/requests.ts`, `copy/seats.ts` and `copy/shell.ts`, and the no-literals test passes.

### Blockers from review agents
None.

### Nits (do not block)
- `MyRequestsPage.tsx:40`: when `markSeen` fails, `markedUpTo` keeps the value, so a later reload in the same visit does not retry. This is the plan's documented behaviour ("next visit retries"). If you change it, reset the ref on failure.
- On opening `/requests`, the pathname refresh can briefly show the old count before markSeen lands (the "1 then 0" order above). It always settles on the correct count.
- `MyRequestsPage.tsx` `onCancel` guards with the `cancellingId` state from the render closure. The view disables every Cancel while one is in flight, so a double click cannot slip through in practice.

### Follow-ups (out of scope)
- `hasPendingRequest` on `SeatDto` (LAY-06 marker), a "View my requests" link after a request, and a "More" menu for the mobile bottom bar (plan Assumption 11).
- Older `<button[^>]*disabled[^>]*>` assertions in `SeatActions.test.tsx` and the ApprovalsView tests always match because of the `disabled:` utility classes. Tighten them to `\sdisabled=""` (impl-log follow-up).
