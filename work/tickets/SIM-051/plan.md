Status: READY

# Plan — SIM-051: Answer 404 for write actions on a device a User does not hold

## Scope summary
- `docs/spec-v1.md` DEV-12: "device detail and history ... answer 404 for any device they do not hold" (reads, done in
  SIM-044). The ticket extends this to writes: "for a User, a device whose current owner is not their member answers 404
  `not_found` instead of 422 `not_allowed`, before any side effect" (ticket Scope; SYS-01 cross-org 404 is the model, D69).
- Ticket: "PATCH inventory-number conflict (409) must not be reachable for a device the User does not hold"; "the
  recipient's confirm/decline path keeps working (handoff routes, not device detail)". Manager/Admin unchanged.
- R7: 404 is a domain code; it must come before any write (here: before any update, insert or audit).

Findings (current code, verified):
- Writes that already refuse a User before any query, whatever the id (so no existence leak, unchanged):
  `createDevice` (devices.ts l.398), `assignDevice` (l.502), `updateHolding` (l.565), `deleteDevice` (l.615),
  `takeBack` (handoffs.ts l.722). No change.
- Writes that read the device, then answer `not_allowed` to a non-owner User (leak; to change):
  `updateDevice` (devices.ts l.460-461), `placeDevice` (l.350-361 via `decidePlacement`, `canPlace` in
  `src/lib/devices/rules.ts` l.80), `startTransfer` (handoffs.ts l.166, `handoff-rules.ts` l.42-45),
  `startReturn` (l.226, rules l.66-69), `startExtension` (l.282, rules l.82-89).
- Handoff action routes (cancel/confirm/decline, `src/app/api/handoffs/[id]/*`) take a handoff id. A User who is neither the
  sender nor the recipient currently gets 422 `not_allowed` (`decideHandoffAction`, handoff-rules.ts l.115-123), which
  reveals the handoff and thus the device. Confirm reads the handoff at handoffs.ts l.619-637; cancel/decline use the same
  early read pattern (l.330-360 region).
- Inventory-number conflict (409): `updateDevice` does the owner check (l.460) before the update, so for a non-held
  device a User now gets 404 before any unique-violation can occur. No separate 409 path to change; a test pins it.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | For a User, every device write on a device they do not hold answers 404, same body as an unknown id; nothing written or audited | Unit tests (scripted Db) and DB tests per action: PATCH device, PUT placement, POST handoffs (transfer, return, extension), handoff cancel; result `toEqual(notFound)` and equals the unknown-id result; no update/insert/audit calls; DB row and audit count unchanged |
| 2 | A User acting on their own device behaves as today | Existing owner-path tests stay green unchanged; added "own device" case per action |
| 3 | The recipient of a pending transfer can still confirm/decline it | DB tests: recipient (user tier, not owner) confirm and decline succeed; handoffs route tests unchanged |
| 4 | Manager and Admin get today's codes | Existing tier tests stay green (e.g. devices.db.test.ts l.243-254 Manager move; handoffs `not_allowed` cases for Manager); added assertion that Manager/Admin on another's device never get 404 from the new check |
| 5 | Route and DB tests per action and tier | `pnpm test`, `pnpm test:db`; test list below |

## Ming verification after merge
None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/visibility.ts` | Add pure `holdsDevice`-style rule: `hiddenFromActor(tier, ownerId, actorMemberId): boolean` (true when `deviceVisibility(tier) === "held"` and not `ownerId !== null && ownerId === actorMemberId`); add `hiddenHandoffFromActor(tier, actorMemberId, fromId, toId)` (User who is neither sender nor recipient) | One rule next to the read rule (DEV-12), unit-testable | No |
| `src/lib/devices/visibility.test.ts` | Unit tests for both new functions | Rule 6, pure logic first | No |
| `src/server/devices/devices.ts` | `updateDevice`: after the locked read, `if (hiddenFromActor(...)) throw new Abort(notFound)` before `canEdit`. `placeDevice`: same check right after the owner is read under the device lock (l.334), before `decidePlacement` | Criteria 1, 2, 4 | No |
| `src/server/devices/handoffs.ts` | `startTransfer`, `startReturn`, `startExtension`: after `!dev[0]` check, `hiddenFromActor` then `throw new Abort(notFound)` before the decision. Handoff cancel, decline and confirm: in the first (unlocked) handoff read, return `notFound` when `hiddenHandoffFromActor` (before `decideHandoffAction`); the recipient and sender pass | Criteria 1, 3 | No |
| `src/server/devices/devices.test.ts` | Update the scripted-Db tests that expect 422 for a non-owner User (l.414-428 and similar) to 404 and "no write" | Behaviour change | No |
| `src/server/devices/devices.db.test.ts` | Update l.243-254, l.430, l.460, l.490, l.664, l.804 style cases for a non-holding User to 404; add unknown-id equality and inventory-number-conflict-on-foreign-device case | Behaviour change, criterion 1 | No |
| `src/server/devices/handoffs.db.test.ts` | Update non-holder User cases (l.105, l.195-201, l.279, l.436-482, l.602, l.660-663, l.707-710, l.773) that are User-tier non-owner/non-party to 404; keep Manager/Admin 422; add recipient confirm/decline passes | Behaviour change, criteria 3, 4 | No |
| `src/app/api/devices/devices-routes.test.ts`, `src/app/api/handoffs/handoffs-routes.test.ts` | Only if they assert a 422 for a non-holder User: adjust; otherwise untouched (routes map `Result` codes unchanged) | Criterion 5 | No |

Route files and `src/lib/api/error.ts` need no change (`not_found` already exists, tx.ts l.28 `notFound`). If the
implementer finds a case needing another file, record why in impl-log.

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PATCH | `/api/devices/[id]` | unchanged | unchanged | User on a device not held: 404 `not_found` (was 422 `not_allowed`) | unchanged |
| PUT | `/api/devices/[id]/placement` | unchanged | unchanged | same | unchanged |
| POST | `/api/devices/[id]/handoffs` | unchanged | unchanged | same (transfer, return, extension) | unchanged |
| POST | `/api/handoffs/[id]/{cancel,confirm,decline}` | unchanged | unchanged | User neither sender nor recipient: 404 (was 422) | unchanged |

401/403 stay in the auth wrapper only; the new 404s are domain refusals returned before any write (R7).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `visibility.test.ts › hiddenFromActor` | user own / other's / unowned / no member row; manager and admin never hidden |
| `visibility.test.ts › hiddenHandoffFromActor` | user sender, recipient, third party, no member; manager/admin never hidden |
| `devices.test.ts › updateDevice user on another's device -> 404, no update/audit` | criterion 1 (scripted), equals unknown id result |
| `devices.test.ts › placeDevice user on another's / unowned device -> 404, no update` | criterion 1 |
| `devices.db.test.ts › user PATCH of a device they do not hold -> 404, even with a clashing inventory number; row and audit unchanged` | criterion 1, inventory 409 unreachable |
| `devices.db.test.ts › user own device: edit and place behave as today` | criterion 2 |
| `devices.db.test.ts › manager/admin on another's device: today's codes` | criterion 4 |
| `handoffs.db.test.ts › user starts transfer/return/extension on a device they do not hold -> 404, no handoff row, no audit` | criterion 1 |
| `handoffs.db.test.ts › user cancels/declines/confirms a handoff they are not party to -> 404` | criterion 1 |
| `handoffs.db.test.ts › recipient of a pending transfer confirms / declines` | criterion 3 |
| `handoffs.db.test.ts › manager and admin keep 422 not_allowed where they had it` | criterion 4 |

## Approach
1. Add the two pure rules to `visibility.ts` with unit tests.
2. Apply in `updateDevice` and `placeDevice` after the owner is known (under the device lock) and before
   `canEdit` / `decidePlacement`, throwing `Abort(notFound)` so nothing is written (R7).
3. Apply in `startTransfer`, `startReturn`, `startExtension` after the device row is read, before the decision.
4. Apply in handoff confirm/decline/cancel at the first handoff read: a User who is neither `from_member_id` nor
   `to_member_id` gets `notFound`. Recipient and sender are not hidden, so confirm/decline by the recipient is unchanged.
5. Remove from the decision functions nothing; their 422 stays for Manager/Admin and for parties (e.g. recipient cancel).
6. Update the affected existing tests, add the new ones, run format, typecheck, check:layers, test, test:db (CI/local DB).

## Specialist input used
None (fast lane).

## Assumptions
- Writes already refused by tier alone before any query (create, assign, holding edit, delete, take-back) stay 422: the
  answer is identical for known and unknown ids, so nothing leaks.
- A User who is a party to a handoff (the recipient trying to cancel, or the sender trying to confirm own transfer) keeps
  today's 422 `not_allowed`: they already see the handoff (DEV-12 shows pending transfers to the recipient).
- A User with no member row is treated as holding nothing (404), consistent with the read rule's `m.sub` match.
- Hotspots: `src/lib/devices/visibility.ts` and `src/server/devices/devices.ts` are also in SIM-050 (member email hiding,
  likely `members`/`visibility`-adjacent files) and SIM-052 (room map device type, likely `src/server/layout`, seats
  and `devices.ts` DTO code) scope; overlap is likely only in `visibility.ts`/`devices.ts` and `devices.db.test.ts`.
  This plan edits distinct functions (`updateDevice`, `placeDevice`) and appends to `visibility.ts`; expect a trivial rebase.
- Line numbers above are from `main` at planning time and may shift after sibling merges.

## Blocking questions
None.

## Split proposal
None. Estimated change is under ~300 lines, mostly tests.
