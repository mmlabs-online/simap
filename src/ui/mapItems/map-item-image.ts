import type { MapItemDto } from "@/lib/map-items/types";
import { mapItemImageFits } from "@/lib/map-items/art";
import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { parsePng } from "@/lib/validate/png";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { expectedImageSize } from "./map-item-art";
import { mapItemErrorMessage } from "./map-items-state";
import type { MapItemsResult } from "./map-items-api";

type ArtItem = Pick<MapItemDto, "kind" | "w" | "h" | "directional">;
type Px = { width: number; height: number };

export type MapItemImageCheck =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | {
      ok: false;
      code: "image_too_large" | "image_not_png" | "image_bad_size" | "read_failed";
      px?: Px;
    };

/** Client check before sending: byte size first (no read), then the PNG structure, then the size for the direction. */
export async function checkMapItemImage(
  file: { size: number; arrayBuffer(): Promise<ArrayBuffer> },
  item: ArtItem,
  dir: Direction,
): Promise<MapItemImageCheck> {
  const max = MAP_ITEM_LIMITS.imageBytes;
  if (file.size > max) return { ok: false, code: "image_too_large" };
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: "read_failed" };
  }
  if (bytes.length > max) return { ok: false, code: "image_too_large" };
  const png = parsePng(bytes);
  if (!png.ok) return { ok: false, code: "image_not_png" };
  const px = { width: png.width, height: png.height };
  return mapItemImageFits(item, dir, item.w, item.h, px)
    ? { ok: true, bytes }
    : { ok: false, code: "image_bad_size", px };
}

/** Map item messages: the 64 KB and per-direction size limits, never the device-type texts. */
export function artErrorMessage(code: string, item: ArtItem, dir: Direction, px?: Px): string {
  const e = mapItemsCopy.art.errors;
  switch (code) {
    case "image_too_large":
    case "image_not_png":
    case "read_failed":
    case "image_changed":
      return e[code];
    case "image_bad_size": {
      const { w, hMin, hMax } = expectedImageSize(item, dir);
      return e.image_bad_size(
        item.directional ? mapItemsCopy.art.dirs[dir] : mapItemsCopy.art.single,
        w,
        hMin,
        hMax,
        px ? `${px.width} × ${px.height}` : undefined,
      );
    }
    default:
      return mapItemErrorMessage(code);
  }
}

export type ArtOutcome =
  | { kind: "saved" }
  | { kind: "reload"; message: string }
  | { kind: "gone" }
  | { kind: "error"; message: string };

export function artOutcome(
  result: MapItemsResult<unknown>,
  item: ArtItem,
  dir: Direction,
): ArtOutcome {
  if (result.ok) return { kind: "saved" };
  if (result.code === "not_found") return { kind: "gone" };
  const message = artErrorMessage(result.code, item, dir);
  return result.code === "image_changed" ? { kind: "reload", message } : { kind: "error", message };
}
