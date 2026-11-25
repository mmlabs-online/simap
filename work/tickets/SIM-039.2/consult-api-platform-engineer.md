## Findings

Sources read: the SIM-039.2 ticket, the SIM-039.1 plan (sibling-impact and A-notes), `20261125200000_map_items.sql`, `src/server/map-items/map-items.ts`, `src/lib/map-items/{library,types}.ts`, `src/app/api/map-items/route.ts`, D67, and the device-types server, route, validator, pg-error and image files. I did not read the 039.1 tests or `with-auth.ts`.

**What 039.1 already provides**
- Table `map_items` has the composite PK `(org_id, builtin_key)`.
  - The columns `name`, `group_name`, `w`, `h`, `hidden` and the 12 art columns exist, so 039.2 needs no migration.
  - Check constraints cover size 1–4, name ≤60 non-blank, group ≤40 non-blank, the art sprite regex and the version ≥0.
  - Unique index `map_items_org_name_key` is on `(org_id, device_type_key(name))`.
  - No `sort_order`. D67(1) orders alphabetically, so the Goal's "reorder" is dropped.
- Marker table `map_item_catalogs` is seeded by `map_items_seed(org)`.
- FKs `layout_fixtures_map_item_fkey` and `seats_map_item_fkey` are `on delete restrict` on `(org_id, sprite_key)`.
  - Index `layout_fixtures_org_sprite_idx` already serves the room count for `item_in_use`.
  - Only `desk.single` is ever a seat, and it is fixed size.
- `src/lib/map-items/library.ts` exports `libraryItem(key)`, which gives the defaults for reset (name, group, w, h), plus `kind`, `directional` and `fixedSize`.
  - `fixedSize = kind !== "fixture"`, so desk, chair and floors are fixed.
- `src/server/map-items/map-items.ts` exports `COLS` (never selects a drive file id, only `has_image`), `Row`, `toDto` and `listMapItems`.
  - `toDto` returns null when the key is not in the library. 039.2 should reuse `COLS` and `toDto` for write responses.
- `MAP_ITEM_LIMITS` is in `src/lib/map-items/types.ts`. The DTO is additive-only.
- The existing `GET /api/map-items` is `withAuth(..., { tier: "user" })`, with `includeHidden` set when `ctx.tier === "admin"`.
- The 039.1 plan says 039.2 needs no reorder, and that these lock rules apply:
  - Resize takes `for update` on the item row. The FK's `FOR KEY SHARE`, taken by every layout save that inserts a placement, then serialises the two.
  - Rename, group, hide, art and reset take `for no key update`, so they never wait on layout saves.
  - 039.2 must not take a room or seat lock after the `map_item_catalogs` marker. Layout save locks room, then seats, then marker.

**Device-types pattern to copy**
- A route per resource, `[id]/route.ts`, with `withAuth<{id}>(handler, { tier: "admin" })`. The order inside is:
  1. Validate the path param and return 404 `not_found`.
  2. `getPool()`, or 503 `unavailable`.
  3. `readJson(req, LIMITS.bodyBytes)`, then a validator, either failing with 400 `invalid_request`.
  4. A service call that returns `Result`. Refusals go out through `apiError(r.status, r.code)`.
  5. A 200 `Response.json` with `Cache-Control: no-store`.
- `export const dynamic = "force-dynamic"`.
- Services use `inTx(db, fn)`, with `class Abort` carrying a `Refusal`. The `Result` and `Refusal` types are local to `device-types.ts`, and map-items has its own `Result` with only `ok: true`, so 039.2 must widen it.
- A pg-error mapper turns 23505 on `device_types_org_name_key` into 409 `name_taken` as a DB backstop. The map-items equivalent is the constraint `map_items_org_name_key`.
- Audit: `writeAudit(c, scope, { actorSub, action, entity, entityId, meta })` runs inside the same tx. `action` and `entity` are free strings. The convention is `device_type.update` with `meta.fields`, plus `from`/`to` for a name change. `meta` holds codes, field names and counts only.
- A no-op patch (nothing changed) returns the current DTO with no write and no audit.
- Name validation: NFC, whitespace collapsed, trimmed, no `\p{Cc}\p{Cf}`, ≤60 code points. A group validator should use the same rule with limit 40.
- Validators sit in `src/lib/validate/`, return `Validated<T>`, reject extra keys and reject an empty patch (`field: "body"`).

## Recommendations

Route shape (admin tier, all `no-store`; the library key has dots, so it is URL-safe):
1. `PATCH /api/map-items/[key]` with a partial body of `name`, `group`, `hidden`, `w`, `h`. The patch is non-empty and extra keys are refused.
   - `[key]` is validated with the map_items key regex `^[a-z0-9]+(\.[a-z0-9]+)*$` and length ≤100. Anything else is 404 `not_found`.
   - A missing row is 404 `not_found`. This also covers a key that is not in `libraryItem`, because `toDto` returns null for it.
2. `PUT /api/map-items/[key]/art/[dir]`, body `{ sprite: string | null }`, where `dir` is n/e/s/w.
   - The sprite must be a frame key, checked with `isFrameKey` from `src/lib/sprites/registry.ts` (A6: the existence check belongs to 039.2). It should also be a frame of that item's library family, or at least an existing one. The planner should decide how loose this is; see Open questions.
   - A non-directional item allows only `s`, and n/e/w give 422. A null sprite clears the package sprite for that direction.
   - Prefer one `PATCH .../art` body such as `{ n?, e?, s?, w? }` if the UI saves per item. This is a plan choice.
3. `POST /api/map-items/[key]/reset` restores name, group, w, h and `hidden=false` from `libraryItem`.
   - Clear the package sprites. Deciding what happens to custom images is an Open question.
   - A reset that changes w/h must follow the same in-use rule as a resize, so reuse one code path.
   - A reset can hit 409 `name_taken` if another item now has the default name. Return the same code.
   - `hidden` is a patch field, so no separate hide/show route is needed.

Refusals and status codes:
- Resize w/h on an item with `fixedSize` returns 422 with a distinct code. Suggest `fixed_size`. Never use 401/403 after a write (R7). This check needs no DB lock, so it can precede the tx.
- If the resize leaves w/h unchanged, treat it as a no-op. Otherwise lock the row `for update`, then count rooms in `layout_fixtures where org_id=$1 and sprite_key=$2` (distinct `room_id`). A positive count gives 409 `item_in_use` with `{ rooms: n }`.
  - Check how `apiError` carries extra fields. It may need a body-extension helper, and none exists in what I read.
  - Also count `seats` for completeness, though only `desk.single` is a seat and it is fixed.
- Size is validated as an integer 1–4 using `MAP_ITEM_LIMITS` (the DB check backs it).
- The same-name rule is a pg-error mapper for 23505 on `map_items_org_name_key`, giving 409 `name_taken`. Name validation also needs a lib validator in `src/lib/validate/map-item.ts`.

Resize deletes custom images (OQ-52 default):
- In the same tx, null `art_<d>_drive_file_id` for all four directions and bump `art_<d>_image_version` for the ones that had a file.
- Return the old Drive file ids from the service, as `deleteDeviceType` returns `imageFileId`, and best-effort delete them after commit with a `discardImageFile`-style helper. A failure is logged as an orphan.
- `discardImageFile` in `device-types/image.ts` is typed per `typeId` and logs `drive_orphan`. Generalise it, or write a map-items copy with its own event name, rather than importing across feature folders without a decision.
- Package sprites (`art_*_sprite`) stay on a resize. Confirm this.
- Audit meta for resize: `{ fields: ["w","h"], from: [w,h], to: [w,h], imagesDeleted: n }`.

Locks and ordering:
- Rename, group, hidden and art use `select ... for no key update`. Resize uses `for update`. The `select ... for update` runs by `(org_id, builtin_key)` through `orgQuery`, so every query is scoped (R6).
- Do not lock `map_item_catalogs` in an order that conflicts with layout save (room, seats, marker). The simplest safe choice is not to touch the marker at all in 039.2. Items are never created, so no cap check is needed.
- Optionally run the same `map_items_seed` safety net first, but only if it is the first statement and never after a room/seat lock. It is not needed, because a missing catalog gives 404.

Audit actions (one per write, same tx, `entity: "map_item"`, `entityId: builtinKey`):
- `map_item.update` with `fields`.
- `map_item.reset`.
- `map_item.resize`, or fold it into update with `fields` containing `w` and `h` (the planner chooses; a dedicated action eases filtering).
- `map_item.art_set` with `{ dir }`.
- No-ops write no audit.

Tests to plan:
- Unit: the validator (name, group, size range, extra keys, empty body, dir, sprite format, `isFrameKey`) and the pg-error mapper.
- Route tests (mirror `device-types-routes.test.ts`): Admin allowed; Manager and User get 403 from the wrapper; 400/404/409/422 mappings; no pool gives 503.
- Service tests with a mocked `Db`, as in `layout/save.test.ts`.
- DB tests (`map-items.db.test.ts` style, plus a manual `pnpm test:db`): cross-org isolation, `item_in_use` with count, resize unplaced then placed, fixed-size 422, name collision case/whitespace-insensitive, concurrent resize vs insert-placement, resize clears image columns, reset, and audit rows.
- Extend `sql-sync.test.ts` only if reset defaults are mirrored in SQL. `libraryItem` should serve reset, so no SQL change is needed.

## Risks
- A mismatch between the registry frame size and the stored `w`/`h`: 039.1 seeded from `footprintOf(key, 0)`. A resize changes only the catalog row, and layout save (039.3) must read the catalog size. Both are in sibling scope, so call it out in the plan's sibling notes.
- Resize deadlock or race: a layout save locks room, seats, then the marker and FK share-locks the item row. A resize holding `for update` on the item and then touching a room would invert the order. The resize must lock only the item row, and its room count is a plain select.
- A late 401/403 would repeat writes (R7). All of these refusals must be 4xx domain codes (409/422) or come from `withAuth`.
- Drive deletion after commit can leave orphans. This is accepted and logged, as in device types. If Drive is off, resize must still work, like `removeDeviceTypeImage`.
- `hidden=true` on an item already placed: placed copies still draw (D67, A4). The PATCH must not refuse it. Confirm there is no `item_in_use` rule for hide.
- `toDto` drops rows whose key is not in the current library. A write to such a row returns 404, which is acceptable, and the plan should say so.
- This ticket touches `src/server/**` and an audited, Admin-only path, with no migration. Check the High-path list in `loop.config.md` for `src/app/api/**` auth paths. The ticket gate is plan-approval.

## Open questions
1. Does reset also delete custom images, or only clear package sprites? OQ-52 covers only resize.
2. Are package sprites limited to frames of the same item family (for example a `desk.single.*` frame), or is any registry frame allowed? A broader choice means a desk could be given a wall sprite. Suggest allowing any frame whose group matches the item's group, or any frame at all if the admin goal is free reskinning. Ming or the planner decides.
3. Should the `fixed_size` 422 code be a new code name, and is the `item_in_use` body shape `{ code, rooms }`? Check `apiError`'s signature and the Vietnamese or English UI copy for 039.5.
4. One art route per direction, or one body with all four? This depends on how the 039.4 upload flows (per direction, compare-and-set). Per direction matches that.
5. Does a rename or regroup of an item that is not editable (a fixed-size one) work? The Goal says rename and regroup apply to all items, and only resize is restricted. Assume yes.
6. Does hide apply to `desk.single`, chair and floors? The 039.1 plan says the palette is kind seat/fixture and not hidden, so hiding the only desk would block adding desks. Decide whether to refuse hiding `seat` items (422), or allow it.

Files referenced (absolute):
- /home/user/simap/work/tickets/SIM-039.2/ticket.md
- /home/user/simap/work/tickets/SIM-039.1/plan.md
- /home/user/simap/db/migrations/20261125200000_map_items.sql
- /home/user/simap/src/server/map-items/map-items.ts
- /home/user/simap/src/lib/map-items/library.ts
- /home/user/simap/src/lib/map-items/types.ts
- /home/user/simap/src/app/api/map-items/route.ts
- /home/user/simap/src/server/device-types/device-types.ts
- /home/user/simap/src/server/device-types/pg-error.ts
- /home/user/simap/src/server/device-types/image.ts
- /home/user/simap/src/app/api/device-types/[id]/route.ts
- /home/user/simap/src/lib/validate/device-type.ts
- /home/user/simap/src/lib/validate/layout.ts
- /home/user/simap/src/lib/sprites/registry.ts
- /home/user/simap/work/decisions.md (D67 at line 74)
