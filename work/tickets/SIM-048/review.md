## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed: commit c927c68 ("SIM-048: implement"); HEAD 4017180 differs only by the ticket state line.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (871 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 816 files, no violations"
- `pnpm test` — exit 0, "Test Files 311 passed | 1 skipped (312); Tests 3149 passed | 7 skipped (3156)" (matches impl-log)
- `pnpm build` — exit 0, "Compiled successfully"
- `pnpm test:db` — not run: no local Postgres (no DATABASE_URL, Docker daemon down); CI-only per loop.config. Static check
  instead: every remaining `placeDevice(..., "user", ...)` call in `*.db.test.ts` either targets the caller's own seat
  (devices.db.test.ts:164, 193) or is refused before the D72 rule (not_allowed :237, placement_changed :326, 404 :345,
  :574, return-to-inventory :288), so the new rule should not break existing DB tests. CI must be green before merge.

### Acceptance criteria
- [x] User placing/moving onto a seat not occupied by their member gets 422 `seat_not_yours`, nothing written or audited —
  evidence: `src/lib/devices/rules.ts:85-87` (after noop, before primary block and before any write in
  `src/server/devices/devices.ts:311-318`); `rules.test.ts` › "other's seat refuses 422 seat_not_yours (secondary, primary,
  move)" and "empty seat refuses ..."; `devices.test.ts` › "seat_not_yours writes nothing: no update, no audit insert
  (D72)" (asserts no update/insert, rollback, no commit); `devices.db.test.ts` › "user placing on another member's seat or
  an empty seat -> 422 seat_not_yours, device unchanged, no audit (D72)" (CI); `devices-routes.test.ts` › "422
  seat_not_yours passes through". All unit tests pass.
- [x] User placing onto own seat works as today — `rules.test.ts` › "own seat places and moves; primary rules still apply
  (seat_has_primary)"; existing primary tests green.
- [x] User can still move back to inventory from any seat — `rules.test.ts` › "target null returns from another's seat";
  `target === null` is decided before the new check (rules.ts:82).
- [x] Manager/Admin still place any owned device on any seat (D19) — `rules.test.ts` › "manager/admin secondary: no
  ownership check (...; D19)" (loops manager and admin); rule is gated on `tier === "user"`.
- [x] User seat picker offers only own seats; with none it says so — `src/ui/devices/place-device.ts:34-37` `ownSeats`,
  used in `PlaceDeviceDialog.tsx:66` (list) and `:215-216` (submit); empty message `PlaceDeviceDialog.tsx:134-136`;
  tests `PlaceDeviceDialog.test.tsx` › "user sees only own seats, message when none (D72)", `place-device.test.ts` ›
  "ownSeats and tier (D72)". Tier is wired from the session in `DevicesPage.tsx:381` and `DeviceDetailPage.tsx:34` →
  `useDeviceDetailActions.tsx:140`, defaulting to the most restrictive "user".
- [x] Unit tests per tier (own, other's, empty seat, inventory) — `rules.test.ts` "user places only on a seat they occupy
  (D72)" block plus manager/admin cases; also ordering test (not_allowed, placement_changed before seat_not_yours) and the
  legacy-lent noop case.
- [x] DEV-03/04/05 and a new D-entry — `docs/spec-v1.md:303-315` amended; `work/decisions.md` D72 row; remaining spec text
  (line 148 "owned by anyone", POR-03) stays consistent since Manager+ can still lend.

Ming verification after merge: none (plan says manual run is optional).

### Issues
None.

### Scope
All changed files are in the plan, except `src/server/devices/handoffs.db.test.ts` and `history.db.test.ts`, justified
under Out-of-plan files (tier switched to manager for placements onto non-own seats that the new rule now refuses for a
User; test intent unchanged). No High path touched; no migration.

### Rules (CLAUDE.md)
No violations found. R1: lib stays pure, UI imports only `@/lib/*` and ui modules (check:layers clean). R6: occupant is
read from the org-scoped, locked seat row and compared with the org-scoped member id. R7: refusal is a 422 domain code
decided inside the transaction before the update and the audit insert. R5: new logic has tests.

### Blockers from review agents
None

### Nits (do not block)
- `src/ui/devices/useDeviceDetailActions.tsx:9`: `import type { Tier } from "@/lib/auth/tier"` sits between relative
  imports; the other files put `@/` imports first.
- A User placing primary on an empty seat now gets `seat_not_yours` instead of `seat_has_no_occupant`; fine per M-85, just
  a changed message for that case.

### Follow-ups (out of scope)
- `placeVerb` "lend" branch is unreachable for a User (noted in impl-log).
- A User viewing a legacy device lent to another seat sees no current seat in the move picker; only "move to own seat" or
  "return to inventory" are possible, which matches D72, but the dialog gives no hint why the current seat is missing.
