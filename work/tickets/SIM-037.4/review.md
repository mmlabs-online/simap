## Attempt 1 — 2026-11-25
Verdict: PASS

Scope judged: slice 1 only (API, DTO, deactivation), per the approved plan and split (UI is SIM-037.10).

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (757 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 703 files, no violations"
- `pnpm test` — exit 0, "Test Files 264 passed | 1 skipped (265)", "Tests 2692 passed | 14 skipped (2706)" (matches impl-log)
- `pnpm build` — exit 0, route `ƒ /api/devices/[id]/take-back` present
- `pnpm test:db` — NOT RUN here (no local Postgres; CI-only per loop.config). The new DB tests in
  `handoffs.db.test.ts`, `devices.db.test.ts`, `manage.db.test.ts` are typechecked but unexecuted. **CI `test:db` must be
  green before merge**; a red CI run voids this PASS.

### Acceptance criteria
- [x] 1 Owner or Manager+ can start and cancel a return; only an Admin can confirm — evidence:
  `src/lib/devices/handoff-rules.ts` `decideReturnStart` / `decideHandoffAction` (return: confirm only `tier === "admin"`,
  decline never); unit tests `handoff-rules.test.ts › decideReturnStart`, `› decideHandoffAction kind=return` (pass);
  DB tests `handoffs.db.test.ts › return › owner starts…`, `› refusals write no row and no audit`, `› cancel by owner or
  manager; decline and a stranger are refused`, `› confirm of a placed primary device…` (manager and owner-user 422);
  route `devices-routes.test.ts › POST /api/devices/:id/handoffs with kind return` (pass).
- [x] 2 Until confirm nothing changes; on confirm no owner, seat, note, expiry — evidence: `startReturn` inserts only the
  handoff row (`handoffs.ts` startReturn); `confirmReturnOnce` uses one `clearDevice` UPDATE (owner, seat, role, note,
  expiry) after the stale/placement re-checks under lock; DB tests `› owner starts; nothing else changes` (`dev(d)`
  equals before), `› confirm of a placed primary device clears owner, seat, note and expiry`, `› an Admin who owns the
  device confirms; a stale owner is 409`, `› confirm vs concurrent cancel: exactly one wins` (CI).
- [x] 3 Admin take-back with no request and on a deactivated member's device — evidence: `takeBack` / `takeBackOnce`
  in `handoffs.ts`; route `src/app/api/devices/[id]/take-back/route.ts` with `{ tier: "admin" }`; DB tests `› take-back ›
  clears an owned placed device…`, `› works on a deactivated member's device`, `› cancels a pending transfer; refuses a
  pending return, unowned, non-Admin, other org`, `› take-back vs transfer confirm` (CI); route test `› 403 from the
  wrapper for a Manager, before the service runs` (pass).
- [x] 4 Deactivating cancels pending transfers and returns — evidence: `src/server/members/manage.ts` deactivateMember
  cancel UPDATE after the noop/refuse early returns, one audit row per handoff, `cancelledHandoffs` in meta; DB tests
  `manage.db.test.ts › deactivate cancels pending handoffs from and to the member; devices stay owned`, `› noop and
  refused deactivations cancel nothing; an actor with no member row falls back to the target` (CI). "Remove" out of
  scope per approved A3.
- [x] 5 Admin nav count (slice 1: count source only) — evidence: `countHandoffs` returns `{ incoming, returns }` with
  `returns` gated on `tier === "admin"`; `listHandoffs(box="returns")` 422 for non-Admin; DB test `› returns list and
  count` (CI); route tests `handoffs-routes.test.ts` count shape and `box=returns` pass-through (pass). Badge is SIM-037.10.
- [x] 6 Audit rows for start, cancel, confirm, take-back; refusals write none — evidence: `device.return_start`,
  `device.${kind}_cancel`, `device.return_confirm`, `device.return_take_back` in `handoffs.ts`; DB tests assert row
  counts and meta (`byManager`, `byTakeBack`, `byAdmin`, `byDeactivation`) and no row on refusal (CI).
- [x] 7 Checks green — local four green as above; `test:db` pending CI.

Ming verification after merge: none for slice 1 (plan). The manual "return then Admin confirm" moves to SIM-037.10.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: routes import only `@/server/**` and `@/lib/**`; `handoffs.ts` → `./devices` is server→server; check:layers clean.
- R2: no schema change.
- R6: every new query goes through `orgQuery` with `org_id = $1`; the returns list relies on `handoffRows`'
  `h.org_id = $1`; tier from `withAuth`.
- R7: take-back's Admin check is the wrapper `tier: "admin"`; return confirm by non-Admin, `box=returns` by non-Admin
  and service-side take-back refusals are 422; all permission decisions precede locks/writes.
- R4: every changed source file is in the plan's file list (`device-actions.test.ts` needed no change, noted in impl-log);
  `work/ming-todo.md` / ticket files are workflow bookkeeping (M-65 approval record).

### Blockers from review agents
None (to be filled by the orchestrator from security-review.md if it reports a 🔴).

### Nits (do not block)
- Plan-listed tests not written: `devices.db.test.ts` "assign and delete refuse with a pending return" (code path is
  kind-agnostic, `select 1 … status = 'pending'`, already covered by the pending-transfer tests); take-back route "no
  pool → 503"; "return confirm vs concurrent placement: no deadlock". Add them in SIM-037.10 or SIM-037.5 if convenient.
- `handoff-rules.ts` `canTakeBack` doc says "a pending return is confirmed instead" — accurate as guidance, but take-back
  itself refuses (409); consider "refused; confirm the return instead".
- `takeBackOnce` / `confirmReturnOnce` use `locked[0]!`; safe because the row was read earlier in the same flow and
  handoffs are never deleted, but a `notFound` guard would be cheaper than a crash if that ever changes.
- Test `take-back vs transfer confirm` asserts `a.ok || b.ok`; both succeeding is legitimate (confirm then take-back),
  so the plan's "loser gets 409" wording is looser in the test — fine.

### Follow-ups (out of scope)
- A10 accepted race (start during deactivation can stay pending): file the `debt` issue at PR time (plan A10).
- A9: index for org-wide pending returns if volume grows (needs a migration, High tier).
- A3: a future "remove from org" path must reuse the deactivation cancel step.
- A7: `DeactivationImpact` could warn about pending handoffs in the deactivate dialog.
