"use client";

import { useCallback, useEffect, useState } from "react";
import { createImageUrlCache, type ImageUrlCache } from "../deviceTypes/image-url-cache";
import { photoLoader, toImageEntry, type PhotoRef } from "./member-photos";
import type { MembersApi } from "./members-api";

/** Blob URLs for the listed members' photos. The cache lives from mount to unmount and revokes every URL then. */
export function useMemberPhotos(
  api: Pick<MembersApi, "getPhoto">,
  items: readonly PhotoRef[],
): (r: PhotoRef) => string | null {
  const [cache, setCache] = useState<ImageUrlCache | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const c = createImageUrlCache({
      load: photoLoader(api),
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
    cache?.sync(items.map(toImageEntry));
  }, [cache, items]);

  return useCallback((r: PhotoRef) => cache?.url(toImageEntry(r)) ?? null, [cache]);
}
