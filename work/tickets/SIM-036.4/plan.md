Status: READY

# Plan — SIM-036.4: Draw catalog device images and slots on the map

## Scope summary
Ticket scope (`work/tickets/SIM-036.4/ticket.md`):
- "Room map and editor: a device whose resolved type has an image draws that image (24 × 24, 1:1 in room pixels, nearest-neighbour) at the type's slot; a seeded type without an image keeps its built-in sprite; a device with no catalog type draws the square placeholder."
- "Images are fetched once per type per page (bearer, `blob:` URL) and cached by the type's image version; a failed image falls back to the placeholder without breaking the map."
- Out of scope: "Changes to the slot table itself (SIM-035) or to the API (SIM-036.2)."

`work/decisions.md` D61: "...drawn 1:1 in room pixels with nearest-neighbour zoom. `devices.type` stays free text (D37) and matches a catalog type by name (trimmed, case-insensitive); a device whose type is not in the catalog draws as one built-in square placeholder sprite." D62 A3 (2 slots per kind, extras stack +3/-3, max 4 per kind) stays as is.

What already exists (verified, no API change needed):
- `GET /api/rooms/{id}/layout` already returns per device `deviceType: { id, slot, hasImage, imageVersion } | null` (`src/server/layout/layout.ts:94-129`, type `SeatDeviceType` in `src/lib/sprites/layout.ts:37-45`).
- `GET /api/device-types/{id}/image` is `tier: "user"`, so every role can fetch it (`src/app/api/device-types/[id]/image/route.ts:83`). `createDeviceTypesApi(apiFetch).getImage(id)` returns a PNG Blob (`src/ui/deviceTypes/device-types-api.ts:65`).
- `createImageUrlCache` (`src/ui/deviceTypes/image-url-cache.ts`) fetches once per `{id, imageVersion}`, limits concurrency, stores blob URLs, and has a `failed` state. Reusable as is.

The gap: `toSeatDevices` in `src/lib/sprites/map-view.ts:45-50` drops `deviceType`, and `placeDevices` picks the kind from the type name only.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Draw list unit tests: catalog image at its slot; seeded type uses the built-in sprite; unknown type uses the placeholder. | `pnpm test src/lib/sprites/placement.test.ts src/lib/sprites/device-slots.test.ts`: tests "catalog image op at the slot position", "seeded type without image keeps built-in sprite", "deviceType null draws device.other placeholder". |
| 2 | A failed or slow image load shows the placeholder, and the rest of the map draws normally. | Unit: placement test "image not ready draws placeholder at the type's slot; other ops unchanged"; `useCatalogImages` / cache test "failed fetch and decode error report not ready". Local run: block `/api/device-types/*/image` in devtools, the map still draws with the square placeholder. |
| 3 | Each type image is fetched at most once per page load. | Unit: hook-level test (`catalog-images.test.ts`) with a counting `load`: two devices of one type, a layout reload with the same `imageVersion`, and a re-sync fetch once. A version bump fetches again (existing `image-url-cache.test.ts` covers the version rule). |

## Ming verification after merge
Create a "Headset" type with an image (slot phone or other), place a headset device at a seat, open the room and the layout editor: the 24 × 24 image shows at the slot. A real hosted Drive-backed image is only available in the deployed app.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/device-slots.ts` | Add pure `resolveDeviceArt(device: SeatDevice, imageReady)` returning `{ kind, art }`, with `art` = built-in sprite, placeholder, or `{ image: typeId, version }`. Let `placeDevices` take the resolved list; keep the string form working for legacy callers. Add `art` to `DevicePlacement`. Slot table untouched. | Resolves kind from `deviceType.slot` and picks image / built-in / placeholder | no |
| `src/lib/sprites/placement.ts` | `buildDrawList` gets a 5th optional arg `imageReady?: (t: SeatDeviceType) => boolean` (default: never). New `DrawOp` variant `{ type: "image"; layer; typeId; version } & Rect` (w = h = 24). Image ops are sorted exactly like the slot's sprite item (same `under`, `hostRow`, `sub` rules) and centred on the slot frame's box (integer floor of the size difference). Unknown frame keys still go to `unknown`. | Draw list carries the image op; the sprite stays pure | no |
| `src/lib/sprites/map-view.ts` | `toSeatDevices` keeps a validated `deviceType` (id string, slot in `DEVICE_KINDS`, `hasImage` boolean, `imageVersion` int); `null` stays `null`; a missing field stays `undefined`; a bad shape becomes `null`. | The client currently drops the catalog info | no |
| `src/ui/roomlayout/paint.ts` | `paintRoom` gets an optional `images: (typeId, version) => CanvasImageSource \| null`; an `image` op draws 1:1 with smoothing off; a null source skips the op. | Canvas draws catalog images | no |
| `src/ui/roomlayout/useCatalogImages.ts` (new) | Hook `useCatalogImages(seatDevices)`: builds `createDeviceTypesApi(useApiFetch())` and `createImageUrlCache`; syncs the distinct `deviceType` entries with `hasImage`; creates an `HTMLImageElement` per ready blob URL and decodes it; exposes `ready(t)` and `source(typeId, version)`; bumps state on change; a fetch failure or decode error means not ready. Disposes the cache on unmount. | Fetch once per type, show placeholder until ready or on failure | no |
| `src/ui/deviceTypes/image-url-cache.ts` | Widen `sync` to `readonly Pick<DeviceTypeDto, "id" \| "hasImage" \| "imageVersion">[]`; `url` the same. No behaviour change. | The map has no name or slot to pass | no |
| `src/ui/roomlayout/RoomMap.tsx`, `src/ui/roomlayout/EditorCanvas.tsx` | New optional prop `catalogImages?` (the hook result). Pass `ready` to `buildDrawList` (memo dep on the hook's version counter) and `source` to `paintRoom`. | Map and editor both draw images | no |
| `src/ui/roomlayout/RoomMapSection.tsx` | Pass `catalogImages` through to `RoomMap`. | Wiring | no |
| `src/ui/seats/SeatsPage.tsx`, `src/ui/roomlayout/LayoutEditorPage.tsx` (or `LayoutEditor.tsx`) | Call `useCatalogImages(view?.seatDevices)` once per page and pass it down. | The hook lives at page level so a map remount does not refetch, and RoomMap tests and the dev demo need no ApiFetch provider | no |

No file matches a High path in `.claude/loop.config.md`. No server, migration, auth, config or `.env.example` change. Gate is none.

## Data model / migration
None.

## API contract
None (reads the existing `GET /api/rooms/{id}/layout` and `GET /api/device-types/{id}/image`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/device-slots.test.ts` › `resolveDeviceArt` cases | deviceType with image ready gives image art at `deviceType.slot`; image not ready gives placeholder at that slot; `hasImage` false and a seeded slot gives built-in sprite; `deviceType: null` gives the `device.other` placeholder in the "other" slot; `deviceType` undefined keeps the old name-based kind (existing tests stay green); name with Vietnamese diacritics and case/space variants resolve via the server, so the client only trusts `deviceType` |
| `src/lib/sprites/placement.test.ts` › image op | Image op position equals the slot frame's position plus the centring offset, for all four desk directions; `under` slot (pc) paints before the desk; extras past slot 2 shift +3/-3; cap of 4 per kind; ops for other devices unchanged |
| `src/lib/sprites/placement.test.ts` › fallback | `imageReady` false or throws-free default gives the placeholder frame and no image op; the rest of the draw list is identical |
| `src/lib/sprites/map-view.test.ts` › deviceType passthrough | Valid `deviceType` kept; `null` kept; a bad slot or `imageVersion` becomes `null`; a missing field stays `undefined`; the per-seat cap is still applied |
| `src/ui/roomlayout/paint.test.ts` › image op | `drawImage` called with 24 × 24 at op x/y, smoothing off; null source skips the op without throwing |
| `src/ui/roomlayout/useCatalogImages.test.ts` (or a pure `catalog-images.ts` plus test) | One fetch per type across repeated `sync`; bumped version refetches; failed fetch gives not ready; decode error gives not ready; dispose revokes URLs. Prefer a pure factory (like `createImageUrlCache`) so the test needs no DOM. |
| `src/ui/deviceTypes/image-url-cache.test.ts` | Existing tests stay green with the widened type |

Verification commands: `pnpm test`, `pnpm typecheck && pnpm check:layers`, `pnpm format:check`, `pnpm build`.

## Approach
1. `map-view.ts`: carry `deviceType` through `toSeatDevices` (validated). This one place feeds both the room map and the editor (`seats-api.ts:74,87`).
2. `device-slots.ts`: add `resolveDeviceArt` (pure). Rules, in order: `deviceType === null` gives placeholder (`device.other`, "other" slot); `deviceType` set gives kind = `deviceType.slot`; if `hasImage` and `imageReady(deviceType)` gives an image; if `hasImage` but not ready (loading, failed, or decode error) gives the placeholder at that slot; if `!hasImage` gives the built-in sprite of the slot (this covers seeded types, whose slot equals their kind); `deviceType === undefined` keeps today's `deviceKind(name)` behaviour (dev fixture and old tests).
3. `placement.ts`: use the resolved list; emit an `image` op for image art. The geometry (tile, anchor, offset, `under`, `hostRow`) comes from the slot's built-in frame, so sorting and the F2 host rule are unchanged. Slot table is not edited.
4. Extract the loading logic into a pure factory plus `useCatalogImages` hook: reuse `createImageUrlCache` with `load = api.getImage`, then decode into `HTMLImageElement`. Fetch once per `{type id, imageVersion}`; layout reloads that keep the version do not refetch.
5. `paint.ts`: draw the `image` op 1:1 (24 × 24) with `imageSmoothingEnabled = false`, as for atlas frames. The canvas is zoomed by an integer `ctx.scale`, so nearest-neighbour holds.
6. Wire the hook in the two pages and pass it through `RoomMapSection`, `RoomMap`, `EditorCanvas`. Both views repaint when an image becomes ready, because the hook's version counter is a dependency of the draw list memo.
7. Rules: R1 (ui imports only lib and other ui, no server), R3 (no config), R4 (nothing outside the list), R5 (tests for each pure piece), D36 (no new UI copy is needed; if a notice is wanted it goes to `src/ui/copy/roomlayout.ts`, but none is planned).

## Specialist input used
None (fast lane, no consult files).

## Assumptions
- A1. A catalog type with no image and a slot (a custom type that is not seeded) draws the built-in sprite of its slot, not the placeholder. The ticket words the rule only for seeded types; this keeps one rule ("no image: built-in sprite of the slot"). Placeholder is used for "no catalog type" and for failed or slow images.
- A2. The placeholder is the existing `device.other` sprite (the single built-in square sprite in `keys.json:282`), drawn at the type's slot (or the "other" slot when the type is unknown).
- A3. The 24 × 24 image is centred on the slot sprite's frame box, because the slot offsets were tuned for the built-in frames (SIM-035). The implementer checks the frame sizes in `public/sprites/office.json` and adjusts if the centring looks off in `/dev/roommap`; the slot table itself is not changed.
- A4. `deviceType === undefined` (callers that predate D61, the dev fixture) keeps name-based behaviour; `null` is the "not in the catalog" case. The real API always sends `deviceType` or `null`.
- A5. "Once per page load" is met by one hook instance per page (the room page and the editor page each have one map). Images are not shared across a full page navigation.
- A6. Hotspots: `src/lib/sprites/placement.ts` and `device-slots.ts` were last edited by SIM-035 (merged). `src/ui/deviceTypes/image-url-cache.ts` is only widened. No open ticket in `IN_PROGRESS` or `REVIEW` was checked beyond the board state; the orchestrator should expect a rebase if SIM-036.x siblings touch `src/ui/roomlayout/RoomMap.tsx` or `EditorCanvas.tsx`.
- A7. Expected size is about 250-350 changed lines including tests, within one cycle.

## Blocking questions
None.

## Split proposal
None.
