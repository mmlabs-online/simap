-- SIM-039.7 / D66 (6), DEV-01: a device type may pick a bundled package sprite. Art order on the desk: uploaded image,
-- then this pick, then the slot's built-in sprite. Expand-only: one nullable column, no default, no backfill
-- (null = the slot's built-in sprite); the previous image never selects or writes it, so it keeps working.
-- The value is a sprite family base (e.g. 'device.laptop'); the renderer adds the desk direction for directional
-- families. Same key format as map_items_art_sprite_check (SPRITE_KEY_RE in src/lib/validate/map-item.ts, checked by
-- a test). No FK: keys live in the sprite registry; which families are allowed is checked in src/lib.
alter table device_types
  add column sprite_key text null,
  add constraint device_types_sprite_key_check
    check (sprite_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$');
