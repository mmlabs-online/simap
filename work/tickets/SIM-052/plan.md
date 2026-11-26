Status: READY

# Plan — SIM-052: Send only the catalog device type to Users on the room map

## Scope summary
Ticket Goal: "The room map no longer shows a User the free-text `type` of devices they do not hold, so identifying text typed there (e.g. "Lan's MacBook") cannot leak (follow-up of the SIM-044.1 security review)."
Ticket Scope: "Layout API: for a User, seat devices they do not hold carry `deviceType` (catalog) only; free-text `type` is null." and "Map rendering falls back to the catalog type / slot sprite when `type` is null."
Out of scope: "Manager/Admin; devices the User holds (keep `type`)."
Spec refs (from ticket): `docs/spec-v1.md` LAY-06, OQ-55 (sprites for every tier, type/slot only); D69.

Findings in the code:
- `src/server/layout/layout.ts:138` selects `left(d.type, 61) as type` for every device and `:154-165` returns it to every tier. The GET route (`src/app/api/rooms/[id]/layout/route.ts:14-25`, tier `user`) already has `ctx.tier` and `ctx.sub` but passes only `ctx.sub`.
- `readLayoutRows` is also called by `saveRoomLayout` (`src/server/layout/save.ts:193`), whose PUT is tier `admin`.
- `SeatDevice.type` is `string` (`src/lib/sprites/layout.ts:55`); the client parser `toSeatDevices` rejects a device whose `type` is not a string (`src/lib/sprites/map-view.ts:90`), which would silently drop null-type devices from the map. `resolveDeviceArt` (`src/lib/sprites/device-slots.ts:80-95`) calls `deviceKind(device.type)` only when `deviceType === undefined`.
- Holder of a device = `devices.owner_id` (members.id); the caller is identified by `members.sub = $sub` (same join idea as `mine` at layout.ts:79).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | For a User, layout seat devices they do not hold have no free-text `type`; their own devices keep it. | `pnpm test:db`: `layout.db.test.ts` › "seatDevices for a User: non-held device has type null, held device keeps type" (a seat with one device owned by the caller and one by another member, free-text type "Lan's MacBook"; assert JSON does not contain the text for the non-held one). |
| 2 | The map still draws a sprite for every device (catalog type or slot fallback). | Unit: `map-view.test.ts` › "keeps a device with type null" (parser keeps it, with its `deviceType`); `device-slots.test.ts` › "resolveDeviceArt with type null": catalog type gives its slot/sprite, `deviceType` null or undefined gives kind `other` + placeholder, no throw; `placement.test.ts` › "placeDevices draws a device with type null" returns one placement per device. |
| 3 | Manager and Admin layout responses are unchanged. | `pnpm test:db` › "manager and admin get the free-text type of every device" (same fixtures as 1, tier manager and admin, `toEqual` the pre-change shape); existing tests at `layout.db.test.ts:890-910` stay green with the helper defaulting to admin. |
| 4 | DB test locks the User shape; map/placement unit test for the fallback. | Tests listed in the Tests section; `pnpm test`, `pnpm test:db` (CI), `pnpm typecheck`. |

## Ming verification after merge
None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/layout/layout.ts` | `readLayoutRows(c, scope, sub, roomId, tier)` and `getRoomLayout(pool, scope, sub, roomId, tier)` take the caller `Tier`; device query adds an `owner_id`-vs-caller `mine` flag; when `tier === "user"` and not mine, `type` is null (catalog `deviceType` unchanged). Required param (no default) so no caller can fail open. | The leak is here (l.138, 153-166). | No |
| `src/lib/sprites/layout.ts` | `SeatDevice.type: string \| null` (l.55). | Wire type must carry null. | No |
| `src/lib/sprites/map-view.ts` | `toSeatDevices` (l.86-96) accepts `type` null (string or null; anything else still dropped). | Otherwise the client drops the device and no sprite is drawn. | No |
| `src/lib/sprites/device-slots.ts` | `resolveDeviceArt` (l.80-86): `deviceType === undefined` with null type gives kind `other` with `{type:"sprite"}` art (see Approach step 3); `deviceKind` unchanged. | Null type must not reach `.trim()`. | No |
| `src/app/api/rooms/[id]/layout/route.ts` | GET passes `ctx.tier` (l.20). | Server needs the tier. | No |
| `src/server/layout/save.ts` | l.193 passes `"admin"` to `readLayoutRows` (PUT is `tier: "admin"`, so the response is unchanged). | Signature change. | No |
| `src/server/layout/layout.db.test.ts` | `get`/`value` helpers (l.84-93) get a `tier` arg defaulting to `"admin"`; new tests. | Locks the shape. | No |
| `src/app/api/rooms/[id]/layout/route.test.ts` | Assert `ctx.tier` is forwarded (call args at l.73). | Route contract. | No |
| `src/lib/sprites/map-view.test.ts`, `device-slots.test.ts`, `placement.test.ts` | New null-type cases. | Fallback tests. | No |
| `src/server/layout/save.test.ts` | Only if its `readLayoutRows` mock assertions check call args (mock at l.5, 109); adjust if so. | Signature change. | No |

Other `SeatDevice` users (`src/app/dev/roommap/fixture.ts`, `src/lib/layout-editor/editor-state.ts`, `src/ui/roomlayout/*`, `src/ui/roomlayout/catalog-images.ts`) never read `.type`; the typecheck will confirm. No `src/ui/**` change is expected (the ticket's `src/ui/roomlayout/**` note turned out to need none; the fallback lives in `src/lib/sprites`).

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/{id}/layout` | unchanged | `seatDevices[seatId][]` items are `{ type: string \| null, deviceType }`; `type` is null for a User on devices they do not hold; otherwise unchanged | unchanged | user (unchanged) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `layout.db.test.ts` › User: non-held device `type` null, `deviceType` kept, held device keeps `type` | AC 1; free-text "Lan's MacBook" absent from JSON |
| `layout.db.test.ts` › User: free-text type with no catalog match gives `{type:null, deviceType:null}` | edge: unmatched type no longer leaks |
| `layout.db.test.ts` › manager and admin: every device keeps `type` | AC 3 |
| `layout.db.test.ts` › user whose member row is absent / unowned device (`owner_id` null) | edge: not mine, type null, no error |
| existing `layout.db.test.ts:912` keys test | still `["deviceType","type"]` (key present, value null) |
| `route.test.ts` › forwards ctx.tier to getRoomLayout | route wiring |
| `map-view.test.ts` › keeps device with `type: null`; still drops non-string/non-null type | AC 2 |
| `device-slots.test.ts` › resolveDeviceArt null type with catalog type / null / undefined | AC 2 |
| `placement.test.ts` › placeDevices with null-type devices | AC 2 |

## Approach
1. `layout.ts`: add `tier: Tier` (import type from `@/lib/auth/tier`, lib layer, allowed). In the device subquery add `owner_id`; in the outer select add `coalesce(d.owner_id = (select id from members where org_id = $1 and sub = $3::uuid), false) as mine` (pass `sub` as `$3`; `$2` stays the seat array). Map: `type: tier === "user" && !d.mine ? null : d.type`. Keep `left(d.type, 61)` and the catalog join on the raw type unchanged (the join is server-side only). Scoped by org_id (R6).
2. Types and parser: widen `SeatDevice.type` to `string | null`; `toSeatDevices` keeps null.
3. `resolveDeviceArt`: if `t === undefined`, use `device.type === null ? "other" : deviceKind(device.type)` with the same `sprite` art. Branches for `t === null` and catalog types already ignore `type`.
4. Route and save.ts pass the tier; update tests; run `pnpm format`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm test:db`.
Rules: R1 respected (no cross-layer imports added), R6 (query stays org-scoped), R7 not affected (read only, no new auth codes).

## Specialist input used
None (fast lane, no consult files).

## Assumptions
- "Holds" = `devices.owner_id` is the caller's member (D63 lifecycle); a device held only through a pending handoff is not held.
- Tier comes from the verified token (`ctx.tier`); only exact tier `user` is restricted, manager and admin unchanged.
- Hotspots: SIM-050 (member email hiding) and SIM-051 (devices 404 for non-holders) are expected to touch `src/server/members/**` and `src/server/devices/**` / `src/app/api/devices/**`, not `layout.ts`, the layout route or `src/lib/sprites/**`. No file overlap is expected; if SIM-051 changes the shared `owner_id`/holder SQL helper or the `layout.db.test.ts` helpers, expect a trivial rebase. SIM-052 does not touch `src/app/api/rooms/[id]/layout/route.ts` beyond one argument.
- No High path file is touched, so no plan approval gate (P1 policy aside, Priority is P2).
- Size estimate: about 120 changed lines including tests.

## Blocking questions
None

## Split proposal
None
