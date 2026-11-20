# Security review — SIM-010

## Attempt 1 — security-ai-generated-code-auditor (SIM-010 Slice A)

Scope: `git diff origin/main...HEAD` on `ticket/SIM-010`. I read the new routes, the rooms service, `withTx`, `writeAudit`, `readJson`, `roomConflict`, the room validator, the existing `withAuth`, `orgQuery`, `apiError` and `isCanonicalUuid`, and `db/migrations/20261120150000_init.sql`. This was a static read only. I did not run any checks, did not edit anything and did not read any `.env*` file.

**Verdict: no 🔴 blockers. 2 🟡 should-fix, 5 💭 notes.**

### Findings

1. 🟡 **The JSON body is read in full before its size is checked.** `src/server/request/read-json.ts:9-13`
   - **Risk:** The `content-length` pre-check only works when the header is present and honest. A chunked request has no `content-length` header. A request with a too-small one is only caught at line 13 (the test "a lying small content-length…" confirms this). In both cases `await req.text()` has already loaded the whole body into memory. Next.js App Router route handlers have no default body-size limit, and this repo has no `proxy.ts`/`middleware.ts` and no limit in `next.config`. So one request with a multi-hundred-MB body can push memory up or crash the standalone server (CWE-400).
   - **Mitigation already in place:** `withAuth` runs before `readJson`, so the attacker needs a valid Admin token in some org. Any org's Admin can still affect every org on the shared server.
   - **Fix:** Read `req.body` with `getReader()`, add up `value.byteLength`, and call `reader.cancel()` and return `{ ok: false }` as soon as the total passes `maxBytes`. Then decode with `new TextDecoder("utf-8", { fatal: true })` (a decode error also gives `ok: false`). Keep the `content-length` fast path. Add a test with a `ReadableStream` body that has no `content-length` and is larger than the cap.

2. 🟡 **A plain (non-forced) delete can still delete an occupied seat if a seat changes during the delete.** `src/server/rooms/rooms.ts`, `deleteRoom` (the `lockRoom` → `impactOf` → delete sequence)
   - **Risk:** The guard locks only the `rooms` row. Changing a seat's occupant or putting a device on a seat does not touch that row. So this can happen:
     1. Transaction A (a delete without force) counts `occupied = 0`.
     2. Transaction B assigns an occupant, or places a device, and commits.
     3. Transaction A deletes the seats.

     The `room_not_empty` guard (ROO-01, Q4) is bypassed and the audit row records `forced: false` with stale counts. The writers that change seats come in later tickets (SIM-015.x and the device tickets), so this cannot happen today. It becomes possible as soon as those land, and the lock order is set by this service.
   - **Fix (one line):** before `impactOf`, run `select id from seats where org_id = $1 and room_id = $2 for update` through `orgQuery`. This blocks occupant updates and the FK `KEY SHARE` taken when a device is placed, and new seats are already blocked by the room lock through `allocateSeatSeq`. As an alternative, write down a rule in `rooms.ts` that every service that changes a seat must first lock the room row with `for share`. Add a unit test that checks the statement order includes the seats lock.

3. 💭 **The delete audit row does not record dropped seat requests.** `src/server/rooms/rooms.ts`, `deleteRoom`, audit `meta`
   - Following Q4, a non-forced delete still removes pending seat requests (through the `seat_requests` FK cascade). The audit row records `{code, seats, devices, forced}` but no request count, so the log does not show that requests were dropped.
   - **Fix:** add `pending: impact.pendingRequests` to `meta`. It is a count, so it fits the SYS-03 rule of codes and counts only.

4. 💭 **The room list is silently cut at 500.** `src/server/rooms/rooms.ts`, `listRooms` (`limit 500`)
   - This follows the plan, but the client cannot tell that the list was cut. This is not a security issue. It is a follow-up if an org may have more than 500 rooms.

5. 💭 **Free text is not filtered for control or bidi characters.** `src/lib/validate/room.ts`, `name`/`optionalText`
   - `name`, `description` and `floor` accept control and bidi-override characters. React escapes output, so this is not XSS. It only allows display spoofing in lists.
   - **Optional fix:** reject `/[\p{Cc}\p{Cf}]/u` (keep `\n` in `description` if that is wanted).

6. 💭 **The room code check runs after `toUpperCase()`.** `src/lib/validate/room.ts`, `code`
   - A few non-ASCII characters become ASCII when uppercased (`ſ` → `S`, `ı` → `I`), so they are accepted. The stored value is always the canonical ASCII form, so this is harmless. It is noted only so nobody "fixes" the order and breaks Q2.

7. 💭 **Inserts get past the `org_id = $1` guard with a constructed subquery.** `src/server/audit/write.ts:21-23` and the insert in `createRoom`
   - Both use `select … from (select $1::uuid as org_id) o where o.org_id = $1` only to pass the `orgQuery` guard. This is correct: `org_id` is always bound from `scope.orgId`. It shows that the guard only checks the SQL text, so reviewers must keep reading joins and inserts by hand, as `org-scope.ts` already says.

### Checked and clean
- **Org isolation (R6):**
  - Every statement goes through `orgQuery`, with `$1` bound to `ctx.scope.orgId` from the verified token.
  - No org id is read from the body, the URL or headers.
  - All joins match on `org_id` (`seats`↔`rooms`, `devices`↔`seats`, `seat_requests`↔`seats`).
  - A room id from another org gets a 404 from `lockRoom` / the existence check, the same response as a missing id, so other orgs' rooms cannot be detected.
  - The schema's composite FKs back this up.
- **Tier per route:** GET `/api/rooms` is `user`. POST, PATCH, DELETE and GET `delete-impact` are `admin`. This matches plan.md:107-111.
- **No 401/403 after a side effect:** `withAuth` decides 401/403 (including `member_deactivated`) before the handler runs. After that, handlers return only 400/404/409/503/2xx.
- **SQL injection:**
  - Every value is passed as a bound parameter.
  - The only built-up SQL is the `SET` list in `updateRoom`. Its column names come from the fixed `COLUMNS` list and placeholders are numbered in the same order as the values.
  - The seat rename uses `unnest($2::uuid[], $3::text[])`.
- **Mass assignment:**
  - Unknown keys are rejected with 400 (`unknownKey`), including `org_id`, `seat_counter`, `id` and `__proto__` (`JSON.parse` creates `__proto__` as an own key, so it is caught).
  - An empty PATCH is rejected.
  - `seat_counter` is written only by `allocateSeatSeq`.
- **`readJson`:**
  - The content type must be exactly `application/json` (parameters are allowed).
  - Malformed JSON returns `ok: false`, which the route turns into 400 `invalid_request`.
  - The size cap is 16 KB (but see finding 1).
- **Path id:** `isCanonicalUuid` returns 404 before any database call. The `force` flag is read only from the query, and only the exact value `"true"` counts.
- **Error leakage:**
  - `apiError` sends only `{error:{code}}`.
  - `roomConflict` maps only the two named unique constraints to 409.
  - Anything else becomes a 500 through `withAuth`, which logs only the SQLSTATE code: no message, no SQL and no parameters.
  - Successful responses send `Cache-Control: no-store`.
- **Audit meta:** it holds only room codes, field names, counts and `forced`. There are no names or descriptions, no tokens and no email. `actor_sub` is a uuid that `verify.ts:137` checks. The audit row is written in the same transaction as the change.
- **Transactions:**
  - `withTx` runs BEGIN, then the work, then COMMIT. On any error it rolls back and re-throws the original error, and it always releases the client.
  - Domain refusals (`Abort`) throw, so the transaction rolls back.
  - Deferred trigger errors raised at COMMIT go through the same path.
  - The rename is atomic, and a forced delete changes devices to secondary/unplaced in one `UPDATE`, which the deferred trigger accepts.
- **Secrets:** no secrets or `NEXT_PUBLIC_` variables were added. No server code is reachable from `src/lib` (the new lib files are pure). There are no LLM calls.

### Follow-ups (out of scope)
- When SIM-015.x and the device tickets add seat and device writers, they must follow the lock order from finding 2.
- A rate limit on write routes is not in the plan. It is a platform-wide concern.
- Consider moving the streaming size cap into a shared helper before other tickets copy `readJson`.
