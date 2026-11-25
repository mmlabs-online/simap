Status: READY

# Plan — SIM-037.12: Devices UI: pending extensions for Manager+

Slice 2 of 2 split from SIM-037.11 (slice 1 is merged: owner side, Overdue chip, banner, `overdue` badge part). Fast lane, no consult; the consult notes in `work/tickets/SIM-037.11/` and its `## Split proposal` are the specialist input. **No High path is touched** (checked against `.claude/loop.config.md`: no `db/migrations/**`, no `**/*.sql`, no auth/config/Dockerfile/workflow file; `db/seeder.js` and `src/ui/**` are not High).

## Scope summary
`docs/spec-v1.md` DEV-10 (l.336-340): "The owner can request an extension (new date, optional note); an Admin or Manager approves (sets the new expiry) or rejects it (OQ-42)." OQ-42 (l.700): "the owner requests a new date, an Admin or Manager approves or rejects".

Ticket scope: Manager+ see pending extension requests and approve or reject; the nav badge and breakdown count them; copy in `src/ui/copy/*` (D36); a seeded pending extension. Out of scope: reject reason (API takes none); owner side (slice 1).

API in place (SIM-037.5, verified): `GET /api/handoffs?box=extensions` (Manager+, a non-Manager gets 422), `POST /api/handoffs/:id/confirm` (approve) and `/decline` (reject), both Manager+ for kind extension (`src/lib/devices/handoff-rules.ts` l.100-126); `HandoffDto.canConfirm/canDecline` are true for Manager+ on a pending extension (l.129-139); `HandoffDto.newExpiresOn`, `device.expiresOn`, `note`, `from` (owner) exist (`src/lib/devices/types.ts` l.101-124); count `extensions` is 0 below Manager (l.141). `HandoffBox` already includes `"extensions"` (l.97).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | Manager+ see pending extension requests. | `incoming-transfer.test.ts › handoffBoxes(isAdmin, isManager)`: user → `["incoming"]`, manager → `["incoming","extensions"]`, admin → `["incoming","returns","extensions"]`; `devices-api.test.ts › pendingExtensions GETs /api/handoffs?box=extensions`; `PendingExtensions.test.tsx › lists device, owner, "Current expiry X → requested Y" and note; nothing when empty and no error`. |
| 1b | Manager+ can approve (sets the new expiry) or reject. | `PendingExtensions.test.tsx › Approve has data-handoff-confirm and aria with device and owner; Reject shown only with canDecline; both disabled while busy`; `extension-device.test.ts › approveExtensionOutcome / rejectExtensionOutcome: ok -> status notice with name, inv and (approve) new date; handoff_not_pending/not_found -> extension "gone" wording; other codes -> error notice`; local run: Approve clears the request, the device's "Expired on" becomes the new date, the Overdue chip goes (Ming check below). |
| 1c | A non-Manager never requests `box=extensions`. | `useIncomingHandoffs.test.ts` (or `incoming-transfer.test.ts`) `› fetcherFor("extensions") is api.pendingExtensions; fetcherFor("returns") is pendingReturns; fetcherFor("incoming") is incomingHandoffs` (pure helper, see Files); `handoffBoxes(false, false)` has no `extensions`, and `DevicesPage` passes `enabled = handoffBoxes(isAdmin, isManager).includes("extensions")`; the disabled hook state fetches nothing (existing behaviour, `useIncomingHandoffs.ts` l.26, l.35). |
| 2 | The nav badge and breakdown include pending extensions for Manager+. | `incoming-transfer.test.ts › badgeTotal({incoming:2, returns:3, extensions:4, overdue:1}) = 10`; `badgeCountAfter(count, inc, ret, ext)` fallback uses `ext.length`, and `null` when any list is `null`; `AppShellView.test.tsx › devicesBreakdown`: single extension part "1 extension request" / "N extension requests"; `{2,1,3,1}` → "7 pending items: 2 incoming transfers, 1 pending return, 3 extension requests, 1 overdue device". |
| 3 | All new strings live in `src/ui/copy/*` (D36). | Reviewer reads the diff: no literal English UI strings in new/changed `.ts`/`.tsx` under `src/ui/devices/`; `pnpm typecheck`. |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
- `pnpm seed:dev` then `pnpm dev` on a local DB. As a Manager or Admin of the seed org the Devices page shows "1 extension request" for "Tablet E" (owner = first seed member, "Current expiry <yesterday> → requested <today+30>"). Approve: the notice appears, the request disappears, Tablet E shows the new date and no Overdue chip, the nav badge drops. Re-seed (or a second request) and Reject: the device stays overdue, the badge drops.
- As a plain User no extension list appears and the network tab shows no `box=extensions` request.
- Your dev user is not a seed member; to see the seeded request you need Manager+ in the seed org (existing dev setup) or create your own request as in the SIM-037.11 note.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/devices-api.ts` (l.179-180) | Add `pendingExtensions: () => listHandoffs("extensions")` next to `pendingReturns`. | AC1a | No |
| `src/ui/devices/useIncomingHandoffs.ts` (l.14) | Replace `box === "returns" ? api.pendingReturns : api.incomingHandoffs` with a three-way choice via exported pure `fetcherFor(api, box)` (put it in `incoming-transfer.ts` or this file; without it `extensions` silently fetches incoming, FE consult). Update doc comment (a non-Manager never asks for `box=extensions`). | AC1a, 1c | No |
| `src/ui/devices/incoming-transfer.ts` (l.75-92) | `badgeCountAfter(count, incoming, returns, extensions)`: fallback `extensions: extensions.length`, `null` if any list is `null`. `badgeTotal` += `c.extensions` (fix doc comment). `handoffBoxes(isAdmin, isManager)`: `incoming` always; `returns` if admin; `extensions` if manager (callers pass `isManager = atLeastTier(tier, "manager")`, which is true for admin). `FocusTarget` `section.list` already uses `HandoffBox`. | AC1c, AC2 | No |
| `src/ui/devices/extension-device.ts` (new) | Pure: `approveExtensionOutcome(result, item)` and `rejectExtensionOutcome(result, item)` returning `IncomingOutcome` (`handoffActionFailed` from `incoming-transfer.ts` l.20; its "stale" status notice is replaced by `devicesCopy.extend.gone`, as `confirmReturnOutcome` does in `return-device.ts` l.62-68). Success: `extensions.approved(name, inv, newDate)` / `extensions.rejected(name, inv)`. | AC1b | No |
| `src/ui/devices/PendingExtensions.tsx` (new) | Clone of `PendingReturns.tsx`: `section aria-labelledby="extensions-heading"`, h2 with `headingRef`, hint, error + retry, `Card` per item: device name + `typeLine`, `extensions.owner(from.displayName)`, `extensions.change(currentExpiry, requested)` (current from `item.device.expiresOn`, null → `extensions.noExpiry`), note (line-clamp as in PendingReturns), Approve (`canConfirm`, `data-handoff-confirm={item.id}`, aria) and Reject (`canDecline`, tonal, aria), `truncated` line. Props like `PendingReturns` with `onApprove`, `onReject`. Renders nothing when empty and no error. | AC1a, 1b | No |
| `src/ui/devices/DevicesPage.tsx` (l.55, l.66-67, l.74, l.85, l.92-103, l.118-130, after l.266, `useMemo` deps l.184) | `isManager = atLeastTier(session.tier, "manager")` (l.55); `useHandoffList(api, "extensions", handoffBoxes(isAdmin, isManager).includes("extensions"))`; update the `returns` call to `handoffBoxes(isAdmin, isManager)`; `extensionsHeadingRef`; focus effect: `list === "returns" ? returnsHeadingRef : list === "extensions" ? extensionsHeadingRef : incomingHeadingRef`; `refreshAll` awaits `extensions.refresh()`, passes it to `badgeCountAfter`, returns `{inc, ret, ext}`; `act` picks `before`/`after` by `list` with a three-way helper (do not leave the `returns ? … : incoming` ternary, which would misroute `extensions`); render `<PendingExtensions>` after `<PendingReturns>` with `act("extensions", item, () => api.confirmHandoff(item.id), (r) => approveExtensionOutcome(r, item))` and `declineHandoff` / `rejectExtensionOutcome`; `onRetry` like returns. Add `extensions.refresh` to the `actions` `useMemo` deps. | AC1, AC2 | No |
| `src/ui/copy/devices.ts` (after `returns` l.107-119) | Add `extensions: { heading(n) ("1 extension request" / "N extension requests"), hint ("Approving sets the device's new expiry date."), approve, reject, approveAria(name, inv, owner), rejectAria(name, inv, owner), owner(name), change(current, requested), noExpiry, approved(name, inv, date), rejected(name, inv), truncated(n) }`. Reuse `extend.gone` (exists, l.66) for the stale case. | D36 | No |
| `src/ui/copy/shell.ts` (l.9-22) | `extensionRequests(n)` ("1 extension request" / "N extension requests"), exported on `shellCopy.badge`; add a breakdown part in `devicesBreakdown` between returns and overdue; update the doc comment. | AC2 | No |
| `db/seeder.js` (after l.151) | Insert one pending extension for "Tablet E": `insert into device_handoffs (id, org_id, device_id, kind, from_member_id, requested_by_id, note, new_expires_on) values (uid c-kind, org, u("8",5), 'extension', members[0].id, members[0].id, 'Need it for the project until the end of the month', (now() at time zone 'Asia/Ho_Chi_Minh')::date + 30) on conflict do nothing`. Columns and shape check: `db/migrations/20261125120000_device_lifecycle.sql` l.37-68 (`to_member_id` null, `new_expires_on` not null; one pending per device, l.69). Id `u("c", 1)` (kind is a hex digit in `uid`, l.50-52). | Ticket scope: "a seeded pending extension" | No (`db/migrations/**` only is High) |
| Tests | See below. | R5 | No |

## Data model / migration
None.

## API contract
None (consumes SIM-037.5 unchanged).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/devices/devices-api.test.ts` › "pendingExtensions GETs /api/handoffs?box=extensions" | API client path |
| `src/ui/devices/incoming-transfer.test.ts` › update l.131-156: `badgeTotal` incl. extensions; `badgeCountAfter` 4-arg (count ok wins; fallback uses lengths incl. extensions; any `null` list → null); `handoffBoxes` user / manager / admin; new `fetcherFor` (three boxes map to three fns) | AC1c, AC2 |
| `src/ui/devices/extension-device.test.ts` (new) | approve ok (notice has name, inv and new date, refresh true); reject ok; `handoff_not_pending` and `not_found` → extension "gone" wording with refresh; `not_allowed` → error notice; unknown code → error notice |
| `src/ui/devices/PendingExtensions.test.tsx` (new, markup, template `PendingReturns.test.tsx` if present) | rows, owner, "Current expiry → requested", null current expiry → "no expiry" wording, note shown, Approve/Reject gating by `canConfirm`/`canDecline`, disabled when busy, nothing when empty, error + Retry, truncated line, Vietnamese owner and device names intact |
| `src/ui/AppShellView.test.tsx` › extend the `devicesBreakdown` test: single extension part; all four parts `{2,1,3,1}` → "7 pending items: …"; zero parts left out | AC2 |
| `db/seeder.test.ts` | Only if it asserts counts that a new row helper changes (it checks `seedRows`); otherwise no change. |

## Approach
1. Copy first (`devices.ts` `extensions`, `shell.ts` part); typecheck stays green.
2. `devices-api.ts` + test; `incoming-transfer.ts` (`handoffBoxes`, `badgeTotal`, `badgeCountAfter`, `fetcherFor`) + tests; `useIncomingHandoffs.ts` uses `fetcherFor`.
3. `extension-device.ts` + tests.
4. `PendingExtensions.tsx` + markup test.
5. `DevicesPage.tsx` wiring (all `list` ternaries made three-way; verify every `badgeCountAfter` and `handoffBoxes` call site, `Grep` shows only `DevicesPage.tsx` l.35, l.67, l.100 outside tests).
6. Seed; run all Checks.

Rules: R1 all code in `src/ui/**` importing only `@/lib/*` (`pnpm check:layers`). R7 no route handler change; the server checks Manager+ before writing and a non-Manager never sends the list request. R4 only the files above. R5 each new pure function has tests. Dates are shown as received (`YYYY-MM-DD` strings), no `Date` parsing.

## Specialist input used
From SIM-037.11 consults and its `## Split proposal` (slice 2 list), adopted as written: `pendingExtensions`, three-way fetcher map (FE "useHandoffList silent bug"), tier-aware `handoffBoxes`, `badgeTotal`/`badgeCountAfter` with extensions, `PendingExtensions` cloned from `PendingReturns` (Approve `canConfirm` + `data-handoff-confirm`, Reject `canDecline`), approve/reject outcomes with extension wording, third heading ref in the focus effect and `act`, `extensions.refresh()` in `refreshAll`, `extensionRequests(n)` breakdown part, seeded pending extension. Reject has no reason field (A4 of slice 1).

## Assumptions
Adopted from consultant recommendations; Ming to confirm:
- A1: Reject has no reason field and no confirmation step (decline API takes none; the owner can request again).
- A2: The Manager list shows only requests; direct expiry edits stay in the existing "Note / expiry" dialog (DEV-07, OQ-42).
- A3: Manager+ can also Cancel an extension via the existing row action (API allows it); the list has Approve and Reject only, as ticketed.
- A4: `handoffBoxes` takes `isManager`; an Admin is also a Manager (`atLeastTier`), so Admin sees extensions after returns.
- A5: The badge for a Manager counts every pending extension in the org (what the API returns), matching the list they can act on.
- A6: `badgeCountAfter` fallback is transient on a failed count; the next count corrects it.
- A7: The new section sits after PendingReturns inside the existing `incoming` slot, so `DevicesView.tsx` does not change.

Hotspots: `DevicesPage.tsx`, `incoming-transfer.ts`, `copy/devices.ts`, `copy/shell.ts` were edited by SIM-037.11 (MERGED). Other open ticket SIM-039.8 (PLANNING, map items) is not expected to touch `src/ui/devices/**`; no rebase expected. Check `work/backlog.md` before implementing in case a later ticket edits these files.

## Blocking questions
None.

## Split proposal
None. Estimated ~250 non-test lines plus tests, within one cycle.
