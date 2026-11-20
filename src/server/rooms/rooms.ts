import "server-only";
import { canDeleteDirectly } from "@/lib/rooms/delete-impact";
import { nextSeatSeq, renameSeatCodes } from "@/lib/rooms/seat-code";
import type { DeleteImpact, RoomDto } from "@/lib/rooms/types";
import type { RoomCreateValue, RoomPatchValue } from "@/lib/validate/room";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { roomConflict } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409;
  code: "not_found" | "room_code_taken" | "room_not_empty";
};
export type Result<T> = { ok: true; value: T } | Refusal;

const notFound: Refusal = { ok: false, status: 404, code: "not_found" };

/** Thrown inside a transaction to roll it back and answer with a domain refusal. */
class Abort extends Error {
  constructor(readonly refusal: Refusal) {
    super("abort");
  }
}

async function inTx<T>(pool: Db, fn: (c: TxClient) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    if (roomConflict(err)) return { ok: false, status: 409, code: "room_code_taken" };
    throw err;
  }
}

type RoomRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  floor: string | null;
  seat_count: number;
  occupied_count: number;
};

const toDto = (r: RoomRow): RoomDto => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
  floor: r.floor,
  seatCount: r.seat_count,
  occupiedCount: r.occupied_count,
});

const ROOM_SELECT = `select r.id, r.code, r.name, r.description, r.floor,
    count(s.id)::int as seat_count, count(s.occupant_id)::int as occupied_count
  from rooms r left join seats s on s.org_id = r.org_id and s.room_id = r.id
  where r.org_id = $1`;

export async function listRooms(db: Query, scope: OrgScope): Promise<RoomDto[]> {
  const { rows } = await orgQuery<RoomRow>(
    db,
    scope,
    `${ROOM_SELECT} group by r.id order by r.code limit 500`,
  );
  return rows.map(toDto);
}

async function loadRoom(db: Query, scope: OrgScope, id: string): Promise<RoomDto> {
  const { rows } = await orgQuery<RoomRow>(
    db,
    scope,
    `${ROOM_SELECT} and r.id = $2 group by r.id`,
    [id],
  );
  return toDto(rows[0]!);
}

export function createRoom(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  v: RoomCreateValue,
): Promise<Result<RoomDto>> {
  return inTx(db, async (c) => {
    // The select-from-subselect form satisfies orgQuery's org_id = $1 guard; org_id is always the scope org.
    const { rows } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into rooms (org_id, code, name, description, floor)
       select o.org_id, $2::text, $3::text, $4::text, $5::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
      [v.code, v.name, v.description, v.floor],
    );
    const id = rows[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "room.create",
      entity: "room",
      entityId: id,
      meta: { code: v.code },
    });
    return loadRoom(c, scope, id);
  });
}

async function lockRoom(
  c: Query,
  scope: OrgScope,
  id: string,
): Promise<{ id: string; code: string }> {
  const { rows } = await orgQuery<{ id: string; code: string }>(
    c,
    scope,
    "select id, code from rooms where org_id = $1 and id = $2 for update",
    [id],
  );
  if (!rows[0]) throw new Abort(notFound);
  return rows[0];
}

const COLUMNS = ["code", "name", "description", "floor"] as const;

export function updateRoom(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  patch: RoomPatchValue,
): Promise<Result<RoomDto>> {
  return inTx(db, async (c) => {
    const current = await lockRoom(c, scope, id);
    const fields = COLUMNS.filter((k) => patch[k] !== undefined);
    const sets = fields.map((k, i) => `${k} = $${i + 3}`);
    await orgQuery(
      c,
      scope,
      `update rooms set ${sets.join(", ")}, updated_at = now() where org_id = $1 and id = $2`,
      [id, ...fields.map((k) => patch[k])],
    );
    const meta: Record<string, unknown> = { fields };
    if (patch.code !== undefined && patch.code !== current.code) {
      const { rows: seats } = await orgQuery<{ id: string; seq: number }>(
        c,
        scope,
        "select id, seq from seats where org_id = $1 and room_id = $2",
        [id],
      );
      const renamed = renameSeatCodes(patch.code, seats);
      if (renamed.length > 0) {
        await orgQuery(
          c,
          scope,
          `update seats set code = v.code, updated_at = now()
           from unnest($2::uuid[], $3::text[]) as v(id, code)
           where seats.org_id = $1 and seats.id = v.id`,
          [renamed.map((s) => s.id), renamed.map((s) => s.code)],
        );
      }
      Object.assign(meta, { from: current.code, to: patch.code, seats: renamed.length });
    }
    await writeAudit(c, scope, {
      actorSub,
      action: "room.update",
      entity: "room",
      entityId: id,
      meta,
    });
    return loadRoom(c, scope, id);
  });
}

type ImpactRow = { seats: number; occupied: number; devices: number; pending: number };

async function impactOf(c: Query, scope: OrgScope, id: string): Promise<DeleteImpact> {
  const { rows } = await orgQuery<ImpactRow>(
    c,
    scope,
    `select count(*)::int as seats, count(s.occupant_id)::int as occupied,
       (select count(*)::int from devices d join seats ds on ds.org_id = d.org_id and ds.id = d.seat_id
         where d.org_id = $1 and ds.room_id = $2) as devices,
       (select count(*)::int from seat_requests q join seats qs on qs.org_id = q.org_id and qs.id = q.seat_id
         where q.org_id = $1 and q.status = 'pending' and qs.room_id = $2) as pending
     from seats s where s.org_id = $1 and s.room_id = $2`,
    [id],
  );
  const r = rows[0]!;
  return {
    seats: r.seats,
    occupiedSeats: r.occupied,
    placedDevices: r.devices,
    pendingRequests: r.pending,
  };
}

export async function getDeleteImpact(
  db: Query,
  scope: OrgScope,
  id: string,
): Promise<Result<DeleteImpact>> {
  const { rows } = await orgQuery(db, scope, "select id from rooms where org_id = $1 and id = $2", [
    id,
  ]);
  if (!rows[0]) return notFound;
  return { ok: true, value: await impactOf(db, scope, id) };
}

/**
 * Seat/device lock order (every writer of seats, occupants, device placement, seat-request approval):
 * 1. room row first: `for update` when creating, deleting or renaming seats (lockRoom, allocateSeatSeq),
 *    `for share` when only changing an existing seat's occupant or placing/moving a device on it;
 * 2. then seat rows `for update`, in ascending id order when more than one;
 * 3. then devices / seat_requests.
 * Never take a seat lock before the room row, never lock a room while holding a seat lock.
 * deleteRoom holds the room then all its seats, so a concurrent writer either committed before
 * (and is counted by the impact check) or waits and then fails the row check.
 */
export function deleteRoom(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  force: boolean,
): Promise<Result<null>> {
  return inTx(db, async (c) => {
    const room = await lockRoom(c, scope, id);
    await orgQuery(
      c,
      scope,
      "select id from seats where org_id = $1 and room_id = $2 order by id for update",
      [id],
    );
    const impact = await impactOf(c, scope, id);
    if (!force && !canDeleteDirectly(impact)) {
      throw new Abort({ ok: false, status: 409, code: "room_not_empty" });
    }
    await orgQuery(
      c,
      scope,
      `update devices set role = 'secondary', seat_id = null, updated_at = now()
       where org_id = $1 and seat_id in (select id from seats where org_id = $1 and room_id = $2)`,
      [id],
    );
    await orgQuery(c, scope, "delete from seats where org_id = $1 and room_id = $2", [id]);
    await orgQuery(c, scope, "delete from rooms where org_id = $1 and id = $2", [id]);
    await writeAudit(c, scope, {
      actorSub,
      action: "room.delete",
      entity: "room",
      entityId: id,
      meta: {
        code: room.code,
        seats: impact.seats,
        devices: impact.placedDevices,
        pending: impact.pendingRequests,
        forced: force,
      },
    });
    return null;
  });
}

/** D30 mechanism for SIM-015.x: call inside the seat-creation transaction. Same row lock as a rename. */
export async function allocateSeatSeq(
  c: Query,
  scope: OrgScope,
  roomId: string,
): Promise<{ seq: number; roomCode: string } | null> {
  const { rows } = await orgQuery<{ seat_counter: number; code: string }>(
    c,
    scope,
    `update rooms set seat_counter = seat_counter + 1, updated_at = now()
     where org_id = $1 and id = $2 returning seat_counter, code`,
    [roomId],
  );
  const r = rows[0];
  // the row now holds the issued number; nextSeatSeq(previous counter) names the rule
  return r ? { seq: nextSeatSeq(r.seat_counter - 1), roomCode: r.code } : null;
}
