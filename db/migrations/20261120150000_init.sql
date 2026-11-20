-- simap v1 schema (SIM-008). Spec: docs/spec-v1.md section 4 (entities), section 5 (invariants), section 8 (database).
-- Conventions: every table has org_id uuid not null (the Identity org; no FK because orgs live in Identity);
-- every FK target has unique (org_id, id) and every FK is composite (org_id, x) so a reference never crosses orgs;
-- every unique key and index includes org_id except the id primary key; enums are text + check.
-- New tables only, nothing reads them yet (expand/contract trivially met).

-- Groups (GRP-01): a colour-coded tag on members and seats. Names compare exactly.
create table groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  color text not null default '#5B6CF0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_check check (btrim(name) <> ''),
  constraint groups_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint groups_org_name_key unique (org_id, name),
  constraint groups_org_id_key unique (org_id, id)
);

-- Projects (PRJ-01): a tag on seats.
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_code_check check (btrim(code) <> ''),
  constraint projects_name_check check (btrim(name) <> ''),
  constraint projects_org_code_key unique (org_id, code),
  constraint projects_org_id_key unique (org_id, id)
);

-- Members (MEM-01, D12, D34): simap's profile of one Identity account in one org. Never deleted, only deactivated.
-- Deleting a group is done by the service, which clears group_id in the same transaction (NO ACTION here).
create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sub uuid not null,
  email text not null,
  display_name text not null,
  employee_code text null,
  group_id uuid null,
  status text not null default 'active',
  requests_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_email_check check (btrim(email) <> ''),
  constraint members_display_name_check check (btrim(display_name) <> ''),
  constraint members_status_check check (status in ('active', 'deactivated')),
  constraint members_org_sub_key unique (org_id, sub),
  constraint members_org_id_key unique (org_id, id),
  constraint members_group_fkey foreign key (org_id, group_id) references groups (org_id, id)
);
create unique index members_org_employee_code_key on members (org_id, employee_code) where employee_code is not null;
create index members_org_group_idx on members (org_id, group_id) where group_id is not null;

-- Rooms (ROO-01, D29, D30): code unique per org; seat_counter only ever grows so seat numbers are never reused.
create table rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  code text not null,
  name text not null,
  description text null,
  floor text null,
  seat_counter integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_code_check check (btrim(code) <> ''),
  constraint rooms_name_check check (btrim(name) <> ''),
  constraint rooms_seat_counter_check check (seat_counter >= 0),
  constraint rooms_org_code_key unique (org_id, code),
  constraint rooms_org_id_key unique (org_id, id)
);

-- Seats (SEA-01, D26, invariants 1 and 6): one occupant column, no status column (status is derived).
-- code = room code + sequence is kept by the service; the unique keys prevent duplicates.
create table seats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  room_id uuid not null,
  seq integer not null,
  code text not null,
  occupant_id uuid null,
  group_id uuid null,
  project_id uuid null,
  x double precision not null default 0,
  y double precision not null default 0,
  rotation double precision not null default 0,
  w double precision null,
  h double precision null,
  cannot_seat boolean not null default false,
  cannot_seat_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seats_seq_check check (seq > 0),
  constraint seats_code_check check (btrim(code) <> ''),
  constraint seats_cannot_seat_reason_check check (cannot_seat_reason is null or cannot_seat),
  constraint seats_org_code_key unique (org_id, code),
  constraint seats_org_room_seq_key unique (org_id, room_id, seq),
  constraint seats_org_id_key unique (org_id, id),
  constraint seats_room_fkey foreign key (org_id, room_id) references rooms (org_id, id) on delete restrict,
  constraint seats_occupant_fkey foreign key (org_id, occupant_id) references members (org_id, id),
  constraint seats_group_fkey foreign key (org_id, group_id) references groups (org_id, id),
  constraint seats_project_fkey foreign key (org_id, project_id) references projects (org_id, id)
);
create index seats_org_occupant_idx on seats (org_id, occupant_id) where occupant_id is not null;
create index seats_org_group_idx on seats (org_id, group_id) where group_id is not null;
create index seats_org_project_idx on seats (org_id, project_id) where project_id is not null;

-- Devices (DEV-01, invariants 3 and 8): inventory when seat_id is null. mac is stored lowercase, colon-separated.
create table devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  type text not null,
  inventory_number text not null,
  mac text null,
  owner_id uuid not null,
  seat_id uuid null,
  role text not null default 'secondary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_name_check check (btrim(name) <> ''),
  constraint devices_type_check check (btrim(type) <> ''),
  constraint devices_inventory_number_check check (btrim(inventory_number) <> ''),
  constraint devices_mac_check check (mac ~ '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'),
  constraint devices_role_check check (role in ('primary', 'secondary')),
  constraint devices_primary_needs_seat_check check (seat_id is not null or role = 'secondary'),
  constraint devices_org_inventory_number_key unique (org_id, inventory_number),
  constraint devices_org_id_key unique (org_id, id),
  constraint devices_owner_fkey foreign key (org_id, owner_id) references members (org_id, id) on delete restrict,
  constraint devices_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id) on delete restrict
);
create unique index devices_org_mac_key on devices (org_id, mac) where mac is not null;
create unique index devices_one_primary_per_seat on devices (org_id, seat_id) where role = 'primary' and seat_id is not null;
create index devices_org_owner_idx on devices (org_id, owner_id);
create index devices_org_seat_idx on devices (org_id, seat_id) where seat_id is not null;

-- Seat requests (REG-01, REG-02): at most one pending request per seat and subject.
-- A seat delete drops its requests (ROO-01); the history stays in audit_log.
create table seat_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  seat_id uuid not null,
  subject_id uuid not null,
  created_by_id uuid not null,
  status text not null default 'pending',
  note text null,
  decided_by_id uuid null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint seat_requests_decided_check check ((status = 'pending') = (decided_at is null)),
  constraint seat_requests_org_id_key unique (org_id, id),
  constraint seat_requests_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id) on delete cascade,
  constraint seat_requests_subject_fkey foreign key (org_id, subject_id) references members (org_id, id),
  constraint seat_requests_created_by_fkey foreign key (org_id, created_by_id) references members (org_id, id),
  constraint seat_requests_decided_by_fkey foreign key (org_id, decided_by_id) references members (org_id, id)
);
create unique index seat_requests_one_pending_idx on seat_requests (org_id, seat_id, subject_id) where status = 'pending';
create index seat_requests_org_status_idx on seat_requests (org_id, status, created_at desc);
create index seat_requests_org_seat_idx on seat_requests (org_id, seat_id);
create index seat_requests_org_subject_idx on seat_requests (org_id, subject_id, created_at desc);

-- Layout fixtures (LAY-03): non-seat items on a room plan; they belong to the room.
create table layout_fixtures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  room_id uuid not null,
  kind text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  rotation double precision not null default 0,
  w double precision null,
  h double precision null,
  label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint layout_fixtures_kind_check check (
    kind in ('door', 'window', 'room', 'stairs', 'elevator', 'server', 'cabinet', 'pillar', 'blocked', 'label')
  ),
  constraint layout_fixtures_room_fkey foreign key (org_id, room_id) references rooms (org_id, id) on delete cascade
);
create index layout_fixtures_org_room_idx on layout_fixtures (org_id, room_id);

-- Invitations (MEM-01, D14): invitations sent from simap. No token column (AUT-03).
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  email text not null,
  role text not null,
  invited_by_sub uuid not null,
  status text not null default 'pending',
  identity_invitation_id text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_check check (btrim(email) <> ''),
  constraint invitations_role_check check (role in ('simap:admin', 'simap:manager', 'simap:user')),
  constraint invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'))
);
create unique index invitations_org_pending_email_key on invitations (org_id, lower(email)) where status = 'pending';
create index invitations_org_created_idx on invitations (org_id, created_at desc);

-- Audit log (SYS-03): append-only. No FK on entity_id because the entity may be gone.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_sub uuid not null,
  action text not null,
  entity text not null,
  entity_id uuid null,
  meta jsonb null,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on audit_log (org_id, created_at desc, id desc);
create index audit_log_org_entity_idx on audit_log (org_id, entity, entity_id, created_at desc);
create index audit_log_org_actor_idx on audit_log (org_id, actor_sub, created_at desc);

-- Invariant 3 (primary device owned by the seat occupant), checked at COMMIT so a service can change the occupant
-- and demote the old primary in one transaction (invariant 8). The row is re-read because NEW is stale when deferred.
create function devices_primary_owner_check() returns trigger language plpgsql as $$
declare
  d devices%rowtype;
begin
  select * into d from devices where org_id = new.org_id and id = new.id;
  if not found or d.role <> 'primary' then
    return null;
  end if;
  if not exists (
    select 1 from seats s where s.org_id = d.org_id and s.id = d.seat_id and s.occupant_id = d.owner_id
  ) then
    raise exception 'primary device must be owned by the seat occupant'
      using errcode = '23514', constraint = 'devices_primary_owner_is_occupant';
  end if;
  return null;
end
$$;

create constraint trigger devices_primary_owner_trg
  after insert or update of role, owner_id, seat_id on devices
  deferrable initially deferred
  for each row execute function devices_primary_owner_check();

create function seats_primary_owner_check() returns trigger language plpgsql as $$
declare
  s seats%rowtype;
begin
  select * into s from seats where org_id = new.org_id and id = new.id;
  if not found then
    return null;
  end if;
  if exists (
    select 1 from devices d
    where d.org_id = s.org_id and d.seat_id = s.id and d.role = 'primary'
      and d.owner_id is distinct from s.occupant_id
  ) then
    raise exception 'primary device must be owned by the seat occupant'
      using errcode = '23514', constraint = 'devices_primary_owner_is_occupant';
  end if;
  return null;
end
$$;

create constraint trigger seats_primary_owner_trg
  after update of occupant_id on seats
  deferrable initially deferred
  for each row execute function seats_primary_owner_check();

create function audit_log_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only' using errcode = '55000';
end
$$;

create trigger audit_log_no_change_trg before update or delete on audit_log
  for each row execute function audit_log_append_only();
create trigger audit_log_no_truncate_trg before truncate on audit_log
  for each statement execute function audit_log_append_only();
