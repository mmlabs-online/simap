# Security review: SIM-035

## Attempt 1

**Verdict: PASS (no blockers, no should-fix findings).**

I checked: the new devices query in `readLayoutRows`, the GET/PUT route, the `seatDevices` client parser, the `deviceKind` and `placeDevices` mapping, the draw-list wiring, and the new DB tests. I could not run the checks myself, so CI's `pnpm test:db` is still the gate for the DB tests.

### Findings

🟢 **R6 org scoping is correct.** src/server/layout/layout.ts:95-106
- The query runs through `orgQuery` with `org_id = $1`.
- `$2` holds only seat ids from the earlier seats query, which is itself scoped by org and room (l.71-82) and capped by `LAYOUT_LIMITS.seats`.
- The query is skipped when there are no seats.
- The composite FK `devices_seat_fkey (org_id, seat_id)` in `db/migrations/20261120150000_init.sql:134` means a device cannot point at another org's seat.
- It runs inside the same repeatable-read transaction as the rest of the GET, and the PUT re-read reuses it.

🟢 **Only the device type leaves the server.** layout.ts:98 and 107
- The query selects only `seat_id` and `left(type, 61)`, and the response holds only `{ type }`. No name, inventory number, MAC, owner, role or device id is returned.
- Exposure is consistent with existing access. GET `/api/rooms/{id}/layout` is `tier: "user"` (route.ts:24), and `/api/devices` GET already lists every device in the org, type included, to any member (src/server/devices/devices.ts:115-128). So no new disclosure.
- The DB test at src/server/layout/layout.db.test.ts:561 asserts that no identifying fields appear.

🟢 **The free-text type is never used as a sprite key.** src/lib/sprites/device-slots.ts:62-65, 110
- `deviceKind` normalises the type and looks it up with `Object.hasOwn` in a fixed 4-entry table, so a type like `constructor` or `__proto__` safely maps to `other`.
- The frame key is built only from the constant `DEVICE_SPRITE[kind]` plus the desk `dir`.
- placement.ts:204-215 only passes the types to `placeDevices`. A missing frame goes to `unknown`, not to an arbitrary lookup.
- The type string is never rendered as text, so there is no injection surface.

🟢 **Caps hold on both sides.**
- Server: `row_number() ... n <= LAYOUT_LIMITS.devicesPerSeat (8)` per seat, and at most `LAYOUT_LIMITS.seats` seats, so the result is bounded. Each type is cut to 61 characters.
- Client: src/lib/sprites/map-view.ts:45-50 and 86-91 keep only `{ type: string }` entries for seats that are actually placed, sliced to 8. Anything malformed becomes `{}` or `[]`.
- Drawing: `MAX_PER_KIND = 4` (device-slots.ts:52, 101).
- `devices[seat.id]` with a hostile key such as `__proto__` returns a non-array, which yields `[]`, so nothing pollutes the result.

🟢 **R7 and R1 are fine.**
- src/app/api/rooms/[id]/layout/route.ts:35-36: `layout_fixture_on_desk` comes back as 422 from `validateLayoutSave` before `saveRoomLayout` runs, so nothing is written first. The auth wrapper and tiers are unchanged and no new 401/403 path was added.
- `device-slots.ts` imports only `./types`. The server imports only lib (`@/lib/sprites/layout`, `@/lib/validate/layout`).

🟢 **The cross-org DB test is meaningful.** layout.db.test.ts:564-596
- It covers org B's devices, an inventory device and a device in another room of the same org. It also checks that org B gets a 404 on org A's room, and that org B's own view holds only B's data.

💭 **Note: the per-seat cut is silent.** The response gives no signal when a seat has more than 8 devices, by design (plan A5), so this is not a security issue. Just be aware that API clients cannot tell a cut list from a full one.

### Follow-ups (out of scope)
- None needed for security.
