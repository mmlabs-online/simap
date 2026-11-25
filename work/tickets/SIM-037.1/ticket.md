# SIM-037.1: Device lifecycle schema and unowned devices

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | db, api, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T02:38:50Z |
| PR | — |

## Goal
Devices can exist without an owner in the org inventory, and the schema holds everything the lifecycle needs (new fields, holding note and expiry, handoffs), so later slices only add behaviour.

## Scope reference
docs/spec-v1.md §4 Device and DeviceHandoff, §5 invariant 5, §6 DEV-01 (create, fields, delete), DEV-02, DEV-03 (unowned never placed); D63; OQ-41 (Admin-only create), OQ-45 (existing rows keep their owner).

## Scope
- Forward-only expand migration: `devices.owner_id` nullable; `serial`, `manufacturer`, `brand` (nullable, non-blank, at most 100 chars; serial unique per org when set); `holding_note`, `holding_expires_on` (date) nullable; CHECK owner_id is not null or seat_id is null (NOT VALID then VALIDATE); `device_handoffs` table (kind transfer/return/extension, from/to member, requested by, note, new expiry, status, decided by/at, composite org FKs, partial unique pending per device, index for the recipient inbox).
- Create: only an Admin creates a device; it has no owner (org inventory). Delete: only an Admin, only for an unowned device with no pending handoff (D31 guard for placed devices stays).
- Reads handle a null owner: device list/DTOs, search, CSV export, seat detail, room layout `seatDevices` (inner joins on owner become left joins).
- Placement refuses an unowned device with a 422 domain code; the owner is read under the device lock (comment at `src/server/devices/devices.ts:194`).
- UI: create dialog drops the owner picker for Admins and is hidden from Users/Managers; owner shows as "Org inventory" when empty; Devices page filter gains "org inventory".

## Out of scope
- Assign, transfer, return, overdue, history (SIM-037.2 to SIM-037.6).
- New fields in dialogs (SIM-037.2).

## Acceptance criteria
- [ ] `pnpm migrate` on a DB with existing devices succeeds; every existing device keeps its owner; `pnpm schema:check` passes.
- [ ] POST a device as Admin creates it with `owner: null`; as Manager or User the call is refused.
- [ ] Placing an unowned device at any seat is refused by the API (422) and by the DB check.
- [ ] Device list, search, CSV export, seat detail and room layout return unowned devices with an empty owner instead of dropping them.
- [ ] Deleting an owned device, or one with a pending handoff, is refused; deleting an unowned unplaced device works.

## Technical notes
- Files: see plan.
- Risks / open questions: Architect consult (2026-11-25): owner nullable, plain CHECK as the DB guard, `device_handoffs` with partial unique pending; inner joins in devices.ts:121, search.ts:119, export.ts:70, seats.ts:124. High path (db/migrations) → plan approval.

## Test plan
- DB integration: migration on seeded data, check constraint, partial unique index. Unit: placement rule for unowned, create/delete permission. Manual: create a device as Admin, see it in org inventory.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".

Plan approved (2026-11-25, Ming: "ok") with assumptions A1-A12 as written.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 4 (software-architect×1 at /idea ~27k, database-optimizer×1 ~43k, api-platform-engineer×1 ~50k, planner×1 ~105k; default models).
- Done: consult files (architect, database-optimizer, api-platform-engineer); plan.md READY with assumptions A1-A12.
- In progress / next: Ming approves plan (M-51), then IMPLEMENT.
- Gotchas: CHECK `devices_unowned_not_placed_check` is immediate while invariant-3 triggers are deferred: unplace before (or in the same UPDATE as) nulling the owner. AC 4 reworded in plan (A1).
