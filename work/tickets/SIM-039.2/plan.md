Status: READY

# Plan — SIM-039.2: Map item catalog admin API

Gate: plan-approval (P1 policy). No High path is touched (no migration, nothing under `src/server/http/**`); the
assumptions A1-A9 below are the points Ming approves with the plan.

## Scope summary
- Ticket goal: "Admins rename, regroup, reorder, hide/show, reset, pick a package sprite per direction, and resize
  catalog items." Scope: "Admin-only write routes; names/groups validated; resize 1–4 × 1–4 (desk, chair, floors
  fixed), refused with 409 `item_in_use` (with room count) while placed; a resize deletes the item's custom images
  (OQ-52 default); audited."
- D67 (1): "catalog items are listed alphabetically by name" — so **no reorder action** (the Goal's "reorder" is
  superseded; SIM-039.1 plan A1 and sibling note for 039.2). Regroup stays.
- LAY-07 (`docs/spec-v1.md:456-484`): "name (unique in the org, case- and space-insensitive, at most 60 characters),
  group (at most 40 characters ...)"; "The Admin can rename, regroup and reorder items and groups, hide or show an item,
  change its size, set its art, and reset an item to the library defaults. Items are never deleted. Hiding only
  removes an item from the palette: placed fixtures of a hidden item keep drawing"; "**Size.** ... The Admin can set
  1–4 × 1–4 tiles ... Size is stored for rotation 0 ... A size change is refused with 409 `item_in_use` while any room
  has the item placed (the message says how many rooms ...). A size change removes the item's custom images ...
  Fixed sizes: `desk.single` ..., `chair.office` and `floor.*` (1 × 1) cannot be resized."; "**Art per direction.** For
  each direction the Admin picks a sprite from the bundled package browser (its frame must fit the item's size for
  that direction) ..."; "Every catalog change is audited (SYS-03) and is refused for any org but the token's (R6)."
- D66 (7): "a resize is refused with 409 `item_in_use` while any room has the item placed". OQ-52 default (Ming
  "mặc định", spec:720): "a size change (only possible while the item is not placed anywhere) deletes the item's custom
  images". OQ-53 default (spec:723): a smaller package sprite "draws at its own size, bottom-left aligned".
- D64 / D66 (6) / DEV-01 (device types picking a package sprite) are **not** in this ticket: that is SIM-039.7. Image
  upload/remove/serve is SIM-039.4; footprints in the layout save are SIM-039.3.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Each action works for Admin and is refused for Manager/User by the wrapper | `map-items-admin-routes.test.ts › 403 forbidden for user and manager on PATCH, PUT art, POST reset; service not called`; `› 401 without token (all three)`; `› admin PATCH/PUT/POST → 200 no-store with the DTO; service gets ctx.scope, ctx.sub and the key`; DB: `map-items-edit.db.test.ts › rename, regroup, hide/show, resize, art, reset each change the row and return the DTO` |
| 2 | Resize of a placed item → 409 `item_in_use`; of a fixed-size item → 422 | `map-items-edit.db.test.ts › resize of a placed item → 409 item_in_use with rooms = distinct room count; row unchanged; no audit`; `› fixed-size items (desk.single, chair.office, floor.wood) → 422 item_fixed_size; same size accepted as no-op`; route test `› 409 item_in_use body is { error: { code, rooms } }`, `› 422 item_fixed_size` |
| 3a | Every query scoped by the token's org (R6) | Code review: every statement in `src/server/map-items/edit.ts` goes through `orgQuery` with `org_id = $1`; no org from the request. `map-items-edit.db.test.ts › an edit in org A leaves org B's row unchanged; B's placements do not count for A's in_use` |
| 3b | Admin-only writes are audited | `map-items-edit.db.test.ts › every write adds exactly one audit row (map_item.update / map_item.art_set / map_item.reset) with entity map_item, entity_id null, meta.key; no-ops and refusals add none; meta holds no Drive id` |
| 3c | Checks green incl. `pnpm test:db` locally | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, and `pnpm test:db` against the local throwaway Postgres 16 cluster (Approach step 10); pass lines recorded in impl-log |

## Ming verification after merge
- None required for this ticket alone (no UI until SIM-039.6). Optional after release: as an Admin in the browser
  devtools, `PATCH /api/map-items/plant.large {"name":"Cây lớn"}` returns 200 and `GET /api/map-items` lists the new
  name; the Audit page shows a `map_item.update` row.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/map-items/types.ts` | modify (additive): `MAP_ITEM_LIMITS.bodyBytes = 1024`; `MAP_ITEM_DIRS`; types `MapItemPatchValue = { name?: string; group?: string; hidden?: boolean; w?: number; h?: number }`, `MapItemArtValue = { sprite: string \| null }` | shared lib types for validator, service, 039.6 UI | no |
| `src/lib/map-items/art.ts` | create: `sizeFor(dir, w, h)` (n/s → [w,h], e/w → [h,w]), `frameTiles(frameKey)` (`REGISTRY[k].tiles ?? [1,1]`), `artDirAllowed(item, dir)`, `spriteAllowedFor(item, frameKey)` (group/layer rule, A2), `spriteFits(frameKey, dir, w, h)` | pure art rules (rule 6), shared with 039.6 browser filter | no |
| `src/lib/map-items/art.test.ts` | create | unit tests of the art rules | no |
| `src/lib/validate/map-item.ts` | create: `isMapItemKey(s)`, `artDir(s)`, `validateMapItemPatch(body)`, `validateMapItemArt(body)` | boundary validation (`src/lib/validate/`, R1) | no |
| `src/lib/validate/map-item.test.ts` | create | validator unit tests | no |
| `src/lib/api/error.ts` | modify: add codes `item_in_use`, `item_fixed_size`, `item_name_taken`, `sprite_not_allowed`; `ApiErrorBody` gets optional `rooms?: number` | new refusals; `item_in_use` carries the room count (LAY-07 "says how many rooms") | no |
| `src/ui/copy/api.ts` | modify: English copy for the 4 new codes (typecheck forces it, `satisfies Record<ApiErrorCode,string>`) | D36 | no |
| `src/server/map-items/pg-error.ts` | create: `mapItemConflict(err)` → `"item_name_taken"` on 23505 `map_items_org_name_key` | DB backstop for the unique name | no |
| `src/server/map-items/pg-error.test.ts` | create | unit | no |
| `src/server/map-items/edit.ts` | create: `updateMapItem`, `setMapItemArt`, `resetMapItem` (+ local `inTx`, `Abort`, `EditRefusal`, `EditResult`) | the write service (`import "server-only"`) | no |
| `src/server/map-items/edit.test.ts` | create | mocked-Db tests: lock mode, statement order, no write before a refusal | no |
| `src/server/map-items/drive-cleanup.ts` | create: `discardMapItemFiles(drive, fileIds, key)` best-effort Drive delete, logs `{ event: "map_item_drive_orphan", key }` | OQ-52 image delete after commit (own copy, not a cross-feature import, A8) | no |
| `src/server/map-items/drive-cleanup.test.ts` | create | unit: never throws, logs orphan, Drive off | no |
| `src/server/map-items/map-items-edit.db.test.ts` | create | DB integration (`pnpm test:db`) | no |
| `src/app/api/map-items/[key]/route.ts` | create: `PATCH` | rename / regroup / hide / resize | no |
| `src/app/api/map-items/[key]/art/[dir]/route.ts` | create: `PUT` | package sprite per direction | no |
| `src/app/api/map-items/[key]/reset/route.ts` | create: `POST` | reset to library defaults | no |
| `src/app/api/map-items/map-items-admin-routes.test.ts` | create | route tests (mocked service) | no |

Read/imported only, not changed: `src/server/map-items/map-items.ts` (`COLS`, `Row`, `toDto`), `src/lib/map-items/library.ts`
(`libraryItem`, `LIBRARY_ITEMS`), `src/lib/sprites/registry.ts` (`REGISTRY`, `isFrameKey`), `src/server/http/respond.ts`,
`src/server/http/with-auth.ts`, `src/server/audit/write.ts`, `src/server/db/tx.ts`, `src/server/drive/drive.ts`,
`src/server/request/read-json.ts`, `src/test/db/fixtures.ts`. `src/app/api/routes-guarded.test.ts` picks up the three
new routes without an edit.

## Data model / migration
None. SIM-039.1 created every column this ticket writes (`name`, `group_name`, `w`, `h`, `hidden`, `art_<d>_sprite`,
`art_<d>_drive_file_id`, `art_<d>_image_version`, `updated_at`; `db/migrations/20261125200000_map_items.sql`) with the
CHECKs that back the validator (size 1–4, name ≤60 non-blank, group ≤40 non-blank, sprite regex, Drive id regex,
version ≥0) and the unique index `map_items_org_name_key` on `(org_id, device_type_key(name))`.

## API contract
Path param `key` = `builtinKey` (dotted, URL-safe). All routes `withAuth(..., { tier: "admin" })`,
`export const dynamic = "force-dynamic"`, success with `Cache-Control: no-store`. Refusals via `apiError` except
`item_in_use`, which the route builds as `Response.json({ error: { code: "item_in_use", rooms } } satisfies
ApiErrorBody, { status: 409, headers: NO_STORE })` (local helper in `[key]/route.ts` and `reset/route.ts`; `respond.ts`
is a High path and stays unchanged).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PATCH | `/api/map-items/[key]` | JSON, ≤1024 B, non-empty partial `{ name?, group?, hidden?, w?, h? }`, no other keys | `200 MapItemDto` | 400 `invalid_request` (body/validator); 404 `not_found` (bad key, key not in library, no row in org); 422 `item_fixed_size` (w/h differ from the library size of a fixed item); 422 `not_allowed` (`hidden: true` on `chair.office`, A5); 409 `item_in_use` + `rooms` (size changes while placed); 409 `item_name_taken`; 503 `unavailable` (no pool); 401/403 only from `withAuth` | Admin |
| PUT | `/api/map-items/[key]/art/[dir]` | JSON `{ sprite: string \| null }` (null = back to the library sprite) | `200 MapItemDto` | 400 `invalid_request` (not a frame key / format / extra key); 404 `not_found` (bad key/dir, no row); 422 `not_allowed` (dir ≠ `s` on a non-directional item); 422 `sprite_not_allowed` (wrong group/layer, or frame larger than the item's size for that dir); 503 | Admin |
| POST | `/api/map-items/[key]/reset` | no body (ignored) | `200 MapItemDto` | 404; 409 `item_in_use` + `rooms` (reset changes the size while placed); 409 `item_name_taken` (another item now holds the default name); 503 | Admin |

Semantics:
- Name/group: NFC, Unicode whitespace runs → one space, trimmed, no `\p{Cc}\p{Cf}`, 1..60 / 1..40 code points (same
  rule as `validate/device-type.ts:13-21`). Size: integer `MAP_ITEM_LIMITS.sizeMin..sizeMax`. `hidden`: boolean.
- A request that changes nothing returns the current DTO with no write and no audit (as `updateDeviceType`).
- Resize = new `(w ?? cur.w, h ?? cur.h)` differs from the current size. It: is refused 409 while placed; nulls all
  four `art_<d>_drive_file_id` and bumps `art_<d>_image_version` where a file was set (OQ-52); clears a package
  sprite that no longer fits the new size for its direction (A3); keeps the ones that fit.
- Reset = name, group, w, h from `libraryItem(key)`, `hidden = false`, all package sprites null, all custom images
  deleted (A1). A size change in a reset follows the resize rule (one code path).
- Hide/show has no in-use rule (placed copies keep drawing, LAY-07, D67 A4).
- Deleted Drive file ids are returned by the service and deleted after commit by `discardMapItemFiles` (never
  throws; works with Drive off; a failure is logged as an orphan). The response never contains a Drive id.

New `src/ui/copy/api.ts` texts: `item_in_use` "This item is placed in one or more rooms. Remove it from every room
before changing its size."; `item_fixed_size` "This item's size can't be changed."; `item_name_taken` "Another map
item already has this name."; `sprite_not_allowed` "This sprite can't be used for this item or doesn't fit its size."
(039.6 adds the room count from `error.rooms`.)

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `art.test.ts` › `sizeFor: n/s give [w,h], e/w give [h,w]` | rotation-0 size rule (D66.7) |
| `art.test.ts` › `artDirAllowed: directional item all four; non-directional only s` | 039.1 A3 |
| `art.test.ts` › `spriteFits: door.e fits door 1x2 at e; table.meeting.n does not fit a 2x2 item at n; prop.mug (tiles null) fits 1x1` | LAY-07 "frame must fit" |
| `art.test.ts` › `spriteAllowedFor: plant.small ok for plant.large; floor.wood ok for floor.carpet, refused for plant.large; plant.large refused for floor.carpet; avatar/device/state frames refused for every item` | A2 |
| `map-item.test.ts` › `isMapItemKey: accepts desk.single, wall.t.s; refuses "", "Door", "a..b", ".a", 101 chars, "../x"` | path param |
| `map-item.test.ts` › `artDir: n/e/s/w only` | path param |
| `map-item.test.ts` › `patch: name/group NFC + whitespace collapse + trim ("  Bàn \t làm  việc " → "Bàn làm việc"); 60/40 code-point limits with Vietnamese diacritics; blank, control and format chars refused` | Domain focus: diacritics, empty fields |
| `map-item.test.ts` › `patch: w/h integers 1..4 only (0, 5, 1.5, "2", null refused); hidden boolean only` | size bounds |
| `map-item.test.ts` › `patch: non-object, empty {}, extra key (e.g. "order", "builtinKey") → field` | strict body, no reorder |
| `map-item.test.ts` › `art: { sprite: null } ok; { sprite: "plant.small" } ok; unknown frame, "door" (base key of a directional item, not a frame key), bad format, missing sprite, extra key → invalid` | `isFrameKey` (039.1 A6) |
| `pg-error.test.ts` › `23505 map_items_org_name_key → item_name_taken; other 23505 / other codes / non-objects → null` | backstop |
| `drive-cleanup.test.ts` › `deletes each id; a failing delete logs map_item_drive_orphan with the key only and never throws; Drive off logs orphans; empty list does nothing` | OQ-52 cleanup, no secrets in logs |
| `edit.test.ts` › `rename/group/hide/art lock the row "for no key update"; a size change and a size-changing reset lock "for update"` | lock rules (039.1 sibling note) |
| `edit.test.ts` › `order for a resize: begin, item lock, in-use count, update, audit, commit; no room or seat lock, no map_item_catalogs statement` | deadlock rule |
| `edit.test.ts` › `refusals (not_found, item_in_use, fixed size, not_allowed, sprite_not_allowed) run no update and no audit` | no write before refusal |
| `map-items-admin-routes.test.ts` › `401 without token (PATCH, PUT, POST); service not called` | wrapper |
| `map-items-admin-routes.test.ts` › `403 forbidden for user and manager on PATCH, PUT art, POST reset; service not called` | AC1 |
| `map-items-admin-routes.test.ts` › `admin PATCH/PUT/POST → 200 no-store with the DTO; service gets ctx.scope, ctx.sub and the key` | AC1, R6 |
| `map-items-admin-routes.test.ts` › `bad key / bad dir → 404 before getPool; bad body → 400; no pool → 503` | boundary |
| `map-items-admin-routes.test.ts` › `refusals map to status+code; 409 item_in_use body is { error: { code: "item_in_use", rooms: 2 } } with no-store` | AC2 body shape |
| `map-items-admin-routes.test.ts` › `resize/reset success calls discardMapItemFiles with the returned ids after the service; a refusal does not call it` | after-commit delete |
| `map-items-edit.db.test.ts` › `rename, regroup, hide/show, resize, art, reset each change the row and return the DTO` | AC1 |
| `map-items-edit.db.test.ts` › `rename to another item's name differing only in case/spaces/diacritic capitals ("  DOOR ", "BÀN LÀM VIỆC" vs "Bàn làm việc") → 409 item_name_taken; row unchanged` | LAY-07 unique name, 23505 backstop |
| `map-items-edit.db.test.ts` › `resize of an unplaced item: w/h stored; the DTO shows the new size` | resize |
| `map-items-edit.db.test.ts` › `resize of a placed item → 409 item_in_use with rooms = distinct room count (2 fixtures in room A + 1 in room B → 2); row unchanged; no audit` | AC2 |
| `map-items-edit.db.test.ts` › `fixed-size items (desk.single, chair.office, floor.wood) → 422 item_fixed_size; same size accepted as no-op; rename of desk.single works` | AC2, A6 |
| `map-items-edit.db.test.ts` › `resize nulls all four drive ids, bumps the version only where a file was set, returns those ids; sprites that still fit stay, a sprite that no longer fits is cleared` (Drive ids set by SQL) | OQ-52, A3 |
| `map-items-edit.db.test.ts` › `art: set s on plant.large, set e/w on door, null clears; n on a non-directional item → 422 not_allowed; too-large frame → 422 sprite_not_allowed; art works while the item is placed` | art rules |
| `map-items-edit.db.test.ts` › `hide works while placed; hidden: true on chair.office → 422 not_allowed` | A4, A5 |
| `map-items-edit.db.test.ts` › `reset restores library name/group/size, hidden false, sprites null, images deleted (ids returned); reset of a placed resized item → 409 item_in_use; reset when another item holds the default name → 409 item_name_taken; reset of a default row is a no-op` | reset, A1 |
| `map-items-edit.db.test.ts` › `no-op patch and no-op art add no audit and do not touch updated_at` | no-op rule |
| `map-items-edit.db.test.ts` › `every write adds exactly one audit row (map_item.update / map_item.art_set / map_item.reset) with entity map_item, entity_id null, meta.key; refusals add none; meta holds no Drive id` | AC3b |
| `map-items-edit.db.test.ts` › `an edit in org A leaves org B's row unchanged; B's placements do not count for A's in_use` | AC3a, R6 |
| `map-items-edit.db.test.ts` › `a resize waits for an uncommitted placement insert of the item and then refuses item_in_use` (holder tx inserts a `layout_fixtures` row with the key, `waitForLockWait(pool, 5000)` is true, holder commits, resize → 409 rooms 1) | race (FK KEY SHARE vs FOR UPDATE) |
| `map-items-edit.db.test.ts` › `a rename does not wait for an uncommitted placement insert of the item` (holder tx open; rename resolves within 2 s via `Promise.race`; then holder commits) | NO KEY UPDATE never waits on saves |
| `map-items-edit.db.test.ts` › `unknown key with a row (inserted by SQL, not in the library) → 404` | `toDto` guard |

## Approach
1. `src/lib/map-items/types.ts`: add `bodyBytes: 1024` to `MAP_ITEM_LIMITS` (additive; `sql-sync.test.ts` only checks
   name/group/size), `export const MAP_ITEM_DIRS = ["n","e","s","w"] as const`, `MapItemPatchValue`, `MapItemArtValue`.
2. `src/lib/map-items/art.ts` (pure, imports `REGISTRY` and `LibraryItem`): `ALLOWED_GROUPS = new Set(LIBRARY_ITEMS.map(i
   => i.group))`; `spriteAllowedFor(item, k)` = `isFrameKey(k)` && group of `REGISTRY[k]` in `ALLOWED_GROUPS` &&
   `(REGISTRY[k].layer === "floor") === (item.kind === "floor")`; `spriteFits(k, dir, w, h)` = `frameTiles(k)` ≤
   `sizeFor(dir, w, h)` per axis. Tests per the table.
3. `src/lib/validate/map-item.ts`: copy the `isPlainObject` / `CONTROL_OR_FORMAT` / name normaliser shape of
   `validate/device-type.ts:10-21,40-58` with a `max` parameter (60 name, 40 group); `isMapItemKey` uses the DB regex
   `^[a-z0-9]+(\.[a-z0-9]+)*$` and length ≤100; `validateMapItemArt` checks `sprite === null` or (string matching
   `^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$` and `isFrameKey`). Return `Validated<T>` from `./room`.
4. `src/lib/api/error.ts` + `src/ui/copy/api.ts`: the four codes and texts; `ApiErrorBody = { error: { code: ApiErrorCode;
   rooms?: number } }` (`respond.ts` compiles unchanged).
5. `src/server/map-items/pg-error.ts`: mirror `device-types/pg-error.ts:1-10`.
6. `src/server/map-items/edit.ts` (`import "server-only"` first):
   - `inTx` + `Abort` as `device-types.ts:27-43`, mapping `mapItemConflict` to 409. `EditRefusal = { ok:false; status:
     404|409|422; code: "not_found"|"item_in_use"|"item_name_taken"|"item_fixed_size"|"not_allowed"|"sprite_not_allowed";
     rooms?: number }`. Values: `updateMapItem` / `resetMapItem` → `{ item: MapItemDto; discardFileIds: string[] }`,
     `setMapItemArt` → `MapItemDto`.
   - Pure checks before the transaction (no DB, no lock): `libraryItem(key)` null → 404; fixed item with w/h differing
     from the library size → 422 `item_fixed_size`; `hidden: true` on kind `chair` → 422 `not_allowed`; art dir not
     allowed → 422 `not_allowed`; `spriteAllowedFor` false → 422 `sprite_not_allowed`.
   - In the tx, one locked read: `select ${COLS}, art_n_drive_file_id, art_e_drive_file_id, art_s_drive_file_id,
     art_w_drive_file_id from map_items where org_id = $1 and builtin_key = $2 for update` when the request may change
     the size (patch has w or h for a non-fixed item; reset of a non-fixed item), else `for no key update`. No row →
     404. Compute the next row in TS; equal to current → return the DTO (no write, no audit).
   - Size changes: `select count(*)::int as n from (select room_id from layout_fixtures where org_id = $1 and
     sprite_key = $2 union select room_id from seats where org_id = $1 and sprite_key = $2) r` (plain select, served by
     `layout_fixtures_org_sprite_idx`); n > 0 → Abort 409 `item_in_use` with `rooms: n`. Then null the four file ids
     (collect the non-null ones; bump those versions) and clear sprites where `!spriteFits(sprite, d, w, h)`.
   - Art: `spriteFits(sprite, dir, cur.w, cur.h)` false → Abort 422 `sprite_not_allowed` (checked under the row lock, so a
     concurrent resize is serialised: FOR UPDATE vs FOR NO KEY UPDATE conflict).
   - One `update map_items set name, group_name, hidden, w, h, art_<d>_sprite ×4, art_<d>_drive_file_id ×4,
     art_<d>_image_version ×4, updated_at = now() where org_id = $1 and builtin_key = $2 returning ${COLS}`; `toDto`.
   - `writeAudit(c, scope, { actorSub, action, entity: "map_item", entityId: null, meta })` — `audit_log.entity_id` is
     `uuid` (`20261120150000_init.sql:215`), so the key goes in `meta.key`. Meta: update `{ key, fields, name?: {from,
     to}, group?: {from,to}, hidden?, size?: {from:[w,h], to:[w,h]}, imagesDeleted?, spritesCleared? }`; art_set `{ key,
     dir, from, to }`; reset `{ key, fields, imagesDeleted }`. Never a Drive id.
   - Never lock `rooms`, `seats` rows or `map_item_catalogs`; never call `map_items_seed` (a missing row is 404).
7. `src/server/map-items/drive-cleanup.ts`: `discardMapItemFiles(drive: () => OrgDrive | null, ids: string[], key:
   string)`, shaped like `device-types/image.ts:54-66` (`console.error(JSON.stringify({ event: "map_item_drive_orphan",
   key }))`), never throws.
8. Routes, modelled on `src/app/api/device-types/[id]/route.ts:16-31`: validate path params (404) → `getPool()` (503) →
   `readJson(req, MAP_ITEM_LIMITS.bodyBytes)` + validator (400; not for reset) → service → refusal (`item_in_use` via the
   local helper with `rooms`, others `apiError(r.status, r.code)`) → for update/reset `await
   discardMapItemFiles(getDrive, r.value.discardFileIds, key)` → `Response.json(dto, { headers: NO_STORE })`. R7: every
   401/403 comes from `withAuth` (`tier: "admin"`) before any side effect; all domain refusals are 404/409/422.
9. Tests per the table. Route test copies the `fakeAuth`/`vi.hoisted` mocks of
   `src/app/api/device-types/device-types-routes.test.ts:1-80`, mocking `@/server/map-items/edit`,
   `@/server/map-items/drive-cleanup`, `@/server/db/pool`. DB test copies `map-items.db.test.ts:1-40` (`seeded()`),
   places fixtures with the `addFixture` SQL of `layout.db.test.ts:48-53` after `addRoom`, and the holder pattern of
   `device-types.db.test.ts:188-202` with `waitForLockWait` (`src/test/db/fixtures.ts:129`).
10. **Local DB checks** exactly as SIM-039.1 plan step 11 (`/home/user/simap/work/tickets/SIM-039.1/plan.md:294-310`):
    throwaway PostgreSQL 16 cluster from `/usr/lib/postgresql/16/bin` in a fresh dir under `/var/tmp` (run as the
    `postgres` user when root), `listen_addresses=127.0.0.1`, port 55432, trust auth; `DATABASE_URL` passed inline
    only, never read or written to `.env*`; run `pnpm migrate && pnpm test:db`; stop the cluster and delete the dir.
    Record pass/fail lines (not the URL) in impl-log.
11. Run all Checks of `loop.config.md`.

Rules: R1 (lib rules/validator pure; routes are the only entry into `src/server/**`), R2 (no schema change), R3 (no new
config; Drive via existing `getDrive`), R4 (only the files above), R5 (tests above), R6 (`orgQuery` with `org_id = $1`
on every statement; org and Admin tier only from the verified token), R7 (wrapper-only auth codes).

## Sibling tickets (for their plans)
- **039.3** (layout save reads catalog sizes): use `for key share` on the referenced `map_items` rows, not `for share`
  as its ticket note says. `FOR KEY SHARE` conflicts only with this ticket's resize `FOR UPDATE` (so a save and a
  resize serialise), while `FOR SHARE` would also make every save wait on renames/hide/art (`FOR NO KEY UPDATE`). A
  hide racing a save can let one save place the just-hidden item; accepted (hide is palette-only). Lock order there
  stays room → seats → marker → items; this ticket locks only the item row, so no inversion.
- **039.4** (upload): its compare-and-set must also compare `w` and `h` (the PNG size was checked against them before
  the upload), because a resize between the check and the CAS may leave the file id null and the CAS would otherwise
  succeed with an image of the old size. It can reuse `discardMapItemFiles`. A resize/reset nulls file ids, so an
  in-flight upload CAS fails with `image_changed` as intended.
- **039.6** (admin page): read `error.rooms` for the `item_in_use` message; disable resize for `fixedSize`, hide for
  `kind === "chair"`, n/e/w art for non-directional items; filter the sprite browser with `spriteAllowedFor` +
  `spriteFits`; warn before resize/reset that custom images are deleted (OQ-52) and that sprites that no longer fit are
  cleared (A3). No reorder UI (D67 1).
- **039.7**: device types picking a package sprite may reuse `src/lib/map-items/art.ts` rules; no overlap otherwise.

## Specialist input used
- api 1 (PATCH `[key]` with partial `name/group/hidden/w/h`, key regex → 404, missing/unknown row → 404): adopted.
- api 2 (art route): adopted as `PUT .../art/[dir]` per direction (Open question 4: per direction matches 039.4's
  per-direction upload/CAS and the per-direction picker); `isFrameKey` in the validator (400), group/layer/fit as 422
  `sprite_not_allowed` (A2).
- api 3 (POST reset reusing the resize path; `item_name_taken` on collision): adopted; reset also deletes images (A1).
- api "fixed_size" code: adopted as `item_fixed_size` (prefixed like the other new codes); checked before the tx.
- api `name_taken` reuse: **rejected**; its copy says "device type", so a new `item_name_taken` code.
- api "check how apiError carries extra fields": it cannot (`respond.ts:5-11`, High path); routes build the
  `item_in_use` body with `rooms` and `ApiErrorBody` gets an optional `rooms`.
- api locks (`for update` for resize, `for no key update` otherwise, no room/seat/marker lock, no seed call): adopted.
- api in-use count incl. `seats`: adopted (one union query).
- api resize image deletion + after-commit Drive delete with own helper: adopted (`drive-cleanup.ts`).
- api audit with `entityId: builtinKey`: **corrected** — `audit_log.entity_id` is uuid, so `entityId: null` and
  `meta.key`. Resize folded into `map_item.update` (one action per request; a PATCH can rename and resize at once).
- api package sprites stay on resize: adopted for sprites that still fit; non-fitting ones cleared (A3).
- api tests list: adopted (validator, pg-error, route, mocked service, DB incl. race).
- api Open questions 1, 2, 5, 6 resolved as A1, A2, A6, A4/A5; 3 resolved in the API contract.

## Assumptions
For Ming at the plan-approval gate (each reversible, with the alternative):
- **A1 Reset deletes custom images** (and clears package sprites): "reset to the library defaults" and LAY-03 "no
  custom art" for the library state. Alternative: reset keeps uploaded images and only resets name/group/size/hidden/
  sprites — but a size-changing reset would delete them anyway (OQ-52).
- **A2 Which package sprites an item may pick:** any bundled frame (today: `keys.json` frames) of a catalog group
  (desk, chair, floor and the fixture groups; never avatar, device or state overlays), floor frames only for floor
  items and only floor frames for floors, and the frame must fit the item's size for that direction (LAY-07). So a
  plant may wear a sofa sprite that fits. Alternative: only frames of the item's own group.
- **A3 Resize keeps package sprites that still fit, clears the ones that no longer fit** (smaller sprites draw
  bottom-left aligned, OQ-53; LAY-07 requires a fit when picking). Alternative: refuse the resize while a chosen
  sprite would not fit.
- **A4 Hide/show** is allowed while the item is placed (placed copies keep drawing, LAY-07/D67) and for `desk.single`
  and floors (removes them from the palette only).
- **A5 `chair.office` cannot be hidden** (422 `not_allowed`): it is never in the palette, and with D67 (2) a hidden
  chair row would disappear from non-Admins' `GET /api/map-items`, losing the chair art on their maps. Showing it
  (`hidden: false`) is accepted.
- **A6 Rename/regroup work for every item, fixed-size ones included**; a fixed item's PATCH with its unchanged library
  size is accepted (a full-form submit), only a different size is 422.
- **A7 No reorder** (D67 1); an `order` key in a PATCH is 400 like any unknown key.
- **A8 Own Drive cleanup helper** in `src/server/map-items/` (event `map_item_drive_orphan`) rather than importing
  `device-types/image.ts`; 039.4 reuses it. In 039.2 no image can be uploaded yet, so the deletion path is exercised
  only with ids set by SQL in tests.
- **A9 Size of change** ≈ 1,300 lines, about 60 % tests; product code ≈ 500. Kept as one ticket (Size M); see Split.
- `toDto` drops rows whose key is not in the library; writes to such a row return 404 (cannot happen through seeding).
- Spec/decision conflict flagged: the ticket Goal and LAY-07 say "reorder"; D67 (1) (newer, Ming) removes ordering.
  The ticket note "layout save reads sizes with `for share`" is better done with `for key share` (039.3 note above).
- Hotspots: the only open ticket, SIM-037.9 (IN_PROGRESS, UI), does not touch these files. `src/lib/api/error.ts` and
  `src/ui/copy/api.ts` are shared append-only lists; SIM-037.4/037.5 (BACKLOG) will likely add codes there too — a
  trivial rebase if they run in parallel.

## Blocking questions
None.

## Split proposal
None. Possible cut if the reviewer wants smaller PRs: (a) PATCH + reset (+ validator, pg-error, drive cleanup, codes),
(b) the art route and `src/lib/map-items/art.ts` (~350 lines with tests). Not proposed: resize needs `spriteFits`
from (b) for A3, so (a) would carry half of (b) anyway.
