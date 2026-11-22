import "server-only";
import type { LayoutResponse, SeatView } from "@/lib/sprites/layout";
import {
  resolveLayout,
  type StoredFixture,
  type StoredPlacement,
  type StoredSeat,
} from "@/lib/sprites/resolve-layout";
import { seatViewOf } from "@/lib/sprites/seat-view";
import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import { withTx, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

export type LayoutRefusal = { ok: false; status: 404; code: "not_found" };
export type LayoutResult<T> = { ok: true; value: T } | LayoutRefusal;

type RoomRow = {
  id: string;
  code: string;
  name: string;
  grid_w: number | null;
  grid_h: number | null;
  floor_zones: unknown;
  layout_version: number;
};
type Tile = {
  tile_x: number | null;
  tile_y: number | null;
  tile_rotation: number | null;
  sprite_key: string | null;
};
type SeatRow = Tile & {
  id: string;
  code: string;
  cannot_seat: boolean;
  occupant_id: string | null;
  display_name: string | null;
  mine: boolean;
};
type FixtureRow = Tile & { id: string };

function placementOf(r: Tile): StoredPlacement | null {
  if (r.tile_x === null || r.tile_y === null || r.tile_rotation === null || r.sprite_key === null) {
    return null;
  }
  return { sprite: r.sprite_key, x: r.tile_x, y: r.tile_y, rotation: r.tile_rotation };
}

/**
 * One room's layout with derived seat status, read in a single snapshot so a concurrent save cannot
 * show a new version with old seats. Read-only: an unsaved room gets a computed default, never written.
 */
export async function getRoomLayout(
  pool: TxPool,
  scope: OrgScope,
  sub: string,
  roomId: string,
): Promise<LayoutResult<LayoutResponse>> {
  const out = await withTx(pool, async (c): Promise<LayoutResponse | null> => {
    await c.query("set transaction isolation level repeatable read, read only");
    const { rows: rooms } = await orgQuery<RoomRow>(
      c,
      scope,
      `select id, code, name, grid_w, grid_h,
         case when jsonb_typeof(floor_zones) = 'array'
                and jsonb_array_length(floor_zones) <= ${LAYOUT_LIMITS.floors}
                and octet_length(floor_zones::text) <= ${LAYOUT_LIMITS.bodyBytes}
              then floor_zones end as floor_zones,
         layout_version
       from rooms where org_id = $1 and id = $2`,
      [roomId],
    );
    const room = rooms[0];
    if (!room) return null;

    const { rows: seatRows } = await orgQuery<SeatRow>(
      c,
      scope,
      `select s.id, s.code, s.cannot_seat, s.occupant_id, o.display_name,
         coalesce(o.sub = $3::uuid, false) as mine,
         s.tile_x, s.tile_y, s.tile_rotation, left(s.sprite_key, 129) as sprite_key
       from seats s
         left join members o on o.org_id = s.org_id and o.id = s.occupant_id
       where s.org_id = $1 and s.room_id = $2
       order by s.seq, s.id limit ${LAYOUT_LIMITS.seats + 1}`,
      [roomId, sub],
    );
    const { rows: fixtureRows } = await orgQuery<FixtureRow>(
      c,
      scope,
      `select id, tile_x, tile_y, tile_rotation, left(sprite_key, 129) as sprite_key
       from layout_fixtures
       where org_id = $1 and room_id = $2 and sprite_key is not null
       order by id limit ${LAYOUT_LIMITS.fixtures}`,
      [roomId],
    );

    const truncated = seatRows.length > LAYOUT_LIMITS.seats;
    const seats = seatRows.slice(0, LAYOUT_LIMITS.seats);
    const stored: StoredSeat[] = seats.map((s) => ({
      id: s.id,
      code: s.code,
      placement: placementOf(s),
    }));
    const fixtures = fixtureRows.flatMap((f): StoredFixture[] => {
      const p = placementOf(f);
      return p ? [{ id: f.id, ...p }] : [];
    });
    const resolved = resolveLayout(
      { gridW: room.grid_w, gridH: room.grid_h, floorZones: room.floor_zones },
      stored,
      fixtures,
    );
    const seatViews: Record<string, SeatView> = {};
    for (const s of seats) {
      seatViews[s.id] = seatViewOf({
        cannotSeat: s.cannot_seat,
        mine: s.mine,
        occupantId: s.occupant_id,
        occupantName: s.display_name,
      });
    }
    return {
      room: { id: room.id, code: room.code, name: room.name },
      version: room.layout_version,
      saved: resolved.saved,
      layout: resolved.layout,
      seatViews,
      unplaced: resolved.unplaced,
      truncated,
    };
  });
  return out ? { ok: true, value: out } : { ok: false, status: 404, code: "not_found" };
}
