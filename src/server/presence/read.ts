import "server-only";
import type { RoomPresenceResponse } from "@/lib/presence/types";
import { workDateUtc7 } from "@/lib/presence/work-date";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { activeWhere, CHECKED_IN_AT, PRESENCE_FROM } from "./sql";

type Db = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

export type RoomPresenceResult =
  | { ok: true; value: RoomPresenceResponse }
  | { ok: false; status: 404; code: "not_found" };

/** PRE-06: who is checked in to the room now, for any member of the org. No ended rows, no email or sub. */
export async function listRoomPresence(
  db: Db,
  scope: OrgScope,
  roomId: string,
  now: Date = new Date(),
): Promise<RoomPresenceResult> {
  const { rows: room } = await orgQuery(
    db,
    scope,
    "select id from rooms where org_id = $1 and id = $2",
    [roomId],
  );
  if (!room[0]) return { ok: false, status: 404, code: "not_found" };
  const today = workDateUtc7(now);
  const { rows } = await orgQuery(
    db,
    scope,
    `select m.id as member_id, m.display_name, s.id as seat_id, s.code as seat_code,
            ${CHECKED_IN_AT} as checked_in_at, p.source
     from ${PRESENCE_FROM}
       join members m on m.org_id = p.org_id and m.id = p.member_id
     where p.org_id = $1 and s.room_id = $2 and ${activeWhere("$3")} and m.status = 'active'
     order by p.checked_in_at, s.code`,
    [roomId, today],
  );
  return {
    ok: true,
    value: {
      roomId,
      workDate: today,
      members: rows.map((r) => ({
        memberId: r.member_id,
        displayName: r.display_name,
        seatId: r.seat_id,
        seatCode: r.seat_code,
        checkedInAt: r.checked_in_at,
        source: r.source,
      })),
    },
  };
}
