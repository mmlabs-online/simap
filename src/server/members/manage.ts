import "server-only";
import type { Tier } from "@/lib/auth/tier";
import { deviceVisibility } from "@/lib/devices/visibility";
import { encodeMemberCursor } from "@/lib/members/cursor";
import { decideDeactivation } from "@/lib/members/deactivation";
import { changedFields } from "@/lib/members/profile";
import { escapeLike } from "@/lib/members/search";
import { foldSql, foldText } from "@/lib/search/fold";
import {
  MEMBER_LIMITS,
  type DeactivationImpact,
  type MemberDeviceRef,
  type MemberDto,
  type MemberGroupRef,
  type MemberListResponse,
  type MemberSeatRef,
  type MemberStatus,
  type PendingInvitationDto,
} from "@/lib/members/types";
import type { MemberFilter } from "@/lib/validate/member-query";
import type { MemberPatchValue } from "@/lib/validate/member";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { endPresenceForMember } from "@/server/presence/end";
import { memberConflict } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 400 | 404 | 409;
  code:
    | "invalid_request"
    | "not_found"
    | "employee_code_taken"
    | "member_not_empty"
    | "cannot_deactivate_self";
};
export type Result<T> = { ok: true; value: T } | Refusal;

const notFound: Refusal = { ok: false, status: 404, code: "not_found" };
const invalidRequest: Refusal = { ok: false, status: 400, code: "invalid_request" };

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
    const conflict = memberConflict(err);
    if (conflict === "employee_code_taken") {
      return { ok: false, status: 409, code: "employee_code_taken" };
    }
    if (conflict === "invalid_group") return invalidRequest;
    throw err;
  }
}

type MemberRow = {
  id: string;
  display_name: string;
  email: string | null;
  employee_code: string | null;
  status: MemberStatus;
  sort_key: string;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  has_photo: boolean;
  photo_version: number;
  seat_count: number;
  device_count: number | null;
  seats: MemberSeatRef[];
  devices: {
    id: string;
    name: string;
    inventory_number: string;
    role: "primary" | "secondary";
    seat_id: string | null;
    seat_code: string | null;
  }[];
};

const toDto = (r: MemberRow): MemberDto => ({
  id: r.id,
  displayName: r.display_name,
  email: r.email,
  employeeCode: r.employee_code,
  group:
    r.group_id === null
      ? null
      : { id: r.group_id, name: r.group_name as string, color: r.group_color as string },
  status: r.status,
  hasPhoto: r.has_photo,
  photoVersion: r.photo_version,
  seatCount: r.seat_count,
  deviceCount: r.device_count,
  seats: r.seats,
  devices: r.devices.map((d): MemberDeviceRef => ({
    id: d.id,
    name: d.name,
    inventoryNumber: d.inventory_number,
    role: d.role,
    seatId: d.seat_id,
    seatCode: d.seat_code,
  })),
});

/**
 * Counts and capped ref lists are correlated subqueries (never one join fan-out); each repeats org_id = $1.
 * `visible` is a SQL boolean for the device count and refs (a User sees only their own, D69); null = always.
 */
const memberSelect = (refCap: number, visible: string | null) => `select m.id, m.display_name,
    ${visible ? `case when ${visible} then m.email end` : "m.email"} as email, m.employee_code, m.status,
    lower(m.display_name) as sort_key, g.id as group_id, g.name as group_name, g.color as group_color,
    m.photo_drive_file_id is not null as has_photo, m.photo_version,
    (select count(*)::int from seats s where s.org_id = $1 and s.occupant_id = m.id) as seat_count,
    ${visible ? `case when ${visible} then ` : ""}(select count(*)::int from devices d where d.org_id = $1 and d.owner_id = m.id)${visible ? " end" : ""} as device_count,
    coalesce((select json_agg(x) from (
      select s.id, s.code from seats s where s.org_id = $1 and s.occupant_id = m.id
      order by s.code, s.id limit ${refCap}) x), '[]'::json) as seats,
    ${visible ? `case when ${visible} then ` : ""}coalesce((select json_agg(x) from (
      select d.id, d.name, d.inventory_number, d.role, d.seat_id, ds.code as seat_code
      from devices d left join seats ds on ds.org_id = d.org_id and ds.id = d.seat_id
      where d.org_id = $1 and d.owner_id = m.id
      order by d.name, d.id limit ${refCap}) x), '[]'::json)${visible ? " else '[]'::json end" : ""} as devices
  from members m left join groups g on g.org_id = m.org_id and g.id = m.group_id
  where m.org_id = $1`;

export async function listGroupOptions(db: Query, scope: OrgScope): Promise<MemberGroupRef[]> {
  const { rows } = await orgQuery<MemberGroupRef>(
    db,
    scope,
    `select id, name, color from groups where org_id = $1 order by lower(name), id limit ${MEMBER_LIMITS.groups}`,
  );
  return rows;
}

export async function listMembers(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  f: MemberFilter,
): Promise<MemberListResponse> {
  const values: unknown[] = [];
  const conds: string[] = [];
  const bind = (v: unknown): string => {
    values.push(v);
    return `$${values.length + 1}`;
  };
  // Bound first so it is $2 (D69: a User sees device data only on their own row).
  const visible =
    deviceVisibility(tier) === "held" ? `coalesce(m.sub = ${bind(sub)}::uuid, false)` : null;
  if (f.status !== "all") conds.push(`m.status = ${bind(f.status)}`);
  if (f.q !== undefined) {
    const p = bind(`%${escapeLike(foldText(f.q))}%`);
    const like = (col: string) => `${foldSql(col)} like ${p} escape '\\'`;
    const email = visible ? `(${like("m.email")} and ${visible})` : like("m.email");
    conds.push(`(${like("m.display_name")} or ${email} or ${like("m.employee_code")})`);
  }
  if (f.cursor) {
    conds.push(
      `(lower(m.display_name), m.id) > (${bind(f.cursor.k)}::text, ${bind(f.cursor.id)}::uuid)`,
    );
  }
  const limit = bind(f.limit + 1);
  const { rows } = await orgQuery<MemberRow>(
    db,
    scope,
    `${memberSelect(MEMBER_LIMITS.listRefs, visible)}${conds.map((c) => ` and ${c}`).join("")}
     order by lower(m.display_name), m.id limit ${limit}`,
    values,
  );
  const page = rows.slice(0, f.limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > f.limit && last ? encodeMemberCursor({ k: last.sort_key, id: last.id }) : null;
  return { items: page.map(toDto), nextCursor, groups: await listGroupOptions(db, scope) };
}

async function loadMember(
  db: Query,
  scope: OrgScope,
  id: string,
  viewerSub: string | null,
): Promise<MemberDto | null> {
  const visible = viewerSub === null ? null : "coalesce(m.sub = $3::uuid, false)";
  const { rows } = await orgQuery<MemberRow>(
    db,
    scope,
    `${memberSelect(MEMBER_LIMITS.detailRefs, visible)} and m.id = $2`,
    viewerSub === null ? [id] : [id, viewerSub],
  );
  return rows[0] ? toDto(rows[0]) : null;
}

export async function getMember(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  id: string,
): Promise<Result<MemberDto>> {
  const dto = await loadMember(db, scope, id, deviceVisibility(tier) === "held" ? sub : null);
  return dto ? { ok: true, value: dto } : notFound;
}

export async function listPendingInvitations(
  db: Query,
  scope: OrgScope,
): Promise<PendingInvitationDto[]> {
  const { rows } = await orgQuery<{
    id: string;
    email: string;
    role: string;
    created_at: Date;
    expires_at: Date | null;
  }>(
    db,
    scope,
    `select id, email, role, created_at, expires_at from invitations
     where org_id = $1 and status = 'pending' and (expires_at is null or expires_at > now())
     order by created_at desc, id limit ${MEMBER_LIMITS.invitations}`,
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
  }));
}

async function lockMember<T extends { id: string }>(
  c: Query,
  scope: OrgScope,
  id: string,
  cols: string,
): Promise<T> {
  const { rows } = await orgQuery<T>(
    c,
    scope,
    `select ${cols} from members where org_id = $1 and id = $2 for update`,
    [id],
  );
  if (!rows[0]) throw new Abort(notFound);
  return rows[0];
}

const mustLoad = async (c: Query, scope: OrgScope, id: string): Promise<MemberDto> =>
  (await loadMember(c, scope, id, null)) as MemberDto;

const COLUMN = {
  displayName: "display_name",
  employeeCode: "employee_code",
  groupId: "group_id",
} as const;

export function updateMember(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  patch: MemberPatchValue,
): Promise<Result<MemberDto>> {
  return inTx(db, async (c) => {
    const cur = await lockMember<{
      id: string;
      display_name: string;
      employee_code: string | null;
      group_id: string | null;
    }>(c, scope, id, "id, display_name, employee_code, group_id");
    if (patch.groupId) {
      const { rows } = await orgQuery(
        c,
        scope,
        "select 1 from groups where org_id = $1 and id = $2",
        [patch.groupId],
      );
      if (!rows[0]) throw new Abort(invalidRequest);
    }
    const fields = changedFields(
      { displayName: cur.display_name, employeeCode: cur.employee_code, groupId: cur.group_id },
      patch,
    );
    if (fields.length === 0) return mustLoad(c, scope, id);
    const sets = fields.map((k, i) => `${COLUMN[k]} = $${i + 3}`);
    await orgQuery(
      c,
      scope,
      `update members set ${sets.join(", ")}, updated_at = now() where org_id = $1 and id = $2`,
      [id, ...fields.map((k) => patch[k])],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "member.update",
      entity: "member",
      entityId: id,
      meta: { fields },
    });
    return mustLoad(c, scope, id);
  });
}

type ImpactRow = { occupied: number; placed: number; demote: number; pending: number };

async function impactOf(c: Query, scope: OrgScope, id: string): Promise<DeactivationImpact> {
  const { rows } = await orgQuery<ImpactRow>(
    c,
    scope,
    `select
       (select count(*)::int from seats where org_id = $1 and occupant_id = $2) as occupied,
       (select count(*)::int from devices where org_id = $1 and owner_id = $2 and seat_id is not null) as placed,
       (select count(*)::int from devices d where d.org_id = $1 and d.role = 'primary'
         and d.seat_id in (select s.id from seats s where s.org_id = $1 and s.occupant_id = $2)) as demote,
       (select count(*)::int from seat_requests where org_id = $1 and subject_id = $2 and status = 'pending') as pending`,
    [id],
  );
  const r = rows[0]!;
  return {
    occupiedSeats: r.occupied,
    placedDevices: r.placed,
    primaryDevicesToDemote: r.demote,
    pendingRequests: r.pending,
  };
}

export async function getDeactivationImpact(
  db: Query,
  scope: OrgScope,
  id: string,
): Promise<Result<DeactivationImpact>> {
  const { rows } = await orgQuery(
    db,
    scope,
    "select id from members where org_id = $1 and id = $2",
    [id],
  );
  if (!rows[0]) return notFound;
  return { ok: true, value: await impactOf(db, scope, id) };
}

/** Seats the member occupies plus seats holding a device they own. Always used with `$2` = member id. */
const SEAT_SET = `select s.id, s.room_id from seats s where s.org_id = $1 and (s.occupant_id = $2
  or s.id in (select d.seat_id from devices d where d.org_id = $1 and d.owner_id = $2 and d.seat_id is not null))`;

/**
 * One transaction, lock order (see rooms.ts): member row, rooms `for share`, seats `for update` (id order),
 * then devices / requests. The impact is recomputed under lock; the deferred device triggers check at COMMIT.
 */
export function deactivateMember(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  release: boolean,
): Promise<Result<MemberDto>> {
  return inTx(db, async (c) => {
    const m = await lockMember<{ id: string; sub: string; status: MemberStatus }>(
      c,
      scope,
      id,
      "id, sub, status",
    );
    await orgQuery(
      c,
      scope,
      `select id from rooms where org_id = $1 and id in (select x.room_id from (${SEAT_SET}) x) order by id for share`,
      [id],
    );
    await orgQuery(
      c,
      scope,
      `select s.id from seats s where s.org_id = $1 and s.id in (select x.id from (${SEAT_SET}) x) order by s.id for update`,
      [id],
    );
    const impact = await impactOf(c, scope, id);
    const decision = decideDeactivation({
      impact,
      release,
      isSelf: m.sub === actorSub,
      status: m.status,
    });
    if (decision === "refuse_self") {
      throw new Abort({ ok: false, status: 409, code: "cannot_deactivate_self" });
    }
    if (decision === "noop") return mustLoad(c, scope, id);
    if (decision === "refuse_not_empty") {
      throw new Abort({ ok: false, status: 409, code: "member_not_empty" });
    }
    if (decision === "release") {
      // DEV-06: every primary on the member's seats becomes secondary, whoever owns it.
      await orgQuery(
        c,
        scope,
        `update devices set role = 'secondary', updated_at = now()
         where org_id = $1 and role = 'primary'
           and seat_id in (select id from seats where org_id = $1 and occupant_id = $2)`,
        [id],
      );
      await orgQuery(
        c,
        scope,
        "update seats set occupant_id = null, updated_at = now() where org_id = $1 and occupant_id = $2",
        [id],
      );
      await orgQuery(
        c,
        scope,
        `update devices set seat_id = null, role = 'secondary', updated_at = now()
         where org_id = $1 and owner_id = $2 and seat_id is not null`,
        [id],
      );
    }
    await endPresenceForMember(c, scope, actorSub, id, "member_deactivated");
    const { rows: actor } = await orgQuery<{ id: string }>(
      c,
      scope,
      "select id from members where org_id = $1 and sub = $2",
      [actorSub],
    );
    await orgQuery(
      c,
      scope,
      `update seat_requests set status = 'cancelled', decided_at = now(), decided_by_id = $3, updated_at = now()
       where org_id = $1 and subject_id = $2 and status = 'pending'`,
      [id, actor[0]?.id ?? null],
    );
    // OQ-44: pending handoffs to or from the member are cancelled; their devices stay assigned.
    // decided_by_id is required, so a portal Admin with no member row falls back to the target (A6).
    const { rows: cancelled } = await orgQuery<{
      id: string;
      kind: string;
      device_id: string;
      from_member_id: string;
      to_member_id: string | null;
    }>(
      c,
      scope,
      `update device_handoffs set status = 'cancelled', decided_by_id = $3, decided_at = now(), updated_at = now()
       where org_id = $1 and status = 'pending' and (from_member_id = $2 or to_member_id = $2)
       returning id, kind, device_id, from_member_id, to_member_id`,
      [id, actor[0]?.id ?? id],
    );
    for (const h of cancelled) {
      await writeAudit(c, scope, {
        actorSub,
        action: `device.${h.kind}_cancel`,
        entity: "device",
        entityId: h.device_id,
        meta: {
          handoffId: h.id,
          fromMemberId: h.from_member_id,
          toMemberId: h.to_member_id,
          byDeactivation: true,
          memberId: id,
        },
      });
    }
    await orgQuery(
      c,
      scope,
      "update members set status = 'deactivated', updated_at = now() where org_id = $1 and id = $2",
      [id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "member.deactivate",
      entity: "member",
      entityId: id,
      meta: {
        released: decision === "release",
        seats: impact.occupiedSeats,
        devices: impact.placedDevices,
        demoted: impact.primaryDevicesToDemote,
        cancelledRequests: impact.pendingRequests,
        cancelledHandoffs: cancelled.length,
      },
    });
    return mustLoad(c, scope, id);
  });
}

export function reactivateMember(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<Result<MemberDto>> {
  return inTx(db, async (c) => {
    const m = await lockMember<{ id: string; status: MemberStatus }>(c, scope, id, "id, status");
    if (m.status === "active") return mustLoad(c, scope, id);
    await orgQuery(
      c,
      scope,
      "update members set status = 'active', updated_at = now() where org_id = $1 and id = $2",
      [id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "member.reactivate",
      entity: "member",
      entityId: id,
    });
    return mustLoad(c, scope, id);
  });
}
