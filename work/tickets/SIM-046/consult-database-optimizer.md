# Consult — database-optimizer — SIM-046

## Findings
- Precedent: `device_types` (20261124160000) stores `image_drive_file_id text null` + `image_version integer not null default 0`, with named checks `device_types_image_check` (regex `^[A-Za-z0-9_-]{10,200}$`) and `device_types_image_version_check` (>= 0). `map_items` repeats this per direction. Services (`src/server/device-types/image.ts`): validate header first, then Drive upload, then a single UPDATE (`image_version + 1`, audit) in one transaction. Only after COMMIT is the OLD file deleted, best-effort. A failure logs `drive_orphan` with the id only. The ETag is `"<id>-<image_version>"`, served `private, no-cache`.
- `members` already has `profile_confirmed_at` (20261120190000). The spec Member entity (line 130) lists photo as "stored file reference" and the pixel character as "preset part per layer: skin, hair colour, hair style, shirt colour". Null character means the look derived from `sub`.
- `members` has an AFTER INSERT trigger that seeds device types and map items. Adding nullable columns does not affect it, and the previous image never selects or writes the new columns.
- `scripts/schema-check.mjs`: check 2 verifies that every unique key/index includes org_id. Per-migration checks are numbered (for example "9 negative image_version refused (23514 device_types_image_version_check)"). It also has a stage check that old data survives. It does not need `members` columns registered, because the table-count list covers row counts only. A photo column with no new index or FK triggers no org rule.
- The latest migration timestamp is 20261126120000 (map_items_new_builtin).

## Recommendations
1. Migration `2026112613xxxx_members_photo.sql`, expand-only:
```sql
alter table members
  add column photo_drive_file_id text null,
  add column photo_version integer not null default 0,
  add constraint members_photo_check check (photo_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add constraint members_photo_version_check check (photo_version >= 0);
```
   A constant default on `photo_version` does not rewrite the table (PG 11+). No new index and no FK, so R6 is met by `members.org_id` and the existing `(org_id, id)` key. No backfill. Header comment as in the sprite migration: previous image never touches the columns.
2. Service (`src/server/members/photo.ts`), mirrored from `device-types/image.ts`:
   - Replace: validate the bytes (OQ-56) before any DB or Drive call. Select the old id with `where org_id = $1 and id = $2 for update`. Upload to Drive with a server-chosen name (for example `member-photo-<uuid>`) in the org folder. Run the UPDATE (`photo_version + 1`), the audit row (meta: version, size, mime, no bytes) and COMMIT. Then delete the old file best-effort.
   - Remove: set null and bump the version, audit, COMMIT, then delete the old file. If the upload succeeds but the DB step fails, delete the new file or log `drive_orphan`.
   - Orphan log: use `memberId` only. Extend the log shape, or share the helper in `src/server/drive/**`.
   - Keep the file id out of every API response. Expose `has_photo` and `photoVersion` only (as `device_types` exposes `has_image`).
   - ETag `"<memberId>-<photo_version>"`. Serve only the same-org member's photo, scoped by token `org`. Return 404 for another org's member, and a 404 when there is no photo.
   - Do not delete the Drive file on member delete or deactivation unless the member service already does so. Add cleanup in the member delete path (post-commit, best-effort) if members can be hard-deleted. Check this.
3. Migration ordering with SIM-047. The character is a separate concern, so give it its own migration with a later timestamp. Recommended split:
   - SIM-046 owns `members_photo` and takes the earlier timestamp (for example 20261126130000).
   - SIM-047 owns `members_pixel_character`, with a later timestamp (for example 20261126140000).
   - Neither edits the other's migration, and neither depends on the other's columns.
   - Reserve the timestamps in the batch plan before either branch is opened. After the first PR merges, the second rebases. Because both only add disjoint nullable columns, there is no semantic conflict, only a filename/order choice.
   - Check that the migrator tolerates a later-merged file with an earlier timestamp than an already applied one. If it refuses, the later-merging PR must rename its file to a timestamp after the applied one. Verify in `db/migrate.js`, which I have not read.
   - Do not touch `src/server/members/**` shared select lists in conflicting ways. Both tickets extend the member row mapper and the `README.md` schema section, so expect trivial textual conflicts. Merge SIM-046 first (it is listed first), then rebase SIM-047.
4. schema-check: add a new numbered block:
   - A photo id that is too short is refused with `members_photo_check` (23514).
   - A negative `photo_version` is refused with `members_photo_version_check`.
   - A valid id is accepted.
   - Existing members get a null photo and version 0 (stage check).
   - `pnpm test:db` tests for the replace/remove flow, run against a fake Drive as in `device-types/image.db.test.ts`.
5. Add a `README.md` bullet in `db/migrations/README.md` following the existing entries. It should note that the columns are nullable, there is no FK, and Drive deletion happens post-commit.
6. Permissions (OQ-61 default): the member may upload, replace and remove their own photo. Manager+ may remove another member's photo (audited, actor and target ids) but not upload. A cross-member remove stays inside the caller's org. Auth codes (401/403) come only from the auth wrapper, before any side effect (R7). Domain refusals use 422.

## Risks
- Orphans in Drive after post-commit delete failures. This is accepted precedent, logged only, with no sweeper.
- Concurrent replace by the same member: `for update` on the member row serialises the swap, so the old id is deleted exactly once.
- Hard-deleting a member may leave the photo file behind unless the delete path handles it.
- Two migrations touching `members` on one batch, as covered above. Same-timestamp collision is the worst case, so reserve distinct timestamps.
- High path (migration) means the plan gate needs Ming's approval.
- The 256 KB size cap is checked by the server. Dimension and animation checks need a hand-written PNG/JPEG header parser, since there is no image library.

## Open questions
- Does `db/migrate.js` accept a new file whose timestamp is earlier than an already applied migration (ordering policy)? I did not verify it.
- Can members be hard-deleted or only deactivated? This decides whether the delete path needs file cleanup.
- Is the Drive folder per org or one root with org-scoped names? Check `src/server/drive/**` and mirror what device types do.
- OQ-56, OQ-57 and OQ-61: accept the defaults at the plan gate, or does Ming have different answers?
- Should the DB column names be `photo_*` and SIM-047's `character_*` or a single jsonb? The decision belongs to the SIM-047 consult (a nullable jsonb with a check is easy, but per-column checks suit the "server accepts only preset values" rule better).

Files read: `work/tickets/SIM-046/ticket.md`, `db/migrations/20261124160000_device_types.sql`, `db/migrations/20261125230000_device_type_sprite.sql`, `db/migrations/README.md`, `scripts/schema-check.mjs`, `src/server/device-types/image.ts`, `docs/spec-v1.md` (lines 130, 581-599, 826-847).
