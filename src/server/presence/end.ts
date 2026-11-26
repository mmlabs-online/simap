import "server-only";
import { workDateUtc7 } from "@/lib/presence/work-date";
import { writeAudit } from "@/server/audit/write";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

export type EndReason =
  | "seat_released"
  | "seat_reassigned"
  | "seat_unassigned"
  | "member_deactivated"
  | "room_deleted";

/**
 * D82: ends today's open presence rows matching `cond` (checked out by `system`) and audits each one. Call inside the
 * caller's transaction, after its member / room / seat locks. Rows of earlier work dates already count as ended on read.
 * `$2` = now, `$3` = today's work date, `$4` and up = `params`. The audit actor is the acting human (`actor_sub` is
 * `uuid not null`).
 */
async function endWhere(
  c: Query,
  scope: OrgScope,
  actorSub: string,
  cond: string,
  params: unknown[],
  reason: EndReason,
  now: Date,
): Promise<void> {
  const { rows } = await orgQuery<{ id: string; seat_id: string; member_id: string }>(
    c,
    scope,
    `update presence p
     set checked_out_at = greatest($2::timestamptz, p.checked_in_at), checked_out_by = 'system', updated_at = now()
     where p.org_id = $1 and ${cond} and p.work_date = $3::date and p.checked_out_at is null
     returning p.id, p.seat_id, p.member_id`,
    [now.toISOString(), workDateUtc7(now), ...params],
  );
  for (const r of rows) {
    await writeAudit(c, scope, {
      actorSub,
      action: "presence.system_check_out",
      entity: "presence",
      entityId: r.id,
      meta: { reason, memberId: r.member_id, seat: r.seat_id },
    });
  }
}

export const endPresenceForSeat = (
  c: Query,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
  memberId: string,
  reason: EndReason,
  now: Date = new Date(),
) =>
  endWhere(
    c,
    scope,
    actorSub,
    "p.seat_id = $4 and p.member_id = $5",
    [seatId, memberId],
    reason,
    now,
  );

export const endPresenceForMember = (
  c: Query,
  scope: OrgScope,
  actorSub: string,
  memberId: string,
  reason: EndReason,
  now: Date = new Date(),
) => endWhere(c, scope, actorSub, "p.member_id = $4", [memberId], reason, now);

export const endPresenceForRoom = (
  c: Query,
  scope: OrgScope,
  actorSub: string,
  roomId: string,
  reason: EndReason,
  now: Date = new Date(),
) =>
  endWhere(
    c,
    scope,
    actorSub,
    "p.seat_id in (select x.id from seats x where x.org_id = $1 and x.room_id = $4)",
    [roomId],
    reason,
    now,
  );
