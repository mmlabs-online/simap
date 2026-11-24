## Attempt 1 — 2026-11-22
Verdict: PASS

### Checks (run by reviewer)
Run with fnm Node 22 on branch `ticket/SIM-015.6` (HEAD e65d786).
- `pnpm format:check` — exit 0, "All matched files use the correct format." (416 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit)
- `pnpm check:layers` — exit 0, "check-layers: 362 files, no violations"
- `pnpm test` — exit 0, "Test Files 147 passed (147)", "Tests 1567 passed | 3 skipped (1570)"
- `pnpm build` — exit 0, route list contains `ƒ /api/rooms/[id]/layout`
- `node scripts/test-db.mjs` (DATABASE_URL = the trust URL documented in `compose.dev.yml:2`, passed inline, local
  compose Postgres) — exit 0, "Test Files 6 passed (6)", "Tests 64 passed (64)"

All results match impl-log.md.

### Acceptance criteria
- [x] GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only — evidence: `layout.db.test.ts › saved room round trip`, `› seat status from real rows`, `› foreign org room is 404; random uuid is 404` (pass); every query goes through `orgQuery` with `org_id = $1`, and the members join repeats `o.org_id = s.org_id` (`src/server/layout/layout.ts:61-96`).
- [x] A room with no saved layout returns a usable default without writing anything, and its seats stay reachable — evidence: `› unsaved room returns the default and writes nothing` (rooms, seats, layout_fixtures and audit_log snapshots identical; all seats in `layout.seats`, `unplaced` empty); `› saved room: a seat with null placement takes a free slot`; the transaction is `read only` (`layout.ts:60`).
- [x] A room over 500 seats returns the first 500 with `truncated: true` — evidence: `› 500 seats not truncated, 501 truncated to the first 500` (seq 501 absent); `limit 501` ordered by `s.seq, s.id` then slice (`layout.ts:85,97-98`).
- [x] A bad id, or a room in another org, returns 404 — evidence: `route.test.ts › non-canonical id is 404 without getPool or the service`, `› service not_found maps to 404 not_found`; DB `› foreign org room is 404; random uuid is 404`.
- [x] The response never contains a raw Identity `sub` — evidence: `› seat status from real rows` asserts no member `sub` in `JSON.stringify(res)`; no `o.sub` in any select list (only in the `mine` comparison, `layout.ts:80`); `avatarSeed` is `occupant_id` (D59).
- [x] Corrupt stored floors, grid or sprite keys never break the read — evidence: `› corrupt grid (65 x 65) …` (saved false, stored version 4), `› oversized or bad floor_zones fall back to the default floor` (65 zones and >262,144 bytes arrive from SQL as `null`), `› long or unknown sprite keys never break the read` (key cut to 129 chars, `__proto__` fixture dropped); `resolve-layout.test.ts › take guard` (five shapes) and `› registry keys`.
- [x] DB tests cover org scoping, the read, and a concurrent commit between two reads; route tests cover 404, 503 and `no-store` — evidence: `› concurrent commit between reads is not seen` (commits occupant, a seat and a fixture on another connection after the room select; result still shows the old snapshot, and a second read shows `occupied`, so the test would fail under read committed); `› runs begin, set transaction …` (statement order); `route.test.ts` 404, 503 `unavailable`, 200 with `Cache-Control: no-store`, 401 without Authorization.
- [x] Route path exists — `pnpm build` output above.
- [x] Route is guarded — `withAuth(..., { tier: "user" })` (`src/app/api/rooms/[id]/layout/route.ts:11-22`); `routes-guarded.test.ts` passes in `pnpm test`.

Ming verification after merge: none (plan says so; no UI).

### Issues
None.

### Scope
Changed source files (`git diff --numstat origin/main...HEAD -- src/`) are exactly the six in the plan's file table;
other changes are the ticket's own work files. No High path touched. No out-of-plan files.

### Rules (CLAUDE.md)
No violations found.
- R1: `layout.ts` starts with `import "server-only"`; the route is the only importer; lib change stays pure; `check:layers` clean.
- R6: all three queries scoped by `ctx.scope` via `orgQuery`; join also scoped by org.
- R7: handler returns only 404 / 503 and is read-only; 401/403 come only from `withAuth`.
- R3, R2: no config, no migration.
- R5: checks green; new logic has unit, route and DB tests.

### Blockers from review agents
To be filled by the orchestrator from `security-review.md`.

### Nits (do not block)
- 💭 `impl-log.md` "Diff size: +621 / -1"; `git diff --numstat origin/main...HEAD -- src/` gives +587 / -1. Cosmetic.
- 💭 `layout.ts:80`: `$3::uuid` makes a non-uuid `sub` a 500 rather than `mine = false`. Same precedent as `src/server/seats/seats.ts:110`, and Identity `sub` is a uuid, so no change needed here.
- 💭 `layout.ts:65`: `jsonb_typeof(floor_zones) = 'array'` is redundant with the `rooms_floor_zones_check` constraint, but harmless and keeps `jsonb_array_length` safe should the constraint ever be relaxed.

### Follow-ups (out of scope)
- `oxfmt` prints "No config found, using defaults" (pre-existing, noted in impl-log).
