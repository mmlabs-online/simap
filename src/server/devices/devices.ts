import "server-only";
import type { Tier } from "@/lib/auth/tier";
import {
  canCreateFor,
  canEdit,
  canPlace,
  decidePlacement,
  type PlacementInput,
  type PlacementRefusalCode,
} from "@/lib/devices/rules";
import {
  DEVICE_LIMITS,
  type DeviceCreateValue,
  type DeviceDto,
  type DeviceListResponse,
  type DevicePatchValue,
  type DeviceRole,
  type PlacementFilter,
} from "@/lib/devices/types";
import type { PlacementPutValue } from "@/lib/validate/device";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { deviceConflict, type DeviceConflictCode } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409 | 422;
  code:
    | "not_found"
    | PlacementRefusalCode
    | DeviceConflictCode
    | "device_placed"
    | "member_not_assignable"
    | "no_linked_member";
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
    // the deferred owner trigger fires at COMMIT, so this wraps withTx
    const code = deviceConflict(err);
    if (code) return { ok: false, status: 409, code };
    throw err;
  }
}

const refuse = (status: Refusal["status"], code: Refusal["code"]) =>
  new Abort({ ok: false, status, code });

// ---- reads ----------------------------------------------------------------------------------------------------

type DeviceRow = {
  id: string;
  name: string;
  type: string;
  inventory_number: string;
  mac: string | null;
  owner_id: string;
  owner_name: string;
  mine: boolean;
  role: DeviceRole;
  seat_id: string | null;
  seat_code: string | null;
  room_id: string | null;
  room_code: string | null;
};

const toDto = (r: DeviceRow, tier: Tier): DeviceDto => ({
  id: r.id,
  name: r.name,
  type: r.type,
  inventoryNumber: r.inventory_number,
  mac: r.mac,
  owner: { id: r.owner_id, displayName: r.owner_name },
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
  canPlace: canPlace(tier, r.mine),
});

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
    `select d.id, d.name, d.type, d.inventory_number, d.mac, d.owner_id, m.display_name as owner_name,
       m.sub = $2::uuid as mine, d.role, d.seat_id, s.code as seat_code, s.room_id, r.code as room_code
     from devices d
       join members m on m.org_id = d.org_id and m.id = d.owner_id
       left join seats s on s.org_id = d.org_id and s.id = d.seat_id
       left join rooms r on r.org_id = s.org_id and r.id = s.room_id
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
    // owner_id is read without a lock: safe only because it is immutable (DEV-01; PATCH rejects ownerId).
    // Any future owner transfer must re-read it under the device lock below.
    const { rows: dev } = await orgQuery<{ seat_id: string | null; owner_id: string }>(
      c,
      scope,
      "select seat_id, owner_id from devices where org_id = $1 and id = $2",
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
    const { rows: cur } = await orgQuery<{ seat_id: string | null; role: DeviceRole }>(
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
      isOwner: me[0]?.id === dev[0].owner_id,
      deviceId,
      ownerId: dev[0].owner_id,
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
        ownerId: dev[0].owner_id,
      },
    });
    return reload(c, scope, actorSub, tier, deviceId);
  });
}

async function actorMemberId(c: Query, scope: OrgScope, actorSub: string): Promise<string | null> {
  const { rows } = await orgQuery<{ id: string }>(
    c,
    scope,
    "select id from members where org_id = $1 and sub = $2",
    [actorSub],
  );
  return rows[0]?.id ?? null;
}

/** DEV-01: a new device starts in inventory. Self for any member, another member for an Admin (D19). */
export function createDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  v: DeviceCreateValue,
): Promise<Result<DeviceDto>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    const ownerId = v.ownerId ?? me;
    if (!ownerId) throw refuse(422, "no_linked_member");
    // before the owner lookup, so a non-Admin cannot probe which member ids exist
    if (!canCreateFor(tier, ownerId === me)) throw refuse(422, "not_allowed");
    const { rows: owner } = await orgQuery<{ id: string; status: string }>(
      c,
      scope,
      "select id, status from members where org_id = $1 and id = $2 for share",
      [ownerId],
    );
    if (!owner[0]) throw new Abort(notFound);
    if (owner[0].status !== "active") throw refuse(422, "member_not_assignable");
    const { rows: ins } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into devices (org_id, name, type, inventory_number, mac, owner_id)
       select o.org_id, $2::text, $3::text, $4::text, $5::text, $6::uuid
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid
       returning id`,
      [v.name, v.type, v.inventoryNumber, v.mac, ownerId],
    );
    const id = ins[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "device.create",
      entity: "device",
      entityId: id,
      meta: { inventoryNumber: v.inventoryNumber, ownerId },
    });
    return reload(c, scope, actorSub, tier, id);
  });
}

const COLUMNS = [
  ["name", "name"],
  ["type", "type"],
  ["inventoryNumber", "inventory_number"],
  ["mac", "mac"],
] as const;

/** DEV-01: owner or Admin edits name, type, inventory number and MAC. Only the device row is locked. */
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
      owner_id: string;
    }>(
      c,
      scope,
      `select id, name, type, inventory_number, mac, owner_id from devices
       where org_id = $1 and id = $2 for update`,
      [id],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    if (!canEdit(tier, me === cur.owner_id)) throw refuse(422, "not_allowed");
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

/** DEV-01 and D31: owner or Admin deletes a device that is in inventory; a placed one is refused. */
export function deleteDevice(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  tier: Tier,
  id: string,
): Promise<Result<null>> {
  return inTx(db, async (c) => {
    const me = await actorMemberId(c, scope, actorSub);
    // the device lock serialises this against placeDevice, which locks the device row too
    const { rows } = await orgQuery<{
      inventory_number: string;
      owner_id: string;
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
    if (!canEdit(tier, me === cur.owner_id)) throw refuse(422, "not_allowed");
    if (cur.seat_id !== null) throw refuse(409, "device_placed");
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

async function reload(
  c: Query,
  scope: OrgScope,
  sub: string,
  tier: Tier,
  id: string,
): Promise<DeviceDto> {
  const rows = await deviceRows(c, scope, sub, tier, "d.id = $3", [id], 1);
  return rows[0]!;
}
