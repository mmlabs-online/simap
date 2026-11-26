# Security review — SIM-052

## Attempt 1

**Summary: PASS (security). I found no blockers and nothing to fix before merge. A User now gets `type: null` for every seat device they don't hold in GET `/api/rooms/{id}/layout`. Manager and Admin responses are unchanged, the tier comes only from the auth wrapper, and nothing I traced leaks the free-text type of a device the User doesn't hold.**

This was a read-only static review: I had only Read, Grep and Glob, so I didn't run any checks. The green check results come from `impl-log.md`.

### Findings

No 🔴 or 🟡 findings.

**💭 The tier comes only from the verified token, and nothing defaults to open.**
- `src/server/http/with-auth.ts:69-71` builds `ctx.tier` from `tierFromOrgRoles(orgRoles)` (R6, D5).
- `src/app/api/rooms/[id]/layout/route.ts:20` passes `ctx.tier` through. Nothing in the request body or headers can set it.
- `tier: Tier` is a required parameter of both `readLayoutRows` and `getRoomLayout` (`src/server/layout/layout.ts:60,239`), with no default. A new caller that forgets it fails typecheck instead of failing open.
- The only other caller is `src/server/layout/save.ts:193`, which hard-codes `"admin"`. That is correct because PUT is `{ tier: "admin" }` (route.ts:41).
- `Tier` is exactly `"user" | "manager" | "admin"` (`src/lib/auth/tier.ts:1`), so the `tier === "user"` test can't miss a lower tier.

**💭 The "held" check is correct and scoped to the org.**
- `layout.ts:146` uses `coalesce(owner_id = (select id from members where org_id = $1 and sub = $3::uuid), false)`.
- The subquery returns at most one row because of `members_org_sub_key unique (org_id, sub)` (`db/migrations/20261120150000_init.sql:52`), so it can't fail with a multi-row error.
- A missing member row gives `false`, so the type is hidden (fail-closed). This is covered by the test "User without a member row" (`layout.db.test.ts:989`).
- Every predicate in the device and catalog queries binds `org_id = $1` (R6).
- R7 is not affected: the change is read-only and adds no new auth codes.

**💭 The catalog type a User still sees can confirm a guess about a device's free-text type.** `deviceType` is matched server-side through `device_type_key(d.type)` (`layout.ts:153`). A User can therefore tell whether a device's free-text type equals an org catalog name, or matches none (`deviceType: null`). They still never see the text itself. This is the catalog-only exposure approved in OQ-55, so no action is needed.

**💭 The client cannot bring the text back.** `toSeatDevices` keeps `type: null` (`src/lib/sprites/map-view.ts:90`), and `resolveDeviceArt` handles null without calling `.trim()` (`src/lib/sprites/device-slots.ts:87`). `deviceKind` is only called from `device-slots.ts`, and nothing under `src/ui/**` reads `SeatDevice.type`, so null can't crash or reveal anything.

**💭 Other User-tier endpoints that return devices**
| Endpoint | Free-text type for a device the User doesn't hold? |
|---|---|
| Seat detail, room seats, seat release (`src/server/seats/seats.ts:132-133`, `deviceVisibility(tier)`) | No. The list holds only the User's own devices; `deviceCount` stays the total, which is the accepted D69 shape. The `"org"` calls at seats.ts:370, 455, 471, 522, 538, 557, 593 are only reached from Manager/Admin routes (occupant, cannot-seat, tags, create). |
| Devices list and detail (`src/server/devices/devices.ts:209,230`, `heldWhere`) | No |
| Search (`src/server/search/search.ts:120-145`) | No. It never selects or matches `d.type`, and User results are filtered to held devices. |
| Dashboard (`src/server/dashboard/dashboard.ts`) | No. It doesn't select a device type. |
| Device history (`src/server/devices/history.ts:59`) | No. It returns 404 when the device isn't held. |
| Member detail (`src/server/members/manage.ts:158,208`) | No. Devices are filtered to held. |
| Handoff inbox (`src/server/devices/handoffs.ts:74,100,763`) | Yes, but only for pending transfers addressed to the User (`to_member_id = me`), which they need in order to decide. See follow-ups. |

**💭 The tests lock in the shape.**
- `src/server/layout/layout.db.test.ts:946-997` covers, per tier:
  - a non-held device gives `{type:null}`;
  - a held device keeps `"PC"`;
  - the JSON does not contain "MacBook";
  - Manager and Admin get the full shape;
  - a User without a member row gets every type null.
- The existing key-set test at :914-944 still asserts the keys are exactly `["deviceType","type"]`.

### Follow-ups (out of scope)
- **Handoff inbox:** a pending transfer shows the recipient the device's free-text `type` (and its name) before they accept. That is the purpose of the inbox, but if D69 is meant to cover devices before they are held, Ming should confirm it in the spec.
- **`reload` after a write** (`devices.ts:665`) has no held filter. It is only reached after a write the tier was allowed to make. Someone should check that a User can't reach it for a device they don't hold (part of SIM-051's area, not this ticket's diff).
