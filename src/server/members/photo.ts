import "server-only";
import { randomUUID } from "node:crypto";
import type { MemberPhotoDto } from "@/lib/members/photo";
import { PHOTO_EXT, PHOTO_MIME, validatePhoto, type PhotoType } from "@/lib/validate/photo";
import { writeAudit } from "@/server/audit/write";
import { withTx } from "@/server/db/tx";
import {
  IMAGE_DRIVE_ERROR,
  IMAGE_NOT_FOUND,
  etagMatches,
  mapDriveFailure,
  useDrive,
  type DriveGetter,
  type ImageRefusal,
} from "@/server/drive/image-flow";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import type { Db } from "./manage";

export type PhotoRefusal = ImageRefusal | { ok: false; status: 409; code: "not_allowed" };
export type PhotoResult<T> = { ok: true; value: T } | PhotoRefusal;
export type PhotoGet =
  | { kind: "not_modified"; etag: string }
  | { kind: "bytes"; bytes: Uint8Array; etag: string; contentType: string };

const log = (entry: Record<string, unknown>) => console.error(JSON.stringify(entry));
const orphan = (memberId: string) => log({ event: "drive_orphan", memberId });
const notFound = IMAGE_NOT_FOUND;
const notAllowed: PhotoRefusal = { ok: false, status: 409, code: "not_allowed" };
const driveFailure = (err: unknown, op: string) => mapDriveFailure(err, op, "member_photo_drive");

/** Best-effort delete of a Drive file after the DB decided. Never throws; a failure leaves an orphan (logged). */
async function discardFile(drive: DriveGetter, fileId: string | null, memberId: string) {
  if (!fileId) return;
  try {
    await useDrive(drive).deleteFile(fileId);
  } catch {
    orphan(memberId);
  }
}

type Row = {
  id: string;
  sub: string;
  status: string;
  photo_drive_file_id: string | null;
  photo_version: number;
};
type By = "sub" | "id";

const selectRow = (db: Pick<Db, "query">, scope: OrgScope, by: By, value: string, lock = false) =>
  orgQuery<Row>(
    db,
    scope,
    `select id, sub, status, photo_drive_file_id, photo_version from members
     where org_id = $1 and ${by === "sub" ? "sub" : "id"} = $2${lock ? " for update" : ""}`,
    [value],
  );

/**
 * The member sets their own photo. No row lock is held across the Drive upload: read the current file id, upload,
 * then one short compare-and-set transaction. A lost race gives 409 `image_changed` and the new file is deleted.
 * `bytes` must already have passed `validatePhoto` (and the metadata strip).
 */
export async function setOwnPhoto(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  photo: { bytes: Uint8Array; type: PhotoType },
): Promise<PhotoResult<MemberPhotoDto>> {
  const cur = (await selectRow(db, scope, "sub", actorSub)).rows[0];
  if (!cur) return notFound;
  if (cur.status === "deactivated") return notAllowed;
  const { id } = cur;
  const old = cur.photo_drive_file_id;

  let fileId: string;
  try {
    const up = await useDrive(drive).uploadOrgFile(scope.orgId, {
      name: `photo-${id}-${randomUUID()}.${PHOTO_EXT[photo.type]}`,
      mimeType: PHOTO_MIME[photo.type],
      bytes: photo.bytes,
    });
    fileId = up.id;
  } catch (err) {
    return driveFailure(err, "upload");
  }

  let applied = false;
  let version: number | null;
  try {
    version = await withTx(db, async (c) => {
      const { rows } = await orgQuery<{ photo_version: number }>(
        c,
        scope,
        `update members
         set photo_drive_file_id = $3::text, photo_version = photo_version + 1, updated_at = now()
         where org_id = $1 and id = $2 and status = 'active' and photo_drive_file_id is not distinct from $4::text
         returning photo_version`,
        [id, fileId, old],
      );
      if (!rows[0]) return null;
      applied = true;
      await writeAudit(c, scope, {
        actorSub,
        action: "member.photo_set",
        entity: "member",
        entityId: id,
        meta: {
          version: rows[0].photo_version,
          self: true,
          type: photo.type,
          bytes: photo.bytes.length,
        },
      });
      return rows[0].photo_version;
    });
  } catch (err) {
    // After the update ran, a failed audit insert or COMMIT has an unknown outcome: keep the file.
    if (applied) orphan(id);
    else await discardFile(drive, fileId, id);
    throw err;
  }

  if (version === null) {
    await discardFile(drive, fileId, id);
    const now = (await selectRow(db, scope, "id", id)).rows[0];
    if (!now) return notFound;
    return now.status === "deactivated"
      ? notAllowed
      : { ok: false, status: 409, code: "image_changed" };
  }
  await discardFile(drive, old, id);
  return { ok: true, value: { hasPhoto: true, photoVersion: version } };
}

/** DB first, then a best-effort Drive delete. Works with Drive off. Idempotent (no file: no write, no audit). */
async function removeWhere(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  by: By,
  value: string,
): Promise<PhotoResult<null>> {
  type Out = { refusal: PhotoRefusal } | { refusal?: undefined; old: string | null; id: string };
  const out = await withTx<Out>(db, async (c) => {
    const row = (await selectRow(c, scope, by, value, true)).rows[0];
    if (!row) return { refusal: notFound };
    // Own removal by a deactivated member is refused; a Manager may clear any member's photo.
    if (by === "sub" && row.status === "deactivated") return { refusal: notAllowed };
    const old = row.photo_drive_file_id;
    if (!old) return { old: null, id: row.id };
    const { rows } = await orgQuery<{ photo_version: number }>(
      c,
      scope,
      `update members set photo_drive_file_id = null, photo_version = photo_version + 1, updated_at = now()
       where org_id = $1 and id = $2 returning photo_version`,
      [row.id],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "member.photo_remove",
      entity: "member",
      entityId: row.id,
      meta: { version: rows[0]!.photo_version, self: row.sub === actorSub },
    });
    return { old, id: row.id };
  });
  if (out.refusal) return out.refusal;
  await discardFile(drive, out.old, out.id);
  return { ok: true, value: null };
}

export const removeOwnPhoto = (db: Db, drive: DriveGetter, scope: OrgScope, actorSub: string) =>
  removeWhere(db, drive, scope, actorSub, "sub", actorSub);

/** Manager+ removes another member's photo (the route enforces the tier; OQ-61). */
export const removeMemberPhoto = (
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  memberId: string,
) => removeWhere(db, drive, scope, actorSub, "id", memberId);

/** A matching If-None-Match answers before any Drive call. Stored bytes are validated again. Never writes. */
async function getPhoto(
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  by: By,
  value: string,
  ifNoneMatch: string | null,
): Promise<PhotoResult<PhotoGet>> {
  const row = (await selectRow(db, scope, by, value)).rows[0];
  if (!row?.photo_drive_file_id) return notFound;
  const etag = `"${row.id}-${row.photo_version}"`;
  if (etagMatches(ifNoneMatch, etag)) return { ok: true, value: { kind: "not_modified", etag } };
  try {
    const f = await useDrive(drive).getFile(row.photo_drive_file_id);
    const v = validatePhoto(f.bytes);
    if (!v.ok) {
      log({ event: "member_photo_drive", op: "get", code: "invalid_photo" });
      return IMAGE_DRIVE_ERROR;
    }
    return {
      ok: true,
      value: { kind: "bytes", bytes: f.bytes, etag, contentType: PHOTO_MIME[v.type] },
    };
  } catch (err) {
    return driveFailure(err, "get");
  }
}

export const getOwnPhoto = (
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  sub: string,
  ifNoneMatch: string | null,
) => getPhoto(db, drive, scope, "sub", sub, ifNoneMatch);

/** Any member of the token's org (OQ-58). Another org's id is a 404 (R6). */
export const getMemberPhoto = (
  db: Db,
  drive: DriveGetter,
  scope: OrgScope,
  memberId: string,
  ifNoneMatch: string | null,
) => getPhoto(db, drive, scope, "id", memberId, ifNoneMatch);
