import "server-only";
import type { LayoutResponse, LayoutSaveValue } from "@/lib/sprites/layout";
import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { readLayoutRows } from "./layout";

export type SaveRefusal =
  | { ok: false; status: 404; code: "not_found" }
  | { ok: false; status: 409; code: "layout_stale" | "layout_seats_changed" }
  | { ok: false; status: 422; code: "layout_too_many_seats" };
export type SaveResult = { ok: true; value: LayoutResponse } | SaveRefusal;

/** Thrown inside the transaction to roll it back and answer with a domain refusal. */
class Abort extends Error {
  constructor(readonly refusal: SaveRefusal) {
    super("abort");
  }
}

const refuse = <S extends SaveRefusal["status"]>(
  status: S,
  code: Extract<SaveRefusal, { status: S }>["code"],
) => new Abort({ ok: false, status, code } as SaveRefusal);

async function inTx(
  pool: TxPool,
  fn: (c: TxClient) => Promise<LayoutResponse>,
): Promise<SaveResult> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    throw err;
  }
}

/**
 * LAY-01/03: replaces a room's grid, floors, seat placement and placed fixtures in one transaction.
 * Lock order: room, then seats ascending. Seats are never created or deleted here.
 */
export async function saveRoomLayout(
  pool: TxPool,
  scope: OrgScope,
  sub: string,
  roomId: string,
  value: LayoutSaveValue,
): Promise<SaveResult> {
  return inTx(pool, async (c) => {
    const { rows: rooms } = await orgQuery<{ layout_version: number }>(
      c,
      scope,
      "select layout_version from rooms where org_id = $1 and id = $2 for update",
      [roomId],
    );
    if (!rooms[0]) throw refuse(404, "not_found");
    if (rooms[0].layout_version !== value.baseVersion) throw refuse(409, "layout_stale");

    const { rows: locked } = await orgQuery<{ id: string }>(
      c,
      scope,
      `select id from seats where org_id = $1 and room_id = $2
       order by id limit ${LAYOUT_LIMITS.seats + 1} for update`,
      [roomId],
    );
    if (locked.length > LAYOUT_LIMITS.seats) throw refuse(422, "layout_too_many_seats");
    const submitted = new Set(value.seats.map((s) => s.id));
    if (locked.length !== submitted.size || !locked.every((r) => submitted.has(r.id))) {
      throw refuse(409, "layout_seats_changed");
    }

    if (value.seats.length > 0) {
      await orgQuery(
        c,
        scope,
        `update seats s set tile_x = v.x, tile_y = v.y, tile_rotation = v.r, sprite_key = v.k, updated_at = now()
         from unnest($3::uuid[], $4::int[], $5::int[], $6::smallint[], $7::text[]) as v(id, x, y, r, k)
         where s.org_id = $1 and s.room_id = $2 and s.id = v.id`,
        [
          roomId,
          value.seats.map((s) => s.id),
          value.seats.map((s) => s.x),
          value.seats.map((s) => s.y),
          value.seats.map((s) => s.rotation),
          value.seats.map((s) => s.sprite),
        ],
      );
    }

    await orgQuery(
      c,
      scope,
      "delete from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key is not null",
      [roomId],
    );
    if (value.fixtures.length > 0) {
      // The select-from-subselect form satisfies orgQuery's org_id = $1 guard (same as audit/write.ts).
      await orgQuery(
        c,
        scope,
        `insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
         select o.org_id, $2::uuid, null::text, v.x, v.y, v.r, v.k
         from (select $1::uuid as org_id) o
           cross join unnest($3::int[], $4::int[], $5::smallint[], $6::text[]) as v(x, y, r, k)
         where o.org_id = $1::uuid`,
        [
          roomId,
          value.fixtures.map((f) => f.x),
          value.fixtures.map((f) => f.y),
          value.fixtures.map((f) => f.rotation),
          value.fixtures.map((f) => f.sprite),
        ],
      );
    }

    const { rows: updated } = await orgQuery<{ layout_version: number }>(
      c,
      scope,
      `update rooms set grid_w = $3, grid_h = $4, floor_zones = $5::jsonb,
         layout_version = layout_version + 1, updated_at = now()
       where org_id = $1 and id = $2 returning layout_version`,
      [roomId, value.w, value.h, JSON.stringify(value.floors)],
    );

    await writeAudit(c, scope, {
      actorSub: sub,
      action: "room.layout_save",
      entity: "room",
      entityId: roomId,
      meta: {
        seats: value.seats.length,
        fixtures: value.fixtures.length,
        floors: value.floors.length,
        baseVersion: value.baseVersion,
        version: updated[0]!.layout_version,
      },
    });

    const out = await readLayoutRows(c, scope, sub, roomId);
    if (!out) throw refuse(404, "not_found");
    return out;
  });
}
