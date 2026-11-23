## Attempt 1

Reviewer: general-purpose agent (read-only) following `.claude/agents/security-ai-generated-code-auditor.md`, because that agent type was not available in this session.

## Security review: SIM-015.5, attempt 1 (branch `ticket/SIM-015.5`)

**Verdict: no 🔴 blockers. 2 🟡 should-fix items.** F2 is a merge condition: the new SQL has still not been executed. This was a static review only. I ran no tests and no SQL, and changed nothing.

### Findings

**🟡 F1: Concurrent saves can use up the DB pool shared by all orgs (CWE-400)**
- Evidence: `src/server/layout/save.ts:54` waits on the room `for update` lock with no `lock_timeout`. `src/server/db/pool.ts:15` sets `max: 5`, `pool.ts:16` a 3 s connection timeout, and `pool.ts:18` a 5 s `statement_timeout`.
- Risk: each queued PUT holds a connection while it waits. An Admin of one org (or a retrying client) can send parallel PUTs to one room and occupy all 5 connections. `withAuth` needs a connection for `memberGate` (`src/server/http/with-auth.ts:72-78`), so requests from **other orgs** can get 503 until the queue drains. A wait that hits the timeout returns a generic 500 after 5 s. No data is corrupted, and the attacker must be an authenticated Admin.
- Scope: other write paths also have no `lock_timeout`, and I found no API rate limiter. This route is the heaviest writer (up to 500 seats and 2,000 fixtures per transaction).
- Fix: make `set local lock_timeout = '1500ms'` the first statement in the `saveRoomLayout` transaction, and map SQLSTATE `55P03` to `503 unavailable` (never 401/403). Add one DB test. If this is outside the plan under R4, record it as a `debt` issue instead.

**🟡 F2: The DB-level acceptance criteria are unproven until CI runs `pnpm test:db` (R5)**
- Evidence: `work/tickets/SIM-015.5/impl-log.md` says the 13 `saveRoomLayout (db)` tests were written but not executed. They are at `src/server/layout/layout.db.test.ts:314-537`, and CI runs them at `.github/workflows/ci.yml:53-56`.
- Risk: rollback, org scoping, stale and concurrent saves, and the real SQL casts rest only on code reading so far.
- Fix: do not merge until the PR's `db integration tests` step is green. I read the SQL against the migrations and found no column, type or parameter mismatch, but that does not replace running it.

**🟢 N1: Role removal lasts only as long as the token check allows (pre-existing, outside this diff)**
`src/server/http/with-auth.ts:69-70` takes the tier from the verified token, and the member gate checks only deactivation. An Admin who is demoted but not deactivated may keep PUT access until the token expires. This follows D4/D5/R6. I did not check the token lifetime.

### Checked, no issue found
- **Admin gate and R7:** PUT uses `tier: "admin"` (`route.ts:41`), and user and manager get 403 before the service runs (`route.test.ts:112`). The route and service emit only 400/404/409/422/503 themselves, and auth codes come only from the wrapper.
- **Body limit:** 262,144 bytes (`src/lib/validate/layout.ts:14`), enforced while streaming (`src/server/request/read-json.ts:19-23`). The body is read and validated before any transaction, so a slow client holds no DB connection.
- **Validation:** exact keys, canonical UUIDs, duplicate seat ids refused, sprite allowlist, and `baseVersion` capped at int4 (`validate/layout.ts:190-208`). `floorCellsWithinCap` runs only after `checkLayoutRules` passes (`:252-254`), with a 64-full-zone test (`layout.test.ts:321`).
- **R6 org scoping:** every statement in `save.ts` is bound to `org_id = $1`. The seat UPDATE keeps both `org_id` and `room_id` (`save.ts:79`). The fixture INSERT takes its org from the scope (`save.ts:102-106`), and the composite FK blocks a cross-org room.
- **Foreign ids:** a foreign, missing or other-room seat id gets the same `layout_seats_changed` (`save.ts:68-71`, test at `layout.db.test.ts:438-474`). A foreign room gets 404.
- **Lock order:** room, then seats ascending with a 501-row cap (`save.ts:54,63-64`), matching `src/server/rooms/rooms.ts:213-224`. Seat create, delete and rename, occupant changes and member deactivation all take the room lock first, so I found no deadlock cycle. A waiting save re-reads the committed `layout_version`, so the second concurrent save gets `layout_stale`.
- **Save boundaries:** the seat UPDATE does not touch `occupant_id`, so `seats_primary_owner_trg` does not fire. The fixture DELETE keeps legacy rows (`sprite_key is not null`, `save.ts:94`).
- **Audit and leaks:** one audit row with counts and versions only, inside the transaction (`save.ts:126-138`). Error responses carry only a code, and logs only an error code. No secrets or new env variables are in the diff.

### Follow-ups
- F1, as a `debt` issue if it is not fixed in this ticket. A shared `lock_timeout` or per-org limit for all write paths would be the wider fix.
