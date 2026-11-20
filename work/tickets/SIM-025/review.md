# Review — SIM-025

## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Local Node 24 (CI Node 22), worktree on `ticket/SIM-025`, diff base `origin/main`.
- `pnpm format:check` — exit 0, "All matched files use the correct format." (144 files)
- `pnpm typecheck` — exit 0 (route types generated, tsc clean)
- `pnpm check:layers` — exit 0, "check-layers: 121 files, no violations"
- `pnpm test` — exit 0, "Test Files 48 passed (48); Tests 467 passed | 3 skipped (470)"; targeted run of `read-json.test.ts` + `rooms.test.ts`: 29 passed
- `pnpm build` — exit 0
Matches the impl-log summary.

### Acceptance criteria
- [x] Oversized body refused without reading it whole, no / lying content-length, stream cancelled — evidence: `src/server/request/read-json.ts:12-24` (byte counter, `reader.cancel()` on overflow); tests `read-json.test.ts` › "stream over the cap without content-length -> not ok and cancelled" and "lying small content-length with a stream -> not ok and cancelled" assert `{ ok: false }`, `cancelled === true`, `pulled < 100`. Both would fail against the old `req.text()` implementation (no cancel, all chunks pulled). Green.
- [x] Invalid UTF-8 refused — evidence: `read-json.ts:32` (`TextDecoder("utf-8", { fatal: true })`); test "invalid UTF-8 -> not ok" (`0xC3 0x28`). Green. Boundary and split multi-byte test also green.
- [x] `deleteRoom` locks seats before the impact count — evidence: `rooms.ts:232-237` (after `lockRoom`, before `impactOf`, through `orgQuery`); tests "forced delete order…" (s[2] exact statement) and "seats lock runs after the room lock and before the impact count, also without force" (order + binds `[org, RID]`). Green.
- [x] Lock-order rule documented — evidence: `rooms.ts:213-222` doc comment; `src/server/README.md:11` bullet.
- [x] Delete audit meta includes pending count — evidence: `rooms.ts:260`; forced-delete test asserts meta `{code, seats, devices, pending: 0, forced}`.
- [x] All loop checks green — see above. Security rescan of SIM-010 findings 1-2 is the `security-ai-generated-code-auditor` trigger's output (`security-review.md`), not the reviewer's; the orchestrator must confirm it marks both resolved before DONE.

### Issues
None.

### Scope
Changed files: `src/server/README.md`, `src/server/audit/write.ts`, `src/server/request/read-json.ts` (+ test), `src/server/rooms/rooms.ts` (+ test), ticket work files. All are in the plan's file list; no out-of-plan files; no High path touched (nothing under `src/server/http/**`, `src/server/identity/**`, `db/**`, `**/*.sql`, config).

### Rules (CLAUDE.md)
No violations found. R1: server-only files, `import "server-only"` kept. R3: no env/secrets. R4: in plan (the `order by id` in the lock statement is the plan's stated default). R5: new logic has tests, checks green. R6: new seats statement goes through `orgQuery` with `org_id = $1`.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 0 🟡, 3 💭; SIM-010 findings 1, 2 and 💭3 RESOLVED.

### Nits (do not block)
- The plan said the existing "missing room -> 404 on delete" test would confirm the seats lock is not reached when the room is missing; the test was not extended to assert that (e.g. `expect(t.sqls().some(q => q.startsWith("select id from seats"))).toBe(false)`). Behaviour is correct by construction (`lockRoom` throws first, `rooms.ts:123`).
- `read-json.ts`: the overflow path calls `reader.cancel()` inside `try`; if a future edit adds a throw before it, the `catch` also cancels, so this is fine — just note the double-cancel is intentionally harmless.

### Follow-ups (out of scope)
- None new. Real-DB verification of the seats lock remains with SIM-026 (statement text pinned in plan.md for it).
