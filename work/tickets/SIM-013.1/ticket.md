# SIM-013.1: Device create, edit and delete API

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-013 |
| Needs Ming | M-33 |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/59 |

## Goal
Slice 2 of 4 of SIM-013 (Devices): members create, edit and delete devices through the API, with MAC normalisation and the D31 delete rule.

## Scope reference
spec DEV-01, DEV-02; D19, D31, D37. Split out of SIM-013 by its approved plan (`work/tickets/SIM-013/plan.md` → Split proposal).

## Scope
- `POST /api/devices`: any member creates for their own member; Admin for any member (`canCreateFor` from SIM-013); `member_not_assignable` for an inactive owner. Created in inventory.
- `PATCH /api/devices/[id]`: owner or Admin; `ownerId` in the body is 400 (owner cannot change).
- `DELETE /api/devices/[id]`: owner or Admin; 409 `device_placed` while the device is at a seat (D31).
- MAC normalisation in `src/lib/validate/device.ts` (accepts `-`, `:`, `.` forms and mixed case; stores lowercase colon form; blank → null); length caps on name, type and inventory number.
- 23505 → 409 `inventory_number_taken` / `mac_taken`.

## Out of scope
- Any UI (SIM-013.2, SIM-013.3). Bulk import.

## Acceptance criteria
- [ ] Deleting a placed device is refused (409 `device_placed`) until it is in inventory.
- [ ] A User or Manager creates, edits and deletes only their own devices; an Admin can do this for any member.
- [ ] Different spellings of one MAC are stored the same way, and a duplicate MAC or inventory number is a 409, not a 500.
- [ ] Unit and DB tests cover the permission matrix, the MAC normaliser and the D31 refusal.

## Technical notes
- Builds on `src/lib/devices/*`, `src/server/devices/*` and `src/app/api/devices/**` from SIM-013.
- Refusals are 409/422 from the service, never 401/403 (R7).

## Test plan
- Unit: validator and MAC normaliser, permission rules.
- DB (CI): create/edit/delete, uniqueness, D31.

## Notes / answers from Ming
- 2026-11-24: Plan approved (all defaults, assumptions 1-8; Ming: "duyệt plan SIM-013.1, chạy luôn").

## Handoff

### 2026-11-24 — claude — BLOCKED (plan approval)
- Agent calls: 2, tokens ~120k total (api-platform-engineer×1 inherit 38k, planner×1 inherit ~80k; in/out split not reported)
- Done: consult saved; plan.md READY, one slice (create/edit/delete API, MAC normaliser, 3 new codes; no migration, no High path).
- In progress / next: Ming approves (M-33), then implement.
- Gotchas: plan departs from the consult on audit meta (codes and ids only, per `src/server/audit/write.ts:6`). Constraint names confirmed in the init migration (`devices_org_inventory_number_key`, `devices_org_mac_key`).

### 2026-11-24 — claude — DONE
- Agent calls: 3 this run (implementer×1 inherit 93k, reviewer×1 inherit ~60k, security-ai-generated-code-auditor×1 inherit 47k; in/out split not reported); 5 in total for the ticket (~320k).
- Done: create/edit/delete API, MAC normaliser, 3 codes; review PASS on attempt 1 with CI `pnpm test:db` green (devices.db.test.ts 19/19); security no 🔴/🟡. PR #59 (opened as draft early so CI could run test:db during review, now ready).
- In progress / next: Ming merges PR #59. Then SIM-013.2 (Devices page UI).
- Gotchas: CI runs only on pull requests, so a draft PR is the way to get `pnpm test:db` before review ends. SIM-013.2 needs a device-specific message for `member_not_assignable`.
