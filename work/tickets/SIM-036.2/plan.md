Status: READY

# Plan — SIM-036.2: Device type catalog: schema and API (slice 1 of 2)

This plan covers **slice 1 only**: migration, seeding, catalog CRUD, layout resolution and the spec update. The image
upload, removal and serving move to a new ticket, **SIM-036.5**. See `## Split proposal`. Ming confirms the split when
approving this plan (plan-approval gate, High path `db/migrations/**`).

## Scope summary
- `work/decisions.md` D61: "Admins manage a per-org device type catalog: name, desk slot and an optional image. Images
  are stored in Google Drive the tudocuatui way (…). Image format: square PNG, 24 × 24 px, transparent background
  allowed, at most 20 KB (…). `devices.type` stays free text (D37) and matches a catalog type by name (trimmed,
  case-insensitive); a device whose type is not in the catalog draws as one built-in square placeholder sprite."
- D37: "Device type: suggested list (PC, Laptop, Monitor, IP phone, Other) plus free text."
- Spec DEV-01 (`docs/spec-v1.md:259-267`): "A device type is picked from a suggested list (PC, Laptop, Monitor, IP
  phone, Other) or typed freely (D37)."
- Spec LAY-06 (`docs/spec-v1.md:357-363`): "Every device placed at a seat is drawn on its desk, one sprite per
  device, at its type's slot (PC, laptop, monitor, IP phone, other; D37, D61, D62)."
- Ticket scope items in this slice:
  - The forward-only migration for `device_types`, with the five D37 types seeded for every org.
  - API: list types (any member), and create, rename, change slot and delete (Admin).
  - "`devices.type` stays free text and matches a catalog type by name (trimmed, case-insensitive). Deleting a type
    does not touch devices."
  - "The layout read API returns, per seat device, the resolved catalog type (id, slot, image version) or none."
  - The spec update.
- Moved to SIM-036.5 (see `## Split proposal`): upload, replace or remove the image, `GET` the image bytes, and the
  SIM-036.1 security-review follow-ups.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The migration is forward-only and expand-only. `pnpm schema:check` and `pnpm migrate:smoke` pass. Every org gets the five seeded types. | (a) Read `db/migrations/20261124160000_device_types.sql`. It may only create objects: 2 tables, 3 functions, 1 trigger, 1 index, plus the backfill. No `alter`/`drop` of existing objects, no transaction control. (b) `pnpm migrate:smoke` passes unchanged; it uses fixtures. (c) `pnpm schema:check` prints `pass` for every new step 9 case (see Tests), including "9 orgs existing before the migration get 5 types", "9 org created after the migration gets 5 types on first member" and "9 deleted seed type stays deleted". (d) The `pnpm test:db` case `device-types (db) › a new member's first visit seeds the org once` passes. |
| 2 | Create, rename, delete and slot change are Admin only: others get 403 from the auth wrapper (R7). A duplicate name (case- and whitespace-insensitive) is refused with 409. Every query is org-scoped (R6), covered by a DB test with two orgs. | (a) `device-types-routes.test.ts › 403 forbidden for user and manager on POST/PATCH/DELETE; service never called`. (b) `device-types.db.test.ts › duplicate name "  ip   PHONE " → 409 name_taken`, `› "MÁY IN" vs "Máy in" → 409`, `› "May in" vs "Máy in" both allowed`. (c) `device-types.db.test.ts › org B cannot list, rename, change the slot of or delete org A's type (404, row unchanged)`. (d) `grep -n "orgQuery" src/server/device-types/device-types.ts`: every query goes through `orgQuery`. |
| 3 | Layout read returns each seat device's resolved type; a device type not in the catalog resolves to none. | `layout.db.test.ts › seatDevices: resolved deviceType per device; unknown type → null; deleted type → null; other org's same-named type never used`, plus the updated equality assertion at `layout.db.test.ts:559`. |
| 4 | Spec DEV-01 / LAY-06 updated. | Diff of `docs/spec-v1.md`: the DEV-01 bullets, the LAY-06 bullet, the §4 row and the §12 change-log row, worded as in Approach step 9. |
| 5 | The type cap and input validation hold (the ticket's "Unit: validators (name, slot)"). | `src/lib/validate/device-type.test.ts` (all cases listed in Tests). `device-types.db.test.ts › 101st type → 409 type_limit`. |
| — | Image ACs (ticket ACs 3 and 4) | **Moved to SIM-036.5.** Not verified in this slice. |

## Ming verification after merge
- At deploy, the `migrate` container applies `20261124160000_device_types.sql` to the shared DB. Then each existing
  org's device types page (SIM-036.3), or `GET /api/device-types` with a token, should list PC, Laptop, Monitor, IP
  phone and Other.
- Optional: `show lc_ctype;` on the `simap` database. This is not blocking, because the name key folds Vietnamese
  capitals with an explicit map (see Data model). The locale only matters for case-folding in other scripts (Greek,
  Cyrillic and so on).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261124160000_device_types.sql` | New. Creates the `device_type_key()` function, the `device_types` and `device_type_catalogs` tables, `device_types_seed()`, a trigger on `members` insert, and the backfill for existing orgs. | Schema, seeding | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | Add a "Device types (SIM-036.2)" bullet under "Schema (v1)": tables, key function, seed trigger, marker. | Keeps the schema doc current (matches the existing bullets at lines 37-43) | No |
| `scripts/schema-check.mjs` | Run the migrations in two stages to test the backfill. Add the step-9 cases. Add `device_types` and `device_type_catalogs` to the counts list at line 88. Adjust check "1 first run applies init". | AC1 | No (not in the High list) |
| `src/lib/device-types/types.ts` | New. `DEVICE_TYPE_LIMITS = { name: 60, perOrg: 100, bodyBytes: 1024 }`, `DEVICE_KINDS` (typed `readonly DeviceKind[]`), `SEED_DEVICE_TYPES` (the five D37 name/slot pairs), `DeviceTypeDto`, `DeviceTypeListResponse`, `DeviceTypeCreateValue`, `DeviceTypePatchValue`. | Shared contract (pages, ui and api all import lib) | No |
| `src/lib/device-types/name.ts` | New. `VI_UPPER` / `VI_LOWER` (67 precomposed Vietnamese capitals and their lowercase forms) and `deviceTypeKey(s)`, which mirrors the SQL `device_type_key()`. | One normalization in SQL and TS | No |
| `src/lib/device-types/name.test.ts` | New. Unit tests for the key and the VI map. | R5 | No |
| `src/lib/validate/device-type.ts` | New. `validateDeviceTypeCreate(body)` and `validateDeviceTypePatch(body)`. | Boundary validation (lib/validate rule, R1) | No |
| `src/lib/validate/device-type.test.ts` | New. | R5 | No |
| `src/lib/sprites/layout.ts` | Add `SeatDeviceType = { id: string; slot: DeviceKind; hasImage: boolean; imageVersion: number }`. Change `SeatDevice` to `{ type: string; deviceType?: SeatDeviceType \| null }`. | Layout DTO (AC3). The field is optional so the existing fixtures (`src/app/dev/roommap/fixture.ts:39`, `editor-state.test.ts:552`, `map-view.ts:48`) keep compiling. | No |
| `src/server/device-types/device-types.ts` | New. `listDeviceTypes`, `createDeviceType`, `updateDeviceType`, `deleteDeviceType`, following the `inTx`/`Abort` pattern of `src/server/devices/devices.ts:44-64`. | CRUD service | No |
| `src/server/device-types/pg-error.ts` | New. `deviceTypeConflict(err)`: 23505 on `device_types_org_name_key` returns `"name_taken"`, anything else returns null. Mirrors `src/server/devices/pg-error.ts`. | 409 mapping | No |
| `src/server/device-types/pg-error.test.ts` | New. | R5 | No |
| `src/server/device-types/sql-sync.test.ts` | New unit test. It reads the migration file and asserts that its literals equal the TS constants: the VI map, the slot list, the seed list, the name max of 60, and the Drive id regex equal to `DRIVE_ID_RE.source` (`src/server/drive/config.ts:20`). | Keeps SQL and TS identical (consult: "kept in sync by a test") | No |
| `src/server/device-types/device-types.db.test.ts` | New DB integration tests (`pnpm test:db`). | AC1-AC3, AC5 | No |
| `src/server/layout/layout.ts` | Lines 93-107: left join `device_types` in the outer query and build `deviceType`. | AC3 | No |
| `src/server/layout/layout.db.test.ts` | Update the equality assertions at lines 559, 590, 595 and 607 to the new shape. Add the resolution tests. | AC3 | No |
| `src/app/api/device-types/route.ts` | New. `GET` (tier `user`) and `POST` (tier `admin`). | API | No |
| `src/app/api/device-types/[id]/route.ts` | New. `PATCH` and `DELETE` (tier `admin`). | API | No |
| `src/app/api/device-types/device-types-routes.test.ts` | New route tests with a mocked service. Same pattern as `src/app/api/devices/devices-routes.test.ts:1-55`. | AC2 (R7) | No |
| `docs/spec-v1.md` | Update DEV-01 (line 260), LAY-06 (line 360-361), the §4 table (after line 128) and the §12 change log (after line 581). | AC4 | No |

No change to `src/server/members/members.ts`: the DB trigger does the seeding (see Approach step 2). No change to
`src/server/http/**` or any other High-path file besides the migration.

## Data model / migration
File: `db/migrations/20261124160000_device_types.sql`. It runs in the migrator's transaction. No `begin`/`commit`, and
`do $$` blocks are not needed.

1. **Name key function.** It is the single definition, used by both the unique index and the layout join.
   ```sql
   create function device_type_key(t text) returns text
     language sql immutable strict parallel safe
     as $$ select lower(translate(btrim(regexp_replace(t, '[ \t\n\v\f\r]+', ' ', 'g')),
                                  '<VI_UPPER>', '<VI_LOWER>')) $$;
   ```
   - It collapses runs of ASCII whitespace to one space, trims the ends, maps the 67 Vietnamese precomposed capitals
     (À…Ỵ, Đ) to lowercase without depending on the locale, and then applies `lower()` (ASCII in any locale).
   - It does not use `unaccent`, so "May" and "Máy" stay different (consult-db item 2).
   - The literals are the same strings as `VI_UPPER` / `VI_LOWER` in `src/lib/device-types/name.ts`, checked by
     `sql-sync.test.ts`.
2. **`device_types` table.**
   | Column | Type | Null | Default |
   |---|---|---|---|
   | `id` | uuid | no | `gen_random_uuid()` (PK) |
   | `org_id` | uuid | no | — |
   | `name` | text | no | — |
   | `slot` | text | no | — |
   | `image_drive_file_id` | text | yes | null |
   | `image_version` | integer | no | 0 |
   | `created_at` | timestamptz | no | `now()` |
   | `updated_at` | timestamptz | no | `now()` |
   - Constraints:
     - `device_types_org_id_key unique (org_id, id)`.
     - `device_types_name_check check (btrim(name) <> '' and char_length(name) <= 60)`.
     - `device_types_slot_check check (slot in ('monitor','laptop','pc','phone','other'))`.
     - `device_types_image_check check (image_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$')`. Null passes.
     - `device_types_image_version_check check (image_version >= 0)`.
   - Index: `create unique index device_types_org_name_key on device_types (org_id, device_type_key(name));`. It
     starts with `org_id`, so schema-check check 2 at line 76-82 still passes.
   - The image columns are added now, so that SIM-036.5 needs no further migration (one High-path review). In this
     slice they stay null and 0.
3. **`device_type_catalogs` table** (seed marker and per-org lock).
   - Columns: `org_id uuid primary key`, `seeded_at timestamptz not null default now()`.
   - A row means "this org's catalog was seeded once", so seed types an Admin deletes stay deleted.
   - It has `org_id not null`, so schema-check check 2 passes. Its PK is excluded from the unique-index check.
4. **`device_types_seed(p_org uuid) returns void`** (plpgsql). It runs
   `insert into device_type_catalogs (org_id) values (p_org) on conflict (org_id) do nothing;`. If `found`, it then
   inserts the five rows (`PC`/`pc`, `Laptop`/`laptop`, `Monitor`/`monitor`, `IP phone`/`phone`, `Other`/`other`)
   with `on conflict do nothing`.
   - It is idempotent and safe under races: a concurrent second caller waits on the marker PK and then hits the
     conflict.
5. **Trigger** `members_seed_device_types_trg after insert on members for each row execute function
   members_seed_device_types()`. The trigger function calls `device_types_seed(new.org_id)` and returns null.
   - This covers every path that creates a member: `members.ensure()` on first visit, invitations, the dev seeder, DB
     test fixtures, and the **previous image** during the deploy window.
   - Cost: one PK probe per new member.
6. **Backfill:**
   `select device_types_seed(o.org_id) from (select org_id from members union select org_id from rooms union select org_id from seats union select org_id from devices union select org_id from groups) o;`
7. **Expand-only.** `devices` is not altered. There is no FK from `devices.type`; matching is by name (D61). Deleting a
   type is a plain row delete.
8. **Downgrade:** none, because migrations are forward-only (R2, D3). The previous image ignores the new tables. The
   trigger only inserts into the new tables, so the previous image keeps working. A later contract ticket could drop
   the objects if they were ever abandoned.

## API contract
All routes are `withAuth`, and only the wrapper returns 401/403 (R7). Every response carries
`Cache-Control: no-store`. JSON bodies are read with `readJson(req, DEVICE_TYPE_LIMITS.bodyBytes)` (1024).

`DeviceTypeDto = { id: string; name: string; slot: "monitor"|"laptop"|"pc"|"phone"|"other"; hasImage: boolean; imageVersion: number }`.
The Drive file id is never exposed.

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/device-types` | — | 200 `{ items: DeviceTypeDto[] }`, ordered by `lower(name), id`, at most 100 | 503 `unavailable` | `user` (any member) |
| POST | `/api/device-types` | `{ name: string, slot: DeviceKind }`, exactly these keys | 201 `DeviceTypeDto` | 400 `invalid_request`; 409 `name_taken`; 409 `type_limit` (org already has 100); 503 `unavailable` | `admin` |
| PATCH | `/api/device-types/{id}` | `{ name?, slot? }`, non-empty, no other keys | 200 `DeviceTypeDto` (unchanged → 200 with no audit row) | 404 `not_found` (bad uuid, missing, or another org's); 400 `invalid_request`; 409 `name_taken`; 503 | `admin` |
| DELETE | `/api/device-types/{id}` | — | 204 | 404 `not_found`; 503 | `admin` |

Layout (`GET /api/rooms/{id}/layout`, and the save response, which shares `readLayoutRows`):
`seatDevices[seatId][i] = { type: string, deviceType: { id, slot, hasImage, imageVersion } | null }`. No field name
contains "name", so the `/inventory|mac|owner|name/i` guard at `layout.db.test.ts:561` stays as it is.

Name rules (`validateDeviceTypeCreate` / `validateDeviceTypePatch`):
- The name must be a string. It is normalized to NFC, `\s+` runs (Unicode, which includes NBSP) are collapsed to one
  ASCII space, and it is trimmed.
- After that it must be 1..60 code points, with no `\p{Cc}`/`\p{Cf}` characters. These are the same rules as
  `devices.type` (`src/lib/validate/device.ts:78-86`, `DEVICE_LIMITS.type = 60`), so every catalog name is a valid
  device type.
- The slot must be one of `DEVICE_KINDS`.
- Any failure gives 400 `invalid_request`, the existing convention in `src/app/api/devices/route.ts:31-32`.

Audit (via `writeAudit`, inside the same transaction):
- Entity `device_type`.
- Actions:
  - `device_type.create`, meta `{name, slot}`.
  - `device_type.update`, meta `{fields, from?, to?}` (name change only).
  - `device_type.delete`, meta `{name, slot}`.
- The seed writes no audit row (system action).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/device-types/name.test.ts › deviceTypeKey trims, collapses ASCII whitespace, lowercases ASCII` (`"  IP \t PHONE "` → `"ip phone"`) | Key |
| `… › VI capitals fold: "MÁY IN" = "máy in", "ĐIỆN THOẠI" = "điện thoại", "Ơ"/"ơ", "Ư"/"ư"` | Domain focus: Vietnamese diacritics |
| `… › diacritics are not stripped: "May" ≠ "Máy"` | D61 matching |
| `… › VI_UPPER/VI_LOWER: same length, 67 chars, each pair upper.toLowerCase() === lower, no duplicates` | Map integrity |
| `… › SEED_DEVICE_TYPES keys are distinct and every slot is in DEVICE_KINDS` | Seed |
| `src/lib/device-types/name.test.ts › DEVICE_KINDS equals Object.keys(DEVICE_SPRITE)` (`src/lib/sprites/device-slots.ts:10`) | Slot list = SIM-035 |
| `src/lib/validate/device-type.test.ts › create: valid; NFC; "  Máy   in  " → "Máy in"; NBSP collapsed` | Name normalization |
| `… › create: empty, whitespace-only, 61 code points (60 ok, counting Vietnamese code points), control char, zero-width (Cf), non-string, extra key, missing slot, unknown slot "printer", slot case "PC" → invalid` | Edge cases, empty/null |
| `… › patch: {} invalid; only name; only slot; both; extra key invalid; null name invalid` | PATCH shape |
| `src/server/device-types/pg-error.test.ts › 23505 device_types_org_name_key → name_taken; other constraint / code → null` | 409 mapping |
| `src/server/device-types/sql-sync.test.ts › migration VI map, slot list, seed list, name max and Drive id regex equal the TS constants` | SQL ↔ TS identity |
| `src/app/api/device-types/device-types-routes.test.ts › 401 without token (all methods)` | R7 |
| `… › 403 forbidden for user and manager on POST, PATCH, DELETE; service not called` | AC2 / R7 |
| `… › GET allowed for user tier; no-store header` | Permission |
| `… › bad uuid → 404 before getPool; invalid body → 400; service refusal maps to its status/code; 201/200/204 on success` | Handler order |
| `src/server/device-types/device-types.db.test.ts › a new member's first visit (getOrCreateMember) seeds the org with the 5 types once; a second member adds none` | AC1 seed (future orgs) |
| `… › a deleted seed type stays deleted after another member joins` | No resurrection |
| `… › list: any member sees 5 seeded types ordered by name; DTO has no drive id; hasImage false, imageVersion 0` | List |
| `… › create → 201 DTO + audit row; duplicate "  ip   PHONE " → 409 name_taken; "MÁY IN" after "Máy in" → 409; "May in" and "Máy in" both ok` | AC2 uniqueness |
| `… › same name in two orgs allowed` | R6 |
| `… › rename to own name with other case ("pc" → "PC") ok; rename onto another type's key → 409; slot change ok; no-op patch writes no audit row` | PATCH |
| `… › delete removes the type; devices of that type are untouched and their layout deviceType becomes null` | D61 delete |
| `… › org B cannot list, rename, change slot of or delete org A's type (404, row unchanged)` | AC2 / R6 two orgs |
| `… › 101st type → 409 type_limit; two concurrent creates at 99 → exactly one succeeds` (use `waitForLockWait` from `src/test/db/fixtures.ts:96`) | Cap + marker lock |
| `… › SQL device_type_key equals deviceTypeKey on an ASCII + Vietnamese sample` (same pattern as `src/server/search/search.db.test.ts:48-59`) | Identity of SQL and app normalization |
| `src/server/layout/layout.db.test.ts › seatDevices: resolved deviceType per device` (seeded PC/Laptop/Monitor resolve with the right id, slot, `hasImage:false`, `imageVersion:0`; replaces the line-559 assertion) | AC3 |
| `… › seatDevices: unknown type ("Printer", "Tablet") → deviceType null; " pc " and "PC" both resolve to PC` | AC3, normalization |
| `… › seatDevices: org B's catalog type with the same name is never used for org A's device` | R6 |
| `… › seatDevices: after deleting the Monitor type, Monitor devices resolve to null` | D61 delete |
| `scripts/schema-check.mjs` step 9 (scripted; run `pnpm schema:check` locally): <br>- 9 orgs existing before the migration get 5 types and a marker (stage 1 runs the migrations before `20261124160000`, inserts a member-only org and a room-only org, then stage 2 runs the rest)<br>- 9 org created after the migration gets 5 types on first member<br>- 9 second member adds none<br>- 9 deleted seed type stays deleted<br>- 9 duplicate name case/space-insensitive refused (23505 `device_types_org_name_key`)<br>- 9 same name in two orgs accepted<br>- 9 bad slot refused (23514 `device_types_slot_check`)<br>- 9 blank and 61-char name refused (`device_types_name_check`)<br>- 9 bad Drive id refused (`device_types_image_check`)<br>- 9 negative image_version refused | AC1 |

No new Vitest config is needed: `*.db.test.ts` files run under `pnpm test:db`, and the other files run under
`pnpm test`.

## Approach
1. **Lib first (pure, R1 lib → lib).** Write `types.ts`, `name.ts` and `validate/device-type.ts` with their tests.
   `DeviceKind` is imported as a type from `@/lib/sprites/device-slots`.
2. **Migration (R2, D3), as in Data model.**
   - Seeding orgs created after the migration: use a **DB trigger on `members` insert** plus the
     `device_type_catalogs` marker. Do not hook `members.ensure()`.
   - Reason: `ensure()` runs for *every* new member, not only an org's first. With the marker, seeding is "once per
     org ever" wherever it is called from.
   - The trigger also covers members created by the previous image during the deploy window, by invitations and by
     the dev seeder, with no app change.
   - With the marker, a seed type an Admin deletes stays deleted.
3. **Schema check.**
   - Stage the migration run in a temp dir: copy the files with a version below `20261124160000` and run them.
     Insert raw rows for two orgs (a member-only org and a room-only org). Then run the full dir.
   - Keep "1 first run applies init" true for stage 1, and "1 second run is up to date".
   - Add the step-9 cases and extend the counts list.
4. **Service `src/server/device-types/device-types.ts`.** Every SQL statement goes through `orgQuery` (R6), with
   `org_id = $1` on every table, including the join side.
   - `listDeviceTypes(db, scope)`: `select … from device_types where org_id = $1 order by lower(name), id limit 100`.
   - `createDeviceType(db, scope, actorSub, v)`, in a transaction:
     1. `select device_types_seed(o.org_id) from (select $1::uuid as org_id) o where o.org_id = $1::uuid`. This is a
        safety net for an org that somehow has no marker. It is a no-op otherwise.
     2. `select org_id from device_type_catalogs where org_id = $1 for update`. This is a per-org lock, so the cap
        check cannot race.
     3. Count the org's types. At 100 or more, refuse 409 `type_limit`.
     4. Insert, using the subselect form as in `src/server/devices/devices.ts:329-332`.
     5. Write the audit row and return the DTO.
     - A 23505 on `device_types_org_name_key` becomes 409 `name_taken`, via `deviceTypeConflict` in `inTx`.
   - `updateDeviceType`: `select … where org_id = $1 and id = $2 for update` (missing gives 404). Compute the changed
     fields (name compared exactly, slot). If nothing changed, return the current DTO without an audit row. Otherwise
     run `update … set …, updated_at = now() where org_id = $1 and id = $2`, then audit.
   - `deleteDeviceType`: `delete from device_types where org_id = $1 and id = $2 returning name, slot` (no row gives
     404), then audit. In this slice `image_drive_file_id` is always null, because no route sets it. SIM-036.5 extends
     this function with the best-effort Drive delete after commit.
   - Refusal type: `{ ok:false; status: 404|409; code: "not_found"|"name_taken"|"type_limit" }`. There are no
     401/403 codes in the service (R7).
5. **Routes.** Follow the handler order of `src/app/api/devices/[id]/route.ts:26-41`:
   1. Id check (`isCanonicalUuid` → 404).
   2. `getPool()` (null → 503).
   3. `readJson`, then the validator (→ 400).
   4. The service.
   5. `apiError`.
   - Tiers: `admin` on POST, PATCH and DELETE; `user` on GET. The auth wrapper rejects everyone else with 403 before
     any side effect (R7).
   - `routes-guarded.test.ts` picks up the new files automatically.
6. **Layout (`src/server/layout/layout.ts:95-107`).** Keep the windowed subquery and select the full `type` in it.
   The outer query is:
   ```sql
   select d.seat_id, left(d.type, 61) as type, t.id as type_id, t.slot,
          (t.image_drive_file_id is not null) as has_image, t.image_version
     from (…existing window, where org_id = $1 …) d
     left join device_types t on t.org_id = $1 and device_type_key(t.name) = device_type_key(d.type)
    where d.n <= ${LAYOUT_LIMITS.devicesPerSeat}
    order by d.seat_id, d.n
   ```
   - Push `{ type, deviceType: type_id ? { id, slot, hasImage, imageVersion } : null }`.
   - The unique key guarantees at most one match, so no rows are duplicated.
   - The query stays in the read-only repeatable-read transaction. There is no seeding on read.
7. **Client parse is untouched.** `src/lib/sprites/map-view.ts:45-48` still keeps only `type`. Parsing and drawing
   `deviceType` is SIM-036.4.
8. **README.** Add the schema bullet.
9. **Spec** (`docs/spec-v1.md`).
   - DEV-01: replace line 260 with "A device type is picked from the org's device type catalog or typed freely (D37,
     D61). Each org starts with PC, Laptop, Monitor, IP phone and Other." Add the bullet "An Admin manages the
     catalog: add, rename, change the desk slot, delete (name unique in the org, case- and space-insensitive, at most
     60 characters, at most 100 types; an optional 24 × 24 px PNG image, SIM-036.5). A device's type matches a
     catalog type by name; renaming or deleting a type never changes devices, which then draw as the placeholder
     until their type matches again."
   - LAY-06 line 360-361: "… at its catalog type's slot and image (built-in sprite when the type has no image); a
     device whose type is not in the catalog draws as the square placeholder (D37, D61, D62)."
   - §4: add a row "DeviceType | org, name (unique, case- and space-insensitive), desk slot, optional image | Org
     catalog (D61); devices match it by name, no reference."
   - §12: add a change-log row dated 2026-11-24.
10. Run the Checks (`pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`), plus
    `pnpm schema:check` and `pnpm test:db` against the local compose Postgres (loop.config Prepare).

Rules:
- R1: lib stays pure; the server files start with `import "server-only"`; only `src/app/api/**` imports
  `@/server/**`.
- R2: new forward-only, expand-only file.
- R3: no new env.
- R6: `orgQuery` everywhere, `org_id` in the index and the join, and a two-org DB test.
- R7: 403 only from the wrapper; domain refusals are 404/409.
- R5: tests above.

## Specialist input used
- **consult-database-optimizer**
  - Adopted:
    - Item 1: table shape and constraint names. The image-id regex comes from `DRIVE_ID_RE`.
    - Item 2: a unique expression index with `org_id` first, the same expression in index, join and app, no
      `unaccent`, and the app normalizing before storing. Changed: the expression is wrapped in one immutable SQL
      function, and Vietnamese capitals are folded with an explicit `translate` map. This settles the `lc_ctype` open
      question without needing access to the shared DB. The map is in sync with TS by test.
    - Item 3: left join after the per-seat limit, `left(type, 61)` kept, no `devices` index.
    - Item 4: `image_version` (used by SIM-036.5).
    - Item 5: backfill from the existing org tables, with `groups` added.
    - Item 7: expand-only, no FK.
    - Item 8: schema-check cases and the two-org DB tests.
  - Changed, item 6 (future orgs): the consult proposed a call in `members.ensure()`'s created branch. That branch
    runs for every new member, so a deleted seed type would come back. Adopted instead: the marker table the consult
    called "probably overkill", driven by a members insert trigger. This is the only way to keep "deleted stays
    deleted" and also cover the previous image.
  - `migrate:smoke` question: it uses its own fixtures (`scripts/migrate-smoke.mjs:68-80`), so no change.
- **consult-api-platform-engineer**
  - Adopted:
    - Routes and PATCH carrying both name and slot.
    - The DTO `{id, name, slot, hasImage, imageVersion}`; the Drive id is never exposed.
    - The handler order.
    - `name_taken` 409 caught from the unique violation.
    - The slot list kept in sync with `device-slots.ts` by test.
    - The layout field `deviceType` as optional-additive `{id, slot, imageVersion, hasImage} | null`.
    - The split into two slices.
  - Deferred to SIM-036.5: all the upload, serve and Drive-ordering recommendations (listed in `## Split proposal`).
  - Rejected: lazy seeding on first list or first admin write. With a marker that is redundant to the trigger, and the
    layout read is read-only. The create path still calls the idempotent seed as a safety net.
  - Open questions settled:
    - Q1: 422 for every bad image (SIM-036.5).
    - Q2: trigger plus marker.
    - Q3: no delete-impact route (later slice, follow-up).
    - Q4: slots are exactly `monitor|laptop|pc|phone|other`.
    - Q5: cap of 100 per org.

## Assumptions
Defaults that Ming confirms by approving the plan:
- **A1 Split:** this ticket is slice 1. Images move to SIM-036.5 (see Split proposal). Ticket ACs 3 and 4 move with
  it.
- **A2 Seeding future orgs:** a DB trigger on `members` insert plus a `device_type_catalogs` marker. This means once
  per org, ever.
- **A3 Deleted seed types stay deleted.** Nothing re-seeds an org that has a marker.
- **A4 Name length is 60 code points**, the same as `DEVICE_LIMITS.type`, so any catalog name fits a device type.
- **A5 Name normalization:**
  - Stored name: NFC, Unicode whitespace collapsed to one space, trimmed, case preserved.
  - Match key: ASCII-whitespace collapse, trim, the Vietnamese capital map, then `lower()`. It is defined once in SQL
    (`device_type_key`) and used by both the index and the join. The TS mirror `deviceTypeKey` is proven equal on
    ASCII and Vietnamese by a DB test.
  - Case-insensitivity for other scripts follows the DB locale.
  - A device type with an internal NBSP does not match (the device validator does not collapse it). This is an
    accepted edge case.
- **A6 Bad image → 422** for every image failure (not PNG, wrong size, too large), applied in SIM-036.5.
- **A7 Cap of 100 types per org** gives 409 `type_limit`. The list returns at most 100 with no pagination.
- **A8 DTO naming:** the layout field is `deviceType` with keys `id, slot, hasImage, imageVersion` and no `name`. The
  `/inventory|mac|owner|name/i` privacy guard at `layout.db.test.ts:561` stays unchanged.
- **A9 Validation failures give 400 `invalid_request`**, the existing convention. Domain refusals are 404/409.
- **A10 Rename and delete never touch devices** (ticket out of scope: "Bulk renaming of the type on existing
  devices"). Affected devices draw as the placeholder. The spec says so.
- **A11 Audit actions** are `device_type.create|update|delete`. The seed writes no audit row.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board (`work/backlog.md:66-69`).
  SIM-036.3 and SIM-036.4 are BACKLOG and depend on this ticket.
- **Size:** about 1,100-1,300 changed lines, of which roughly 60% are tests and the schema-check cases. That is above
  the ~400 guide even after the split. The remaining code is one cohesive unit: the migration and the API that
  exercises it. Splitting it further would put a High-path migration in a PR with no consumer.

## Blocking questions
None.

## Split proposal
The API consult (Slice size) recommends two slices. **Adopted.**

**SIM-036.2, this plan (slice 1): catalog, migration and layout resolution.**
- Migration `20261124160000_device_types.sql`, including the image columns, seed, marker and trigger.
- Schema-check cases.
- Lib validators and key.
- CRUD service and routes (`GET`/`POST /api/device-types`, `PATCH`/`DELETE /api/device-types/{id}`).
- Layout `deviceType` resolution.
- Spec DEV-01, LAY-06, §4 and §12.
- ACs: ticket ACs 1, 2, 5 and 6.

**SIM-036.5, new ticket for Ming to confirm: device type image upload, remove and serve.**
- Size M, Areas api and security, Gate plan-approval (security). Depends on SIM-036.2 and SIM-036.1. Needs Ming
  M-46 (prod Drive secrets, the A6 deploy ticket from SIM-036.1) before go-live.
- No migration: the columns exist from slice 1.
- Scope:
  - `PUT /api/device-types/{id}/image` (admin):
    - Raw `image/png` body, not multipart.
    - New `src/server/request/read-bytes.ts` `readBytes(req, 20480, "image/png")`: exact content-type, a
      `content-length` precheck, and a streaming cap.
    - Pure `src/lib/validate/png.ts`: 8-byte signature, first chunk IHDR with length 13, width = height = 24 read as
      big-endian u32, and the bytes end with IEND.
    - **Every failure gives 422** with fixed codes `image_not_png` / `image_bad_size` / `image_too_large`, **before
      any DB or Drive call**.
  - Order, so that R7 holds:
    1. The wrapper.
    2. Uuid check.
    3. Pool.
    4. Body and PNG validation (422).
    5. Org-scoped row lookup `for update` (404).
    6. `getDrive()`, where null gives 503 `images_unavailable`.
    7. Upload, with the server-chosen name `devtype-<typeId>-<random>.png` and mimeType fixed to `image/png`.
    8. A single update that sets the new id and `image_version = image_version + 1`, compare-and-set on the old id.
    9. After commit, a best-effort delete of the old file. If the update fails, a best-effort delete of the new file.
  - `DELETE /api/device-types/{id}/image` (admin, 204): DB first (`set null`, `version + 1`), then a best-effort Drive
    delete after commit. When Drive is off it still succeeds and leaves an orphan, which is logged.
  - Extend `deleteDeviceType` the same way.
  - `GET /api/device-types/{id}/image` (user):
    - Look up the file id with `org_id = scope.orgId`. A null id, another org, or a missing row gives 404.
    - `If-None-Match` equal to the ETag `"<id>-<imageVersion>"` gives 304 before any Drive call.
    - Otherwise `getFile`, then check the PNG signature on the bytes (a 5xx fixed code if it fails).
    - Response headers: fixed `Content-Type: image/png` (never Google's), `X-Content-Type-Options: nosniff`,
      `Cache-Control: private, no-cache`, the ETag, `Content-Disposition: inline`, `Content-Security-Policy: sandbox`.
  - Drive errors:
    - Every `DriveError` / `DriveConfigError` maps to a fixed 502 `drive_error` or 503 `images_unavailable`.
    - `err.code` is never forwarded.
    - **`drive_auth` never becomes 401/403.**
  - Tests: unit tests for `png.ts` and `readBytes`, handler tests with a fake `OrgDrive` (ordering, compare-and-set,
    cleanup on failure, no Drive call on 422), and DB tests for cross-org 404 and the version bump.
- ACs: ticket ACs 3 and 4 verbatim.
- **SIM-036.1 security-review follow-ups (`work/tickets/SIM-036.1/security-review.md:42-47`) as requirements:**
  1. Serve with a fixed `image/png` after the signature check, plus `nosniff`. Never echo Google's content type
     (CWE-79/434).
  2. Look up the file id by `org_id = scope.orgId` before `getFile`/`deleteFile` (R6).
  3. The server picks the Drive file name; a client filename is never used.
  4. `drive_auth` maps to a 5xx or domain code, never 401/403 (R7, `apiFetch` re-send).
  5. The prod secrets deploy (A6/M-46) lands before images go live.
- Follow-up beyond SIM-036.5: an orphan Drive file sweep job, and an optional `delete-impact` count for types in use.

Dependency note for the board: SIM-036.3 (admin page) can start after SIM-036.2 for the list, create, rename, slot
and delete, but its image picker needs SIM-036.5. SIM-036.4 can draw slots after SIM-036.2 and images after
SIM-036.5.
