import "server-only";
import { ISO } from "@/server/requests/requests";

/** Presence joined to its seat and room; every join repeats org_id (R6). */
export const PRESENCE_FROM = `presence p
  join seats s on s.org_id = p.org_id and s.id = p.seat_id
  join rooms r on r.org_id = s.org_id and r.id = s.room_id`;

/** The one "active" rule (PRE-03, PRE-05, D82): today's open row whose seat is still held by the member. */
export const activeWhere = (todayParam: string) =>
  `p.work_date = ${todayParam}::date and p.checked_out_at is null and s.occupant_id = p.member_id`;

export const CHECKED_IN_AT = `to_char(p.checked_in_at at time zone 'UTC', ${ISO})`;

export const ACTIVE_COLUMNS = `p.id, p.seat_id, s.room_id, s.code as seat_code, r.code as room_code,
  ${CHECKED_IN_AT} as checked_in_at, p.source`;
