# Consult — frontend-developer (SIM-016.2)

## Findings

**Reusable as is**
- API surface (SIM-016): `GET/POST /api/groups` -> `{groups}` / 201 GroupDto; `PATCH/DELETE /api/groups/[id]`; `GET /api/groups/[id]/delete-impact` -> `{seats, members}`. Projects are the same, with `{projects}` and impact `{seats}`. I did not open the projects routes or check the list key `projects`. Verify it against `src/app/api/projects/route.ts`. All write and impact routes need tier `manager`; GET list is `user`.
- Types: `src/lib/groups/types.ts` has GroupDto `{id,name,color}`, ProjectDto `{id,code,name}`, GroupImpact, ProjectImpact and `GROUP_LIMITS`. Validators and value types are in `src/lib/validate/group.ts`.
  - A group color must match `#RRGGBB`, because the validator requires it. The name limit is 60.
  - A project code is trimmed and uppercased, matches `[A-Z0-9._-]+`, and is at most 32 characters. The project name limit is 120.
  - Patch bodies reject unknown keys and empty bodies.
- Server errors are 409 `group_name_taken`, `project_code_taken`, `in_use`, plus 404 `not_found`. All have messages in `src/ui/copy/api.ts` (lines 43-47), so `apiErrorMessage(code)` already covers the duplicate-name and duplicate-code acceptance criterion. No server or copy change is needed there.
- DELETE without `?force=true` on a used item returns 409 `in_use`. There is no pre-check in the UI contract, so the UI must read the impact first. This is the same shape as rooms.
- `rooms-api.ts` is generic apart from its types and paths. `createGroupsApi` should be a copy with `groups`/`projects` methods: list, create, update, impact, remove(id, force). I suggest one file `groups-api.ts` with a small shared `call`, taking a `kind: "groups" | "projects"` path segment so that code is not duplicated. Return `GroupsResult<T>` like `RoomsResult`.
- Dialog pieces are `EntityFormDialog` and `DialogField` from `src/ui`. Page structure is RoomsPage (dialog state union, `done` = close + reload), `useRooms` (counter and mounted refs for stale responses), RoomsView (loading, error, empty, ready) and DeleteRoomDialog (load impact, `plain` or `forced` step, `not_found` treated as done, a refused delete reloads the impact).
- Nav: `src/lib/nav.ts` needs a new `NavId` (`"groups"`), `NAV_ITEMS` gets `{id:"groups", href:"/groups", minTier:"manager", placement:"rail"}`, and `src/ui/copy/shell.ts` needs a `nav` label (line ~16, typed `satisfies Record<NavId,string>`, so a missing label fails typecheck) and `pages.groups {title, empty}`.
  - The icon has to come from `ICON_NAMES` in `src/lib/icons.ts`. That list must stay alphabetical and snake_case (`icons.test.ts` checks this). Either reuse `group` (already used by Members) or add a new one such as `sell` or `label`, inserted in sorted position. A new icon is better because two identical rail icons are confusing.
- Existing tests to update. In `src/lib/nav.test.ts`, the admin count assertion is `toHaveLength(8)` (becomes 9) and the manager id list changes. In `src/ui/AppShellView.test.tsx`, an href list around lines 85-95 changes (read it before editing). Manager+ filtering by tier needs no code change.
- Page wiring: add `src/app/(app)/groups/page.tsx` (same as approvals: `import { GroupsPage } from "@/ui"`) and export `GroupsPage` from `src/ui/index.ts`. The R1 layers allow pages -> ui.
- Tier gate: copy the AuditPage pattern. Use `useSession()`, and when `!atLeastTier(session?.tier, "manager")` render the view in a `forbidden` status without mounting the data hook, so no fetch happens. Check what `canViewAudit` and AuditView `forbidden` render (a no-access message), and add a small `canManageGroups(tier)` helper in `groups-state.ts`. Check whether `shellCopy` or `audit` copy has a reusable "no access" string.

**Differences from Rooms to handle**
- Rooms has a single "Admin" canManage flag. Here the whole page is Manager-only, so there is no read-only mode, and `canManage` disappears from the view.
- Two lists on one page means two data hooks (`useGroups`, `useProjects`) or one `useGroupsData` that loads both. Prefer two instances of one generic hook, `useList(api.listGroups)`, or a single hook with two statuses, so a failure in one list does not block the other.
- Dialog state is a union keyed by entity: `form {kind:"group"|"project", item|null}` and `delete {kind, item}`. Use four dialog components (GroupFormDialog, ProjectFormDialog, and a delete dialog parameterized by kind), or generic ones.
- Color: no color input exists in `EntityFormDialog`. Use a plain `<input type="color">` for groups (it produces `#rrggbb` lowercase, which matches `COLOR_RE`). A group needs a swatch in the list; use an inline `style={{backgroundColor: g.color}}`. This is a value from the server, validated hex, so it is safe. Provide a sensible default color for new groups (for example from a small palette in `group-form.ts`).
- Delete flow: the helper `deleteStep(impact)` becomes `seats + members > 0 ? "forced" : "plain"` for groups and `seats > 0` for projects. `src/lib/groups/delete-impact.ts` already has `decideDelete` and probably a `canDeleteDirectly` equivalent. Check its exports before writing a new one. The impact lines are "N seats" and "N members" (with correct plurals) and the forced confirm tells the user that tags are cleared (not seats deleted). Note for members: confirm what `members` means in the server code (the member's group tag is cleared) and word the copy accordingly.
- Handling `in_use` on forced delete: if `remove(force=false)` returns `in_use`, reload the impact (as in the room flow). Handle `not_found` as done.
- Project code in the form: `codeInput` uppercases while typing. Reuse `codeInput` from `src/ui/rooms/room-form.ts` or inline an uppercase handler. Rename warnings are not needed for projects unless the spec says so (spec GRP-02, not read; check).

**Copy and file plan (per D36)**
- `src/ui/copy/groups.ts`: titles, field labels, field errors (`name`, `color`, `code`, `body`), create and edit and delete texts, empty states per list, impact line functions, retry. Don't reuse `roomsCopy`. `copy.test.ts` may check copy structure; read it for rules (for example no emojis or a naming rule).
- Files under `src/ui/groups/`: `groups-api.ts` (+test), `group-form.ts` (+test: toCreate/toPatch bodies per kind, unchanged detection, field messages), `delete-flow.ts` (+test), `useGroupsData.ts`, `GroupsView.tsx` (+static render test, covers loading/error/empty/ready/forbidden, no buttons in forbidden), `GroupFormDialog.tsx` / `ProjectFormDialog.tsx`, `DeleteGroupDialog.tsx` (+static-render test), `GroupsPage.tsx`, `groups-state.ts` (tier gate).

## Recommendations
1. Build it in the order: api client + tests, form logic + tests, delete-flow + tests, views, dialogs, page, nav/icon/copy/shell, route file, index export. Tie each to the acceptance criteria: list, create, edit, delete (AC1), counts and forced confirm (AC2), tier gate and nav (AC3), static render tests, no jsdom (AC4).
2. Make `GroupsView` pure with props, as in RoomsView, and render the two lists as two Cards with their own `status`, loading skeleton, error retry and empty text. Always show the "New" button per list, because the page is manager-only.
3. Put list filtering and sorting (server order is probably by name; do not re-sort) in the server order and keep the UI dumb.
4. Edit dialogs send only changed fields (reuse the `toPatchBody` approach, `unchanged` just closes).
5. Keep dialogs generic where it is cheap: one `DeleteDialog` with a `kind` prop and a `labelOf(item)`, so the group/project delete flow is not duplicated. The same is true for `GroupsApi` calls.
6. Keep the page client-side only with no new server code (out of scope). Don't touch seat tagging (016.3).
7. Run `pnpm test`, `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` before PASS (R5). Check `.claude/loop.config.md` Checks if more apply.

## Size
This is not one ~400-line slice, but it is one coherent ticket (labelled M). Estimate of source (non-test) lines: api client ~90, form logic ~90, delete flow ~40, hook ~50, GroupsView ~170, two form dialogs ~160, delete dialog ~100, page ~60, copy ~90, nav/icon/shell/index/route ~25. That totals roughly 850-950 source lines, plus tests of about the same size. With generics (a shared list section component, a shared delete dialog, a generic api) it falls to about 600-700. It exceeds 400 either way. A split is possible if the loop's size limit is strict: (a) api client + form logic + delete flow + copy + tests (no UI), then (b) views, dialogs, page, nav. I would not split along groups/projects, since they share almost everything. Decide the limit with Ming (see questions). I recommend keeping it as one ticket with the generics, because the pieces are tightly coupled and each half would be unusable alone.

## Risks
- The DELETE `in_use` path: if the impact loaded in the dialog is stale (someone tags a seat in between), a plain delete gets 409 `in_use`, and the dialog must reload and show the forced step instead of a dead-end error message. Test this.
- Forced delete is destructive for seat tags and member tags, so the submit label and the body must say what is cleared. Button label distinct from the plain one (as in rooms).
- Color input: the browser color input only emits lowercase `#rrggbb`, fine. A hidden risk is text contrast for swatch labels, so show the swatch as a separate dot and keep the name in normal text color.
- Nav tests (`nav.test.ts`, `AppShellView.test.tsx`) will break on the new item if their counts and href lists are not updated. Also the mobile bottom bar gets a 9th item for admins; the ticket says it already scrolls, but check on a narrow viewport during manual testing.
- Icons: adding a name requires keeping `ICON_NAMES` sorted, and the Google Fonts subset URL changes with it.
- The ticket says tier "manager" for the page, while Rooms use "admin" for writes. Admins pass `atLeastTier(manager)`. Confirm `atLeastTier` ordering (user < manager < admin), which is implied by the existing nav items.
- Shared `withAuth` for the 401/403 retry rule (R7) is server-side only and unaffected.

## Open questions
1. Is a ~600-900 line slice acceptable for this M ticket, or does the loop require a split into (a) client/logic and (b) UI?
2. Icon: reuse `group` or add a new Material symbol (e.g. `sell`)? I recommend adding one.
3. Default color for a new group: fixed default or a small palette of preset swatches plus the native picker? Spec GRP-01 may say.
4. Should project codes show a rename warning like room codes (seat tags reference the project by id, so probably not needed)?
5. Do the two lists load independently (recommended), or must the page show a single error state?
6. What does `members` in group impact count (members tagged with the group)? Confirm in `src/server/groups/groups.ts` (`groupImpactOf`) before writing the copy.

Files read: work/tickets/SIM-016.2/ticket.md, src/ui/rooms/{rooms-api,RoomsView,RoomsPage,DeleteRoomDialog,RoomFormDialog,room-form,useRooms,delete-flow}.ts(x), src/ui/audit/AuditPage.tsx, src/lib/{nav,icons}.ts, src/lib/groups/types.ts, src/lib/validate/group.ts, src/app/api/groups/route.ts, src/app/api/groups/[id]/route.ts and delete-impact/route.ts, src/ui/copy/shell.ts (grep), src/ui/index.ts (grep).
