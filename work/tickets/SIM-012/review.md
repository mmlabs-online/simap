## Attempt 1 — 2026-11-22
Verdict: REWORK

Scope judged: slice 1 (API, server, lib). The UI halves of AC3-AC6 are deferred to the proposed SIM-012.2, as the plan says.

### Checks (run by reviewer)
Node 22.23.5, worktree `ticket/SIM-012` at `74693ff`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "291 files, no violations".
- `pnpm test` — exit 0, "Test Files 119 passed (119); Tests 1194 passed | 3 skipped (1197)".
- `pnpm build` — exit 0.
- `pnpm test:db` — exit 0, "Test Files 5 passed (5); Tests 51 passed (51)". Throwaway `postgres:17` container `simap-sim012-review` on `127.0.0.1:55433`, removed afterwards.
- The results match impl-log.md.

Scratch test outside the repo, against the same kind of throwaway container, run 3 times, 10 of 10 passed each time. It calls the real `setOccupant`, `releaseSeat`, `setCannotSeat`, `addSeats`, `deleteSeat`, `deactivateMember`, `reactivateMember`, `updateRoom` and `deleteRoom`:
- Assign then deactivate(release): both succeed, seat ends empty.
- Deactivate then assign: assign waits, then 422 `member_not_assignable`.
- Replace X→Y against deactivate(X, release): both succeed, Y stays seated, X's device returns to inventory as secondary.
- Assign against delete: delete waits, then 409 `seat_not_empty`.
- Uncommitted device placement against delete: delete waits, then 409 `seat_not_empty`.
- Two replaces from the same expected occupant: exactly one wins, the other gets 409 `occupant_changed`.
- Cannot-seat committed while an assign waits: 409 `seat_cannot_seat`.
- Forced room delete against assign and seat delete: `not_found` or ok, no exception.
- Mixed stress, 4,320 operations over 36 rooms: no exception, so no 40P01, 23503, 23505 or 23514. After each round: no primary device off its occupant, no deactivated occupant, no duplicate seq, counter never below the highest seq.

Not verified:
- Real HTTP requests with a real Identity token. Route behaviour comes from `seats-routes.test.ts` and from reading `with-auth.ts`.
- SIM-013 and SIM-014 writers, which do not exist yet.
- The `devices_seat_fkey` backstop against a real database: the guard always answered first, so only the fake-Db test exercises it.
- Mutual `deactivateMember` deadlock (the plan's known follow-up): the stress actors had no member row.

### Acceptance criteria
- [x] AC1 add after delete gets `C302-04` onward; non-Admins get 403 — evidence: `seats.db.test.ts:70`, `seats-routes.test.ts:79`.
- [x] AC2 delete refused with a clear message; empty seat deleted, number not reused — evidence: `seats.db.test.ts:116`, `:138`, `:70`; copy at `src/ui/copy/api.ts`.
- [x] AC3 data half: every seat with code, status, occupant, devices — evidence: `seats.db.test.ts:178`. Page and panel: SIM-012.2.
- [x] AC4 server half: replace with stale guard and demotion — evidence: `seats.db.test.ts:237`, `:268`; scratch two-replace race. Dialog: SIM-012.2.
- [x] AC5 server half: cannot-seat refuses assign and replace — evidence: `seats.db.test.ts:342`; scratch race. UI: SIM-012.2.
- [x] AC6 server half: occupant releases, others get 409 — evidence: `seats.db.test.ts:409`, `seats-routes.test.ts:148`. Button: SIM-012.2.
- [x] AC7 group inheritance — evidence: `seats.db.test.ts:433`.
- [x] AC8 unit tests cover the rules and demotion — evidence: `rules.test.ts`, `seats.test.ts`, in the green `pnpm test`.

Business rules and plan items checked with no defect:
- Seat number never reused, delete guard, stale-occupant protection, replace, remove, self-release, cannot-seat, group inheritance, and demotion in the same transaction as the occupant change.
- Lock order matches `rooms.ts:213-224` and `deactivateMember` (`manage.ts:343-361`): member, room, seat, devices. No path takes a room lock while holding a seat lock.
- Rejected consultant proposals stay rejected: reason is required, no `DELETE /occupant`, no `seat_occupied` payload, no audit labels.
- A1-A13 are implemented as written. A12's `truncated: true` branch has no test (see Nits).

Race tests: the two raw-holder tests prove that the service waits and then re-reads, but not that the real paths avoid a deadlock. The scratch run above covers that gap for this ticket.

### Issues
#### Issue 1 — 🔴 blocker — input validation (SYS-02), reachable 500
- **Where**: `src/lib/validate/seat.ts:52-55`, reached through `PATCH /api/seats/[id]/cannot-seat`.
- **Expected**: SYS-02 (`docs/spec-v1.md:419`): "All inputs are validated at the server boundary." A reason Postgres cannot store, or one with no visible character, is 400 `invalid_request`. SEA-01 and D26 require a real reason, and the plan's validator row says a blank reason is an error.
- **Actual**:
  - `validateCannotSeat({ cannotSeat: true, reason: "a\u0000b" })` returns ok. `setCannotSeat` then throws Postgres `22021` (reproduced in all 3 scratch runs), and `with-auth.ts:82-85` turns that into 500 `internal`.
  - `reason: "​"` (zero-width only) is accepted, because `trim()` does not remove it, so a seat can be blocked with an invisible reason.
- **Fix instruction**:
  1. In `validateCannotSeat`, after NFC and trim, reject with `{ ok: false, field: "reason" }` when the reason contains a control, format or filler character, or has no visible character. Use the same classes as `src/lib/validate/member.ts:13` and `:16`: `[\p{Cc}\p{Cf}ᅟᅠㅤﾠ]` and `[\p{L}\p{N}\p{S}\p{P}]`. Define them locally in `seat.ts`, because `member.ts` is not in this plan.
  2. Add cases to `src/lib/validate/seat.test.ts`: NUL inside the text, zero-width only, and a Hangul filler only are errors; a Vietnamese reason with diacritics stays valid.

### Rules (CLAUDE.md)
No violations found.
- R1: `pnpm check:layers` is green; routes are the only entry into `src/server/seats`.
- R2: no migration.
- R3: no new env; the audit meta holds no reason text.
- R4: every changed source file is in the plan's file list; `rooms.ts` is comment only; no High path changed.
- R5: new logic has tests, except for Issue 1.
- R6: every query in `seats.ts` filters `org_id = $1`, and every join and subquery repeats the org match.
- R7: handlers return no 401/403; domain refusals are 404, 409 or 422.
- Tiers: GET and release are `user`, occupant and cannot-seat are `manager`, add and delete are `admin`.

### Blockers from review agents
Filled in by the orchestrator from `security-review.md`.

### Nits (do not block)
- 💭 `truncated: true` has no test. Only the false case is asserted (`seats.db.test.ts:192`).
- 💭 `src/server/seats/seats.ts:347-354` repeats the unlocked room lookup in `lockSeat` (`:215-221`).

### Follow-ups (out of scope)
- `src/lib/validate/room.ts:26-39` has the same gap by reading (no control-character check on room text fields), so a NUL there is likely a 500 too. Not run. Worth a small ticket.
- Replace the two raw-holder race tests with the real `deactivateMember` and `setOccupant` paths.
- Mutual `deactivateMember` deadlock, already recorded in the plan.

### Ming verification after merge
None for this slice. The ticket's manual test (assign, replace, release on a seeded room) moves to SIM-012.2. Ming still needs to confirm defaults A1-A13.

## Attempt 2 — 2026-11-22
Verdict: PASS

Re-review of the Attempt 1 blocker only. Attempt 1 passes were not re-judged, because the rework does not touch them.

### Checks (run by reviewer)
Node 22.23.5, worktree `ticket/SIM-012` at `55ce6cb`.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "291 files, no violations".
- `pnpm test` — exit 0, "Test Files 119 passed (119); Tests 1195 passed | 3 skipped (1198)".
- `pnpm build` — exit 0.
- `pnpm test:db` — exit 0, "Test Files 5 passed (5); Tests 51 passed (51)". Throwaway `postgres:17` container `simap-sim012-review` on `127.0.0.1:55433`, removed afterwards.
- The results match impl-log.md Attempt 2.

Scratch test outside the repo, against a fresh throwaway container with the same name and port, also removed. It calls the real `PATCH /api/seats/[id]/cannot-seat` handler, validator and `setCannotSeat` on a migrated database. Only the token verifier and member gate are faked. 5 of 5 passed:
- Control: NUL passed straight to `setCannotSeat` still gets Postgres `22021`, so the database would refuse it if the validator let it through.
- 31 bad reasons through the route, including NUL (inside, alone, leading, trailing), C0/C1/DEL, bidi embedding, override and isolate characters, LRM/ALM, soft hyphen, ZWJ, zero-width-only, BOM-only, tag character, all 4 Hangul fillers, blank and combining-only: each is 400 `invalid_request`, with 0 pool `connect` or `query` calls and the seat row unchanged.
- 8 valid reasons: Vietnamese with diacritics, capitals and all tone marks, digits and punctuation, 200 characters, emoji, NFD input (stored as NFC) and surrounding whitespace (trimmed): each is 200 and stored as expected.
- Every Unicode code point except surrogates: no `Cc`, `Cf` or filler character passes inside text.

Not verified:
- Real HTTP requests with a real Identity token (same limit as Attempt 1).
- `security-review.md` was not assessed here. It has an uncommitted change of 87 added lines that this reviewer did not make; the orchestrator owns it.

### Acceptance criteria
- [x] Attempt 1 Issue 1 fixed — evidence: `src/lib/validate/seat.ts:12-13`, `:56-61`; `src/lib/validate/seat.test.ts:67-75`; scratch route run above.
- [x] Regex classes match `src/lib/validate/member.ts:13`, `:16` — evidence: byte comparison of the filler characters.
- [x] AC1-AC8 (server halves) unchanged from Attempt 1 — evidence: `482c8d5` touches none of that code; `pnpm test` and `pnpm test:db` are green.

Scope of `482c8d5`: `src/lib/validate/seat.ts`, `src/lib/validate/seat.test.ts` and `work/tickets/SIM-012/impl-log.md` only. The later `55ce6cb` changes `ticket.md` only.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `seat.ts` stays pure lib code. R2: no migration. R3: no new env. R4: the rework stays inside Issue 1. R5: the new logic has tests. R6 and R7: not affected; the refusal is 400 before any SQL.

### Blockers from review agents
Filled in by the orchestrator from `security-review.md`.

### Nits (do not block)
- 💭 U+2800 (braille blank, class `So`) alone passes as a reason and is stored, so a Manager can still set a blank-looking reason. It causes no 500 and matches the class set Attempt 1 prescribed; `member.ts` has the same gap.
- 💭 A lone surrogate inside text (`"a\ud800b"`) passes and is stored as `a�b`. It causes no 500, and only a hand-crafted request can send it.
- 💭 Attempt 1 nits on `truncated: true` and the repeated room lookup still stand.

### Follow-ups (out of scope)
- Move the reason and name text checks into one shared validator, and decide there on U+2800 and lone surrogates.
- Attempt 1 follow-ups still stand, including the `src/lib/validate/room.ts` control-character gap.

### Ming verification after merge
None for this slice. The manual test moves to SIM-012.2, and Ming still needs to confirm defaults A1-A13.
