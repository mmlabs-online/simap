import "server-only";
import { randomUUID } from "node:crypto";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { validatePng } from "@/lib/validate/png";
import { writeAudit } from "@/server/audit/write";
import { withTx } from "@/server/db/tx";
import {
  IMAGE_DRIVE_ERROR,
  IMAGE_NOT_FOUND,
  etagMatches,
  mapDriveFailure,
  useDrive,
  type DriveGetter,
  type ImageGet,
  type ImageRefusal,
  type ImageResult,
} from "@/server/drive/image-flow";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { COLS, toDto, type Db, type Row } from "./device-types";

export type { DriveGetter, ImageGet, ImageRefusal, ImageResult };
export { etagMatches };

const log = (entry: Record<string, unknown>) => console.error(JSON.stringify(entry));
const orphan = (typeId: string) => log({ event: "drive_orphan", typeId });

/** The device-type event name for `mapDriveFailure`; the log shape is unchanged. */
export const driveFailure = (err: unknown, op: string): ImageRefusal =>
  mapDriveFailure(err, op, "device_type_image_drive");

const notFound = IMAGE_NOT_FOUND;
const driveError = IMAGE_DRIVE_ERROR;

/** Best-effort delete of a Drive file after the DB decided. Never throws; a failure leaves an orphan (logged). */
export async function discardImageFile(
  drive: DriveGetter,
  fileId: string | null,
  typeId: string,
): Promise<void> {
  if (!fileId) return;
  try {
    await useDrive(drive).deleteFile(fileId);
  } catch {
    orphan(typeId);
  }
}

const selectFile = (db: { query: Db["query"] }, scope: OrgScope, id: string) =>
  orgQuery<{ image_drive_file_id: string | null; image_version: number }>(
    db,
    scope,
    "select image_drive_file_id, image_version from device_types where org_id = $1 and id = $2",
    [id],
  );

/**
 * Admin sets the image. No row lock is held across the Drive upload: read the current file id, upload, then one
 * short compare-and-set transaction. A lost race gives 409 `image_changed` and the new file is deleted.
 */
export async function setDeviceTypeImage(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  id: string,
  bytes: Uint8Array,
): Promise<ImageResult<DeviceTypeDto>> {
  const cur = (await selectFile(db, scope, id)).rows[0];
  if (!cur) return notFound;
  const old = cur.image_drive_file_id;

  let fileId: string;
  try {
    const up = await useDrive(drive).uploadOrgFile(scope.orgId, {
      name: `devtype-${id}-${randomUUID()}.png`,
      mimeType: "image/png",
      bytes,
    });
    fileId = up.id;
  } catch (err) {
    return driveFailure(err, "upload");
  }

  let applied = false;
  let dto: DeviceTypeDto | null;
  try {
    dto = await withTx(db, async (c) => {
      const { rows } = await orgQuery<Row>(
        c,
        scope,
        `update device_types
         set image_drive_file_id = $3::text, image_version = image_version + 1, updated_at = now()
         where org_id = $1 and id = $2 and image_drive_file_id is not distinct from $4::text
         returning ${COLS}`,
        [id, fileId, old],
      );
      if (!rows[0]) return null;
      applied = true;
      const out = toDto(rows[0]);
      await writeAudit(c, scope, {
        actorSub,
        action: "device_type.image_set",
        entity: "device_type",
        entityId: id,
        meta: { version: out.imageVersion },
      });
      return out;
    });
  } catch (err) {
    // After the update ran, a failed audit insert or COMMIT has an unknown outcome: keep the file.
    if (applied) orphan(id);
    else await discardImageFile(drive, fileId, id);
    throw err;
  }

  if (!dto) {
    await discardImageFile(drive, fileId, id);
    return (await selectFile(db, scope, id)).rows[0]
      ? { ok: false, status: 409, code: "image_changed" }
      : notFound;
  }
  await discardImageFile(drive, old, id);
  return { ok: true, value: dto };
}

/** Admin removes the image: DB first, then a best-effort Drive delete. Works with Drive off. Idempotent. */
export async function removeDeviceTypeImage(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  id: string,
): Promise<ImageResult<null>> {
  const out = await withTx(db, async (c) => {
    const { rows } = await orgQuery<{ image_drive_file_id: string | null }>(
      c,
      scope,
      "select image_drive_file_id from device_types where org_id = $1 and id = $2 for update",
      [id],
    );
    if (!rows[0]) return { found: false, old: null };
    const old = rows[0].image_drive_file_id;
    if (!old) return { found: true, old: null };
    const { rows: upd } = await orgQuery<{ image_version: number }>(
      c,
      scope,
      `update device_types set image_drive_file_id = null, image_version = image_version + 1, updated_at = now()
       where org_id = $1 and id = $2 returning image_version`,
      [id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "device_type.image_remove",
      entity: "device_type",
      entityId: id,
      meta: { version: upd[0]!.image_version },
    });
    return { found: true, old };
  });
  if (!out.found) return notFound;
  await discardImageFile(drive, out.old, id);
  return { ok: true, value: null };
}

/** Any member loads the image. A matching If-None-Match answers before any Drive call. Never writes. */
export async function getDeviceTypeImage(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  id: string,
  ifNoneMatch: string | null,
): Promise<ImageResult<ImageGet>> {
  const row = (await selectFile(db, scope, id)).rows[0];
  if (!row?.image_drive_file_id) return notFound;
  const etag = `"${id}-${row.image_version}"`;
  if (etagMatches(ifNoneMatch, etag)) return { ok: true, value: { kind: "not_modified", etag } };
  try {
    const f = await useDrive(drive).getFile(row.image_drive_file_id);
    if (!validatePng(f.bytes).ok) {
      log({ event: "device_type_image_drive", op: "get", code: "invalid_png" });
      return driveError;
    }
    return { ok: true, value: { kind: "bytes", bytes: f.bytes, etag } };
  } catch (err) {
    return driveFailure(err, "get");
  }
}
