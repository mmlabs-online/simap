# Security review — SIM-016

## Attempt 1

**Verdict: no blockers and no should-fix items.** I found two notes. The org scoping, tier checks and cross-org tag injection protection are all sound.

I only had Read, Grep and Glob, so I read the files listed in `work/tickets/SIM-016/impl-log.md` rather than running `git diff`. I did not re-run any checks.

### Findings

**🔴 Must fix:** none.

**🟡 Should fix:** none.

**🟢 Note 1: two concurrent requests can deadlock, which shows up as a 500.**
- **Evidence:** `src/server/seats/seats.ts:513` and `:522-539`; `src/server/groups/groups.ts:173` and `:190-195` (`deleteProject` has the same shape at `:336`, `:341-346`).
- **How it happens:**
  1. Seat X is already tagged with group G.
  2. A manager sends `{groupId: G, projectId: P2}`. That is not a no-op, and `v.groupId` is set, so `setSeatTags` holds X `for update` and then asks for G `for share`.
  3. At the same moment, a force delete of G holds G `for update` and then asks for X `for update`.
  4. Postgres detects the deadlock and aborts one side with error 40P01, which reaches the client as a 500.
- **Impact:** availability only. Nothing is corrupted and nothing leaks across orgs.
- **Fix:** only lock the group or project when it is actually changing: `if (v.groupId && v.groupId !== seat.group_id)` and `if (v.projectId && v.projectId !== seat.project_id)`. An unchanged reference is already held in place by the foreign key. The comment at `:521` should also be narrowed. If it is cheap, add a DB test for this ordering.

**🟢 Note 2: audit meta, no PII.**
- `group.delete` records the group name and counts (`groups.ts:209`), `project.delete` records the code (`:360`), and `seat.tags` records ids and the seat code (`seats.ts:552`). Updates record field names only (`groups.ts:127`, `:296`).
- A group name is an org label, not personal data. If an org names groups after people, that name ends up in the audit log, which is acceptable.

### What I verified as correct

**Org scoping (R6)**
- Every query in `groups.ts` goes through `orgQuery` with `org_id = $1`, and `orgQuery` throws if that filter is missing (`src/server/http/org-scope.ts:22`).
- The forced-delete clears are scoped to the token's org:
  - members: `groups.ts:181`, `:187`
  - seats, for groups: `:193`, `:199`
  - seats, for projects: `:344`, `:350`
- The impact counts are org-scoped (`:137-138`, `:306`).
- Inserts take `org_id` from the scope only (`:77-79`, `:246-248`).
- The UPDATE column names come from a fixed allow-list (`:114`, `:283`) and the values are bound parameters, so there is no SQL injection.

**Cross-org id injection on `PATCH /api/seats/[id]/tags`**
- The seat lookup is org-scoped and answers 404 (`seats.ts:224`, `:243`).
- `groupId` and `projectId` are checked against the caller's org and answer 422 `invalid_group` / `invalid_project` (`seats.ts:526`, `:535`).
- The schema adds a second guard: the composite foreign keys `(org_id, group_id)` and `(org_id, project_id)` (`db/migrations/20261120150000_init.sql:105-106`, `:54`).
- A foreign org's id gets the same answer as a random one, so the endpoint cannot be used to check whether an id exists in another org.

**Tier checks and auth codes (R7)**
- Both GET list routes are `tier: "user"`.
- Every write and both delete-impact routes are `tier: "manager"`: `groups/route.ts:34`, `groups/[id]/route.ts:27,41`, `groups/[id]/delete-impact/route.ts:19`, the same files under `projects/`, and `seats/[id]/tags/route.ts:25`.
- No handler or server function returns 401 or 403; the refusal types allow only 404, 409 and 422 (`groups.ts:20`, `seats.ts:24`).

**Input validation**
- Route ids must be lowercase canonical UUIDs (`src/lib/validate/uuid.ts:1`), otherwise the answer is 404.
- Bodies reject unknown keys and empty patches. Names are NFC-normalised, trimmed and length-limited. Colours match the same pattern as the DB check (`validate/group.ts:11`). Codes are uppercased and restricted to `[A-Z0-9._-]`. Tag values must be a UUID or null.
- `force` is true only for the exact string `"true"`.

**Error codes**
- All error responses carry a code only. The `in_use` refusal does not include counts.
- `groupConflict` maps only the two named unique constraints (`pg-error.ts:3-12`); every other database error goes up as an unmapped 500.

**Layers and secrets (R1, R3)**
- Both server files start with `import "server-only"`, and the routes import only `@/server` and `@/lib`.
- There are no secrets and no env changes.

### Follow-ups (out of scope)
- A known race, already listed as a follow-up in the impl-log: an SIM-012 assign that copies a member's group onto a seat while that group is being deleted can hit the `seats_group_fkey` foreign key. The resulting 23503 is unmapped and becomes a 500. This is availability only.
