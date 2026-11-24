Status: READY

# Plan — SIM-016: Groups, projects and seat tags

This plan covers **slice 1 of 3 only** (server + API + pure logic). See `## Split proposal`.

## Scope summary
- Spec GRP-01: "A Manager+ creates, edits and deletes groups (name unique, colour) and projects (code unique, name). Both are labels only."
- Spec GRP-01: "Deleting a group or project that is in use warns with the number of seats tagged; on confirm it clears the tag on its seats (and on members, for groups) (D34)."
- Spec SEA-04 / GRP-02: "A Manager+ sets or clears a seat's group and its project. Tags never affect permissions."
- D34: "Unused-group/project delete warns and clears tags." (ticket: "delete warns, clears tags").
- Ticket scope: CRUD for groups and projects unique per org; tag/untag a seat; delete in use warns with counts, clears on confirm. Out of scope: reporting by group.
- Slice 1 (this plan) delivers the API and logic for all three bullets plus the delete-impact unit tests. UI is slices 2 and 3.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Names/codes are unique within the org. | `groups.db.test.ts › duplicate group name in same org -> group_name_taken (409)`, `same name in another org is allowed`; same for project code. `pnpm test:db` |
| 2 | Deleting a used group clears it from seats and members after confirmation. | `groups.db.test.ts › delete used group without force -> 409 in_use and nothing changes`; `› force clears seats.group_id and members.group_id, deletes row, writes audit`; route test `DELETE ?force=true`. |
| 3 | Users cannot change tags (403). | `groups-routes.test.ts › user tier gets 403 on POST/PATCH/DELETE groups and projects and PATCH /api/seats/[id]/tags`; handlers use `withAuth({tier:"manager"})` so 403 comes only from the wrapper (R7). |
| 4 | Unit tests cover delete impact. | `src/lib/groups/delete-impact.test.ts` (pure decision) and `groups.test.ts › getDeleteImpact` (counts for seats/members/none, 404) |

## Ming verification after merge
None for this slice. (Manual "tag seats and delete a used group" from the ticket test plan happens after slices 2 and 3 ship the UI.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/groups/types.ts` | create: `GroupDto {id,name,color}`, `ProjectDto {id,code,name}`, `GroupImpact {seats, members}`, `ProjectImpact {seats}`, `GROUP_LIMITS` | shared DTOs for API and UI | no |
| `src/lib/groups/delete-impact.ts` (+ `.test.ts`) | create: `isInUse(impact)`, `decideDelete(impact, force)` -> `"delete" \| "clear_and_delete" \| "refuse_in_use"` | pure logic first (rule 6), AC 4 | no |
| `src/lib/validate/group.ts` (+ `.test.ts`) | create: `validateGroupCreate/Patch` (name NFC+trim 1..60, colour `#RRGGBB` matching db check `^#[0-9A-Fa-f]{6}$`, unknown keys rejected), `validateProjectCreate/Patch` (code trim+uppercase like room code, name), `validateSeatTags` (`groupId`/`projectId` each uuid or null, at least one key). Reuse `Validated` from `./room` and `isCanonicalUuid` | input validation, same pattern as `room.ts` / `seat.ts` | no |
| `src/server/groups/groups.ts` (+ `groups.test.ts`, `groups.db.test.ts`) | create: `listGroups/createGroup/updateGroup/getGroupImpact/deleteGroup`, same for projects (may split to `projects.ts` if over ~200 lines), `server-only`, `inTx`/`Abort` pattern from `src/server/rooms/rooms.ts`, audit via `writeAudit` (`group.create/update/delete`, `project.*`) | persistence + D34 clear-on-delete | no |
| `src/server/groups/pg-error.ts` | create: map unique violations `groups_org_name_key` -> `group_name_taken`, `projects_org_code_key` -> `project_code_taken` (copy `src/server/rooms/pg-error.ts`) | domain 409s | no |
| `src/server/seats/seats.ts` | modify: add `setSeatTags(db, scope, actorSub, seatId, v)` next to `setCannotSeat` (L469-498); extend `Refusal.code` with `invalid_group`, `invalid_project` | SEA-04 tag/untag | no |
| `src/lib/seats/rules.ts` | modify (small): `tagsChanged(current, next)` no-op detection, or keep inline if trivial | avoid audit noise on no-op | no |
| `src/app/api/groups/route.ts`, `src/app/api/groups/[id]/route.ts`, `src/app/api/groups/[id]/delete-impact/route.ts` | create | endpoints | no |
| `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/delete-impact/route.ts` | create | endpoints | no |
| `src/app/api/seats/[id]/tags/route.ts` | create: PATCH, template `src/app/api/seats/[id]/cannot-seat/route.ts` | seat tagging | no |
| `src/app/api/groups/groups-routes.test.ts` | create: 401/403/400/404/409 mapping with mocked server layer (template `src/app/api/seats/seats-routes.test.ts`) | AC 3 | no |
| `.env.example`, `db/**`, `.github/**` | **not touched** | no migration needed | — |

None of these paths is a High path (no `db/migrations`, auth, or infra files). Confirm against `.claude/loop.config.md` High paths list before implementing; if `src/server/http/**` or `src/server/seats/**` is listed there, the gate becomes plan-approval.

## Data model / migration
None. The v1 schema from SIM-008 (`db/migrations/20261120150000_init.sql`) already has everything:
- `groups (org_id, id, name, color)` with `groups_org_name_key unique (org_id, name)`, `groups_color_check ^#[0-9A-Fa-f]{6}$`, `groups_org_id_key unique (org_id, id)`.
- `projects (org_id, id, code, name)` with `projects_org_code_key unique (org_id, code)`.
- `members.group_id`, `seats.group_id`, `seats.project_id` with composite FKs `(org_id, x_id) -> (org_id, id)`, NO ACTION; the migration comment (L36) says "Deleting a group is done by the service, which clears group_id in the same transaction". Indexes `members_org_group_idx`, `seats_org_group_idx`, `seats_org_project_idx` exist for the impact counts.
- The tables' exact column lists/lengths must be read from init.sql L7-35 by the implementer (no length limit in db; the limits above are API limits).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/groups` | - | `{groups: GroupDto[]}` (order lower(name), limit 500) | 401 403 503 | user |
| POST | `/api/groups` | `{name, color}` | 201 `GroupDto` | 400 invalid_request, 409 group_name_taken | manager |
| PATCH | `/api/groups/[id]` | `{name?, color?}` | `GroupDto` | 400, 404 not_found, 409 group_name_taken | manager |
| GET | `/api/groups/[id]/delete-impact` | - | `{seats, members}` | 404 | manager |
| DELETE | `/api/groups/[id]?force=true` | - | 204. Without `force` and in use: refuse | 404, 409 `in_use` (body carries no counts; client calls delete-impact first, as rooms do) | manager |
| GET/POST | `/api/projects` | `{code, name}` | list / 201 `ProjectDto` | 400, 409 project_code_taken | user / manager |
| PATCH | `/api/projects/[id]` | `{code?, name?}` | `ProjectDto` | 400, 404, 409 | manager |
| GET | `/api/projects/[id]/delete-impact` | - | `{seats}` | 404 | manager |
| DELETE | `/api/projects/[id]?force=true` | - | 204 | 404, 409 in_use | manager |
| PATCH | `/api/seats/[id]/tags` | `{groupId?: uuid\|null, projectId?: uuid\|null}` (at least one key; null clears) | `SeatDto` (existing, includes `group`, `project`) | 400, 404 seat/not_found, 422 `invalid_group` / `invalid_project` (id not in org) | manager |

Notes: GET lists are `user` tier because the seat detail and members views display tags and the members list already returns group options. `PATCH tags` does not touch occupant or `cannot_seat` and works on occupied and blocked seats. Tags never affect permissions. All auth codes come from `withAuth` before any side effect (R7). Every query goes through `orgQuery` with the token org (R6).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/groups/delete-impact.test.ts › decideDelete` | unused -> delete; used + no force -> refuse_in_use; used + force -> clear_and_delete; seats-only, members-only, both |
| `src/lib/validate/group.test.ts` | name trim/NFC/empty/too long, colour hex valid/invalid (`#fff`, `red`, 8 digits), code uppercase, unknown keys, empty patch, `validateSeatTags` (uuid, null, both, neither, non-uuid) |
| `src/server/groups/groups.test.ts` (mock db, like `rooms.test.ts`) | `getGroupImpact` counts seats and members; `getProjectImpact` seats only; not-found; delete without force on used group returns in_use and issues no update; force issues member update before seat update, then delete, then audit |
| `src/server/groups/groups.db.test.ts` (`pnpm test:db`) | uniqueness per org (both kinds, other org allowed), force delete clears seats and members and leaves other groups' tags, in-use refusal leaves data intact, cross-org id -> not_found, seat tags set/clear/no-op, tag with foreign-org group -> invalid_group |
| `src/app/api/groups/groups-routes.test.ts` | user tier 403 on all writes and on `PATCH /seats/[id]/tags`; manager OK; bad uuid -> 404; bad body -> 400; 409/422 mapping |

## Approach
1. Pure logic first: `src/lib/groups/{types,delete-impact}.ts` and `src/lib/validate/group.ts` with their tests.
2. `src/server/groups/groups.ts` using the rooms template: `createX` via the `select ... from (select $1::uuid as org_id)` form so `orgQuery`'s `org_id = $1` guard is satisfied; unique violation mapped by `pg-error.ts`.
3. `deleteGroup` in one transaction: lock the group row `for update` (so a concurrent tag write, which takes `for share` on the group, waits then fails its FK check -> `invalid_group`); compute impact; `decideDelete`; on force: `select id from members where group_id = $2 order by id for update`, then update members set group_id = null, then `select id from seats where group_id = $2 order by id for update`, then update seats set group_id = null, then delete the group, then audit with counts. **Members before seats**: SIM-012's assign holds the target member `for share` and writes `seats.group_id` from the member's group, so clearing members first makes a racing assign either commit before our member update (and its seat then gets cleared by the later seat update) or see the cleared group. Seats are locked in ascending id order and without a room lock; this cannot deadlock with the documented room -> seat order because no room lock is taken (state this in a comment).
4. `setSeatTags` in `seats.ts`: reuse `lockSeat(c, scope, seatId, "share")` (as `setCannotSeat`), lock the referenced group/project row `for share` scoped by org (missing -> `refuse(422, "invalid_group"|"invalid_project")`), update only the supplied keys, skip write and audit on no-op, audit `seat.tags` with ids and codes only, return `loadSeat`.
5. Route handlers follow `rooms/route.ts` and `cannot-seat/route.ts` exactly; `GET` lists `tier: "user"`, everything else `tier: "manager"`; `force` read from the query string like the rooms DELETE route (copy its parsing from `src/app/api/rooms/[id]/route.ts`).
6. Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`, `pnpm test:db`.
Rules: R1 (api -> server, lib; server files start with `import "server-only"`), R2 n/a (no schema change), R4 stay in this file list, R5 tests above, R6 org scoping, R7 auth codes only from the wrapper.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- No migration: existing schema already carries groups, projects, tags and FKs. If the implementer finds a missing column, stop and ask; that would make it a High path (`db/migrations`) and the gate plan-approval.
- Colour is free `#RRGGBB` (as the DB check); no palette in v1. Group name limit 60, project code limit 32 (uppercase like room codes), project name 120 are API-level choices, adjustable in review.
- DELETE of an in-use item without `force` answers 409 `in_use`; the UI (slice 2) fetches `delete-impact` first, shows counts, then calls with `force=true`. Same contract as `rooms` (`room_not_empty`).
- Seat "tag/untag" is a single PATCH instead of separate verbs.
- Race: an inherited group write in SIM-012's assign (`seats.group_id` taken from the member) after a group delete is prevented by step 3 ordering; if a residual FK violation (23503) surfaces it is a 500 and logged, acceptable and out of this slice.
- Hotspot: `src/server/seats/seats.ts` and `src/lib/seats/rules.ts` are shared with the seat tickets (SIM-012/013 are merged; check `work/backlog.md` for any open ticket touching them and expect a rebase). `src/ui/copy/*`, `src/lib/nav.ts` and `src/ui/index.ts` (used by slices 2/3) are hotspots for other UI tickets; not touched here.
- Changed-line estimate for this slice: about 350-450 source lines plus tests, at the edge of the guide; if `groups.ts` exceeds that, move projects to the next slice rather than shrinking tests.

## Blocking questions
None

## Split proposal
Size S is optimistic: API + two management screens + seat tagging UI is well over ~400 lines. Proposed slices (tickets `SIM-016.1` to `.3`, in the style of `SIM-014.x`):
1. **SIM-016.1 (this plan)**: lib types/validators/delete-impact logic, server `groups`/`projects`, all API routes, `setSeatTags` and `PATCH /api/seats/[id]/tags`, with the unit and DB tests. Covers all four acceptance criteria at API level.
2. **SIM-016.2**: Groups and Projects management page for Managers (`/groups` route, nav entry in `src/lib/nav.ts` with `minTier: "manager"`, `src/ui/groups/*`, copy in `src/ui/copy/groups.ts`), create/edit/delete dialogs, delete-impact warning with counts (template: `src/ui/rooms/RoomsView.tsx`, `DeleteRoomDialog.tsx`, `rooms-api.ts`).
3. **SIM-016.3**: tag/untag in the seat detail (`SeatActions.tsx` / `seat-actions.ts` button, a small tags dialog with group and project selects in `src/ui/seats/`, copy in `src/ui/copy/seats.ts`, `seats-api.ts` method), hidden for User tier (UX only; API enforces).
