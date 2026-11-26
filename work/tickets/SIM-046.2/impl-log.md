# Impl log — SIM-046.2

## Attempt 1 — 2026-11-26

### Avatar overlap (plan A2)
`src/ui/Avatar.tsx` was made byte-identical to `origin/ticket/SIM-046.1` (`git show origin/ticket/SIM-046.1:src/ui/Avatar.tsx > src/ui/Avatar.tsx`), so the later rebase is conflict-free. `src/ui/Avatar.test.tsx` was NOT created (SIM-046.1 adds it). Avatar cases are covered in my own tests (`MemberPhotoSection.test.tsx`, `MembersView.test.tsx`, `SeatDetailPanel.test.tsx`).

### Files touched
| File | Required because |
|---|---|
| `src/ui/Avatar.tsx` | Same content as SIM-046.1's branch (`src` prop, initials fallback on error); needed for AC1 |
| `src/lib/members/types.ts`, `src/lib/seats/types.ts` | `hasPhoto`/`photoVersion` on `MemberDto` and seat `occupant` |
| `src/server/members/manage.ts` | `memberSelect` projects `has_photo`, `photo_version` (never the Drive id); `toDto` |
| `src/server/seats/seats.ts` | `seatRows` projects occupant photo fields; `toDto` |
| `src/ui/members/members-api.ts` | `getPhoto`, `removePhoto` |
| `src/ui/members/member-photos.ts` (new) | Pure helpers: `toImageEntry`, `photoLoader`, `removePhotoOutcome` |
| `src/ui/members/useMemberPhotos.ts` (new) | Hook over `createImageUrlCache` |
| `src/ui/members/MemberPhotoSection.tsx` (new) | Member card photo block with confirm-to-remove |
| `src/ui/members/EditMemberDialog.tsx` | Renders the photo section; new props |
| `src/ui/members/MembersView.tsx`, `MembersPage.tsx` | Avatar in name cell; cache wiring; reload after removal |
| `src/ui/seats/SeatDetailPanel.tsx`, `SeatsPage.tsx` | Occupant avatar; own cache instance for the occupant |
| `src/ui/copy/members.ts` | `photo` copy (D36) |

### Tests added / changed
- `manage.test.ts` › "memberSelect projects has_photo and photo_version, never the Drive file id column"
- `seats.test.ts` › "seatRows projects occupant photo fields, never the Drive file id column"
- `manage.db.test.ts` › "photo fields: list and detail carry hasPhoto/photoVersion; JSON has no Drive id"
- `seats.db.test.ts` › "occupant photo fields; JSON has no Drive id" (and the existing occupant `toEqual` gets the two fields)
- `member-photos.test.ts` (new): toImageEntry, photoLoader, cache behaviour, removePhotoOutcome
- `MemberPhotoSection.test.tsx` (new): photo/initials, Remove photo only with a photo, aria-label with diacritics
- `members-api.test.ts` › getPhoto, removePhoto
- `MembersView.test.tsx` › photo row, canManage=false has no Edit / Remove photo
- `SeatDetailPanel.test.tsx` › occupant photo, initials, vacant seat
- Fixture-only fallout (two fields added, no assertion change): `member-form.test.ts`, `SeatActions.test.tsx`, `SeatsView.test.tsx`, `seat-actions.test.ts`, `PlaceDeviceDialog.test.tsx`, `place-device.test.ts` (the last one was flagged by typecheck, not listed in the plan), plus `manage.test.ts` / `seats.test.ts` row fixtures.
- Note: the `onError` fallback of Avatar is not exercised (no DOM); failed loads are covered at the cache level.

### Checks (actual output summary)
- format / format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0 (`next typegen && tsc --noEmit`)
- check:layers: "869 files, no violations"
- test: Test Files 330 passed | 1 skipped (331); Tests 3306 passed | 9 skipped (3315)
- build: exit 0
- test:db (local Postgres): Test Files 22 passed (22); Tests 344 passed (344)

### Out-of-plan files
- `src/ui/devices/place-device.test.ts` — fixture literals (`owner`, `other`) flagged by typecheck; two fields added, as the plan allows for further flagged fixtures.

### Follow-ups (noticed, not done)
- Plan F1-F4 (photo on search/requests/dashboard/device owner shapes; versioned photo URLs; pixel-head fallback after SIM-047; hide Remove photo on own card).

### Scope self-check
- Could the diff be smaller? No; product changes are the planned minimum, the rest is tests and fixtures.
- Nothing under `src/server/layout/**`, `src/lib/sprites/**`, `src/ui/roomlayout/**` changed.
