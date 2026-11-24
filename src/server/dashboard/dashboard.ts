import "server-only";
import {
  DASHBOARD_LIMITS,
  type DashboardDto,
  type DashboardTotals,
  type DeactivatedHolderDto,
  type HolderSeatRef,
} from "@/lib/dashboard/types";
import { withTx } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { listRooms, type Db } from "@/server/rooms/rooms";

type TotalsRow = {
  rooms: number;
  seats: number;
  occupied: number;
  devices_placed: number;
  devices_inventory: number;
};

type HolderRow = {
  id: string;
  display_name: string;
  seat_count: number;
  seats: { id: string; code: string; room_id: string; room_code: string }[];
  total: number;
};

const TOTALS_SQL = `select
    (select count(*)::int from rooms where org_id = $1) as rooms,
    (select count(*)::int from seats where org_id = $1) as seats,
    (select count(*)::int from seats where org_id = $1 and occupant_id is not null) as occupied,
    (select count(*)::int from devices where org_id = $1 and seat_id is not null) as devices_placed,
    (select count(*)::int from devices where org_id = $1 and seat_id is null) as devices_inventory`;

/** Counts and capped ref lists are correlated subqueries (no join fan-out); each repeats org_id = $1. */
const HOLDERS_SQL = `select m.id, m.display_name,
    (select count(*)::int from seats s where s.org_id = $1 and s.occupant_id = m.id) as seat_count,
    coalesce((select json_agg(x) from (
      select s.id, s.code, r.id as room_id, r.code as room_code
      from seats s join rooms r on r.org_id = s.org_id and r.id = s.room_id
      where s.org_id = $1 and s.occupant_id = m.id
      order by s.code, s.id limit ${DASHBOARD_LIMITS.holderSeats}) x), '[]'::json) as seats,
    count(*) over ()::int as total
  from members m
  where m.org_id = $1 and m.status = 'deactivated'
    and exists (select 1 from seats s where s.org_id = $1 and s.occupant_id = m.id)
  order by lower(m.display_name), m.id limit ${DASHBOARD_LIMITS.holders}`;

const toHolder = (r: HolderRow): DeactivatedHolderDto => ({
  member: { id: r.id, displayName: r.display_name },
  seatCount: r.seat_count,
  seats: r.seats.map((s): HolderSeatRef => ({
    id: s.id,
    code: s.code,
    roomId: s.room_id,
    roomCode: s.room_code,
  })),
});

/** Dashboard numbers, all computed live from one read-only snapshot. No cached counters. */
export function getDashboard(
  pool: Db,
  scope: OrgScope,
  opts: { includeHolders: boolean },
): Promise<DashboardDto> {
  return withTx(pool, async (c) => {
    await c.query("set transaction isolation level repeatable read, read only");
    const t = (await orgQuery<TotalsRow>(c, scope, TOTALS_SQL)).rows[0]!;
    const totals: DashboardTotals = {
      rooms: t.rooms,
      seats: t.seats,
      occupied: t.occupied,
      devicesPlaced: t.devices_placed,
      devicesInventory: t.devices_inventory,
    };
    const rooms = await listRooms(c, scope);
    let deactivatedHolders: DashboardDto["deactivatedHolders"] = null;
    if (opts.includeHolders) {
      const { rows } = await orgQuery<HolderRow>(c, scope, HOLDERS_SQL);
      deactivatedHolders = { total: rows[0]?.total ?? 0, items: rows.map(toHolder) };
    }
    return { totals, rooms, roomsTruncated: totals.rooms > rooms.length, deactivatedHolders };
  });
}
