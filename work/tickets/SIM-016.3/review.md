# Review — SIM-016.3: Tag and untag a seat from the seat detail

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, all 589 files formatted.
- `pnpm typecheck && pnpm check:layers` — exit 0 / exit 0, check-layers: 535 files, no violations.
- `pnpm test` — exit 0, 207 files passed, 2124 passed | 3 skipped.
- `pnpm build` — exit 0.
- `pnpm test:db` (local compose Postgres, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`) — exit 0, 10 files, 136 tests passed.
- Fail-before-fix check, run by the reviewer: a scratch copy of HEAD with `src/server/seats/seats.ts` taken from `origin/main`, running `vitest run -c vitest.db.config.ts src/server/groups/groups.db.test.ts`, exited 1. The output was `× tag write with unchanged group does not wait on a forced delete's lock 3063ms` and `× … unchanged project … 3052ms` (`expected Symbol(timeout) not to be Symbol(timeout)`), with 2 failed and 8 passed. The repo itself was not touched. This matches impl-log.

### Acceptance criteria
- [x] A Manager sets and clears a seat's group and project, and the seat shows the new tags. Evidence:
  - `seats-api.test.ts › setTags: PATCH with the given body` checks the path `/api/seats/s%2F1/tags`, the PATCH method, the JSON body, the SeatDto value, and the 422 and forbidden codes.
  - `seat-tags.test.ts › tagsPatch` covers set, clear to null, only changed keys, and unchanged -> null.
  - `seat-actions.test.ts › actionOutcome new actions` (now including `setTags`) shows that success reloads. The panel renders `SeatDto.group`/`.project` from that reload.
  - The wiring is in `SeatsPage.tsx:255-262` and `useSeatActions.ts:205-215`.
  - Manual tagging is listed for Ming below.
- [x] A tag write on a seat whose group is unchanged no longer locks that group, so it cannot deadlock with a forced delete. Evidence:
  - The new guards are at `src/server/seats/seats.ts:523` and `:532` (`v.groupId && v.groupId !== seat.group_id`, and the same for the project).
  - `groups.db.test.ts › tag write with unchanged group|project does not wait on a forced delete's lock` passes on HEAD and failed on origin/main's code (above).
  - `› changing to a different group still checks it` returns 422 `invalid_group`.
  - The `deleteGroup` comment is corrected at `groups.ts:159-166`.
- [x] Users see no Tags button. Evidence: `seat-actions.test.ts › seatButtons tags` (null/undefined/user false, manager/admin true) and `SeatActions.test.tsx › Tags button: manager and admin only; disabled when busy`.
- [x] Static-render and pure-logic tests, with no jsdom, cover the button rule and the dialog. Evidence: `SeatTagsDialog.test.tsx` uses `renderToStaticMarkup` to check that a closed dialog renders nothing and an open one shows the title, labels, empty options and submit. The other tests are `seat-tags.test.ts`, `seat-actions.test.ts` and `SeatActions.test.tsx`.

Ming verification after merge (not verified here; carry to the PR): with real groups and projects, tag and untag a seat as a Manager, and confirm that a User sees no Tags button.

### Correctness of the server fix
- **Unchanged id with a forced delete in progress.** The tag write holds the seat `for share` (`lockSeat(..., "share")`) and takes no group lock. The `update seats` sets `group_id` to the same value, so Postgres skips the FK check and takes no key-share lock on the group. The delete's `select … seats … for update` waits for the tag write to commit, then clears the seat. There is no lock cycle, and the end state is consistent.
- **Delete committed first.** `lockSeat` sees `group_id` null, so the requested id counts as a change. It is checked and gets 422 `invalid_group`, and no stale tag is written.
- **R6.** Every changed id still goes through `orgQuery` with the org scope. An unchanged id is bound to the same org by the composite FK, which agrees with security-review 🟢1.

### Deviations in impl-log
1. **`ListLoader` type lives in `seat-tags.ts`, not `SeatTagsDialog.tsx`. Accepted.** It is type-only and sits in a file the plan already lists. The reason given checks out: the `JSX_TEXT` regex in `src/ui/copy/no-literals.test.ts:9` would match `=> Promise<` in a `.tsx` file as JSX text. No scope change.
2. **No `tagsUnchanged` copy. Accepted.** Plan step 5 already says that an unchanged submit closes without a request (`tagsPatch` null -> `onClose`, `SeatTagsDialog.tsx:56-58`), so the string would never be shown. Leaving out dead copy is the smaller diff.
3. **Save stays enabled while the lists load or fail to load. Accepted as a nit.** This differs from plan step 5, but nothing is written in that state:
   - Both selects are disabled while loading or after a failure (`SeatTagsDialog.tsx:64`, `:76`), so the selection still equals `initialSelection(seat)`.
   - `tagsPatch` then returns null, and Save only closes the dialog. No request is sent and no wrong write is possible.
   - `EntityFormDialog` has no separate submit-disabled prop. Its `submitting` prop would relabel the button "Saving", which is misleading. Adding a prop would mean an out-of-plan change to a shared component.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new UI imports only `ui/**` and `@/lib/**`, and check:layers is clean.
- R4: every changed file is in the plan's list.
- R5: new logic has tests.
- R6 and R7: there is no new 401/403, and the route is unchanged.
- D36: the copy is in `src/ui/copy/seats.ts`.

### Blockers from review agents
None. `security-review.md` Attempt 1 has no 🔴 or 🟡 findings.

### Nits (do not block)
- `SeatTagsDialog.tsx:50-64`: while the lists load or after a load error, Save just closes the dialog. Passing a disabled state to the submit button would be clearer, but it needs a small `EntityFormDialog` prop (a later ticket).
- `SeatTagsDialog.test.tsx` renders only the loading state, because effects do not run in a static render. Option rendering is covered only through the `tagOptions` pure tests.
- `SeatsPage.tsx:10`: the `createGroupsApi` import sits between `requests-api` and `rooms-api`, out of alphabetical order (cosmetic).

### Follow-ups (out of scope)
- The SIM-012 member-group assign vs group delete race can still deadlock, with Postgres detecting it as 40P01 and one side getting a 500. The comment now documents this; a fix needs its own ticket.
- Optional: add a submit-disabled prop to `EntityFormDialog` for dialogs whose data is still loading.
