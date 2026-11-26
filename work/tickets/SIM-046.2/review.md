## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (924 files)
- `pnpm typecheck` — exit 0 (`next typegen && tsc --noEmit`, route types generated)
- `pnpm check:layers` — exit 0, "check-layers: 869 files, no violations"
- `pnpm test` — exit 0, "Test Files 330 passed | 1 skipped (331)", "Tests 3306 passed | 9 skipped (3315)"
- `pnpm build` — exit 0
- `pnpm test:db` (local Postgres, throwaway DB) — exit 0, "Test Files 22 passed (22)", "Tests 344 passed (344)"

All results match impl-log attempt 1.

### Acceptance criteria
- [x] Members list, member card and seat panel show the member's photo, or initials when there is none or loading fails. Evidence:
  - `MembersView.test.tsx` › "row shows the photo img when photoUrl returns a url, initials otherwise"
  - `MemberPhotoSection.test.tsx` › "shows the photo img (alt empty) when photoUrl is set; initials when null"
  - `SeatDetailPanel.test.tsx` › "occupant row shows the photo img when occupantPhoto is set; initials otherwise; vacant seat shows no avatar"
  - `member-photos.test.ts` › the cache test (no photo means no load, failed load gives null, a version bump revokes the old URL)
  - `members-api.test.ts` › getPhoto (png/jpeg ok, text/html gives internal, 404 gives not_found)
  - Wiring: `src/ui/members/MembersPage.tsx` (`useMemberPhotos(api, members.items)`) and `src/ui/seats/SeatsPage.tsx` (occupant cache; the hook runs before any return, and the memo is keyed by id/hasPhoto/photoVersion)
  - All tests pass.
- [x] A Manager+ can remove another member's photo from the member card, and a User does not see the action. Evidence:
  - `MemberPhotoSection.test.tsx` › "Remove photo button only when hasPhoto; aria-label names the member"
  - `MembersView.test.tsx` › "canManage=false: no Edit action, so no member card with Remove photo"
  - `member-photos.test.ts` › removePhotoOutcome (a 404 counts as removed)
  - `members-api.test.ts` › removePhoto (sends DELETE; 204 gives ok, 403 gives forbidden)
  - Server-side 403 for a User is already covered by SIM-046 `photo-routes.test.ts`.
  - `EditMemberDialog` keys `EditInner` by `member.id`, so the local `removed` state resets for each member.
- [x] No Drive file id is exposed in any response. Evidence:
  - The SQL selects only `photo_drive_file_id is not null` as a boolean (`src/server/members/manage.ts` memberSelect, `src/server/seats/seats.ts` seatRows).
  - Unit tests: `manage.test.ts` › "memberSelect projects has_photo and photo_version, never the Drive file id column" and `seats.test.ts` › "seatRows projects occupant photo fields, never the Drive file id column".
  - DB tests: `manage.db.test.ts` › "photo fields: list and detail carry hasPhoto/photoVersion; JSON has no Drive id" (checked as user and as manager) and `seats.db.test.ts` › "occupant photo fields; JSON has no Drive id". Both pass in my `pnpm test:db` run.
- [x] All Checks pass. See above.

Ming verification after merge (not verified here; carry these on the PR):
- Hosted (real Drive), as a Manager:
  - Members with a photo show it in their Members row; others show initials.
  - The seat panel shows the occupant's photo.
  - Edit -> Remove photo -> confirm makes the member fall back to initials, and an audit row `member.photo_remove` exists.
- As a User: Members shows photos, and there is no Edit, so there is no Remove photo.

### Issues
None.

### Scope
- Every changed file is in the plan's file list, with these notes:
  - `src/ui/devices/place-device.test.ts` is out of plan but justified in impl-log. It is fixture-only: two fields added because typecheck flagged it, which the plan's fallout row allows.
  - `src/ui/seats/SeatActionDialogs.test.tsx` is in the plan but was not changed. That is fine, since typecheck passes without it.
- `src/ui/Avatar.tsx` is byte-identical to `origin/ticket/SIM-046.1` (`git diff HEAD origin/ticket/SIM-046.1 -- src/ui/Avatar.tsx` is empty). `Avatar.test.tsx` is left to SIM-046.1, as plan A2 says.
- No High path changed. No file changed under `src/server/layout/**`, `src/lib/sprites/**` or `src/ui/roomlayout/**`, so LAY-06 holds.

### Rules (CLAUDE.md)
No violations found.
- R1: new ui files import only ui/lib, and `check:layers` is clean.
- R6: the new columns come from the existing org-scoped `members m` / `members o` joins.
- R7: no new routes and no new auth paths.
- R3: no config changes.
- R5: the new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- The `onError` fallback in `Avatar` cannot be tested without a DOM (the repo has none). This was accepted in the plan, and failed loads are covered at the cache level.
- `SeatsPage.tsx`: the `occupantItems` memo leaves `occupant` out of its deps on purpose (value-keyed, with a comment). This is fine as long as `PhotoRef` only needs id/hasPhoto/photoVersion.
- `MemberPhotoSection` gets the dialog's snapshot `member` (still `hasPhoto: true` after removal). The local `removed` flag covers this until the dialog is reopened from the reloaded list.

### Follow-ups (out of scope)
- Plan F1-F4:
  - F1: photo fields on the search, requests, dashboard and device owner shapes.
  - F2: versioned photo URLs with a long max-age.
  - F3: a pixel-head fallback after SIM-047.
  - F4: hide Remove photo on one's own card once the session carries the member id.
