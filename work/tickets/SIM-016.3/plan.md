Status: READY

# Plan — SIM-016.3: Tag and untag a seat from the seat detail

## Scope summary
Ticket scope (ticket.md): "A 'Tags' button in the seat panel (`seat-actions.ts` / `SeatActions.tsx`), hidden for the User tier (UX only; the API enforces)." "A small tags dialog with group and project selects in `src/ui/seats/`; `seats-api.ts` method for `PATCH /api/seats/[id]/tags`; copy in `src/ui/copy/seats.ts`." Server fix: "`setSeatTags` (`src/server/seats/seats.ts`) locks the group/project only when it changes to a non-null id, and the 'cannot deadlock' comment in `src/server/groups/groups.ts` is corrected. Add a DB test for tag write vs forced delete if cheap." Out of scope: "Groups/Projects management (SIM-016.2). Any other server or API change."
Spec SEA-04; D36 (UI copy in `src/ui/copy/<feature>.ts`, English).
Cause (SIM-016 review Issue 1, security Note 1): `seats.ts:522` and `:531` lock the group/project `for share` whenever `v.groupId`/`v.projectId` is set, even when it equals the seat's current value. A forced `deleteGroup` holds G `for update` and then wants the seat `for update` (`groups.ts:173`, `:190-195`), so there is a lock cycle (40P01, a 500). The FK already keeps an unchanged reference in place.

Already in place (no work): the panel already shows group and project (`SeatDetailPanel.tsx:89-96`, from `SeatDto.group` / `.project`, `src/lib/seats/types.ts:32-33`). The route `PATCH /api/seats/[id]/tags` exists (`src/app/api/seats/[id]/tags/route.ts`, tier manager, body `{groupId?, projectId?}` each uuid or null, at least one key, 422 `invalid_group` / `invalid_project`, returns SeatDto). `apiErrorMessage` already has `invalid_group` / `invalid_project` (`src/ui/copy/api.ts:46-47`).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A Manager sets and clears a seat's group and project; the seat shows the new tags. | `seats-api.test.ts › setTags` (PATCH, body, SeatDto); `seat-tags.test.ts` (patch building: set, clear, unchanged); `useSeatActions` flow covered by `actionOutcome("setTags", ok)` -> reload. Local run: Manager opens a seat, Tags, picks group+project, Save: panel shows them; Tags again, "No group" / "No project", Save: panel shows "no tag" text. |
| 2 | A tag write on a seat whose group is unchanged no longer locks that group (no deadlock with a forced delete). | `groups.db.test.ts › tag write with unchanged group does not wait on a forced delete's group lock` (`pnpm test:db`). Fails before the fix (blocks until the timeout). |
| 3 | Users see no Tags button. | `seat-actions.test.ts › seatButtons.tags` role matrix (user false, manager/admin true); `SeatActions.test.tsx` role matrix includes the Tags label for manager/admin and not user. |
| 4 | Static-render and pure-logic tests (no jsdom) cover the button rule and the dialog. | `seat-actions.test.ts`, `SeatActions.test.tsx`, `seat-tags.test.ts`, `SeatTagsDialog.test.tsx` (renderToStaticMarkup), all in `pnpm test`. |

## Ming verification after merge
Manual: with real groups/projects in the app, tag and untag a seat as a Manager; confirm a User sees no Tags button.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/seats/seats.ts` (lines 504-556, `setSeatTags`) | Lock group only if `v.groupId && v.groupId !== seat.group_id`; project only if `v.projectId && v.projectId !== seat.project_id`; narrow the comment at `:521` (no lock for an unchanged id; the FK holds it) | Deadlock fix | No (not matched by High paths) |
| `src/server/groups/groups.ts` (comment `:159-164`; same wording at `deleteProject` ~`:336`) | Reword: tag writes do not lock an unchanged group, and the SIM-012 assign vs delete race remains a detected deadlock (500), not impossible | Comment was wrong | No |
| `src/server/groups/groups.db.test.ts` | Add the deadlock-ordering test | AC 2 | No |
| `src/ui/seats/seat-tags.ts` (new) | Pure logic: `tagsPatch(seat, sel)`, `tagOptions(list, current)`, `initialSelection(seat)` | Pure logic first | No |
| `src/ui/seats/seat-tags.test.ts` (new) | Tests of the above | R5 | No |
| `src/ui/seats/SeatTagsDialog.tsx` (new) | Dialog on `EntityFormDialog` + two `DialogSelect`; loads lists via injected `loadGroups` / `loadProjects` (`useList` from `src/ui/groups/useList.ts`); `seat` null = closed (same shape as `CannotSeatDialog`) | Scope | No |
| `src/ui/seats/SeatTagsDialog.test.tsx` (new) | Static render: closed renders nothing; open shows title and both labels | AC 4 | No |
| `src/ui/seats/seats-api.ts` (after `clearCannotSeat`, ~line 140) | `setTags(seatId, tags: {groupId?: string\|null; projectId?: string\|null})` -> `PATCH ${seatPath}/tags`, `json(isSeat)` | Scope | No |
| `src/ui/seats/seats-api.test.ts` | Test for `setTags` | R5 | No |
| `src/ui/seats/seat-actions.ts` | Add `"setTags"` to `SeatAction`; `tags: boolean` in `SeatButtons` (`canAssign(tier)`, i.e. manager or admin); `TagsDialog = {kind: "tags"; seat}`; `actionOutcome`: add `setTags` to the `removeOccupant/setCannotSeat/clearCannotSeat` branch at `:289` (not_found -> `deleteGone` + close panel; else reload + `apiErrorMessage(code)`, which covers `invalid_group` / `invalid_project`) | Button rule and outcome | No |
| `src/ui/seats/seat-actions.test.ts` | Button matrix + outcome cases | R5 | No |
| `src/ui/seats/SeatActions.tsx` | New `onTags` prop; Tags `Button` (tonal, `disabled={busy}`) in the group; add `buttons.tags` to the "any button" condition at `:51-57` | Scope | No |
| `src/ui/seats/SeatActions.test.tsx` | Add `onTags` to `render`; role matrix | AC 3 | No |
| `src/ui/seats/useSeatActions.ts` | Add `TagsDialog` to `SeatDialog`; `requestTags(seat)` (clears notice, opens dialog); `setTags(patch)` via `run("setTags", seat.code, started, () => seatsApi.setTags(...))`; `confirm()` returns early for `kind === "tags"` like `cannotSeat` (`:248`) | Flow | No |
| `src/ui/seats/SeatsPage.tsx` | `useMemo` `createGroupsApi(apiFetch)`; pass `onTags={actions.requestTags}`; render `<SeatTagsDialog seat={dialog?.kind === "tags" ? dialog.seat : null} loadGroups={groupsApi.groups.list} loadProjects={groupsApi.projects.list} ...>` next to `CannotSeatDialog` (`:245`) | Wiring | No |
| `src/ui/copy/seats.ts` (`actions`, near `:74`) | Copy: `tags: "Tags"`, `tagsTitle(code)`, `tagsGroup`, `tagsProject`, `tagsNoGroup`, `tagsNoProject`, `tagsSubmit`, `tagsLoading`, `tagsLoadFailed`, `tagsUnchanged` | D36 | No |

## Data model / migration
None.

## API contract
None (existing `PATCH /api/seats/[id]/tags`, manager tier; request `{groupId?: uuid|null, projectId?: uuid|null}`; 200 SeatDto; 400 `invalid_request`, 404 `not_found`, 422 `invalid_group` / `invalid_project`; unchanged by this ticket).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `groups.db.test.ts › tag write with unchanged group does not wait on a forced delete's group lock` | Seat tagged G; on a separate client, `begin; select id from groups where id = G for update` (what `deleteGroup` holds); `setSeatTags(seat, {groupId: G, projectId: P2})` must resolve (race against a ~3 s timeout) while that lock is held, and the project change is applied; then rollback. Same for an unchanged project. Also: changing to a different group still takes the lock and returns `invalid_group` for an unknown id. |
| `seat-tags.test.ts › tagsPatch` | unchanged -> null; group only; project only; both; clear to null; sends only changed keys |
| `seat-tags.test.ts › tagOptions` | list order kept; the seat's current tag is kept as an option even if missing from the list |
| `seat-actions.test.ts › seatButtons tags` | user false; manager, admin true; null tier false |
| `seat-actions.test.ts › actionOutcome setTags` | ok -> reload, panel stays; `not_found` -> closePanel + deleteGone; `invalid_group` / `invalid_project` -> reload + message; auth code and `invalid_request` -> no reload |
| `seats-api.test.ts › setTags` | PATCH to `/api/seats/<id>/tags`, JSON body as given, ok value, error code, never throws |
| `SeatActions.test.tsx › role matrix` | Tags button shown for manager/admin, hidden for user; disabled when busy |
| `SeatTagsDialog.test.tsx` | `seat={null}` renders nothing; open renders title with seat code, labels, submit |

## Approach
1. Server fix first (smallest, no UI dependency): change the two conditions in `setSeatTags`, reword both comments, add the DB test (use `testPool()` for a second raw client; always `rollback` and release in `finally`). Keep `inTx`, `orgQuery`, audit as is (R6, R7 untouched: no new 401/403).
2. `seat-tags.ts` pure logic and tests: selection is `{groupId: string|null, projectId: string|null}`, initial from `seat.group?.id ?? null`; `tagsPatch` returns only changed keys or `null`.
3. `seats-api.setTags`, copy, `seat-actions.ts` (`tags` rule, `TagsDialog`, outcome), tests.
4. `useSeatActions` (`requestTags`, `setTags`), `SeatActions.tsx` (`onTags`), `SeatTagsDialog.tsx`, wire in `SeatsPage.tsx`.
5. Dialog behaviour: inner component mounts only when open so the lists load fresh each time via `useList`; selects disabled and a loading line while loading; on a list load error show `tagsLoadFailed` and keep submit disabled; the selects have a leading empty option ("No group" / "No project") meaning clear; submitting with no change closes without a request (`tagsPatch` null -> `onClose`). Submit disabled while `submitting`. A failed write closes the dialog via `run` and reports via the panel notice (`invalid_group` text says reload and try again; the reload refreshes the seat).
6. Rules: R1 (ui imports `ui/groups/groups-api` and `lib` only; no server import), R4 (only the files above), R5 (tests above), D36 (copy in `src/ui/copy/seats.ts`). Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`, `pnpm test:db`.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- Hotspots: `seat-actions.ts`, `SeatActions.tsx`, `useSeatActions.ts`, `SeatsPage.tsx` and `copy/seats.ts` are shared with earlier seat tickets (all merged); the backlog shows no other open ticket on them, so no rebase is expected.
- The Tags button uses the Manager-or-Admin rule (`canAssign`), matching the route's `tier: "manager"`.
- Groups and projects are fetched with the existing `GET /api/groups` and `GET /api/projects` (readable by a Manager; SIM-016 contract). If those require a higher tier, the dialog shows `tagsLoadFailed`; the implementer must confirm in `src/app/api/groups/route.ts` and note it in the impl-log.
- The deadlock test relies on Postgres blocking a `for share` on a row held `for update` by another connection; it asserts non-blocking, so it needs no sleeps beyond the timeout guard.
- Lock behaviour when the group is unchanged: if a forced delete commits first, `lockSeat` then sees `group_id` already null, so the id differs from the seat's and is checked (422 `invalid_group`); no stale tag is written.

## Blocking questions
None.

## Split proposal
None (est. 250-350 changed lines including tests).
