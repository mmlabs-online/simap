-- SIM-047: pixel character look (spec POR-06, LAY-06, Member entity; D71). Expand-only: one nullable column, no default,
-- no backfill. null = the look derived from the member (avatarFor(members.id), as the map draws it since SIM-015.1);
-- otherwise preset indices into the avatar ramps in src/lib/sprites/avatar.ts (skin 0-3, hair colour 0-5, shirt 0-6,
-- hair style 1-3). The ramps are append-only; widening one needs a new migration that replaces this check.
-- The previous image never reads or writes the column.
alter table members add column pixel_look jsonb null;
alter table members add constraint members_pixel_look_check check (
  pixel_look is null
  or case when jsonb_typeof(pixel_look) = 'object' then
       pixel_look ?& array['skin', 'hair', 'style', 'shirt']
       and pixel_look - array['skin', 'hair', 'style', 'shirt'] = '{}'::jsonb
       and jsonb_typeof(pixel_look -> 'skin') = 'number' and (pixel_look ->> 'skin') ~ '^[0-3]$'
       and jsonb_typeof(pixel_look -> 'hair') = 'number' and (pixel_look ->> 'hair') ~ '^[0-5]$'
       and jsonb_typeof(pixel_look -> 'style') = 'number' and (pixel_look ->> 'style') ~ '^[1-3]$'
       and jsonb_typeof(pixel_look -> 'shirt') = 'number' and (pixel_look ->> 'shirt') ~ '^[0-6]$'
     else false end
);
