# Security review — SIM-046.2

## Attempt 1

**Summary:** PASS from security. I found no blockers and no should-fix items. The Drive file id stays on the server, org scoping and the SIM-050/D69 email hiding are unchanged, Remove photo is enforced on the server for Manager+, and blob URLs are only ever used as `<img src>`.

Caveat: I had no Bash in this run, so I could not run `git diff main`. I checked by reading the files the ticket names and by grepping `src/`, so "unchanged" below means the current code is right, not a diff I compared. I did not re-run the checks either; the impl-log reports them all green.

### Findings

💭 **Drive file id is not exposed (AC3).**
- `src/server/members/manage.ts:123` and `src/server/seats/seats.ts:131` only read `photo_drive_file_id is not null` as a boolean, plus `photo_version`.
- Both `toDto` functions copy fields one by one (manage.ts:91-114, seats.ts:88-110) and never spread the row, so a column added later to the SELECT cannot slip into a response.
- No `select *` or `x.*` remains in non-test server code.
- In `src/ui` and `src/lib`, "drive" only appears in unrelated copy, error codes and tests.
- The photo ETag is `"<memberId>-<version>"` (`src/server/members/photo.ts:198`), so it contains no Drive id either.

💭 **R6 org scoping is kept.**
- `memberSelect` keeps `where m.org_id = $1`, and every correlated subquery repeats `org_id = $1`.
- In `seatRows`, the occupant join is still `left join members o on o.org_id = s.org_id and o.id = s.occupant_id` (seats.ts:149) under `where s.org_id = $1`.
- The new columns come from rows that are already scoped. No new query was added.

💭 **SIM-050 email hiding is not undone.**
- manage.ts:121 still wraps `m.email` in `case when ${visible} then m.email end`, and the device count and refs keep their `visible` gates.
- The new photo columns are not gated, as plan A3 / OQ-58 intends. `hasPhoto` and `photoVersion` are not sensitive, because any member may GET the photo anyway.

💭 **Remove photo is enforced on the server.**
- `DELETE /api/members/[id]/photo` is `withAuth(..., { tier: "manager" })` (`src/app/api/members/[id]/photo/route.ts:44-55`).
- In the UI, the section is only reachable through `EditMemberDialog`, which only opens from the canManage-gated Edit action.
- `EditInner` is keyed by `member.id`, so the local `removed` and `confirming` state cannot carry over to another member.

💭 **Blob and serving safety.**
- `getPhoto` (`src/ui/members/members-api.ts:83-89`) accepts only `image/png` and `image/jpeg` blobs.
- `useMemberPhotos` makes object URLs with `URL.createObjectURL` and revokes them on dispose.
- The URL is only ever used as `<img src>` in `src/ui/Avatar.tsx:39-47`, with an empty alt inside an aria-hidden span. It never becomes a link or an iframe.
- The route headers (`nosniff`, `CSP: sandbox`, `Content-Disposition: inline`, `private, no-cache`) are as before.

💭 **No photos on the map (LAY-06).**
- No file under `src/ui/roomlayout/**`, `src/lib/sprites/**` or `src/server/layout/**` mentions a photo.
- The new components live only in `src/ui/members/**` and `src/ui/seats/{SeatDetailPanel,SeatsPage}.tsx`. Going from ui to ui is allowed under R1.

💭 **R7 is untouched.**
- No route handler was added or changed. The two server changes only add read-only columns to the SELECTs, so they add no new side effect or 401/403 path.
- The existing DELETE returns `forbidden` from the auth wrapper before `removeMemberPhoto` runs.

💭 **Secrets and R3.** No new env access, keys or logging in the changed files.

### Follow-ups (out of scope)
- Plan F1-F4 stand as written.
- F4 (hide Remove photo on one's own card) is UX only, not security. Self-removal is allowed and audited with `self: true`.
- F2 (versioned photo URLs with a long `max-age`): when it lands, keep `private` in `Cache-Control`. Photos sit behind bearer auth and must not end up in a shared cache.
