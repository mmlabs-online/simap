import "server-only";
import {
  decideDelete,
  decideOccupantChange,
  decideRelease,
  inheritedGroup,
  seatStatus,
} from "@/lib/seats/rules";
import type { Tier } from "@/lib/auth/tier";
import { deviceVisibility, type DeviceVisibility } from "@/lib/devices/visibility";
import { SEAT_LIMITS, type RoomSeatsResponse, type SeatDto } from "@/lib/seats/types";
import { formatSeatCode } from "@/lib/rooms/seat-code";
import type { SeatTagsValue } from "@/lib/validate/group";
import type { CannotSeatValue, OccupantPutValue } from "@/lib/validate/seat";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { allocateSeatSeq } from "@/server/rooms/rooms";
import { seatConflict } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409 | 422;
  code:
    | "not_found"
    | "seat_not_empty"
    | "seat_cannot_seat"
    | "occupant_changed"
    | "not_allowed"
    | "member_not_assignable"
    | "seat_taken"
    | "no_linked_member"
    | "invalid_group"
    | "invalid_project";
};
export type Result<T> = { ok: true; value: T } | Refusal;

const notFound: Refusal = { ok: false, status: 404, code: "not_found" };

/** Thrown inside a transaction to roll it back and answer with a domain refusal. */
class Abort extends Error {
  constructor(readonly refusal: Refusal) {
    super("abort");
  }
}

export async function inTx<T>(pool: Db, fn: (c: TxClient) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    if (seatConflict(err)) return { ok: false, status: 409, code: "seat_not_empty" };
    throw err;
  }
}

export const refuse = (status: Refusal["status"], code: Refusal["code"]) =>
  new Abort({ ok: false, status, code });

// ---- reads ----------------------------------------------------------------------------------------------------

type SeatRow = {
  id: string;
  code: string;
  seq: number;
  room_id: string;
  room_code: string;
  cannot_seat: boolean;
  cannot_seat_reason: string | null;
  occupant_id: string | null;
  occupant_name: string | null;
  occupant_has_photo: boolean | null;
  occupant_photo_version: number | null;
  mine: boolean;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  device_count: number;
  devices: SeatDto["devices"];
};

const toDto = (r: SeatRow): SeatDto => ({
  id: r.id,
  code: r.code,
  seq: r.seq,
  roomId: r.room_id,
  roomCode: r.room_code,
  status: seatStatus(r.occupant_id),
  cannotSeat: r.cannot_seat,
  cannotSeatReason: r.cannot_seat_reason,
  occupant: r.occupant_id
    ? {
        id: r.occupant_id,
        displayName: r.occupant_name!,
        hasPhoto: r.occupant_has_photo!,
        photoVersion: r.occupant_photo_version!,
      }
    : null,
  mine: r.mine,
  group: r.group_id ? { id: r.group_id, name: r.group_name!, color: r.group_color! } : null,
  project: r.project_id ? { id: r.project_id, code: r.project_code!, name: r.project_name! } : null,
  deviceCount: r.device_count,
  devices: r.devices,
});

/**
 * $2 is the caller's sub (for `mine`); `where` and its values start at $3. Every join repeats org_id (R6).
 * `held` (a User, D69): the devices list holds only devices owned by the caller's member; `device_count` stays the total.
 */
async function seatRows(
  db: Query,
  scope: OrgScope,
  sub: string,
  visibility: DeviceVisibility,
  where: string,
  values: unknown[],
  deviceLimit: number,
  limit: number,
): Promise<SeatDto[]> {
  const { rows } = await orgQuery<SeatRow>(
    db,
    scope,
    `select s.id, s.code, s.seq, s.room_id, r.code as room_code, s.cannot_seat, s.cannot_seat_reason,
       s.occupant_id, o.display_name as occupant_name,
       o.photo_drive_file_id is not null as occupant_has_photo, o.photo_version as occupant_photo_version,
       coalesce(o.sub = $2::uuid, false) as mine,
       g.id as group_id, g.name as group_name, g.color as group_color,
       p.id as project_id, p.code as project_code, p.name as project_name,
       (select count(*)::int from devices d where d.org_id = s.org_id and d.seat_id = s.id) as device_count,
       (select coalesce(json_agg(t.j order by t.rn), '[]'::json) from (
          select json_build_object('id', d.id, 'name', d.name, 'type', d.type,
                   'inventoryNumber', d.inventory_number, 'role', d.role,
                   'owner', case when m.id is null then null
                            else json_build_object('id', m.id, 'displayName', m.display_name) end) as j,
                 row_number() over (order by (d.role = 'primary') desc, lower(d.name), d.id) as rn
          from devices d left join members m on m.org_id = d.org_id and m.id = d.owner_id
          where d.org_id = s.org_id and d.seat_id = s.id${
            visibility === "held" ? " and coalesce(m.sub = $2::uuid, false)" : ""
          }
          order by rn limit ${deviceLimit}) t) as devices
     from seats s
       join rooms r on r.org_id = s.org_id and r.id = s.room_id
       left join members o on o.org_id = s.org_id and o.id = s.occupant_id
       left join groups g on g.org_id = s.org_id and g.id = s.group_id
       left join projects p on p.org_id = s.org_id and p.id = s.project_id
     where s.org_id = $1 and ${where}
     order by s.seq, s.id limit ${limit}`,
    [sub, ...values],
  );
  return rows.map(toDto);
}

async function loadSeat(
  db: Query,
  scope: OrgScope,
  sub: string,
  visibility: DeviceVisibility,
  id: string,
): Promise<SeatDto> {
  const rows = await seatRows(
    db,
    scope,
    sub,
    visibility,
    "s.id = $3",
    [id],
    SEAT_LIMITS.detailDevices,
    1,
  );
  return rows[0]!;
}

export async function getSeat(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  id: string,
): Promise<Result<SeatDto>> {
  const rows = await seatRows(
    db,
    scope,
    sub,
    deviceVisibility(tier),
    "s.id = $3",
    [id],
    SEAT_LIMITS.detailDevices,
    1,
  );
  return rows[0] ? { ok: true, value: rows[0] } : notFound;
}

export async function listRoomSeats(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  roomId: string,
): Promise<Result<RoomSeatsResponse>> {
  const { rows } = await orgQuery<{ id: string; code: string; name: string }>(
    db,
    scope,
    "select id, code, name from rooms where org_id = $1 and id = $2",
    [roomId],
  );
  if (!rows[0]) return notFound;
  const seats = await seatRows(
    db,
    scope,
    sub,
    deviceVisibility(tier),
    "s.room_id = $3",
    [roomId],
    SEAT_LIMITS.listDevices,
    SEAT_LIMITS.list + 1,
  );
  return {
    ok: true,
    value: {
      room: rows[0],
      items: seats.slice(0, SEAT_LIMITS.list),
      truncated: seats.length > SEAT_LIMITS.list,
    },
  };
}

// ---- locks (order: member, room, seat, devices; see the comment above deleteRoom in rooms.ts) -----------------

async function lockRoom(
  c: Query,
  scope: OrgScope,
  id: string,
  mode: "update" | "share",
): Promise<{ id: string; code: string }> {
  const { rows } = await orgQuery<{ id: string; code: string }>(
    c,
    scope,
    `select id, code from rooms where org_id = $1 and id = $2 for ${mode}`,
    [id],
  );
  if (!rows[0]) throw new Abort(notFound);
  return rows[0];
}

export type SeatLock = {
  id: string;
  code: string;
  occupant_id: string | null;
  group_id: string | null;
  project_id: string | null;
  cannot_seat: boolean;
  cannot_seat_reason: string | null;
};

/** The seat's room is read unlocked (no API moves a seat), then room, then the seat itself `for update`. */
async function lockSeat(
  c: Query,
  scope: OrgScope,
  seatId: string,
  roomMode: "update" | "share",
): Promise<SeatLock & { roomCode: string }> {
  const { rows: found } = await orgQuery<{ room_id: string }>(
    c,
    scope,
    "select room_id from seats where org_id = $1 and id = $2",
    [seatId],
  );
  if (!found[0]) throw new Abort(notFound);
  return lockSeatIn(c, scope, found[0].room_id, seatId, roomMode);
}

export async function lockSeatIn(
  c: Query,
  scope: OrgScope,
  roomId: string,
  seatId: string,
  roomMode: "update" | "share",
): Promise<SeatLock & { roomCode: string }> {
  const room = await lockRoom(c, scope, roomId, roomMode);
  const { rows } = await orgQuery<SeatLock>(
    c,
    scope,
    `select id, code, occupant_id, group_id, project_id, cannot_seat, cannot_seat_reason
     from seats where org_id = $1 and id = $2 for update`,
    [seatId],
  );
  if (!rows[0]) throw new Abort(notFound);
  return { ...rows[0], roomCode: room.code };
}

/** DEV-06: the primary device on the seat becomes secondary; returns how many were demoted. */
async function demotePrimary(c: Query, scope: OrgScope, seatId: string): Promise<number> {
  const { rows } = await orgQuery(
    c,
    scope,
    `update devices set role = 'secondary', updated_at = now()
     where org_id = $1 and seat_id = $2 and role = 'primary' returning id`,
    [seatId],
  );
  return rows.length;
}

// ---- writes ---------------------------------------------------------------------------------------------------

/** The shared SEA-03 write step: demote the primary device (DEV-06), set occupant and group, audit. */
export async function writeOccupant(
  c: Query,
  scope: OrgScope,
  actorSub: string,
  seat: SeatLock,
  memberId: string | null,
  groupId: string | null,
  action: "seat.assign" | "seat.replace" | "seat.unassign",
  extraMeta: Record<string, unknown> = {},
): Promise<number> {
  const demoted = await demotePrimary(c, scope, seat.id);
  await orgQuery(
    c,
    scope,
    "update seats set occupant_id = $3, group_id = $4, updated_at = now() where org_id = $1 and id = $2",
    [seat.id, memberId, groupId],
  );
  await writeAudit(c, scope, {
    actorSub,
    action,
    entity: "seat",
    entityId: seat.id,
    meta: {
      code: seat.code,
      memberId,
      previousOccupantId: seat.occupant_id,
      demoted,
      groupInherited: seat.group_id === null && groupId !== null,
      ...extraMeta,
    },
  });
  return demoted;
}

export function addSeats(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  roomId: string,
  count: number,
): Promise<Result<SeatDto[]>> {
  return inTx(db, async (c) => {
    const room = await lockRoom(c, scope, roomId, "update");
    const seqs: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = await allocateSeatSeq(c, scope, roomId);
      if (!a) throw new Abort(notFound);
      seqs.push(a.seq);
    }
    // the room code may not change inside this tx: the room row is locked
    const codes = seqs.map((n) => formatSeatCode(room.code, n));
    const { rows } = await orgQuery<{ id: string; code: string }>(
      c,
      scope,
      `insert into seats (org_id, room_id, seq, code)
       select o.org_id, $2::uuid, v.seq, v.code
       from (select $1::uuid as org_id) o, unnest($3::int[], $4::text[]) as v(seq, code)
       where o.org_id = $1::uuid returning id, code`,
      [roomId, seqs, codes],
    );
    for (const r of rows) {
      await writeAudit(c, scope, {
        actorSub,
        action: "seat.create",
        entity: "seat",
        entityId: r.id,
        meta: { code: r.code, room: room.code },
      });
    }
    return seatRows(
      c,
      scope,
      actorSub,
      "org", // route is Manager+/Admin, D69 filter not needed
      "s.id = any($3::uuid[])",
      [rows.map((r) => r.id)],
      SEAT_LIMITS.detailDevices,
      count,
    );
  });
}

export function deleteSeat(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
): Promise<Result<null>> {
  return inTx(db, async (c) => {
    const seat = await lockSeat(c, scope, seatId, "update");
    const { rows: dev } = await orgQuery<{ n: number }>(
      c,
      scope,
      "select count(*)::int as n from devices where org_id = $1 and seat_id = $2",
      [seatId],
    );
    const decision = decideDelete({ occupantId: seat.occupant_id, deviceCount: dev[0]!.n });
    if (decision === "refuse") throw refuse(409, "seat_not_empty");
    const { rows: req } = await orgQuery<{ n: number }>(
      c,
      scope,
      "select count(*)::int as n from seat_requests where org_id = $1 and seat_id = $2",
      [seatId],
    );
    await orgQuery(c, scope, "delete from seats where org_id = $1 and id = $2", [seatId]);
    await writeAudit(c, scope, {
      actorSub,
      action: "seat.delete",
      entity: "seat",
      entityId: seatId,
      meta: { code: seat.code, room: seat.roomCode, droppedRequests: req[0]!.n },
    });
    return null;
  });
}

export function setOccupant(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
  v: OccupantPutValue,
): Promise<Result<SeatDto>> {
  return inTx(db, async (c) => {
    // Unlocked read only to find the room; a missing seat answers 404 before any lock is taken.
    const { rows: found } = await orgQuery<{ room_id: string }>(
      c,
      scope,
      "select room_id from seats where org_id = $1 and id = $2",
      [seatId],
    );
    if (!found[0]) throw new Abort(notFound);
    // 1. the member row first (the seats.occupant_id FK takes KEY SHARE on it; deactivateMember locks it first)
    let memberGroup: string | null = null;
    if (v.memberId !== null) {
      const { rows } = await orgQuery<{ id: string; status: string; group_id: string | null }>(
        c,
        scope,
        "select id, status, group_id from members where org_id = $1 and id = $2 for share",
        [v.memberId],
      );
      if (!rows[0] || rows[0].status !== "active") throw refuse(422, "member_not_assignable");
      memberGroup = rows[0].group_id;
    }
    // 2-3. room for share, seat for update
    const seat = await lockSeatIn(c, scope, found[0].room_id, seatId, "share");
    const decision = decideOccupantChange({
      current: seat.occupant_id,
      target: v.memberId,
      expected: v.expectedOccupantId,
      cannotSeat: seat.cannot_seat,
    });
    if (decision === "refuse_changed") throw refuse(409, "occupant_changed");
    if (decision === "refuse_cannot_seat") throw refuse(409, "seat_cannot_seat");
    if (decision === "noop") return loadSeat(c, scope, actorSub, "org", seatId);
    const groupId =
      decision === "remove" ? seat.group_id : inheritedGroup(seat.group_id, memberGroup);
    await writeOccupant(
      c,
      scope,
      actorSub,
      seat,
      v.memberId,
      groupId,
      decision === "assign"
        ? "seat.assign"
        : decision === "replace"
          ? "seat.replace"
          : "seat.unassign",
    );
    return loadSeat(c, scope, actorSub, "org", seatId);
  });
}

export function releaseSeat(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  seatId: string,
): Promise<Result<SeatDto>> {
  return inTx(db, async (c) => {
    const { rows: me } = await orgQuery<{ id: string }>(
      c,
      scope,
      "select id from members where org_id = $1 and sub = $2",
      [actorSub],
    );
    const seat = await lockSeat(c, scope, seatId, "share");
    const decision = decideRelease({ current: seat.occupant_id, actorMemberId: me[0]?.id ?? null });
    if (decision === "refuse") throw refuse(409, "not_allowed");
    if (decision === "noop") return loadSeat(c, scope, actorSub, deviceVisibility(tier), seatId);
    const demoted = await demotePrimary(c, scope, seatId);
    await orgQuery(
      c,
      scope,
      "update seats set occupant_id = null, updated_at = now() where org_id = $1 and id = $2",
      [seatId],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "seat.release",
      entity: "seat",
      entityId: seatId,
      meta: { code: seat.code, demoted },
    });
    return loadSeat(c, scope, actorSub, deviceVisibility(tier), seatId);
  });
}

export function setCannotSeat(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
  v: CannotSeatValue,
): Promise<Result<SeatDto>> {
  return inTx(db, async (c) => {
    const seat = await lockSeat(c, scope, seatId, "share");
    const reason = v.cannotSeat ? v.reason : null;
    if (seat.cannot_seat === v.cannotSeat && seat.cannot_seat_reason === reason) {
      return loadSeat(c, scope, actorSub, "org", seatId);
    }
    await orgQuery(
      c,
      scope,
      `update seats set cannot_seat = $3, cannot_seat_reason = $4, updated_at = now()
       where org_id = $1 and id = $2`,
      [seatId, v.cannotSeat, reason],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "seat.cannot_seat",
      entity: "seat",
      entityId: seatId,
      meta: { code: seat.code, cannotSeat: v.cannotSeat, hasReason: reason !== null },
    });
    return loadSeat(c, scope, actorSub, "org", seatId);
  });
}

/** SEA-04 / GRP-02: sets or clears a seat's group and/or project; tags never affect permissions or the occupant. */
export function setSeatTags(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
  v: SeatTagsValue,
): Promise<Result<SeatDto>> {
  return inTx(db, async (c) => {
    const seat = await lockSeat(c, scope, seatId, "share");
    const next = {
      group_id: v.groupId === undefined ? seat.group_id : v.groupId,
      project_id: v.projectId === undefined ? seat.project_id : v.projectId,
    };
    if (next.group_id === seat.group_id && next.project_id === seat.project_id) {
      return loadSeat(c, scope, actorSub, "org", seatId);
    }
    // A newly referenced row is held `for share`: a concurrent delete waits (then clears this seat) or we fail here.
    // An unchanged id is not locked: the FK already keeps it, and locking it could deadlock with a forced delete.
    if (v.groupId && v.groupId !== seat.group_id) {
      const { rows } = await orgQuery(
        c,
        scope,
        "select id from groups where org_id = $1 and id = $2 for share",
        [v.groupId],
      );
      if (!rows[0]) throw refuse(422, "invalid_group");
    }
    if (v.projectId && v.projectId !== seat.project_id) {
      const { rows } = await orgQuery(
        c,
        scope,
        "select id from projects where org_id = $1 and id = $2 for share",
        [v.projectId],
      );
      if (!rows[0]) throw refuse(422, "invalid_project");
    }
    await orgQuery(
      c,
      scope,
      `update seats set group_id = $3, project_id = $4, updated_at = now()
       where org_id = $1 and id = $2`,
      [seatId, next.group_id, next.project_id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "seat.tags",
      entity: "seat",
      entityId: seatId,
      meta: { code: seat.code, groupId: next.group_id, projectId: next.project_id },
    });
    return loadSeat(c, scope, actorSub, "org", seatId);
  });
}
