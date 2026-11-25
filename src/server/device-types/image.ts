import "server-only";
import { randomUUID } from "node:crypto";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { validatePng } from "@/lib/validate/png";
import { writeAudit } from "@/server/audit/write";
import { withTx } from "@/server/db/tx";
import { DriveError } from "@/server/drive/client";
import { DriveConfigError } from "@/server/drive/config";
import type { OrgDrive } from "@/server/drive/drive";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { COLS, toDto, type Db, type Row } from "./device-types";

/** The drive is read lazily (a getter) so the org-scoped row lookup, and its 404, come before any Drive config. */
export type DriveGetter = () => OrgDrive | null;

export type ImageRefusal = {
  ok: false;
  status: 404 | 409 | 502 | 503;
  code: "not_found" | "image_changed" | "drive_error" | "images_unavailable";
};
export type ImageResult<T> = { ok: true; value: T } | ImageRefusal;

const notFound: ImageRefusal = { ok: false, status: 404, code: "not_found" };
const unavailable: ImageRefusal = { ok: false, status: 503, code: "images_unavailable" };
const driveError: ImageRefusal = { ok: false, status: 502, code: "drive_error" };

const log = (entry: Record<string, unknown>) => console.error(JSON.stringify(entry));
const orphan = (typeId: string) => log({ event: "drive_orphan", typeId });

/**
 * The only path from a Drive failure to a response. The DriveCode is logged and never sent; no Drive failure
 * becomes 401/403 (R7). Anything that is not a Drive or Drive config error is rethrown (500 from the wrapper).
 */
export function driveFailure(err: unknown, op: string): ImageRefusal {
  if (err instanceof DriveConfigError) {
    log({ event: "device_type_image_drive", op, code: "drive_config" });
    return unavailable;
  }
  if (err instanceof DriveError) {
    log({ event: "device_type_image_drive", op, code: err.code });
    return err.code === "drive_rate_limited" || err.code === "drive_unavailable"
      ? unavailable
      : driveError;
  }
  throw err;
}

function useDrive(drive: DriveGetter): OrgDrive {
  const d = drive();
  if (!d) throw new DriveConfigError("drive is off");
  return d;
}

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

/** True when an If-None-Match header lists `etag` (weak prefix ignored) or `*`. */
export function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header.split(",").some((t) => {
    const v = t.trim().replace(/^W\//, "");
    return v === "*" || v === etag;
  });
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

export type ImageGet =
  | { kind: "not_modified"; etag: string }
  | { kind: "bytes"; bytes: Uint8Array; etag: string };

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
