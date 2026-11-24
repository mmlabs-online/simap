import "server-only";
import { decideApprove, decideCancel, decideCreate, nextStatus } from "@/lib/requests/rules";
import type { RequestCreateResult, RequestDto, RequestStatus } from "@/lib/requests/types";
import { inheritedGroup } from "@/lib/seats/rules";
import { writeAudit } from "@/server/audit/write";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import {
  inTx,
  lockSeatIn,
  refuse,
  writeOccupant,
  type Db,
  type Result,
} from "@/server/seats/seats";

type Query = Pick<Db, "query">;

type MemberLock = { id: string; sub: string; status: string; group_id: string | null };

/**
 * Lock order: members, room, seat, seat_requests rows (extends seats.ts). One statement ordered by id, so two
 * member locks cannot deadlock. Returns the rows found for `sub` and `ids`.
 */
async function lockMembers(
  c: Query,
  scope: OrgScope,
  a: { sub?: string; ids?: string[] },
): Promise<MemberLock[]> {
  const { rows } = await orgQuery<MemberLock>(
    c,
    scope,
    `select id, sub, status, group_id from members
     where org_id = $1 and (sub = $2::uuid or id = any($3::uuid[])) order by id for share`,
    [a.sub ?? null, a.ids ?? []],
  );
  return rows;
}

type RequestRow = {
  id: string;
  status: RequestStatus;
  seat_id: string;
  seat_code: string;
  room_id: string;
  room_code: string;
  subject_id: string;
  subject_name: string;
  created_at: string;
  decided_at: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
};

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

/** Every join repeats org_id (R6). */
async function loadRequest(c: Query, scope: OrgScope, id: string): Promise<RequestDto> {
  const { rows } = await orgQuery<RequestRow>(
    c,
    scope,
    `select q.id, q.status, q.seat_id, s.code as seat_code, s.room_id, r.code as room_code,
       q.subject_id, m.display_name as subject_name,
       to_char(q.created_at at time zone 'UTC', ${ISO}) as created_at,
       to_char(q.decided_at at time zone 'UTC', ${ISO}) as decided_at,
       q.decided_by_id, d.display_name as decided_by_name
     from seat_requests q
       join seats s on s.org_id = q.org_id and s.id = q.seat_id
       join rooms r on r.org_id = s.org_id and r.id = s.room_id
       join members m on m.org_id = q.org_id and m.id = q.subject_id
       left join members d on d.org_id = q.org_id and d.id = q.decided_by_id
     where q.org_id = $1 and q.id = $2`,
    [id],
  );
  const r = rows[0]!;
  return {
    id: r.id,
    status: r.status,
    seat: { id: r.seat_id, code: r.seat_code, roomId: r.room_id, roomCode: r.room_code },
    subject: { id: r.subject_id, displayName: r.subject_name },
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by_id ? { id: r.decided_by_id, displayName: r.decided_by_name! } : null,
  };
}

/** The request row `for update`; null when it does not exist (or, with `subjectId`, is not that member's). */
async function lockRequest(
  c: Query,
  scope: OrgScope,
  id: string,
  subjectId?: string,
): Promise<{ status: RequestStatus; seat_id: string; subject_id: string } | null> {
  const { rows } = await orgQuery<{ status: RequestStatus; seat_id: string; subject_id: string }>(
    c,
    scope,
    `select status, seat_id, subject_id from seat_requests
     where org_id = $1 and id = $2 and ($3::uuid is null or subject_id = $3::uuid) for update`,
    [id, subjectId ?? null],
  );
  return rows[0] ?? null;
}

export function createRequest(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  seatId: string,
): Promise<Result<RequestCreateResult>> {
  return inTx(db, async (c) => {
    const me = (await lockMembers(c, scope, { sub: actorSub }))[0];
    if (!me) throw refuse(422, "no_linked_member");
    if (me.status !== "active") throw refuse(422, "member_not_assignable");
    const { rows: found } = await orgQuery<{ room_id: string }>(
      c,
      scope,
      "select room_id from seats where org_id = $1 and id = $2",
      [seatId],
    );
    if (!found[0]) throw refuse(404, "not_found");
    const seat = await lockSeatIn(c, scope, found[0].room_id, seatId, "share");
    const decision = decideCreate({ occupantId: seat.occupant_id, cannotSeat: seat.cannot_seat });
    if (decision === "refuse_taken") throw refuse(409, "seat_taken");
    if (decision === "refuse_cannot_seat") throw refuse(409, "seat_cannot_seat");
    // The partial unique index is the authority on duplicates.
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into seat_requests (org_id, seat_id, subject_id, created_by_id)
       select o.org_id, $2::uuid, $3::uuid, $3::uuid
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid
       on conflict (org_id, seat_id, subject_id) where status = 'pending' do nothing returning id`,
      [seatId, me.id],
    );
    let id = ins[0]?.id;
    if (id) {
      await writeAudit(c, scope, {
        actorSub,
        action: "request.create",
        entity: "seat_request",
        entityId: id,
        meta: { seat: seat.code, room: seat.roomCode },
      });
    } else {
      const { rows } = await orgQuery<{ id: string }>(
        c,
        scope,
        `select id from seat_requests
         where org_id = $1 and seat_id = $2 and subject_id = $3 and status = 'pending'`,
        [seatId, me.id],
      );
      id = rows[0]!.id;
    }
    return { created: ins.length > 0, request: await loadRequest(c, scope, id) };
  });
}

export function approveRequest(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<Result<RequestDto>> {
  return inTx(db, async (c) => {
    const { rows: found } = await orgQuery<{
      status: RequestStatus;
      seat_id: string;
      subject_id: string;
      room_id: string;
    }>(
      c,
      scope,
      `select r.status, r.seat_id, r.subject_id, s.room_id
       from seat_requests r join seats s on s.org_id = r.org_id and s.id = r.seat_id
       where r.org_id = $1 and r.id = $2`,
      [id],
    );
    const req = found[0];
    if (!req) throw refuse(404, "not_found");
    if (req.status !== "pending") return loadRequest(c, scope, id);

    const members = await lockMembers(c, scope, { sub: actorSub, ids: [req.subject_id] });
    const subject = members.find((m) => m.id === req.subject_id);
    if (!subject || subject.status !== "active") throw refuse(422, "member_not_assignable");
    const actor = members.find((m) => m.sub === actorSub) ?? null;

    const seat = await lockSeatIn(c, scope, req.room_id, req.seat_id, "share");
    const locked = await lockRequest(c, scope, id);
    if (!locked) throw refuse(404, "not_found");
    const decision = decideApprove({
      status: locked.status,
      occupantId: seat.occupant_id,
      cannotSeat: seat.cannot_seat,
    });
    if (decision === "noop") return loadRequest(c, scope, id);
    if (decision === "refuse_taken") throw refuse(409, "seat_taken");
    if (decision === "refuse_cannot_seat") throw refuse(409, "seat_cannot_seat");

    await writeOccupant(
      c,
      scope,
      actorSub,
      seat,
      subject.id,
      inheritedGroup(seat.group_id, subject.group_id),
      "seat.assign",
      { requestId: id },
    );
    await orgQuery(
      c,
      scope,
      `update seat_requests set status = 'approved', decided_by_id = $3, decided_at = now(), updated_at = now()
       where org_id = $1 and id = $2`,
      [id, actor?.id ?? null],
    );
    const { rows: rivals } = await orgQuery<{ id: string }>(
      c,
      scope,
      `update seat_requests set status = 'rejected', decided_by_id = $4, decided_at = now(), updated_at = now()
       where org_id = $1 and seat_id = $2 and status = 'pending' and id <> $3 returning id`,
      [req.seat_id, id, actor?.id ?? null],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "request.approve",
      entity: "seat_request",
      entityId: id,
      meta: { seat: seat.code, subjectId: subject.id, rejectedRivals: rivals.length },
    });
    for (const r of rivals) {
      await writeAudit(c, scope, {
        actorSub,
        action: "request.reject",
        entity: "seat_request",
        entityId: r.id,
        meta: { seat: seat.code, auto: true, approvedRequestId: id },
      });
    }
    return loadRequest(c, scope, id);
  });
}

export function rejectRequest(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<Result<RequestDto>> {
  return inTx(db, async (c) => {
    const actor = (await lockMembers(c, scope, { sub: actorSub }))[0] ?? null;
    const req = await lockRequest(c, scope, id);
    if (!req) throw refuse(404, "not_found");
    if (nextStatus(req.status, "reject") === null) return loadRequest(c, scope, id);
    await orgQuery(
      c,
      scope,
      `update seat_requests set status = 'rejected', decided_by_id = $3, decided_at = now(), updated_at = now()
       where org_id = $1 and id = $2`,
      [id, actor?.id ?? null],
    );
    const { rows } = await orgQuery<{ code: string }>(
      c,
      scope,
      "select code from seats where org_id = $1 and id = $2",
      [req.seat_id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "request.reject",
      entity: "seat_request",
      entityId: id,
      meta: { seat: rows[0]?.code ?? null },
    });
    return loadRequest(c, scope, id);
  });
}

export function cancelRequest(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<Result<RequestDto>> {
  return inTx(db, async (c) => {
    const me = (await lockMembers(c, scope, { sub: actorSub }))[0];
    if (!me) throw refuse(404, "not_found");
    // Another member's request answers 404 too, so existence does not leak.
    const req = await lockRequest(c, scope, id, me.id);
    if (!req) throw refuse(404, "not_found");
    const decision = decideCancel({ status: req.status, isOwner: true });
    if (decision === "refuse") throw refuse(404, "not_found");
    if (decision === "noop") return loadRequest(c, scope, id);
    await orgQuery(
      c,
      scope,
      `update seat_requests set status = 'cancelled', decided_by_id = $3, decided_at = now(), updated_at = now()
       where org_id = $1 and id = $2`,
      [id, me.id],
    );
    const { rows } = await orgQuery<{ code: string }>(
      c,
      scope,
      "select code from seats where org_id = $1 and id = $2",
      [req.seat_id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "request.cancel",
      entity: "seat_request",
      entityId: id,
      meta: { seat: rows[0]?.code ?? null },
    });
    return loadRequest(c, scope, id);
  });
}
