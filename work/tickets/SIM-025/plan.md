Status: READY

# Plan — SIM-025: Fix rooms API security findings (streamed body cap, delete lock order)

## Scope summary
From ticket.md Scope:
- "`src/server/request/read-json.ts`: read `req.body` as a stream, count bytes, cancel and refuse as soon as the total passes `maxBytes` (also without or with a lying `content-length`); decode with a fatal UTF-8 decoder; keep the `content-length` fast path."
- "`deleteRoom`: lock the room's seats (`select … from seats … for update` through `orgQuery`) before the impact check; document the lock order every future seat/device writer must follow (room row first, then seats)."
- "One-line comments at the two INSERTs that use the `select … from (select $1::uuid as org_id) o` form (`rooms.ts`, `audit/write.ts`), explaining why."
- "add the pending-request count to the delete audit `meta`."

Evidence: SIM-010 security-review.md findings 1 (read-json.ts:9-13), 2 (deleteRoom lock gap), 3 (audit meta); review.md nit 1 (INSERT comments), nit 5 (lock rule for later writers). Out of scope: `orgInsert` helper (High path), DB integration tests (SIM-026), other 💭 items. R4: nothing else is touched (review nits 2-4 are not in the ticket scope).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Body over the cap refused without reading it whole: stream body with no `content-length`, and with a lying small `content-length`; stream cancelled | `pnpm test` → `read-json.test.ts` › "stream over the cap without content-length -> not ok and cancelled", "lying small content-length with a stream -> not ok and cancelled" (the test's `cancel()` callback sets a flag; the source also records the number of chunks pulled, which must be less than the chunks available) |
| 2 | Invalid UTF-8 refused | `read-json.test.ts` › "invalid UTF-8 -> not ok" (bytes `0xC3 0x28` inside a JSON string) |
| 3 | `deleteRoom` locks the seats before counting the impact | `rooms.test.ts` › "forced delete order…" (updated) and "seats lock runs after the room lock and before the impact count, also without force" (statement-order assertions) |
| 4 | Lock-order rule written in `rooms.ts` and `src/server/README.md` | Read the doc comment above `deleteRoom` and the new README bullet |
| 5 | Delete audit meta includes the pending-request count | `rooms.test.ts` › forced-delete test: parsed meta equals `{code, seats, devices, pending, forced}` |
| 6 | All loop checks green; security rescan marks SIM-010 findings 1-2 resolved | Run the checks in `.claude/loop.config.md` (`pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm build`); the security agent rescan |

## Ming verification after merge
None. (Real-DB behaviour of the lock is covered by SIM-026.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/request/read-json.ts` (whole file, 18 lines) | Streamed read with byte counter, cancel on overflow, fatal UTF-8 decode | Finding 1 | No |
| `src/server/request/read-json.test.ts` | Add stream, cancel, lying-length and invalid-UTF-8 tests | AC 1, 2 | No |
| `src/server/rooms/rooms.ts` lines 94-96 and 212-243 | Comment on INSERT form; seats lock in `deleteRoom`; `pending` in audit meta; lock-order doc comment | Finding 2, 3, nit 1 | No |
| `src/server/rooms/rooms.test.ts` lines 244-269 and a new test next to 230 | Update indexes (statements shift by one), add order and meta assertions | AC 3, 5 | No |
| `src/server/audit/write.ts` lines 21-23 | One-line comment on the INSERT form | Nit 1 | No |
| `src/server/README.md` | Add a "Seat/device lock order" bullet | AC 4 | No |

No file matches a High path in `loop.config.md` (nothing under `src/server/http/**`, `src/server/identity/**`, `db/migrations/**`).

## Data model / migration
None.

## API contract
None. The routes keep their codes. An oversized, chunked or non-UTF-8 body still maps to 400 `invalid_request` through the existing `readJson` `{ ok: false }` path.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `read-json.test.ts` › "stream over the cap without content-length -> not ok and cancelled" | A `ReadableStream` of many 4 KB chunks, request built with `{ body: stream, duplex: "half" }` and no `content-length`; expects `{ ok: false }`, `cancel` called, and pulled chunks fewer than total |
| `read-json.test.ts` › "lying small content-length with a stream -> not ok and cancelled" | Same, with `content-length: 5` |
| `read-json.test.ts` › "invalid UTF-8 -> not ok" | `new Uint8Array([0x7b,0x22,0x61,0x22,0x3a,0x22,0xc3,0x28,0x22,0x7d])` body is refused (a lossy decode would have accepted it) |
| `read-json.test.ts` › "exactly maxBytes is accepted; maxBytes+1 is refused" | Boundary of the counter, multi-chunk body split mid-character reassembles correctly (multi-byte char split across two chunks decodes OK) |
| `read-json.test.ts` › "empty or missing body -> not ok" | `req.body === null` path |
| existing read-json tests | Must stay green (valid, wrong type, invalid JSON, cap, lying length with string body) |
| `rooms.test.ts` › "forced delete order…" (edit) | s[1] room `for update`; s[2] seats lock; s[3] impact count; s[4] update devices; s[5] delete seats; s[6] delete rooms; s[7] audit; s[8] commit; meta includes `pending` |
| `rooms.test.ts` › "seats lock runs after the room lock and before the impact count, also without force" | Index of seats-lock statement is between the room lock and the count; present on the non-forced path too; matches the exact statement (below) and binds `[org, RID]` |
| `rooms.test.ts` › "missing room -> 404 on delete" | Existing; confirms the seats lock is not reached when the room is missing (no seats statement in `sqls()`) |
| `rooms.test.ts` › org scoping test | Existing; the new statement carries `org_id = $1`, so it passes the loop check unchanged |

## Approach
1. `read-json.ts`: keep the content-type check and the `content-length` fast path (`Number.isFinite(declared) && declared > maxBytes` → refuse). Then: if `req.body` is null → `{ ok: false }`. Else `const reader = req.body.getReader()`; loop `read()`; `total += value.byteLength`; if `total > maxBytes` → `await reader.cancel().catch(() => {})` and return `{ ok: false }`; collect chunks. After the loop, concatenate into one `Uint8Array`, decode with `new TextDecoder("utf-8", { fatal: true })` (no BOM stripping change needed; `ignoreBOM` default strips a BOM, which is fine), `JSON.parse`. Wrap everything in try/catch → `{ ok: false }`; in `finally`/catch path release the lock via cancel so the stream is never left open. Remove the post-hoc `TextEncoder` length check (the counter replaces it).
2. `rooms.ts` `deleteRoom`: after `lockRoom`, before `impactOf`, add the seats lock (exact statement below). Add the doc comment. Add `pending: impact.pendingRequests` to the audit meta (code and counts only, per SYS-03).
3. Add the one-line comments on the two INSERTs: `-- form required by orgQuery's org_id = $1 guard; org_id is always the scope org` (inside the SQL template, so it is a SQL comment; the test normalises whitespace and `startsWith("insert into …")` checks still hold because the comment is placed after the `insert into` line. If a comment inside SQL would break the existing `^insert into audit_log` assertions, use a TS `//` comment above the call instead — implementer's choice, default: TS `//` comment above, to keep the SQL text and tests unchanged).
4. README bullet, and the doc comment, state the rule (below).
5. Update/add tests, run the checks.

**Exact lock statement (for SIM-026):**
`select id from seats where org_id = $1 and room_id = $2 order by id for update`
run through `orgQuery(c, scope, <that SQL>, [id])` (so values are `[scope.orgId, roomId]`). The `order by id` gives a stable lock order if two transactions ever lock overlapping seat sets (for example a future bulk seat writer); with the room lock held first it is cheap insurance.

**Lock order (every writer of seats, occupants, devices placement, seat requests approval):**
1. Room row first: `select … from rooms where org_id = $1 and id = $2 for update` when the writer creates, deletes or renames seats (this is `lockRoom` / `allocateSeatSeq`), or `for share` when it only changes an existing seat's occupant or places/moves a device on it.
2. Then seat rows (`for update`), in ascending `id` order when more than one.
3. Then devices / seat_requests.
Never take a seat lock before the room row, and never lock a room while holding a seat lock. `deleteRoom` holds room `for update` then all its seats `for update`, so a concurrent occupant/device writer either committed before the lock (counted by the impact check) or waits and then fails the FK/ row check.

R1 (layers) unchanged; R3 no env; R6 the new statement goes through `orgQuery` with the scope org; R5 tests listed above.

## Specialist input used
None (no consult files; fast lane).

## Assumptions
- Default: the lock statement includes `order by id` (small deviation from the ticket's bare `select … for update`; harmless, easy to drop).
- Default: `pending` is the meta key name (matches review suggestion); a non-forced delete can have pending > 0, which is exactly what the audit should now show.
- Default: the INSERT comments are TS `//` comments above the query call so SQL text and existing `startsWith` assertions stay untouched.
- `Request` with a `ReadableStream` body in Node 22 needs `duplex: "half"` in the init in tests; Vitest runs in Node so this works. If the test environment is jsdom/edge the implementer notes it in impl-log.
- The `content-length` fast path is kept as is; NaN or absent header falls through to the streamed count.
- Hotspots: SIM-026 (same batch, builds after this ticket) edits `rooms.test.ts`/adds a DB test for `deleteRoom`; SIM-006.2 and SIM-019 are not expected to touch these files. If any other IN_PROGRESS/REVIEW ticket edits `rooms.ts` or `rooms.test.ts`, expect a rebase.
- Review nit 5 (future writers must lock the room row `for share`) is captured only as the documented rule; the writers themselves are later tickets.

## Blocking questions
None.

## Split proposal
None. Estimated change is well under 400 lines.
