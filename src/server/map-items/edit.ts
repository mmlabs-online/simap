import "server-only";
import { spriteFits, spriteAllowedFor, artDirAllowed } from "@/lib/map-items/art";
import { libraryItem, mapItemName } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, type MapItemDto, type MapItemPatchValue } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { COLS, toDto, type Row } from "./map-items";
import { mapItemConflict } from "./pg-error";

export type Db = TxPool;

export type EditRefusal = {
  ok: false;
  status: 404 | 409 | 422;
  code:
    | "not_found"
    | "item_in_use"
    | "item_name_taken"
    | "item_fixed_size"
    | "not_allowed"
    | "sprite_not_allowed";
  /** Distinct rooms that have the item placed (only with `item_in_use`). */
  rooms?: number;
};
export type EditResult<T> = { ok: true; value: T } | EditRefusal;
export type EditOutcome = { item: MapItemDto; discardFileIds: string[] };

const refuse = (
  status: EditRefusal["status"],
  code: EditRefusal["code"],
  rooms?: number,
): EditRefusal =>
  rooms === undefined ? { ok: false, status, code } : { ok: false, status, code, rooms };

/** Thrown inside a transaction to roll it back and answer with a domain refusal. */
class Abort extends Error {
  constructor(readonly refusal: EditRefusal) {
    super("abort");
  }
}

async function inTx<T>(pool: Db, fn: (c: TxClient) => Promise<T>): Promise<EditResult<T>> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    const code = mapItemConflict(err);
    if (code) return refuse(409, code);
    throw err;
  }
}

type Cur = Row & { [K in `art_${Direction}_drive_file_id`]: string | null };
type Next = {
  name: string;
  group: string;
  hidden: boolean;
  w: number;
  h: number;
  sprite: Record<Direction, string | null>;
  file: Record<Direction, string | null>;
  version: Record<Direction, number>;
};

const FILE_COLS = MAP_ITEM_DIRS.map((d) => `art_${d}_drive_file_id`).join(", ");

function fromRow(r: Cur): Next {
  const pick = <T>(f: (d: Direction) => T) =>
    Object.fromEntries(MAP_ITEM_DIRS.map((d) => [d, f(d)])) as Record<Direction, T>;
  return {
    name: r.name,
    group: r.group_name,
    hidden: r.hidden,
    w: r.w,
    h: r.h,
    sprite: pick((d) => r[`art_${d}_sprite`] as string | null),
    file: pick((d) => r[`art_${d}_drive_file_id`]),
    version: pick((d) => r[`art_${d}_image_version`] as number),
  };
}

const same = (a: Next, b: Next) => JSON.stringify(a) === JSON.stringify(b);

/** The locked read. `for update` only when the request may change the size; everything else `for no key update`. */
async function lockRow(
  c: TxClient,
  scope: OrgScope,
  key: string,
  mayResize: boolean,
): Promise<Cur> {
  const { rows } = await orgQuery<Cur>(
    c,
    scope,
    `select ${COLS}, ${FILE_COLS} from map_items where org_id = $1 and builtin_key = $2
     for ${mayResize ? "update" : "no key update"}`,
    [key],
  );
  if (!rows[0]) throw new Abort(refuse(404, "not_found"));
  return rows[0];
}

/** A size change: refused while placed (D66.7); then drops the custom images (OQ-52) and the sprites that no longer fit (A3). */
async function applySize(
  c: TxClient,
  scope: OrgScope,
  key: string,
  cur: Next,
  next: Next,
): Promise<void> {
  if (cur.w === next.w && cur.h === next.h) return;
  const { rows } = await orgQuery<{ n: number }>(
    c,
    scope,
    `select count(*)::int as n from (
       select room_id from layout_fixtures where org_id = $1 and sprite_key = $2
       union select room_id from seats where org_id = $1 and sprite_key = $2) r`,
    [key],
  );
  if (rows[0]!.n > 0) throw new Abort(refuse(409, "item_in_use", rows[0]!.n));
  for (const d of MAP_ITEM_DIRS) {
    dropFile(next, cur, d);
    const s = next.sprite[d];
    if (s !== null && !spriteFits(s, d, next.w, next.h)) next.sprite[d] = null;
  }
}

function dropFile(next: Next, cur: Next, d: Direction): void {
  if (cur.file[d] === null) return;
  next.file[d] = null;
  next.version[d] = cur.version[d] + 1;
}

const deletedIds = (cur: Next, next: Next): string[] =>
  MAP_ITEM_DIRS.flatMap((d) =>
    cur.file[d] !== null && next.file[d] === null ? [cur.file[d]!] : [],
  );

async function write(c: TxClient, scope: OrgScope, key: string, n: Next): Promise<MapItemDto> {
  const { rows } = await orgQuery<Row>(
    c,
    scope,
    `update map_items set name = $3, group_name = $4, hidden = $5, w = $6, h = $7,
       art_n_sprite = $8, art_e_sprite = $9, art_s_sprite = $10, art_w_sprite = $11,
       art_n_drive_file_id = $12, art_e_drive_file_id = $13, art_s_drive_file_id = $14, art_w_drive_file_id = $15,
       art_n_image_version = $16, art_e_image_version = $17, art_s_image_version = $18, art_w_image_version = $19,
       updated_at = now()
     where org_id = $1 and builtin_key = $2 returning ${COLS}`,
    [
      key,
      n.name,
      n.group,
      n.hidden,
      n.w,
      n.h,
      ...MAP_ITEM_DIRS.map((d) => n.sprite[d]),
      ...MAP_ITEM_DIRS.map((d) => n.file[d]),
      ...MAP_ITEM_DIRS.map((d) => n.version[d]),
    ],
  );
  const dto = toDto(rows[0]!);
  if (!dto) throw new Abort(refuse(404, "not_found"));
  return dto;
}

/** Rename, regroup, hide/show, resize. A request that changes nothing writes and audits nothing. */
export function updateMapItem(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  key: string,
  patch: MapItemPatchValue,
): Promise<EditResult<EditOutcome>> {
  const lib = libraryItem(key);
  if (!lib) return Promise.resolve(refuse(404, "not_found"));
  if (lib.fixedSize && ((patch.w ?? lib.w) !== lib.w || (patch.h ?? lib.h) !== lib.h)) {
    return Promise.resolve(refuse(422, "item_fixed_size"));
  }
  if (patch.hidden === true && lib.kind === "chair") {
    return Promise.resolve(refuse(422, "not_allowed"));
  }
  const mayResize = !lib.fixedSize && (patch.w !== undefined || patch.h !== undefined);
  return inTx(db, async (c) => {
    const row = await lockRow(c, scope, key, mayResize);
    const cur = fromRow(row);
    const next: Next = structuredClone(cur);
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.group !== undefined) next.group = patch.group;
    if (patch.hidden !== undefined) next.hidden = patch.hidden;
    if (patch.w !== undefined) next.w = patch.w;
    if (patch.h !== undefined) next.h = patch.h;
    await applySize(c, scope, key, cur, next);
    const toDiscard = deletedIds(cur, next);
    if (same(cur, next)) return { item: toDto(row)!, discardFileIds: [] };
    const item = await write(c, scope, key, next);
    const spritesCleared = MAP_ITEM_DIRS.filter((d) => cur.sprite[d] !== next.sprite[d]).length;
    const fields = [
      ...(cur.name !== next.name ? ["name"] : []),
      ...(cur.group !== next.group ? ["group"] : []),
      ...(cur.hidden !== next.hidden ? ["hidden"] : []),
      ...(cur.w !== next.w || cur.h !== next.h ? ["size"] : []),
    ];
    await writeAudit(c, scope, {
      actorSub,
      action: "map_item.update",
      entity: "map_item",
      entityId: null,
      meta: {
        key,
        fields,
        ...(cur.name !== next.name ? { name: { from: cur.name, to: next.name } } : {}),
        ...(cur.group !== next.group ? { group: { from: cur.group, to: next.group } } : {}),
        ...(cur.hidden !== next.hidden ? { hidden: next.hidden } : {}),
        ...(cur.w !== next.w || cur.h !== next.h
          ? { size: { from: [cur.w, cur.h], to: [next.w, next.h] } }
          : {}),
        ...(toDiscard.length > 0 ? { imagesDeleted: toDiscard.length } : {}),
        ...(spritesCleared > 0 ? { spritesCleared } : {}),
      },
    });
    return { item, discardFileIds: toDiscard };
  });
}

/** Pick (or clear, `null`) the package sprite of one direction. The frame must fit the item's size there (LAY-07). */
export function setMapItemArt(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  key: string,
  dir: Direction,
  sprite: string | null,
): Promise<EditResult<MapItemDto>> {
  const lib = libraryItem(key);
  if (!lib) return Promise.resolve(refuse(404, "not_found"));
  if (!artDirAllowed(lib, dir)) return Promise.resolve(refuse(422, "not_allowed"));
  if (sprite !== null && !spriteAllowedFor(lib, sprite)) {
    return Promise.resolve(refuse(422, "sprite_not_allowed"));
  }
  return inTx(db, async (c) => {
    const row = await lockRow(c, scope, key, false);
    const cur = fromRow(row);
    if (sprite !== null && !spriteFits(sprite, dir, cur.w, cur.h)) {
      throw new Abort(refuse(422, "sprite_not_allowed"));
    }
    if (cur.sprite[dir] === sprite) return toDto(row)!;
    const next: Next = structuredClone(cur);
    next.sprite[dir] = sprite;
    const item = await write(c, scope, key, next);
    await writeAudit(c, scope, {
      actorSub,
      action: "map_item.art_set",
      entity: "map_item",
      entityId: null,
      meta: { key, dir, from: cur.sprite[dir], to: sprite },
    });
    return item;
  });
}

/** Back to the library defaults: name, group, size, shown, no package sprite, no custom image (A1). */
export function resetMapItem(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  key: string,
): Promise<EditResult<EditOutcome>> {
  const lib = libraryItem(key);
  if (!lib) return Promise.resolve(refuse(404, "not_found"));
  return inTx(db, async (c) => {
    const row = await lockRow(c, scope, key, !lib.fixedSize);
    const cur = fromRow(row);
    const next: Next = structuredClone(cur);
    next.name = mapItemName(key);
    next.group = lib.group;
    next.hidden = false;
    next.w = lib.w;
    next.h = lib.h;
    for (const d of MAP_ITEM_DIRS) {
      next.sprite[d] = null;
      dropFile(next, cur, d);
    }
    await applySize(c, scope, key, cur, next);
    if (same(cur, next)) return { item: toDto(row)!, discardFileIds: [] };
    const toDiscard = deletedIds(cur, next);
    const item = await write(c, scope, key, next);
    const fields = [
      ...(cur.name !== next.name ? ["name"] : []),
      ...(cur.group !== next.group ? ["group"] : []),
      ...(cur.hidden !== next.hidden ? ["hidden"] : []),
      ...(cur.w !== next.w || cur.h !== next.h ? ["size"] : []),
      ...(MAP_ITEM_DIRS.some((d) => cur.sprite[d] !== null) ? ["sprites"] : []),
    ];
    await writeAudit(c, scope, {
      actorSub,
      action: "map_item.reset",
      entity: "map_item",
      entityId: null,
      meta: { key, fields, imagesDeleted: toDiscard.length },
    });
    return { item, discardFileIds: toDiscard };
  });
}
