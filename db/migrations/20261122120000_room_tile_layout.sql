-- SIM-015.1 (D43, D48): tile-grid layout. Expand only; the free-form x/y/rotation/w/h columns stay until a later
-- contract migration. Null placement = not placed yet. Footprints, bounds and overlap are checked in src/lib.

alter table rooms
  add column grid_w integer null,
  add column grid_h integer null,
  add column floor_zones jsonb not null default '[]'::jsonb,
  add column layout_version integer not null default 0,
  add constraint rooms_grid_pair_check check (num_nonnulls(grid_w, grid_h) <> 1),
  add constraint rooms_grid_size_check check (grid_w > 0 and grid_h > 0),
  add constraint rooms_floor_zones_check check (jsonb_typeof(floor_zones) = 'array'),
  add constraint rooms_layout_version_check check (layout_version >= 0);

alter table seats
  add column tile_x integer null,
  add column tile_y integer null,
  add column tile_rotation smallint null,
  add column sprite_key text null,
  add constraint seats_tile_placement_check check (num_nonnulls(tile_x, tile_y, tile_rotation, sprite_key) in (0, 4)),
  add constraint seats_tile_xy_check check (tile_x >= 0 and tile_y >= 0),
  add constraint seats_tile_rotation_check check (tile_rotation in (0, 90, 180, 270)),
  add constraint seats_sprite_key_check check (btrim(sprite_key) <> '');

-- kind stays for legacy rows; a tile-placed fixture is identified by sprite_key and stores kind = null.
alter table layout_fixtures
  alter column kind drop not null,
  add column tile_x integer null,
  add column tile_y integer null,
  add column tile_rotation smallint null,
  add column sprite_key text null,
  add constraint layout_fixtures_kind_or_sprite_check check (kind is not null or sprite_key is not null),
  add constraint layout_fixtures_tile_placement_check check (num_nonnulls(tile_x, tile_y, tile_rotation, sprite_key) in (0, 4)),
  add constraint layout_fixtures_tile_xy_check check (tile_x >= 0 and tile_y >= 0),
  add constraint layout_fixtures_tile_rotation_check check (tile_rotation in (0, 90, 180, 270)),
  add constraint layout_fixtures_sprite_key_check check (btrim(sprite_key) <> '');
