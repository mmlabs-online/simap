# Consult — database-optimizer (2026-11-25)

Consult: SIM-037.1 migration (read-only; no files changed).

## Findings

**Existing schema (`db/migrations/20261120150000_init.sql`)**
- `devices.owner_id uuid not null` (line 120); FK `devices_owner_fkey (org_id, owner_id) -> members` on delete restrict; index `devices_org_owner_idx`. `devices_primary_needs_seat_check` already exists.
- Invariant-3 deferred constraint triggers:
  - `devices_primary_owner_trg` → `devices_primary_owner_check()`: for a primary device requires `exists(seat with occupant_id = d.owner_id)`. With `owner_id` null, `occupant_id = NULL` is not true → raises 23514 `devices_primary_owner_is_occupant`. A null-owner primary is already refused, no trigger change.
  - `seats_primary_owner_trg` → `seats_primary_owner_check()`: uses `d.owner_id is distinct from s.occupant_id`; null owner and null occupant compare equal, so this trigger alone would let a null-owner primary sit at an empty seat — but the device-side trigger and the new CHECK still refuse it. No trigger edit needed.
  - Do not alter the trigger functions (a `create or replace` adds risk for no gain).
- Callers reading `owner_id`: inner joins that drop unowned rows `devices.ts:121`, `search.ts:119`, `export.ts:70`, `seats.ts:124`; `devices.ts:196-199` unlocked read (comment line 194), `devices.ts:236` under `for update`; `devices.ts:329` insert must stop requiring an owner; edit/delete paths (`devices.ts:374-440`) use `me === cur.owner_id` (null owner never matches → Admin only); `members/manage.ts` `owner_id = m.id` unaffected; `db/seeder.js` and `scripts/schema-check.mjs:186-216` insert with an owner and still work.

**Migration design (e.g. `db/migrations/20261125xxxxxx_device_lifecycle.sql`)**
1. `alter table devices alter column owner_id drop not null;` — metadata only.
2. Add nullable columns, no default (no rewrite): `serial`, `manufacturer`, `brand` each with a named check, e.g. `check (serial = btrim(serial) and serial <> '' and char_length(serial) <= 100)` (bare `btrim(x) <> ''` does not enforce trimmed); `holding_note` with a length cap (suggest 500); `holding_expires_on date`.
3. `create unique index devices_org_serial_key on devices (org_id, serial) where serial is not null;` (matches `devices_org_mac_key`; org_id first for schema:check rule 2).
4. `alter table devices add constraint devices_unowned_not_placed_check check (owner_id is not null or seat_id is null) not valid; alter table devices validate constraint devices_unowned_not_placed_check;` — all rows have owners (OQ-45), so it passes. NOT VALID + VALIDATE gives no lock benefit inside the migrator's single transaction; a plain add is equivalent on a small table. Name it explicitly for `pg-error.ts` mapping next to `devices_primary_owner_is_occupant` (line 19).
5. Optional hardening: `check (owner_id is not null or (holding_expires_on is null and holding_note is null))`; later slices (DEV-09) must clear these and `owner_id` in one UPDATE.
6. `device_handoffs`, modelled on `seat_requests`:
   - Columns: `id`, `org_id`, `device_id not null`, `kind not null`, `from_member_id null`, `to_member_id null`, `requested_by_id not null`, `note null`, `new_expires_on date null`, `status not null default 'pending'`, `decided_by_id null`, `decided_at null`, `created_at`, `updated_at`; `unique (org_id, id)`.
   - Checks: `kind in ('transfer','return','extension')`; `status in ('pending','confirmed','declined','cancelled')`; `(status = 'pending') = (decided_at is null)` (as `seat_requests_decided_check`); note length cap.
   - Per-kind shape: transfer — from and to not null and different; return — from not null, to null; extension — `new_expires_on` not null.
   - Composite FKs `(org_id, device_id) -> devices`, `(org_id, from_member_id | to_member_id | requested_by_id | decided_by_id) -> members` (MATCH SIMPLE with nullable column is unenforced when null — correct, same as `members_group_fkey`).
   - **`device_id` FK must be `on delete cascade`, not restrict**: the spec allows deleting a device with only non-pending handoffs; history survives in `audit_log` (same precedent as `seat_requests` → seats). Member FKs NO ACTION (members never deleted).
   - Indexes: `device_handoffs_one_pending_idx (org_id, device_id) where status = 'pending'` (unique); recipient inbox `(org_id, to_member_id, created_at desc) where status = 'pending'`; consider `(org_id, created_at desc) where status = 'pending'` (or by kind) for Admin/Manager queues; sender outbox `(org_id, from_member_id, created_at desc) where status = 'pending'`; device history `(org_id, device_id, created_at desc)`; optional `(org_id, requested_by_id)`.
7. Query indexes on `devices`: partial `(org_id, created_at desc) where owner_id is null` for the org-inventory filter; `(org_id, holding_expires_on) where holding_expires_on is not null` for overdue (could defer to that slice).

**Interaction with invariant-3 triggers**
- No trigger change needed.
- Transfer of a placed device must keep owner non-null; DEV-09 (owner null) must clear `seat_id` and set `role = 'secondary'` in the same UPDATE.
- The CHECK is immediate (per statement) while invariant-3 triggers are deferred: "null the owner" then "unplace" as two UPDATEs fails the CHECK. Write "unplace then null owner", or a single UPDATE; document in the service. `devices_primary_owner_trg` column list (`role, owner_id, seat_id`) already fires on owner changes.

**Expand/contract safety**
- Every prefix works; previous image inserts with an owner and ignores new columns.
- Previous-image reads (inner joins) silently hide unowned devices: incomplete lists, no crash; a hidden unowned device can still cause a 409 on duplicate inventory number/MAC — acceptable for a not-live app (OQ-45), note in the plan. Direct placement by id would hit the CHECK as an unmapped 23514 → 500, acceptable.
- Nothing destructive; dropping NOT NULL is the contract-safe direction. Rollback = previous image or fix-forward (`db/migrations/README.md`). Update README Schema section and add the CHECK name to the 422 mapping (`pg-error.ts` + test).

**schema:check and test:db impact**
- `scripts/schema-check.mjs` stages migrations below `DEVICE_TYPES_VERSION` (lines 54-61) to test a backfill; add a similar stage so the new migration applies on top of pre-existing owned devices; assert owners preserved (AC1), `owner_id` nullable, new columns null (needs member, seat, device in the stage-1 org).
- Rule-2 catalogue checks cover the new table automatically; partial unique indexes must start with `org_id`.
- `counts()` (lines 114-131) asserts every count > 0 after `seedDev`: adding `device_handoffs` fails unless `db/seeder.js` seeds at least one handoff (plus an unowned device). Recommend seeding both.
- New refusal cases (`tx`/`refused` helpers): unowned with `seat_id` → 23514 `devices_unowned_not_placed_check`; duplicate serial → 23505 `devices_org_serial_key`; blank or 101-char serial/manufacturer/brand → 23514; second pending handoff → 23505 `device_handoffs_one_pending_idx`; cross-org handoff FK → 23503; bad kind/status, transfer missing `to_member` → 23514; confirmed handoff + device delete → handoffs cascade; null-owner primary → 23514 `devices_primary_owner_is_occupant`.
- Update `devices.db.test.ts`, `devices.test.ts`, `pg-error.test.ts`; `src/test/db/fixtures.ts` unowned helper; `rooms.db.test.ts`, `device-types.db.test.ts` owner usage still works. New tests: Admin-only create, Manager/User refused, delete rules, placement 422 for unowned, null-owner reads (list, search, export, seat detail, `seatDevices`).

## Recommendations
1. One forward-only file: drop not null, add columns, unique serial index, CHECK, `device_handoffs`, indexes; explicit names for every constraint/index (AC1, AC3; R2, R6).
2. `device_handoffs.device_id` on delete cascade (AC5, DEV-01); per-kind shape checks.
3. Do not modify invariant-3 functions/triggers; test that a null-owner device cannot be primary nor at a seat.
4. In `devices.ts`, `for update` the device row before reading `owner_id` for placement; return 422 `device_unowned` before the DB check; map 23514 `devices_unowned_not_placed_check` to the same 422.
5. R7: Admin-only check for create/delete before any write; domain refusals (owned device, pending handoff) are 409/422, never 401/403 after a side effect.
6. Left joins at `devices.ts:121`, `search.ts:119`, `export.ts:70`, `seats.ts:124`; nullable `owner_id`/`owner_name`; `owner: null`; CSV owner cell empty or "Org inventory" (decide once); owner-name search still works for owned devices.
7. schema:check and test:db changes above; README Schema section and deletion rules text (devices → owners remain RESTRICT).

## Risks
- High path (`db/migrations`): plan needs Ming's approval.
- Immediate CHECK vs deferred triggers: two-statement updates in the wrong order fail in later slices; document.
- Previous image hides unowned devices; hidden rows can cause 409s (low impact, not live).
- Seeder/schema:check count assertions fail if `device_handoffs` is counted without seed rows.
- Unique serial index is case-sensitive by default.
- Cascade on handoffs: a deleted device loses its handoff rows; history depends on `audit_log`, so the delete must write an audit entry with the device identity.
- Null-owner device is edited only by an Admin; make sure the permission test covers it.

## Open questions (defaults)
1. Serial unique case-insensitively? Default: exact match after trim (as inventory number).
2. Length cap for `holding_note` and handoff `note`? Default: 500, non-blank when set.
3. DB rejects holding data on an unowned device? Default: yes.
4. `return` handoff `to_member_id`: null (org inventory) or the Admin? Default: null.
5. CSV owner cell for unowned: Default: empty; UI shows "Org inventory".
6. Keep NOT VALID then VALIDATE literally? Default: keep (costs nothing).
