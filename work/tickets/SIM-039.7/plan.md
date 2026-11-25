Status: READY

# Plan: SIM-039.7, Device types: pick a bundled package sprite

## Scope summary
- `docs/spec-v1.md` DEV-01 (L270-273): "An Admin manages the catalog: add, rename, change the desk slot, delete (... an
  optional square PNG image ... or a device sprite picked from the bundled package, D66; image first, then the picked
  sprite, then the slot's built-in sprite)."
- `docs/spec-v1.md` "Art per item" (L397-402): "Each map item (LAY-07) and each device type (DEV-01) gets its art from a
  sprite of the **bundled package** ... or from a **custom image** the Admin uploads ... The overlay sprites (seat
  state, avatars, device placeholder) stay built-in and are not chosen per item."
- `docs/spec-v1.md` LAY-06 (L437-439): "Every device placed at a seat is drawn on its desk, one sprite per device, at its
  catalog type's slot and image (built-in sprite when the type has no image); a device whose type is not in the catalog
  draws as the square placeholder." L444: "Art changes show at the next layout load."
- `work/decisions.md` D66 (6): "Device types can also pick a bundled package sprite." D66 (1): "placed fixtures keep
  storing `sprite_key` (expand-only, saved layouts unchanged)". OQ-50 answered by D66.
- D61 (1)/(2): slot drives where a device is drawn; "Devices are never touched" by catalog edits.
- Ticket scope: "Column for the chosen sprite key, API and the device types page picker (reuses the 039.6 sprite
  browser); renderer fallback image -> sprite -> slot sprite." Out of scope: admin-created kinds, per-desk art, any
  change to how placed fixtures are stored.

The "bundled package" today is the committed atlas described by `src/lib/sprites/keys.json` (SIM-033 will swap the
real art in under the same keys). Its `device` group holds: `device.laptop.{n,e,s,w}`, `device.monitor.{n,e,s,w}`,
`device.monitor.dual`, `device.other`, `device.pc`, `device.phone` (keys.json L210-305), all 1 x 1 (`tiles: null`).

## Acceptance criteria -> verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A device type with a picked sprite draws it on desks, facing the desk for directional families. | `device-slots.test.ts` > "packageSprite: directional family follows the desk" and "non-directional family draws its own key"; `layout.db.test.ts` > "seat devices carry the type's sprite"; manual check M2. |
| 2 | Upload still wins: with an image the image is drawn; while it loads (or fails) the placeholder is drawn, never the sprite; removing the image reveals the pick with no extra write. | `device-slots.test.ts` > "image wins over sprite", "image not ready with sprite: placeholder"; `device-types.db.test.ts` > "image set/clear keeps sprite_key"; manual M3. |
| 3 | Fallback: no pick, or a stored family the registry no longer knows, draws the slot's built-in sprite (never throws). | `device-sprites.test.ts` > "deviceFrameKey unknown family -> null"; `device-slots.test.ts` > "unknown family falls back to the slot sprite". |
| 4 | Admin can set, change and clear (`null`) the sprite on PATCH and set it on POST; only allowed device families are accepted (400 bad shape, 422 `sprite_not_allowed` for a well-formed but not allowed key, before any write). | `device-type.test.ts` (validator), `device-types-routes.test.ts` new cases, `device-types.db.test.ts` > "sprite: set, change, clear, refused". |
| 5 | Every query is scoped by the token's org (R6): a cross-org id is 404 and not written. | `device-types.db.test.ts` > "sprite patch with another org's id -> 404, row unchanged". |
| 6 | Admin-only writes are audited: `device_type.update` with `fields` incl. `"sprite"` and `meta.sprite {from,to}`; create audits `sprite` when set; unchanged patch writes no audit. 401/403 for non-admins come from the wrapper before the body is read (existing tests). | `device-types.db.test.ts` audit assertions; existing `device-types-routes.test.ts` 401/403 cases stay green. |
| 7 | Device types dialog: a picker lists "Built-in for the slot" plus each allowed family with an atlas thumbnail; it notes when an uploaded image hides the pick and when a stored pick is unavailable. | `DeviceTypeSpriteField.test.tsx`, `device-type-sprite.test.ts`, `DeviceTypeFormDialog.test.tsx` new case; manual M1. |
| 8 | Migration is expand-only and the constraint works. | `sql-sync.test.ts` new case; `pnpm migrate` + `pnpm schema:check` locally (new check 9 "bad sprite_key refused"); `pnpm test:db` locally. |
| 9 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, `pnpm test:db` (local Postgres). |

## Ming verification after merge
None beyond the normal release: the migration applies on deploy (Ming's step). Optional spot check on production: pick
a sprite for one type and see it on a room map.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261125230000_device_type_sprite.sql` | New: add `device_types.sprite_key` + check (SQL below). | Stores the pick (DEV-01). | **Yes** |
| `db/migrations/README.md` | One bullet under "Schema (v1)" for `sprite_key` (family base, null = slot sprite, no FK). | Keep schema notes current. | **Yes** (`db/migrations/**`) |
| `scripts/schema-check.mjs` | Section 9 (near L598-608): insert with `sprite_key=' x'` refused `23514 device_types_sprite_key_check`; insert with `'device.laptop'` and null accepted. Near L128: "1 later run applies device_type_sprite". | Scripted check of the real schema. | No |
| `src/lib/validate/map-item.ts` | L16: `export const SPRITE_KEY_RE` (rename the local `SPRITE`, update its one use at L78). | Share the key format, do not copy it. | No |
| `src/lib/sprites/device-sprites.ts` | New, pure: `DEVICE_SPRITE_FAMILIES`, `deviceSpriteAllowed(family)`, `deviceFrameKey(family, dir)`. | Family rule and per-facing resolution in one place. | No |
| `src/lib/sprites/device-slots.ts` | L69-72 add `{ type: "packageSprite"; family: string }` to `DeviceArt`; L85 branch; L136-141 key resolution. | Renderer fallback. | No |
| `src/lib/sprites/layout.ts` | L38-43 `SeatDeviceType` gets `sprite: string \| null`. | Layout payload carries the pick. | No |
| `src/lib/sprites/map-view.ts` | L71-81 `toDeviceType`: `sprite` = string matching `SPRITE_KEY_RE`, else `null` (missing field -> null). | Client parse of the layout payload. | No |
| `src/lib/device-types/types.ts` | L20-32: `DeviceTypeDto.sprite: string \| null`; `DeviceTypeCreateValue` gets optional `sprite?: string \| null` (patch inherits it). | DTO and request value. | No |
| `src/lib/validate/device-type.ts` | Accept `sprite` key in create and patch: absent, `null`, or a string matching `SPRITE_KEY_RE`; else `{field:"sprite"}`. | Boundary shape check (400). | No |
| `src/server/device-types/device-types.ts` | `Refusal` adds `422`/`"sprite_not_allowed"`; `Row`/`COLS`/`toDto` add `sprite_key`; create inserts it; update compares/writes `$5`; audit meta; allowed-family check before `inTx`. | Server write + R6/R7. | No (`device-types` is not `auth*`) |
| `src/server/layout/layout.ts` | L126-161: select `t.sprite_key`, map to `deviceType.sprite`. | Map gets the pick, org-scoped by the existing `t.org_id = $1`. | No |
| `src/ui/deviceTypes/device-type-sprite.ts` | New, pure: `spriteFieldView({ value, slot, imageShown })` -> options (`null` + families, each with preview frame key `deviceFrameKey(x,"s")` and label), `unavailable`, `hiddenByImage`. | Testable view logic. | No |
| `src/ui/deviceTypes/DeviceTypeSpriteField.tsx` | New: fieldset + radiogroup, `FramePreview` thumbnails (from SIM-039.10) when an atlas is given, notes. Props only. | The picker. | No |
| `src/ui/deviceTypes/device-type-form.ts` | `DeviceTypeForm.sprite`; `emptyForm` null; `formFromType`; `toPatchBody` sends `sprite` when changed; `fieldMessage("sprite")`. | Form state + changed-fields-only patch. | No |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` | New `atlas` prop; render `DeviceTypeSpriteField` after the image field; `imageShown = draft.kind === "replace" \|\| (draft.kind === "keep" && current?.hasImage)`. | Wire picker into the dialog. | No |
| `src/ui/deviceTypes/DeviceTypesPage.tsx` | `const { atlas } = useAtlas()` (from `../roomlayout/useAtlas`, as `MapItemsPage.tsx` L43) and pass `atlas` to the dialog. | Thumbnails. | No |
| `src/ui/copy/deviceTypes.ts` | `form.sprite` strings (legend, builtIn(slot), hint, hiddenByImage, unavailable(key), frameAlt(key)); `fieldErrors.sprite`. | UI copy lives in copy files (D36). | No |
| Test fixtures (add `sprite: null`) | `device-slots.test.ts` L104-110, `map-view.test.ts`, `placement.test.ts`, `catalog-images.test.ts`, `LayoutEditorViews.test.tsx`, `layout.db.test.ts`, `DeviceTypesView.test.tsx`, `device-type-form.test.ts`, `device-type-save.test.ts`, `device-types-api.test.ts`, `device-types-routes.test.ts`, `image-routes.test.ts`, `server/device-types/image.test.ts`, `image.db.test.ts` (only where a DTO/`SeatDeviceType` literal or a `toEqual` on one exists). | Required field on two types. | No |
| New/extended tests | Listed under "Tests to write". | R5. | No |

Not touched: the route files `src/app/api/device-types/route.ts` and `[id]/route.ts` (they already pass `v.value` and
map `r.status`/`r.code`; `sprite_not_allowed` is already in `src/lib/api/error.ts` L62 and `src/ui/copy/api.ts` L73),
`src/server/device-types/image.ts` (uses the shared `COLS`/`toDto`, so it returns `sprite` automatically),
`pg-error.ts` (a check violation is not a domain refusal; the validator and the allowed check stop bad values first),
`SpriteBrowser.tsx`, `src/lib/map-items/art.ts` (`spriteAllowedFor` keeps excluding `device` frames).

## Data model / migration
`db/migrations/20261125230000_device_type_sprite.sql`:

```sql
-- SIM-039.7 / D66 (6), DEV-01: a device type may pick a bundled package sprite. Art order on the desk: uploaded image,
-- then this pick, then the slot's built-in sprite. Expand-only: one nullable column, no default, no backfill
-- (null = the slot's built-in sprite); the previous image never selects or writes it, so it keeps working.
-- The value is a sprite family base (e.g. 'device.laptop'); the renderer adds the desk direction for directional
-- families. Same key format as map_items_art_sprite_check (SPRITE_KEY_RE in src/lib/validate/map-item.ts, checked by
-- a test). No FK: keys live in the sprite registry; which families are allowed is checked in src/lib.
alter table device_types
  add column sprite_key text null,
  add constraint device_types_sprite_key_check
    check (sprite_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$');
```

- Column `sprite_key text null`, no default; constraint `device_types_sprite_key_check` (null passes). No index (read
  by primary key / org-scoped join only). No `org_id` change (table already has it; R6 holds).
- Cost: adding a nullable column without default is metadata-only; the check scans at most 100 rows per org.
- Downgrade: none (forward-only). Rollback = previous image, which ignores the column. A later contract migration is
  only needed if the column is ever dropped.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/device-types` | - | `{ items: DeviceTypeDto[] }`, each now has `sprite: string \| null` | 200 | user+ (unchanged) |
| POST | `/api/device-types` | `{ name, slot, sprite? }`, `sprite` = family base or `null` | `DeviceTypeDto` | 201; 400 `invalid_request` (bad shape/unknown field); 422 `sprite_not_allowed`; 409 `name_taken`/`type_limit` | admin |
| PATCH | `/api/device-types/{id}` | non-empty partial of `{ name, slot, sprite }`; `sprite: null` clears | `DeviceTypeDto` | 200 (also when unchanged, no audit); 400; 404 `not_found`; 422 `sprite_not_allowed`; 409 `name_taken` | admin |
| PUT/DELETE/GET | `/api/device-types/{id}/image` | unchanged | `DeviceTypeDto` now includes `sprite` (unchanged value) | unchanged | unchanged |
| GET | `/api/rooms/{id}/layout` | unchanged | `seatDevices[*].deviceType` gains `sprite: string \| null` | unchanged | unchanged |

401/403 (`unauthenticated`, `forbidden`, ...) stay in `withAuth`, before the body is read (R7). The 422 comes from the
domain function before `inTx` opens, so no write or audit happens before a refusal.

## Tests to write
| Test (file > name) | Covers |
|---|---|
| `src/lib/sprites/device-sprites.test.ts` > "families are the device group bases" | `DEVICE_SPRITE_FAMILIES` equals `["device.laptop","device.monitor","device.monitor.dual","device.other","device.pc","device.phone"]`; every family resolves to an existing 1 x 1 frame for each of n/e/s/w. |
| same > "deviceSpriteAllowed" | true for each family; false for a direction frame key (`device.laptop.s`), a non-device frame (`plant.large`, an avatar/state key), `""`, `"device"`, unknown `device.printer`. |
| same > "deviceFrameKey" | `("device.laptop","e")` -> `device.laptop.e`; `("device.pc","n")` -> `device.pc`; `("device.monitor.dual","w")` -> `device.monitor.dual`; unknown family -> `null`. |
| `src/lib/sprites/device-slots.test.ts` > resolveDeviceArt: "no image, sprite set: packageSprite at the type's slot" | Fallback step 2; `kind` stays `t.slot` (slot drives position). |
| same > "image wins over sprite" / "image not ready with sprite: placeholder" | AC2. |
| same > placeDevices: "packageSprite: directional family follows the desk" (all 4 dirs), "non-directional family draws its own key", "unknown family falls back to the slot sprite", "packageSprite on a pc slot keeps the pc slot offsets" | AC1, AC3, slot/art independence. |
| `src/lib/sprites/map-view.test.ts` > "deviceType.sprite: string kept; missing, non-string or malformed -> null" | Parser default (older payloads). |
| `src/lib/validate/device-type.test.ts` > "sprite on create and patch" | absent; `null`; `"device.laptop"`; non-string (`1`, `{}`); `" x"`, `""`, 121 chars -> field `sprite`; patch `{ sprite: null }` alone is non-empty and valid; combined `{ name, slot, sprite }`; unknown key still refused. Note: shape only, `"plant.large"` is valid here (422 later). |
| `src/app/api/device-types/device-types-routes.test.ts` > "sprite: PATCH and POST forward it; bad shape 400 without service call; 422 sprite_not_allowed mapped" | Route plumbing; existing 401/403-before-body tests unchanged. |
| `src/server/device-types/sql-sync.test.ts` > "sprite migration uses SPRITE_KEY_RE" | Migration literal equals `SPRITE_KEY_RE.source`; constraint name present. |
| `src/server/device-types/device-types.db.test.ts` > "sprite: set, change, clear" | PATCH set -> DTO + list show it; change; `null` clears; each writes one `device_type.update` with `fields:["sprite"]`, `meta.sprite {from,to}`; same value again -> no audit. |
| same > "sprite refused: not allowed (plant.large, device.laptop.s) -> 422, row and audit unchanged" | R7: no side effect before refusal. |
| same > "sprite patch with another org's id -> 404, row unchanged" | R6. |
| same > "create with sprite stores it and audits it; slot change keeps sprite" | POST path; D61 slot change does not clear. |
| `src/server/device-types/image.db.test.ts` > "image set and clear keep sprite_key" | AC2 (upload never clears the pick). |
| `src/server/layout/layout.db.test.ts` > "seat devices carry the type's sprite (null when none)" | Layout join reads `sprite_key` within the org. |
| `src/ui/deviceTypes/device-type-sprite.test.ts` > options, `hiddenByImage`, `unavailable` | Pure view: built-in option preview uses the slot's built-in frame; unknown stored family -> `unavailable`, no option checked. |
| `src/ui/deviceTypes/device-type-form.test.ts` > "toPatchBody sends sprite only when changed; clear sends null" | Changed-fields-only patch (lost-update guard). |
| `src/ui/deviceTypes/DeviceTypeSpriteField.test.tsx` > "radios for built-in + families; canvases only with an atlas; notes" | Markup (renderToStaticMarkup, like `SpriteBrowser.test.tsx`). |
| `src/ui/deviceTypes/DeviceTypeFormDialog.test.tsx` > "shows the sprite field; hidden-by-image note when an image is staged or current" | Wiring. |

## Approach
1. Migration + README bullet + `schema-check.mjs` checks + `sql-sync.test.ts` case. Run `pnpm migrate`,
   `pnpm schema:check` on the local compose DB (R2: expand-only, a new file, no edits to applied ones).
2. `export const SPRITE_KEY_RE` in `src/lib/validate/map-item.ts`.
3. `src/lib/sprites/device-sprites.ts` (pure, lib -> lib):
   - Families: for each `REGISTRY` entry with `group === "device"` and `tiles` null or `[1,1]`, base = key without the
     trailing `.${dir}` when `dir` is set, else the key; unique, sorted.
   - `deviceSpriteAllowed(f) = DEVICE_SPRITE_FAMILIES.includes(f)`.
   - `deviceFrameKey(f, dir)`: if not allowed -> `null`; `isFrameKey(\`${f}.${dir}\`)` -> that; `isFrameKey(f)` -> `f`;
     else `null`.
4. Renderer (`device-slots.ts`): in `resolveDeviceArt`, after the two image branches stay as they are, `!t.hasImage`
   becomes: `t.sprite !== null ? { kind: t.slot, art: { type: "packageSprite", family: t.sprite } } : sprite`.
   In `placeDevices` key: `placeholder` -> `device.other`; `packageSprite` -> `deviceFrameKey(art.family, dir) ??
   builtIn`; else the built-in expression (unchanged). `placement.ts` needs no change (image only for `image` art;
   a key missing from the manifest already goes to `unknown`).
5. `SeatDeviceType.sprite` + `toDeviceType` parse + server layout join `t.sprite_key` (same `t.org_id = $1` join, R6).
6. Types + validator (shape only, 400). Server:
   - `createDeviceType` / `updateDeviceType`: if `v.sprite` is a string and `!deviceSpriteAllowed(v.sprite)` return
     `Promise.resolve({ ok:false, status:422, code:"sprite_not_allowed" })` before `inTx` (R7).
   - `COLS += ", sprite_key"`, `Row.sprite_key`, `toDto.sprite`.
   - Create: insert `sprite_key` `$4::text` (null when absent); audit meta adds `sprite` when non-null.
   - Update: `spriteChanged = patch.sprite !== undefined && patch.sprite !== cur.sprite_key`; no-op guard covers all
     three; SQL `set name=$3, slot=$4, sprite_key=$5`; audit `fields` adds `"sprite"`, `meta.sprite = {from, to}`
     (name's top-level `from/to` unchanged for compatibility).
   - All SQL through `orgQuery` with `org_id = $1` (R6); the `for update` lock serialises writers.
7. UI:
   - `device-type-sprite.ts` view.
   - `DeviceTypeSpriteField.tsx` (radio list, `FramePreview` `box={32}` per option, mono key label, built-in option
     labelled with the slot name from `deviceTypesCopy.slots`).
   - Form state/patch; dialog wiring; `useAtlas` on the page. The dialog keeps one Save that sends name/slot/sprite in
     one POST/PATCH, then the image step (`device-type-save.ts` unchanged).
   - The picker previews direction `s`; the hint copy says monitor/laptop looks turn with the desk.
8. Update the fixtures listed; run all Checks, then `pnpm test:db` locally.

Rules: R1 (ui imports only `@/lib` and `../` ui modules; server only from the api routes, unchanged); R2 (step 1);
R3 (no config); R4 (only the files above); R5 (tests above); R6 (org-scoped SQL, cross-org test); R7 (422 before
`inTx`, auth codes only from `withAuth`). UI copy in `src/ui/copy/deviceTypes.ts` (D36).

Expected size: about 280 product lines (migration/README/schema-check ~35, lib ~70, server ~45, UI ~130) and about
300 test lines, including roughly 25 one-line fixture updates.

## Specialist input used
- database-optimizer 1 (nullable column + check copied from map_items, no FK, no backfill): adopted; the regex is
  referenced from `SPRITE_KEY_RE` via a sync test instead of a free copy.
- database-optimizer 2 (lib validation, own `deviceSpriteAllowed`, do not reuse `spriteAllowedFor`): adopted. Fit
  rule: only 1 x 1 frames are families, so no size check is needed beyond that.
- database-optimizer 3 (extend `updateDeviceType`, `$5`, no-op short-circuit, audit `fields` + `meta.sprite`):
  adopted.
- database-optimizer 4 / api-platform 7 (upload never clears the pick, UI says the image hides it): adopted.
- database-optimizer 5 (R6, layout join, DB tests incl. cross-org and refused key): adopted.
- database-optimizer 6 (`sql-sync.test.ts`, `pg-error.ts`): sync test adopted; `pg-error.ts` needs no change (a check
  violation stays a 500 backstop, never reached through the validator).
- database-optimizer 7 / api-platform 6 guard (unknown key degrades to the slot sprite): adopted in `deviceFrameKey`.
- api-platform 1 (PATCH field, not a new route): adopted; also accepted on POST (assumption 7).
- api-platform 2 (400 shape in validator, 422 semantic in server): adopted, but the validator does not call
  `isFrameKey` because the stored value is a family base, not a frame key (assumption 2).
- api-platform 3 (any `device` family whatever the slot; do not clear on slot change): adopted.
- api-platform 4 (direction): resolved by storing a family base (assumption 2), after checking `placeDevices`
  L136-141, which already appends `.${dir}` for directional kinds.
- api-platform 5 (DTO field `sprite`, `SeatDeviceType.sprite`, parse default null, fixtures): adopted.
- api-platform 6 (renderer order; a not-ready image shows the placeholder, not the sprite): adopted. Named the art
  variant `packageSprite` as suggested.
- api-platform 8 (error copy): keep the shared `sprite_not_allowed` copy; the picker only offers allowed families, so
  the 422 is a race/tamper path (assumption 4).

## Assumptions
Numbered for Ming's plan approval. Each is a default the scope sources allow and can be reversed.
1. **Column name `sprite_key`** (DTO field `sprite`). It matches `seats.sprite_key` and `layout_fixtures.sprite_key`,
   which also hold a base key that is resolved per rotation. `art_*_sprite` in map_items holds per-direction frame
   keys, which is a different thing.
2. **Store one family base, not a frame key** (e.g. `device.laptop`, `device.pc`). The renderer resolves
   `<family>.<desk dir>` for directional families (laptop, monitor), as the built-in path already does, and draws the
   key itself for non-directional ones (`device.monitor.dual`, `device.pc`, `device.phone`, `device.other`). Storing a
   single frame like `device.laptop.s` would draw the wrong facing on n/e/w desks.
3. **Allowed picks = families of registry group `device` with 1 x 1 frames only.** Today that is laptop, monitor,
   monitor.dual, other, pc and phone. No other groups (props, furniture, avatars, state overlays). **Any family for any
   slot**: the slot still decides where the device sits (D61), and the sprite only decides how it looks. A slot
   change keeps the pick. When SIM-033 adds more `device` frames, they become pickable with no code change.
4. **Refusals.** A bad shape gets 400 `invalid_request`. A well-formed key that is not an allowed family gets 422
   `sprite_not_allowed` (the SIM-039.2 code), returned before any write. The shared copy "This sprite can't be used
   for this item or doesn't fit its size." stays unchanged.
5. **Upload and pick are independent.** Uploading or removing an image never clears `sprite_key`, and picking never
   touches the image. The image wins. While the image is loading, or if it fails to load, the desk shows the
   placeholder as today, never the sprite. Removing the image shows the pick at the next layout load. The dialog notes
   "hidden by the uploaded image".
6. **Unknown stored family** (removed from a later registry): the API returns it as stored, the map draws the slot's
   built-in sprite, and the dialog marks it "unavailable" until the Admin picks again.
7. **The sprite can be set on create (POST) as well as on PATCH**, and `null` clears it on PATCH. The api consultant's
   default was PATCH only. I chose this because one dialog creates and edits types and saves in one request.
8. **Audit reuses `device_type.update`** with `fields` including `"sprite"` and `meta.sprite: {from, to}`. Create adds
   `sprite` to its meta when set. There is no new audit action, so the audit-log UI needs no change.
9. **Where the pick shows:** the device types dialog and the room map (read-only and editor). The device types list
   thumbnail, the Devices page and the seat popup are unchanged (possible follow-up).
10. **Picker UI:** a new small `DeviceTypeSpriteField` that reuses SIM-039.10's `FramePreview`, `useAtlas` and the
    SpriteBrowser radiogroup markup. It does not reuse `SpriteBrowser.tsx` itself, which is bound to `MapItemDto`, a
    direction and the tile-fit copy. The thumbnail shows direction `s`. Without an atlas (loading or failed), only the
    text rows show.
11. **No hotspot:** no other open ticket in state IN_PROGRESS, REVIEW or DONE edits these files. SIM-034 is DONE but
    touches CI only. The migration timestamp `20261125230000` sorts after `20261125200000_map_items.sql`. If another
    migration lands first with a later timestamp, rename this one before merge; it has not been applied anywhere yet.
12. **The ticket is sized S, but the work is near the S/M line** (about 280 product lines plus tests and fixture
    updates). It stays one slice; see the split proposal for the fallback.

## Blocking questions
None.

## Split proposal
None required: the product code is about 280 lines, under the ~400 guide. Fallback if the implementer finds it growing
past one review cycle: slice A = migration, lib, server, layout join and renderer (AC1-6, 8), with the pick settable
by API only; slice B = the dialog picker (AC7). Slice A is useful on its own and can be reviewed first.
