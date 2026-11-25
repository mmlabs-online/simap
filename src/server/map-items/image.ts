import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { artDirAllowed, mapItemImageFits } from "@/lib/map-items/art";
import { libraryItem } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, type MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { parsePng } from "@/lib/validate/png";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxPool } from "@/server/db/tx";
import {
  IMAGE_DRIVE_ERROR,
  IMAGE_NOT_FOUND,
  etagMatches,
  mapDriveFailure,
  useDrive,
  type DriveGetter,
  type ImageGet,
  type ImageRefusal,
} from "@/server/drive/image-flow";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { discardMapItemFiles } from "./drive-cleanup";
import { COLS, toDto, type Row } from "./map-items";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type ImageDb = TxPool & Query;

export type MapItemImageRefusal =
  | ImageRefusal
  | { ok: false; status: 422; code: "not_allowed" | "image_bad_size" };
export type MapItemImageResult<T> = { ok: true; value: T } | MapItemImageRefusal;

const EVENT = "map_item_image_drive";
const notFound = IMAGE_NOT_FOUND;
const notAllowed: MapItemImageRefusal = { ok: false, status: 422, code: "not_allowed" };
const badSize: MapItemImageRefusal = { ok: false, status: 422, code: "image_bad_size" };
const changed: MapItemImageRefusal = { ok: false, status: 409, code: "image_changed" };

/** Column of one direction. `d` is a closed `Direction` value, never request text; the assert keeps it so. */
function col(d: Direction, field: "drive_file_id" | "image_version"): string {
  if (!MAP_ITEM_DIRS.includes(d)) throw new Error("bad direction");
  return `art_${d}_${field}`;
}

const selectImage = (db: Query, scope: OrgScope, key: string, d: Direction) =>
  orgQuery<{ w: number; h: number; file: string | null; version: number }>(
    db,
    scope,
    `select w, h, ${col(d, "drive_file_id")} as file, ${col(d, "image_version")} as version
     from map_items where org_id = $1 and builtin_key = $2`,
    [key],
  );

/**
 * Admin sets the image of one direction. No row lock is held across the Drive upload: one read-only select
 * (size and current file), upload, then one compare-and-set transaction on this direction's columns, the file id,
 * its version and the item size. A lost race gives 409 `image_changed` and the new file is deleted.
 */
export async function setMapItemImage(
  db: ImageDb,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  key: string,
  dir: Direction,
  bytes: Uint8Array,
  png: { width: number; height: number },
): Promise<MapItemImageResult<MapItemDto>> {
  const lib = libraryItem(key);
  if (!lib) return notFound;
  if (!artDirAllowed(lib, dir)) return notAllowed;

  const cur = (await selectImage(db, scope, key, dir)).rows[0];
  if (!cur) return notFound;
  if (!mapItemImageFits(lib, dir, cur.w, cur.h, png)) return badSize;

  let fileId: string;
  try {
    const up = await useDrive(drive).uploadOrgFile(scope.orgId, {
      name: `mapitem-${key}-${dir}-${randomUUID()}.png`,
      mimeType: "image/png",
      bytes,
    });
    fileId = up.id;
  } catch (err) {
    return mapDriveFailure(err, "upload", EVENT);
  }

  let applied = false;
  let dto: MapItemDto | null;
  try {
    dto = await withTx(db, async (c) => {
      const f = col(dir, "drive_file_id");
      const v = col(dir, "image_version");
      const { rows } = await orgQuery<Row>(
        c,
        scope,
        `update map_items set ${f} = $3::text, ${v} = ${v} + 1, updated_at = now()
         where org_id = $1 and builtin_key = $2 and ${f} is not distinct from $4::text
           and ${v} = $5 and w = $6 and h = $7
         returning ${COLS}`,
        [key, fileId, cur.file, cur.version, cur.w, cur.h],
      );
      if (!rows[0]) return null;
      applied = true;
      const out = toDto(rows[0]);
      if (!out) return null;
      await writeAudit(c, scope, {
        actorSub,
        action: "map_item.image_set",
        entity: "map_item",
        entityId: null,
        meta: { key, dir, version: out.art[dir].imageVersion },
      });
      return out;
    });
  } catch (err) {
    // After the update ran, a failed audit insert or COMMIT has an unknown outcome: keep the file.
    if (applied) console.error(JSON.stringify({ event: "map_item_drive_orphan", key }));
    else await discardMapItemFiles(drive, [fileId], key);
    throw err;
  }

  if (!dto) {
    await discardMapItemFiles(drive, [fileId], key);
    return (await selectImage(db, scope, key, dir)).rows[0] ? changed : notFound;
  }
  await discardMapItemFiles(drive, cur.file ? [cur.file] : [], key);
  return { ok: true, value: dto };
}

/** Admin removes one direction's image: DB first, then a best-effort Drive delete. Works with Drive off. Idempotent. */
export async function removeMapItemImage(
  db: ImageDb,
  drive: DriveGetter,
  scope: OrgScope,
  actorSub: string,
  key: string,
  dir: Direction,
): Promise<MapItemImageResult<null>> {
  const lib = libraryItem(key);
  if (!lib) return notFound;
  if (!artDirAllowed(lib, dir)) return notAllowed;

  const out = await withTx(db, async (c) => {
    const f = col(dir, "drive_file_id");
    const v = col(dir, "image_version");
    const { rows } = await orgQuery<{ file: string | null }>(
      c,
      scope,
      `select ${f} as file from map_items where org_id = $1 and builtin_key = $2 for no key update`,
      [key],
    );
    if (!rows[0]) return { found: false, old: null };
    const old = rows[0].file;
    if (!old) return { found: true, old: null };
    const { rows: upd } = await orgQuery<{ version: number }>(
      c,
      scope,
      `update map_items set ${f} = null, ${v} = ${v} + 1, updated_at = now()
       where org_id = $1 and builtin_key = $2 returning ${v} as version`,
      [key],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "map_item.image_remove",
      entity: "map_item",
      entityId: null,
      meta: { key, dir, version: upd[0]!.version },
    });
    return { found: true, old };
  });
  if (!out.found) return notFound;
  await discardMapItemFiles(drive, out.old ? [out.old] : [], key);
  return { ok: true, value: null };
}

/** Vary value for image responses (kept here: route files must not mention the auth header name). */
export const IMAGE_VARY = "Authorization";

/** ETag of one direction's image. A short org hash keeps it org-specific without exposing the org id. */
export function mapItemEtag(scope: OrgScope, key: string, d: Direction, version: number): string {
  const org = createHash("sha256").update(scope.orgId).digest("hex").slice(0, 12);
  return `"${key}-${d}-${version}-${org}"`;
}

/** Any member loads one direction's image. A matching If-None-Match answers before any Drive call. Never writes. */
export async function getMapItemImage(
  db: ImageDb,
  drive: DriveGetter,
  scope: OrgScope,
  key: string,
  dir: Direction,
  ifNoneMatch: string | null,
): Promise<MapItemImageResult<ImageGet>> {
  if (!libraryItem(key)) return notFound;
  const row = (await selectImage(db, scope, key, dir)).rows[0];
  if (!row?.file) return notFound;
  const etag = mapItemEtag(scope, key, dir, row.version);
  if (etagMatches(ifNoneMatch, etag)) return { ok: true, value: { kind: "not_modified", etag } };
  try {
    const f = await useDrive(drive).getFile(row.file);
    // Structure only: the size is never re-checked, so a resize race never gives a false 502 (A6).
    if (!parsePng(f.bytes).ok) {
      console.error(JSON.stringify({ event: EVENT, op: "get", code: "invalid_png" }));
      return IMAGE_DRIVE_ERROR;
    }
    return { ok: true, value: { kind: "bytes", bytes: f.bytes, etag } };
  } catch (err) {
    return mapDriveFailure(err, "get", EVENT);
  }
}
