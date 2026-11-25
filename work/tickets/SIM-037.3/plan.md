Status: READY

# Plan — SIM-037.3: Transfer a device with recipient confirmation (slice 1 of 2: API, data and DTO)

This plan covers **slice 1** only (see `## Split proposal`): every server behaviour of the ticket (start, cancel,
decline, confirm, incoming list, incoming count, DTO fields, audit rows, error codes), the SIM-037.1 security
follow-ups, and only the UI edits the DTO and the closed error-code list force (fixtures, `src/ui/copy/api.ts`). The
Transfer dialog, incoming list, nav badge and pending chip go to slice 2 (new ticket SIM-037.8), as SIM-037.2 / 037.7.

**High path: yes — one file.** `db/migrations/20261125180000_handoff_decided_by.sql` matches `db/migrations/**` and
`**/*.sql`. The PR is High tier (Ming reviews it; never auto-merged). If Ming prefers a Medium PR, drop the migration
(A8): the app still sets `decided_by_id` on every decision and a DB test covers it. The ticket already has Gate
`plan-approval` (P1) and the security review trigger fires (`src/server/`, `db/`, `**/*.sql`).

## Scope summary
- `docs/spec-v1.md` §6 DEV-08 (lines 314-322):
  - "Any owner (every role) starts a transfer of their own device to another active member of the org, with an
    optional note. A Manager+ may start one for any owned device. A device has at most one pending handoff (transfer,
    return or extension)."
  - "Until the recipient confirms, nothing changes: the device stays with the sender and keeps its seat. The sender
    (or a Manager+) can cancel; the recipient can decline."
  - "When the recipient confirms receipt, in one transaction the device leaves its seat (if placed) and lands in the
    recipient's inventory, not placed; the recipient places it themselves. The expiry date carries over (OQ-43)."
  - "The recipient sees pending transfers to them (badge in the nav, list on the Devices page)." (slice 1: the list
    and count endpoints; the UI is slice 2)
- DEV-01 (line 279): "Only an Admin deletes a device, and only while it is in the org inventory with no pending handoff."
- DEV-02 (lines 284-285): "Every device list and device detail shows … any pending transfer or return." (DTO field)
- DEV-11 (lines 342-343): history lists "transfer (started, cancelled, declined, confirmed) … who did it, from and to
  member, when, note, expiry date, and who confirmed" (source of the audit meta).
- Spec §4 line 129 DeviceHandoff: "kind (transfer / return / extension), from member, to member (transfer), requested
  by, note, new expiry (extension), status (pending / confirmed / declined / cancelled), decided by, decided at".
- OQ-43 (spec line 638): "Default: the expiry date carries over to the recipient; an Admin or Manager can change it."
- Ticket scope: "Confirm in one transaction (lock order seat → device → handoff): re-check pending and owner unchanged,
  unplace (demote primary), set owner to the recipient, keep expiry; stale → 409." / "At most one pending handoff per
  device; a device with a pending handoff cannot be assigned or deleted." / "Audit rows for start, cancel, decline,
  confirm." / Technical notes: "R7: "not the recipient" is a domain refusal (409/422), not 403."
- `work/tickets/SIM-037.1/security-review.md` lines 44-49: "nothing requires `decided_by_id` null while pending.
  Tighten in SIM-037.3." / "The DB doesn't tie `from_member_id` to `devices.owner_id` … SIM-037.3 must check it under
  the device lock" / "insert handoffs under the device `FOR UPDATE` lock; check `from_member_id` is the current owner
  and `to_member_id` an active member of the same org."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A User can start a transfer of their own device but not of someone else's; a Manager+ can for any owned device. | `src/lib/devices/handoff-rules.test.ts › decideTransferStart` (user+owner ok; user+not owner → 422 `not_allowed`; manager/admin + not owner ok; unowned → 422 `device_unowned` (Manager) / `not_allowed` (User); recipient = owner → 422 `invalid_recipient`; recipient missing/inactive → 422 `member_not_assignable`; pending → 409 `handoff_pending`); `src/server/devices/handoffs.db.test.ts › start: owner (user) ok`, `› user on another's device → 422, no row, no audit`, `› manager on another's device ok, requested_by = manager, from = owner`, `› recipient from another org → 422 member_not_assignable`. |
| 2 | Until confirm, the device keeps owner and seat; only the recipient can confirm or decline; only the sender or a Manager+ can cancel. | `handoff-rules.test.ts › decideHandoffAction` matrix (confirm/decline: recipient ok, sender/manager/admin non-recipient → 422 `not_allowed`; cancel: from member ok, manager/admin ok, recipient-user and other user → 422 `not_allowed`; any action on non-pending → 409 `handoff_not_pending`); `handoffs.db.test.ts › start leaves owner_id, seat_id, role, holding unchanged`, `› placement while pending is allowed`, `› decline by recipient → declined, device unchanged`, `› cancel by sender and by manager`, `› confirm by a manager who is not the recipient → 422`; `src/app/api/handoffs/handoffs-routes.test.ts › no handler returns 401/403` (R7). |
| 3 | On confirm the device belongs to the recipient, is not at any seat, and the seat's primary rule still holds. | `handoffs.db.test.ts › confirm of a primary device: owner = recipient, seat_id null, role secondary, seat has no primary, holding_expires_on and holding_note unchanged`, `› confirm of an unplaced device`, `› confirm vs concurrent placement (two connections): no deadlock, final state consistent`; `› confirm writes one device.transfer_confirm row with fromSeatId, fromCode, demoted`. |
| 4 | A second pending handoff on the same device is refused; confirming a cancelled or stale handoff returns 409. | `handoffs.db.test.ts › second start → 409 handoff_pending`, `› raw insert of a second pending → 23505 mapped to handoff_pending` (`src/server/devices/pg-error.test.ts › device_handoffs_one_pending_idx`), `› confirm after cancel → 409 handoff_not_pending`, `› confirm vs concurrent cancel: exactly one wins, loser 409`, `› owner changed behind the handoff (direct UPDATE) → confirm 409 handoff_stale`, `› repeat confirm → 409 handoff_not_pending`; `src/server/devices/devices.db.test.ts › assign and delete refuse with a real pending transfer`. |
| 5 | The recipient's nav shows the number of pending incoming transfers. | Slice 1 delivers the count source: `handoffs.db.test.ts › count: incoming counts only pending to me in my org`; `handoffs-routes.test.ts › GET /api/handoffs/count → { incoming }`. The badge itself is slice 2 (SIM-037.8). |
| 6 | (037.1 follow-up) `decided_by_id` is null exactly while pending. | `scripts/schema-check.mjs` new check "10 pending handoff with decided_by_id refused (23514 device_handoffs_decided_by_check)" and "10 decided handoff without decided_by_id refused"; `pnpm migrate:smoke`; `handoffs.db.test.ts › every decision sets decided_by_id = actor`. |
| 7 | Each start, cancel, decline and confirm writes one audit row; a refusal writes none. | `handoffs.db.test.ts › audit rows` (actions `device.transfer_start/_cancel/_decline/_confirm`, meta keys as in Approach 7), `› refused actions write no audit row`. |
| 8 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` locally; `pnpm test:db` and `pnpm schema:check` green in CI (no local Docker, SIM-037.1 note). |

## Ming verification after merge
None for slice 1 (no visible UI change beyond error texts). The ticket's "Manual: transfer between two accounts" moves
to slice 2 (SIM-037.8).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261125180000_handoff_decided_by.sql` (new) | `device_handoffs_decided_by_check ((status = 'pending') = (decided_by_id is null))` added `not valid`, then `validate`. | 037.1 security follow-up (A8). | **Yes** |
| `scripts/schema-check.mjs` (lines 676-682, 731-751) | `insHandoff` sets `decided_by_id = from` when status is not pending; new checks for the CHECK in both directions. | Existing declined-insert at line 747 would fail the new CHECK; R2 verification. | No |
| `src/test/db/fixtures.ts` (lines 82-95) | `addHandoff` sets `decided_by_id = fromId` for non-pending; new `addTransfer(db, orgId, deviceId, fromId, toId)` helper. | New CHECK; transfer fixtures. | No |
| `src/lib/devices/types.ts` (lines 49-78) | `HandoffKind`, `HandoffStatus`, `HandoffStartValue`, `PendingHandoffDto`, `HandoffDto`, `HandoffListResponse`, `HandoffCountDto`; `DeviceDto` + `canTransfer`, `pendingHandoff`; fix the `canDelete` comment. | One contract for server and UI (A1). | No |
| `src/lib/devices/handoff-rules.ts` (new) | Pure `canStartTransfer`, `canCancelHandoff`, `decideTransferStart`, `decideHandoffAction` (see Approach 2). | Pure logic first; R7 order. | No |
| `src/lib/devices/handoff-rules.test.ts` (new) | State machine and permission matrix. | R5. | No |
| `src/lib/validate/device.ts` (after line 197) | `validateHandoffStart(body)` → `{ kind: "transfer", toMemberId, note }`; `validateHandoffBox(params)` → `"incoming"`. | Boundary validation. | No |
| `src/lib/validate/device.test.ts` | Cases for both validators. | R5. | No |
| `src/server/devices/tx.ts` (new) | Move `Abort`, `inTx`, `refuse`, `notFound`, `Refusal`, `Result`, `Db`, `actorMemberId` out of `devices.ts` (lines 32-70, 317-325); `import "server-only"`. | `handoffs.ts` needs them; avoids a 900-line `devices.ts`. | No |
| `src/server/devices/devices.ts` (lines 32-70, 74-148, 317-325, 545-593) | Import from `./tx` and re-export `Refusal`/`Result`/`Db`; `deviceRows` left-joins the pending handoff (+ to/requested-by/from members, all with `org_id`); `toDto` sets `canTransfer`, `pendingHandoff`, `canAssign`/`canDelete` false while pending; export `reload` for `handoffs.ts`. | DEV-02 pending state on rows; DTO flags. | No |
| `src/server/devices/handoffs.ts` (new) | `startTransfer`, `cancelHandoff`, `declineHandoff`, `confirmHandoff`, `listHandoffs`, `countHandoffs`; audit rows. | Ticket scope. | No |
| `src/server/devices/pg-error.ts` (lines 3-29) | `"handoff_pending"` in `DeviceConflictCode`; map 23505 `device_handoffs_one_pending_idx`. | Concurrent start backstop (else 500). | No |
| `src/server/devices/pg-error.test.ts` | Mapping case. | R5. | No |
| `src/server/devices/handoffs.db.test.ts` (new) | DB integration (see Tests). | Ticket test plan. | No |
| `src/server/devices/devices.db.test.ts` | Pending transfer → assign 409 / delete 409; DTO `pendingHandoff`, `canTransfer`, flags; `canDelete` false while pending. | Interplay. | No |
| `src/app/api/devices/[id]/handoffs/route.ts` (new) | `POST` start, copied from `assignment/route.ts` (lines 1-27). | Endpoint. | No |
| `src/app/api/handoffs/route.ts` (new) | `GET ?box=incoming`. | Endpoint. | No |
| `src/app/api/handoffs/count/route.ts` (new) | `GET` → `{ incoming }`. | Endpoint (badge source). | No |
| `src/app/api/handoffs/[id]/cancel/route.ts`, `…/decline/route.ts`, `…/confirm/route.ts` (new) | `POST`, copied from `src/app/api/requests/[id]/cancel/route.ts`. | Endpoints. | No |
| `src/app/api/handoffs/handoffs-routes.test.ts` (new) | UUID → 404, 503, bad body/query → 400, refusal mapping, no 403. | Route contract. | No |
| `src/app/api/devices/devices-routes.test.ts` | `POST /api/devices/:id/handoffs` cases. | Route contract. | No |
| `src/lib/api/error.ts` (lines 35-42) | Add `handoff_not_pending`, `handoff_stale`, `invalid_recipient`. | Closed code list. | No |
| `src/ui/copy/api.ts` (lines 43-48) | Messages for the three codes; reword `handoff_pending` to fit every action ("This device already has a pending transfer or return."). | `satisfies Record<ApiErrorCode, string>`. | No |
| DeviceDto literals in UI tests: `src/ui/devices/{device-actions,DevicesView,place-device,PlaceDeviceDialog,AssignDeviceDialog,DeleteDeviceDialog,devices-state,assign-device,device-form,delete-device-flow}.test.ts(x)` | Add `canTransfer: false, pendingHandoff: null` (only where a literal exists; `pnpm typecheck` finds them). | New required DTO fields. | No |

No file under `src/server/http/**`, `src/proxy.*`, config, Docker or deploy is touched.

## Data model / migration
`db/migrations/20261125180000_handoff_decided_by.sql`:
```sql
-- SIM-037.3: a handoff has a decider exactly when it is decided (SIM-037.1 security follow-up).
-- Expand-only: no shipped image writes device_handoffs yet, so the previous image is unaffected.
alter table device_handoffs add constraint device_handoffs_decided_by_check
  check ((status = 'pending') = (decided_by_id is null)) not valid;
alter table device_handoffs validate constraint device_handoffs_decided_by_check;
```
- No other schema change: table, partial unique `device_handoffs_one_pending_idx`, inbox index
  `device_handoffs_inbox_idx (org_id, to_member_id, created_at desc) where status = 'pending'` and the shape check
  already exist (`20261125120000_device_lifecycle.sql` lines 37-71).
- Validation risk: a dev database with a decided handoff that has no `decided_by_id` fails `validate`. No app code
  writes handoffs before this ticket; test/schema-check data lives in throwaway databases or rolled-back transactions.
  If a local dev DB fails, `pnpm seed:dev` on a fresh DB.
- Downgrade (manual, not shipped; forward-only rule): `alter table device_handoffs drop constraint
  device_handoffs_decided_by_check;`. The previous image (SIM-037.7) never writes handoffs, so running it on the new
  schema is safe; a pending transfer created by this image stays pending under the old image (it shows nothing, and
  its assign/delete still refuse with `handoff_pending`).
- A CHECK tying `from_member_id` to `devices.owner_id` cannot be expressed; enforced in the service under the device
  lock (start) and re-checked at confirm (`handoff_stale`).

## API contract
One contract, named **handoff** everywhere (DB table, codes, DTOs, routes); the UI says "transfer". `kind` makes every
route reusable by SIM-037.4 (`return`) and SIM-037.5 (`extension`: confirm = approve, decline = reject).

Every route: `withAuth(…, { tier: "user" })`; canonical UUID check on path ids (else 404 `not_found`); 503
`unavailable` without a pool; `readJson` + validator → 400 `invalid_request`; refusals via `apiError(status, code)`;
`Cache-Control: no-store`. 401/403 only from the wrapper (R7).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices/:id/handoffs` | `{ kind: "transfer", toMemberId: uuid, note?: string \| null }` (no other keys; note ≤ 500, NFC, trimmed, blank → null). Other kinds → 400 until 037.4/037.5. | 201 `HandoffDto` | 400 `invalid_request`; 404 `not_found` (device); 422 `not_allowed`, `device_unowned`, `invalid_recipient`, `member_not_assignable`; 409 `handoff_pending` | Owner, or Manager+ for any owned device |
| POST | `/api/handoffs/:id/cancel` | none | 200 `HandoffDto` | 404 `not_found`; 422 `not_allowed`; 409 `handoff_not_pending` | `from` member (the sender) or Manager+ |
| POST | `/api/handoffs/:id/decline` | none | 200 `HandoffDto` | 404; 422 `not_allowed`; 409 `handoff_not_pending` | Recipient (`to`) only |
| POST | `/api/handoffs/:id/confirm` | none | 200 `HandoffDto` | 404; 422 `not_allowed`, `member_not_assignable`; 409 `handoff_not_pending`, `handoff_stale`, `placement_changed` | Recipient only |
| GET | `/api/handoffs?box=incoming` | `box` required, only `incoming` now (037.4 adds `returns`, 037.5 `extensions`) | 200 `{ items: HandoffDto[], truncated: boolean }`, pending only, newest first, limit 100 | 400 | Any member (own inbox) |
| GET | `/api/handoffs/count` | none | 200 `{ incoming: number }` (037.4 adds `returns`, 037.5 `extensions`) | — | Any member |

Types (`src/lib/devices/types.ts`):
```ts
export type HandoffKind = "transfer" | "return" | "extension";
export type HandoffStatus = "pending" | "confirmed" | "declined" | "cancelled";
export type HandoffStartValue = { kind: "transfer"; toMemberId: string; note: string | null };
type MemberRef = { id: string; displayName: string };
export type HandoffDto = {
  id: string; kind: HandoffKind; status: HandoffStatus;
  device: { id: string; name: string; type: string; inventoryNumber: string; expiresOn: string | null };
  from: MemberRef; to: MemberRef | null; requestedBy: MemberRef; decidedBy: MemberRef | null;
  note: string | null; newExpiresOn: string | null; createdAt: string; decidedAt: string | null;
  canCancel: boolean; canConfirm: boolean; canDecline: boolean; // for the caller, false unless pending
};
export type PendingHandoffDto = {
  id: string; kind: HandoffKind; to: MemberRef | null; requestedBy: MemberRef; createdAt: string; canCancel: boolean;
};
export type HandoffListResponse = { items: HandoffDto[]; truncated: boolean };
export type HandoffCountDto = { incoming: number };
// DeviceDto gains:
//   canTransfer: boolean;                     // owned, no pending handoff, caller is owner or Manager+
//   pendingHandoff: PendingHandoffDto | null; // org-wide (DEV-02); the note is not on the device row (A11)
```
`device.expiresOn` in `HandoffDto` is read from the device (expiry carries over, OQ-43; not stored on the handoff).
While a handoff is pending: `canAssign` and `canDelete` are false, `canTransfer` false; `canPlace`, `canEdit`,
`canEditHolding` unchanged (A9).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/handoff-rules.test.ts › decideTransferStart` | Order: permission (`not_allowed`) → `device_unowned` → `invalid_recipient` → `member_not_assignable` → `handoff_pending`; user owner ok; user non-owner refused even on an unowned device; manager/admin ok on any owned device; actor without member id → `not_allowed`. |
| `handoff-rules.test.ts › decideHandoffAction` | Matrix for confirm/decline/cancel × caller (recipient, from member, manager, admin, other user, null member id) × status (pending vs confirmed/declined/cancelled → 409 `handoff_not_pending`, checked after permission). |
| `handoff-rules.test.ts › viewer flags` | `canCancel`/`canConfirm`/`canDecline` false when not pending; manager who is also recipient gets all three. |
| `src/lib/validate/device.test.ts › validateHandoffStart` | Valid; extra key; `kind` other than `transfer` refused; non-canonical uuid; note 500 ok / 501 refused; Vietnamese note NFC-normalised (`"Chuyển máy cho Hương"` decomposed in → composed out); blank/whitespace note → null; missing note → null. |
| `device.test.ts › validateHandoffBox` | `incoming` ok; missing, `outgoing`, repeated param refused. |
| `src/server/devices/pg-error.test.ts › device_handoffs_one_pending_idx → handoff_pending` | Backstop mapping. |
| `src/server/devices/handoffs.db.test.ts › start …` | Owner ok; non-owner user 422 no row; manager on another's device (requested_by = manager, from = owner); recipient = owner 422; inactive recipient 422; other-org recipient id 422; unowned 422; second start 409; device unchanged after start; one `device.transfer_start` audit row. |
| `handoffs.db.test.ts › cancel / decline …` | Sender cancels; manager cancels another's; recipient-user cancel 422; decline by recipient; decline by sender 422; after decision `decided_by_id` = actor, `decided_at` set; second cancel 409. |
| `handoffs.db.test.ts › confirm …` | Primary device at a seat → owner = recipient, seat null, role secondary, seat has no primary; unplaced device; holding note and expiry unchanged; non-recipient manager 422; after cancel 409 `handoff_not_pending`; owner changed directly → 409 `handoff_stale`; repeat confirm 409; audit meta includes `fromSeatId`, `fromCode`, `demoted`. |
| `handoffs.db.test.ts › concurrency` | Two connections: confirm vs place onto another seat (no deadlock, final state valid: either moved-then-unplaced or 409 `placement_changed` after one retry); confirm vs cancel (one 200, one 409); two concurrent starts (one 201, one 409 via lock or 23505 map). |
| `handoffs.db.test.ts › list and count` | Incoming lists only pending to me, newest first, other-org rows never returned (R6); count matches; decided rows excluded. |
| `src/server/devices/devices.db.test.ts › pending transfer` | `pendingHandoff` on the DTO with `to`, `requestedBy`, `canCancel` per viewer; `canTransfer`/`canAssign`/`canDelete` false while pending; assign and delete refuse 409 `handoff_pending` with a real transfer. |
| `src/app/api/handoffs/handoffs-routes.test.ts` | Each route: bad uuid → 404; no pool → 503; bad body/query → 400; service refusal mapped to its status; no 401/403 emitted by handlers. |
| `src/app/api/devices/devices-routes.test.ts › POST handoffs` | 201 on ok; 400 on bad body; refusal mapping. |
| `scripts/schema-check.mjs` (via `pnpm schema:check`) | New CHECK both directions; existing handoff checks still pass with `decided_by_id`. |

## Approach
1. **Migration and test data.** Add the migration; update `scripts/schema-check.mjs` `insHandoff` and
   `src/test/db/fixtures.ts` `addHandoff` so decided rows carry `decided_by_id`; add `addTransfer`. R2 met (forward-only,
   expand: `not valid` + `validate`).
2. **Pure rules (`src/lib/devices/handoff-rules.ts`).**
   - `canStartTransfer(tier, isOwner) = isOwner || atLeast(tier, "manager")` (same shape as `canPlace`, rules.ts:5).
   - `canCancelHandoff(tier, isFrom) = isFrom || atLeast(tier, "manager")` (sender = `from_member_id`; a Manager who
     started it is Manager+ anyway, A3).
   - `decideTransferStart({ tier, actorMemberId, ownerId, toMemberId, recipientActive, pending })` in the order above.
   - `decideHandoffAction({ action, tier, actorMemberId, fromId, toId, status })`: permission first (confirm/decline:
     `actorMemberId === toId`; cancel: `canCancelHandoff`), then `status !== "pending"` → 409 `handoff_not_pending`.
     Null actor member id → 422 `not_allowed` (the write needs `decided_by_id`, A10).
3. **Validators** in `src/lib/validate/device.ts`, reusing `noteText` (line 102) and `isCanonicalUuid`.
4. **Refactor** `Abort`/`inTx`/`refuse`/`notFound`/`Refusal`/`Result`/`Db`/`actorMemberId` into
   `src/server/devices/tx.ts`; `devices.ts` imports and re-exports the types so routes and tests keep compiling. Extend
   `Refusal.code` with `handoff_not_pending | handoff_stale | invalid_recipient`. No behaviour change (existing tests
   prove it).
5. **DTO.** In `deviceRows` (devices.ts:124-148) add
   `left join device_handoffs h on h.org_id = d.org_id and h.device_id = d.id and h.status = 'pending'` (at most one by
   the partial unique index), `left join members ht on ht.org_id = h.org_id and ht.id = h.to_member_id`,
   `left join members hr on hr.org_id = h.org_id and hr.id = h.requested_by_id`,
   `left join members hf on hf.org_id = h.org_id and hf.id = h.from_member_id` and select `coalesce(hf.sub = $2::uuid,
   false) as handoff_from_me`. `toDto` builds `pendingHandoff` and the flags; `canCancel` uses `canCancelHandoff`.
   Every join repeats `org_id` (R6).
6. **Service (`src/server/devices/handoffs.ts`, `import "server-only"`).** All queries through `orgQuery` (R6); tier
   comes from the verified token (`ctx.tier`), roles from `org_roles` via the wrapper.
   - **start:** in `inTx`: actor member id; recipient `select id, status from members … for share`; device
     `select owner_id, inventory_number, holding_expires_on from devices … for update`; pending read under that lock
     (closes the 037.1 follow-up "insert handoffs under the device `FOR UPDATE` lock"); `decideTransferStart`; insert
     with `from_member_id = owner_id` read under the lock, `to_member_id`, `requested_by_id = actor`, `note`; audit;
     return the `HandoffDto`. Lock order member → device, as `assignDevice` (devices.ts:427-454) and `deactivateMember`.
   - **cancel / decline:** read the handoff (404 if missing in org); `decideHandoffAction` on that read; then
     `select … from device_handoffs … for update`, re-run the decision on the locked row; `update device_handoffs set
     status = 'cancelled' | 'declined', decided_by_id = $actor, decided_at = now(), updated_at = now()`; audit. Only the
     handoff row is locked (no device change).
   - **confirm:** (1) read the handoff unlocked (404 if missing), permission via `decideHandoffAction` (recipient only)
     before any lock; (2) recipient member `for share`; (3) device `seat_id` unlocked; (4) its room `for share`, its seat
     `for update` (as `placeDevice`, devices.ts:225-249); (5) device `for update`; (6) handoff `for update`; (7) re-check:
     status pending (409 `handoff_not_pending`), `device.owner_id = from_member_id` (409 `handoff_stale`), recipient
     still active (422 `member_not_assignable`), device seat equals step 3 (else retry the whole transaction once, then
     409 `placement_changed`, A12). Then one `update devices set owner_id = $to, seat_id = null, role = 'secondary',
     updated_at = now()` (holding note and expiry untouched, OQ-43) and the handoff update to `confirmed` with
     `decided_by_id`; audit. Global lock order member → rooms → seats → device → handoff matches `deactivateMember`
     (manage.ts:333-360) and `placeDevice`, so no new deadlock cycle. The deferred owner/primary trigger sees seat null
     at COMMIT.
   - **list / count:** `where h.org_id = $1 and h.to_member_id = $me and h.status = 'pending'` on the inbox index;
     limit 101 → `truncated`. A caller with no member row gets an empty list / 0.
7. **Audit** (`writeAudit`, `entity: "device"`, `entityId` = device id): `device.transfer_start` meta `{ handoffId,
   fromMemberId, toMemberId, inventoryNumber, note }`; `device.transfer_cancel` / `device.transfer_decline` `{
   handoffId, fromMemberId, toMemberId, inventoryNumber, byManager }` (`byManager` = actor is neither from nor to);
   `device.transfer_confirm` `{ handoffId, fromMemberId, toMemberId, inventoryNumber, expiresOn, fromSeatId,
   fromCode, demoted }`. No tokens or PII beyond member ids and the note (same as `device.assign`).
8. **Routes** (6 files) copied from `assignment/route.ts` and `requests/[id]/cancel/route.ts`; GET routes read
   `new URL(req.url).searchParams`.
9. **pg-error, error codes, copy, fixtures.** Then run every check.

Rules: R1 (routes only import `src/server/**`; `handoff-rules.ts` and validators are `src/lib`, pure; `pnpm
check:layers`); R2 (migration above); R3 (no config); R4 (only these files; slice 2 items stay out); R5 (tests above);
R6 (every query and join scoped by `org_id` from the token); R7 (all permission refusals are 422 `not_allowed` from
the service, computed before any write; no handler returns 401/403).

## Specialist input used
- api-platform-engineer:
  - Adopted: handoff-id routes for cancel/decline/confirm (stale id → 409, never acts on a newer handoff); permission
    matrix; 422 `not_allowed` for non-parties (open question 3); lock order and re-checks (§3) incl. `handoff_stale`;
    expiry and `holding_note` untouched on confirm (§4, OQ-43); `handoff_pending` 23505 mapping; `decided_by_id`
    CHECK (§6); audit names and meta (§7); DTO fields `pendingHandoff`, `canTransfer`, viewer flags; general
    `/api/handoffs/count` → `{ incoming }`; test list (§9).
  - Changed: start is `POST /api/devices/:id/handoffs` with a `kind` discriminator instead of `/transfer`, so
    SIM-037.4/037.5 add kinds, not routes; body key `toMemberId`. List keeps only `box=incoming` (outgoing is visible on
    the device row via `pendingHandoff`). Recipient deactivated at confirm reuses 422 `member_not_assignable` instead of a
    new `recipient_not_active` (the wrapper already blocks a deactivated caller; only a race reaches it, A4).
    Placement race at confirm retries once before 409 (A12).
  - Deferred: `deactivateMember` cancelling pending handoffs → SIM-037.4, whose ticket scope says "Member
    deactivate/remove cancels pending handoffs to or from that member" (A5). Manager+ org-wide handoff list → 037.4.
- frontend-developer:
  - Adopted for the contract: `canTransfer` and a server-computed cancel flag (as `pendingHandoff.canCancel`) on
    `DeviceDto`; separate inbox endpoint rather than filtering the device list; `canAssign`/`canDelete` false while
    pending.
  - Changed: names `pendingHandoff` / `/api/handoffs` (not `pendingTransfer` / `/api/transfers`) to stay general for
    returns and extensions; a dedicated `/api/handoffs/count` instead of `limit=1` on the list (cheaper, extensible);
    `canPlace` stays true while pending (DEV-08: the device keeps its seat and may still be moved; A9).
  - Everything UI (dialog, `NoteField` split, picker label, incoming list, badge provider, chip, copy, focus) goes to
    slice 2 unchanged.

## Assumptions
For Ming to approve with the plan (defaults from the consults unless noted):
- **A1 Contract.** "Handoff" naming in API and DTOs; routes and types as in `## API contract`; UI wording says
  "transfer".
- **A2 Non-party callers** get 422 `not_allowed` on every handoff action (device data is org-wide readable anyway);
  unknown or other-org handoff id → 404 `not_found`.
- **A3 Cancel** = the `from` member (sender/owner) or Manager+. A User who is only the recipient cannot cancel (they
  decline).
- **A4 Recipient deactivated before confirm** → 422 `member_not_assignable` (consultant proposed 409
  `recipient_not_active`).
- **A5 Deactivation cleanup** is SIM-037.4 (its scope). Until then a pending transfer to/from a deactivated member stays
  pending; the sender or a Manager+ can cancel it.
- **A6 Note and expiry.** The transfer note lives only on the handoff row and in audit; `holding_note` and
  `holding_expires_on` are unchanged on confirm (OQ-43).
- **A7 Repeat confirm** → 409 `handoff_not_pending` (not an idempotent 200).
- **A8 `decided_by_id` CHECK migration** ships in this slice → PR is **High tier**. Alternative: drop it (PR becomes
  Medium) and file a `debt` issue.
- **A9 While pending:** placing/moving/returning to the owner's inventory and editing fields/holding stay allowed;
  assign, delete and a second handoff are refused.
- **A10 Member id required.** A caller with no member row in the org cannot start, cancel, decline or confirm (422
  `not_allowed`), because `requested_by_id` / `decided_by_id` need one. A Manager+ may start a transfer to themselves.
- **A11 Visibility.** `pendingHandoff` (recipient name, requester, created at) is on every device row for every member
  (DEV-02); the note is shown only in the handoff inbox.
- **A12 Placement race on confirm:** one internal retry, then 409 `placement_changed`.
- **A13 Hotspots.** BUG-001 (state DONE, not merged) edits `src/server/devices/devices.ts`, `src/lib/devices/rules.ts`
  and `src/server/devices/devices.db.test.ts` (BUG-001 plan lines 12-31); expect a rebase. SIM-037.4/037.5 will extend
  `handoffs.ts`, `handoff-rules.ts` and the count DTO.
- **A14 Badge freshness** (slice 2): count refreshes on navigation, focus and visibility, no polling (D24).

## Blocking questions
None.

## Split proposal
The full ticket is roughly 850-950 changed production lines plus tests (server ~450: `handoffs.ts` ~280, 6 routes ~130,
rules/validators/types/DTO ~140; UI ~400), more than one implement/review cycle. Split as SIM-037.2 / SIM-037.7:

- **Slice 1 — SIM-037.3 (this plan):** API, migration and DTO. Estimate ~450 production lines (+~40 moved in the
  `tx.ts` refactor) and ~550 test lines. Delivers ticket AC 1-4 server-side and the count source for AC 5. High tier
  (migration).
- **Slice 2 — new ticket SIM-037.8 "Devices UI: transfer dialog, incoming transfers and nav badge"** (depends on
  SIM-037.3; Areas ui, ux; P1; Size M; Gate none unless Ming wants plan approval; Medium tier). Scope from the frontend
  consult §2-9: `TransferDeviceDialog.tsx` + pure `transfer-device.ts` (`toTransferBody` → `{ kind: "transfer",
  toMemberId, note }`, `settleTransfer`); shared `NoteField` split out of `AssignDeviceFields`; `MemberPickerFields`
  optional disabled-option label (not "sits here"); row actions "Transfer" (`canTransfer`) and "Cancel transfer"
  (`pendingHandoff.canCancel`, direct button with busy state); pending chip "Transfer pending · To <name>" in
  `OwnerLabel` (both layouts); `IncomingTransfers.tsx` section above the filters with Confirm/Decline, `useIncomingTransfers`;
  `useHandoffBadge` + provider in `AppShell` (`badges.devices`), per-nav sr-only text in `src/ui/copy/shell.ts`;
  `devices-api` methods for the six endpoints; copy in `src/ui/copy/devices.ts`; tests. Acceptance: ticket AC 2 and
  AC 5 UI parts, and Ming's manual "transfer between two accounts".
