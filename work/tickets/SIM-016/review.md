# Review — SIM-016: Groups, projects and seat tags

## Attempt 1 — 2026-11-24 (slice 1: API and logic)
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit=0, "All matched files use the correct format."
- `pnpm typecheck` — exit=0
- `pnpm check:layers` — exit=0, "check-layers: 512 files, no violations"
- `pnpm test` — exit=0, Test Files 198 passed (198), Tests 2073 passed | 3 skipped (2076)
- `pnpm build` — exit=0
- `pnpm test:db` (local compose Postgres, started and stopped by the reviewer) — exit=0, Test Files 10 passed (10), Tests 133 passed (133); the 10 files include `src/server/groups/groups.db.test.ts`.
- Results match impl-log attempt 1.

### Acceptance criteria
- [x] Names/codes are unique within the org — evidence: `groups.db.test.ts › duplicate group name in one org -> group_name_taken; other org allowed`, `› duplicate project code -> project_code_taken; other org allowed` (test:db green); `groups.test.ts › duplicate group name -> 409 group_name_taken and rollback`, `› duplicate project code on update -> 409`; mapping in `src/server/groups/pg-error.ts` on `groups_org_name_key` / `projects_org_code_key`.
- [x] Deleting a used group clears it from seats and members after confirmation — evidence: `groups.db.test.ts › delete used group without force -> in_use and nothing changes`, `› force delete clears seats and members, keeps other groups' tags, writes audit`, `› project delete: refuse, then force clears seats`; route `DELETE ?force=true` passes force (`groups-routes.test.ts › maps 409 and 422 refusals, passes force …`); `src/server/groups/groups.ts:172-212`.
- [x] Users cannot change tags (403) — evidence: `groups-routes.test.ts › user tier gets 403 on every write, impact and tags; services not called` (covers POST/PATCH/DELETE groups and projects, both delete-impact GETs and `PATCH /api/seats/[id]/tags`); all write handlers use `withAuth({ tier: "manager" })`, so 403 comes only from the wrapper (R7).
- [x] Unit tests cover delete impact — evidence: `src/lib/groups/delete-impact.test.ts` (unused / seats-only / members-only / both, with and without force) and `groups.test.ts › getGroupImpact / getProjectImpact` (counts, none, 404) plus `deleteGroup` / `deleteProject` ordering tests.

Ming verification after merge: none for this slice (manual "tag seats and delete a used group" waits for SIM-016.2/.3 UI).

### Scope and deviations
- Out-of-plan `src/lib/api/error.ts` (+5 codes) and `src/ui/copy/api.ts` (+5 messages): justified. `apiError` accepts only `API_ERROR_CODES`, and `apiCopy` is `satisfies Record<ApiErrorCode, string>`, so the new codes `group_name_taken`, `project_code_taken`, `in_use`, `invalid_group`, `invalid_project` cannot ship without both. Additive, not High paths, no behaviour change for existing codes. Note for SIM-016.2/.3: `src/ui/copy/api.ts` is now already touched; the plan listed it as a hotspot.
- `tagsChanged` in `src/lib/seats/rules.ts` not added; the plan allowed "keep inline if trivial" and the inline check is two comparisons (`src/server/seats/seats.ts:517`). Accepted.
- `project_id` added to the `SeatLock` select (`src/server/seats/seats.ts:209,242`): needed for the no-op check; additive, existing seat tests green.
- groups and projects kept in one 364-line `groups.ts`: the halves are independent; acceptable.
- No High path changed (no `db/**`, `src/server/http/**`, `.env.example`). `ticket.md` edits are orchestrator state/scope updates matching the plan's split.

### Issues
#### Issue 1 — 🟡 should-fix — concurrency (lock order)
- **Where**: `src/server/seats/seats.ts:522-539` (`setSeatTags`) and the doc comment `src/server/groups/groups.ts:159-164`.
- **Expected**: no lock cycle between a tag write and a forced group/project delete, as the comment ("cannot deadlock") claims.
- **Actual**: `setSeatTags` holds the seat `for update` and then takes the group `for share` whenever `v.groupId` is set, even when it equals the seat's current group (e.g. body `{ groupId: G, projectId: P }` on a seat already in G). A concurrent `deleteGroup(G, force)` holds G `for update` and then wants that seat `for update` -> lock cycle; Postgres aborts one transaction (40P01) and the caller gets a 500. Same for projects. The SIM-012 assign path (seat `for update` -> member `for share`) vs `deleteGroup` (members `for update` -> seats `for update`) can cycle the same way when the seat is already in G; the plan accepted this residual race as a 500, but the comment says otherwise. No data loss either way (one tx rolls back).
- **Fix instruction**: in `setSeatTags`, lock/check the group only when `next.group_id !== seat.group_id && next.group_id !== null` (and the project only when `next.project_id !== seat.project_id && next.project_id !== null`); an unchanged FK value is not re-checked by Postgres, and the pending delete then clears the seat after the tag tx commits. Reword the `deleteGroup` comment to state the remaining assign-vs-delete case is a detected deadlock (500), not impossible. Can be done in SIM-016.3 (which touches seat tagging) if not done before merge.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` green; new server files start with `import "server-only"`; routes import only server/lib. R6: every query goes through `orgQuery` with `org_id = $1` (verified by `groups.test.ts › org scoping (R6)`); cross-org ids -> not_found (`groups.db.test.ts › cross-org ids -> not_found`) and foreign-org tag ids -> 422 `invalid_group`. R7: auth codes only from `withAuth`; domain refusals are 409/422. R2/R3: no schema or env change. R5: new logic has tests.

### Blockers from review agents
None (to be filled by the orchestrator if a review agent runs).

### Nits (do not block)
- `updateGroup` / `updateProject` write an audit row and bump `updated_at` even when the patch equals the current values (`src/server/groups/groups.ts:105-131, 274-300`); `setSeatTags` skips no-ops, these could too.
- `group.delete` / `project.delete` audit records `forced: true` even when the item was unused and nothing was cleared; `seats`/`members` counts already show that, so harmless.

### Follow-ups (out of scope)
- Concurrency DB test for tag write vs forced delete and SIM-012 assign vs group delete (impl-log follow-up).
- SIM-016.2 (Groups/Projects management page) and SIM-016.3 (seat tag dialog) per the plan's split.
