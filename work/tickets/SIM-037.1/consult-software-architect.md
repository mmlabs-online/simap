# Consult — software-architect (2026-11-25, given at /idea for the whole device lifecycle, SIM-037.x)

**Findings**
- `devices.owner_id` NOT NULL + FK to members, indexed (`db/migrations/20261120150000_init.sql:113-139`); invariant 3 enforced by deferred triggers on devices + seats (lines 223-271).
- `placeDevice` reads `owner_id` without a lock, relying on immutability (`src/server/devices/devices.ts:194` comment says a transfer must re-read under the device lock).
- Inner `join members ... d.owner_id` would drop unowned devices: `src/server/devices/devices.ts:121`, `src/server/search/search.ts:119`, `src/server/export/export.ts:70`, `src/server/seats/seats.ts:124`.
- Member deactivation unplaces by `owner_id` (`src/server/members/manage.ts:116-124, 298-396`). audit_log already has `(org_id, entity, entity_id, created_at)` index.

**Recommended model**
- `devices`: `owner_id` nullable; add `serial`, `manufacturer`, `brand` (nullable, check `btrim <> ''`); `assignment_note`, `assignment_expires_at timestamptz null`; check `devices_unowned_unplaced_check (owner_id is not null or seat_id is null)` — the DB guard, plain CHECK, no trigger.
- `device_handoffs(id, org_id, device_id, kind ('transfer'|'return'), from_id, to_id null, status ('pending'|'confirmed'|'rejected'|'cancelled'), note, created_at, decided_by_id, decided_at)`, composite FKs `(org_id, …)` like `seat_requests`, partial unique `(org_id, device_id) where status='pending'` (one open handoff per device), index `(org_id, to_id, status)` for the recipient inbox.
- Per-device history: read from `audit_log` (already indexed) rather than a new table; every lifecycle action writes `device.assigned/transfer_requested/transfer_confirmed/returned/...` with member ids in meta. Trade-off: meta is untyped; resolve names at read.
- Overdue computed on read (`assignment_expires_at < now()`), surfaced as banner/count in owner's inventory and device list; no scheduler.

**Migration plan (expand/contract)**
1. Expand only: drop NOT NULL, add columns + `device_handoffs`; add CHECK as `NOT VALID` then `VALIDATE` (all existing rows have owners → safe). Old image keeps working (never writes null). No contract step needed.

**Breaks**
- Placement: `decidePlacement` (`src/lib/devices/rules.ts`) gets a `not_owned` 422; move owner read under the `for update` lock.
- The 4 joins → `left join`; DTOs `owner: null` (`src/lib/devices/types.ts`, UI, CSV columns blank).
- Member deactivation: what happens to their devices / pending handoffs.
- `PATCH` rejects `ownerId` — keep; ownership only via new endpoints.
- Tests: `src/test/db/fixtures.ts`, seed, `devices.db.test.ts`, `rules.test.ts`, `devices-routes.test.ts`, `device-types.db.test.ts`; SIM-035 map drawing must handle null owner.

**Concurrency**
- Confirm takes lock order seat → device → handoff (`for update`), same as placement/deactivation; re-check handoff still pending and `from_id = owner_id`, then unplace (demote primary) + set owner in one tx. Invariant 3 safe since unplacing clears the seat. 409 `handoff_stale` if ownership changed. 403 only from the wrapper (R7); use 409/422 for "not the recipient".

**Risks**
- Return-confirm and deactivation are irreversible (unplace) and touch occupant invariants.
- Manager assign across all members unclear.
- Expiry without TZ/notifications may be ignored.

**Slicing** — 1 schema expand + nullable reads + Admin creates unowned + placement guard (M); 2 assign with note/expiry + fields (S-M); 3 transfer (M-L); 4 return + deactivation (M); 5 overdue/extend (S); 6 history from audit_log (S). All touching migrations are High.

**Open questions** — 1 audit_log vs typed `device_events` for history (default audit_log). 2 deactivation: auto-return to org or keep (default auto-return + cancel handoffs; note spec OQ-44 default is "keep assigned"). 3 Manager assigning an owned device (default: no, must be unowned).
