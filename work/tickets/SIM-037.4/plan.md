Status: READY

# Plan — SIM-037.4: Return a device to the org inventory with Admin confirmation (slice 1 of 2: API, DTO, deactivation)

This plan covers **slice 1** only (see `## Split proposal`). It contains every server behaviour of the ticket: start,
cancel and confirm a return; Admin take-back; deactivation cancelling handoffs; the pending-returns list and count;
DTO flags; audit rows. The only UI edits are the ones the new required DTO fields force (test fixtures). The Return
dialog, pending-returns list, Admin nav badge and Take-back action go to slice 2 (new ticket SIM-037.10), as
SIM-037.3 / SIM-037.8 did.

**High path: no.** There is no migration (the schema from SIM-037.1 and SIM-037.3 already allows returns). No file under
`src/server/http/**`, `src/proxy.*`, config, Docker or deploy is touched, so the PR is **Medium** tier. The plan gate
still applies (P1, Gate `plan-approval`). The security review trigger fires (`src/server/`).

## Scope summary
- `docs/spec-v1.md` §6 DEV-09 (lines 327-333):
  - "The owner (or a Manager+) starts a return of an owned device to the org inventory, with an optional note."
  - "Until an Admin confirms the device was received, nothing changes; the owner (or a Manager+) can cancel."
  - "When an Admin confirms, in one transaction the device leaves its seat (if placed), loses its owner and is in the
    org inventory. Admins see pending returns (badge in the nav, list on the Devices page)." (slice 1 delivers the list
    and count endpoints; the UI is slice 2)
  - "An Admin can also take a device back directly, without a request (e.g. the owner was deactivated or removed,
    OQ-44); the history records it as an Admin return."
- DEV-08 (line 319-320): "A device has at most one pending handoff (transfer, return or extension)."
- Spec §5 invariant 5 (line 146): "A device with no owner (org inventory, D63) is never at a seat." Together with the DB
  checks `devices_unowned_not_placed_check` and `devices_unowned_no_holding_check`
  (`db/migrations/20261125120000_device_lifecycle.sql` lines 24-31), this means confirm and take-back clear owner,
  seat, note and expiry in one UPDATE.
- DEV-11 (lines 345-347): history lists "return (started, cancelled, confirmed, Admin return) … who did it, from and to
  member, when, note, expiry date, and who confirmed. History is kept when members are deactivated or removed." This is
  the source of the audit names and meta.
- OQ-44 (spec lines 704-706): "Default: the device stays assigned (deactivation already returns placed devices to the
  owner's inventory, D34), pending handoffs to or from that member are cancelled, and an Admin can take the device back
  directly (DEV-09)."
- D34 (`work/decisions.md` line 41): "Members are never deleted in simap: Manager+ deactivate (simap-local) or an Admin
  removes them from the org; … Removing from the org needs a new Identity endpoint". No remove path exists in `src/`
  (grep `removeMember|delete from members` finds nothing), so this ticket handles **deactivation** only (A3).
- Ticket scope: "confirm (Admin only): unplace, clear owner, note and expiry, in one transaction." / "Admin direct
  take-back of an owned device without a request." / "Member deactivate/remove cancels pending handoffs to or from that
  member; their devices stay assigned." / "Audit rows for start, cancel, confirm and Admin take-back."
- SIM-037.3 plan A5: "Deactivation cleanup is SIM-037.4 (its scope)."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Owner or Manager+ can start and cancel a return; only an Admin can confirm. | `src/lib/devices/handoff-rules.test.ts › decideReturnStart` (user+owner ok; user+not owner → 422 `not_allowed`; manager/admin on any owned device ok; unowned → 422 `device_unowned` for Manager+, `not_allowed` for User; pending → 409 `handoff_pending`; null member id → `not_allowed`). `› decideHandoffAction kind=return`: confirm is ok for an Admin only, including an Admin who is the owner (A1), and gives 422 for owner-user and manager; decline is always 422 `not_allowed`; cancel is ok for the from member or Manager+. `› kind=transfer matrix unchanged` (existing cases pass with `kind`). `src/server/devices/handoffs.db.test.ts › return: start by owner (user)`, `› start by manager for another's device (requested_by = manager, from = owner)`, `› user on another's device → 422, no row, no audit`, `› cancel by owner / by manager`, `› confirm by manager → 422 not_allowed`, `› decline → 422`. `src/app/api/handoffs/handoffs-routes.test.ts › no handler returns 401/403` (R7). |
| 2 | Until confirm nothing changes; on confirm the device has no owner, no seat, no note or expiry. | `handoffs.db.test.ts › return: start leaves owner, seat, role, holding unchanged`. `› confirm return of a placed primary device`: owner_id, seat_id, holding_note and holding_expires_on are null, role is secondary, the seat has no primary, the COMMIT passes the deferred triggers, and the handoff is confirmed with decided_by = admin. Also `› confirm of an unplaced device`, `› confirm after the owner changed (direct UPDATE) → 409 handoff_stale`, `› confirm after cancel → 409 handoff_not_pending`, `› confirm vs concurrent cancel: one wins`. |
| 3 | Admin take-back works with no pending request and on a deactivated member's device. | `handoffs.db.test.ts › take-back: owned placed device, no handoff → cleared, one device.return_take_back row`. `› take-back on a deactivated member's device`. `› take-back with a pending transfer cancels it (cancelled, decided_by = admin) and clears the device`. `› take-back with a pending return → 409 handoff_pending` (A4). `› take-back of an unowned device → 422 device_unowned`. `› take-back by a manager` is refused by the wrapper: `src/app/api/devices/devices-routes.test.ts › POST take-back uses tier admin` (403 from `withAuth` before the service runs). |
| 4 | Deactivating or removing a member cancels their pending transfers and returns. | `src/server/members/manage.db.test.ts › deactivate cancels pending handoffs from and to the member`: a transfer from, a transfer to and a return from the member become `cancelled` with decided_by = actor and decided_at set. One `device.<kind>_cancel` row per handoff carries `byDeactivation: true`, and `member.deactivate` meta has `cancelledHandoffs: 3`. Devices stay owned. `› deactivate noop / refuse paths cancel nothing`. `› actor with no member row → decided_by = target` (A6). |
| 5 | Admins see the number of pending returns in the nav. | Slice 1 delivers the count source: `handoffs.db.test.ts › count: returns counts pending returns in my org for an Admin; 0 for manager/user; other org never counted`; `handoffs-routes.test.ts › GET /api/handoffs/count → { incoming, returns }`; `› GET /api/handoffs?box=returns` → list for an Admin and 422 `not_allowed` for a non-Admin. The badge itself is slice 2 (SIM-037.10). |
| 6 | Each start, cancel, confirm and take-back writes one audit row; a refusal writes none. | `handoffs.db.test.ts › return audit rows` (actions `device.return_start/_cancel/_confirm/_take_back`, meta as in Approach 7), `› refused return actions write no audit row`, `› transfer audit names unchanged`. |
| 7 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` locally; `pnpm test:db` green in CI. |

## Ming verification after merge
None for slice 1 (no visible UI change). The ticket's "Manual: return then Admin confirm" moves to slice 2
(SIM-037.10).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/types.ts` (lines 76-79, 85-86, 125) | `HandoffStartValue` becomes a union that adds `{ kind: "return"; note: string \| null }`. `HandoffCountDto` becomes `{ incoming: number; returns: number }`. `DeviceDto` gains `canReturn` and `canTakeBack`. `HandoffBox = "incoming" \| "returns"`. | One contract for server and UI. | No |
| `src/lib/devices/handoff-rules.ts` (lines 4-78) | `canStartReturn` (same rule as `canStartTransfer`); `decideReturnStart`; `decideHandoffAction` and `handoffFlags` take `kind` (return: confirm = Admin, decline never; extension: everything `not_allowed` until SIM-037.5); `canTakeBack(tier, ownerId, pendingKind)`. | Pure logic first; R7 order. | No |
| `src/lib/devices/handoff-rules.test.ts` | Add `kind: "transfer"` to the existing cases; add the return and take-back matrices. | R5. | No |
| `src/lib/validate/device.ts` (lines 200-217) | `validateHandoffStart` accepts `{ kind: "return", note? }`, where `toMemberId` is refused for a return. `validateHandoffBox` accepts `incoming` and `returns`. | Boundary validation. | No |
| `src/lib/validate/device.test.ts` | Cases for both. | R5. | No |
| `src/server/devices/handoffs.ts` (whole file) | Extract `lockPlacement` (room share → seat update → device update, lines 293-336) for reuse by confirm and take-back. Add `startReturn`. `confirmHandoff` dispatches on kind to `confirmTransferOnce` (the current `confirmOnce`) or `confirmReturnOnce`. `closeHandoff` passes kind and writes the `device.<kind>_<action>` audit action. Add `takeBack`. `listHandoffs(box)` gains `returns`. `countHandoffs` adds `returns`. | Ticket scope. | No |
| `src/server/devices/handoffs.db.test.ts` | Return, take-back, list and count cases (see Tests). | Ticket test plan. | No |
| `src/server/devices/devices.ts` (lines 3, 73-113) | `toDto` sets `canReturn` and `canTakeBack`, using `r.h_kind`. | DTO flags (server-driven, frontend consult §1). | No |
| `src/server/devices/devices.db.test.ts` | `canReturn` / `canTakeBack` per viewer and per pending kind. Also: assign and delete refuse while a return is pending. | Interplay. | No |
| `src/server/members/manage.ts` (lines 400-431) | `deactivateMember` cancels pending handoffs from or to the member (after the seat_requests cancel, before the status update), with one audit row per handoff and `cancelledHandoffs` in the `member.deactivate` meta. | OQ-44, ticket scope. | No |
| `src/server/members/manage.db.test.ts` | Deactivation cancels handoffs; noop and refuse paths do not. | Ticket test plan. | No |
| `src/app/api/devices/[id]/handoffs/route.ts` (line 21) | Dispatch `v.kind === "return" ? startReturn : startTransfer`. | Start endpoint reused (037.3 contract). | No |
| `src/app/api/devices/[id]/take-back/route.ts` (new) | `POST`, `withAuth(…, { tier: "admin" })`, no body, copied from `handoffs/[id]/confirm/route.ts`. | Endpoint. | No |
| `src/app/api/handoffs/route.ts` (lines 11-15) | Pass the validated `box` to `listHandoffs`. | `box=returns`. | No |
| `src/app/api/handoffs/count/route.ts` (line 12) | Pass `ctx.tier` to `countHandoffs`. | Admin-only `returns`. | No |
| `src/app/api/handoffs/handoffs-routes.test.ts` | `box=returns` cases, count shape, confirm/cancel with return kind mocked. | Route contract. | No |
| `src/app/api/devices/devices-routes.test.ts` | `POST /api/devices/:id/handoffs` with `kind: "return"`, plus the `POST …/take-back` cases (uuid → 404, 503, refusal mapping, wrapper tier admin). | Route contract. | No |
| DeviceDto literals in UI tests: `src/ui/devices/{device-form,device-actions,place-device}.test.ts`, `src/ui/devices/{PlaceDeviceDialog,DevicesView}.test.tsx` | Add `canReturn: false, canTakeBack: false` (`pnpm typecheck` finds every literal). | New required DTO fields. | No |

No new API error code: `not_allowed`, `device_unowned`, `handoff_pending`, `handoff_not_pending`, `handoff_stale` and
`placement_changed` already exist in `src/lib/api/error.ts` (lines 19-40) and in `src/ui/copy/api.ts`. No UI source
file changes in this slice. `devices-api.ts` line 155 still parses only `incoming`, and the added `returns` field is
ignored until slice 2.

## Data model / migration
None. Existing schema covers it:
- `device_handoffs_shape_check` (lifecycle migration lines 58-62) allows `kind = 'return' and to_member_id is null and
  new_expires_on is null`.
- `device_handoffs_one_pending_idx` limits a device to one pending handoff. `device_handoffs_decided_by_check`
  (`20261125180000_handoff_decided_by.sql`) requires `decided_by_id` on every decided row. Every cancel or confirm here
  sets it to a real member id.
- `devices_unowned_not_placed_check` / `devices_unowned_no_holding_check` are immediate, so confirm and take-back clear
  `owner_id, seat_id, holding_note, holding_expires_on` in **one** UPDATE (and set `role = 'secondary'`).
- The pending-returns list and count filter `org_id, kind = 'return', status = 'pending'`. They use no dedicated index:
  pending rows per org are few, and the partial `device_handoffs_one_pending_idx` bounds them. Adding an index would
  need a migration, which would make the PR High tier, so it is deferred (A9).

## API contract
Every route uses a canonical UUID check (else 404), 503 without a pool, `readJson` and a validator (400),
`apiError(status, code)` and `Cache-Control: no-store`. 401/403 come only from `withAuth` (R7). All domain refusals are
422/409 and are computed before any write.

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices/:id/handoffs` | `{ kind: "return", note?: string \| null }` (no other keys; `toMemberId` refused for return; note ≤ 500, NFC, trimmed, blank → null). The `transfer` body is unchanged. | 201 `HandoffDto` (`kind: "return"`, `to: null`) | 400; 404 (device); 422 `not_allowed`, `device_unowned`; 409 `handoff_pending` | wrapper `user`; service: owner, or Manager+ for any owned device |
| POST | `/api/handoffs/:id/cancel` | none (unchanged route) | 200 `HandoffDto` | 404; 422 `not_allowed`; 409 `handoff_not_pending` | from member (owner) or Manager+ (same for both kinds) |
| POST | `/api/handoffs/:id/decline` | none (unchanged) | — | return kind → 422 `not_allowed` | recipient of a transfer only |
| POST | `/api/handoffs/:id/confirm` | none (unchanged route; dispatches on kind) | 200 `HandoffDto` | 404; 422 `not_allowed`; 409 `handoff_not_pending`, `handoff_stale`, `placement_changed` | transfer: recipient; return: **Admin** (service check, 422 otherwise) |
| POST | `/api/devices/:id/take-back` (new) | none | 200 `DeviceDto` (the reloaded device: unowned, unplaced) | 404; 422 `not_allowed` (no member row), `device_unowned`; 409 `handoff_pending` (a return is pending: confirm it instead), `placement_changed` | wrapper `admin` (403 `forbidden` from the wrapper, before any side effect) |
| GET | `/api/handoffs?box=incoming\|returns` | `box` required, exactly one | 200 `{ items: HandoffDto[], truncated }`; `returns` = org-wide pending returns, newest first, limit 100 | 400; `returns` for a non-Admin → 422 `not_allowed` | `incoming`: any member; `returns`: Admin |
| GET | `/api/handoffs/count` | none | 200 `{ incoming: number, returns: number }`, where `returns` is 0 unless the caller is an Admin | — | any member |

Types (`src/lib/devices/types.ts`):
```ts
export type HandoffStartValue =
  | { kind: "transfer"; toMemberId: string; note: string | null }
  | { kind: "return"; note: string | null };
export type HandoffBox = "incoming" | "returns";
export type HandoffCountDto = { incoming: number; returns: number };
// DeviceDto gains:
//   canReturn: boolean;   // owned, no pending handoff, caller is owner or Manager+ (DEV-09)
//   canTakeBack: boolean; // Admin, owned, and no pending return (a pending transfer is cancelled by take-back)
```
In a return's `HandoffDto`: `canConfirm` is true for an Admin while it is pending, `canDecline` is always false, and
`canCancel` is true for the from member or a Manager+. On the device row, `PendingHandoffDto.canCancel` keeps the
current rule (`canCancelHandoff`), which is the same for both kinds.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/handoff-rules.test.ts › decideReturnStart` | Order: permission → `device_unowned` → `handoff_pending`; user owner ok; user non-owner refused (also on an unowned device); manager/admin ok on any owned device; null member id → `not_allowed`. |
| `handoff-rules.test.ts › decideHandoffAction kind=return` | confirm × (admin, admin who is the owner, manager, owner-user, other user, null member id): only an Admin is allowed. Decline is always refused. Cancel: from member, manager and admin are allowed, other users are refused. Not pending → 409 after the permission check. |
| `handoff-rules.test.ts › decideHandoffAction kind=transfer unchanged` / `› kind=extension refused` | The existing matrix with `kind: "transfer"`; extension → `not_allowed`. |
| `handoff-rules.test.ts › handoffFlags kind=return` / `› canTakeBack` | Admin flags on a pending return: canConfirm true, canDecline false. canTakeBack: admin + owned + (no pending or a pending transfer) → true; a pending return → false; unowned → false; manager → false. |
| `src/lib/validate/device.test.ts › validateHandoffStart return` | `{kind:"return"}` → note null; note 500 ok / 501 refused; a decomposed Vietnamese note (`"Trả máy cho phòng IT"`) comes back NFC; blank → null; `toMemberId` present → refused; extra key refused; `kind: "extension"` refused. |
| `device.test.ts › validateHandoffBox` | `incoming`, `returns` ok; missing, `outgoing`, repeated refused. |
| `src/server/devices/handoffs.db.test.ts › return start …` | Owner ok, and the device is unchanged after start. Manager for another's device: requested_by = manager, from = owner. User on another's device → 422 with no row. Unowned → 422. A second start (return after transfer, return after return) → 409. One `device.return_start` row. |
| `handoffs.db.test.ts › return cancel / decline …` | Owner cancels; manager cancels; another user → 422; decline → 422; after cancel `decided_by_id` = actor; audit action `device.return_cancel`. |
| `handoffs.db.test.ts › return confirm …` | A placed primary device ends with owner, seat, note and expiry null, role secondary, and the seat without a primary (COMMIT ok). An unplaced device. Manager → 422. Owner-user → 422. An Admin who owns the device confirms (A1). After cancel → 409. Owner changed directly → 409 `handoff_stale`. Repeat → 409. Audit meta carries `fromSeatId`, `fromCode`, `demoted` and `expiresOn` (previous). |
| `handoffs.db.test.ts › take-back …` | Owned placed device → cleared, and `device.return_take_back` meta has `byAdmin: true` and `fromMemberId`. The owner is deactivated → cleared. A pending transfer → the transfer is cancelled, a `device.transfer_cancel` row has `byTakeBack: true`, then the device is cleared. A pending return → 409 `handoff_pending` with nothing changed. Unowned → 422. Unknown or other-org id → 404. |
| `handoffs.db.test.ts › concurrency` | Two connections. Take-back vs transfer confirm on the same device: one wins, and the loser gets a 409 (`handoff_not_pending` / `device_unowned` / `handoff_stale`) with no deadlock. Return confirm vs concurrent placement: no deadlock (one retry, A12 of SIM-037.3). |
| `handoffs.db.test.ts › list and count` | `box=returns`: only pending returns of my org, newest first, transfers excluded, decided excluded. The non-Admin service call → 422. Count: `returns` for an Admin; 0 for manager/user; `incoming` unchanged. |
| `src/server/devices/devices.db.test.ts › return flags` | `canReturn` for owner/manager, false for another user and while pending. `canTakeBack` for an Admin only, false while a return is pending. Assign and delete refuse with a pending return. |
| `src/server/members/manage.db.test.ts › deactivate cancels handoffs` | Transfers from and to the member and a return from the member are all cancelled (decided_by = actor), there is one audit row per handoff (`byDeactivation: true`), and `member.deactivate` meta has `cancelledHandoffs`. Another member's handoff is untouched, devices stay owned, and the noop (already deactivated) and `member_not_empty` / self paths cancel nothing. An actor with no member row falls back to decided_by = target. |
| `src/app/api/handoffs/handoffs-routes.test.ts` | `box=returns` passed to the service; bad box → 400; count passes tier; service refusals mapped; no 401/403 emitted by handlers. |
| `src/app/api/devices/devices-routes.test.ts › POST handoffs return` / `› POST take-back` | Return body → `startReturn`; take-back: bad uuid → 404, no pool → 503, refusal mapping, the handler is registered with tier `admin`. |

## Approach
1. **Types and pure rules.**
   - Widen `HandoffStartValue`, `HandoffCountDto` and `DeviceDto` in `src/lib/devices/types.ts`.
   - In `handoff-rules.ts`:
     - Add `canStartReturn = canStartTransfer` (DEV-09 has the same rule, kept as its own name) and
       `decideReturnStart({ tier, actorMemberId, ownerId, pending })`.
     - `decideHandoffAction` gains `kind`. For `return`, confirm is allowed when `actorMemberId !== null &&
       tier === "admin"`, and decline is never allowed. `extension` refuses everything until SIM-037.5. `transfer` is
       unchanged. Permission is checked first, then `handoff_not_pending`.
     - `handoffFlags` passes `kind` through.
     - `canTakeBack(tier, ownerId, pendingKind) = tier === "admin" && ownerId !== null && pendingKind !== "return"`.
2. **Validators.** Branch on `body.kind`. The allowed keys are `["kind","note"]` for return and the current keys for
   transfer. `validateHandoffBox` returns `"incoming" | "returns"`.
3. **`handoffs.ts` refactor (no behaviour change for transfers).**
   - Extract `lockPlacement(c, scope, deviceId)`. It does an unlocked `seat_id` read, then room `for share`, seat `for
     update` and device `for update`, and returns `{ seat0, seatCode, d }` (current lines 293-336).
     `confirmTransferOnce` keeps its recipient `for share` lock before calling it, so the global order stays member →
     room → seat → device → handoff.
   - `closeHandoff` reads `kind` in `LITE` and passes it to `decideHandoffAction`. Its audit action becomes
     `` `device.${kind}_${action}` `` (transfer names are unchanged).
   - `handoffRows` passes `kind` to `handoffFlags`.
4. **`startReturn`.** It follows `startTransfer` without the recipient lock: actor member id; device `for update`;
   pending read under that lock; `decideReturnStart`. Then it inserts `kind 'return', from_member_id = owner_id
   (read under the lock), to_member_id null, requested_by_id = me, note`, writes the audit row and returns `loadOne`.
5. **`confirmReturnOnce`.** It reads the handoff (404) and runs `decideHandoffAction(confirm, kind)` before any lock.
   Then `lockPlacement`, then the handoff `for update`. Re-checks: pending (409 `handoff_not_pending`), `d.owner_id =
   h.from_member_id` (409 `handoff_stale`), seat unchanged (409 `placement_changed`, retried once by `confirmHandoff`,
   as now). It then runs one `update devices set owner_id = null, seat_id = null, role = 'secondary', holding_note =
   null, holding_expires_on = null, updated_at = now()` and updates the handoff to `confirmed` with
   `decided_by_id = me`, then writes the audit row. `confirmHandoff` reads the kind once (unlocked) and dispatches.
6. **`takeBack(db, scope, actorSub, tier, deviceId)`.** The wrapper has already enforced tier admin. The service also
   checks `tier === "admin"` (422 `not_allowed`, defence in depth) and requires a member row (422 `not_allowed`,
   because `decided_by_id` needs one, A10 of SIM-037.3). Steps:
   - `lockPlacement` (404 if the device is missing).
   - Owner null → 422 `device_unowned`.
   - Pending handoff `for update`: if it is a return, refuse with 409 `handoff_pending`. If it is a transfer, set it to
     `cancelled` with `decided_by_id = me` and write a `device.transfer_cancel` audit row with `byTakeBack: true`.
   - Seat re-check (retry once, then 409 `placement_changed`).
   - The same single device UPDATE as in step 5, then the `device.return_take_back` audit row.
   - Return the reloaded `DeviceDto` (export or reuse `reload` from `devices.ts`).
   Lock order: room → seat → device → handoff, the same as confirm and `deactivateMember`.
7. **Audit** (`writeAudit`, `entity: "device"`, `entityId` = device id). The `device.return_*` prefix lets history
   (DEV-11, SIM-037.6) group returns.
   - `device.return_start`: `{ handoffId, fromMemberId, inventoryNumber, note }`.
   - `device.return_cancel`: `{ handoffId, fromMemberId, toMemberId: null, inventoryNumber, byManager }`.
   - `device.return_confirm`: `{ handoffId, fromMemberId, inventoryNumber, expiresOn, fromSeatId, fromCode, demoted }`.
   - `device.return_take_back`: `{ fromMemberId, inventoryNumber, expiresOn, fromSeatId, fromCode, demoted, byAdmin:
     true, cancelledHandoffId }`.
   - Deactivation cancels write `device.<kind>_cancel` with `byDeactivation: true, memberId`.
   - No tokens. The meta carries no PII beyond member ids and the note.
8. **List and count.** `listHandoffs(db, scope, sub, tier, box)`:
   - `incoming`: unchanged.
   - `returns`: a non-Admin gets 422 `not_allowed`. Otherwise it filters `h.kind = 'return' and h.status = 'pending'`,
     limit 101, and sets `truncated`.
   `countHandoffs(db, scope, sub, tier)` adds `returns` (a count query that runs only when the tier is admin, otherwise 0).
   Both go through `orgQuery`, so `org_id` comes from the token (R6).
9. **DTO** (`devices.ts` `toDto`): `canReturn: r.owner_id !== null && !pending && canStartReturn(tier, r.mine)`;
   `canTakeBack: canTakeBack(tier, r.owner_id, r.h_kind)`.
10. **Deactivation** (`manage.ts`, after line 412, before the status update; only on the `release` / empty path, so
    `noop` and refusals return earlier):
    ```sql
    update device_handoffs set status = 'cancelled', decided_by_id = $3, decided_at = now(), updated_at = now()
    where org_id = $1 and status = 'pending' and (from_member_id = $2 or to_member_id = $2)
    returning id, kind, device_id, from_member_id, to_member_id
    ```
    - `$3` = `actor[0]?.id ?? id`. The fallback keeps `device_handoffs_decided_by_check` satisfied (A6).
    - Write one audit row per returned row and add `cancelledHandoffs: n` to the `member.deactivate` meta.
    - Lock order: this runs after member → rooms → seats → (devices updated on release). Confirm and take-back lock
      room → seat → device → handoff, and transfer confirm locks the recipient member first, so a deactivate racing a
      confirm serialises on the member or device row. There is no reverse order, so no cycle.
    - Devices stay owned (OQ-44).
    - `DeactivationImpact` is not extended (R4; the UI warning can come later, A7).
11. **Routes.** Start dispatch, the new take-back route, box and tier pass-through. Then update the fixtures and run
    every check.

Rules:
- R1: routes import only `src/server/**`; rules and validators stay in `src/lib`; `pnpm check:layers`.
- R2: no schema change.
- R3: no config.
- R4: only the files above.
- R5: tests above.
- R6: every query and join is scoped by `org_id` through `orgQuery`; the tier comes from the verified token via
  `withAuth` (roles from `org_roles`).
- R7: take-back's Admin check is the wrapper's `tier: "admin"`, which runs before any side effect. Return confirm by a
  non-Admin is a 422 `not_allowed` computed before any lock or write. `box=returns` for a non-Admin is 422. No handler
  returns 401/403.

## Specialist input used
- api-platform-engineer:
  - Adopted:
    - No migration (§1). A separate return confirm path, Admin only (§1, §2).
    - The device UPDATE that clears owner, seat, role, note and expiry together, with the stale check (§2). The lock
      order reused from `confirmOnce` (§2).
    - Start: permission → `device_unowned` → `handoff_pending` under the device lock (§3).
    - Take-back: lock the device, cancel a pending handoff with decided_by = admin, then one audit row with `byAdmin`
      (§4).
    - The deactivation UPDATE with actor-or-target `decided_by_id`, placed after the member lock (§5). The noop and
      refuse paths untouched.
    - Admin list and count, with `returns` added to the count additively (§6). Test list (§7).
  - Changed:
    - The take-back route is `POST /api/devices/:id/take-back` with wrapper tier admin.
    - The audit action is `device.return_take_back` (consult: `device.return_admin_take_back`), shorter and in the
      same `return_*` family.
    - A pending **return** makes take-back refuse 409 `handoff_pending` (the Admin confirms it instead, A4). The
      consult cancels any pending handoff.
    - Deactivation writes one audit row per handoff plus the count in the member row (the consult offered either).
  - Open questions answered by default:
    - Q1: deactivation only, remove out of scope (A3).
    - Q2: self-confirm allowed (A1).
    - Q3: no decline for returns.
    - Q4: the confirm dialog is slice 2.
    - Q5: no notification (A8).
- frontend-developer:
  - Adopted for the contract: the `canReturn` / `canTakeBack` DTO flags, computed on the server; `box=returns`;
    `count.returns` added without changing `incoming` (keeps current client parsing working).
  - Changed:
    - `canTakeBack` is also true with a pending transfer (take-back cancels it), and false only with a pending return.
    - A non-Admin `box=returns` gets 422 `not_allowed` (R7 forbids a handler 403). The slice-2 UI only calls it for
      Admins.
    - Take-back has no note (not in DEV-09; rule 1). The consult proposed an optional note.
  - Everything UI goes to slice 2 unchanged: `ReturnDeviceDialog`, `PendingReturns`, row actions with distinct copy
    keys (not the existing `place` mode "Return"), the Take-back confirm dialog, the generalised `act()`, the badge sum
    with aria breakdown, and the tests.

## Assumptions
For Ming to approve with the plan (defaults from the consults unless noted):
- **A1 Self-confirm.** An Admin who owns the device may confirm their own return (only the Admin role matters). The
  alternative, a second Admin, is a small rule change later.
- **A2 Who may cancel a return:** the from member (the owner) or a Manager+, the same as a transfer. There is no decline
  for returns.
- **A3 "Remove" is out of scope.** No remove path exists, and D34 says it needs a new Identity endpoint. Only
  deactivation cancels handoffs. The future remove ticket must reuse the same cancel step.
- **A4 Take-back vs pending handoff.** A pending transfer is cancelled by take-back (audit `byTakeBack`). A pending
  return refuses take-back with 409 `handoff_pending`, because confirming it records the owner's own request. Ming may
  prefer "take-back confirms the pending return"; that is a small change.
- **A5 Return confirm clears the holding note and expiry** (DB checks require it). The previous expiry is kept in the
  audit meta. The return note stays on the handoff row.
- **A6 Deactivation decider.** `decided_by_id` = the actor's member row, or the deactivated member when the actor has
  none (Admin from the portal without a member row).
- **A7 No `DeactivationImpact` change.** The deactivate dialog does not warn about handoffs yet (follow-up if wanted).
- **A8 No notification** to the other party when deactivation cancels a handoff. It shows in audit only.
- **A9 No index** for the org-wide pending-returns query (it would need a migration and make the PR High tier). If the
  volume grows, file a `debt` issue.
- **A10 Accepted race.** A transfer or return started by an owner at the exact moment a Manager deactivates them can
  commit after the deactivation's UPDATE and stay pending. The start path does not lock the owner's member row. The
  sender side can still cancel it and the Admin can take the device back. Record this as a `debt` issue at PR time.
- **A11 Hotspots.** `src/server/devices/handoffs.ts`, `handoff-rules.ts`, `devices.ts` and `types.ts` were last changed
  by SIM-037.3 (MERGED). No open ticket (IN_PROGRESS / REVIEW / DONE) edits them. SIM-039.2 (DONE) is in the map-item
  area and shares no files. SIM-037.5 will extend the same files after this one.
- **A12 Extension kind** stays refused everywhere (`not_allowed`) until SIM-037.5.

## Blocking questions
None.

## Split proposal
The full ticket is roughly 750-850 changed production lines plus tests (server ~400: `handoffs.ts` ~230, rules,
validators and types ~70, `manage.ts` ~35, routes ~45, DTO ~10; UI ~400). That is more than one implement/review
cycle. Split as SIM-037.3 / SIM-037.8:

- **Slice 1 — SIM-037.4 (this plan):** API, DTO and deactivation. Estimate ~400 production lines and ~550 test lines.
  It delivers ticket AC 1-4 on the server and the count source for AC 5. Medium tier (no High path).
- **Slice 2 — new ticket SIM-037.10 "Devices UI: return dialog, pending returns and Admin take-back".** Depends on
  SIM-037.4; Areas ui, ux; P1; Size M; Gate `plan-approval` to match the 037.8/037.9 rows; Medium tier. Scope, from
  the frontend consult §2-8:
  - `ReturnDeviceDialog.tsx` with a pure `return-device.ts` (body `{ kind: "return", note }`, outcome and stale
    handling generalised from `settleTransfer`).
  - Row actions: "Give back to org" (`canReturn`), "Take back" (`canTakeBack`, danger style, confirm dialog modelled
    on `DeleteDeviceDialog` that shows the owner and seat), and "Cancel return" (`cancelTransfer` made kind-aware).
    Copy keys must differ from the existing `place` mode "Return".
  - A "Return pending" chip.
  - A `PendingReturns.tsx` section for Admins with Confirm only (and Cancel when `canCancel`), with its own hook on
    `box=returns`, wired into the shared `act()` / `acting` / focus handling.
  - The Admin badge shows incoming + returns as one number with an aria breakdown in `src/ui/copy/shell.ts`; update
    `useHandoffBadge` / `badgeCountAfter`.
  - `devices-api` methods `startReturn`, `takeBack`, `pendingReturns`, and count parsing of `returns`.
  - Copy in `src/ui/copy/devices.ts`; tests (pure outcomes, dialog, `PendingReturns`, `rowActions` gating, badge sum,
    `AppShellView.test`).
  - Acceptance: the UI parts of ticket AC 1, 3 and 5, and Ming's manual "return then Admin confirm".
