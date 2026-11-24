# Security review — SIM-016.3

## Attempt 1

**Verdict: no blockers and no should-fix findings.** The narrower lock does not weaken the org check, does not let a seat be tagged with a group or project that is being deleted, and the UI goes only through `apiFetch`.

### Findings

No 🔴 or 🟡 findings.

**🟢 1. The org check on a changed id is intact (R6).** `src/server/seats/seats.ts:523-540`
- Any id that differs from the seat's current value still runs `select id from groups|projects where org_id = $1 and id = $2 for share` through `orgQuery`, using the verified scope. A cross-org or unknown id gets 422 `invalid_group` / `invalid_project` before the update.
- Skipping the lock when the id is unchanged is safe. `seats_group_fkey` and `seats_project_fkey` are composite keys on `(org_id, group_id)` and `(org_id, project_id)` (`db/migrations/20261120150000_init.sql:105-106`). So a seat that already holds that id can only point at a row in the same org.
- The seat itself is read through `lockSeat(c, scope, …)`, which is org-scoped.
- The validator accepts only a uuid or null (`src/lib/validate/group.ts:102-108`), so a falsy non-null value cannot skip the `v.groupId &&` guard.
- An uppercase or otherwise non-matching uuid string is just treated as a change, which means it gets checked. That fails safe.

**🟢 2. Tagging cannot race a delete into a deleted group or project.** `seats.ts:513-547` against `src/server/groups/groups.ts:167-215` and `:330-366`
- **Changing to a group or project that is being deleted:** our `for share` waits on the delete's row lock. Once the delete commits, the select returns no row and the write gets 422.
- **Delete already committed:** the seat's `group_id` is already null, so the request counts as a change and is checked, giving 422.
- **Id unchanged while a forced delete is running:** our transaction holds the seat `for share`. The delete's `select … from seats … for update` waits for us. After we commit, it re-reads the seat, sees the same `group_id` and clears it. The end state is consistent, and the NO ACTION foreign key is a backstop against any orphan.
- The update rewrites `group_id` / `project_id` to the same value. Postgres skips the foreign-key check when the key columns do not change, so the update takes no lock on the group or project. That is the deadlock this ticket fixes.

**🟢 3. R7 holds.** `src/app/api/seats/[id]/tags/route.ts:11-26`
- The handler is `withAuth` with `tier: "manager"`, so auth refusals happen before any work.
- The service returns only 422 / 404 domain codes through `apiError(r.status, r.code)`. No 401/403 is possible after the write.

**🟢 4. The UI goes through `apiFetch` with no tier bypass (R1).**
- `setTags` uses the shared `call()` wrapper around the injected `fetcher`, the bearer `apiFetch` (`src/ui/seats/seats-api.ts:141-150`).
- `SeatsPage` builds both `seatsApi` and `groupsApi` from `useApiFetch()` (`src/ui/seats/SeatsPage.tsx:36-41`).
- None of the new UI files call `fetch` directly, import server code, or touch `localStorage`, `sessionStorage`, `process.env` or `dangerouslySetInnerHTML`.
- The Tags button is shown on `canAssign(tier)` (`src/ui/seats/seat-actions.ts:69`). That only controls what the UI shows; the server's `manager` tier is what enforces access.

**🟢 5. A stale view cannot bring back a deleted tag.** `src/ui/seats/seat-tags.ts:10-24`
- `tagsPatch` sends only the keys that changed, so leaving the current tag selected sends nothing for that key. This holds even when `tagOptions` is still showing a tag deleted elsewhere.
- Choosing a deleted id from a stale list gets 422 from the server.
- Group and project names are rendered as React text (escaped), so there is no injection risk.

**🟢 6. No secrets involved (R3).** The audit metadata for `seat.tags` holds only the seat code and the group/project ids (`seats.ts:548-554`). The change adds no env reads and no credentials.

### Follow-ups (out of scope)
- The race between SIM-012's member-group assign and a group delete can still deadlock, giving a 500 on one side. The implementer already logged this, and the `deleteGroup` comment now says so.

Coverage: I read and grepped the changed server code, the route, the validator, the schema foreign keys and the new UI files. I did not run any checks; the green checks come from impl-log.md.
