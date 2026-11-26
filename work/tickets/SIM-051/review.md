# Review — SIM-051

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (919 files)
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit)
- `pnpm check:layers` — exit 0, "check-layers: 864 files, no violations"
- `pnpm test` — exit 0, Test Files 328 passed | 1 skipped (329); Tests 3286 passed | 9 skipped (3295)
- `pnpm build` — exit 0
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0, Test Files 22 passed (22); Tests 337 passed (337)

All results match impl-log attempt 1.

### Acceptance criteria
- [x] For a User, every device write on a device they do not hold answers 404 with the same body as an unknown id; nothing is written or audited. Evidence:
  - PATCH: `src/server/devices/devices.ts:461` (check comes after the locked read and before `canEdit` and any update). `devices.test.ts › another member's device as User -> 404 not_found like an unknown id` asserts the result equals the unknown-id result and that no write SQL runs. `devices.db.test.ts › a User editing a device they do not hold gets 404, even with a clashing inventory number; row and audit unchanged` shows the 409 cannot be reached.
  - PUT placement: `devices.ts:335` (after the device lock, before `placement_changed` and `decidePlacement`). `devices.test.ts › placeDevice refusals` checks the 404 and no write. `devices.db.test.ts › manager moves …; user gets 404 not_found and the row is unchanged`.
  - POST handoffs: `handoffs.ts:160/222/279` (after `!dev[0]`, before the pending read and the decision). `handoffs.db.test.ts` covers transfer (`a user on another's device: 404, no row, no audit`), return (l.449) and extension (l.668-680, including no rows).
  - Handoff cancel/decline/confirm: `handoffs.ts:352` (`closeHandoff`) and `handoffs.ts:634` (`confirmHandoff`). These run at the first unlocked read, before `decideHandoffAction` and any lock or write. Tests: `handoffs.db.test.ts › a user who is neither sender nor recipient gets 404 on cancel, decline and confirm; nothing written`, return cancel (l.472) and extension confirm/decline (l.711-723).
  - Writes refused by tier before any query (create, assign, holding, delete, take-back) are unchanged, as the plan's assumption accepted by Ming says.
- [x] A User acting on their own device behaves as today. Evidence: `hiddenFromActor("user","m1","m1") === false` (`visibility.test.ts`). The existing owner-path unit and DB tests pass unchanged (`pnpm test`, `pnpm test:db` green).
- [x] The recipient of a pending transfer can still confirm/decline it. Evidence: `hiddenHandoffFromActor` returns false for the recipient (`visibility.test.ts`). Existing DB tests pass: `handoffs.db.test.ts › the recipient declines: declined, device unchanged, second call 409` (l.221) and the recipient confirm cases (`confirmHandoff(... w.sy, "user" ...)` at l.254, l.280). Party refusals keep their 422 (l.190-205).
- [x] Manager and Admin get today's codes. Evidence: both helpers return false for manager/admin (`visibility.test.ts`). The DB tests assert Manager 422 `not_allowed` on PATCH, Admin 409 `inventory_number_taken` (`devices.db.test.ts`), Manager 422 on extension, decline and confirm (`handoffs.db.test.ts` l.197, l.288), and a Manager third-party cancel succeeding.
- [x] Route and DB tests per action and tier. Evidence: unit tests for the pure rules, scripted-Db tests for update/place, and DB tests for every changed action. The route tests needed no change because routes map `Result` unchanged and the plan said to edit them only if they asserted 422.

Ming verification after merge: none (plan).

### Flagged behaviour change (implementer): User extension on an unowned device, 422 `device_unowned` -> 404
In plan. The plan defines `hiddenFromActor` as true unless `ownerId !== null && ownerId === actorMemberId`. Its test list covers "unowned" for a User, and the ticket scope covers "a device whose current owner is not their member". Before this change, `decideExtensionStart` checked `ownerId === null` before the owner match, so the 422 `device_unowned` told a User that an unowned device exists. The 404 removes that leak. The same now applies to a User's return/transfer/place/edit on an unowned device (before: 422 `not_allowed`). The UI cannot offer these actions for devices a User cannot see. Pinned by `handoffs.db.test.ts` l.677-680.

### Scope
Changed files: `src/lib/devices/visibility.ts`(+test), `src/server/devices/devices.ts`, `src/server/devices/handoffs.ts`, `devices.test.ts`, `devices.db.test.ts`, `handoffs.db.test.ts`, plus the ticket work files. All are in the plan's file list. No High path touched. Decision functions are unchanged (plan step 5).

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/server/devices/*` imports `@/lib/devices/visibility` (server -> lib), and `visibility.ts` stays pure. `check:layers` is clean.
- R6: all reads still go through `orgQuery` with the scope. No new queries.
- R7: the new 404s are domain refusals raised through `Abort`/return before any update, insert or audit, so the transaction rolls back. Row locks taken before the check (placement seats/rooms, device `for update`) are not writes. No new 401/403.
- R5: new logic has unit and DB tests.

### Blockers from review agents
To be filled by the orchestrator from `security-review.md` (Areas include security; changed paths are under `src/server/`).

### Nits (do not block)
- `handoffs.db.test.ts:207`: the title says "a manager gets 422", but the body asserts that the Manager's cancel succeeds (`ok: true`). Rename to "… a manager can still cancel".
- No explicit unit/DB case for a User placing an **unowned** device (plan test list: "placeDevice user on another's / unowned device -> 404"). The `null` owner case is covered by `hiddenFromActor` unit tests and by the same call site as the "another's" case, so the risk is low.
- `devices.ts:335` and `devices.ts:357`: `me[0]?.id ?? null` is now computed twice in `placeDevice`. A local `const meId` would read better.

### Follow-ups (out of scope)
- UI: `settleExtend` / `settleTransfer` / `settleReturn` / `settlePlace` treat `not_found` as `done` ("a gone device"). A User whose device was transferred away by a Manager while a dialog was open used to get a stale-refresh error (422 `not_allowed`). Now the dialog closes as if it succeeded and calls `onDone`. Check whether `onDone` shows a success notice in that case, and if so, show a "no longer yours" message instead (`src/ui/devices/extend-device.ts:49`, `transfer-device.ts:43`, `return-device.ts:42`, `place-device.ts:116`).
