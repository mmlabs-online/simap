## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (839 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, types generated, "check-layers: 785 files, no violations"
- `pnpm test` — exit 0, "Test Files 297 passed | 1 skipped (298)", "Tests 2989 passed | 9 skipped (2998)"; matches impl-log
- `pnpm build` — exit 0, "Compiled successfully"
- `pnpm test:db` — not run (no server/SQL change; CI runs it). Seeder insert checked by hand against `db/migrations/20261125120000_device_lifecycle.sql` l.37-69: extension shape (`to_member_id` null, `new_expires_on` not null), FKs (`members[0]` owns Tablet E, l.146-150), one-pending index covered by a target-less `on conflict do nothing`.

### Acceptance criteria
- [x] Manager+ see pending extension requests and can approve (sets the new expiry) or reject them. Evidence: `incoming-transfer.test.ts › handoffBoxes` (user → incoming; manager → + extensions; admin → incoming, returns, extensions); `devices-api.test.ts › pendingExtensions GETs /api/handoffs?box=extensions`; `PendingExtensions.test.tsx` (rows, owner, "Current expiry → requested", no-expiry, canConfirm/canDecline gating, busy disabled, empty renders nothing, error + Retry, truncated); `extension-device.test.ts` (approve/reject ok with name, inv and new date; `handoff_not_pending`/`not_found` → `extend.gone`; `not_allowed`/unknown → error). Wiring: `DevicesPage.tsx` l.292-319 uses `confirmHandoff`/`declineHandoff` with the extension outcomes. Approve actually setting the expiry is server behaviour (SIM-037.5) and is in Ming's local check.
- [x] A non-Manager never requests `box=extensions`. Evidence: `DevicesPage.tsx` l.70-73 `useHandoffList(api, "extensions", boxes.includes("extensions"))` with `boxes = handoffBoxes(isAdmin, isManager)`; `handoffBoxes(false, false)` has no `extensions` (test); `fetcherFor` maps each of the three boxes to its own call (`incoming-transfer.test.ts › fetcherFor`), used in `useIncomingHandoffs.ts` l.14, so `extensions` no longer falls through to `incomingHandoffs`.
- [x] The nav badge and its breakdown include pending extensions for Manager+. Evidence: `badgeTotal` sums extensions (`= 10` test); `badgeCountAfter` 4-arg incl. any-null → null (test); `AppShell.tsx` l.24 uses `badgeTotal`; `AppShellView.test.tsx › devicesBreakdown` "1 extension request", "3 extension requests", `{2,1,3,1}` → "7 pending items: … 3 extension requests, 1 overdue device". `refreshAll` refreshes the extensions list and passes it to `badgeCountAfter` (`DevicesPage.tsx` l.104-116).
- [x] All new strings live in `src/ui/copy/*` (D36). Evidence: diff read; new UI text only in `src/ui/copy/devices.ts` `extensions` block and `src/ui/copy/shell.ts` `extensionRequests`; `PendingExtensions.tsx` and `extension-device.ts` have no literal English.

Ming verification after merge (carry to the PR): the plan's local `pnpm seed:dev` + `pnpm dev` check (Tablet E request visible to Manager/Admin; Approve sets the new date, drops the Overdue chip and badge; Reject keeps it overdue; a plain User sees no list and sends no `box=extensions` request).

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: all changed code under `src/ui/**` imports `@/lib/*` or ui-local modules (`check:layers` clean). R4: every changed file is in the plan's file list. R5: each new pure function and the component have tests. R7: no route handler change. R2/R6: no schema or query change.

### Blockers from review agents
None.

### Nits (do not block)
- Plan's Ming check says "Re-seed (or a second request) and Reject". Re-seeding will not recreate the request after an Approve/Reject: the seed row uses a fixed id `u("c", 1)` with `on conflict do nothing`, so it stays decided. Ming needs a fresh database or a second request made by hand to test Reject. Put this in the PR's Ming steps.
- A Manager's own overdue device with a pending extension counts twice in the badge (one overdue, one extension request). That matches what the API returns (A5) and is fine, but it is worth knowing.

### Follow-ups (out of scope)
- None.
