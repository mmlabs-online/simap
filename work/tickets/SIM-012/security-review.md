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

## Attempt 2

Verdict: REWORK

Attempt 1 finding 🟡 1 is only partly closed. NUL, C0/C1 controls, bidi controls, zero-width characters and the four Hangul fillers are now rejected, and the length cap holds. A reason that displays as blank is still accepted (finding 1), so the D26 bypass remains. No 🔴, 3 🟡, 1 🟢.

I could not execute code in this session. Results below come from reading the code plus Unicode properties, so **run the proposed test cases to confirm them**.

## Findings

### 🟡 1. U+2800 still bypasses the required reason (D26)
**Where:** `d:\project\simap-wt\SIM-012\src\lib\validate\seat.ts:12-13`, checked at `:59-60`

**Failure:** a Manager sends `{"cannotSeat":true,"reason":"\u2800"}`. U+2800 BRAILLE PATTERN BLANK has category `So`, so:
- `trim()` keeps it, because it is not whitespace.
- `INVISIBLE` misses it, because it is not `Cc`, `Cf` or a listed filler.
- `VISIBLE` matches it through `\p{S}`.

The seat is flagged cannot-seat with a reason that renders blank for every User in the org.

**Fix:** use the regex under finding 2, which adds `\u2800`, and add `"\u2800"` to the rejected test cases.

### 🟡 2. Hidden and line-breaking characters pass when next to one visible character
**Where:** `d:\project\simap-wt\SIM-012\src\lib\validate\seat.ts:12`

`INVISIBLE` covers only `Cc`, `Cf` and four fillers. Each of these is accepted inside a value such as `"a<char>b"`:

| Characters | Category | Failure |
|---|---|---|
| U+2028, U+2029 | `Zl`, `Zp` | Line break inside the reason, which the control-character ban was meant to stop |
| U+034F, U+FE00-FE0F, U+E0100-E01EF | `Mn`, default-ignorable | Invisible data can be hidden in text that looks normal; variation selectors can encode an arbitrary payload |
| U+2065, U+FFF0-FFF8, unassigned U+E0000 range | `Cn`, default-ignorable | Same hidden-text risk |
| U+E000 and other private use | `Co` | Renders as tofu or font-dependent glyphs |
| Lone surrogate `\uD800` (valid in JSON) | `Cs` | See below |

For a lone surrogate, Node's UTF-8 encoding should store U+FFFD, so the stored value differs from the validated one. The no-op comparison at `d:\project\simap-wt\SIM-012\src\server\seats\seats.ts:454` then never matches, and each identical retry performs another update and writes another `seat.cannot_seat` audit row (`:457-470`). I inferred the encoding step and did not observe it through `pg`.

**Fix:** replace line 12 with:

```ts
const INVISIBLE = /[\p{C}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800]/u;
```

`\p{C}` covers `Cc`, `Cf`, `Cs`, `Co` and `Cn`. Default-ignorable covers all four Hangul fillers, so the invisible literals can go. Vietnamese text is unaffected.

**Trade-off:** emoji using VS16 (for example U+2764 U+FE0F) become invalid. ZWJ emoji are already rejected. This seems acceptable for a short operational reason.

### 🟡 3. Tests omit cases Attempt 1 explicitly required
**Where:** `d:\project\simap-wt\SIM-012\src\lib\validate\seat.test.ts:68`

Attempt 1 asked for NUL, U+200B, U+202E and a newline. U+202E and an interior newline are missing. Both are rejected by the current code, but a later regex edit could drop that with no failing test. Line 68 also uses raw invisible literals, which are hard to review.

**Fix:** use escaped values only:

```ts
["a\u0000b", "\u200B", "\u3164", "\u115F \u200B", "a\u202Eb", "a\nb", "a\u2028b", "a\u2029b",
 "\u2800", "a\u034Fb", "a\uFE0Fb", "a\u2065b", "a\uE000b", "a\uD800b"]
```

### 🟢 4. Stacked combining marks remain possible
**Where:** `d:\project\simap-wt\SIM-012\src\lib\validate\seat.ts:55-60`

`"a"` followed by 199 combining marks passes and can draw over neighbouring UI. The 200-unit cap bounds it, and `Mn` cannot be banned outright without risking legitimate text. No UI renders `cannotSeatReason` yet (only the DTO and server reference it). Clip the reason visually when the UI is built.

## Follow-ups (out of scope)
- `src/lib/validate/member.ts:13-16` has the same class gaps, so a display name of U+2800 passes. Attempt 2 copied these regexes. A shared helper would fix both.
- Apply the same helper to the `src/lib/validate/room.ts` gap already recorded in Attempt 1.

## What I checked
| Area | Result |
|---|---|
| Order of operations | NFC, then trim, then all checks, and the checked string is the one returned. No normalization runs after validation. |
| NFC or trim creating a bypass | None, because checks run on the final value. |
| Length cap | Still applies after NFC and trim, so NFC expansion is counted. It counts UTF-16 units, so astral characters count as 2, which is stricter. |
| Regex state | Both have `u` and no `g`, so there is no `lastIndex` carry-over. |
| Filler literals | Line 12 contains exactly U+115F, U+1160, U+3164, U+FFA0 (byte-level grep). |
| Whitespace-only input | Rejected after `trim()`. |
| NUL 500 path | Closed: NUL is `Cc`, so the route returns 400 before any DB call. |
| Write path | The only `cannot_seat_reason` update is in `setCannotSeat`, and its only route caller validates first. |
| Migration | The column is `text` with no length or content constraint, so the validator is the only gate. |

## Limits
- I did not run tests, the app, a server or a database, and did not read any `.env*` file. The green checks in `impl-log.md` are unverified.
- Unicode categories are from my knowledge of the standard and were not checked against the runtime's ICU version. `\p{Cn}` depends on that version.
- Blank rendering can be font-dependent, so no blocklist can guarantee that every accepted string is visibly non-blank.
- Scope was finding 1 only. Other Attempt 1 findings stand as recorded. This is a code-level review and does not guarantee the absence of vulnerabilities.
