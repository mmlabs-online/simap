"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import { parseItemImageId, itemImageId } from "@/lib/sprites/item-art";
import type { Direction } from "@/lib/sprites/types";
import { createImageUrlCache, type ImageUrlCache } from "../deviceTypes/image-url-cache";
import type { MapItemsApi } from "./map-items-api";
import { artImageEntries } from "./map-item-art";

/** Blob URLs for the listed items' custom images. The cache lives from mount to unmount and revokes every URL then. */
export function useMapItemImages(
  api: MapItemsApi,
  items: readonly MapItemDto[],
): (item: MapItemDto, dir: Direction) => string | null {
  const [cache, setCache] = useState<ImageUrlCache | null>(null);
  const [, bump] = useState(0);
  const entries = useMemo(() => artImageEntries(items), [items]);

  useEffect(() => {
    const c = createImageUrlCache({
      load: (id) => {
        const p = parseItemImageId(id);
        return p
          ? api.getArtImage(p.key, p.dir).then((r) => (r.ok ? r.value : null))
          : Promise.resolve(null);
      },
      create: (b) => URL.createObjectURL(b),
      revoke: (u) => URL.revokeObjectURL(u),
      onChange: () => bump((n) => n + 1),
    });
    setCache(c);
    return () => {
      c.dispose();
      setCache(null);
    };
  }, [api]);

  useEffect(() => {
    cache?.sync(entries);
  }, [cache, entries]);

  return useCallback(
    (item: MapItemDto, dir: Direction) =>
      cache?.url({ id: itemImageId(item.builtinKey, dir), ...item.art[dir] }) ?? null,
    [cache],
  );
}
