-- SIM-036.2 / D61: per-org device type catalog. Expand-only: new objects, no change to existing tables. The image
-- columns exist now so the image slice (SIM-036.5) needs no further migration.

-- The one definition of "same type name" (D61): ASCII whitespace runs collapsed, trimmed, Vietnamese capitals
-- lowered by an explicit map (independent of the DB locale), then lower(). No unaccent: "May" and "Máy" differ.
-- The literals equal VI_UPPER / VI_LOWER in src/lib/device-types/name.ts (checked by a test).
create function device_type_key(t text) returns text
  language sql immutable strict parallel safe
  as $$ select lower(translate(btrim(regexp_replace(t, '[ \t\n\v\f\r]+', ' ', 'g')),
                               'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ',
                               'àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ')) $$;

create table device_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  slot text not null,
  image_drive_file_id text null,
  image_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_types_org_id_key unique (org_id, id),
  constraint device_types_name_check check (btrim(name) <> '' and char_length(name) <= 60),
  constraint device_types_slot_check check (slot in ('monitor', 'laptop', 'pc', 'phone', 'other')),
  constraint device_types_image_check check (image_drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  constraint device_types_image_version_check check (image_version >= 0)
);
create unique index device_types_org_name_key on device_types (org_id, device_type_key(name));

-- One row per org whose catalog was seeded: seeding happens once per org, so a seed type an Admin deleted stays
-- deleted. Also the per-org lock that serialises the 100-type cap check.
create table device_type_catalogs (
  org_id uuid primary key,
  seeded_at timestamptz not null default now()
);

create function device_types_seed(p_org uuid) returns void language plpgsql as $$
begin
  insert into device_type_catalogs (org_id) values (p_org) on conflict (org_id) do nothing;
  if found then
    insert into device_types (org_id, name, slot) values
      (p_org, 'PC', 'pc'),
      (p_org, 'Laptop', 'laptop'),
      (p_org, 'Monitor', 'monitor'),
      (p_org, 'IP phone', 'phone'),
      (p_org, 'Other', 'other')
    on conflict do nothing;
  end if;
end $$;

-- Every path that creates a member (first visit, invitations, the dev seeder, the previous image) seeds its org.
create function members_seed_device_types() returns trigger language plpgsql as $$
begin
  perform device_types_seed(new.org_id);
  return null;
end $$;
create trigger members_seed_device_types_trg after insert on members
  for each row execute function members_seed_device_types();

-- Orgs that exist before this migration.
select device_types_seed(o.org_id)
  from (select org_id from members
        union select org_id from rooms
        union select org_id from seats
        union select org_id from devices
        union select org_id from groups) o;
