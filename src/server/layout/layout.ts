import "server-only";
import type { DeviceKind } from "@/lib/sprites/device-slots";
import { catalogFootprints } from "@/lib/map-items/footprints";
import type { LayoutItem, LayoutResponse, SeatDevice, SeatView } from "@/lib/sprites/layout";
import {
  resolveLayout,
  type StoredFixture,
  type StoredPlacement,
  type StoredSeat,
} from "@/lib/sprites/resolve-layout";
import { seatViewOf } from "@/lib/sprites/seat-view";
import { LAYOUT_LIMITS, registryFootprints } from "@/lib/validate/layout";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { COLS, toDto, type Row as ItemRow } from "@/server/map-items/map-items";

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

/** The room, seats and fixtures on an open transaction; null when the room is not in the org. */
export async function readLayoutRows(
  c: TxClient,
  scope: OrgScope,
  sub: string,
  roomId: string,
): Promise<LayoutResponse | null> {
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

  // Catalog rows of every key the stored rows can use, hidden ones included; inside the caller's snapshot or lock.
  const floorKeys = Array.isArray(room.floor_zones)
    ? room.floor_zones.flatMap((z: unknown) =>
        typeof z === "object" &&
        z !== null &&
        typeof (z as { sprite?: unknown }).sprite === "string"
          ? [(z as { sprite: string }).sprite]
          : [],
      )
    : [];
  const keys = [
    ...new Set([
      ...seatRows.flatMap((s) => (s.sprite_key === null ? [] : [s.sprite_key])),
      ...fixtureRows.flatMap((f) => (f.sprite_key === null ? [] : [f.sprite_key])),
      ...floorKeys,
      "desk.single",
      "floor.wood",
      "chair.office",
    ]),
  ];
  const { rows: itemRows } = await orgQuery<ItemRow>(
    c,
    scope,
    `select ${COLS} from map_items where org_id = $1 and builtin_key = any($2::text[]) order by builtin_key`,
    [keys],
  );

  const seatDevices: Record<string, SeatDevice[]> = {};
  if (seatRows.length > 0) {
    // D61: a device's free-text type matches the org's catalog by device_type_key; the unique index allows one match
    const { rows: deviceRows } = await orgQuery<{
      seat_id: string;
      type: string;
      type_id: string | null;
      slot: DeviceKind | null;
      has_image: boolean | null;
      image_version: number | null;
    }>(
      c,
      scope,
      `select d.seat_id, left(d.type, 61) as type, t.id as type_id, t.slot,
              (t.image_drive_file_id is not null) as has_image, t.image_version
         from (
           select seat_id, type, row_number() over (
                    partition by seat_id order by (role = 'primary') desc, created_at, id) as n
             from devices
            where org_id = $1 and seat_id = any($2::uuid[])
         ) d
         left join device_types t
           on t.org_id = $1 and device_type_key(t.name) = device_type_key(d.type)
        where d.n <= ${LAYOUT_LIMITS.devicesPerSeat}
        order by d.seat_id, d.n`,
      [seatRows.slice(0, LAYOUT_LIMITS.seats).map((s) => s.id)],
    );
    for (const d of deviceRows) {
      (seatDevices[d.seat_id] ??= []).push({
        type: d.type,
        deviceType: d.type_id
          ? {
              id: d.type_id,
              slot: d.slot!,
              hasImage: d.has_image!,
              imageVersion: d.image_version!,
            }
          : null,
      });
    }
  }

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
    catalogFootprints(
      itemRows.map((r) => ({ builtinKey: r.builtin_key, w: r.w, h: r.h })),
      registryFootprints,
    ),
  );
  const used = new Set<string>([
    ...resolved.layout.seats.map((s) => s.sprite),
    ...resolved.layout.fixtures.map((f) => f.sprite),
    ...resolved.layout.floors.map((z) => z.sprite),
    ...(resolved.layout.seats.length > 0 ? ["chair.office"] : []),
  ]);
  const items = itemRows.flatMap((r): LayoutItem[] => {
    const dto = used.has(r.builtin_key) ? toDto(r) : null;
    if (!dto) return [];
    const { hidden: _hidden, ...item } = dto;
    return [item];
  });
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
    seatDevices,
    unplaced: resolved.unplaced,
    truncated,
    items,
  };
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
    return readLayoutRows(c, scope, sub, roomId);
  });
  return out ? { ok: true, value: out } : { ok: false, status: 404, code: "not_found" };
}
