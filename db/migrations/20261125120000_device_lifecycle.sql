-- SIM-037.1 / D63: device lifecycle schema. Expand-only: the previous image keeps working (it always writes an owner,
-- ignores the new columns; its inner joins hide unowned devices).

-- A device may have no owner (org inventory, D63). Invariant 5: an unowned device is never at a seat.
alter table devices alter column owner_id drop not null;

alter table devices add column serial text null;
alter table devices add column manufacturer text null;
alter table devices add column brand text null;
alter table devices add column holding_note text null;
alter table devices add column holding_expires_on date null;

alter table devices add constraint devices_serial_check
  check (serial = btrim(serial) and serial <> '' and char_length(serial) <= 100);
alter table devices add constraint devices_manufacturer_check
  check (manufacturer = btrim(manufacturer) and manufacturer <> '' and char_length(manufacturer) <= 100);
alter table devices add constraint devices_brand_check
  check (brand = btrim(brand) and brand <> '' and char_length(brand) <= 100);
alter table devices add constraint devices_holding_note_check
  check (holding_note = btrim(holding_note) and holding_note <> '' and char_length(holding_note) <= 500);

create unique index devices_org_serial_key on devices (org_id, serial) where serial is not null;

-- Immediate checks (the invariant 3 trigger is deferred): returning a device to the org inventory must clear owner,
-- seat and holding data in one UPDATE. Every existing row has an owner (OQ-45), so validation cannot fail.
alter table devices add constraint devices_unowned_not_placed_check
  check (owner_id is not null or seat_id is null) not valid;
alter table devices validate constraint devices_unowned_not_placed_check;
alter table devices add constraint devices_unowned_no_holding_check
  check (owner_id is not null or (holding_note is null and holding_expires_on is null)) not valid;
alter table devices validate constraint devices_unowned_no_holding_check;

create index devices_org_unowned_idx on devices (org_id, lower(name), id) where owner_id is null;

-- Device handoffs (spec section 4): transfer, return and extension requests. At most one pending per device.
-- A device delete drops its non-pending handoffs; the service refuses the delete while one is pending.
create table device_handoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  device_id uuid not null,
  kind text not null,
  from_member_id uuid not null,
  to_member_id uuid null,
  requested_by_id uuid not null,
  note text null,
  new_expires_on date null,
  status text not null default 'pending',
  decided_by_id uuid null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_handoffs_org_id_key unique (org_id, id),
  constraint device_handoffs_kind_check check (kind in ('transfer', 'return', 'extension')),
  constraint device_handoffs_status_check check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  constraint device_handoffs_decided_check check ((status = 'pending') = (decided_at is null)),
  constraint device_handoffs_note_check
    check (note = btrim(note) and note <> '' and char_length(note) <= 500),
  constraint device_handoffs_shape_check check (
    (kind = 'transfer' and to_member_id is not null and to_member_id <> from_member_id and new_expires_on is null)
    or (kind = 'return' and to_member_id is null and new_expires_on is null)
    or (kind = 'extension' and to_member_id is null and new_expires_on is not null)
  ),
  constraint device_handoffs_device_fkey foreign key (org_id, device_id) references devices (org_id, id) on delete cascade,
  constraint device_handoffs_from_fkey foreign key (org_id, from_member_id) references members (org_id, id),
  constraint device_handoffs_to_fkey foreign key (org_id, to_member_id) references members (org_id, id),
  constraint device_handoffs_requested_by_fkey foreign key (org_id, requested_by_id) references members (org_id, id),
  constraint device_handoffs_decided_by_fkey foreign key (org_id, decided_by_id) references members (org_id, id)
);
create unique index device_handoffs_one_pending_idx on device_handoffs (org_id, device_id) where status = 'pending';
create index device_handoffs_inbox_idx on device_handoffs (org_id, to_member_id, created_at desc) where status = 'pending';
create index device_handoffs_device_idx on device_handoffs (org_id, device_id, created_at desc);
