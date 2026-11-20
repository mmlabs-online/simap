# Security review — SIM-025

## Attempt 1 — security-ai-generated-code-auditor

**What I checked:** `git diff origin/main...HEAD` on `ticket/SIM-025`. I also read:
- `ticket.md` and `plan.md`
- the SIM-010 `security-review.md`
- `orgQuery` in `src/server/http/org-scope.ts`
- `lockRoom`, `impactOf` and `deleteRoom` in `src/server/rooms/rooms.ts`
- the seat, device and seat-request foreign keys in `db/migrations/20261120150000_init.sql`

I ran `vitest run src/server/request src/server/rooms`: 3 files, 31 tests, all passed. I did not run the other loop checks (format, typecheck, layers, build); the reviewer runs them. I edited no files and read no `.env*` file.

**Verdict: no 🔴 blockers, no 🟡 should-fix. 3 💭 notes. SIM-010 findings 1, 2 and 💭3 are all resolved.**

## Rescan of the SIM-010 findings

**1. 🟡 Body read in full before the size check: RESOLVED.** `src/server/request/read-json.ts:11-36`
- `req.body.getReader()` reads chunk by chunk and adds up `value.byteLength`.
- As soon as `total > maxBytes` it calls `await reader.cancel().catch(() => {})` and returns `{ ok: false }`, before the chunk is stored. Memory is limited to `maxBytes` plus one transport chunk.
- The old `await req.text()` and the encode-after-read check are gone.
- The `content-length` fast path is kept (lines 9-10). A missing or NaN header falls through to the streamed count.
- `req.body === null` returns `{ ok: false }`.
- Decoding uses `new TextDecoder("utf-8", { fatal: true })`, so a decode error lands in the `catch` and gives `ok: false`.
- Tests that prove it: "stream over the cap without content-length", and "lying small content-length with a stream". Both assert `cancelled === true` and `pulled < 100`. "invalid UTF-8" checks that `C3 28` is refused. Boundary tests cover `maxBytes` exact, `maxBytes - 1`, and a multi-byte character split across two chunks.
- Both callers (`src/app/api/rooms/route.ts:26` and `src/app/api/rooms/[id]/route.ts:19`) still map `ok: false` to 400.

**2. 🟡 A non-forced delete could remove a seat that became occupied: RESOLVED (unit level; real-DB proof is SIM-026).** `src/server/rooms/rooms.ts:231-238`
- After `lockRoom` (room row `for update`), the service runs `select id from seats where org_id = $1 and room_id = $2 order by id for update` through `orgQuery(c, scope, …, [id])`. Then it calls `impactOf`.
- Each concurrent writer that could slip in after the count is now blocked:
  - An occupant UPDATE on `seats` waits for the row lock.
  - A device placed or moved onto a seat waits, because the `devices_seat_fkey` check takes `FOR KEY SHARE`, which conflicts with `FOR UPDATE`.
  - A new `seat_request` waits on its FK for the same reason.
  - New seats wait on the room lock, through `allocateSeatSeq`.
- Changes the lock does not block (a device leaving the room, a request moving pending → cancelled) can only make the counts too high. That errs toward refusing the delete, so it is safe.
- The lock order is written above `deleteRoom` (`rooms.ts:213-222`) and in `src/server/README.md`: room first, then seats in ascending id, then devices and requests.
- Tests: the forced-delete test checks the statement order (`s[2]` is the exact lock SQL). The new "seats lock runs after the room lock and before the impact count, also without force" test also asserts the bound values `[scope.orgId, RID]`.

**3. 💭 Delete audit did not record dropped requests: RESOLVED.** `rooms.ts:256-262`
- `meta` now has `pending: impact.pendingRequests`. That is a count only, so it fits SYS-03 (codes and counts only).
- The forced-delete test asserts `{code, seats, devices, pending: 0, forced}`.

**SIM-010 💭7 (INSERT form) and review.md nit 1:** both INSERTs now have a one-line comment explaining why they use this form (`rooms.ts` in `createRoom`, and `audit/write.ts:18`). The SQL text is unchanged.

## New code: checks

- **Stream reader cancel and leak:** clean.
  - When the total goes over the cap, the stream is cancelled before returning.
  - When `read()` rejects, `JSON.parse` throws or decoding fails, the `catch` calls `reader.cancel().catch(() => {})`. Cancelling a stream that is already closed or errored resolves or is swallowed, so the original error is not masked and the function still returns `ok: false`.
  - On success the stream has already finished (`done`), so leaving the reader lock in place has no effect.
- **Decoder errors:** `fatal: true` throws `TypeError` on bad UTF-8, and the error is caught. A leading BOM is stripped (the default `ignoreBOM: false`), which is harmless before `JSON.parse`. A multi-byte character split across chunks is handled because the chunks are joined before decoding (tested).
- **Lock statement scoping through `orgQuery`:** clean. The SQL contains `org_id = $1`, so the guard passes, and `$1` is `scope.orgId` from the verified token. `room_id = $2` is the path id, already canonical-UUID checked and confirmed to exist in this org by `lockRoom` (which throws a 404 Abort first). No org id comes from the request (R6). There is no string building, so no SQL injection.
- **Lock order and deadlocks:** clean. `deleteRoom` locks the room and then the seats. The documented rule (room row `for share` or `for update` first, seats second) puts every future writer in the same order, so `deleteRoom` cannot deadlock with them. `order by id` gives a fixed order for seat sets that overlap.
- **Audit meta:** clean. It adds one integer count and no user-supplied text.
- **Secrets and client exposure:** none added. No `NEXT_PUBLIC_`, no env reads, and all changed files stay under `src/server/**` with `import "server-only"`. No LLM calls.
- **High paths:** none touched. Nothing changed under `src/server/http/**`, `src/server/identity/**` or `db/migrations/**`.

## Findings

1. 💭 **A slow client can hold a request open.** `src/server/request/read-json.ts:16-25`
   - `reader.read()` has no deadline, so a client that trickles bytes slowly can hold a handler and its DB-free await for as long as the Node server allows (Node's `requestTimeout` defaults to 300 s).
   - Memory is now capped, so this is only a slow-request (slowloris) concern, and the attacker needs an Admin token.
   - **Optional fix:** none needed in this ticket. If wanted later, race the read loop against a timer (around 10 s) and cancel the reader on timeout, or set `server.requestTimeout` and `headersTimeout` at the deployment layer.

2. 💭 **The lying-`content-length` test does not match real HTTP.** `read-json.test.ts:60-65`
   - The test passes `content-length: 5` with a long stream through a `Request` object.
   - On a real HTTP/1.1 socket, Node's parser uses the header to end the body after 5 bytes, so the "lying" case cannot happen there.
   - The test is still useful: it proves the counter does not trust the header. It is noted only so nobody reads it as an end-to-end proof.

3. 💭 **The lock proof is unit-level only.** `rooms.test.ts`
   - The fake client checks the statement order, not that Postgres actually blocks.
   - The real-database check is SIM-026's (planned: two connections, delete versus occupant UPDATE and versus a device INSERT). Keep it as an acceptance criterion there.

## Follow-ups (out of scope)
- SIM-012, SIM-013 and SIM-015.x (seat and device writers) must follow the documented lock order: room row `for share` (or `for update`) first, then seats. A reviewer trigger or checklist line for those tickets would enforce it.
- From SIM-010: move the streaming size cap into a shared helper before other modules copy `readJson`. `readJson` already sits in `src/server/request/`, so new routes just need to import it.
- An `orgInsert` helper is still deferred (High path `src/server/http/**`).
