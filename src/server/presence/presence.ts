import "server-only";
import { decideCheckIn, decideMove, type ActiveRef } from "@/lib/presence/rules";
import type { MyPresenceDto, MyPresenceResponse } from "@/lib/presence/types";
import { workDateUtc7 } from "@/lib/presence/work-date";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { ACTIVE_COLUMNS, activeWhere, CHECKED_IN_AT, PRESENCE_FROM } from "./sql";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409 | 422;
  code:
    | "not_found"
    | "already_checked_in"
    | "not_checked_in"
    | "no_seat_in_room"
    | "seat_not_yours"
    | "no_linked_member"
    | "member_not_assignable";
  /** Code of the room the member is checked in to (409 `already_checked_in`). */
  room?: string;
};
export type Result<T> = { ok: true; value: T } | Refusal;

const refusal = (status: Refusal["status"], code: Refusal["code"], room?: string): Refusal =>
  room === undefined ? { ok: false, status, code } : { ok: false, status, code, room };

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
    throw err;
  }
}

type ActiveRow = {
  id: string;
  seat_id: string;
  room_id: string;
  seat_code: string;
  room_code: string;
  checked_in_at: string;
  source: MyPresenceDto["source"];
};

const toDto = (r: ActiveRow): MyPresenceDto => ({
  roomId: r.room_id,
  roomCode: r.room_code,
  seatId: r.seat_id,
  seatCode: r.seat_code,
  checkedInAt: r.checked_in_at,
  source: r.source,
});

const ref = (r: ActiveRow | undefined): ActiveRef | null =>
  r ? { roomId: r.room_id, seatId: r.seat_id } : null;

/**
 * Locks the caller's member row `for no key update`: it serialises one member's presence writes (and an `apiFetch`
 * re-send), waits for `deactivateMember`'s `for update`, and does not block the seat FK checks. Presence rows are
 * always locked last (rooms.ts lock order).
 */
async function lockOwnMember(c: Query, scope: OrgScope, sub: string, requireActive: boolean) {
  const { rows } = await orgQuery<{ id: string; status: string }>(
    c,
    scope,
    "select id, status from members where org_id = $1 and sub = $2 for no key update",
    [sub],
  );
  if (!rows[0]) throw new Abort(refusal(422, "no_linked_member"));
  if (requireActive && rows[0].status !== "active") {
    throw new Abort(refusal(422, "member_not_assignable"));
  }
  return rows[0].id;
}

async function loadActive(
  c: Query,
  scope: OrgScope,
  memberId: string,
  today: string,
): Promise<ActiveRow | undefined> {
  const { rows } = await orgQuery<ActiveRow>(
    c,
    scope,
    `select ${ACTIVE_COLUMNS} from ${PRESENCE_FROM}
     where p.org_id = $1 and p.member_id = $2 and ${activeWhere("$3")}`,
    [memberId, today],
  );
  return rows[0];
}

/** PRE-03: check in to a room by the member's lowest seat there (D77); same room again is a no-op; reopen on D81. */
export function checkIn(
  db: Db,
  scope: OrgScope,
  sub: string,
  roomId: string,
  now: Date = new Date(),
): Promise<Result<MyPresenceDto>> {
  const today = workDateUtc7(now);
  return inTx(db, async (c) => {
    const memberId = await lockOwnMember(c, scope, sub, true);
    const active = await loadActive(c, scope, memberId, today);
    const { rows: room } = await orgQuery<{ id: string; code: string }>(
      c,
      scope,
      "select id, code from rooms where org_id = $1 and id = $2 for share",
      [roomId],
    );
    if (!room[0]) throw new Abort(refusal(404, "not_found"));
    const { rows: seat } = await orgQuery<{ id: string; code: string }>(
      c,
      scope,
      `select id, code from seats where org_id = $1 and room_id = $2 and occupant_id = $3
       order by seq limit 1 for share`,
      [roomId, memberId],
    );
    const { rows: today_ } = await orgQuery<{ id: string }>(
      c,
      scope,
      "select id from presence where org_id = $1 and member_id = $2 and work_date = $3::date",
      [memberId, today],
    );
    const decision = decideCheckIn({
      active: ref(active),
      roomId,
      todayRowExists: today_.length > 0,
      lowestSeatId: seat[0]?.id ?? null,
    });
    if (decision === "same") return toDto(active!);
    if (decision === "refuse_other_room") {
      throw new Abort(refusal(409, "already_checked_in", active!.room_code));
    }
    if (decision === "refuse_no_seat") throw new Abort(refusal(422, "no_seat_in_room"));
    let id: string;
    if (decision === "reopen") {
      id = today_[0]!.id;
      await orgQuery(
        c,
        scope,
        `update presence set seat_id = $3, source = 'self', checked_in_at = $4::timestamptz,
           checked_out_at = null, checked_out_by = null, updated_at = now()
         where org_id = $1 and id = $2`,
        [id, seat[0]!.id, now.toISOString()],
      );
    } else {
      const { rows } = await orgQuery<{ id: string }>(
        c,
        scope,
        `insert into presence (org_id, member_id, seat_id, work_date, checked_in_at, source)
         select o.org_id, $2::uuid, $3::uuid, $4::date, $5::timestamptz, 'self'
         from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
        [memberId, seat[0]!.id, today, now.toISOString()],
      );
      id = rows[0]!.id;
    }
    await writeAudit(c, scope, {
      actorSub: sub,
      action: "presence.check_in",
      entity: "presence",
      entityId: id,
      meta: { room: room[0].code, seat: seat[0]!.code, reopened: decision === "reopen" },
    });
    return toDto((await loadActive(c, scope, memberId, today))!);
  });
}

/** Check out; with nothing open today nothing changes and the answer is still 200. */
export function checkOut(
  db: Db,
  scope: OrgScope,
  sub: string,
  now: Date = new Date(),
): Promise<Result<null>> {
  const today = workDateUtc7(now);
  return inTx(db, async (c) => {
    const memberId = await lockOwnMember(c, scope, sub, false);
    const { rows } = await orgQuery<{ id: string; seat_id: string }>(
      c,
      scope,
      `update presence
       set checked_out_at = greatest($3::timestamptz, checked_in_at), checked_out_by = 'self', updated_at = now()
       where org_id = $1 and member_id = $2 and work_date = $4::date and checked_out_at is null
       returning id, seat_id`,
      [memberId, now.toISOString(), today],
    );
    if (rows[0]) {
      const { rows: codes } = await orgQuery<{ seat_code: string; room_code: string }>(
        c,
        scope,
        `select s.code as seat_code, r.code as room_code from seats s
         join rooms r on r.org_id = s.org_id and r.id = s.room_id
         where s.org_id = $1 and s.id = $2`,
        [rows[0].seat_id],
      );
      await writeAudit(c, scope, {
        actorSub: sub,
        action: "presence.check_out",
        entity: "presence",
        entityId: rows[0].id,
        meta: { room: codes[0]?.room_code, seat: codes[0]?.seat_code },
      });
    }
    return null;
  });
}

/** D77: move to another of the member's own seats in the room of the active check-in. */
export function moveSeat(
  db: Db,
  scope: OrgScope,
  sub: string,
  seatId: string,
  now: Date = new Date(),
): Promise<Result<MyPresenceDto>> {
  const today = workDateUtc7(now);
  type SeatRow = { id: string; room_id: string; occupant_id: string | null };
  const seatsOf = (c: Query, ids: string[], lock: boolean) =>
    orgQuery<SeatRow>(
      c,
      scope,
      `select id, room_id, occupant_id from seats where org_id = $1 and id = any($2::uuid[])
       order by id ${lock ? "for share" : ""}`,
      [ids],
    );
  return inTx(db, async (c) => {
    const memberId = await lockOwnMember(c, scope, sub, false);
    const active = await loadActive(c, scope, memberId, today);
    if (!active) throw new Abort(refusal(409, "not_checked_in"));
    await orgQuery(c, scope, "select id from rooms where org_id = $1 and id = $2 for share", [
      active.room_id,
    ]);
    const { rows } = await seatsOf(c, [active.seat_id, seatId], true);
    const old = rows.find((r) => r.id === active.seat_id);
    if (!old || old.occupant_id !== memberId) throw new Abort(refusal(409, "not_checked_in"));
    const t = rows.find((r) => r.id === seatId);
    const decision = decideMove({
      active: ref(active),
      memberId,
      target: t ? { id: t.id, roomId: t.room_id, occupantId: t.occupant_id } : null,
    });
    if (decision === "refuse_not_yours") throw new Abort(refusal(422, "seat_not_yours"));
    if (decision === "move") {
      await orgQuery(
        c,
        scope,
        "update presence set seat_id = $3, updated_at = now() where org_id = $1 and id = $2",
        [active.id, seatId],
      );
      const { rows: to } = await orgQuery<{ code: string }>(
        c,
        scope,
        "select code from seats where org_id = $1 and id = $2",
        [seatId],
      );
      await writeAudit(c, scope, {
        actorSub: sub,
        action: "presence.move",
        entity: "presence",
        entityId: active.id,
        meta: { room: active.room_code, from: active.seat_code, to: to[0]?.code },
      });
    }
    return toDto((await loadActive(c, scope, memberId, today))!);
  });
}

/** The caller's own state: the active check-in (if any) and the latest check-in per room, newest first. */
export async function getMyPresence(
  db: Query,
  scope: OrgScope,
  sub: string,
  now: Date = new Date(),
): Promise<MyPresenceResponse> {
  const workDate = workDateUtc7(now);
  const { rows: me } = await orgQuery<{ id: string }>(
    db,
    scope,
    "select id from members where org_id = $1 and sub = $2",
    [sub],
  );
  if (!me[0]) return { workDate, presence: null, recent: [] };
  const active = await loadActive(db, scope, me[0].id, workDate);
  const { rows } = await orgQuery<{ room_id: string; room_code: string; last: string }>(
    db,
    scope,
    `select t.room_id, t.room_code, t.last from (
       select distinct on (r.id) r.id as room_id, r.code as room_code, p.checked_in_at,
              ${CHECKED_IN_AT} as last
       from ${PRESENCE_FROM}
       where p.org_id = $1 and p.member_id = $2
       order by r.id, p.checked_in_at desc
     ) t order by t.checked_in_at desc limit 100`,
    [me[0].id],
  );
  return {
    workDate,
    presence: active ? toDto(active) : null,
    recent: rows.map((r) => ({
      roomId: r.room_id,
      roomCode: r.room_code,
      lastCheckedInAt: r.last,
    })),
  };
}
