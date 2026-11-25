"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeatDevice } from "@/lib/sprites/layout";
import { useApiFetch } from "../auth/api-fetch-context";
import { createDeviceTypesApi } from "../deviceTypes/device-types-api";
import { createCatalogImages, type CatalogImages } from "./catalog-images";

function decodeImage(url: string): Promise<CanvasImageSource | null> {
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img);
}

/** Catalog images of the devices on a page: fetched once per type and version, revoked on unmount. Call it once per page. */
export function useCatalogImages(
  seatDevices: Readonly<Record<string, readonly SeatDevice[]>> | undefined,
): CatalogImages {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDeviceTypesApi(apiFetch), [apiFetch]);
  const [version, setVersion] = useState(0);
  const [images, setImages] = useState<ReturnType<typeof createCatalogImages> | null>(null);
  const ref = useRef(images);
  ref.current = images;

  useEffect(() => {
    const c = createCatalogImages({
      load: (id) => api.getImage(id).then((r) => (r.ok ? r.value : null)),
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
  }, [api]);

  useEffect(() => {
    if (images && seatDevices) images.sync(seatDevices);
  }, [images, seatDevices]);

  return useMemo(
    () => ({
      version,
      ready: (t) => ref.current?.ready(t) ?? false,
      source: (id, v) => ref.current?.source(id, v) ?? null,
    }),
    [version],
  );
}
