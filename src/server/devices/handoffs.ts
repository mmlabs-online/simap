import "server-only";
import { atLeast, type Tier } from "@/lib/auth/tier";
import {
  decideExtensionStart,
  decideHandoffAction,
  decideReturnStart,
  decideTransferStart,
  handoffFlags,
} from "@/lib/devices/handoff-rules";
import type {
  DeviceDto,
  HandoffBox,
  HandoffCountDto,
  HandoffDto,
  HandoffKind,
  HandoffListResponse,
  HandoffStartValue,
  HandoffStatus,
} from "@/lib/devices/types";
import { writeAudit } from "@/server/audit/write";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { reload } from "./devices";
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
      kind: r.kind,
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
  v: Extract<HandoffStartValue, { kind: "transfer" }>,
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
      // The select-from-subselect form satisfies orgQuery's org_id = $1 guard (as writeAudit).
      `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note)
       select o.org_id, $2::uuid, 'transfer', $3::uuid, $4::uuid, $5::uuid, $6::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
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

/** DEV-09: the owner, or a Manager+, starts a return. Lock order device, then handoff, as startTransfer. */
export function startReturn(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  v: Extract<HandoffStartValue, { kind: "return" }>,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const { rows: dev } = await orgQuery<{ owner_id: string | null; inventory_number: string }>(
      c,
      scope,
      "select owner_id, inventory_number from devices where org_id = $1 and id = $2 for update",
      [deviceId],
    );
    if (!dev[0]) throw new Abort(notFound);
    const { rows: pending } = await orgQuery(
      c,
      scope,
      "select 1 from device_handoffs where org_id = $1 and device_id = $2 and status = 'pending'",
      [deviceId],
    );
    const decision = decideReturnStart({
      tier,
      actorMemberId: me,
      ownerId: dev[0].owner_id,
      pending: pending.length > 0,
    });
    if (decision.kind === "refuse") throw refuse(decision.status, decision.code);
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note)
       select o.org_id, $2::uuid, 'return', $3::uuid, null, $4::uuid, $5::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
      [deviceId, dev[0].owner_id, me, v.note],
    );
    const id = ins[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "device.return_start",
      entity: "device",
      entityId: deviceId,
      meta: {
        handoffId: id,
        fromMemberId: dev[0].owner_id,
        inventoryNumber: dev[0].inventory_number,
        note: v.note,
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

/** DEV-10: the owner asks for a new expiry. Lock order device, then handoff, as startReturn. */
export function startExtension(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  v: Extract<HandoffStartValue, { kind: "extension" }>,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const { rows: dev } = await orgQuery<{ owner_id: string | null; inventory_number: string }>(
      c,
      scope,
      "select owner_id, inventory_number from devices where org_id = $1 and id = $2 for update",
      [deviceId],
    );
    if (!dev[0]) throw new Abort(notFound);
    const { rows: pending } = await orgQuery(
      c,
      scope,
      "select 1 from device_handoffs where org_id = $1 and device_id = $2 and status = 'pending'",
      [deviceId],
    );
    const decision = decideExtensionStart({
      actorMemberId: me,
      ownerId: dev[0].owner_id,
      pending: pending.length > 0,
    });
    if (decision.kind === "refuse") throw refuse(decision.status, decision.code);
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into device_handoffs (org_id, device_id, kind, from_member_id, to_member_id, requested_by_id, note,
         new_expires_on)
       select o.org_id, $2::uuid, 'extension', $3::uuid, null, $3::uuid, $4::text, $5::date
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
      [deviceId, me, v.note, v.newExpiresOn],
    );
    const id = ins[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "device.extension_start",
      entity: "device",
      entityId: deviceId,
      meta: {
        handoffId: id,
        fromMemberId: dev[0].owner_id,
        inventoryNumber: dev[0].inventory_number,
        newExpiresOn: v.newExpiresOn,
        note: v.note,
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

type Lite = {
  kind: HandoffKind;
  status: HandoffStatus;
  from_member_id: string;
  to_member_id: string | null;
};

const LITE =
  "select kind, status, from_member_id, to_member_id from device_handoffs where org_id = $1 and id = $2";

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
          kind: h.kind,
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
        action: `device.${h.kind}_${action}`,
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

type PlacementLock = {
  seat0: string | null;
  seatCode: string | null;
  d: {
    owner_id: string | null;
    seat_id: string | null;
    role: string;
    expires_on: string | null;
    inventory_number: string;
  };
};

/**
 * Lock a device's placement: unlocked seat read, then room (share), seat and device (update). With the callers'
 * earlier locks the order is member -> room -> seat -> device -> handoff, as deactivateMember and placeDevice.
 */
async function lockPlacement(c: Query, scope: OrgScope, deviceId: string): Promise<PlacementLock> {
  const { rows: dev0 } = await orgQuery<{ seat_id: string | null }>(
    c,
    scope,
    "select seat_id from devices where org_id = $1 and id = $2",
    [deviceId],
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
  const { rows: dev } = await orgQuery<PlacementLock["d"]>(
    c,
    scope,
    `select owner_id, seat_id, role, to_char(holding_expires_on, 'YYYY-MM-DD') as expires_on,
       inventory_number
     from devices where org_id = $1 and id = $2 for update`,
    [deviceId],
  );
  if (!dev[0]) throw new Abort(notFound);
  return { seat0: dev0[0].seat_id, seatCode, d: dev[0] };
}

/** One UPDATE: the unowned checks are immediate, so owner, seat, note and expiry clear together. */
const clearDevice = (c: Query, scope: OrgScope, deviceId: string) =>
  orgQuery(
    c,
    scope,
    `update devices set owner_id = null, seat_id = null, role = 'secondary', holding_note = null,
       holding_expires_on = null, updated_at = now()
     where org_id = $1 and id = $2`,
    [deviceId],
  );

const placementMeta = (p: PlacementLock) => ({
  inventoryNumber: p.d.inventory_number,
  expiresOn: p.d.expires_on,
  fromSeatId: p.d.seat_id,
  fromCode: p.seatCode,
  demoted: p.d.seat_id !== null && p.d.role === "primary",
});

const setConfirmed = (c: Query, scope: OrgScope, id: string, me: string | null) =>
  orgQuery(
    c,
    scope,
    `update device_handoffs set status = 'confirmed', decided_by_id = $3, decided_at = now(),
       updated_at = now()
     where org_id = $1 and id = $2`,
    [id, me],
  );

type LiteDevice = Lite & { device_id: string };

/** DEV-08: the recipient confirms; the device leaves its seat and lands in their inventory. */
function confirmTransferOnce(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
  h0: LiteDevice,
  me: string | null,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const toId = h0.to_member_id!;
    const { rows: rec } = await orgQuery<{ status: string }>(
      c,
      scope,
      "select status from members where org_id = $1 and id = $2 for share",
      [toId],
    );
    const p = await lockPlacement(c, scope, h0.device_id);
    const { rows: locked } = await orgQuery<Lite>(c, scope, `${LITE} for update`, [id]);
    const h = locked[0]!;
    if (h.status !== "pending") throw refuse(409, "handoff_not_pending");
    if (p.d.owner_id !== h.from_member_id) throw refuse(409, "handoff_stale");
    if (rec[0]?.status !== "active") throw refuse(422, "member_not_assignable");
    if (p.d.seat_id !== p.seat0) throw refuse(409, "placement_changed");
    await orgQuery(
      c,
      scope,
      `update devices set owner_id = $3, seat_id = null, role = 'secondary', updated_at = now()
       where org_id = $1 and id = $2`,
      [h0.device_id, toId],
    );
    await setConfirmed(c, scope, id, me);
    await writeAudit(c, scope, {
      actorSub,
      action: "device.transfer_confirm",
      entity: "device",
      entityId: h0.device_id,
      meta: {
        handoffId: id,
        fromMemberId: h.from_member_id,
        toMemberId: toId,
        ...placementMeta(p),
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

/** DEV-09: an Admin confirms; the device leaves its seat and owner and is in the org inventory. */
function confirmReturnOnce(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
  h0: LiteDevice,
  me: string | null,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const p = await lockPlacement(c, scope, h0.device_id);
    const { rows: locked } = await orgQuery<Lite>(c, scope, `${LITE} for update`, [id]);
    const h = locked[0]!;
    if (h.status !== "pending") throw refuse(409, "handoff_not_pending");
    if (p.d.owner_id !== h.from_member_id) throw refuse(409, "handoff_stale");
    if (p.d.seat_id !== p.seat0) throw refuse(409, "placement_changed");
    await clearDevice(c, scope, h0.device_id);
    await setConfirmed(c, scope, id, me);
    await writeAudit(c, scope, {
      actorSub,
      action: "device.return_confirm",
      entity: "device",
      entityId: h0.device_id,
      meta: { handoffId: id, fromMemberId: h.from_member_id, ...placementMeta(p) },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

/** DEV-10: a Manager+ approves; the device expiry becomes the requested date. Placement is not touched. */
function confirmExtensionOnce(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
  h0: LiteDevice,
  me: string | null,
  today: string,
): Promise<Result<HandoffDto>> {
  return inTx(db, async (c) => {
    const { rows: dev } = await orgQuery<{
      owner_id: string | null;
      expires_on: string | null;
      inventory_number: string;
    }>(
      c,
      scope,
      `select owner_id, to_char(holding_expires_on, 'YYYY-MM-DD') as expires_on, inventory_number
       from devices where org_id = $1 and id = $2 for update`,
      [h0.device_id],
    );
    if (!dev[0]) throw new Abort(notFound);
    const { rows: locked } = await orgQuery<Lite & { new_expires_on: string }>(
      c,
      scope,
      `select kind, status, from_member_id, to_member_id, to_char(new_expires_on, 'YYYY-MM-DD') as new_expires_on
       from device_handoffs where org_id = $1 and id = $2 for update`,
      [id],
    );
    const h = locked[0]!;
    if (h.status !== "pending") throw refuse(409, "handoff_not_pending");
    if (dev[0].owner_id !== h.from_member_id || h.new_expires_on <= today) {
      throw refuse(409, "handoff_stale");
    }
    await orgQuery(
      c,
      scope,
      "update devices set holding_expires_on = $3, updated_at = now() where org_id = $1 and id = $2",
      [h0.device_id, h.new_expires_on],
    );
    await setConfirmed(c, scope, id, me);
    await writeAudit(c, scope, {
      actorSub,
      action: "device.extension_confirm",
      entity: "device",
      entityId: h0.device_id,
      meta: {
        handoffId: id,
        fromMemberId: h.from_member_id,
        inventoryNumber: dev[0].inventory_number,
        fromExpiresOn: dev[0].expires_on,
        toExpiresOn: h.new_expires_on,
      },
    });
    return loadOne(c, scope, tier, me, id);
  });
}

/** Confirm: the recipient of a transfer, an Admin for a return, a Manager+ for an extension. Permission is checked before any lock (R7). */
export async function confirmHandoff(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
  today: string,
): Promise<Result<HandoffDto>> {
  const me = await actorMemberId(db, scope, actorSub);
  const { rows: first } = await orgQuery<LiteDevice>(
    db,
    scope,
    `select kind, status, from_member_id, to_member_id, device_id from device_handoffs
     where org_id = $1 and id = $2`,
    [id],
  );
  const h0 = first[0];
  if (!h0) return notFound;
  const early = decideHandoffAction({
    kind: h0.kind,
    action: "confirm",
    tier,
    actorMemberId: me,
    fromId: h0.from_member_id,
    toId: h0.to_member_id,
    status: h0.status,
  });
  if (early.kind === "refuse") return { ok: false, status: early.status, code: early.code };
  if (h0.kind === "extension") {
    return confirmExtensionOnce(db, scope, actorSub, tier, id, h0, me, today);
  }
  const once = h0.kind === "return" ? confirmReturnOnce : confirmTransferOnce;
  const r = await once(db, scope, actorSub, tier, id, h0, me);
  // the device moved between the first read and the lock: look again once (A12)
  if (!r.ok && r.code === "placement_changed") return once(db, scope, actorSub, tier, id, h0, me);
  return r;
}

/** DEV-09: an Admin takes an owned device back without a request; a pending transfer is cancelled. */
function takeBackOnce(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  me: string,
): Promise<Result<DeviceDto>> {
  return inTx(db, async (c) => {
    const p = await lockPlacement(c, scope, deviceId);
    if (p.d.owner_id === null) throw refuse(422, "device_unowned");
    const { rows: pend } = await orgQuery<{
      id: string;
      kind: HandoffKind;
      to_member_id: string | null;
    }>(
      c,
      scope,
      `select id, kind, to_member_id from device_handoffs
       where org_id = $1 and device_id = $2 and status = 'pending' for update`,
      [deviceId],
    );
    const h = pend[0];
    if (h?.kind === "return") throw refuse(409, "handoff_pending");
    if (p.d.seat_id !== p.seat0) throw refuse(409, "placement_changed");
    if (h) {
      await orgQuery(
        c,
        scope,
        `update device_handoffs set status = 'cancelled', decided_by_id = $3, decided_at = now(),
           updated_at = now()
         where org_id = $1 and id = $2`,
        [h.id, me],
      );
      await writeAudit(c, scope, {
        actorSub,
        action: `device.${h.kind}_cancel`,
        entity: "device",
        entityId: deviceId,
        meta: {
          handoffId: h.id,
          fromMemberId: p.d.owner_id,
          toMemberId: h.to_member_id,
          inventoryNumber: p.d.inventory_number,
          byTakeBack: true,
        },
      });
    }
    await clearDevice(c, scope, deviceId);
    await writeAudit(c, scope, {
      actorSub,
      action: "device.return_take_back",
      entity: "device",
      entityId: deviceId,
      meta: {
        fromMemberId: p.d.owner_id,
        ...placementMeta(p),
        byAdmin: true,
        cancelledHandoffId: h?.id ?? null,
      },
    });
    return reload(c, scope, actorSub, tier, deviceId);
  });
}

export async function takeBack(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
): Promise<Result<DeviceDto>> {
  const me = await actorMemberId(db, scope, actorSub);
  if (tier !== "admin" || me === null) return { ok: false, status: 422, code: "not_allowed" };
  const r = await takeBackOnce(db, scope, actorSub, tier, deviceId, me);
  if (!r.ok && r.code === "placement_changed") {
    return takeBackOnce(db, scope, actorSub, tier, deviceId, me);
  }
  return r;
}

/**
 * DEV-08: pending transfers addressed to the caller. DEV-09: org-wide pending returns (Admin).
 * DEV-10: org-wide pending extensions (Manager+). Newest first.
 */
export async function listHandoffs(
  db: Query,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  box: HandoffBox,
): Promise<Result<HandoffListResponse>> {
  if (box === "returns" && tier !== "admin") return { ok: false, status: 422, code: "not_allowed" };
  if (box === "extensions" && !atLeast(tier, "manager")) {
    return { ok: false, status: 422, code: "not_allowed" };
  }
  const me = await actorMemberId(db, scope, actorSub);
  if (me === null) return { ok: true, value: { items: [], truncated: false } };
  const items =
    box === "returns" || box === "extensions"
      ? await handoffRows(
          db,
          scope,
          tier,
          me,
          `h.kind = '${box === "returns" ? "return" : "extension"}' and h.status = 'pending'`,
          [],
          INBOX_LIMIT + 1,
        )
      : await handoffRows(
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
  tier: Tier,
  today: string,
): Promise<Result<HandoffCountDto>> {
  const me = await actorMemberId(db, scope, actorSub);
  if (me === null) {
    return { ok: true, value: { incoming: 0, returns: 0, extensions: 0, overdue: 0 } };
  }
  const { rows } = await orgQuery<HandoffCountDto>(
    db,
    scope,
    `select count(*) filter (where to_member_id = $2)::int as incoming,
       count(*) filter (where kind = 'return' and $3::boolean)::int as returns,
       count(*) filter (where kind = 'extension' and $4::boolean)::int as extensions,
       (select count(*)::int from devices
         where org_id = $1 and owner_id = $2 and holding_expires_on < $5::date) as overdue
     from device_handoffs
     where org_id = $1 and status = 'pending'`,
    [me, tier === "admin", atLeast(tier, "manager"), today],
  );
  return { ok: true, value: rows[0]! };
}
