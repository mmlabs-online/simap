Status: READY

# Plan — SIM-016.2: Groups and Projects management page

One slice, built from generic pieces (one api factory for both kinds, one list hook, one list section, one form
dialog, one delete dialog). No server, API, schema or `src/ui/copy/api.ts` change.

## Scope summary
- Spec GRP-01 (`docs/spec-v1.md` L317-321): "A Manager+ creates, edits and deletes groups (name unique, colour) and
  projects (code unique, name). Both are labels only." and "Deleting a group or project that is in use warns with the
  number of seats tagged; on confirm it clears the tag on its seats (and on members, for groups) (D34)."
- Spec L323: "**GRP-02** is covered by SEA-04." Seat tagging is SIM-016.3 and out of scope here.
- D34: "Unused-group/project delete warns and clears tags."
- D36: "UI copy is English by default; all user-facing text lives in copy files [...] Names/data keep Vietnamese
  diacritics (display, sort, search)."
- Ticket scope: "`/groups` page with a Groups list and a Projects list; nav entry in `src/lib/nav.ts` with
  `minTier: "manager"`", "Create/edit/delete dialogs; delete shows the delete-impact counts and asks before a forced
  delete (D34)", "`src/ui/groups/*`, copy in `src/ui/copy/groups.ts`. Template: `src/ui/rooms/*`." Out of scope:
  "Seat tagging UI (SIM-016.3). Any server or API change."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Managers list, create, edit and delete groups and projects; duplicate name/code shows its message. | `groups-api.test.ts` (paths, methods, bodies, list keys `groups`/`projects`, 409 `group_name_taken` / `project_code_taken` resolve to `{ok:false, code}`); `group-form.test.ts` (create/patch bodies, unchanged, field messages); `GroupsView.test.tsx` (rows, New/Edit/Delete buttons with aria-labels per list). The form dialog shows `apiErrorMessage(code)`, and `src/ui/copy/api.ts` L43-44 already has both texts. Manual: `pnpm dev`, as a Manager create group "Nhóm A", create it again and see "Another group already has this name."; same for a project code. |
| 2 | Deleting a used group or project shows the counts and clears tags only after confirmation. | `delete-flow.test.ts` (`deleteStep` plain/forced per kind, `impactLines` for seats and members with plurals and zero lines omitted, `removeOutcome`: `in_use` reloads the impact, `not_found` is done, other codes are errors); `DeleteDialog.test.tsx` (static render of `DeleteImpactBody`: the forced step lists the counts and the "tags are cleared, seats and members are kept" text, and its submit label differs from the plain one). The dialog sends `force=true` only when the loaded step is `forced` (code read). Manual: tag a seat (via `PATCH /api/seats/[id]/tags` or seed data), delete that group, see the counts, confirm, and the seat shows no group. |
| 3 | Users do not see the page or nav entry. | `nav.test.ts` (user ids lack `groups`, manager and admin have it); `AppShellView.test.tsx` (user html has no `/groups` link, manager has it); `groups-state.test.ts › canManageGroups` (null, user false, manager and admin true); `GroupsView.test.tsx › forbidden` (no-access text, no lists, no buttons). `GroupsPage` does not mount the data hooks when forbidden (AuditPage pattern, code read). |
| 4 | Static-render and pure-logic tests (no jsdom) cover the views and dialogs. | All UI tests use `renderToStaticMarkup` (as in `RoomsView.test.tsx`), with no jsdom environment. `pnpm test` is green. |

Checks (R5): `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
None. The manual steps in AC1 and AC2 run locally against `compose.dev.yml` and `pnpm seed:dev`. Ming can repeat
them on staging if he likes, but the reviewer can verify everything locally.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/groups/groups-api.ts` (+ `.test.ts`) | create: `createGroupsApi(fetcher)` returns `{ groups, projects }`. Each is built by one internal `resource<Dto, Create, Patch, Impact>(segment, listKey)` with `list/create/update/impact/remove(id, force)`, plus a shared `call`/`errorCode` copied from `src/ui/rooms/rooms-api.ts` L5-48. Result type `GroupsResult<T>`. | API client for both kinds without duplication | no |
| `src/ui/groups/useList.ts` | create: generic `useList<T>(load: () => Promise<GroupsResult<T[]>>)` → `{status, items, errorCode, reload}`. Copy of `src/ui/rooms/useRooms.ts` (counter + mounted refs). | two independent lists | no |
| `src/ui/groups/group-form.ts` (+ `.test.ts`) | create: `GroupForm {name,color}`, `ProjectForm {code,name}`, `DEFAULT_GROUP_COLOR`, `emptyGroupForm/emptyProjectForm`, `formFromGroup` (lowercases color) / `formFromProject`, `toGroupCreate/toGroupPatch/toProjectCreate/toProjectPatch` using `src/lib/validate/group.ts`, `fieldMessage(field)` from `groupsCopy.fieldErrors`. Reuse `codeInput` from `src/ui/rooms/room-form.ts` L13. | pure form logic (rule 6) | no |
| `src/ui/groups/delete-flow.ts` (+ `.test.ts`) | create: `deleteStep(impact)` via `isInUse` from `src/lib/groups/delete-impact.ts` L6, `impactLines(impact)` (seats, then members if present), `removeOutcome(result)` → `"done" \| "reload" \| {error: string}` | pure delete logic (AC2) | no |
| `src/ui/groups/groups-state.ts` (+ `.test.ts`) | create: `canManageGroups(tier: Tier \| null \| undefined)`, same as `canReview` in `src/ui/requests/requests-state.ts` L24 | tier gate (AC3) | no |
| `src/ui/groups/ListSection.tsx` | create: generic pure section (title, New button, loading skeleton, error + retry, empty text, `items.map(renderRow)`) | shared list UI for both kinds | no |
| `src/ui/groups/GroupsView.tsx` (+ `.test.tsx`) | create: pure page body. `access: "ok" \| "forbidden"`, a `ListState` per kind, handlers `onNew/onEdit/onDelete(kind, item?)`, `onRetry(kind)`. Two `ListSection`s; a group row has a color dot (`style={{ backgroundColor: g.color }}`) and the name; a project row has the code and the name; each row has Edit and Delete buttons | page view (AC1, AC3) | no |
| `src/ui/groups/TagFormDialog.tsx` (+ `.test.tsx`) | create: one create/edit dialog with `target: {kind:"group", item: GroupDto \| null} \| {kind:"project", item: ProjectDto \| null}`. Group fields: name (`DialogField`), color (`DialogField type="color"`). Project fields: code (uppercased while typing), name. Pattern from `src/ui/rooms/RoomFormDialog.tsx` (keyed inner, `unchanged` closes, `not_found` is done, otherwise `apiErrorMessage`) | create/edit (AC1) | no |
| `src/ui/groups/DeleteDialog.tsx` (+ `.test.tsx`) | create: generic delete dialog `{kind, item}` (pattern from `src/ui/rooms/DeleteRoomDialog.tsx`: load the impact, plain or forced step, `removeOutcome`), and an exported pure `DeleteImpactBody` | delete with counts (AC2) | no |
| `src/ui/groups/GroupsPage.tsx` | create: `GroupsPage` gate (`useSession` + `canManageGroups`, forbidden view without hooks, as in `src/ui/audit/AuditPage.tsx` L16-37); `GroupsLoaded` with two `useList`, a dialog union `none \| form \| delete` keyed by kind, and `done(kind)` = close + reload that list | page wiring | no |
| `src/ui/copy/groups.ts` | create: all page, list, form, field-error, delete and impact strings (D36) | copy rule | no |
| `src/ui/copy/shell.ts` | modify: `nav.groups: "Groups"` (L9-18), `pages.groups {title, empty}` (L40-50) | nav label is typed by `NavId` | no |
| `src/lib/nav.ts` | modify: `NavId` gets `"groups"`; insert `{ id: "groups", href: "/groups", icon: "sell", minTier: "manager", placement: "rail" }` after `approvals` (L29-35) | nav entry (AC3) | no |
| `src/lib/icons.ts` | modify: add `"palette"` (between `meeting_room` and `person`) and `"sell"` (between `search` and `space_dashboard`) | nav icon, color field icon; `icons.test.ts` checks sort order | no |
| `src/lib/nav.test.ts` | modify: the manager list gets `"groups"` after `"approvals"` (L11-18); admin `toHaveLength(9)` (L21); the rail order gets `"groups"` between approvals and audit (L31-39); new `it("groups is manager+")` | nav change | no |
| `src/ui/AppShellView.test.tsx` | modify: the admin href list (L84-92) gets `"/groups"` after `"/approvals"`; rename the "7 links" title to 8; add groups assertions to the user/manager test (L133-136) | nav change | no |
| `src/ui/index.ts` | modify: `export { GroupsPage } from "./groups/GroupsPage";` (after L28) | pages import via `@/ui` | no |
| `src/app/(app)/groups/page.tsx` | create: copy of `src/app/(app)/approvals/page.tsx` with `GroupsPage` | route | no |

No file matches a High path in `.claude/loop.config.md`. `src/server/**`, `src/app/api/**`, `src/lib/groups/**`,
`src/lib/validate/**`, `src/ui/copy/api.ts` and `src/ui/rooms/**` are **not** modified (rooms is only imported:
`codeInput`).

Source size estimate (non-test): api 85, useList 40, group-form 100, delete-flow 35, groups-state 10, ListSection 65,
GroupsView 95, TagFormDialog 115, DeleteDialog 100, GroupsPage 80, copy 65, shell/nav/icons/index/route 20. That is
about 650-800 lines, plus tests of about the same size. It is above the ~400 guide but not clearly above ~700, so this
plan is one slice (see Split proposal).

## Data model / migration
None.

## API contract
None changed. Consumed as built by SIM-016 (`work/tickets/SIM-016/plan.md` API contract; verified in code):
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/groups` | - | `{groups: GroupDto[]}`, ordered by `lower(name), id` (`src/server/groups/groups.ts` L51) | 401 403 503 | user |
| POST | `/api/groups` | `{name, color}` | 201 `GroupDto` | 400 `invalid_request`, 409 `group_name_taken` | manager |
| PATCH | `/api/groups/[id]` | `{name?, color?}` | `GroupDto` | 400, 404 `not_found`, 409 `group_name_taken` | manager |
| GET | `/api/groups/[id]/delete-impact` | - | `{seats, members}` | 404 | manager |
| DELETE | `/api/groups/[id][?force=true]` | - | 204 | 404, 409 `in_use` | manager |
| GET | `/api/projects` | - | `{projects: ProjectDto[]}`, ordered by `code, id` (`src/app/api/projects/route.ts` L17, groups.ts L221) | 401 403 503 | user |
| POST / PATCH | `/api/projects`, `/api/projects/[id]` | `{code, name}` / `{code?, name?}` | 201 / 200 `ProjectDto` | 400, 404, 409 `project_code_taken` | manager |
| GET | `/api/projects/[id]/delete-impact` | - | `{seats}` | 404 | manager |
| DELETE | `/api/projects/[id][?force=true]` | - | 204 | 404, 409 `in_use` | manager |

The server answers a validation failure only with 400 `invalid_request` (no field). So the form validates on the
client with the same validators (`src/lib/validate/group.ts`) to show a field message first.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/groups/groups-api.test.ts` › groups: list reads `groups`, a missing key is `internal`; create POSTs JSON to `/api/groups`; update PATCHes `/api/groups/<encoded id>`; impact GETs `.../delete-impact`; remove adds `?force=true` only when forced | client paths and methods |
| › projects: list reads `projects`; the same paths under `/api/projects` | second kind through the same factory |
| › 409 `group_name_taken` / `project_code_taken` / `in_use` give `{ok:false, code}`; network error gives `unavailable`; `ApiAccessError signed_out` gives `unauthenticated`; a bad JSON error body gives `internal` | AC1 duplicate message, error mapping |
| `src/ui/groups/group-form.test.ts` › toGroupCreate trims and NFC-normalizes the name (Vietnamese "Nhóm Kỹ thuật" kept); empty or 61-char name → name message; bad color → color message | create validation, diacritics (Domain focus) |
| › toGroupPatch sends only changed fields; same name after trim → unchanged; color differing only in case (server `#AABBCC` vs input `#aabbcc`) → unchanged | edit diff |
| › toProjectCreate uppercases and trims the code; `"a b"` / 33 chars → code message; toProjectPatch: `" abc "` vs `ABC` → unchanged | project rules |
| › formFromGroup lowercases the color; emptyGroupForm uses `DEFAULT_GROUP_COLOR`, which passes `validateGroupCreate` | color input compatibility |
| `src/ui/groups/delete-flow.test.ts` › deleteStep: group `{0,0}` plain, `{1,0}` / `{0,2}` forced; project `{0}` plain, `{3}` forced | AC2 |
| › impactLines: `{seats:1, members:0}` → only "1 seat"; `{seats:2, members:1}` → "2 seats", "1 member"; project `{seats:5}` → "5 seats" | counts and plurals |
| › removeOutcome: ok → done; `not_found` → done; `in_use` → reload; `forbidden` → error with the `apiErrorMessage` text | stale-impact race (consult risk 1) |
| `src/ui/groups/groups-state.test.ts` › canManageGroups | AC3 |
| `src/ui/groups/GroupsView.test.tsx` › forbidden: no-access text, neither list title, no buttons | AC3 |
| › loading: both sections `aria-busy`; one list error + one ready: the error card with retry in one section and rows in the other | independent lists |
| › ready empty: the per-list empty texts | empty state |
| › ready: a group row has a color dot with `background-color:#3366ff`, the name "Nhóm A", and Edit/Delete aria-labels with the name; a project row shows code and name; two New buttons | AC1 |
| `src/ui/groups/TagFormDialog.test.tsx` › create group: create title, name field, color input with the default value; edit project: edit title, code and name prefilled, Save label | dialog static render |
| `src/ui/groups/DeleteDialog.test.tsx` › `DeleteImpactBody` plain: the plain body with the item label; forced group: intro, "2 seats", "1 member", the cleared-not-deleted note; forced project: seats only | AC2 static render |
| › the dialog before the impact loads: title present, submit disabled | loading state |
| `src/lib/nav.test.ts` › groups is manager+ (plus the updated lists) | AC3 |
| `src/ui/AppShellView.test.tsx` › user has no `/groups` link; manager has it; admin href list | AC3 |

## Approach
1. **Copy** `src/ui/copy/groups.ts` (shape like `src/ui/copy/rooms.ts`):
   - Section titles: "Groups", "Projects".
   - Buttons: `newGroup`, `newProject`, `edit`, `delete`, `retry`, `create`.
   - Empty texts: "No groups yet.", "No projects yet.".
   - Field labels: name, color, code, project name.
   - `fieldErrors {name, color, code, projectName?, body}`, keyed by the validator `field` (the validator reports
     `name` for both kinds, so the project name message is selected by kind in `fieldMessage(kind, field)`).
   - Dialog titles per kind and mode; `editLabel(name)` and `deleteLabel(name)`; `deleteBody(label)` and
     `forceDeleteIntro(label)`.
   - `impactSeats(n)` ("1 seat" / "n seats") and `impactMembers(n)` ("1 member" / "n members").
   - `forceDeleteNote`: "The tag is removed from these seats and members. Seats and members are not deleted."
     The project variant mentions seats only.
   - `forceDeleteSubmit` differs from `deleteSubmit`; `noAccess`: "Only managers and admins can manage groups and
     projects."

   No literals in `.tsx` files (`no-literals.test.ts`), and no Vietnamese diacritics in copy files.
2. **Pure logic**: `groups-state.ts`, `group-form.ts`, `delete-flow.ts` with their tests.
   - The color input only accepts and emits lowercase `#rrggbb`. So `formFromGroup` lowercases the color, and the
     patch diff compares the color case-insensitively.
   - Name diff compares `normalize("NFC").trim()`, as the validator does.
3. **`groups-api.ts`**: one factory.
   - `remove` resolves `{ok:true, value:null}` on 204 (as rooms does).
   - `encodeURIComponent(id)` in paths.
   - It never throws.
4. **`useList.ts`**: generic copy of `useRooms`. `GroupsLoaded` passes stable loaders (`api.groups.list`,
   `api.projects.list` from the `useMemo` api), so the `reload` deps stay stable.
5. **Views**: `ListSection.tsx` and `GroupsView.tsx` stay pure, with props only, `Card` and `Button` from `src/ui`.
   - Server order is kept (no re-sort in the UI).
   - The page is Manager-only, so there is no read-only mode and the buttons always show when `access === "ok"`.
   - Rows show the name in the normal text color next to a separate color dot (contrast).
6. **Dialogs**:
   - `TagFormDialog` follows `RoomFormDialog` L46-82. Inputs get `maxLength` from `GROUP_LIMITS`. There is no rename
     warning for project codes, because seat tags reference the project by id (`seats.project_id`, SIM-016 plan Data
     model).
   - `DeleteDialog` follows `DeleteRoomDialog`, with `removeOutcome` replacing the inline checks at L62-64. `force` is
     `step === "forced"` from the loaded impact, so a forced delete happens only after the user saw the counts and
     pressed the distinct forced submit.
7. **Page**: `GroupsPage` gates first. The dialog union is
   `{kind:"none"} | {kind:"form", target} | {kind:"delete", target: {kind:"group", item} | {kind:"project", item}}`.
   `done` reloads only the list of the edited kind.
8. **Nav, icons, shell copy, index export, route file**; then update `nav.test.ts` and `AppShellView.test.tsx`.
9. Run all Checks.

Rules:
- R1: `src/ui/groups/**` imports only `@/lib/**` and `../` ui modules. The page file imports `@/ui`.
  `pnpm check:layers` enforces this.
- R3: no env or secrets.
- R4: only the files above.
- R5: tests above, checks green.
- R6, R7, R2: not touched (no server or schema code).
- D36: copy in `src/ui/copy/groups.ts`. Names keep diacritics: tests use Vietnamese names.

## Specialist input used
`consult-frontend-developer.md`:
- Adopted:
  - the file layout and build order;
  - generic api factory (`kind` path segment);
  - two independent list loads;
  - AuditPage-style gate without mounting hooks;
  - `type="color"` input with a lowercase hex;
  - the color dot as a separate element;
  - patch only changed fields;
  - one delete dialog parameterized by kind;
  - `in_use` reloads the impact and `not_found` counts as done;
  - a new rail icon instead of reusing `group`;
  - updating `nav.test.ts` and `AppShellView.test.tsx`.
- Adapted:
  - one `TagFormDialog` for both kinds instead of `GroupFormDialog` + `ProjectFormDialog`, plus a generic
    `ListSection` (the consult's "generics" option, to stay near ~700 lines);
  - `removeOutcome` extracted as pure logic so the stale-impact path is unit-tested without jsdom;
  - `DeleteImpactBody` exported so the forced step can be static-rendered (the dialog loads the impact in an effect,
    which static render does not run).
- Open questions answered:
  1. Size: one slice. The generic estimate is ~650-800 source lines, not clearly over ~700. A client-only half is
     unusable alone, and Ming declined a similar split for SIM-014.3.
  2. Icon: add `sell` for the nav, plus `palette` for the color field.
  3. Default color: a fixed `DEFAULT_GROUP_COLOR` plus the native picker, no palette. Spec GRP-01 says only "colour",
     and the SIM-016 plan Assumptions say "Colour is free `#RRGGBB` [...]; no palette in v1".
  4. Project rename warning: none. Tags reference the project by id.
  5. Lists load and fail independently.
  6. `members` counts members whose `group_id` is the group (`src/server/groups/groups.ts` L138). A forced delete sets
     their `group_id` to null (L181-187). The copy says the group is removed from those members, not that members are
     deleted (D34: members are never deleted).
- Rejected: none.

## Assumptions
- `DEFAULT_GROUP_COLOR` is a mid-blue such as `#3b82f6`. The exact value is the implementer's pick; any valid
  `#rrggbb` that reads on both themes is fine.
- The nav entry is placed after `approvals` (the Manager items) and before `audit` (Admin). The label is "Groups" and
  the page title is "Groups and projects".
- `members` in the impact may include deactivated members (the server counts all `members` rows of the org). The copy
  does not say "active".
- An edit that changes nothing just closes the dialog (rooms behaviour). An edit or delete on an item that is gone
  (`not_found`) closes and reloads.
- The mobile bottom bar gets one more item for Managers and Admins (9 for Admins). The ticket does not ask for a
  layout change. Check a narrow viewport during the manual run, and file any overflow fix as a follow-up.
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. `src/lib/nav.ts`, `src/lib/icons.ts`,
  `src/ui/copy/shell.ts` and `src/ui/index.ts` are shared by every UI ticket. SIM-016.3 (BACKLOG) will likely reuse
  `groups-api.ts` `list` for its selects, so expect a rebase if it starts before this merges.

## Blocking questions
None

## Split proposal
None. One slice, as described above. Fallback only if the implementer finds the source diff clearly over ~800 lines:
move the project half of the views (project rows and project form fields) to a follow-up. Do not split
client-logic from UI.
