import "server-only";
import { libraryItem } from "@/lib/map-items/library";
import {
  MAP_ITEM_LIMITS,
  type MapItemArtDto,
  type MapItemDto,
  type MapItemListResponse,
} from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };

export type Result<T> = { ok: true; value: T };

const DIRS: readonly Direction[] = ["n", "e", "s", "w"];

export type Row = {
  builtin_key: string;
  name: string;
  group_name: string;
  w: number;
  h: number;
  hidden: boolean;
} & {
  [K in `art_${Direction}_${"sprite" | "has_image" | "image_version"}`]:
    | string
    | boolean
    | number
    | null;
};

/** Never selects a Drive file id: only whether an image exists and its version. */
export const COLS = `builtin_key, name, group_name, w, h, hidden, ${DIRS.map(
  (d) =>
    `art_${d}_sprite, (art_${d}_drive_file_id is not null) as art_${d}_has_image, art_${d}_image_version`,
).join(", ")}`;

/** The DTO of a row, or null when its key is not a current library item (it cannot be drawn). */
export function toDto(r: Row): MapItemDto | null {
  const lib = libraryItem(r.builtin_key);
  if (!lib) return null;
  const art = {} as Record<Direction, MapItemArtDto>;
  for (const d of DIRS) {
    art[d] = {
      sprite: r[`art_${d}_sprite`] as string | null,
      hasImage: r[`art_${d}_has_image`] as boolean,
      imageVersion: r[`art_${d}_image_version`] as number,
    };
  }
  return {
    builtinKey: r.builtin_key,
    name: r.name,
    group: r.group_name,
    w: r.w,
    h: r.h,
    hidden: r.hidden,
    kind: lib.kind,
    directional: lib.directional,
    fixedSize: lib.fixedSize,
    art,
  };
}

/** Any member lists the org's catalog by name; hidden rows only for Admins (D67 1, 2). */
export async function listMapItems(
  db: Query,
  scope: OrgScope,
  opts: { includeHidden: boolean },
): Promise<Result<MapItemListResponse>> {
  const { rows } = await orgQuery<Row>(
    db,
    scope,
    `select ${COLS} from map_items where org_id = $1 and ($2::boolean or not hidden)
     order by lower(name), builtin_key limit ${MAP_ITEM_LIMITS.list}`,
    [opts.includeHidden],
  );
  const items = rows.map(toDto).filter((i): i is MapItemDto => i !== null);
  return { ok: true, value: { items } };
}
