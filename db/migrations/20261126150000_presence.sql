-- SIM-058: presence (spec §4 Presence, PRE-03, PRE-05; D77-D82). Expand-only: one new table, nothing else touched.
-- One row per member per work date (UTC+7 day, written by the server, D79); a second check-in that day reopens the row
-- (D81). "Active" is computed on read (work date = today, not checked out, seat still held), so no background job.
-- `provider` and `day_end` are allowed now so the provider source (SIM-063) needs no contract migration; SIM-058 writes
-- only `self` and `system`. Display only (D78): never read by exports, reports or the dashboard.
-- The seat FK cascades: deleting a seat (or a room with its seats) drops its presence rows; the audit log keeps history.
-- The previous image never reads the table.
create table presence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  member_id uuid not null,
  seat_id uuid not null,
  work_date date not null,
  checked_in_at timestamptz not null,
  source text not null,
  checked_out_at timestamptz null,
  checked_out_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_org_id_key unique (org_id, id),
  constraint presence_org_member_date_key unique (org_id, member_id, work_date),
  constraint presence_member_fkey foreign key (org_id, member_id) references members (org_id, id),
  constraint presence_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id) on delete cascade,
  constraint presence_source_check check (source in ('self', 'provider')),
  constraint presence_checked_out_by_check
    check (checked_out_by is null or checked_out_by in ('self', 'provider', 'day_end', 'system')),
  constraint presence_checkout_pair_check check ((checked_out_at is null) = (checked_out_by is null)),
  constraint presence_checkout_order_check check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create index presence_org_seat_date_idx on presence (org_id, seat_id, work_date);
