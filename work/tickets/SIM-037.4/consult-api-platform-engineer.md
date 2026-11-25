**Findings**
- Schema: no migration is needed. `db/migrations/20261125120000_device_lifecycle.sql` already has `device_handoffs.kind` in ('transfer','return','extension'). The shape check allows return with `to_member_id` null and `new_expires_on` null. `devices.owner_id` is nullable. Two immediate checks force an unowned device to have no seat, note or expiry. Together they require clearing owner, seat, role, note and expiry in ONE UPDATE. The partial unique index allows one pending handoff per device. `20261125180000_handoff_decided_by.sql` requires `decided_by_id` set if and only if the handoff is not pending.
- `devices.role` is not covered by the unowned checks. Confirm should set `role='secondary'`, as transfer confirm does. Invariant 3 (primary role at a seat) is a deferred trigger, so check it with the DB test.
- `src/server/devices/handoffs.ts` only handles transfers.
  - `startTransfer` hardcodes kind 'transfer'.
  - `closeHandoff` (cancel/decline) is kind-agnostic. Audit actions are `device.transfer_*` and need a kind switch.
  - `confirmOnce` assumes a recipient (`to_member_id!`).
  - `listHandoffs` and `countHandoffs` filter on `to_member_id = me`. Returns have a null `to`, so they are invisible to those queries.
- `src/lib/devices/handoff-rules.ts` has no return rules. `decideHandoffAction` treats confirm and decline as recipient-only. A return needs its own rule: confirm is Admin only, and decline is not applicable. `handoffFlags` and `HandoffDto` also need updating.
- `src/server/members/manage.ts` `deactivateMember`:
  - It takes locks in the order member, rooms (share), seats (update), then devices and requests.
  - It cancels seat_requests but never touches handoffs.
  - Its `decided_by_id` comes from `actor[0]?.id ?? null`. That would violate `device_handoffs_decided_by_check` for handoffs, so cancel with a real member id (the actor's), or add a guard.
  - The `noop` and `refuse` paths must not cancel anything.
- There is no member "remove" function in `src/`. Deactivation is the only path, so "remove" in the ticket is either unimplemented or lives elsewhere. Confirm before scoping.
- `device_handoffs_*_fkey` on from, to and requested_by have no ON DELETE action, so a future hard remove of a member with handoff history would fail.
- `devices.ts` lines 450 and 562 already refuse delete and edit while a handoff is pending. The Admin take-back needs the same pending-handoff handling (see below).

**Recommendations**
1. No migration, so no R2 work. Reuse `device_handoffs` and add `startReturn` plus a kind-aware confirm in `handoffs.ts`. Confirm for returns is a separate function, `confirmReturn`, with Admin only (`atLeast(tier,'admin')`).
2. `confirmReturn` follows the same lock order as `confirmOnce` (member, room share, seat, device, handoff). The device UPDATE is `owner_id=null, seat_id=null, role='secondary', holding_note=null, holding_expires_on=null`. Stale-check that `d.owner_id = h.from_member_id`, as transfer does.
3. Start return: permission is the owner or Manager+ (reuse `canStartTransfer`; the ordering rule is permission first, then 422 `device_unowned`, then 409 `handoff_pending`). It takes the device `for update` before the pending check, as in transfer.
4. Admin take-back: `POST /api/devices/:id/take-back` or similar. Lock the device, require owned, and cancel any pending handoff (status 'cancelled', decided_by the admin) in the same transaction. Then clear the device and write one audit row. Work out the lock order for a placed device (seat and room) as in `confirmOnce`. Audit action `device.return_admin_take_back`, with `meta.byAdmin` and the former owner so history shows an Admin return.
5. Deactivate: inside `deactivateMember`, after the member lock and before the status update, run `update device_handoffs set status='cancelled', decided_by_id=<actor member id>, decided_at=now() where org_id=$1 and status='pending' and (from_member_id=$2 or to_member_id=$2)`. Write an audit row per handoff, or one with a count. If the actor has no member row, fall back to the target member id, so the decided_by check holds. Include handoffs in `DeactivationImpact` only if the UI wants a warning (optional, since R4 limits scope).
6. Lists and badge: add Admin queries `kind='return' and status='pending'` for the return list and count. Extend `HandoffCountDto` with `returns` (additive, safe). Route handler checks the Admin tier before any side effect (R7). Add the new routes under `/api/handoffs/*` and `/api/devices/:id/...`, with tier checks in the auth wrapper.
7. Tests: DB integration tests for confirm return of a placed primary device (owner, seat, role, note and expiry cleared), deactivation cancelling handoffs in both directions, and take-back with a pending handoff and on a deactivated owner. Unit tests for the return rules (R5). Check the deferred triggers at COMMIT.

**Risks**
- Regression risk in the shared state machine: `closeHandoff` and `listHandoffs` are currently kind-agnostic or recipient-based, so the kind branching must not change transfer behavior.
- Admin take-back racing with a pending transfer or a confirm: the device lock plus the handoff lock must be taken in the same order, or the deactivate/confirm paths can deadlock (A12 retry pattern).
- Audit action naming: the existing `device.transfer_*` actions are not reusable for returns. Choose names once, because the history UI may parse them.
- R7: no 401/403 after a write. Keep the Admin check in the wrapper, and return domain refusals as 409/422.

**Open questions**
1. Is there a member "remove" path (the ticket says deactivate/remove)? If not, the default is to implement deactivation only and note remove as out of scope.
2. Can an Admin who is also the owner confirm their own return? Default: yes, since only Admin status matters. Alternative: require a different Admin (separation of duty).
3. Does decline exist for returns? Default: no. Admin either confirms or leaves it pending, and the owner or Manager+ cancels.
4. Does take-back on a placed device need to prompt the Admin first (UI confirm dialog showing seat and note)? Default: yes, a confirm dialog only.
5. Should cancelled handoffs on deactivate also notify anyone (the other party)? Default: no notification, audit only.
