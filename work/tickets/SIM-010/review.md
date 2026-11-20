## Attempt 1 — 2026-11-20
Verdict: PASS

Scope of this review: Slice A (API) only, per Ming's split (ticket.md Notes, Q21). The UI half of AC4 ("the UI hides
the actions") belongs to SIM-010.2 and is not judged here.

### Checks (run by reviewer)
Environment: Windows, Node 24 with `--config.engine-strict=false` (CI uses Node 22). No local Postgres.
- `pnpm format:check` — exit 0, "All matched files use the correct format." (144 files)
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0; "check-layers: 121 files, no violations"
- `pnpm test` — exit 0, "Test Files 48 passed (48)", "Tests 461 passed | 3 skipped (464)"
- `pnpm build` — exit 0; `/api/rooms`, `/api/rooms/[id]` and `/api/rooms/[id]/delete-impact` listed as dynamic routes
- These results match impl-log.md Attempt 1.

### Acceptance criteria
- [x] AC1: a duplicate room code in the same org is refused, and the same code in another org is allowed. Evidence:
  `src/lib/validate/room.test.ts` › "lowercase input is stored uppercase (Q2)", "c302 and C302 normalise to the same
  value"; `src/server/rooms/pg-error.test.ts` › "23505 on rooms_org_code_key or seats_org_code_key -> room_code_taken";
  `src/server/rooms/rooms.test.ts` › "unique violation -> 409 room_code_taken and ROLLBACK", "every statement filters
  org_id = $1 and binds the scope org first". Cross-org half: I read the schema, `rooms_org_code_key unique (org_id, code)`
  at `db/migrations/20261120150000_init.sql:73`. **Pending (real DB):** the plan's one-off psql check was not run
  because there is no local Postgres, and CI's Postgres job runs only the migrate smoke test and schema-check, never this
  service SQL. See "Real-DB items pending".
- [x] AC2: renaming `C302` to `C303` renames every seat atomically. Evidence: `src/lib/rooms/seat-code.test.ts` ›
  "C302 -> C303 derives from seq" (includes seq 110 → `C303-110`); `rooms.test.ts` › "rename: lock, update room, update
  seats from renameSeatCodes, audit, COMMIT in one client" (asserts the unnest payload
  `[org, ["s1","s2"], ["C303-01","C303-02"]]`), and "rename failure -> ROLLBACK, no COMMIT; unique violation -> 409".
  From reading the SQL (`src/server/rooms/rooms.ts:135-174`): the room row is locked `for update`, the room UPDATE runs
  before the seat UPDATE (so a taken room code fails first, on `rooms_org_code_key`), and the new seat codes carry the
  new prefix, so the non-deferred `seats_org_code_key` cannot collide inside one room. **Pending (real DB):** the psql
  replay.
- [x] AC3: deleting the last seat and adding a new one gives the next number. Evidence: `seat-code.test.ts` › "after
  seats 1..3 and deleting 3, next seq is 4, not 3"; `rooms.test.ts` › "increments seat_counter with UPDATE ...
  RETURNING and never reads max(seq)" (`rooms.ts:246-261`). The counter is not changed by any delete path.
- [x] AC4 (API half): non-Admins get 403 on writes. Evidence: `src/app/api/rooms/route.test.ts` › "User and Manager get
  403 forbidden on POST, PATCH, DELETE and delete-impact", "User passes the GET gate (503 unavailable with DATABASE_URL
  unset)". The 403 comes only from `withAuth` (`src/server/http/with-auth.ts:60-67`) before the handler runs; handlers
  return only 400/404/409/503. The UI half moves to SIM-010.2.
- [x] AC5: unit tests cover code generation, rename mapping and delete-impact rules: `seat-code.test.ts`,
  `delete-impact.test.ts`, `validate/room.test.ts` all run green.
- [x] Checks green (above).

### Focus points (requested)
- **SQL against the init schema:**
  - The composite FKs are respected: every join filters `org_id` on both sides (`rooms.ts:62`, `:184`, `:186`).
  - The forced delete runs in this order: lock room → impact → `update devices set role='secondary', seat_id=null`
    → delete seats → delete room → audit (`rooms.ts:219-242`). That order satisfies `devices_seat_fkey on delete
    restrict` and `seats_room_fkey on delete restrict`, and it satisfies `devices_primary_needs_seat_check` because
    role and seat_id change in one UPDATE. `seat_requests` and `layout_fixtures` cascade. The deferred
    `devices_primary_owner_trg` re-reads the row at COMMIT, sees `role <> 'primary'` and returns, and
    `seats_primary_owner_trg` does not fire because no `occupant_id` is updated. No other table references
    seats or rooms (grep of `references seats|rooms`).
  - `group by r.id` is valid because `rooms.id` is the primary key.
  - Every parameter is used with one consistent type.
- **The seat-code rename handles seq ≥ 100:** `formatSeatCode` pads with `padStart(2)` and never truncates (tested with
  100 and 110). It does not use SQL `lpad`, so the tested function is also the production path.
- **The orgQuery INSERT workaround** (`insert … select o.org_id, … from (select $1::uuid as org_id) o where o.org_id =
  $1::uuid`) is correct. The `where` is a tautology, but the inserted `org_id` is still exactly `scope.orgId`, and the
  regex `\borg_id\s*=\s*\$1\b` matches `o.org_id = $1::uuid`. It is acceptable because the clean fix (an `orgInsert`
  helper or an INSERT exemption in `orgQuery`) would edit `src/server/http/org-scope.ts`, a High path, and that is out
  of scope here. Readability is the weak point; see Nit 1 and the follow-up.
- **Q22:** `trim().toUpperCase()` runs before the charset and length checks (`src/lib/validate/room.ts:163-167`) for
  both create and patch. Non-ASCII input that uppercases into ASCII (for example `ſ` → `S`) ends up as valid ASCII,
  which is harmless.
- **D30:** the counter is allocated only through `UPDATE … RETURNING`, which takes the same room row lock as rename and
  delete, so seat creation and rename serialize.
- **Error codes:** the 4 codes are appended to `src/lib/api/error.ts` and the shape is unchanged. Errors carry no pg
  text, and unexpected throws become 500 `internal` through `withAuth` after the transaction rolls back.
- **No 401/403 after a side effect:** confirmed. Auth and tier checks run in `withAuth` before the handler, and the
  handlers return only domain codes.
- `actor_sub uuid` / `$2::uuid` is safe because the verifier rejects a non-UUID `sub` (`src/server/identity/verify.ts:137`).

### Real-DB items pending (CI / Ming, carry into the PR)
- psql replay from plan Approach step 7 on compose Postgres:
  - insert `C302` twice in org A (expect 23505), then in org B (expect OK);
  - rename `C302` → `C303` with 3 seats, including one seq ≥ 100;
  - delete seat 3, then allocate (expect 4);
  - forced delete of a room with an occupant and a primary device. Expect COMMIT to succeed, the device to end
    `secondary` with `seat_id null`, and the audit rows to be written.
- The SQL was verified only by reading and by fake-client tests.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: layers pass. Routes are the only importers of `@/server/**`, and `src/lib/**` is pure.
- R2: no schema change.
- R3: no new env names.
- R4: every changed file is in the plan's Slice A list, and impl-log lists no out-of-plan files.
- R5: new logic has tests.
- R6: all SQL goes through `orgQuery` with `ctx.scope`, and a foreign id gets 404.
- No High path is touched (no change under `src/server/http/**`, `src/server/identity/**`, `db/migrations/**` or
  config files).

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 2 🟡, 5 💭.

### Nits (do not block)
1. `src/server/rooms/rooms.ts:94-96` and `src/server/audit/write.ts:322-324`: the INSERT-through-subquery form has no
   comment explaining why. Add one line, for example "-- form required by orgQuery's `org_id = $1` guard; org_id is
   the scope org", so a later reader does not "simplify" it into `values (…)`, which would trip the guard.
2. `rooms.ts:260`: `nextSeatSeq(r.seat_counter - 1)` round-trips to `r.seat_counter`. It is correct but indirect;
   `seq: r.seat_counter` plus the existing comment would read more simply.
3. `src/lib/rooms/seat-code.test.ts:56-58`: "repairs a corrupted old code" never passes an old code in. The test is
   trivially true, because the function cannot see old codes, which is the point. Consider renaming it to say that.
4. `src/server/request/read-json.ts:345`: a chunked body with no `content-length` is fully buffered by `req.text()`
   before the cap applies. The risk is low because only Admins can reach POST/PATCH; a capped stream reader would close
   the gap.
5. The direct (non-forced) delete re-checks the impact under the room row lock. Future device or occupant writes
   (SIM-012/SIM-015.x) do not take that lock, so a device placed concurrently between the re-check and the device
   UPDATE would be demoted silently. Note for those tickets: lock the room row (`for share`) when placing a device or
   an occupant.

### Follow-ups (out of scope)
- Add an `orgInsert` helper (or an INSERT-aware guard) in `src/server/http/org-scope.ts`. That file is a High path, so
  this needs its own ticket. It would replace the subquery workaround in `rooms.ts` and `audit/write.ts`.
- Optional migration `check (code = upper(code))` on `rooms` (plan Assumptions).
- Real-DB integration test coverage for service SQL. CI's Postgres is used only for the migrate smoke test and
  schema-check today.
- Room switcher (plan Q7) and re-keying `/rooms/[roomCode]` (Q13), as already planned.
