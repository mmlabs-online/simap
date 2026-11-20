-- SIM-007: first-visit flag for the member profile (spec MEM-01, D17). Expand-only: one nullable column, no default,
-- no backfill. null = the member row was created on first visit and the member has not confirmed a display name yet;
-- set once by the member's first PATCH /api/me. The previous image never reads or writes it.
alter table members add column profile_confirmed_at timestamptz null;
