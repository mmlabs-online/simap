-- SIM-039.1 / D66 / D67: per-org map item catalog (one row per library item and org), the per-org seed, and foreign
-- keys from placed seats and fixtures to it. Expand-only: new tables, a function, a trigger, two foreign keys and an
-- index on the existing sprite_key columns; no column is added, dropped, renamed or retyped. The art columns exist now
-- so the item slices (SIM-039.2, SIM-039.4) need no further migration.

create table map_items (
  org_id uuid not null,
  builtin_key text not null,
  name text not null,
  group_name text not null,
  w smallint not null,
  h smallint not null,
  hidden boolean not null default false,
  art_n_sprite text null,
  art_e_sprite text null,
  art_s_sprite text null,
  art_w_sprite text null,
  art_n_drive_file_id text null,
  art_e_drive_file_id text null,
  art_s_drive_file_id text null,
  art_w_drive_file_id text null,
  art_n_image_version integer not null default 0,
  art_e_image_version integer not null default 0,
  art_s_image_version integer not null default 0,
  art_w_image_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_items_pkey primary key (org_id, builtin_key),
  constraint map_items_builtin_key_check
    check (builtin_key ~ '^[a-z0-9]+(\.[a-z0-9]+)*$' and char_length(builtin_key) <= 100),
  constraint map_items_name_check check (btrim(name) <> '' and char_length(name) <= 60),
  constraint map_items_group_name_check check (btrim(group_name) <> '' and char_length(group_name) <= 40),
  constraint map_items_size_check check (w between 1 and 4 and h between 1 and 4),
  constraint map_items_art_sprite_check check (
    art_n_sprite ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'
    and art_e_sprite ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'
    and art_s_sprite ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'
    and art_w_sprite ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'),
  constraint map_items_art_image_check check (
    art_n_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'
    and art_e_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'
    and art_s_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'
    and art_w_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  constraint map_items_art_image_version_check check (
    art_n_image_version >= 0 and art_e_image_version >= 0
    and art_s_image_version >= 0 and art_w_image_version >= 0)
);
-- Same name rule as device types (case- and whitespace-insensitive, LAY-07).
create unique index map_items_org_name_key on map_items (org_id, device_type_key(name));

-- One row per org whose catalog was seeded: seeding happens once per org. Also the per-org row later tickets lock.
create table map_item_catalogs (
  org_id uuid primary key,
  seeded_at timestamptz not null default now()
);

create function map_items_seed(p_org uuid) returns void language plpgsql as $$
begin
  insert into map_item_catalogs (org_id) values (p_org) on conflict (org_id) do nothing;
  if found then
    insert into map_items (org_id, builtin_key, name, group_name, w, h) values
      (p_org, 'desk.single', 'desk single', 'desk', 2, 1),
      (p_org, 'cabinet.filing', 'cabinet filing', 'cabinet', 1, 1),
      (p_org, 'elevator', 'elevator', 'circulation', 2, 2),
      (p_org, 'stairs', 'stairs', 'circulation', 2, 2),
      (p_org, 'door', 'door', 'door', 1, 2),
      (p_org, 'label.sign', 'label sign', 'label', 1, 1),
      (p_org, 'lamp.floor', 'lamp floor', 'lamp', 1, 1),
      (p_org, 'marker.blocked', 'marker blocked', 'marker', 1, 1),
      (p_org, 'partition.glass', 'partition glass', 'partition', 1, 1),
      (p_org, 'plant.large', 'plant large', 'plant', 1, 1),
      (p_org, 'plant.small', 'plant small', 'plant', 1, 1),
      (p_org, 'prop.keyboard', 'prop keyboard', 'prop', 1, 1),
      (p_org, 'prop.mouse', 'prop mouse', 'prop', 1, 1),
      (p_org, 'prop.mug', 'prop mug', 'prop', 1, 1),
      (p_org, 'prop.papers', 'prop papers', 'prop', 1, 1),
      (p_org, 'rack.server', 'rack server', 'rack', 1, 1),
      (p_org, 'shelf.books', 'shelf books', 'shelf', 2, 1),
      (p_org, 'sofa', 'sofa', 'sofa', 2, 1),
      (p_org, 'table.coffee', 'table coffee', 'table', 2, 1),
      (p_org, 'table.meeting', 'table meeting', 'table', 3, 2),
      (p_org, 'wall.base', 'wall base', 'wall', 1, 1),
      (p_org, 'wall.corner.ne', 'wall corner ne', 'wall', 1, 1),
      (p_org, 'wall.corner.ne.face', 'wall corner ne face', 'wall', 1, 1),
      (p_org, 'wall.corner.nw', 'wall corner nw', 'wall', 1, 1),
      (p_org, 'wall.corner.nw.face', 'wall corner nw face', 'wall', 1, 1),
      (p_org, 'wall.corner.se', 'wall corner se', 'wall', 1, 1),
      (p_org, 'wall.corner.sw', 'wall corner sw', 'wall', 1, 1),
      (p_org, 'wall.face', 'wall face', 'wall', 1, 1),
      (p_org, 'wall.face.shade', 'wall face shade', 'wall', 1, 1),
      (p_org, 'wall.front', 'wall front', 'wall', 1, 1),
      (p_org, 'wall.front.end.e', 'wall front end e', 'wall', 1, 1),
      (p_org, 'wall.front.end.w', 'wall front end w', 'wall', 1, 1),
      (p_org, 'wall.inner.h.end.w', 'wall inner h end w', 'wall', 1, 1),
      (p_org, 'wall.inner.h.end.w.face', 'wall inner h end w face', 'wall', 1, 1),
      (p_org, 'wall.inner.v', 'wall inner v', 'wall', 1, 1),
      (p_org, 'wall.inner.v.end', 'wall inner v end', 'wall', 1, 1),
      (p_org, 'wall.side.e', 'wall side e', 'wall', 1, 1),
      (p_org, 'wall.side.w', 'wall side w', 'wall', 1, 1),
      (p_org, 'wall.side.w.end', 'wall side w end', 'wall', 1, 1),
      (p_org, 'wall.side.w.start', 'wall side w start', 'wall', 1, 1),
      (p_org, 'wall.t.e', 'wall t e', 'wall', 1, 1),
      (p_org, 'wall.t.s', 'wall t s', 'wall', 1, 1),
      (p_org, 'wall.t.s.face', 'wall t s face', 'wall', 1, 1),
      (p_org, 'wall.top', 'wall top', 'wall', 1, 1),
      (p_org, 'whiteboard', 'whiteboard', 'whiteboard', 2, 1),
      (p_org, 'window.double', 'window double', 'window', 2, 1),
      (p_org, 'window.single', 'window single', 'window', 1, 1),
      (p_org, 'window.single.top', 'window single top', 'window', 1, 1),
      (p_org, 'floor.carpet', 'floor carpet', 'floor', 1, 1),
      (p_org, 'floor.carpet.alt', 'floor carpet alt', 'floor', 1, 1),
      (p_org, 'floor.lavender', 'floor lavender', 'floor', 1, 1),
      (p_org, 'floor.wood', 'floor wood', 'floor', 1, 1),
      (p_org, 'chair.office', 'chair office', 'chair', 1, 1)
    on conflict do nothing;
  end if;
end $$;

-- Every path that creates a member (first visit, invitations, the dev seeder, the previous image) seeds its org.
create function members_seed_map_items() returns trigger language plpgsql as $$
begin
  perform map_items_seed(new.org_id);
  return null;
end $$;
create trigger members_seed_map_items_trg after insert on members
  for each row execute function members_seed_map_items();

-- Step 1: orgs that exist before this migration. Every org with a placed item has a room.
select map_items_seed(o.org_id)
  from (select org_id from members
        union select org_id from rooms
        union select org_id from seats
        union select org_id from devices
        union select org_id from groups
        union select org_id from device_type_catalogs) o;

-- Step 2: a placement whose key has no catalog row is one the layout read already drops (resolveLayout), so the
-- foreign keys below cannot change how any room looks. Such a fixture is deleted; such a seat stays (with its
-- occupant and devices) and goes back to the waiting list. Legacy fixtures (sprite_key null) are untouched.
delete from layout_fixtures f
  where f.sprite_key is not null
    and not exists (select 1 from map_items m where m.org_id = f.org_id and m.builtin_key = f.sprite_key);
update seats s
  set tile_x = null, tile_y = null, tile_rotation = null, sprite_key = null
  where s.sprite_key is not null
    and not exists (select 1 from map_items m where m.org_id = s.org_id and m.builtin_key = s.sprite_key);

-- Step 3: placed items reference their catalog row (D67 3); items are never deleted, so restrict.
alter table layout_fixtures add constraint layout_fixtures_map_item_fkey
  foreign key (org_id, sprite_key) references map_items (org_id, builtin_key) on delete restrict;
alter table seats add constraint seats_map_item_fkey
  foreign key (org_id, sprite_key) references map_items (org_id, builtin_key) on delete restrict;
create index layout_fixtures_org_sprite_idx on layout_fixtures (org_id, sprite_key) where sprite_key is not null;
