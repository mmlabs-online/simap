**Findings**
- There is no orgs table. Orgs live in Identity, and init has no FK to them. No org bootstrap code exists. The only per-org first-touch hook is `ensure()` in `src/server/members/members.ts` (it inserts the member row on first visit).
- Init conventions:
  - Tables use `id uuid pk default gen_random_uuid()`, `org_id uuid not null`, `created_at`/`updated_at timestamptz`.
  - Check constraints are named `<table>_<col>_check`, e.g. `btrim(name) <> ''`.
  - Unique keys are named `<table>_org_<col>_key`, plus `unique (org_id, id)`.
  - Enums are text plus a check.
  - Every unique key or index includes `org_id`. `scripts/schema-check.mjs` check 2 enforces this (line 82), and its table list around line 94 needs `device_types` added.
- `devices.type` is free text with a `btrim(type) <> ''` check and no FK.
- Layout read: `src/server/layout/layout.ts` lines 95-107 select `seat_id, left(type, 61)` from a windowed subquery capped at `LAYOUT_LIMITS.devicesPerSeat`. The DTO is `{type}`.
  - `layout.db.test.ts` asserts exact equality on `[{type:"PC"}, ...]` (line 559).
  - It also asserts the JSON does not match `/inventory|mac|owner|name/i` (line 561). A DTO field containing "name" would break it.
- Slot kinds from `src/lib/sprites/device-slots.ts`: `monitor | laptop | pc | phone | other`.

**Recommendations**
1. Table `device_types`. Columns: `id`, `org_id`, `name text not null`, `slot text not null`, `image_drive_file_id text null`, `image_version integer not null default 0`, `created_at`, `updated_at`.
   - Constraints:
     - `device_types_name_check` is `btrim(name) <> ''` plus a length cap of 60. The layout query uses `left(type, 61)`, which stays consistent with that.
     - `device_types_slot_check` is `slot in ('monitor','laptop','pc','phone','other')`.
     - `device_types_image_check` is `image_drive_file_id is null or image_drive_file_id ~ '<regex>'`. Copy the exact regex from the SIM-036.1 Drive client.
     - `unique (org_id, id)`.
2. Name uniqueness: `create unique index device_types_org_name_key on device_types (org_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')))`.
   - Define this key once and reuse the identical expression in the layout join and the app's duplicate check. Map 23505 on this index to 409.
   - `lower()` depends on the DB collation. Check `lc_ctype` on the shared DB, and add a DB test with "Đ" and "Ơ" vs "đ" and "ơ".
   - Do not use `unaccent`. It is not immutable, and "May" and "Máy" are different words.
   - Have the app normalize (trim, collapse whitespace) before storing.
3. Layout resolution: left join `device_types t` on `t.org_id = d.org_id` and the same normalized-name expression. Run it in the outer query, after the per-seat row limit.
   - It uses the unique index on the `t` side. No new `devices` index is needed, because `devices_org_seat_idx` already narrows the rows.
   - The DTO becomes `{type, typeId, slot, imageVersion}`, or a null type when unresolved. Never expose `image_drive_file_id`.
   - Keep the `left(type, 61)` cap.
4. Cache-busting: `image_version` is incremented on every upload or remove. Use it in the ETag (`"<id>-<version>"`) and in the client URL `?v=N`.
5. Seeding existing orgs in the migration: `insert into device_types (org_id, name, slot) select o.org_id, v.name, v.slot from (select org_id from members union select org_id from rooms union select org_id from devices union select org_id from seats) o cross join (values ('PC','pc'),('Laptop','laptop'),('Monitor','monitor'),('IP phone','phone'),('Other','other')) v(name, slot) on conflict do nothing`. Spell out the conflict target as `(org_id, <expression>)`. Idempotent.
6. Seeding future orgs: put one shared function `seedDeviceTypes(c, scope)` (insert ... on conflict do nothing) in `src/server/**`. Call it from the created-branch of `members.ensure()`, which is the first visit of a new org's first member.
   - Do not re-seed on every read, or a type an admin deleted would come back.
   - The layout read and list must tolerate an empty catalog.
   - If the planner wants a safety net, add a `device_types_seeded_at` marker table. That is probably overkill.
7. Expand-only: add the table, do not alter `devices`, and add no FK. Matching is by name (D61). Deleting a type is a plain delete with no cascade.
8. Checks:
   - File name `20261124xxxxxx_device_types.sql` (later than `20261122120000`).
   - `migrate:smoke` asserts `schema_migrations` has 2 rows (line 80). Check whether it reads the real migrations folder or its own fixtures before changing that count.
   - `schema:check`: add `device_types` to the table list, and add cases for same-org duplicate refused (23505 on `device_types_org_name_key`), cross-org same name allowed, bad slot refused, bad Drive id refused, and 5 seeded rows per org.
   - DB tests with two orgs for R6.

**Risks**
- A seed backfill from existing tables misses orgs with no rows. The lazy seed covers them.
- Seeding race: safe with `ON CONFLICT DO NOTHING`.
- If the join expression and the index expression differ, the join falls back to a seq scan on a small table. This is harmless but wasteful.
- The existing `layout.db.test.ts` equality assertions break when the DTO changes. Update them, and name DTO fields to avoid the "name" regex or adjust that test.
- Image replace and remove: update the DB row first, then delete the old Drive file (best effort), so a Drive failure does not leave a dangling pointer.

**Open questions**
- What is the DB `lc_ctype`, and does `lower()` fold Vietnamese capitals?
- Should deleted seed types stay deleted? This affects the seeding trigger. I recommend yes.
- Is the maximum name length 60?
- Renaming a type orphans devices that use the old name, so they fall back to the placeholder. Note this in the spec (out of scope per the ticket).
