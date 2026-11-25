# Consult — api-platform-engineer (2026-11-25)

SIM-037.3 consult (read-only). Read the ticket, spec DEV-08, the migration, SIM-037.1's security-review.md, `devices.ts`, `rules.ts`, `pg-error.ts`, `manage.ts` (deactivateMember), the assignment route and `useRequestBadge`. Nothing run.

## Findings (state of the code)
- `device_handoffs` exists with kind/status/shape checks. Transfer shape: `to_member_id` not null, differs from `from_member_id`, `new_expires_on` null. Partial unique index one pending per device; inbox index `(org_id, to_member_id, created_at desc) where pending`.
- The DB does not require `decided_by_id` null while pending, and cannot tie `from_member_id` to `devices.owner_id`; the 037.1 security review hands both to this ticket.
- `assignDevice` and `deleteDevice` already refuse with 409 `handoff_pending`; the pending read is under the device `FOR UPDATE` lock; delete comment: "handoffs must be inserted under the same lock (SIM-037.3)".
- `placeDevice` does not look at handoffs — correct per DEV-08 (device keeps its seat until confirm).
- Lock orders: `placeDevice` rooms for share, seats for update (ascending id), then device (reads the seat unlocked first, re-checks under lock, 409 `placement_changed` if moved); `deactivateMember` member, rooms, seats, devices; `assignDevice` member for share, then device.
- Refusal style: `Refusal` status 404/409/422; permission refusals 422 `not_allowed` before the transaction or any write; routes `{ tier: "user" }`, so 401/403 only from the wrapper.
- Nav badge: provider + hook, refresh on route change and focus, no polling (D24); existing badge counts the user's own decided requests.
- Demote-on-leave exists in `manage.ts`; unplace = `seat_id = null, role = 'secondary'`.

## Recommendations

### 1. Endpoints and shapes
Prelude for every route: canonical UUID check, 503 without a pool, `readJson`, validator in `src/lib/validate/device.ts`.

| Method and path | Body | Returns |
|---|---|---|
| `POST /api/devices/:id/transfer` | `{ toMemberId, note?: string\|null }` | 200 `HandoffDto`; device DTO also carries `pendingHandoff` |
| `POST /api/handoffs/:hid/cancel` | none | 200 `HandoffDto` |
| `POST /api/handoffs/:hid/decline` | none | 200 `HandoffDto` |
| `POST /api/handoffs/:hid/confirm` | none | 200 `HandoffDto`; UI reloads the device |
| `GET /api/handoffs?direction=incoming\|outgoing` | none | `{ items: HandoffDto[], truncated }` |
| `GET /api/handoffs/count` | none | `{ incoming: number }` |

- Handoff-id routes for cancel/decline/confirm make the stale check explicit: a stale or cancelled id gives 409 rather than acting on a newer handoff.
- `HandoffDto`: `id`, `kind` (`"transfer"`), `status`, `createdAt`, `decidedAt`, `note`; `device: { id, name, type, inventoryNumber }`; `from`, `to`, `requestedBy: { id, displayName }`; `decidedBy | null`; `holding: { expiresOn, overdue? }` read from the device (expiry carries over, not stored on the handoff); per-viewer flags `canCancel`, `canConfirm`, `canDecline`.
- `DeviceDto` gains `pendingHandoff: { id, kind, toMemberId, toDisplayName, requestedByName } | null` and `canTransfer` (owner or Manager+, owned, no pending handoff); set `canAssign`/`canPlace` correctly while pending; `canDelete` stays unowned-only. Left join on the pending handoff in `deviceRows`, keeping `org_id` in the join (R6).
- Counts: `incoming` = recipient's pending count (`select count(*)` on the inbox index). Separate hook `useTransferBadge` modelled on `useRequestBadge`; do not reuse the request-badge context. Name it generally: `/api/handoffs/count` → `{ incoming }` now, SIM-037.4 adds `{ returns }`.
- List scope: `incoming` = `to_member_id = me`; `outgoing` = `requested_by_id = me OR from_member_id = me`; optional Manager+ `scope=org` (defer). Limit + truncated flag. Pending only (history is DEV-11).
- Resolve the caller's member id from `sub` (`actorMemberId`) in every handler; null → 422 `not_allowed` for start and recipient-only actions.

### 2. Permission matrix
All refusals domain 422 `not_allowed`, before any write and before locks where possible (R7).

| Action | Who | Non-permission cases |
|---|---|---|
| start | owner, or Manager+ for any owned device | unowned → `device_unowned`; recipient = owner → 422 `invalid_recipient`; recipient missing/inactive → 422 `member_not_assignable` |
| cancel | `requested_by` (sender), the `from` member, or Manager+ | |
| decline | recipient only | |
| confirm | recipient only | |

- A Manager who is not the recipient gets 422 `not_allowed` on confirm and decline.
- Pure functions in `src/lib/devices/rules.ts`, tested as a state machine: `canStartTransfer(tier, isOwner)`, `canCancelHandoff(tier, isSender)`, `isRecipient`, `decideHandoff(action, handoff, actorMemberId, tier)`.
- Order for decide actions: either non-parties get 404 (no existence leak), else apply the matrix; or 422 `not_allowed` for everyone. Pick one and state it.
- Permission check from the first non-locking read; final re-check under the lock.

### 3. Lock order and re-checks
Match the global order (member first, as `deactivateMember` and `assignDevice`).
- Start: recipient member for share → device for update → check pending → insert handoff. No seat lock.
- Confirm: (1) read handoff unlocked (`device_id`, `to_member_id`, status); (2) lock recipient member `FOR SHARE`; (3) read the device's seat unlocked; (4) rooms for share, seats for update (ascending id), as `placeDevice`; (5) device `FOR UPDATE`; (6) handoff `FOR UPDATE`; (7) re-check under lock; seat differs from step 3 → 409 `placement_changed` (or loop once).
- Re-checks on confirm: status pending else 409 `handoff_not_pending`; device owner = `from_member_id` else 409 `handoff_stale` (refuse, leave the row; cleanup optional); recipient still active else 409 `recipient_not_active` (preferred over 422, a state change since start); caller is recipient (re-evaluated by member id).
- One transaction: `update devices set owner_id = $to, seat_id = null, role = 'secondary', updated_at = now()` (holding untouched); `update device_handoffs set status = 'confirmed', decided_by_id = $me, decided_at = now(), updated_at = now()`. Deferred triggers fire at COMMIT; final state passes. Single UPDATE for unplace + demote. Partial unique primary index not violated.

### 4. Holding note and expiry on transfer
- Expiry carries over: do not touch `holding_expires_on` (OQ-43).
- `holding_note` unchanged by default; the transfer note lives only on the handoff row and in audit; Admin/Manager can edit via `updateHolding`.

### 5. Concurrency and stale codes
New codes (add to `Refusal.code`, `src/lib/api/error.ts`, `src/ui/copy/api.ts`):

| Code | Status | Used for |
|---|---|---|
| `handoff_pending` | 409 | second transfer on a device with one; map unique violation `device_handoffs_one_pending_idx` (23505) in `pg-error.ts` |
| `handoff_not_pending` | 409 | confirm/cancel/decline on a decided or cancelled handoff |
| `handoff_stale` | 409 | owner is no longer `from_member_id` |
| `recipient_not_active` | 409 | recipient deactivated since start |
| `device_unowned` | 422 | start on an unowned device |
| `invalid_recipient` | 422 | recipient is the owner |
| `member_not_assignable` | 422 | recipient missing or inactive at start |
| `not_found` | 404 | unknown handoff or device id |

- Cancel vs confirm: serialised by the handoff row lock; loser gets 409.
- Place vs confirm: serialised by seat + device locks; confirm unplaces whatever the state; a place after confirm sees a different owner → 422 `not_allowed` or 409 `placement_changed`.
- Repeat confirm after success → 409 `handoff_not_pending` (idempotent 200 optional; `apiFetch` retries only on 401/403).

### 6. decided_by_id rule
- New expand-only migration CHECK (`not valid` then validate): `(status = 'pending') = (decided_by_id is null)`.
- Set `decided_by_id` to the actor on confirm, decline and cancel (the canceller may be sender or Manager).
- Null actor member id must be refused before the write (else 23514).
- A CHECK tying `requested_by_id` to `from_member_id` cannot be expressed: skip.

### 7. Audit rows
`writeAudit` in the transaction, `entity: "device"`, `entityId` = device id. Actions `device.transfer_start`, `device.transfer_cancel`, `device.transfer_decline`, `device.transfer_confirm`. Meta `handoffId`, `fromMemberId`, `toMemberId`, `inventoryNumber`, `note`, plus expiry for confirm; confirm also `fromSeatId`, `fromCode`, `demoted`; cancel/decline `byManager` if the actor is not the sender.

### 8. Interplay
- `assignDevice`/`deleteDevice` already refuse while pending (order `device_owned` then `handoff_pending`).
- Placement while pending allowed; confirm unplaces whatever the state is then.
- `updateDevice`/`updateHolding` allowed while pending; confirm carries the current expiry.
- Member deactivation gap: pending handoffs to/from a deactivated member get stuck. Recommendation: `deactivateMember` cancels pending handoffs to or from the member (`cancelled`, `decided_by_id` = actor, `decided_at`), count in audit meta, like pending seat requests; handoffs last in the lock order. If out of scope → debt issue.
- `impactOf` may report pending handoffs (optional). Room/seat delete and demote paths do not touch ownership. Reactivation does not revive cancelled handoffs.
- 037.1 security follow-ups: insert under the device `FOR UPDATE` lock; check `from_member_id` = current owner and recipient active and same org; tighten `decided_by_id`; keep `owner_id !== null` guards; downgrade note: the previous image knows nothing about handoffs.

### 9. Tests
- `src/lib/devices/rules.test.ts`: state machine and permissions.
- `src/server/devices/devices.test.ts`: start refusals before any query; confirm re-check cases.
- `src/server/devices/devices.db.test.ts` (`pnpm test:db`): confirm vs concurrent placement (two connections, deadlock check); confirm vs concurrent cancel; confirm of a primary ends unplaced and secondary, seat has no primary; second pending → 409 `handoff_pending` incl. raw unique-violation mapping; owner changed (direct UPDATE) → `handoff_stale`; recipient deactivated → 409; delete/assign refuse while pending with a real transfer; `decided_by_id` check.
- Route tests: UUID validation, 400 bad bodies, 422 mapping, no 403 from handlers.
- `pnpm migrate:smoke`, `pnpm schema:check` for the new CHECK.
- UI tests for the dialog, incoming list, badge hook; DTO fixtures need `pendingHandoff: null`, `canTransfer`; `src/test/db/fixtures.ts` handoff insert helper.

## Risks
- Deadlocks if confirm locks in a different order: member (share), rooms (share), seats, device, handoff; test with real concurrency.
- Stuck pending handoffs on member deactivation; stale nav counts.
- Permission checks after locks/writes would violate R7.
- 404 vs 422 for non-parties must be decided and tested consistently on every handoff route.
- Manager+ start: sender (`requested_by`) may differ from owner; display and cancel rights must include both.
- Badge eventually consistent (D24).
- The new CHECK is a migration (R2, High tier): plan gate and Ming's PR review.

## Open questions (defaults)
1. Routes: handoff-scoped for cancel/decline/confirm, device-scoped for start.
2. Transfer note replaces `holding_note` on confirm? Default no.
3. Non-party callers: 422 `not_allowed` (device list is org-wide readable anyway).
4. Recipient deactivated at confirm: 409 `recipient_not_active`.
5. `deactivateMember` auto-cancels pending handoffs in this ticket? Default yes, same transaction, count in audit meta; else a `debt` issue.
6. Repeat confirm: 409 `handoff_not_pending`.
7. Nav badge: separate, on Devices.
8. Manager+ list of all org handoffs: defer to SIM-037.4.

Files referenced: `src/server/devices/devices.ts`, `src/server/devices/pg-error.ts`, `src/lib/devices/rules.ts`, `src/lib/devices/types.ts`, `src/server/members/manage.ts`, `src/app/api/devices/[id]/assignment/route.ts`, `src/ui/requests/useRequestBadge.tsx`, `db/migrations/20261125120000_device_lifecycle.sql`, `work/tickets/SIM-037.1/security-review.md`, `docs/spec-v1.md` (DEV-08).
