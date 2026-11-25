import "server-only";
import type { Tier } from "@/lib/auth/tier";
import {
  decideHandoffAction,
  decideTransferStart,
  handoffFlags,
} from "@/lib/devices/handoff-rules";
import type {
  HandoffCountDto,
  HandoffDto,
  HandoffKind,
  HandoffListResponse,
  HandoffStartValue,
  HandoffStatus,
} from "@/lib/devices/types";
import { writeAudit } from "@/server/audit/write";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import {
  Abort,
  actorMemberId,
  inTx,
  notFound,
  refuse,
  type Db,
  type Query,
  type Result,
} from "./tx";

const INBOX_LIMIT = 100;

type HandoffRow = {
  id: string;
  kind: HandoffKind;
  status: HandoffStatus;
  device_id: string;
  device_name: string;
  device_type: string;
  inventory_number: string;
  expires_on: string | null;
  from_id: string;
  from_name: string;
  to_id: string | null;
  to_name: string | null;
  by_id: string;
  by_name: string;
  decided_by_id: string | null;
  decided_by_name: string | null;
  note: string | null;
  new_expires_on: string | null;
  created_at: string;
  decided_at: string | null;
};

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

/** `where` and its values start at $2; every join repeats org_id (R6). */
async function handoffRows(
  db: Query,
  scope: OrgScope,
  tier: Tier,
  me: string | null,
  where: string,
  values: unknown[],
  limit: number,
): Promise<HandoffDto[]> {
  const { rows } = await orgQuery<HandoffRow>(
    db,
    scope,
    `select h.id, h.kind, h.status, h.device_id, d.name as device_name, d.type as device_type,
       d.inventory_number, to_char(d.holding_expires_on, 'YYYY-MM-DD') as expires_on,
       h.from_member_id as from_id, mf.display_name as from_name,
       h.to_member_id as to_id, mt.display_name as to_name,
       h.requested_by_id as by_id, mr.display_name as by_name,
       h.decided_by_id, md.display_name as decided_by_name, h.note,
       to_char(h.new_expires_on, 'YYYY-MM-DD') as new_expires_on,
       to_char(h.created_at at time zone 'UTC', ${ISO}) as created_at,
       to_char(h.decided_at at time zone 'UTC', ${ISO}) as decided_at
     from device_handoffs h
       join devices d on d.org_id = h.org_id and d.id = h.device_id
       join members mf on mf.org_id = h.org_id and mf.id = h.from_member_id
       left join members mt on mt.org_id = h.org_id and mt.id = h.to_member_id
       join members mr on mr.org_id = h.org_id and mr.id = h.requested_by_id
       left join members md on md.org_id = h.org_id and md.id = h.decided_by_id
     where h.org_id = $1 and ${where}
     order by h.created_at desc, h.id limit ${limit}`,
    values,
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    device: {
      id: r.device_id,
      name: r.device_name,
      type: r.device_type,
      inventoryNumber: r.inventory_number,
      expiresOn: r.expires_on,
    },
    from: { id: r.from_id, displayName: r.from_name },
    to: r.to_id === null ? null : { id: r.to_id, displayName: r.to_name! },
    requestedBy: { id: r.by_id, displayName: r.by_name },
    decidedBy:
      r.decided_by_id === null ? null : { id: r.decided_by_id, displayName: r.decided_by_name! },
    note: r.note,
    newExpiresOn: r.new_expires_on,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    ...handoffFlags({
      tier,
      actorMemberId: me,
      fromId: r.from_id,
      toId: r.to_id,
      status: r.status,
    }),
  }));
}

async function loadOne(
  c: Query,
  scope: OrgScope,
  tier: Tier,
  me: string | null,
  id: string,
): Promise<HandoffDto> {
  const rows = await handoffRows(c, scope, tier, me, "h.id = $2", [id], 1);
  return rows[0]!;
}

/** DEV-08: the owner, or a Manager+, starts a transfer. Lock order member (share), then device, as assignDevice. */
export function startTransfer(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  v: HandoffStartValue,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const { rows: rec } = await orgQuery<{ status: string }>(
      c,
      scope,
      "select status from members where org_id = $1 and id = $2 for share",
      [v.toMemberId],
    );
    const { rows: dev } = await orgQuery<{ owner_id: string | null; inventory_number: string }>(
      c,
      scope,
      "select owner_id, inventory_number from devices where org_id = $1 and id = $2 for update",
      [deviceId],
    );
    if (!dev[0]) throw new Abort(notFound);
    // read under the device lock, which every pending-handoff check and insert shares
    const { rows: pending } = await orgQuery(
      c,
      scope,
      "select 1 from device_handoffs where org_id = $1 and device_id = $2 and status = 'pending'",
      [deviceId],
    );
    const decision = decideTransferStart({
      tier,
      actorMemberId: me,
      ownerId: dev[0].owner_id,
      toMemberId: v.toMemberId,
      recipientActive: rec[0]?.status === "active",
      pending: pending.length > 0,
    });
    if (decision.kind === "refuse") throw refuse(decision.status, decision.code);
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note)
       values ($1, $2, 'transfer', $3, $4, $5, $6) returning id`,
      [deviceId, dev[0].owner_id, v.toMemberId, me, v.note],
    );
    const id = ins[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "device.transfer_start",
      entity: "device",
      entityId: deviceId,
      meta: {
        handoffId: id,
        fromMemberId: dev[0].owner_id,
        toMemberId: v.toMemberId,
        inventoryNumber: dev[0].inventory_number,
        note: v.note,
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

type Lite = { status: HandoffStatus; from_member_id: string; to_member_id: string | null };

const LITE =
  "select status, from_member_id, to_member_id from device_handoffs where org_id = $1 and id = $2";

/** Cancel (sender or Manager+) or decline (recipient). Only the handoff row is locked. */
function closeHandoff(action: "cancel" | "decline") {
  return (
    db: Db,
    scope: OrgScope,
    actorSub: string,
    tier: Tier,
    id: string,
  ): Promise<Result<HandoffDto>> =>
    inTx(db, async (c) => {
      const me = await actorMemberId(c, scope, actorSub);
      const decide = (h: Lite) =>
        decideHandoffAction({
          action,
          tier,
          actorMemberId: me,
          fromId: h.from_member_id,
          toId: h.to_member_id,
          status: h.status,
        });
      const { rows: first } = await orgQuery<Lite>(c, scope, LITE, [id]);
      if (!first[0]) throw new Abort(notFound);
      const early = decide(first[0]);
      if (early.kind === "refuse") throw refuse(early.status, early.code);
      const { rows: locked } = await orgQuery<Lite>(c, scope, `${LITE} for update`, [id]);
      const h = locked[0]!;
      const again = decide(h);
      if (again.kind === "refuse") throw refuse(again.status, again.code);
      await orgQuery(
        c,
        scope,
        `update device_handoffs set status = $3, decided_by_id = $4, decided_at = now(), updated_at = now()
         where org_id = $1 and id = $2`,
        [id, action === "cancel" ? "cancelled" : "declined", me],
      );
      const dto = await loadOne(c, scope, tier, me, id);
      await writeAudit(c, scope, {
        actorSub,
        action: `device.transfer_${action}`,
        entity: "device",
        entityId: dto.device.id,
        meta: {
          handoffId: id,
          fromMemberId: h.from_member_id,
          toMemberId: h.to_member_id,
          inventoryNumber: dto.device.inventoryNumber,
          byManager: me !== h.from_member_id && me !== h.to_member_id,
        },
      });
      return dto;
    });
}

export const cancelHandoff = closeHandoff("cancel");
export const declineHandoff = closeHandoff("decline");

/**
 * DEV-08: the recipient confirms; the device leaves its seat and lands in their inventory. Lock order
 * member (share) -> room (share) -> seat -> device -> handoff, as deactivateMember and placeDevice.
 */
function confirmOnce(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const { rows: first } = await orgQuery<Lite & { device_id: string }>(
      c,
      scope,
      `select status, from_member_id, to_member_id, device_id from device_handoffs
       where org_id = $1 and id = $2`,
      [id],
    );
    const h0 = first[0];
    if (!h0) throw new Abort(notFound);
    const early = decideHandoffAction({
      action: "confirm",
      tier,
      actorMemberId: me,
      fromId: h0.from_member_id,
      toId: h0.to_member_id,
      status: h0.status,
    });
    if (early.kind === "refuse") throw refuse(early.status, early.code);
    const toId = h0.to_member_id!;
    const { rows: rec } = await orgQuery<{ status: string }>(
      c,
      scope,
      "select status from members where org_id = $1 and id = $2 for share",
      [toId],
    );
    const { rows: dev0 } = await orgQuery<{ seat_id: string | null }>(
      c,
      scope,
      "select seat_id from devices where org_id = $1 and id = $2",
      [h0.device_id],
    );
    if (!dev0[0]) throw new Abort(notFound);
    let seatCode: string | null = null;
    if (dev0[0].seat_id !== null) {
      const { rows: seat } = await orgQuery<{ room_id: string }>(
        c,
        scope,
        "select room_id from seats where org_id = $1 and id = $2",
        [dev0[0].seat_id],
      );
      if (seat[0]) {
        await orgQuery(c, scope, "select id from rooms where org_id = $1 and id = $2 for share", [
          seat[0].room_id,
        ]);
        const { rows: lockedSeat } = await orgQuery<{ code: string }>(
          c,
          scope,
          "select code from seats where org_id = $1 and id = $2 for update",
          [dev0[0].seat_id],
        );
        seatCode = lockedSeat[0]?.code ?? null;
      }
    }
    const { rows: dev } = await orgQuery<{
      owner_id: string | null;
      seat_id: string | null;
      role: string;
      expires_on: string | null;
      inventory_number: string;
    }>(
      c,
      scope,
      `select owner_id, seat_id, role, to_char(holding_expires_on, 'YYYY-MM-DD') as expires_on,
         inventory_number
       from devices where org_id = $1 and id = $2 for update`,
      [h0.device_id],
    );
    const d = dev[0];
    if (!d) throw new Abort(notFound);
    const { rows: locked } = await orgQuery<Lite>(c, scope, `${LITE} for update`, [id]);
    const h = locked[0]!;
    if (h.status !== "pending") throw refuse(409, "handoff_not_pending");
    if (d.owner_id !== h.from_member_id) throw refuse(409, "handoff_stale");
    if (rec[0]?.status !== "active") throw refuse(422, "member_not_assignable");
    if (d.seat_id !== dev0[0].seat_id) throw refuse(409, "placement_changed");
    await orgQuery(
      c,
      scope,
      `update devices set owner_id = $3, seat_id = null, role = 'secondary', updated_at = now()
       where org_id = $1 and id = $2`,
      [h0.device_id, toId],
    );
    await orgQuery(
      c,
      scope,
      `update device_handoffs set status = 'confirmed', decided_by_id = $3, decided_at = now(),
         updated_at = now()
       where org_id = $1 and id = $2`,
      [id, me],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "device.transfer_confirm",
      entity: "device",
      entityId: h0.device_id,
      meta: {
        handoffId: id,
        fromMemberId: h.from_member_id,
        toMemberId: toId,
        inventoryNumber: d.inventory_number,
        expiresOn: d.expires_on,
        fromSeatId: d.seat_id,
        fromCode: seatCode,
        demoted: d.seat_id !== null && d.role === "primary",
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

export async function confirmHandoff(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
): Promise<Result<HandoffDto>> {
  const r = await confirmOnce(db, scope, actorSub, tier, id);
  // the device moved between the first read and the lock: look again once (A12)
  if (!r.ok && r.code === "placement_changed") return confirmOnce(db, scope, actorSub, tier, id);
  return r;
}

/** DEV-08: pending transfers addressed to the caller, newest first. */
export async function listHandoffs(
  db: Query,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
): Promise<Result<HandoffListResponse>> {
  const me = await actorMemberId(db, scope, actorSub);
  if (me === null) return { ok: true, value: { items: [], truncated: false } };
  const items = await handoffRows(
    db,
    scope,
    tier,
    me,
    "h.to_member_id = $2 and h.status = 'pending'",
    [me],
    INBOX_LIMIT + 1,
  );
  return {
    ok: true,
    value: { items: items.slice(0, INBOX_LIMIT), truncated: items.length > INBOX_LIMIT },
  };
}

export async function countHandoffs(
  db: Query,
  scope: OrgScope,
  actorSub: string,
): Promise<Result<HandoffCountDto>> {
  const me = await actorMemberId(db, scope, actorSub);
  if (me === null) return { ok: true, value: { incoming: 0 } };
  const { rows } = await orgQuery<{ n: number }>(
    db,
    scope,
    `select count(*)::int as n from device_handoffs
     where org_id = $1 and to_member_id = $2 and status = 'pending'`,
    [me],
  );
  return { ok: true, value: { incoming: rows[0]!.n } };
}
