-- SIM-046 / D71, POR-05, OQ-56: a member's profile photo is a Drive file in the org folder, like device type images
-- (SIM-036.5). Expand-only: one nullable column and one integer with a constant default (no table rewrite on PG 11+),
-- no backfill, no index, no FK. The previous image never selects or writes these columns, so it keeps working.
-- The MIME type is not stored: the server re-reads it from the bytes (PNG or JPEG) on every GET.
alter table members
  add column photo_drive_file_id text null,
  add column photo_version integer not null default 0,
  add constraint members_photo_check check (photo_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add constraint members_photo_version_check check (photo_version >= 0);
