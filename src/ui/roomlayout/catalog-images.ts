import type { SeatDevice, SeatDeviceType } from "@/lib/sprites/layout";
import { itemImageId, type ItemArtEntry, type ItemImageSize } from "@/lib/sprites/item-art";
import type { Direction } from "@/lib/sprites/types";
import { createImageUrlCache, type ImageEntry } from "../deviceTypes/image-url-cache";

/** What the map and the editor need to draw catalog device images. `version` changes whenever an image becomes ready. */
export type CatalogImages = {
  version: number;
  ready: (t: SeatDeviceType) => boolean;
  source: (src: string, version: number) => CanvasImageSource | null;
  /** The decoded size of a map item's custom image; null until it is ready for that version. */
  itemSize: (key: string, dir: Direction, version: number) => ItemImageSize | null;
};

type Options = {
  load: (id: string) => Promise<Blob | null>;
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  /** Decodes a blob URL; null when it is not a usable image. */
  decode: (url: string) => Promise<CanvasImageSource | null>;
  onChange: () => void;
};

/** One fetch and one decode per `{id, imageVersion}` (device type id or item `{key, dir}`); a failure at either step means "not ready". No React. */
export function createCatalogImages({ load, create, revoke, decode, onChange }: Options) {
  const decoded = new Map<string, { version: number; source: CanvasImageSource | null }>();
  const pending = new Set<string>();
  let entries: ImageEntry[] = [];
  let disposed = false;

  function decodeReady() {
    for (const t of entries) {
      const url = cache.url(t);
      const have = decoded.get(t.id);
      if (!url || pending.has(t.id) || have?.version === t.imageVersion) continue;
      pending.add(t.id);
      decode(url)
        .catch(() => null)
        .then((source) => {
          pending.delete(t.id);
          if (disposed) return;
          decoded.set(t.id, { version: t.imageVersion, source });
          onChange();
          decodeReady();
        });
    }
  }

  const cache = createImageUrlCache({
    load,
    create,
    revoke,
    onChange: decodeReady,
  });

  const source = (src: string, version: number) => {
    const d = decoded.get(src);
    return d && d.version === version ? d.source : null;
  };
  const itemSize = (key: string, dir: Direction, version: number): ItemImageSize | null => {
    const s = source(itemImageId(key, dir), version) as {
      naturalWidth?: number;
      naturalHeight?: number;
      width?: number;
      height?: number;
    } | null;
    if (!s) return null;
    const w = s.naturalWidth ?? s.width;
    const h = s.naturalHeight ?? s.height;
    return typeof w === "number" && typeof h === "number" ? { w, h } : null;
  };

  return {
    sync(
      devices: Readonly<Record<string, readonly SeatDevice[]>>,
      items: readonly ItemArtEntry[] = [],
    ) {
      if (disposed) return;
      const byId = new Map<string, ImageEntry>();
      for (const list of Object.values(devices)) {
        for (const d of list) if (d.deviceType?.hasImage) byId.set(d.deviceType.id, d.deviceType);
      }
      for (const i of items) byId.set(i.id, i);
      entries = [...byId.values()];
      for (const id of [...decoded.keys()]) if (!byId.has(id)) decoded.delete(id);
      cache.sync(entries);
      decodeReady();
    },
    ready: (t: SeatDeviceType) => source(t.id, t.imageVersion) !== null,
    source,
    itemSize,
    dispose() {
      disposed = true;
      decoded.clear();
      cache.dispose();
    },
  };
}
