import "server-only";
import type { Tier } from "@/lib/auth/tier";
import {
  canCancelHandoff,
  canStartReturn,
  canStartTransfer,
  canTakeBack,
} from "@/lib/devices/handoff-rules";
import {
  canAssign,
  canCreate,
  canEdit,
  canManageHolding,
  canPlace,
  decideDelete,
  decidePlacement,
  type PlacementInput,
} from "@/lib/devices/rules";
import {
  DEVICE_LIMITS,
  type AssignValue,
  type DeviceCreateValue,
  type DeviceDto,
  type DeviceListResponse,
  type DevicePatchValue,
  type DeviceRole,
  type HandoffKind,
  type HoldingPatchValue,
  type PlacementFilter,
} from "@/lib/devices/types";
import type { PlacementPutValue } from "@/lib/validate/device";
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

export type { Db, Refusal, Result } from "./tx";

// ---- reads ----------------------------------------------------------------------------------------------------

type DeviceRow = {
  id: string;
  name: string;
  type: string;
  inventory_number: string;
  mac: string | null;
  serial: string | null;
  manufacturer: string | null;
  brand: string | null;
  holding_note: string | null;
  holding_expires_on: string | null;
  owner_id: string | null;
  owner_name: string | null;
  mine: boolean;
  role: DeviceRole;
  seat_id: string | null;
  seat_code: string | null;
  room_id: string | null;
  room_code: string | null;
  h_id: string | null;
  h_kind: HandoffKind | null;
  h_created_at: string | null;
  h_to_id: string | null;
  h_to_name: string | null;
  h_by_id: string | null;
  h_by_name: string | null;
  h_from_me: boolean;
};

const toDto = (r: DeviceRow, tier: Tier): DeviceDto => {
  const pending = r.h_id !== null;
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    inventoryNumber: r.inventory_number,
    mac: r.mac,
    serial: r.serial,
    manufacturer: r.manufacturer,
    brand: r.brand,
    holding: r.owner_id === null ? null : { note: r.holding_note, expiresOn: r.holding_expires_on },
    owner: r.owner_id === null ? null : { id: r.owner_id, displayName: r.owner_name! },
    placement: r.seat_id
      ? {
          seatId: r.seat_id,
          seatCode: r.seat_code!,
          roomId: r.room_id!,
          roomCode: r.room_code!,
          role: r.role,
        }
      : null,
    mine: r.mine,
    canEdit: canEdit(tier, r.mine),
    canPlace: r.owner_id !== null && canPlace(tier, r.mine),
    canDelete: tier === "admin" && r.owner_id === null && !pending,
    canAssign: r.owner_id === null && canAssign(tier) && !pending,
    canEditHolding: r.owner_id !== null && canManageHolding(tier),
    canTransfer: r.owner_id !== null && !pending && canStartTransfer(tier, r.mine),
    canReturn: r.owner_id !== null && !pending && canStartReturn(tier, r.mine),
    canTakeBack: canTakeBack(tier, r.owner_id, r.h_kind),
    pendingHandoff: pending
      ? {
          id: r.h_id!,
          kind: r.h_kind!,
          to: r.h_to_id === null ? null : { id: r.h_to_id, displayName: r.h_to_name! },
          requestedBy: { id: r.h_by_id!, displayName: r.h_by_name! },
          createdAt: r.h_created_at!,
          canCancel: canCancelHandoff(tier, r.h_from_me),
        }
      : null,
  };
};

/** $2 is the caller's sub (for `mine`); `where` and its values start at $3. Every join repeats org_id (R6). */
async function deviceRows(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  where: string,
  values: unknown[],
  limit: number,
): Promise<DeviceDto[]> {
  const { rows } = await orgQuery<DeviceRow>(
    db,
    scope,
    `select d.id, d.name, d.type, d.inventory_number, d.mac, d.serial, d.manufacturer, d.brand, d.holding_note,
       to_char(d.holding_expires_on, 'YYYY-MM-DD') as holding_expires_on, d.owner_id, m.display_name as owner_name,
       coalesce(m.sub = $2::uuid, false) as mine, d.role, d.seat_id, s.code as seat_code, s.room_id, r.code as room_code,
       h.id as h_id, h.kind as h_kind, to_char(h.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as h_created_at, 
       h.to_member_id as h_to_id, ht.display_name as h_to_name, h.requested_by_id as h_by_id,
       hr.display_name as h_by_name, coalesce(hf.sub = $2::uuid, false) as h_from_me
     from devices d
       left join members m on m.org_id = d.org_id and m.id = d.owner_id
       left join seats s on s.org_id = d.org_id and s.id = d.seat_id
       left join rooms r on r.org_id = s.org_id and r.id = s.room_id
       left join device_handoffs h on h.org_id = d.org_id and h.device_id = d.id and h.status = 'pending'
       left join members ht on ht.org_id = h.org_id and ht.id = h.to_member_id
       left join members hr on hr.org_id = h.org_id and hr.id = h.requested_by_id
       left join members hf on hf.org_id = h.org_id and hf.id = h.from_member_id
     where d.org_id = $1 and ${where}
     order by lower(d.name), d.id limit ${limit}`,
    [sub, ...values],
  );
  return rows.map((r) => toDto(r, tier));
}

const FILTER_SQL: Record<PlacementFilter, string> = {
  all: "true",
  placed: "d.seat_id is not null",
  inventory: "d.seat_id is null",
  unowned: "d.owner_id is null",
};

export async function listDevices(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  placement: PlacementFilter,
): Promise<Result<DeviceListResponse>> {
  const items = await deviceRows(
    db,
    scope,
    sub,
    tier,
    FILTER_SQL[placement],
    [],
    DEVICE_LIMITS.list + 1,
  );
  return {
    ok: true,
    value: {
      items: items.slice(0, DEVICE_LIMITS.list),
      truncated: items.length > DEVICE_LIMITS.list,
    },
  };
}

export async function getDevice(
  db: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  id: string,
): Promise<Result<DeviceDto>> {
  const rows = await deviceRows(db, scope, sub, tier, "d.id = $3", [id], 1);
  return rows[0] ? { ok: true, value: rows[0] } : notFound;
}

// ---- writes ---------------------------------------------------------------------------------------------------

/**
 * Place, lend, move or return one device (DEV-03/04/05, REG-03). Lock order as in rooms.ts: rooms for share
 * (ascending id), seats for update (ascending id), then the device. No member row is locked.
 */
export function placeDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  v: PlacementPutValue,
): Promise<Result<DeviceDto>> {
  return inTx(db, async (c) => {
    const { rows: me } = await orgQuery<{ id: string }>(
      c,
      scope,
      "select id from members where org_id = $1 and sub = $2",
      [actorSub],
    );
    // owner_id is read under the device lock below (SIM-037.1) so a later transfer cannot race placement.
    const { rows: dev } = await orgQuery<{ seat_id: string | null }>(
      c,
      scope,
      "select seat_id from devices where org_id = $1 and id = $2",
      [deviceId],
    );
    if (!dev[0]) throw new Abort(notFound);
    const seatIds = [dev[0].seat_id, v.seatId].filter((s): s is string => s !== null);
    const seatById = new Map<string, { code: string; occupant_id: string | null }>();
    if (seatIds.length > 0) {
      const { rows: found } = await orgQuery<{ id: string; room_id: string }>(
        c,
        scope,
        "select id, room_id from seats where org_id = $1 and id = any($2::uuid[])",
        [seatIds],
      );
      if (v.seatId !== null && !found.some((s) => s.id === v.seatId)) throw new Abort(notFound);
      const roomIds = [...new Set(found.map((s) => s.room_id))];
      await orgQuery(
        c,
        scope,
        "select id, code from rooms where org_id = $1 and id = any($2::uuid[]) order by id for share",
        [roomIds],
      );
      const { rows: locked } = await orgQuery<{
        id: string;
        code: string;
        occupant_id: string | null;
      }>(
        c,
        scope,
        `select id, code, room_id, occupant_id from seats
         where org_id = $1 and id = any($2::uuid[]) order by id for update`,
        [seatIds],
      );
      for (const s of locked) seatById.set(s.id, s);
    }
    const { rows: cur } = await orgQuery<{
      seat_id: string | null;
      role: DeviceRole;
      owner_id: string | null;
    }>(
      c,
      scope,
      "select id, seat_id, role, owner_id from devices where org_id = $1 and id = $2 for update",
      [deviceId],
    );
    // the old seat it now sits on (if any) is not locked: answer as a stale view
    if (!cur[0]) throw new Abort(notFound); // deleted since the first read
    if (cur[0].seat_id !== dev[0].seat_id) throw refuse(409, "placement_changed");

    let target: PlacementInput["target"] = null;
    if (v.seatId !== null) {
      const seat = seatById.get(v.seatId);
      if (!seat) throw new Abort(notFound);
      // stable: the seat lock serialises every placement and every demote on this seat
      const { rows: prim } = await orgQuery<{ id: string }>(
        c,
        scope,
        "select id from devices where org_id = $1 and seat_id = $2 and role = 'primary'",
        [v.seatId],
      );
      target = { seatId: v.seatId, occupantId: seat.occupant_id, primaryId: prim[0]?.id ?? null };
    }
    const decision = decidePlacement({
      tier,
      isOwner: cur[0].owner_id !== null && me[0]?.id === cur[0].owner_id,
      deviceId,
      ownerId: cur[0].owner_id,
      current: { seatId: cur[0].seat_id, role: cur[0].role },
      expectedSeatId: v.expectedSeatId,
      target,
      role: v.role,
    });
    if (decision.kind === "refuse") throw refuse(decision.status, decision.code);
    if (decision.kind === "noop") return reload(c, scope, actorSub, tier, deviceId);

    await orgQuery(
      c,
      scope,
      "update devices set seat_id = $3, role = $4, updated_at = now() where org_id = $1 and id = $2",
      [deviceId, v.seatId, v.role],
    );
    const from = cur[0].seat_id === null ? null : seatById.get(cur[0].seat_id);
    await writeAudit(c, scope, {
      actorSub,
      action: `device.${decision.kind}`,
      entity: "device",
      entityId: deviceId,
      meta: {
        fromSeatId: cur[0].seat_id,
        fromCode: from?.code ?? null,
        toSeatId: v.seatId,
        toCode: v.seatId === null ? null : (seatById.get(v.seatId)?.code ?? null),
        role: v.role,
        ownerId: cur[0].owner_id,
      },
    });
    return reload(c, scope, actorSub, tier, deviceId);
  });
}

/** DEV-01, OQ-41: only an Admin creates a device; it has no owner and starts in the org inventory (D63). */
export function createDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  v: DeviceCreateValue,
): Promise<Result<DeviceDto>> {
  // before any query (R7): a domain refusal, never a late 401/403
  if (!canCreate(tier)) return Promise.resolve({ ok: false, status: 422, code: "not_allowed" });
  return inTx(db, async (c) => {
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into devices (org_id, name, type, inventory_number, mac, serial, manufacturer, brand)
       select o.org_id, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid
       returning id`,
      [v.name, v.type, v.inventoryNumber, v.mac, v.serial, v.manufacturer, v.brand],
    );
    const id = ins[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "device.create",
      entity: "device",
      entityId: id,
      meta: { inventoryNumber: v.inventoryNumber, ownerId: null },
    });
    return reload(c, scope, actorSub, tier, id);
  });
}

const COLUMNS = [
  ["name", "name"],
  ["type", "type"],
  ["inventoryNumber", "inventory_number"],
  ["mac", "mac"],
  ["serial", "serial"],
  ["manufacturer", "manufacturer"],
  ["brand", "brand"],
] as const;

/** DEV-01: owner or Admin edits name, type, inventory number, MAC, serial, manufacturer and brand. Only the device row is locked. */
export function updateDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
  patch: DevicePatchValue,
): Promise<Result<DeviceDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const { rows } = await orgQuery<{
      name: string;
      type: string;
      inventory_number: string;
      mac: string | null;
      serial: string | null;
      manufacturer: string | null;
      brand: string | null;
      owner_id: string | null;
    }>(
      c,
      scope,
      `select id, name, type, inventory_number, mac, serial, manufacturer, brand, owner_id from devices
       where org_id = $1 and id = $2 for update`,
      [id],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    if (!canEdit(tier, cur.owner_id !== null && me === cur.owner_id))
      throw refuse(422, "not_allowed");
    const changed = COLUMNS.filter(
      ([key, col]) => key in patch && patch[key] !== cur[col as keyof typeof cur],
    );
    if (changed.length === 0) return reload(c, scope, actorSub, tier, id);
    // column names come only from COLUMNS; values are parameters
    const sets = changed.map(([, col], i) => `${col} = $${i + 3}`).join(", ");
    await orgQuery(
      c,
      scope,
      `update devices set ${sets}, updated_at = now() where org_id = $1 and id = $2`,
      [id, ...changed.map(([key]) => patch[key])],
    );
    const inv = changed.some(([key]) => key === "inventoryNumber");
    await writeAudit(c, scope, {
      actorSub,
      action: "device.update",
      entity: "device",
      entityId: id,
      meta: {
        fields: changed.map(([key]) => key),
        ...(inv ? { from: cur.inventory_number, to: patch.inventoryNumber } : {}),
      },
    });
    return reload(c, scope, actorSub, tier, id);
  });
}

/**
 * DEV-07: an Admin or Manager assigns an org-inventory device to an active member. Lock order as in
 * deactivateMember: the member row (for share) first, then the device.
 */
export function assignDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  v: AssignValue,
): Promise<Result<DeviceDto>> {
  // before any query (R7): a domain refusal, never a late 401/403
  if (!canAssign(tier)) return Promise.resolve({ ok: false, status: 422, code: "not_allowed" });
  return inTx(db, async (c) => {
    const { rows: mem } = await orgQuery<{ id: string; status: string }>(
      c,
      scope,
      "select id, status from members where org_id = $1 and id = $2 for share",
      [v.memberId],
    );
    if (!mem[0] || mem[0].status !== "active") throw refuse(422, "member_not_assignable");
    const { rows } = await orgQuery<{ owner_id: string | null; inventory_number: string }>(
      c,
      scope,
      "select owner_id, inventory_number from devices where org_id = $1 and id = $2 for update",
      [deviceId],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    if (cur.owner_id !== null) throw refuse(409, "device_owned");
    const { rows: pending } = await orgQuery(
      c,
      scope,
      "select 1 from device_handoffs where org_id = $1 and device_id = $2 and status = 'pending'",
      [deviceId],
    );
    if (pending.length > 0) throw refuse(409, "handoff_pending");
    await orgQuery(
      c,
      scope,
      `update devices set owner_id = $3, holding_note = $4, holding_expires_on = $5::date, updated_at = now()
       where org_id = $1 and id = $2`,
      [deviceId, v.memberId, v.note, v.expiresOn],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "device.assign",
      entity: "device",
      entityId: deviceId,
      meta: {
        memberId: v.memberId,
        note: v.note,
        expiresOn: v.expiresOn,
        inventoryNumber: cur.inventory_number,
      },
    });
    return reload(c, scope, actorSub, tier, deviceId);
  });
}

const HOLDING_COLUMNS = [
  ["note", "holding_note"],
  ["expiresOn", "holding_expires_on"],
] as const;

/** DEV-07: an Admin or Manager edits the current assignment's note and expiry. Only the device row is locked. */
export function updateHolding(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  deviceId: string,
  patch: HoldingPatchValue,
): Promise<Result<DeviceDto>> {
  if (!canManageHolding(tier)) {
    return Promise.resolve({ ok: false, status: 422, code: "not_allowed" });
  }
  return inTx(db, async (c) => {
    const { rows } = await orgQuery<{
      owner_id: string | null;
      note: string | null;
      expires_on: string | null;
    }>(
      c,
      scope,
      `select owner_id, holding_note as note, to_char(holding_expires_on, 'YYYY-MM-DD') as expires_on
       from devices where org_id = $1 and id = $2 for update`,
      [deviceId],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    if (cur.owner_id === null) throw refuse(409, "not_assigned");
    const before = { note: cur.note, expiresOn: cur.expires_on };
    const changed = HOLDING_COLUMNS.filter(([key]) => key in patch && patch[key] !== before[key]);
    if (changed.length === 0) return reload(c, scope, actorSub, tier, deviceId);
    // column names come only from HOLDING_COLUMNS; values are parameters
    const sets = changed
      .map(([key, col], i) => `${col} = $${i + 3}${key === "expiresOn" ? "::date" : ""}`)
      .join(", ");
    await orgQuery(
      c,
      scope,
      `update devices set ${sets}, updated_at = now() where org_id = $1 and id = $2`,
      [deviceId, ...changed.map(([key]) => patch[key])],
    );
    const after = { ...before, ...patch };
    await writeAudit(c, scope, {
      actorSub,
      action: "device.holding_update",
      entity: "device",
      entityId: deviceId,
      meta: { ownerId: cur.owner_id, fields: changed.map(([key]) => key), from: before, to: after },
    });
    return reload(c, scope, actorSub, tier, deviceId);
  });
}

/** DEV-01, D31: only an Admin deletes a device, and only while it is in the org inventory with no pending handoff. */
export function deleteDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
): Promise<Result<null>> {
  if (tier !== "admin") return Promise.resolve(refuse(422, "not_allowed").refusal);
  return inTx(db, async (c) => {
    // the device lock serialises this against placeDevice, which locks the device row too
    const { rows } = await orgQuery<{
      inventory_number: string;
      owner_id: string | null;
      seat_id: string | null;
    }>(
      c,
      scope,
      `select inventory_number, owner_id, seat_id from devices
       where org_id = $1 and id = $2 for update`,
      [id],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    // read under the device lock; handoffs must be inserted under the same lock (SIM-037.3)
    const { rows: pending } = await orgQuery(
      c,
      scope,
      "select 1 from device_handoffs where org_id = $1 and device_id = $2 and status = 'pending'",
      [id],
    );
    const decision = decideDelete({
      tier,
      ownerId: cur.owner_id,
      seatId: cur.seat_id,
      pendingHandoff: pending.length > 0,
    });
    if (decision.kind === "refuse") throw refuse(decision.status, decision.code);
    await orgQuery(c, scope, "delete from devices where org_id = $1 and id = $2", [id]);
    await writeAudit(c, scope, {
      actorSub,
      action: "device.delete",
      entity: "device",
      entityId: id,
      meta: { inventoryNumber: cur.inventory_number, ownerId: cur.owner_id },
    });
    return null;
  });
}

export async function reload(
  c: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  id: string,
): Promise<DeviceDto> {
  const rows = await deviceRows(c, scope, sub, tier, "d.id = $3", [id], 1);
  return rows[0]!;
}
