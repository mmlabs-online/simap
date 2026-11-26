## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed commit 52b29e9 ("SIM-054: implement") on branch `claude/modest-allen-yru4g8`.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0 / exit 0, "check-layers: 864 files, no violations"
- `pnpm test` — exit 0, "Test Files 328 passed | 1 skipped (329); Tests 3287 passed | 7 skipped (3294)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only; the diff has no DB or server code)

### Acceptance criteria
- [x] No "My requests" nav link for User, Manager or Admin, desktop or mobile — evidence: `src/lib/nav.ts` row and `NavId` member removed; `src/lib/nav.test.ts` › "there is no My requests entry for any tier (REG-02, D74)" and the updated per-tier lists (admin length 11); `src/ui/AppShellView.test.tsx` › "no tier has a /requests link (REG-02)" checks the whole markup (rail and bar share `navItemsFor`); admin link list without `/requests`. Grep of `src/` finds no remaining `myRequests` nav/copy reference except `pages.myRequests` (still used by `MyRequestsView.tsx:51`, kept as planned).
- [x] `/requests` lands on `/portal?tab=seat` — evidence: `src/app/(app)/requests/page.tsx` renders `RequestsRedirect`; `src/ui/requests/RequestsRedirect.tsx` does `router.replace(requestsPageRedirect)` in an effect (client-side, same pattern as the `/devices` redirect); `portal-state.test.ts` › "sends /requests to My seat". Live browser check goes to Ming's post-merge list.
- [x] Portal badge sums incoming transfers, overdue devices and unseen decisions — evidence: `src/ui/portal/portal-state.ts` `portalBadgeTotal(c, decisions)`; `src/ui/AppShell.tsx` feeds `count` from `useRequestBadge` into `portal` and `portalBreakdown`; tests `portal-state.test.ts` › "is incoming + overdue + decisions; returns and extensions are ignored" (9, 0, 3) and › portalBreakdown with decisions (single, "7 pending items: …", zero); `AppShellView.test.tsx` portal badge numeral / 9+ / zero / together-with-devices tests.
- [x] Opening My seat clears the decision count; My devices and Profile do not — evidence: `PortalPage.tsx` mounts `MySeatTab` only for `tab === "seat"` with `markSeen={marksDecisionsSeen(tab)}`; `MySeatTab.tsx` ports the old `onPage` flow (never an empty body, only up to the newest shown decision, `markedUpTo` guard so a cancel/release reload does not re-send, `setBadge` guarded by `mounted`); `portal-state.test.ts` › "only the My seat tab marks decisions seen; landing on /portal is My seat" (includes `parsePortalTab([])`). The old path `MyRequestsPage.tsx` is deleted and nothing else calls `markSeen`.
- [x] Approvals badge unchanged — evidence: no Approvals file in the diff; `AppShell.tsx` only drops `myRequests` and changes `portal`; existing approvals/devices badge tests pass.
- [x] Unit tests cover the badge sum, the mark-seen-on-tab rule and nav — see the tests above; `pnpm test` green.

Ming verification after merge (carried to the PR): as a User, get a request decided, see the My Portal badge include it; open My seat (or land on `/portal`) and see the badge drop by the decision count; with an unseen decision open My devices / Profile directly (`/portal?tab=devices`) and confirm the badge keeps it; open an old `/requests` bookmark and confirm it lands on My seat.

### Scope
Every changed file is in the plan's file list; no out-of-plan files; no High path touched. `MyRequestsView.tsx` untouched, as the plan allows.

Plan assumption on live `newIds` ("New" chips) in My seat: **acceptable, not scope creep.** The chips are produced by the same `onPage` callback the mark-seen flow needs (`mergeNewIds` was part of the deleted `MyRequestsPage.onPage`), `MyRequestsView` already has the `newIds` prop and chip markup, and no new copy, API or component is added. Since D74/POR-02 make My seat "the only place a member sees their own requests", keeping the chip that showed which decisions are new is part of moving the page, not a new feature. Passing `new Set()` would quietly drop behaviour users had on `/requests`. It also matches the mark-seen semantics: the chip stays for the visit even after the server has marked the rows seen.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: the page imports only `@/ui`; UI imports lib and ui only (`check:layers` clean). R3: no env or secrets. R4: in plan. R5: checks green, new logic tested. R6/R7: no server or API change. D36: badge text built from existing copy helpers in `src/ui/copy/shell.ts`.

### Blockers from review agents
None.

### Nits (do not block)
- The tab-to-markSeen wiring in `MySeatTab`/`PortalPage` is covered only through the pure `marksDecisionsSeen` rule, with no component test. That is fine at the light-unit-test level of this phase.
- `shellCopy.badge.byNav.portal` falls back to `incomingTransfers`, which would be wrong for a decisions-only count if a caller ever left out `badgeLabels.portal`. `AppShell` always passes the label, so nothing is wrong today.
- The ticket table still shows `Attempts | 0`; the orchestrator should update it.

### Follow-ups (out of scope)
- Remove `MyRequestsView`'s standalone (non-`embedded`) mode and `shellCopy.pages.myRequests`, which nothing uses since `MyRequestsPage` was deleted (already noted in impl-log).
