"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import type { DeviceTypesApi } from "./device-types-api";
import { createImageUrlCache, type ImageUrlCache } from "./image-url-cache";

/** Blob URLs for the listed types' images. The cache lives from mount to unmount and revokes every URL then. */
export function useDeviceTypeImages(
  api: DeviceTypesApi,
  items: readonly DeviceTypeDto[],
): (t: DeviceTypeDto) => string | null {
  const [cache, setCache] = useState<ImageUrlCache | null>(null);
  const [, bump] = useState(0);
  const ref = useRef<ImageUrlCache | null>(null);

  useEffect(() => {
    const c = createImageUrlCache({
      load: (id) => api.getImage(id).then((r) => (r.ok ? r.value : null)),
      create: (b) => URL.createObjectURL(b),
      revoke: (u) => URL.revokeObjectURL(u),
      onChange: () => bump((n) => n + 1),
    });
    ref.current = c;
    setCache(c);
    return () => {
      c.dispose();
      ref.current = null;
      setCache(null);
    };
  }, [api]);

  useEffect(() => {
    cache?.sync(items);
  }, [cache, items]);

  return useCallback((t: DeviceTypeDto) => cache?.url(t) ?? null, [cache]);
}
