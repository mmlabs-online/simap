## Findings
- Device types today: PATCH `/api/device-types/[id]` (admin) takes a non-empty partial of `name` and `slot`. The validator rejects unknown keys with 400 `invalid_request`. `updateDeviceType` does a `select ... for update`, returns early on no change, and writes the audit entry `device_type.update` with `meta.fields`. The image has its own route, `/[id]/image` (PUT PNG, DELETE, GET). Image refusals are 422 (`image_too_large`, `image_not_png`).
- Precedent from map items: PUT `/api/map-items/[key]/art/[dir]` takes `{sprite: frameKey|null}`. `validateMapItemArt` returns 400 for a bad shape or an unknown frame key (`isFrameKey`). The server (`setMapItemArt` in `src/server/map-items/edit.ts`) returns 422 `sprite_not_allowed` when the frame is not allowed for the item or does not fit. It is idempotent when unchanged and audits the change with `from` and `to`. `sprite_not_allowed` already exists in `src/lib/api/error.ts` and `src/ui/copy/api.ts`. Its copy says "can't be used for this item or doesn't fit its size", which is a bit off for devices.
- `spriteAllowedFor` in `src/lib/map-items/art.ts` is map-item specific. It allows the catalog groups of `LIBRARY_ITEMS` and explicitly never allows avatar, device or state frames.
- The package has `group: "device"` frames such as `device.laptop.{n,e,s,w}`. They sit on layer `furniture` and have `tiles: null` (1x1). Their keys are directional. I did not list every device frame, but the group is `device`.
- Renderer: `resolveDeviceArt` (`src/lib/sprites/device-slots.ts`) goes `hasImage` → image, otherwise `{type:"sprite"}`, which is the built-in sprite of the slot kind. `art.type` is `sprite | placeholder | image`. The layout loader (`src/server/layout/layout.ts`, ~L126-160) builds `SeatDeviceType {id, slot, hasImage, imageVersion}` through a left join on `device_types`. `parseSeatDeviceType` in `map-view.ts` and `SeatDeviceType` in `lib/sprites/layout.ts` also parse and define it. `DeviceTypeDto` is built in `device-types.ts` with `COLS` and `toDto`.
- The map-items art DTO uses `sprite`, with a server-side fallback order of image → sprite → library. A stored sprite stays stored while an image exists (see the SIM-039.9 consult).

## Recommendations
1. **Use a PATCH field, not a new route.** Add an optional `sprite: string | null` to `validateDeviceTypePatch` and to `DeviceTypePatchValue`. Reasons:
   - It is one scalar on the row, like name and slot.
   - It reuses the existing admin PATCH, audit and idempotency path.
   - A route like `/[id]/sprite` only pays off for byte payloads. The map-items `/art/[dir]` route exists because of the per-direction image sub-resource.
2. **Validation split, as in map items.**
   - Shape check in `src/lib/validate/device-type.ts`: `null`, or a string that matches the map-item SPRITE regex and passes `isFrameKey`. Otherwise 400 `invalid_request`. Do not copy the SPRITE regex; export it from `map-item.ts` or move it to a shared validate helper (layers: lib → lib is fine).
   - Semantic check in the server: 422 `sprite_not_allowed` if the frame is not allowed for device slots. Add a pure `deviceSpriteAllowed(frameKey)` in `src/lib/device-types/` (or `lib/sprites`) that means "`REGISTRY[key].group === "device"`". Do not loosen `spriteAllowedFor`, because the map-item rule must keep excluding device frames.
   - Do the check inside `updateDeviceType` before the transaction writes, so no side effect happens before a refusal (R7). It is also the only place that can see a combined `slot` + `sprite` patch.
3. **Slot interaction.** A frame's kind (`device.laptop.*`) may differ from the type's `slot`. The slot drives placement (`placeDevices`), so it does not need to equal the sprite's kind. Decide the rule up front. My suggestion is to validate only that the frame is in the `device` group, since an Admin may want a custom look. Check the effective slot and sprite together in one PATCH. Do not clear the sprite on a slot change (D61: devices are not touched).
4. **Direction.** Device frames are `n/e/s/w` variants. A single `sprite` key per type cannot work as a direction family. Either store a base key without the direction (for example `device.laptop`) and let the renderer pick the facing for the desk, or store one frame key and have the renderer resolve it. The picker (the 039.6 browser) should then list one entry per family. Check `placeDevices` and the sprite draw path for which facing it uses today before deciding (open question 1).
5. **DTO and column.**
   - Add the column `device_types.sprite_key text null` with a check constraint. Use an expand-only migration (R2). It is a High path.
   - Add it to `COLS`, `Row`, `toDto` and `DeviceTypeDto` as `sprite: string | null`. Keep the name consistent with the map items DTO (`sprite`).
   - Add it to `SeatDeviceType` and to the layout join (`t.sprite_key as sprite`). Update `parseSeatDeviceType` to accept a string or null, and default to `null` when absent so an older cached payload still works. Update the test fixtures that construct `SeatDeviceType` (`layout.db.test.ts`, `catalog-images.test.ts`, `LayoutEditorViews.test.tsx`).
   - Extend `DeviceTypeDto` consumers (DeviceTypesPage, DeviceTypesView, DeviceTypeFormDialog).
6. **Renderer fallback.** In `resolveDeviceArt`, the order becomes:
   - `hasImage`: if the image is ready, draw the image. If it is not ready, draw the placeholder, as today.
   - Else `sprite` non-null: new art `{type:"packageSprite", key}`. Else the slot sprite.
   - Do not let a sprite hide the "image not ready" placeholder. The upload must always win, and a not-yet-loaded image must not flash the sprite.
   - Add a defensive guard so an unknown or removed frame key in the atlas falls back to the slot sprite and does not break the draw.
7. **Interaction with image upload.** Do not clear either value when the other changes. Keep the sprite stored while an image exists, as map items do. The UI should show "sprite set, hidden by uploaded image". DELETE of the image then reveals the sprite with no extra write. Audit the sprite change as `device_type.update` with `fields: ["sprite"]` and `from` and `to`, like map items. Idempotent when unchanged (return the current DTO, no audit).
8. **Error copy.** Add a device-specific message, or reword the shared `sprite_not_allowed` copy to cover both uses. Note that `apiError` codes sit in `src/lib/api/error.ts`, so no new code is needed.
9. **Tests.**
   - Unit: validator (null, valid key, unknown key, non-string, extra field, combined fields) and the `deviceSpriteAllowed` rule.
   - `resolveDeviceArt` order cases.
   - Route test: 401/403 happen before the body is read, 422 for avatar and furniture frames, 200 for a device frame, clear with null, no-op when unchanged.
   - DB test: org scoping (R6), layout join returns the sprite, delete of the type, audit row.

## Risks
- Direction handling (point 4) could turn this S ticket into M if the renderer has no per-facing lookup for device frames.
- A frame key later removed from the package would leave a stored dangling key. The renderer guard in point 6 covers this. Optionally also treat unknown keys at read time as null in the loader.
- The migration is on a High path, so the plan-approval gate applies. Use an expand-only change, because the previous image must keep working: it ignores the new column, which is safe.
- Reusing the map-item `spriteAllowedFor` for devices would be wrong, since it excludes device frames by design. Loosening it would let map items wear device frames.
- `slot` and `sprite` mismatches (for example slot `pc` with a laptop frame) look odd on desks but break nothing. State the rule in the plan.
- R7: the 422 must come from the domain function before any write. Do not move the check after the `update`.

## Open questions
1. How does the renderer draw a device sprite today (built-in per kind and per desk facing)? Does a single stored key suffice, or does the type store a family base?
2. Should an Admin be allowed to pick any `device` group frame, whatever the slot, or only frames that match the slot's kind?
3. Is a non-device-group frame ever acceptable (generic props)? My default is no.
4. Should clearing be `sprite: null` in the same PATCH (my recommendation), or also be exposed on create (`POST` currently accepts only `name` and `slot`)? My default is PATCH only.
5. Rename the shared `sprite_not_allowed` copy or add a device-specific string?

Files read: /home/user/simap/work/tickets/SIM-039.7/ticket.md, /home/user/simap/src/app/api/device-types/[id]/route.ts, /home/user/simap/src/app/api/device-types/[id]/image/route.ts, /home/user/simap/src/app/api/map-items/[key]/art/[dir]/route.ts, /home/user/simap/src/lib/validate/device-type.ts, /home/user/simap/src/lib/validate/map-item.ts, /home/user/simap/src/lib/map-items/art.ts, /home/user/simap/src/server/device-types/device-types.ts, /home/user/simap/src/server/map-items/edit.ts, /home/user/simap/src/server/layout/layout.ts, /home/user/simap/src/lib/sprites/device-slots.ts.
