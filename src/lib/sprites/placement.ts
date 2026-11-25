import { placeDevices, resolveDeviceArt } from "./device-slots";
import { avatarFor, avatarFrames, avatarView } from "./avatar";
import { itemArtDir, itemBox, resolveItemArt, type ItemArt, type ItemImageSize } from "./item-art";
import type {
  LayoutItem,
  RoomLayout,
  Rotation,
  SeatDevice,
  SeatDeviceType,
  SeatView,
} from "./layout";
import { overlayFor } from "./overlay";
import { REGISTRY } from "./registry";
import type { Direction, Layer, SpriteFrame, SpriteManifest } from "./types";

export const TILE = 32;

export const ROTATION_TO_DIR: Record<Rotation, Direction> = { 0: "s", 90: "e", 180: "n", 270: "w" };

export type Rect = { x: number; y: number; w: number; h: number };

export type DrawOp =
  | ({ type: "frame"; layer: Layer; key: string; tint: string | null } & Rect)
  | ({ type: "shadow"; layer: "shadow" } & Rect)
  | ({ type: "image"; layer: Layer; src: string; version: number } & Rect)
  | ({ type: "placeholder"; layer: Layer } & Rect);

/** The slot box: every catalog image (24-100 px, D68) is drawn scaled to this square. */
export const DEVICE_IMAGE = 24;

/** Desk footprint in pixels (room coordinates), for the seat buttons. */
export type SeatBox = { id: string; code: string; tileX: number; tileY: number } & Rect;

export type DrawList = { ops: DrawOp[]; bounds: Rect; seats: SeatBox[]; unknown: string[] };

const EMPTY_VIEW: SeatView = { state: "empty", avatarSeed: null, name: null };

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Frame key for a sprite and rotation: a real directional key, else the plain key, else null. */
export function resolveFrameKey(sprite: string, rotation: Rotation): string | null {
  const dir = ROTATION_TO_DIR[rotation];
  const directional = `${sprite}.${dir}`;
  if (Object.hasOwn(REGISTRY, directional) && REGISTRY[directional].dir === dir) return directional;
  return Object.hasOwn(REGISTRY, sprite) ? sprite : null;
}

/** The chair a desk implies (nothing is stored): its tile and frame. The person sits on the near side. */
export function chairFor(
  desk: { x: number; y: number },
  footprint: [number, number],
  dir: Direction,
): { x: number; y: number; key: string } {
  const [w, d] = footprint;
  const cx = desk.x + Math.floor((w - 1) / 2);
  const cy = desk.y + Math.floor((d - 1) / 2);
  switch (dir) {
    case "s":
      return { x: cx, y: desk.y + d, key: "chair.office.n" };
    case "n":
      return { x: cx, y: desk.y - 1, key: "chair.office.s" };
    case "e":
      return { x: desk.x + w, y: cy, key: "chair.office.w" };
    case "w":
      return { x: desk.x - 1, y: cy, key: "chair.office.e" };
  }
}

/** Seats in reading order: row, column, id. */
export function seatOrder<T extends { id: string; x: number; y: number }>(
  seats: readonly T[],
): T[] {
  return [...seats].sort((a, b) => a.y - b.y || a.x - b.x || byId(a.id, b.id));
}

type Item = {
  id: string;
  key: string;
  layer: Layer;
  x: number;
  y: number;
  w: number;
  d: number;
  sub: boolean;
  blocks: boolean;
  /** Extra pixel offset (device slots). */
  offset: [number, number];
  /** A device painted before its desk (a PC under it). */
  under: boolean;
  /** Row of the desk a device sits on; null for ordinary items. */
  hostRow: number | null;
  /** A catalog image drawn instead of the frame, centred on the frame's box. */
  image: { src: string; version: number } | null;
  /** A map item's custom image or placeholder drawn instead of a frame (no painted shadow). */
  custom: Exclude<ItemArt, { type: "frame" }> | null;
};

type SeatItem = {
  id: string;
  x: number;
  y: number;
  footprint: [number, number];
  chairKey: string;
  chairX: number;
  chairY: number;
};

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Ordered draw ops for a room. Unknown sprites are listed in `unknown` and skipped. */
export function buildDrawList(
  layout: RoomLayout,
  seatViews: Readonly<Record<string, SeatView>>,
  manifest: SpriteManifest,
  seatDevices: Readonly<Record<string, readonly SeatDevice[]>> = {},
  imageReady: (t: SeatDeviceType) => boolean = () => false,
  art: {
    items?: readonly LayoutItem[];
    image?: (key: string, dir: Direction, version: number) => ItemImageSize | null;
  } = {},
): DrawList {
  const unknown: string[] = [];
  const ops: DrawOp[] = [];
  const items: Item[] = [];
  const seatItems: SeatItem[] = [];
  const seatBoxes: SeatBox[] = [];
  const rows = new Map((art.items ?? []).map((i) => [i.builtinKey, i]));
  const imageSize = art.image ?? (() => null);
  let bounds: Rect = { x: 0, y: 0, w: layout.w * TILE, h: layout.h * TILE };

  const emit = (op: DrawOp) => {
    ops.push(op);
    bounds = union(bounds, op);
  };
  const emitFrame = (
    layer: Layer,
    key: string,
    tx: number,
    ty: number,
    offset: [number, number] = [0, 0],
    tint: string | null = null,
  ) => {
    const f = manifest.frames[key];
    if (!f) return;
    emit({
      type: "frame",
      layer,
      key,
      tint,
      x: tx * TILE + f.anchor[0] + offset[0],
      y: ty * TILE + f.anchor[1] + offset[1],
      w: f.w,
      h: f.h,
    });
  };
  const lookup = (sprite: string, rotation: Rotation) => {
    const key = resolveFrameKey(sprite, rotation);
    const frame = key ? manifest.frames[key] : undefined;
    if (!key || !frame) {
      unknown.push(sprite);
      return null;
    }
    return { key, frame };
  };
  const addItem = (
    id: string,
    key: string,
    x: number,
    y: number,
    extra: Partial<
      Pick<Item, "offset" | "under" | "hostRow" | "sub" | "image" | "layer" | "custom">
    > = {},
  ) => {
    const frame = manifest.frames[key];
    const reg = REGISTRY[key];
    items.push({
      id,
      key,
      layer: reg.layer,
      x,
      y,
      w: frame.tiles[0],
      d: frame.tiles[1],
      sub: reg.tiles === null,
      blocks: frame.blocks,
      offset: [0, 0],
      under: false,
      hostRow: null,
      image: null,
      custom: null,
      ...extra,
    });
  };
  /** The art of a placed catalog item (row present): the chain of `resolveItemArt`, drawn bottom-left aligned in `box`. */
  const addRowItem = (
    id: string,
    row: LayoutItem,
    libraryKey: string,
    dir: Direction,
    x: number,
    y: number,
    box: [number, number],
  ) => {
    const choice = resolveItemArt({
      item: row,
      dir,
      box,
      libraryKey,
      frames: manifest.frames,
      image: imageSize,
      unknown,
    });
    if (choice.type === "frame") {
      const frame = manifest.frames[choice.key];
      const lib = REGISTRY[resolveFrameKey(row.builtinKey, 0) ?? ""]?.tiles ?? [1, 1];
      const shift =
        choice.library && row.w === lib[0] && row.h === lib[1] ? 0 : box[1] - frame.tiles[1];
      addItem(id, choice.key, x, y + shift, { layer: REGISTRY[libraryKey].layer });
      return;
    }
    const lib = REGISTRY[libraryKey];
    items.push({
      id,
      key: libraryKey,
      layer: lib.layer,
      x,
      y,
      w: box[0],
      d: box[1],
      sub: lib.tiles === null,
      blocks: manifest.frames[libraryKey]?.blocks ?? lib.blocks,
      offset: [0, 0],
      under: false,
      hostRow: null,
      image: null,
      custom: choice,
    });
  };

  for (const zone of layout.floors) {
    const zoneRow = rows.get(zone.sprite);
    const libraryKey = zoneRow ? resolveFrameKey(zone.sprite, 0) : null;
    const choice =
      zoneRow && libraryKey
        ? resolveItemArt({
            item: zoneRow,
            dir: "s",
            box: [1, 1],
            libraryKey,
            frames: manifest.frames,
            image: imageSize,
            unknown,
          })
        : null;
    const found = choice ? null : lookup(zone.sprite, 0);
    if (!choice && !found) continue;
    for (let row = 0; row < zone.h; row++) {
      for (let col = 0; col < zone.w; col++) {
        const tx = zone.x + col;
        const ty = zone.y + row;
        if (!choice) emitFrame("floor", found!.key, tx, ty);
        else if (choice.type === "frame") emitFrame("floor", choice.key, tx, ty);
        else if (choice.type === "image") {
          emit({
            type: "image",
            layer: "floor",
            src: choice.src,
            version: choice.version,
            x: tx * TILE,
            y: ty * TILE,
            w: choice.w,
            h: choice.h,
          });
        } else {
          emit({
            type: "placeholder",
            layer: "floor",
            x: tx * TILE,
            y: ty * TILE,
            w: TILE,
            h: TILE,
          });
        }
      }
    }
  }

  /** The library frame key of a placement: with a catalog row it need not be in the manifest. */
  const libraryOf = (sprite: string, rotation: Rotation) => {
    if (!rows.has(sprite)) return lookup(sprite, rotation);
    const key = resolveFrameKey(sprite, rotation);
    if (!key) {
      unknown.push(sprite);
      return null;
    }
    return { key, frame: manifest.frames[key] as SpriteFrame | undefined };
  };

  for (const fx of layout.fixtures) {
    const found = libraryOf(fx.sprite, fx.rotation);
    if (!found) continue;
    const row = rows.get(fx.sprite);
    if (row) {
      addRowItem(
        fx.id,
        row,
        found.key,
        itemArtDir(row, fx.rotation),
        fx.x,
        fx.y,
        itemBox(row, fx.rotation),
      );
    } else addItem(fx.id, found.key, fx.x, fx.y);
  }

  for (const seat of layout.seats) {
    const found = libraryOf(seat.sprite, seat.rotation);
    if (!found) continue;
    const row = rows.get(seat.sprite);
    const footprint: [number, number] = row ? itemBox(row, seat.rotation) : found.frame!.tiles;
    if (row) {
      addRowItem(
        seat.id,
        row,
        found.key,
        itemArtDir(row, seat.rotation),
        seat.x,
        seat.y,
        footprint,
      );
    } else addItem(seat.id, found.key, seat.x, seat.y);
    const dir = REGISTRY[found.key].dir ?? ROTATION_TO_DIR[seat.rotation];
    const chair = chairFor(seat, footprint, dir);
    const chairRow = rows.get("chair.office");
    if (chairRow) {
      addRowItem(
        `${seat.id}:chair`,
        chairRow,
        chair.key,
        chair.key.slice(-1) as Direction,
        chair.x,
        chair.y,
        [1, 1],
      );
    } else if (manifest.frames[chair.key]) addItem(`${seat.id}:chair`, chair.key, chair.x, chair.y);
    else unknown.push(chair.key);
    seatItems.push({
      id: seat.id,
      x: seat.x,
      y: seat.y,
      footprint,
      chairKey: chair.key,
      chairX: chair.x,
      chairY: chair.y,
    });
    const types = (seatDevices[seat.id] ?? []).map((d) => resolveDeviceArt(d, imageReady));
    placeDevices(seat, footprint, dir, types).forEach((d, n) => {
      if (!manifest.frames[d.key]) {
        unknown.push(d.key);
        return;
      }
      addItem(`${seat.id}:dev:${n}`, d.key, d.x, d.y, {
        sub: true,
        offset: d.offset,
        under: d.under,
        hostRow: seat.y + footprint[1] - 1,
        image: d.art.type === "image" ? { src: d.art.typeId, version: d.art.version } : null,
      });
    });
    seatBoxes.push({
      id: seat.id,
      code: seat.code,
      tileX: seat.x,
      tileY: seat.y,
      x: seat.x * TILE,
      y: seat.y * TILE,
      w: footprint[0] * TILE,
      h: footprint[1] * TILE,
    });
  }

  // F2: a sub-tile prop sorts with the blocking full-tile furniture under it, so it paints after that host.
  const hosts = items.filter((i) => !i.sub && i.layer === "furniture" && i.blocks);
  const sortRow = (i: Item) => {
    if (!i.sub) return i.y + i.d - 1;
    const rows = hosts
      .filter((h) => i.x >= h.x && i.x < h.x + h.w && i.y >= h.y && i.y < h.y + h.d)
      .map((h) => h.y + h.d - 1);
    return rows.length > 0 ? Math.max(...rows) : i.y;
  };
  const tier = (i: Item) => (i.under ? 0 : i.sub ? 2 : 1);
  const ordered = items
    .map((item) => ({ item, row: item.hostRow ?? sortRow(item) }))
    .sort(
      (a, b) =>
        a.row - b.row ||
        tier(a.item) - tier(b.item) ||
        a.item.x - b.item.x ||
        byId(a.item.id, b.item.id),
    )
    .map((e) => e.item);

  for (const item of ordered) {
    if (item.custom) {
      const { x, y } = { x: item.x * TILE, y: item.y * TILE };
      if (item.custom.type === "image") {
        const { src, version, w, h } = item.custom;
        emit({ type: "image", layer: item.layer, src, version, x, y: y + item.d * TILE - h, w, h });
      } else {
        emit({ type: "placeholder", layer: item.layer, x, y, w: item.w * TILE, h: item.d * TILE });
      }
      continue;
    }
    if (REGISTRY[item.key].shadow) {
      emit({
        type: "shadow",
        layer: "shadow",
        x: item.x * TILE + 2,
        y: (item.y + item.d) * TILE - 1,
        w: item.w * TILE - 4,
        h: 4,
      });
    }
    if (item.image) {
      const f = manifest.frames[item.key];
      emit({
        type: "image",
        layer: item.layer,
        ...item.image,
        x: item.x * TILE + f.anchor[0] + item.offset[0] + Math.floor((f.w - DEVICE_IMAGE) / 2),
        y: item.y * TILE + f.anchor[1] + item.offset[1] + Math.floor((f.h - DEVICE_IMAGE) / 2),
        w: DEVICE_IMAGE,
        h: DEVICE_IMAGE,
      });
    } else {
      emitFrame(item.layer, item.key, item.x, item.y, item.offset);
    }
  }

  for (const s of seatItems) {
    const view = seatViews[s.id] ?? EMPTY_VIEW;
    if (view.avatarSeed !== null) {
      for (const f of avatarFrames(avatarFor(view.avatarSeed), avatarView(s.chairKey))) {
        emitFrame("avatar", f.key, s.chairX, s.chairY, [0, 0], f.tint);
      }
    }
    for (const o of overlayFor(view.state, s.footprint)) {
      const [bx, by] = o.target === "chair" ? [s.chairX, s.chairY] : [s.x, s.y];
      emitFrame("overlay", o.key, bx + o.tile[0], by + o.tile[1], o.offset);
    }
  }

  const rank = (op: DrawOp) => manifest.layers.indexOf(op.layer);
  const sorted = ops
    .map((op, i) => ({ op, i }))
    .sort((a, b) => rank(a.op) - rank(b.op) || a.i - b.i)
    .map((e) => e.op);

  return { ops: sorted, bounds, seats: seatOrder(seatBoxes), unknown };
}
