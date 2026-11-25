## Attempt 1

## SIM-039.3 security review, attempt 1: PASS (no blockers)

I found no 🔴 or 🟡 issues. I read the changed files and checked them against R6, R7, D67, lock order and input validation. There was no Bash in this session, so I did not run git diff or any of the Checks; I reviewed the current file contents only.

### Findings

**🟢 R6, org scoping is correct for every new statement.**
- `/home/user/simap/src/server/layout/save.ts:94-105` (catalog read and lock), `:217-223` (hidden-fixture counts) and `:232-246` (hidden-floor room read) all go through `orgQuery` and filter on `org_id = $1`. The org comes only from `ctx.scope`.
- The read-side catalog query at `/home/user/simap/src/server/layout/layout.ts:116-121` is scoped the same way.
- No new statement joins without an org filter, so another org's `map_items` rows cannot be read or locked.

**🟢 R7, auth refusals come first and every domain refusal comes before the first write.**
- The PUT handler (`/home/user/simap/src/app/api/rooms/[id]/layout/route.ts:27-42`) is wrapped in `withAuth` with `tier: "admin"`, so any 401/403 is returned before the body is read.
- `parseLayoutSave` (`route.ts:35`) runs before the transaction starts.
- Inside `saveRoomLayout`, every refusal is a 404, 409 or 422 thrown as `Abort`. They all fire before the seat update at `save.ts:126`: the rules at `:111-113` and both hidden checks at `:226` and `:255`.
- The only earlier write is `map_items_seed` at `:81-85` (an insert into the catalog, with `on conflict do nothing`). It was already there, it rolls back on `Abort`, and it never leads to a 401/403. The audit is written only after all writes (`:179`).

**🟢 D67, the layout read does not leak hidden flags or other orgs' rows.**
- `items` is built from org-scoped rows and filtered to the keys the resolved layout actually draws (`layout.ts:185-196`).
- `hidden` is removed from each item (`:194`), and the type `LayoutItem = Omit<MapItemDto, "hidden">` (`/home/user/simap/src/lib/sprites/layout.ts:49`) enforces that.
- `COLS` never selects Drive file ids, only whether an image exists.
- Hidden items that are not placed are never returned.

**🟢 Lock order and deadlock risk: no cycle found.**
- The save locks in this order: room `for update`, then seats `for update` by id, then the catalog seed, then `map_items` `for key share`. The `order by builtin_key` sits below the row-lock step, so rows are locked in a fixed order.
- Two concurrent saves only take `for key share` on catalog rows, which do not conflict with each other.
- A resize or reset (`/home/user/simap/src/server/map-items/edit.ts:93-98`, `:113-120`) locks one `map_items` row `for update` and then counts placements without locking anything else. It never asks for a room or seat lock, so there is no lock inversion.
- If a save runs first, the resize waits and then sees the new placement (`item_in_use`). If the resize runs first, the save waits, then re-reads the row at its new size.
- Rename, hide and art changes use `for no key update`, which does not conflict with the save's lock.
- Saves of the same room are serialised by the room lock, so the per-room hidden count (`save.ts:217-226`) cannot race another save.

**🟢 Input validation holds.**
- `parseShape` limits the number of floors, seats and fixtures, and requires exact keys, safe integers and canonical UUIDs.
- `checkLayoutBasics` rejects unknown sprites, bad rotations, missing frames and floor zones out of bounds before the transaction.
- In the save, a key with no catalog row is refused as `layout_unknown_sprite` (422) rather than reaching a foreign-key error and a 500 (`save.ts:106-113`). The read falls back to the registry sizes, as planned (A9).
- Catalog sizes are capped at 1 to 4 (`MAP_ITEM_LIMITS` in `/home/user/simap/src/lib/map-items/types.ts:8-9`). So the footprint loops in `checkLayoutRules` and `fixturesOnDesks` handle at most 2000 items of 16 cells each, with no CPU or memory risk.
- The desk exemption at `save.ts:121` is safe because `SEAT_SPRITES` contains only `desk.single` (`/home/user/simap/src/lib/validate/layout.ts:45`). No other seat sprite can get around the hidden rule.

**🟢 Note: hidden items are partly visible to non-Admins, as approved in plan A7.**
- Any member gets the name and art of a placed hidden item, and can work out that it is hidden by comparing `GET /api/map-items` (which omits hidden rows) with the layout's `items`.
- This matches the approved plan: hiding only takes an item out of the palette (LAY-07).

**🟢 Note: the hide/save race is accepted (plan A1).**
- A hide that commits during a save can let that one save place the item it just hid, because `for key share` does not block `for no key update`.
- This is documented and accepted, and has no security impact since hiding only affects the palette.

### Follow-ups (out of scope)
- None.
