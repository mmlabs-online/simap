# Security review — SIM-037.6

## Attempt 1

**Security review: SIM-037.6, attempt 1 (read-only)**

**Verdict: no blockers, no should-fix findings.** I found one low-impact note.

### Findings

**🟢 Auth runs before any query (R7)** in `d:\project\simap-game-ui\src\app\api\devices\[id]\history\route.ts:12-25`.
- The handler is wrapped in `withAuth(..., { tier: "user" })`.
- `d:\project\simap-game-ui\src\server\http\with-auth.ts:56-79` checks the token, `org_required`, the tier and the deactivated-member gate before the handler runs. The handler never returns 401 or 403 itself.
- The route is read-only, so there is no side effect a retry could repeat.
- `tier: "user"` matches DEV-11 ("Every member can open a device detail page").

**🟢 Every query is scoped to the org (R6)** in `d:\project\simap-game-ui\src\server\devices\history.ts`.
- **Device lookup (:37-46):** filters `d.org_id = $1 and d.id = $2`. The `holder_since` subquery joins on `a.org_id = d.org_id`, so it stays in the same org.
- **History query (:57-73):** filters `a.org_id = $1`.
  - The `members` join is `am.org_id = a.org_id and am.sub = a.actor_sub`.
  - The `device_handoffs` join is `h.org_id = a.org_id and h.device_id = a.entity_id`, plus a regex check on `meta.handoffId` before the uuid cast, so bad meta cannot cause a cast error. A forged `handoffId` in meta still cannot reach another org's handoff row.
- **Name lookup (:82-87):** `members where org_id = $1 and id = any($2::uuid[])`. Member ids taken from meta are checked as uuids in `d:\project\simap-game-ui\src\lib\devices\history.ts:27-34` and resolved only inside the org.
- All three go through `orgQuery`. Its text guard is satisfied, and I checked each join by hand.

**🟢 Another org's device id returns 404 with nothing leaked** (`history.ts:47`).
- An unknown id and another org's id both get the same `notFound` before the audit query runs.
- A non-canonical id gets 404 at `route.ts:15` before any DB access.
- The DB test covers cross-org and unknown ids.

**🟢 Cursor and limit validation** (`d:\project\simap-game-ui\src\lib\validate\device-history-query.ts`).
- **Limit:** must match `^[1-9]\d{0,2}$` and be at most 100. Repeated parameters are rejected.
- **Cursor:** `d:\project\simap-game-ui\src\lib\audit\cursor.ts:12-27` rejects anything except base64url JSON with exactly the keys `at` and `id`, a strict timestamp format and a canonical uuid.
- **SQL:** all values are bound parameters. The only interpolated text is the fixed `TS` format string, the fixed `keyset` fragment and a computed parameter number, so there is no injection path.
- **Cursor tampering:** a modified cursor can only move the keyset position. The query is still limited to this org and this device.

**🟢 No PII beyond the spec.**
- The mapper (`d:\project\simap-game-ui\src\lib\devices\history.ts:45-141`) builds each entry from an allowlist of fields. Raw `meta` is never passed to the client.
- Members appear only as `MemberRef = { id, displayName }` (`types.ts:99`). There is no email, employee code or Identity `sub`.
- Actions are limited by `DEVICE_HISTORY_ACTIONS` in SQL and checked again in the mapper.
- Notes (including decline and cancel notes) and expiry dates are what DEV-11 says should show ("note, expiry date, and who confirmed").
- The response sends `Cache-Control: no-store`, so other members' names and notes are not cached.
- Unhandled errors return a generic `500 internal`. The log keeps only an error code, no data.

**🟢 No secrets, and the UI does not import server code (R1, R3).**
- I searched `src/ui/devices` for `@/server`, `server-only`, `process.env`, `dangerouslySetInnerHTML` and `email`: no matches.
- `d:\project\simap-game-ui\src\app\(app)\devices\[id]\page.tsx` imports only from `@/ui`.
- The client encodes the id and cursor in URLs (`devices-api.ts:64,209`, `nav.ts:78-80`).
- The impl-log reports `check:layers` clean.

**💭 Note: an impossible date in a cursor can cause a 500** (`d:\project\simap-game-ui\src\lib\audit\cursor.ts:24`).
- `Date.parse` in V8 accepts some dates that do not exist (for example `2026-02-30T...`). Postgres then rejects the `$4::timestamptz` cast, and the request returns `500 internal` instead of `400 invalid_request`.
- Only a hand-crafted cursor triggers this. Nothing leaks, and the auth wrapper catches the error.
- Possible fix, outside this ticket's scope since `cursor.ts` is shared and was not changed here: round-trip check that `new Date(o.at).toISOString().slice(0,19)` equals `o.at.slice(0,19)`.

### Follow-ups (outside this ticket)
- The cursor strictness note above, for `src/lib/audit/cursor.ts`.
- The impl-log already records a separate bug: the `device_handoffs` inserts in `src/server/devices/handoffs.ts` fail the `orgQuery` guard, so starting a transfer, return or extension throws. It is not a security problem in this diff, but it needs its own BUG ticket.

I only read and searched code. I did not run any of the check commands.
