import "server-only";
import {
  DEVICE_TYPE_LIMITS,
  type DeviceKind,
  type DeviceTypeCreateValue,
  type DeviceTypeDto,
  type DeviceTypeListResponse,
  type DeviceTypePatchValue,
} from "@/lib/device-types/types";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { deviceTypeConflict, type DeviceTypeConflictCode } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409;
  code: "not_found" | "type_limit" | DeviceTypeConflictCode;
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
    const code = deviceTypeConflict(err);
    if (code) return { ok: false, status: 409, code };
    throw err;
  }
}

export type Row = {
  id: string;
  name: string;
  slot: DeviceKind;
  has_image: boolean;
  image_version: number;
};

export const COLS = "id, name, slot, (image_drive_file_id is not null) as has_image, image_version";

export const toDto = (r: Row): DeviceTypeDto => ({
  id: r.id,
  name: r.name,
  slot: r.slot,
  hasImage: r.has_image,
  imageVersion: r.image_version,
});

/** D61: any member lists the org's catalog. */
export async function listDeviceTypes(
  db: Query,
  scope: OrgScope,
): Promise<Result<DeviceTypeListResponse>> {
  const { rows } = await orgQuery<Row>(
    db,
    scope,
    `select ${COLS} from device_types where org_id = $1
     order by lower(name), id limit ${DEVICE_TYPE_LIMITS.perOrg}`,
  );
  return { ok: true, value: { items: rows.map(toDto) } };
}

/** Admin adds a type. The marker row lock serialises the cap check for the org. */
export function createDeviceType(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  v: DeviceTypeCreateValue,
): Promise<Result<DeviceTypeDto>> {
  return inTx(db, async (c) => {
    // safety net for an org without a marker; a no-op otherwise
    await orgQuery(
      c,
      scope,
      `select device_types_seed(o.org_id) from (select $1::uuid as org_id) o where o.org_id = $1::uuid`,
    );
    await orgQuery(
      c,
      scope,
      "select org_id from device_type_catalogs where org_id = $1 for update",
    );
    const { rows: n } = await orgQuery<{ n: number }>(
      c,
      scope,
      "select count(*)::int as n from device_types where org_id = $1",
    );
    if (n[0]!.n >= DEVICE_TYPE_LIMITS.perOrg) {
      throw new Abort({ ok: false, status: 409, code: "type_limit" });
    }
    const { rows } = await orgQuery<Row>(
      c,
      scope,
      `insert into device_types (org_id, name, slot)
       select o.org_id, $2::text, $3::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid
       returning ${COLS}`,
      [v.name, v.slot],
    );
    const dto = toDto(rows[0]!);
    await writeAudit(c, scope, {
      actorSub,
      action: "device_type.create",
      entity: "device_type",
      entityId: dto.id,
      meta: { name: dto.name, slot: dto.slot },
    });
    return dto;
  });
}

/** Admin renames a type and/or changes its slot. Devices are never touched (D61). */
export function updateDeviceType(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  patch: DeviceTypePatchValue,
): Promise<Result<DeviceTypeDto>> {
  return inTx(db, async (c) => {
    const { rows } = await orgQuery<Row>(
      c,
      scope,
      `select ${COLS} from device_types where org_id = $1 and id = $2 for update`,
      [id],
    );
    const cur = rows[0];
    if (!cur) throw new Abort(notFound);
    const nameChanged = patch.name !== undefined && patch.name !== cur.name;
    const slotChanged = patch.slot !== undefined && patch.slot !== cur.slot;
    if (!nameChanged && !slotChanged) return toDto(cur);
    const { rows: upd } = await orgQuery<Row>(
      c,
      scope,
      `update device_types set name = $3, slot = $4, updated_at = now()
       where org_id = $1 and id = $2 returning ${COLS}`,
      [id, nameChanged ? patch.name : cur.name, slotChanged ? patch.slot : cur.slot],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "device_type.update",
      entity: "device_type",
      entityId: id,
      meta: {
        fields: [...(nameChanged ? ["name"] : []), ...(slotChanged ? ["slot"] : [])],
        ...(nameChanged ? { from: cur.name, to: patch.name } : {}),
      },
    });
    return toDto(upd[0]!);
  });
}

/** Admin deletes a type. Devices keep their free-text type and draw as the placeholder (D61). */
export function deleteDeviceType(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<Result<{ imageFileId: string | null }>> {
  return inTx(db, async (c) => {
    const { rows } = await orgQuery<{
      name: string;
      slot: string;
      image_drive_file_id: string | null;
    }>(
      c,
      scope,
      "delete from device_types where org_id = $1 and id = $2 returning name, slot, image_drive_file_id",
      [id],
    );
    if (!rows[0]) throw new Abort(notFound);
    await writeAudit(c, scope, {
      actorSub,
      action: "device_type.delete",
      entity: "device_type",
      entityId: id,
      meta: { name: rows[0].name, slot: rows[0].slot },
    });
    return { imageFileId: rows[0].image_drive_file_id };
  });
}
