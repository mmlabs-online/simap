## Attempt 1

Verdict: PASS

Security review of SIM-012, attempt 1: no 🔴 blockers, 2 🟡, 5 🟢. This verdict comes from reading the code only. I did not run any checks or tests, so R5 still depends on the reviewer confirming green checks.

All paths are under `d:\project\simap-wt\SIM-012`.

## Findings

### 🟡 1. The cannot-seat reason accepts NUL, control, bidi and invisible characters
**Where:** `d:\project\simap-wt\SIM-012\src\lib\validate\seat.ts:52-55`

The validator only applies NFC, `trim()` and a length check. Three failures follow:
- **Unhandled 500:** a Manager sends `{"cannotSeat":true,"reason":"a\u0000b"}`. Postgres rejects NUL in `text`, so the route answers 500 `internal` instead of 400. The transaction rolls back, so no data is damaged.
- **Required reason bypassed (D26):** `"\u200B"` survives `trim()`, so a seat can be flagged with a reason that displays as blank.
- **Spoofed text:** the reason is shown to every User in the org. A bidi override such as U+202E can make it read differently from what was stored. React escaping prevents XSS, but not this.

**Fix:** apply the rule `normalizeDisplayName` already uses (`src/lib/validate/member.ts:13-26`). Move `INVISIBLE` and `VISIBLE` into a small shared `src/lib/validate/` helper, then reject a reason that contains `[\p{Cc}\p{Cf}]` or filler characters, or has no visible character. Add tests for NUL, U+200B, U+202E and a newline.

### 🟡 2. No test proves that seat writes refuse another org's seat id
**Where:** `d:\project\simap-wt\SIM-012\src\server\seats\seats.db.test.ts` (cross-org checks at lines 82, 214-221 and 301-315)

Cross-org tests cover add, get, list and a foreign `memberId`. `deleteSeat`, `setOccupant`, `releaseSeat` and `setCannotSeat` are only ever called with the world's own seat. The code is correct today. But if a later edit drops `org_id` from one write or lock, a Manager in org A could change a seat in org B and no test would fail. `orgQuery` would not catch it either if another `org_id = $1` remains in the SQL, because it checks the text only.

**Fix:** add one DB test that calls all four with `w.scope` and `other.seatId`. Assert 404 `not_found`, the foreign row unchanged, and no audit row in either org.

### 🟢 3. Release takes write locks before checking that the caller is the occupant
**Where:** `d:\project\simap-wt\SIM-012\src\server\seats\seats.ts:422-424`

Any User can make the server take room `for share` and seat `for update` on any seat in their org, even when the request will be refused. Concurrent calls against one seat queue on the lock and occupy the 5-connection pool (`src/server/db/pool.ts:15`), which can delay or fail a Manager's assign. Neither the route nor `withAuth` has a rate limit.

**Fix:** do an unlocked pre-read and refuse early when the seat has another occupant. Keep the locked re-check for the success path.

### 🟢 4. Small window between the deactivation gate and the write
**Where:** `d:\project\simap-wt\SIM-012\src\server\http\with-auth.ts:73`

A Manager deactivated just after the gate passes can still complete one in-flight write. This is the existing pattern for every route, and the window is milliseconds. I would accept it.

### 🟢 5. The audit helper's comment no longer matches A11
**Where:** `d:\project\simap-wt\SIM-012\src\server\audit\write.ts:6`

It says meta holds "codes, field names and counts only", but seat audit rows now also hold member UUIDs. That is allowed by A11. The audit route is Admin-only and the meta has no names, emails or reason text. Update the comment in a follow-up, because this file is outside the plan.

### 🟢 6. No total seat cap per room
**Where:** `d:\project\simap-wt\SIM-012\src\server\seats\seats.ts:268-292`

An Admin can repeat `count: 50` without limit. Past 500 seats, the list truncates and later seats drop out of it, although the response does flag `truncated`. Each 50-seat add also makes about 101 round trips while holding the room lock. This is Admin-only, so the risk is low. A per-room cap and a batched audit insert would close it.

### 🟢 7. The list response is large for a User-tier route
**Where:** `d:\project\simap-wt\SIM-012\src\lib\seats\types.ts:3-4`

One request can return up to 500 seats with 20 devices each, so 10,000 device objects. `devices.name` has no database length limit, so SIM-013 must cap device text fields.

## Follow-ups (out of scope)
- `src/lib/validate/room.ts:26-39` has the same NUL and invisible-character gap for room name, description and floor.
- SIM-013 and SIM-014 must follow the lock order in `rooms.ts:213-224`, and SIM-014 must refuse approval on a cannot-seat seat.
- Seat delete cascades decided request rows (A10). The history survives only if SIM-014 writes an audit row for each request decision.

## What I checked
| Area | Result |
|---|---|
| Route tiers | All 7 handlers go through `withAuth`: GET and release are user, occupant and cannot-seat are manager, add and delete are admin. |
| Releasing another person's seat | Refused with 409 `not_allowed`, including for Managers and callers with no member row. |
| Cross-org and IDOR | Seat, room and member lookups are all scoped by the token's org, and foreign ids get 404 or the same 422 as an unknown id. Composite foreign keys back this up. |
| Deactivated member | The caller is blocked by the gate, and a deactivated target gets 422 under a `for share` lock. |
| R6 | Every query, join, subquery, lock and audit insert in `seats.ts` is org-scoped. |
| R7 | No seat handler returns 401 or 403. Those come only from the wrapper, before any side effect. |
| DTO disclosure | No `sub`, MAC, email or employee code. `mine` is computed per caller. Occupant, owner and reason exposure matches SEA-01 and SEA-05. |
| Audit meta | Only codes, counts, booleans and the member UUIDs A11 allows. The reason text is excluded. |
| Input limits | Count 1..50, reason max 200, list and device caps, 16 KB body limit, unknown keys rejected, canonical UUIDs only. The gap is finding 1. |
| SQL injection | All values are bound. The interpolated fragments are constants or internal numeric limits. |
| TOCTOU and deadlocks | Assign, replace, delete, release and cannot-seat re-read state under locks. Their order is consistent with `deactivateMember`, `deleteRoom` and rename. I found no lock cycle. |

## Limits
- I did not run the app, tests, checks or a database, and did not read any `.env*` file. The green results in `impl-log.md` are unverified.
- With no git access, I relied on `impl-log.md` for the changed-file list.
- The race analysis comes from reading the code and assumes Postgres's default READ COMMITTED isolation. I did not observe it under real concurrency.
- I read test files only where needed for coverage claims, and did not review `seats-routes.test.ts` or `seats.test.ts` in full.
- This is a code-level review and does not guarantee the absence of vulnerabilities.
