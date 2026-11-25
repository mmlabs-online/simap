"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseItemImageId, type ItemArtEntry } from "@/lib/sprites/item-art";
import type { SeatDevice } from "@/lib/sprites/layout";
import { useApiFetch } from "../auth/api-fetch-context";
import { createDeviceTypesApi } from "../deviceTypes/device-types-api";
import { createMapItemsApi } from "../mapItems/map-items-api";
import { createCatalogImages, type CatalogImages } from "./catalog-images";

function decodeImage(url: string): Promise<CanvasImageSource | null> {
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img);
}

/** Catalog images of the devices and map items on a page: fetched once per id and version, revoked on unmount. Call it once per page. */
export function useCatalogImages(
  seatDevices: Readonly<Record<string, readonly SeatDevice[]>> | undefined,
  items?: readonly ItemArtEntry[],
): CatalogImages {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDeviceTypesApi(apiFetch), [apiFetch]);
  const itemsApi = useMemo(() => createMapItemsApi(apiFetch), [apiFetch]);
  const [version, setVersion] = useState(0);
  const [images, setImages] = useState<ReturnType<typeof createCatalogImages> | null>(null);
  const ref = useRef(images);
  ref.current = images;

  useEffect(() => {
    const c = createCatalogImages({
      load: (id) => {
        const item = parseItemImageId(id);
        return (item ? itemsApi.getArtImage(item.key, item.dir) : api.getImage(id)).then((r) =>
          r.ok ? r.value : null,
        );
      },
      create: (b) => URL.createObjectURL(b),
      revoke: (u) => URL.revokeObjectURL(u),
      decode: decodeImage,
      onChange: () => setVersion((n) => n + 1),
    });
    setImages(c);
    return () => {
      c.dispose();
      setImages(null);
    };
  }, [api, itemsApi]);

  useEffect(() => {
    if (images && (seatDevices || items)) images.sync(seatDevices ?? {}, items ?? []);
  }, [images, seatDevices, items]);

  return useMemo(
    () => ({
      version,
      ready: (t) => ref.current?.ready(t) ?? false,
      source: (id, v) => ref.current?.source(id, v) ?? null,
      itemSize: (key, dir, v) => ref.current?.itemSize(key, dir, v) ?? null,
    }),
    [version],
  );
}
