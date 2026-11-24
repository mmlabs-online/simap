## Attempt 1 — 2026-11-24 (slice 1: API and logic)

### Files touched
| File | Required because |
|---|---|
| src/lib/groups/types.ts | shared DTOs, impact types, limits |
| src/lib/groups/delete-impact.ts (+ .test.ts) | pure delete decision (AC 4) |
| src/lib/validate/group.ts (+ .test.ts) | validators for groups, projects, seat tags |
| src/server/groups/groups.ts | group and project CRUD, impact, force delete (D34), audit |
| src/server/groups/pg-error.ts | unique violation -> group_name_taken / project_code_taken |
| src/server/groups/groups.test.ts, groups.db.test.ts | mock and DB tests |
| src/server/seats/seats.ts | `setSeatTags`, refusal codes `invalid_group`/`invalid_project`, `project_id` in `SeatLock` select |
| src/app/api/groups/route.ts, [id]/route.ts, [id]/delete-impact/route.ts | group endpoints |
| src/app/api/projects/route.ts, [id]/route.ts, [id]/delete-impact/route.ts | project endpoints |
| src/app/api/seats/[id]/tags/route.ts | PATCH seat tags |
| src/app/api/groups/groups-routes.test.ts | 401/403/400/404/409/422 mapping |
| src/lib/api/error.ts, src/ui/copy/api.ts | NOT in plan, see below |

### Tests added / changed
- src/lib/groups/delete-impact.test.ts › decideDelete / isInUse
- src/lib/validate/group.test.ts › group, project and seat-tag validators
- src/server/groups/groups.test.ts › org scoping, 409 mapping, impact counts, delete without/with force (members before seats), project delete
- src/server/groups/groups.db.test.ts › uniqueness per org, in_use refusal, force clear, cross-org, seat tags set/clear/no-op/foreign-org
- src/app/api/groups/groups-routes.test.ts › user tier 403 on writes/impact/tags, manager passes, 404/400/409/422

### Checks (actual output summary)
- format:check: exit=0, "All matched files use the correct format."
- typecheck: exit=0
- check:layers: exit=0
- test: exit=0, Test Files 198 passed, Tests 2073 passed | 3 skipped
- build: exit=0
- test:db (local docker compose Postgres, `postgres://simap@127.0.0.1:5432/simap`): exit=0, Test Files 10 passed, Tests 133 passed (includes groups.db.test.ts). Container stopped afterwards.

### Out-of-plan files
- src/lib/api/error.ts: `apiError` only accepts codes listed in `API_ERROR_CODES`; added `group_name_taken`, `project_code_taken`, `in_use`, `invalid_group`, `invalid_project`. Not a High path.
- src/ui/copy/api.ts: the copy map is `satisfies Record<ApiErrorCode, string>`, so each new code needs a message. Not a High path.
- No migration, no change under src/server/http/** or other High paths.

### Follow-ups (noticed, not done)
- `tagsChanged` in src/lib/seats/rules.ts was skipped; the no-op check is two comparisons inline in `setSeatTags`.
- Residual race noted in the plan (SIM-012 assign vs group delete) is not covered by a concurrency test.

### Scope self-check
- Could the diff be smaller? No; groups.ts is 364 lines because groups and projects both live in it (plan allowed a split only if over ~200 lines; kept as one file, the halves are independent).
- Diff size: modified files +70 / -2; new files only otherwise.
