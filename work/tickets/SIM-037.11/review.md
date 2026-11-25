## Attempt 1 — 2026-11-25
Verdict: REWORK

Scope reviewed: slice 1 only (owner side and shared plumbing), as plan.md `## Split proposal` says. The Manager+ Pending extensions list (AC3 Manager half) belongs to SIM-037.12 and is not judged here.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (798 files)
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0, "check-layers: 744 files, no violations"
- `pnpm test`: exit 0, "Test Files 282 passed | 1 skipped (283); Tests 2881 passed | 9 skipped (2890)" (same as impl-log)
- `pnpm build`: exit 0, all routes built (the implementer did not run it, so the reviewer ran it)
- `pnpm test:db`: CI-only, not run. The diff changes no server or SQL code (only `db/seeder.js`).
- Seeder: not run against a local DB. I checked the SQL against `db/migrations/20261120150000_init.sql` l.113-135 and `20261125120000_device_lifecycle.sql` l.26-31. `role` defaults to `'secondary'` with no seat, so `devices_primary_needs_seat_check` holds; `owner_id` is set, so `devices_unowned_no_holding_check` holds; `type` is free text with a non-blank check; the id `u("8", 5)` does not collide with the loop's ids 1-4. Ming checks it after merge.

### Acceptance criteria
- [x] AC1: Overdue devices show an Overdue chip and appear under the Overdue filter; devices with no expiry never do. Evidence: `devices-state.test.ts › filterOptions lists all five filters, Overdue last`, `› expiryText overdue gives 'Expired on <date>'; no expiry stays No expiry`; `DevicesView.test.tsx › an overdue row shows the Overdue chip and 'Expired on <date>'; overdue false shows neither`; `devices-api.test.ts › list("overdue")` calls `/api/devices?placement=overdue`. The chip is at `DeviceTable.tsx` l.42-48 (text, not colour only). The server half was covered by SIM-037.5. All pass.
- [ ] AC2: The owner sees the overdue count in the nav and a banner with Extend and Return. The nav part is met: `incoming-transfer.test.ts › badgeTotal sums incoming, returns and overdue`; `AppShellView.test.tsx › devicesBreakdown: one part alone, ...`; `AppShell.tsx` l.26. The banner component meets it in isolation (`OverdueBanner.test.tsx`, 4 tests pass). **On the page it gets every row handler, so it shows far more than Extend and Return.** See Issue 1.
- [x] AC3 (owner half): The owner can request an extension (date after today) and cancel it. Evidence: `extend-device.test.ts` (nextDay month/year end and leap day, toExtendBody today/yesterday/empty invalid and tomorrow ok, note trim and the 501-character limit, settleExtend codes); `ExtendDeviceDialog.test.tsx` (`type="date"`, `required`, `min` = tomorrow); `devices-api.test.ts › startExtension posts {kind:'extension', newExpiresOn, note}`; `device-actions.test.ts › extend: mine && overdue && no pending ...`, `› ... extension -> cancelExtension`; `transfer-device.test.ts › cancelOutcome extension`. The dialog computes `today` with `todayUtc7` once per mount (`ExtendDeviceDialog.tsx` l.559 of the diff), and `nextDay` uses `Date.UTC`.
- [ ] AC3 (Manager half): slice 2 (SIM-037.12), not in this plan.
- [x] AC4: All new strings live in `src/ui/copy/*` (D36). I read the diff and found no literal UI strings in the new or changed `.ts`/`.tsx` under `src/ui/`. All of them come from `devicesCopy` / `shellCopy`.

### Issues
#### Issue 1 — 🔴 blocker — plan deviation / UX (R4)
- **Where**: `src/ui/devices/DevicesPage.tsx` l.204-210 (`<OverdueBanner ... handlers={actions} ...>`)
- **Expected**: The plan (Files table, `DevicesPage.tsx` row) says `handlers={{ onExtend, onReturn, onCancelHandoff }}`, so a banner row shows only Extend, Give back, or Cancel (for a pending handoff). The ticket says "Owner banner ... with Extend and Return (give back) actions". The banner test also renders it with that subset.
- **Actual**: The page passes the full `actions` memo (onAssign, onEditHolding, onPlace, onEdit, onDelete, onTransfer, onReturn, onExtend, onTakeBack, onCancelHandoff). `DeviceRowActions` → `rowActions` then renders every action the device's flags allow. A plain owner sees Place/Move and Transfer in the reminder. An Admin who owns an overdue device also sees Note / expiry, Edit and Delete there. The unit test cannot catch this because it passes the subset.
- **Fix instruction**: In `DevicesPage.tsx`, build the banner handlers from the existing memo and pass them in place of `actions`, for example `const bannerHandlers = useMemo<DeviceRowHandlers>(() => ({ onExtend: actions.onExtend, onReturn: actions.onReturn, onCancelHandoff: actions.onCancelHandoff }), [actions]);` and `handlers={bannerHandlers}`. Change nothing else in the banner. Re-run the Checks and record them in impl-log.

### Rules (CLAUDE.md)
- R4: Issue 1 (the banner wiring differs from the plan).
- R1, R2, R3, R6, R7: no violations found. All code is under `src/ui/**` and imports only `@/lib/*` or ui code; `check:layers` is clean. There is no route handler, migration or env change.
- R5: new logic has tests. All checks are green.

### Blockers from review agents
None.

### Nits (do not block)
- `extend-device.ts` `settleExtend`: `not_found` counts as done, so the page shows "Extension request ... sent" for a device that is gone. This mirrors `settleReturn`, so it is consistent, but the wording is misleading. Consider it for slice 2.
- `OverdueBanner.tsx`: the pending chip uses the default `Chip` tone while the table's Overdue chip uses `--error-container`. The banner has no Overdue chip, which is fine because the heading says it. This is only a note for consistency.
- `ExtendDeviceFields` renders an empty value if `holding.expiresOn` is null. This cannot happen for an overdue device, but `devicesCopy.holding.noExpiry` would be a safe fallback.

### Follow-ups (out of scope)
- SIM-037.12 (slice 2): Manager+ Pending extensions list, `extensions` in the badge, seed of one pending extension.
- A8 in plan.md: "Overdue wherever it is listed" for the seat panel, search and member lists.

## Attempt 2 — 2026-11-25
Verdict: PASS

Scope reviewed: slice 1 only (owner side and shared plumbing), as in attempt 1. The fix is commit 36452f7. I also re-checked the whole diff against `origin/main` briefly.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (798 files)
- `pnpm typecheck`: exit 0, types generated, tsc clean
- `pnpm check:layers`: exit 0, "check-layers: 744 files, no violations"
- `pnpm test`: exit 0, "Test Files 282 passed | 1 skipped (283); Tests 2882 passed | 9 skipped (2891)" (attempt 1 had 2881; the +1 is the new `bannerHandlers` test)
- `pnpm build`: exit 0, "Compiled successfully", all routes built
- `pnpm test:db`: CI-only, not run. No server or SQL code changed.

### Attempt 1 Issue 1 (blocker): fixed
- `src/ui/devices/device-actions.ts` l.158-163: `bannerHandlers(h)` returns only `onExtend`, `onReturn`, `onCancelHandoff`.
- `src/ui/devices/DevicesPage.tsx` l.207: `handlers={bannerHandlers(actions)}`.
- Every `DeviceRowHandlers` field is optional, and `rowActions` gates each action on its handler (`device-actions.ts` l.59-149). So the banner can show only Cancel (pending handoff or extension), Extend and Give back. That matches the plan's `DevicesPage.tsx` row and the ticket.
- Evidence: `device-actions.test.ts › bannerHandlers › keeps only onExtend, onReturn and onCancelHandoff from the full handler set` passes. It checks the keys, checks that the row actions are limited to the allowed set, and checks that the full set would give more actions.
- The helper adds one export that the plan did not name. It is in a file the plan already lists, and the fix instruction asked for exactly this narrowing, so it is not a scope issue.

### Acceptance criteria
- [x] AC1: unchanged since attempt 1, evidence still green.
- [x] AC2: nav count as in attempt 1. The banner now shows only Extend and Give back (plus Cancel for a pending request). Evidence is above.
- [x] AC3 (owner half): unchanged since attempt 1, evidence still green.
- [ ] AC3 (Manager half): slice 2 (SIM-037.12), not in this plan.
- [x] AC4: the fix adds no UI strings.

### Ming verification after merge
- Run `pnpm seed:dev` on a local DB and check that "Tablet E" (INV-5) shows as Overdue, with the banner showing Extend and Give back only.

### Rules (CLAUDE.md)
- R1, R2, R3, R4, R5, R6, R7: no violations found.

### Blockers from review agents
None.

### Nits (do not block)
- `bannerHandlers(actions)` builds a new object on every render. This is harmless today because `OverdueBanner` is not memoized. Wrap it in `useMemo` if the banner is ever memoized.
- The attempt 1 nits still apply (the `settleExtend` `not_found` wording, the pending chip tone, the null `expiresOn` fallback).

### Follow-ups (out of scope)
- SIM-037.12 (slice 2): Manager+ Pending extensions list, `extensions` in the badge, seed of one pending extension.
- A8 in plan.md: show Overdue wherever devices are listed (seat panel, search, member lists).
