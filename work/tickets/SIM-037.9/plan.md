Status: READY

# Plan — SIM-037.9: Devices UI: incoming transfers and nav badge

## Scope summary
- `docs/spec-v1.md` §6 DEV-08 (lines 321-325):
  > "Until the recipient confirms, nothing changes: the device stays with the sender and keeps its seat. The sender (or a Manager+) can cancel; the recipient can decline."
  > "When the recipient confirms receipt, in one transaction the device leaves its seat (if placed) and lands in the recipient's inventory, not placed; the recipient places it themselves."
  > "The recipient sees pending transfers to them (badge in the nav, list on the Devices page)."
- `work/decisions.md` D24: "decisions show in-app ... with a badge, no email". Like the requests badge, this badge does not poll.
- D63 (device lifecycle). A confirmed device has `owner = recipient` and `seat = null`. The server sets this (`src/server/devices/handoffs.ts:346`). The UI only reports it.
- The ticket scope (ticket.md lines 24-28), as written. This is the recipient-side slice split from SIM-037.8, approved by Ming on 2026-11-25.
- The API is already on main from SIM-037.3. This ticket changes no server code:
  - `GET /api/handoffs?box=incoming` (`src/app/api/handoffs/route.ts`) returns at most 100 items plus `truncated` (`INBOX_LIMIT`, handoffs.ts:29).
  - `GET /api/handoffs/count` returns `{incoming}`. It returns 0 for a caller who has no member row, not 403 (handoffs.ts:421).
  - `POST /api/handoffs/:id/confirm` can refuse with `not_found` 404, `not_allowed` 422, `handoff_not_pending` 409, `handoff_stale` 409, `member_not_assignable` 422 or `placement_changed` 409. `placement_changed` is returned only after one server retry (handoffs.ts:339-342, 387).
  - `POST /api/handoffs/:id/decline` can refuse with `not_found`, `not_allowed` or `handoff_not_pending` (handoffs.ts:200-253, `src/lib/devices/handoff-rules.ts:63-64`).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A recipient sees each pending incoming transfer with the sender, the device and the note. | `IncomingTransfers.test.tsx` › "renders each item with name, type, inventory number, From <sender> and the note" and "no note: no note line". `DevicesView.test.tsx` › "incoming slot renders between the notice and the filter chips". Manual local run: user A transfers to user B, and B's Devices page shows the section. |
| 2 | Confirm receipt moves the device into the recipient's inventory (not placed) and shows a notice. Decline removes the item and shows a notice. | `incoming-transfer.test.ts` › "confirmOutcome ok: status notice 'now in your inventory, not placed', refresh", "filter hint only for placed and unowned", "declineOutcome ok: status notice, refresh". Manual: B confirms, the device appears in B's list under All / Not placed with no seat, and the notice shows. A second transfer is declined, the item disappears, the notice shows, and the device stays with A. |
| 3 | A stale Confirm or Decline shows a message and refreshes instead of failing silently. | `incoming-transfer.test.ts` › "handoff_not_pending / handoff_stale / not_found: status 'no longer available', refresh", "auth, unavailable, internal: error notice, no refresh", "other domain refusals: error notice, refresh". Manual: A cancels while B's page is still open, B clicks Confirm, B sees the "no longer available" notice and the item disappears. |
| 4 | The Devices nav item shows the incoming count with screen-reader text "N incoming transfer(s)". The requests badge text is unchanged. | `AppShellView.test.tsx` › "devices badge: numeral aria-hidden, sr-only '3 incoming transfers' / '1 incoming transfer'", "devices 12: 9+ visible, '12 incoming transfers' for screen readers", "devices 0 or missing: no badge markup", plus the existing myRequests cases unchanged and still green. `incoming-transfer.test.ts` › "badgeCountAfter: count result wins, falls back to the list length". |
| 5 | All new strings live in `src/ui/copy/*` (D36). | Code review: the new `.tsx` / `.ts` files contain no English literals outside `src/ui/copy/devices.ts` and `src/ui/copy/shell.ts`. Tests assert through `devicesCopy.incoming.*` and `shellCopy.badge.*`. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` all green. |

## Ming verification after merge
None. Everything can be checked in a local run with two dev accounts. The manual run in the table above (start then confirm, start then decline, stale confirm) is the ticket's Test plan "Manual" item. The implementer records it in impl-log.md, or marks it "not run" if a second account is unavailable locally.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/devices-api.ts` | Add `incomingHandoffs()` (GET `/api/handoffs?box=incoming`, checks the shape of `{items[], truncated:boolean}`), `handoffCount()` (GET `/api/handoffs/count`, checks that `incoming` is a number), and `confirmHandoff(id)` / `declineHandoff(id)` (POST `/api/handoffs/<encoded id>/{confirm,decline}`, `oneHandoff`). Model them on `cancelHandoff` (lines 125-130) and `list` (136-146). | API client (scope bullet 1) | No |
| `src/ui/devices/transfer-device.ts` | Export the existing `NOTHING_CHANGED` (line 50) so the incoming outcomes reuse it instead of copying it. No behaviour change. | One shared list of "nothing changed" codes (FE consult rec 4) | No |
| `src/ui/devices/incoming-transfer.ts` (new) | Pure code: `confirmOutcome`, `declineOutcome`, `focusAfter`, `badgeCountAfter`, `incomingReducer` with `INITIAL_INCOMING`. | Outcomes, focus rule, badge source and list state as testable logic (rule 6) | No |
| `src/ui/devices/useIncomingHandoffs.ts` (new) | A thin hook over `incomingReducer`: loads on mount with a request counter that drops stale answers, a mounted ref, and `refresh()` that resolves to the new `HandoffDto[]` or `null`. Mirrors `useDevices.ts`. | Incoming list state | No |
| `src/ui/devices/IncomingTransfers.tsx` (new) | Pure props-only section (markup described in Approach step 4). | Incoming section (scope bullet 2) | No |
| `src/ui/devices/DevicesView.tsx` | Add an optional prop `incoming?: React.ReactNode`, rendered between the notice `div` (lines 59-70) and the filter row (line 72). | Section placement at the ticket's slot, keeping the view pure and existing fixtures valid | No |
| `src/ui/devices/DevicesPage.tsx` | Wire `useIncomingHandoffs`, `useSetHandoffBadge`, the confirm/decline handlers, focus, and the shared action guard. Rename `cancelling` to `acting` and use it for cancel as well. | Page orchestration (scope bullets 3-4) | No |
| `src/ui/devices/useHandoffBadge.tsx` (new) | `HandoffBadgeProvider`, `useHandoffBadge(pathname)`, `useSetHandoffBadge()`. A near-copy of `src/ui/requests/useRequestBadge.tsx` that reads `createDevicesApi(apiFetch).handoffCount()` → `.incoming`. | Nav badge (scope bullet 5) | No |
| `src/ui/AppShell.tsx` | Nest `<HandoffBadgeProvider>` inside `<RequestBadgeProvider>` and call `useHandoffBadge(pathname)` in `ShellWithBadge`. Pass `badges={{ myRequests: count, devices: incoming }}`. | Nav badge | No |
| `src/ui/AppShellView.tsx` | Line 100: replace `shellCopy.badge.newDecisions(count)` with `(shellCopy.badge.byNav[item.id] ?? shellCopy.badge.newDecisions)(count)`. | Per-nav screen-reader text | No |
| `src/ui/copy/shell.ts` | `badge.incomingTransfers(n)` ("1 incoming transfer" / "N incoming transfers") and `badge.byNav: { myRequests: newDecisions, devices: incomingTransfers }`. `newDecisions` is unchanged. | D36 | No |
| `src/ui/copy/devices.ts` | New `incoming` block: `heading(n)`, `hint`, `from(name)`, `confirm`, `decline`, `confirmAria(name, inv, from)`, `declineAria(name, inv, from)`, `confirmed(name, inv)`, `filterHint`, `declined(name, inv)`, `truncated(n)`. The stale text reuses `transfer.gone` (line 55). | D36 | No |
| `src/ui/devices/devices-api.test.ts` | New cases in `describe("devices-api transfer")`. | Tests | No |
| `src/ui/devices/incoming-transfer.test.ts` (new) | Outcome, focus, badge and reducer tests. | Tests | No |
| `src/ui/devices/IncomingTransfers.test.tsx` (new) | Static-markup tests. | Tests | No |
| `src/ui/devices/DevicesView.test.tsx` | One placement case. | Tests | No |
| `src/ui/AppShellView.test.tsx` | Devices badge cases in `describe("nav badge")` (lines 142-180). | Tests | No |

No High paths are touched. Everything is under `src/ui/**`, and no server, auth, config or migration file is in the list. The ticket's plan-approval gate applies because it is P1 (policy `high-paths+P1`).

## Data model / migration
None.

## API contract
None (no endpoint change). The client consumes:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/handoffs?box=incoming` | — | `HandoffListResponse` | 200, 400 `invalid_request`, 503 | user+ (own inbox only) |
| GET | `/api/handoffs/count` | — | `HandoffCountDto` `{incoming}` | 200, 503 | user+ |
| POST | `/api/handoffs/:id/confirm` | no body | `HandoffDto` | 200, 404 `not_found`, 409 `handoff_not_pending` / `handoff_stale` / `placement_changed`, 422 `not_allowed` / `member_not_assignable` | recipient |
| POST | `/api/handoffs/:id/decline` | no body | `HandoffDto` | 200, 404, 409 `handoff_not_pending`, 422 `not_allowed` | recipient or Manager+ |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `devices-api.test.ts` › "incomingHandoffs sends GET /api/handoffs?box=incoming; { items, truncated } on 200; a malformed body is internal" | Client path and shape check |
| `devices-api.test.ts` › "handoffCount sends GET /api/handoffs/count; returns { incoming }; a non-number is internal" | Badge count source |
| `devices-api.test.ts` › "confirmHandoff / declineHandoff send POST /api/handoffs/<encoded id>/confirm and /decline with no body; codes pass through" | Paths, method, encoding (`"h 1"` → `h%201`) |
| `incoming-transfer.test.ts` › "confirmOutcome ok: status notice names device and inventory number, says not placed, refresh" | AC2 |
| `incoming-transfer.test.ts` › "confirmOutcome filter hint only when the filter is placed or unowned (not all, not inventory)" | AC2. The filter edge: `FILTER_SQL` in `src/server/devices/devices.ts:149-154` means a device that is owned and has no seat shows only under `all` and `inventory`. |
| `incoming-transfer.test.ts` › "declineOutcome ok: status notice, refresh" | AC2 |
| `incoming-transfer.test.ts` › "handoff_not_pending, handoff_stale, not_found: status transfer.gone, refresh (confirm and decline)" | AC3 |
| `incoming-transfer.test.ts` › "auth codes, unavailable, internal, invalid_request: error notice, no refresh" | AC3, and that nothing changed on the server |
| `incoming-transfer.test.ts` › "not_allowed, member_not_assignable, placement_changed: error notice with apiErrorMessage, refresh" | Other domain refusals refresh |
| `incoming-transfer.test.ts` › "focusAfter: next item's confirm when it is still in the new list; else section when items remain; else page; removed id was last → section/page" | Focus rule (scope bullet 4) |
| `incoming-transfer.test.ts` › "focusAfter: next item without canConfirm → section" | Edge case |
| `incoming-transfer.test.ts` › "badgeCountAfter: ok count wins; failed count → refreshed list length; both failed → null (keep)" | Badge count source |
| `incoming-transfer.test.ts` › "incomingReducer: load→ready, failed first load→error, failed refresh keeps items and sets errorCode, stale id ignored" | List state |
| `IncomingTransfers.test.tsx` › "renders each item with name, type, inventory number, From <sender> and the note" | AC1 |
| `IncomingTransfers.test.tsx` › "a Vietnamese sender and device name render intact; a note keeps line breaks (whitespace-pre-line)" | Domain focus: diacritics |
| `IncomingTransfers.test.tsx` › "no note: no note line; canConfirm false: no Confirm button" | Empty/null fields, server flags |
| `IncomingTransfers.test.tsx` › "aria-labels include name, inventory number and sender; heading has tabIndex -1 and labels the section" | a11y |
| `IncomingTransfers.test.tsx` › "busyId set: every Confirm and Decline is disabled" | Busy rule (see Specialist input) |
| `IncomingTransfers.test.tsx` › "empty and no error: renders nothing; loading: renders nothing" | Visibility |
| `IncomingTransfers.test.tsx` › "error: role=alert message and Retry, with or without items" | Error state |
| `IncomingTransfers.test.tsx` › "truncated: shows the 'first N' line" | Pagination bound |
| `DevicesView.test.tsx` › "incoming slot renders between the notice and the filter chips" | Placement |
| `AppShellView.test.tsx` › "devices badge: numeral aria-hidden, sr-only '3 incoming transfers' / '1 incoming transfer'" | AC4 |
| `AppShellView.test.tsx` › "devices 12: 9+ visible, '12 incoming transfers' for screen readers" | AC4, true count |
| `AppShellView.test.tsx` › "devices 0 or missing: no badge markup, no 'incoming transfer' text" | AC4 |
| `AppShellView.test.tsx` › "myRequests and devices together: each link has its own text" | AC4 "requests badge text unchanged" |

The existing myRequests cases (lines 157-179) must stay green without edits.

## Approach
1. **API client.** Add the four methods to `devices-api.ts` next to `cancelHandoff`. They go through the private `call` (never throws, R7 handled by `apiFetch`).
2. **Pure logic (`incoming-transfer.ts`).**
   - `type IncomingOutcome = { refresh: boolean; notice: { tone: "status" | "error"; text: string } }`.
   - `confirmOutcome(result, item: HandoffDto, filter: PlacementFilter)`:
     - On ok, the notice is `incoming.confirmed(name, inv)`, with `" " + incoming.filterHint` appended when `filter === "placed" || filter === "unowned"`. The name and inventory number come from `item.device`.
     - On a stale code (`["handoff_not_pending", "handoff_stale", "not_found"]`), return a status notice with `devicesCopy.transfer.gone` and refresh.
     - Otherwise, return an error notice with `apiErrorMessage(code)` and set `refresh = !NOTHING_CHANGED.includes(code)`. `NOTHING_CHANGED` is imported from `transfer-device.ts`.
   - `declineOutcome(result, item)` is the same without the hint.
   - `focusAfter(before: HandoffDto[], removedId, after: HandoffDto[])` returns `{ kind: "confirm"; id } | { kind: "section" } | { kind: "page" }`. It returns the next item's Confirm when that item is still in `after` with `canConfirm`, else the section when `after.length > 0`, else the page.
   - `badgeCountAfter(count: DevicesResult<{incoming:number}>, items: HandoffDto[] | null): number | null`.
   - `incomingReducer` / `INITIAL_INCOMING` follow the `devicesReducer` pattern (`devices-state.ts:59-77`). The state is `{status, items, truncated, errorCode, id}`. A failed refresh keeps the items and sets `errorCode`.
3. **Hook (`useIncomingHandoffs.ts`).** It works like `useDevices` with no filter. `refresh()` returns the loaded items, or `null` when the request failed or a newer request replaced it.
4. **Section (`IncomingTransfers.tsx`).**
   - Props: `{ status, items, truncated, errorCode, busyId, onConfirm(item), onDecline(item), onRetry, headingRef }`.
   - Render `null` unless `items.length > 0 || errorCode !== null`.
   - Markup:
     - `<section aria-labelledby="incoming-heading">`.
     - h2 `incoming.heading(n)` with `tabIndex={-1}`, then the hint line.
     - `<ul role="list">` of `Card` `li`s. Each card shows the name in bold, the type and `(inv)`, `incoming.from(from.displayName)`, and the note in `whitespace-pre-line line-clamp-3` when it is not null.
     - Confirm is a primary `Button` with `data-handoff-confirm={id}` and is rendered only when `canConfirm`. Decline is `variant="tonal"` and is rendered only when `canDecline`. Every button is `disabled` while `busyId !== null`.
     - On error, an inline `role="alert"` with `apiErrorMessage(errorCode)` and a Retry button.
     - When `truncated`, show `incoming.truncated(items.length)`.
   - The buttons are stacked on mobile and in a row at md+. Neither has a confirm dialog.
5. **View.** Add the optional `incoming` ReactNode slot to `DevicesView`. Existing fixtures need no change.
6. **Page (`DevicesPage.tsx`).**
   - Rename the `cancelling` ref to `acting`. Confirm, decline and cancel all return early if `acting.current` is set, so two outcomes never interleave their notice, refresh or focus.
   - Keep `cancellingId` for the row, and add `incomingBusyId` for the section.
   - `onConfirm(item)` / `onDecline(item)` run this sequence:
     1. Set the guard and `setNotice(null)`.
     2. Snapshot `before = incoming.items`.
     3. Call the API, then compute the outcome and `setNotice`.
     4. If `outcome.refresh`, `const [after] = await Promise.all([incoming.refresh(), refresh()])`. Then `const n = badgeCountAfter(await api.handoffCount(), after)`, and `setBadge(n)` when `n` is not null. Then `setFocusTarget(focusAfter(before, item.id, after ?? before.filter(h => h.id !== item.id)))`.
     5. Clear the guard.
   - When nothing was refreshed (network or auth error), focus stays put: the item and its now re-enabled buttons remain.
   - A `useEffect` on `focusTarget` runs after the commit and applies it:
     - `confirm`: `document.querySelector('[data-handoff-confirm="<id>"]')?.focus()`. Use `CSS.escape` on the id.
     - `section`: `incomingHeadingRef`.
     - `page`: `headingRef`.
     - Then it clears `focusTarget`. This avoids the focus race both consults name: the old DOM node is replaced after the await.
   - The cancel flow does not refresh `incoming` or the badge, because a sender-side cancel does not change the caller's inbox. Apart from the shared guard, the cancel flow is unchanged.
   - Retry calls `incoming.refresh()`. If the section is then gone, focus the page heading.
7. **Badge.**
   - Copy `useRequestBadge.tsx` into `src/ui/devices/useHandoffBadge.tsx`: same seq guard bumped by `set`, mounted ref, and the triggers mount, pathname, focus and visibilitychange. No polling (D24). A failed fetch keeps the count. Change only the fetch and the names.
   - Wire it in `AppShell.tsx`.
   - Add `byNav` to `shellCopy.badge` and use it in `AppShellView.tsx`. Unknown ids fall back to `newDecisions`, so the current behaviour for other ids is unchanged.
8. Run the four Checks. Record the manual two-account run in impl-log.md.

Rules:
- R1: everything stays in the ui/lib layers, `check:layers` passes, and `copy/shell.ts` may import `NavId` from `@/lib/nav`.
- R4: no server change, and no generic badge factory.
- R5: new logic is in pure modules with tests.
- R7: auth codes are only mapped in the UI, never retried by it.
- D36: all copy is in `src/ui/copy/*`.

## Specialist input used
- **Conflict: busy scope.** The UX consult rec 3 disables only the busy item's two buttons. The FE consult rec 3 disables every item's buttons. **Adopted: FE (disable all incoming buttons while any confirm or decline is in flight).** Reasons:
  - The UX consult itself asks for one in-flight guard shared across confirm, decline and cancel. With that guard, another item's still-enabled button would silently do nothing on click, which is worse than an honest disabled state.
  - The page has one notice region and one focus target, so two concurrent outcomes would overwrite each other's notice and focus.
  - The disabled window is one request plus a refresh (sub-second), so the cost to the user is small.
  - The device-row Cancel button keeps its own per-row `busyId` (no DeviceTable change, R4). The guard still protects it.
- Adopted, FE:
  - rec 1: duplicate the badge, no factory.
  - rec 2: per-nav sr-only text with the true count.
  - rec 3: section markup and the error state with Retry.
  - rec 4: pure outcomes, a shared `NOTHING_CHANGED`, and the count fetch with the list-length fallback.
  - rec 5: compute the focus target before the mutation and apply it after the refresh.
  - rec 6: the copy blocks.
  - The tests list.
- Adopted, UX:
  - rec 1: placement in the `DevicesView` column after the notice. I implemented it as a ReactNode slot rather than a prop group, which keeps `DevicesViewProps` small.
  - rec 2: the h2 with the count, the hint line, Cards, the note clamp, buttons with no confirm dialog, and the "Showing the first N" line.
  - rec 4: status tone for success and stale outcomes, error tone for network errors, and refreshing both lists together.
  - rec 5: the pure, testable "which item next" helper.
  - rec 8: `role="list"`, and the heading order h1 → h2.
  - Risks: clear the notice at the start of each action, and use one live region.
- Adjusted:
  - The UX filter hint names "placed or assigned", but `assigned` is not a filter. The real filters are `all | placed | inventory | unowned` (`src/lib/devices/types.ts:39`), and `FILTER_SQL` hides a recipient-owned device that is not placed under `placed` and `unowned`. The hint therefore shows for those two.
  - UX rec 2 says "render only if `canConfirm`, else disable". I chose **render only if the flag is true**, which is simpler. For `box=incoming` both flags are true while the item is pending.
- Rejected:
  - UX rec 5's "else previous item's Confirm". The ticket's focus rule is "next item's Confirm, else the section heading, else the page heading" (ticket.md line 27), and the ticket wins.
- Open questions resolved with the consults' defaults:
  - FE Q1-Q4: show only what `box=incoming` returns, the count comes from `/count`, fall back to the list length, and duplicate the badge code.
  - UX Q1-Q5: no decline reason, no "Place it" shortcut, the notice persists until the next action, no skeleton, and no outgoing items in the section.

## Assumptions
- The badge is stale until navigation, window focus or tab visibility changes (D24, no polling). This is accepted and stated in the ticket.
- While a confirm or decline is in flight, the device-row Cancel button stays visually enabled but is ignored by the shared guard. The window is sub-second. Making the row reflect it would touch `DeviceTable` (out of plan).
- `HandoffDto.device.type` is the display name of the type, as the device list shows it. If it is a key, the implementer uses the same formatter as `DeviceTable` and records it.
- The confirm notice uses the item's `device` fields, not the response, so the text is the same on every path.
- Size: about 400-450 changed lines of product code plus about 300 of tests. This is within one implement/review cycle because most of it is a mechanical copy of existing patterns. No further split.
- Hotspots: no other ticket is in `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md` lines 85-88). SIM-037.4 and SIM-037.5 (BACKLOG) will later edit `DevicesPage.tsx`, `devices-api.ts`, `copy/devices.ts` and probably the badge for Admin returns (DEV-09, "badge in the nav"). They should extend `useHandoffBadge` and `byNav` rather than add a third copy. If a third badge appears, open a `debt` issue for a shared factory (FE Q4).

## Blocking questions
None.

## Split proposal
None. This ticket is already the recipient slice split from SIM-037.8.
