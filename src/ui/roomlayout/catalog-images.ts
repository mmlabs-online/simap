import type { SeatDevice, SeatDeviceType } from "@/lib/sprites/layout";
import { createImageUrlCache } from "../deviceTypes/image-url-cache";

/** What the map and the editor need to draw catalog device images. `version` changes whenever an image becomes ready. */
export type CatalogImages = {
  version: number;
  ready: (t: SeatDeviceType) => boolean;
  source: (typeId: string, version: number) => CanvasImageSource | null;
};

type Options = {
  load: (id: string) => Promise<Blob | null>;
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  /** Decodes a blob URL; null when it is not a usable image. */
  decode: (url: string) => Promise<CanvasImageSource | null>;
  onChange: () => void;
};

/** One fetch and one decode per `{type id, imageVersion}`; a failure at either step means "not ready". No React. */
export function createCatalogImages({ load, create, revoke, decode, onChange }: Options) {
  const decoded = new Map<string, { version: number; source: CanvasImageSource | null }>();
  const pending = new Set<string>();
  let types: SeatDeviceType[] = [];
  let disposed = false;

  function decodeReady() {
    for (const t of types) {
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

  const source = (typeId: string, version: number) => {
    const d = decoded.get(typeId);
    return d && d.version === version ? d.source : null;
  };

  return {
    sync(devices: Readonly<Record<string, readonly SeatDevice[]>>) {
      if (disposed) return;
      const byId = new Map<string, SeatDeviceType>();
      for (const list of Object.values(devices)) {
        for (const d of list) if (d.deviceType?.hasImage) byId.set(d.deviceType.id, d.deviceType);
      }
      types = [...byId.values()];
      for (const id of [...decoded.keys()]) if (!byId.has(id)) decoded.delete(id);
      cache.sync(types);
      decodeReady();
    },
    ready: (t: SeatDeviceType) => source(t.id, t.imageVersion) !== null,
    source,
    dispose() {
      disposed = true;
      decoded.clear();
      cache.dispose();
    },
  };
}
