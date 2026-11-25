Status: READY

# Plan — SIM-037.11: Devices UI: overdue chip and filter, owner banner, extension requests

**This plan covers slice 1 of 2: the owner side plus shared plumbing.** The Manager+ "Pending extensions" list (Approve / Reject) is slice 2. See `## Split proposal`. No High path is touched.

## Scope summary
From `docs/spec-v1.md`:
- DEV-02 (l.287-289): "The Devices page filters by all / placed / not placed / org inventory / overdue."
- DEV-10 (l.336-340): "A device whose expiry date has passed (UTC+7 calendar day, D35) shows **Overdue** wherever it is listed. Overdue is computed when read, never stored." and "Its owner sees an in-app reminder (nav badge and a banner on the Devices page) to ask for an extension or return it; no email in v1. The owner can request an extension (new date, optional note); an Admin or Manager approves (sets the new expiry) or rejects it (OQ-42)."
- DEV-08 (l.319-320): "A device has at most one pending handoff (transfer, return or extension)."
- OQ-42 (l.700): "the owner requests a new date, an Admin or Manager approves or rejects; an Admin or Manager can also edit the expiry directly."

From `work/decisions.md` D63: "Past the expiry it shows Overdue with an in-app reminder to extend or return."

Ticket scope: Overdue filter chip and row chip; nav badge and breakdown with overdue (owner) and pending extensions (Manager+); owner banner with Extend and Return; Extend dialog (date + note); owner Cancel on the row; "Extension pending" chip; Pending extensions for Manager+ with Approve / Reject; copy in `src/ui/copy/*` (D36); a dev-seed device with expiry yesterday.

Merged API (SIM-037.5 `plan.md` `## Split proposal`, verified in code): `DeviceDto.overdue` (`src/lib/devices/types.ts` l.83), `?placement=overdue` (org-wide: `src/server/devices/devices.ts` l.170 has no owner condition), `POST /api/devices/:id/handoffs {kind:"extension", newExpiresOn, note}` (owner only: `src/lib/devices/handoff-rules.ts` l.82-92), `POST /api/handoffs/:id/cancel`, `GET /api/handoffs/count` → `{incoming, returns, extensions, overdue}` with `overdue` = caller's own owned devices past expiry (`src/server/devices/handoffs.ts` l.787).

**Slice 1 delivers:** Overdue filter + row chip, "Extension pending" chip, Extend action and dialog, Cancel extension on the row, owner banner (Extend / Give back / Cancel), nav badge + breakdown with `overdue`, dev seed. **Slice 2 delivers:** the Manager+ Pending extensions list (Approve / Reject) and the `extensions` part of the badge.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Overdue devices show an Overdue chip and appear under the Overdue filter; devices with no expiry never do. | `devices-state.test.ts › filterOptions lists all five filters, Overdue last`; `DevicesView.test.tsx › an overdue row shows the Overdue chip and "Expired on <date>"; a row with overdue false (no expiry) shows neither`; `devices-api.test.ts › list("overdue") calls /api/devices?placement=overdue`. The server half (no-expiry never overdue) is already covered by `handoffs.db.test.ts › device DTO overdue: ...` (SIM-037.5). |
| 2 | The owner sees the overdue count in the nav and a banner with Extend and Return. | `incoming-transfer.test.ts › badgeTotal sums incoming, returns and overdue (not extensions yet)`; `AppShellView.test.tsx › devicesBreakdown: one part alone, several parts as "N pending items: ..."`, zero parts left out; `OverdueBanner.test.tsx › lists only my overdue devices with Extend and Give back; renders nothing when none; a pending extension shows its chip and Cancel instead of Extend; more than 5 shows "Show all overdue"`. |
| 3 (owner half) | The owner can request an extension (date after today) and cancel it. | `extend-device.test.ts › nextDay; toExtendBody: empty or <= today -> invalid with the date message; a valid date -> {kind:"extension", newExpiresOn, note}; settleExtend: ok/not_found done, handoff_pending/not_allowed/device_unowned stale`; `ExtendDeviceDialog.test.tsx › date input has min = tomorrow and is required; shows current expiry; note field`; `devices-api.test.ts › startExtension posts {kind:"extension", newExpiresOn, note} to /api/devices/:id/handoffs`; `device-actions.test.ts › extend only for mine && overdue && no pending handoff; cancelExtension for a pending extension with canCancel`; `transfer-device.test.ts › cancelOutcome("extension") uses extension wording`. |
| 3 (Manager half) | Manager+ approve or reject from the pending list. | **Slice 2** (see `## Split proposal`). |
| 4 | All new strings live in `src/ui/copy/*` (D36). | Reviewer reads the diff: no literal English UI strings in the new/changed `.tsx`/`.ts` under `src/ui/devices/`; all come from `devicesCopy` / `shellCopy`. `pnpm typecheck` passes (`Record<PlacementFilter, …>` copy keys complete). |

All checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
- Local run (`pnpm dev`) against a local DB after `pnpm seed:dev`: under the seed org, "Tablet E" (INV-5) shows the Overdue chip and is listed under the Overdue filter; the other seed devices (no expiry) are not.
- Owner flow with your own dev user (your Identity user is not a seed member, so the seed device is not yours): as Admin assign an org-inventory device to yourself, then on the local DB only run `update devices set holding_expires_on = current_date - 1 where inventory_number = '<INV>';`. Reload Devices: the nav badge counts it, the banner shows it with Extend and Give back; Extend with tomorrow's date shows "Extension pending" and Cancel; Cancel clears it.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/devices-state.ts` (l.7, l.26-42) | `FILTERS` += `"overdue"` (last). `expiryText(h, overdue = false)`: overdue → `devicesCopy.holding.expired(date)`. `pendingText`: `kind === "extension"` → `{ chip: pending.extensionChip, to: p.newExpiresOn ? pending.newDate(p.newExpiresOn) : null }`; update the doc comment (the `to` field is the chip's second line). | AC1, extension chip | No |
| `src/ui/devices/DeviceTable.tsx` (l.33-59 `OwnerLabel`) | Add `{device.overdue && <Chip label={devicesCopy.overdueChip} color="var(--error-container)" onColor="var(--on-error-container)" />}` after the pending chip; call `expiryText(h, device.overdue)`. `OwnerLabel` is used by both the table and card layouts, so one change covers both. | AC1 (text, not colour only) | No |
| `src/ui/devices/device-actions.ts` (l.7-17, l.55-70) | `DeviceRowHandlers.onExtend?`. Cancel branch also accepts `pending.kind === "extension"` → key `cancelExtension`, copy `actions.cancelExtension`/`cancelExtensionAria`. New `extend` action (first after cancel) when `onExtend && d.mine && d.overdue && d.pendingHandoff === null`; key `extend`, copy `actions.extend`/`extendAria`. | AC3 owner half | No |
| `src/ui/devices/devices-api.ts` (after l.165) | `startExtension(id, newExpiresOn, note)` → POST `${devicePath(id)}/handoffs` body `{kind:"extension", newExpiresOn, note}` (like `startReturn`). | AC3 | No |
| `src/ui/devices/transfer-device.ts` (l.62-82 `cancelOutcome`) | `kind: "transfer" \| "return" \| "extension"`; `extension` → `devicesCopy.extend` (`cancelled`, `gone`). | Correct notice on extension cancel | No |
| `src/ui/devices/incoming-transfer.ts` (l.87) | `badgeTotal = incoming + returns + overdue` (doc comment: `extensions` joins in slice 2). `badgeCountAfter` fallback unchanged (`overdue: 0` on a failed count is acceptable; the next count fixes it). | AC2 | No |
| `src/ui/copy/shell.ts` (l.5-13 + `badge` export) | `devicesBreakdown(c: HandoffCountDto)`: parts `incomingTransfers`, `pendingReturns`, new `overdueDevices(n)` ("1 overdue device" / "N overdue devices"), zero parts left out; one part → the part alone; ≥2 parts → `${total} pending items: ${parts.join(", ")}` where total = sum of shown parts. Export `overdueDevices` on `shellCopy.badge` if the other helpers are exported there. `import type` from `@/lib/devices/types` (lib, allowed for ui). | AC2 | No |
| `src/ui/AppShell.tsx` (l.26) | `shellCopy.badge.devicesBreakdown(handoffs)`. | AC2 | No |
| `src/ui/copy/devices.ts` | Add: `overdueChip: "Overdue"`; `holding.expired(d)` ("Expired on D"); `pending.extensionChip` ("Extension pending"), `pending.newDate(d)` ("Requested until D"); `actions.extend` ("Extend"), `extendAria(inv)`, `cancelExtension` ("Cancel extension"), `cancelExtensionAria(inv)`; `extend.{title, submit, currentExpiry, newDate, newDateHint, note, noteHint, next, sent(name, inv), cancelled(name, inv), gone, errors.{dateInvalid, invalid}}`; `overdueBanner.{heading(n), hint, showAll}`. `empty.overdue` already exists (l.221). | D36 | No |
| `src/ui/devices/extend-device.ts` (new) | Pure: `nextDay(day)` (parse `YYYY-MM-DD`, `Date.UTC` + 1 day, back to string; no local-time `Date`); `ExtendForm = {newExpiresOn, note}`, `emptyExtendForm()`; `toExtendBody(form, today)` via `validateHandoffStart({kind:"extension", ...}, today)`, field `newExpiresOn` → `extend.errors.dateInvalid`, `note` → `devicesCopy.assign.errors.noteInvalid`; `settleExtend(result)` mirroring `settleReturn` (`return-device.ts` l.36-54), stale codes `handoff_pending`, `not_allowed`, `device_unowned`; `invalid_request` → `extend.errors.invalid`. | AC3, same rules as the server | No |
| `src/ui/devices/ExtendDeviceDialog.tsx` (new) | Mirrors `ReturnDeviceDialog.tsx` (keyed by device, mounted only when open, `EntityFormDialog`). Fields: read-only current expiry (`device.holding?.expiresOn`), `DialogField type="date" required min={nextDay(today)}` (see `AssignDeviceDialog.tsx` l.73-76 for the date field), `NoteField`, `next` hint. Pure `ExtendDeviceFields` exported for the markup test. `today = todayUtc7(new Date())` computed once per mount. | AC3 | No |
| `src/ui/devices/OverdueBanner.tsx` (new) | Pure, props `{ devices: DeviceDto[]; truncated: boolean; handlers: DeviceRowHandlers; busyId: string \| null; onShowAll: () => void }`. Filters `d.mine && d.overdue`; renders nothing when none. `<section aria-labelledby="overdue-heading">` with h2 `overdueBanner.heading(n)`, hint, up to 5 rows (name, `typeLine`, `holding.expired(date)`, pending chip via `pendingText`, `<DeviceRowActions device handlers busyId />`), and a `showAll` button when more than 5 or `truncated`. Not dismissible, not `role="alert"`. | AC2 | No |
| `src/ui/devices/DevicesPage.tsx` | `const overdue = useDevices(api, "overdue")` (separate list so the banner does not depend on the page filter). `extending` state + `<ExtendDeviceDialog>` (onDone: notice `extend.sent`, `refreshAll()` then focus page heading; onStale: `refreshAll()`). `onExtend` in `actions`. `onCancelHandoff` (l.159-163): map `pending.kind` straight through (`"transfer" \| "return" \| "extension"`). `refreshAll` (l.88-93) also awaits `overdue.refresh()`. Replace the bare `refresh()` calls in dialog callbacks (Transfer, Place, Assign/edit holding, Delete; l.255-339) with a `refreshDevices()` helper = `Promise.all([refresh(), overdue.refresh()])` so the banner never goes stale (an expiry edit can clear overdue). Render `<OverdueBanner devices={overdue.items} truncated={overdue.truncated} handlers={{ onExtend, onReturn, onCancelHandoff }} busyId={cancellingId} onShowAll={() => setFilter("overdue")} />` first inside the `incoming` fragment (l.189-248). Add `overdue.refresh` to the `useMemo` deps (l.171). | AC2, AC3 | No |
| `db/seeder.js` (l.132-144) | After the loop, insert device n=5 "Tablet E", `INV-5-<key>`, owner `members[0].id`, unplaced, `holding_expires_on = (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1` (UTC+7, D35), `on conflict do nothing`. No DB check forbids a past date (`db/migrations/20261125120000_device_lifecycle.sql` l.10-30 only ties holding fields to an owner). | Manual check (ticket scope) | No (`db/**` is not High; only `db/migrations/**` is) |
| Tests (see `## Tests to write`) | New and updated test files. | R5 | No |

## Data model / migration
None.

## API contract
None (consumes the SIM-037.5 API unchanged).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/devices/devices-state.test.ts` › update l.151-153: "is null without a handoff"; new "an extension gives the extension chip and 'Requested until <date>'" | pendingText |
| `devices-state.test.ts` › "filterOptions lists all, placed, inventory, unowned, overdue" | AC1 filter |
| `devices-state.test.ts` › "expiryText: overdue gives 'Expired on <date>', not overdue gives 'Until <date>', null gives 'No expiry'" | AC1 |
| `src/ui/devices/device-actions.test.ts` › update l.165 and l.211-226: extension with canCancel → `cancelExtension` with aria "Cancel extension of device INV-7"; without canCancel → none | AC3 cancel |
| `device-actions.test.ts` › "extend: mine && overdue && no pending → extend; not mine, not overdue, or pending → no extend; no handler → none; busyId disables it" | AC3 gating |
| `src/ui/devices/devices-api.test.ts` › "startExtension posts kind extension with newExpiresOn and note"; "list('overdue') path" | API client paths |
| `src/ui/devices/transfer-device.test.ts` › "cancelOutcome extension: ok → extend.cancelled; handoff_not_pending → extend.gone" | notice wording |
| `src/ui/devices/extend-device.test.ts` (new) › `nextDay` (month end, year end, 2028-02-28 → 02-29); `toExtendBody` (empty, today, yesterday → dateInvalid; tomorrow ok; note trimmed/blank → null; 501-char note → noteInvalid); `settleExtend` (ok, not_found, stale codes, invalid_request, other) | AC3, UTC+7 date edges |
| `src/ui/devices/ExtendDeviceDialog.test.tsx` (new, template `ReturnDeviceDialog.test.tsx`) › date input `type="date"`, `required`, `min` = tomorrow; current expiry shown; note label | AC3 markup |
| `src/ui/devices/OverdueBanner.test.tsx` (new) › only `mine && overdue` rows; nothing when none; Extend and Give back buttons with aria; pending extension → chip + Cancel, no Extend; 6 devices → 5 rows + Show all; truncated → Show all; Vietnamese name rendered intact | AC2 |
| `src/ui/devices/DevicesView.test.tsx` › "overdue row shows the Overdue chip and Expired on"; "overdue false shows no chip" | AC1 |
| `src/ui/devices/incoming-transfer.test.ts` › update l.149: `badgeTotal({incoming:2, returns:3, extensions:4, overdue:1})` = 6 | AC2 |
| `src/ui/AppShellView.test.tsx` › rewrite l.240-255 for `devicesBreakdown(counts)`: single incoming / return / overdue parts; `{2,1,0,1}` → "4 pending items: 2 incoming transfers, 1 pending return, 1 overdue device"; extensions ignored in slice 1 | AC2 |
| `db/seeder.test.ts` › only if it asserts device ids or counts (it currently checks `seedRows`, l.108-113); add an assertion only if a row helper is introduced | seed |

## Approach
1. Copy first (`devices.ts`, `shell.ts`), then `FILTERS`, `expiryText`, `pendingText` and their tests; `pnpm typecheck` stays green.
2. `devices-api.ts` `startExtension` + test; `cancelOutcome` kind union + test.
3. `device-actions.ts` Extend and Cancel extension + tests; `DeviceTable.tsx` Overdue chip.
4. `extend-device.ts` + tests; `ExtendDeviceDialog.tsx` + markup test.
5. `OverdueBanner.tsx` + markup test (reuses `DeviceRowActions`, so its buttons follow `rowActions` gating).
6. Badge: `badgeTotal`, `devicesBreakdown(counts)`, `AppShell.tsx`, tests.
7. `DevicesPage.tsx` wiring (overdue list, dialog, `refreshAll`/`refreshDevices`, handlers).
8. Seed device; run all Checks.

Rules:
- R1: all new code is under `src/ui/**` and imports only `@/lib/*` (`todayUtc7` from `@/lib/devices/holding`, `validateHandoffStart` from `@/lib/validate/device`, as `return-device.ts` l.7-8 already does). `pnpm check:layers` verifies this.
- R7: no route handler changes. Client: the extension start goes through `apiFetch`; the server checks permission before writing.
- R4: only the files above. R5: every new pure function has unit tests.
- Dates: only `todayUtc7` and string compare. `nextDay` uses `Date.UTC` on the parsed parts, never `new Date("YYYY-MM-DD")` in local time.
- Concurrency: the Extend dialog has its own `submitting`. Banner Cancel goes through the existing `onCancelHandoff` (`acting` lock, `cancellingId`).

## Specialist input used
- frontend-developer 1-3, 6-8 and ux-architect 3-5, 9-11: adopted (dialog modelled on Return, `validateHandoffStart` for the body, `min` = tomorrow UTC+7, separate overdue fetch, `mine` filter, `cancelOutcome` kind, copy groups, tests, seed).
- frontend-developer 1 / ux-architect 6 (PendingExtensions, `useHandoffList` three-way map, tier-aware `handoffBoxes`, approve/reject outcomes, third heading ref): moved to slice 2.
- ux-architect 1 (danger tone for the chip, "Expired on" line): adopted with the existing `Chip` `color`/`onColor` props and `--error-container` tokens (`src/app/globals.css` l.45-46). No new `tone` prop needed.
- ux-architect 3 (banner heading from the count): adapted. The heading uses the number of my overdue devices in the fetched list, so the heading and the rows always match. A truncated list shows "Show all overdue".
- ux-architect 7 / frontend-developer 4 (badge includes extensions): `overdue` now. `extensions` joins in slice 2 with the list, so a Manager never sees a count they cannot act on.
- frontend-developer "useHandoffList silent bug": not triggered in slice 1 (no `extensions` box is fetched). Recorded for slice 2.
- ux-architect 10 (also seed another user's overdue device and a pending extension): partly adopted. One overdue device is seeded; the pending extension seed goes to slice 2, where the Manager list needs it.

## Assumptions
Planner assumptions adopted from consultant recommendations; Ming to confirm:
- A1 (FE Q1, UX risk): the banner uses a separate `GET /api/devices?placement=overdue` fetch, filtered client-side by `mine`. The server list is org-wide (`devices.ts` l.170), so a Manager's banner still shows only their own devices.
- A2 (FE Q2, UX Q2): Extend is offered only on overdue devices (DEV-10). The API also accepts a not-yet-overdue request, but due-soon is out of scope.
- A3 (FE Q3, UX Q1): Manager+ extend someone else's device only through the existing "Note / expiry" edit (`canEditHolding`, DEV-07 l.314-315). No Extend button for non-owners (the API refuses non-owners anyway, `handoff-rules.ts` l.89).
- A4 (FE Q4): Reject has no reason field (the decline API takes none). Applies to slice 2.
- A5 (FE Q5, UX Q4): the nav badge is a sum, with a breakdown in the aria label. An owner's overdue devices keep the badge up until they act; this is intended by DEV-10.
- A6 (UX Q3): the banner lists up to 5 devices with buttons, plus "Show all overdue" (sets the Overdue filter).
- A7: the banner is placed first inside the existing `incoming` slot of `DevicesView`, so `DevicesView.tsx` does not change.
- A8: other device lists (seat panel, search, members) use their own DTOs without `overdue`. "Overdue wherever it is listed" there is a follow-up, not this ticket.
- A9: `badgeCountAfter` fallback keeps `overdue: 0` on a failed count. It is transient, and the next count corrects it.

Hotspots: `SIM-039.5` (PLANNING, editor palette) is the only other open ticket, and it is not expected to touch `src/ui/devices/**`, `src/ui/AppShell.tsx` or `src/ui/copy/shell.ts`. No rebase is expected. Slice 2 will edit the same `DevicesPage.tsx`, `incoming-transfer.ts`, `shell.ts` and `devices.ts`, so it must start after this slice merges.

## Blocking questions
None.

## Split proposal
The full ticket comes to about 600 non-test lines (owner side ~400, Manager list ~200) plus tests. That is over one review cycle, so this plan covers **slice 1 only**.

- **Slice 1 (this plan, SIM-037.11):** everything in `## Files to create / modify`. AC1, AC2, AC3 owner half, AC4.
- **Slice 2 (new ticket, proposed `SIM-037.12` "Devices UI: pending extensions for Manager+", Depends on SIM-037.11, areas ui, Size S):**
  - `devices-api.ts`: `pendingExtensions: () => listHandoffs("extensions")`.
  - `useIncomingHandoffs.ts` l.14: a three-way fetcher map (`incoming` / `returns` / `extensions`). Without it, `extensions` silently fetches incoming.
  - `incoming-transfer.ts`: tier-aware `handoffBoxes(isAdmin, isManager)`, with `extensions` for Manager+ only (a non-Manager gets a 422). `badgeTotal` += `extensions`. `badgeCountAfter(count, inc, ret, ext)` fallback uses `ext.length`.
  - `PendingExtensions.tsx`, cloned from `PendingReturns.tsx`: Approve (`canConfirm`, `data-handoff-confirm`) and Reject (`canDecline` → `declineHandoff`). Lines: owner, "Current expiry X → requested Y", note.
  - `extension-device.ts`: `approveExtensionOutcome` / `rejectExtensionOutcome` with extension "gone" wording.
  - `DevicesPage.tsx`: `useHandoffList(api, "extensions", isManager)`, a third heading ref in the focus effect (l.80) and in `act` (l.106, l.111), and `extensions.refresh()` in `refreshAll`.
  - `shell.ts`: an `extensionRequests(n)` breakdown part. Copy `devicesCopy.extensions.*`.
  - Seed: one pending extension. Tests for all of the above.
  - AC: "Manager+ approve or reject from the pending list"; "Nav badge … pending extensions (Manager+)".
