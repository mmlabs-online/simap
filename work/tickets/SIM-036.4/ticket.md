# SIM-036.4: Draw catalog device images and slots on the map

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-036.2, SIM-036.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-25T03:56:09Z |
| PR | — |

## Goal
Devices on desks use their catalog type's image and slot, so an Admin-defined type (e.g. headset) shows up on the map
right after it is created.

## Scope reference
- `work/decisions.md` D61; the SIM-035 slot table.

## Scope
- Room map and editor: a device whose resolved type has an image draws that image (24 × 24, 1:1 in room pixels,
  nearest-neighbour) at the type's slot; a seeded type without an image keeps its built-in sprite; a device with no
  catalog type draws the square placeholder.
- Images are fetched once per type per page (bearer, `blob:` URL) and cached by the type's image version; a failed
  image falls back to the placeholder without breaking the map.

## Out of scope
- Changes to the slot table itself (SIM-035) or to the API (SIM-036.2).

## Acceptance criteria
- [ ] Draw list unit tests: catalog image at its slot; seeded type uses the built-in sprite; unknown type uses the
      placeholder.
- [ ] A failed or slow image load shows the placeholder, and the rest of the map draws normally.
- [ ] Each type image is fetched at most once per page load.

## Test plan
- Unit: draw list and image cache. Manual: create a "Headset" type with an image, place a headset device at a seat,
  open the room.

## Notes / answers from Ming
- 2026-11-24 (D61).

## Handoff
