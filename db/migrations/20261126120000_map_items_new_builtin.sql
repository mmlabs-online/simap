-- SIM-042 (D73): new built-in map items (wall clock, desk lamp, water cooler, trash bin, projector screen, flip chart).
-- Expand-only: no table, column, constraint or index changes, no update or delete of existing rows. The new keys are
-- permanent once released (layout_fixtures.sprite_key references them with on delete restrict).

-- 1. New orgs: the seed function now lists all 59 library rows, in LIBRARY_ITEMS order. The members insert trigger and
--    the layout save call it by name, so they pick up this body.
create or replace function map_items_seed(p_org uuid) returns void language plpgsql as $$
begin
  insert into map_item_catalogs (org_id) values (p_org) on conflict (org_id) do nothing;
  if found then
    insert into map_items (org_id, builtin_key, name, group_name, w, h) values
      (p_org, 'desk.single', 'desk single', 'desk', 2, 1),
      (p_org, 'bin.trash', 'bin trash', 'bin', 1, 1),
      (p_org, 'cabinet.filing', 'cabinet filing', 'cabinet', 1, 1),
      (p_org, 'chart.flip', 'chart flip', 'chart', 1, 1),
      (p_org, 'elevator', 'elevator', 'circulation', 2, 2),
      (p_org, 'stairs', 'stairs', 'circulation', 2, 2),
      (p_org, 'clock.wall', 'clock wall', 'clock', 1, 1),
      (p_org, 'cooler.water', 'cooler water', 'cooler', 1, 1),
      (p_org, 'door', 'door', 'door', 1, 2),
      (p_org, 'label.sign', 'label sign', 'label', 1, 1),
      (p_org, 'lamp.desk', 'lamp desk', 'lamp', 1, 1),
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
      (p_org, 'screen.projector', 'screen projector', 'screen', 2, 1),
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

-- 2. Orgs seeded before this migration get the six new rows once. A row already named like a new default
--    name (case- and whitespace-insensitive, e.g. an admin renamed another item) gets "<name> (built-in)". The conflict
--    target is the primary key only, so a second name clash raises 23505 and aborts the migration (no silent skip).
insert into map_items (org_id, builtin_key, name, group_name, w, h)
select c.org_id, v.builtin_key,
       case when exists (select 1 from map_items m
                         where m.org_id = c.org_id and device_type_key(m.name) = device_type_key(v.name))
            then v.name || ' (built-in)' else v.name end,
       v.group_name, v.w, v.h
  from map_item_catalogs c
 cross join (values
        ('bin.trash', 'bin trash', 'bin', 1, 1),
        ('chart.flip', 'chart flip', 'chart', 1, 1),
        ('clock.wall', 'clock wall', 'clock', 1, 1),
        ('cooler.water', 'cooler water', 'cooler', 1, 1),
        ('lamp.desk', 'lamp desk', 'lamp', 1, 1),
        ('screen.projector', 'screen projector', 'screen', 2, 1)
      ) as v(builtin_key, name, group_name, w, h)
    on conflict (org_id, builtin_key) do nothing;
