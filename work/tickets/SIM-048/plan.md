Status: READY

# Plan — SIM-048: A User places devices only on seats they occupy

## Scope summary
Ticket Goal: "A User can place or move their devices only onto a seat they occupy, so devices are not parked on other people's seats (Ming, 2026-11-26)."

Ticket Scope (quoted):
- "Placement rule for the User tier: the target seat's occupant must be the caller's member, for primary and secondary."
- "Same rule for move (seat to seat); moving back to the owner's inventory stays allowed."
- "Refusal as a domain error (422, e.g. `seat_not_yours`) before any write (R7)."
- "UI seat pickers for a User list only the seats they occupy; the server is the guard."
- "Spec: amend DEV-03, DEV-04, DEV-05; add the decision to `work/decisions.md`."

Ming's answers (ticket, M-85 defaults accepted): "an empty seat counts as not yours; Manager/Admin keep D19 (any seat); devices a User already lent to other seats stay where they are."

Conflicts with the spec (ticket supersedes, per Ming): `docs/spec-v1.md` DEV-03 line 303 "Secondary placement has no ownership check beyond the device having an owner."; DEV-04 line 306 "The device's owner places it as secondary on any seat. A borrowed device is never primary."; DEV-05 lines 310-311. D19 (Manager+ place any owned device) is unchanged. The next free decision number is **D72** (highest in `work/decisions.md` is D71, line 78).

Naming: error code `seat_not_yours`, status 422.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | User placing or moving onto a seat whose occupant is not their member gets 422 `seat_not_yours`; nothing written or audited | `rules.test.ts` › "user: other's seat / empty seat refuse 422 seat_not_yours"; `devices.test.ts` › "seat_not_yours writes nothing: no update, no audit insert"; `devices-routes.test.ts` › "422 seat_not_yours passes through" |
| 2 | User placing onto own seat works as today (DEV-03 primary rules unchanged) | `rules.test.ts` › "user: own seat places/moves; primary rules still apply (seat_has_primary)"; existing primary tests stay green |
| 3 | User can still move device back to inventory from any seat | `rules.test.ts` › "user: target null returns from another's seat" |
| 4 | Manager and Admin can still place any owned device on any seat (D19) | `rules.test.ts` › "manager/admin: other's and empty seat still place (secondary)"; existing line ~181 test kept |
| 5 | For a User, the seat picker offers only seats they occupy; with none, it says so | `PlaceDeviceDialog.test.tsx` › "user sees only own seats, message when none"; `place-device.test.ts` › "ownSeats" |
| 6 | Unit tests per tier (own seat, other's seat, empty seat, inventory) | the `rules.test.ts` table above (user x4, manager x2, admin x1) |
| 7 | DEV-03/04/05 in spec and a new D-entry describe the rule | read `docs/spec-v1.md` DEV-03/04/05 and `work/decisions.md` D72 |

## Ming verification after merge
None (Manual run as User vs Manager is optional; covered by tests).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/rules.ts` | `PlacementRefusalCode` += `"seat_not_yours"`; `PlacementInput` += `callerId: string \| null`; in `decidePlacement` after the noop line (81) and before the primary block (82): `if (a.tier === "user" && a.target.occupantId !== a.callerId) return refuse(422, "seat_not_yours")`. Empty seat: `occupantId` null and `callerId` null must still refuse, so write `a.target.occupantId === null \|\| a.target.occupantId !== a.callerId`. Update doc comment | the single placement rule (lib, pure) | no |
| `src/lib/devices/rules.test.ts` | new `callerId` in `input()` default (= owner id); update cases at ~153-156, 181 for tier; add per-tier tests | R5 | no |
| `src/server/devices/devices.ts` | line ~298: pass `callerId: me[0]?.id ?? null` to `decidePlacement` (member row already read at 227). No query change | server guard; refusal occurs at decision time, before the update at 311 and the audit at 318 (R7: domain 422) | no |
| `src/server/devices/devices.test.ts` | add refusal-writes-nothing test for `seat_not_yours` (pattern at ~137-159) | R5 | no |
| `src/server/devices/devices.db.test.ts` | optional: one case, user placing on another member's seat returns `{ok:false,status:422,code:"seat_not_yours"}` (pattern ~177-187; CI runs it) | real-DB check | no |
| `src/lib/api/error.ts` | add `"seat_not_yours"` to the code list (near line 34) | one error shape | no |
| `src/ui/copy/api.ts` | add `seat_not_yours: "You can only place your devices on a seat you occupy."` (near line 43) | UI message | no |
| `src/app/api/devices/devices-routes.test.ts` | route passthrough test for 422 `seat_not_yours` (pattern line 129-132) | route test required by ticket | no |
| `src/ui/devices/place-device.ts` | add `ownSeats(d, seats, tier)`: for `tier === "user"` keep seats with `occupant?.id === d.owner?.id` (for a User the caller is the owner, since `canPlace` is owner-only for them); other tiers return all. Pass `callerId: d.owner?.id ?? null` to both `decidePlacement` calls (lines 31, 78) and use a real `tier` instead of the hardcoded `"user"` for them (hard-coded "user" would now wrongly refuse a Manager's lend); thread `tier` as a parameter of `primaryRefusal`, `offeredRoles`, `planSubmit` | UI picker mirrors the rule | no |
| `src/ui/devices/PlaceDeviceDialog.tsx` | new prop `tier: Tier`; `PlaceDeviceFields` renders `ownSeats(...)`; when user and the ready list is empty show `copy.noOwnSeats`; pass `tier` to `planSubmit`/`offeredRoles`; `placeVerb` "lend" branch is unreachable for a User, leave | picker | no |
| `src/ui/devices/DevicesPage.tsx` (~377) and `src/ui/devices/useDeviceDetailActions.tsx` (~133, hook gets `tier` param from `DeviceDetailPage.tsx` ~28) | pass `tier` from the session (DevicesPage already has `session.tier`, line 57) | wiring | no |
| `src/ui/copy/devices.ts` | in `place` (line ~238): `noOwnSeats: "You don't occupy a seat in this room."` | UI copy (D36) | no |
| `src/ui/devices/PlaceDeviceDialog.test.tsx`, `src/ui/devices/place-device.test.ts` | update calls for the new `tier` argument; add user-filter and empty-message tests | R5 | no |
| `docs/spec-v1.md` | DEV-03 line 303 → "A Manager+ placing an owned device as secondary has no ownership check beyond the device having an owner (D19). A User may place only on a seat they occupy (D72)."; DEV-04 title and lines 306-307 → lending to another seat is Manager+ only; a User places only on seats they occupy; DEV-05 lines 310-311 → the owner moves seat to seat only onto a seat they occupy (back to inventory always); add `seat_not_yours` 422 refusal; also check line 563-564 text and OQ-13 (line 776) wording stays consistent | amend spec | no |
| `work/decisions.md` | append row D72 (2026-11-26, Ming): a User places or moves a device only onto a seat they occupy (empty seat = not yours; 422 `seat_not_yours`); return to inventory always allowed; Manager/Admin keep D19; devices a User already lent stay as they are; amends spec DEV-03/04/05 | decision log | no |

No High path is touched.

## Data model / migration
None. No schema change; the DB invariants (primary needs occupant owner) are unchanged.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | existing device placement route (`/api/devices/[id]/placement`, unchanged shape) | `{seatId, role, expectedSeatId}` or `{seatId:null, expectedSeatId}` | unchanged DeviceDto | new 422 `seat_not_yours` (User, target seat occupant is not the caller's member); existing 422 `not_allowed`/`device_unowned`, 409 codes | owner or Manager+ (unchanged) |

(Implementer: confirm the exact route path with Grep in `src/app/api/devices/`; no handler change expected since `placeDevice` returns the `Result` and the route already maps `status`/`code`.) R7: the refusal is a 422 domain code decided inside the transaction before the update/audit, not from the auth wrapper.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `rules.test.ts` › user own seat | place and move onto own seat (secondary and primary) → place/move |
| `rules.test.ts` › user other's seat | 422 `seat_not_yours`, secondary and primary |
| `rules.test.ts` › user empty seat | 422 `seat_not_yours` (M-85) |
| `rules.test.ts` › user to inventory | target null from another's seat → `return` |
| `rules.test.ts` › user legacy lent device same seat same role | still `noop` |
| `rules.test.ts` › manager/admin other's and empty seat | place secondary (D19); primary rules unchanged |
| `rules.test.ts` › order | `not_allowed` and `placement_changed` come before `seat_not_yours` |
| `devices.test.ts` › seat_not_yours writes nothing | no update, no audit insert |
| `devices-routes.test.ts` › 422 seat_not_yours | route passthrough |
| `devices.db.test.ts` › user on other's seat (CI) | end to end refusal, device unchanged |
| `place-device.test.ts` › ownSeats | user filtered, manager/admin unfiltered; `planSubmit`/`primaryRefusal` honour tier |
| `PlaceDeviceDialog.test.tsx` › user picker | only own seats listed; "no seat" message when none |

## Approach
1. Add the rule to `decidePlacement` (pure, lib; R1 unchanged) with tests first.
2. Pass `callerId` from the server transaction; the member lookup is already there. No new query, so lock order is untouched.
3. Register the code in `error.ts` and copy in `api.ts`.
4. UI: filter seats by tier, thread `tier` into the dialog from both hosts, add empty message. The server remains the guard.
5. Spec amendment and D72.
6. Run checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
Rules: R1 (lib is pure, UI imports lib only), R5 (tests), R6 unchanged (occupant compared by member id within the org-scoped seat query), R7 (422 before any write).

## Specialist input used
None (fast lane, no consult).

## Assumptions
- For a User, the caller's member id equals the device owner id (only the owner may place for a User), so the UI can compare `seat.occupant.id` with `device.owner.id` without a separate "me" id.
- The UI needs the tier; `DeviceDto` does not carry it, so it is passed from the session (DevicesPage) and via the detail page into `useDeviceDetailActions`. If `DeviceDetailPage` has no session, use the same session hook `DevicesPage` uses.
- The refusal is placed after the `noop` check (line 81), so a legacy-lent device re-submitted unchanged is a noop; any actual change is subject to the rule.
- Hotspots: `src/ui/devices/PlaceDeviceDialog.tsx`, `DevicesPage.tsx`, `place-device.ts` may be edited by SIM-048's sibling D69/D70 tickets (My Portal "my devices" actions reuse these components); expect a rebase if one is open. `work/decisions.md` and `docs/spec-v1.md` are shared docs; D72 numbering may need renumbering if another ticket adds a D-entry first.
- Size S: roughly 150-250 changed lines including tests and spec.

## Blocking questions
None

## Split proposal
None
