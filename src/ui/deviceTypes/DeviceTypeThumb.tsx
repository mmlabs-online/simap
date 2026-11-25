"use client";

import { useState } from "react";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { Icon } from "../Icon";
import { thumbRendering } from "./device-type-image";

const SIZE = 48;

/**
 * A device type image fitted into a 48 px box, or a dashed placeholder. Sources up to the box (and any image before
 * it loads) use nearest-neighbour zoom; larger ones (D68) are smoothed.
 */
export function DeviceTypeThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ url: string; width: number } | null>(null);
  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        width={SIZE}
        height={SIZE}
        alt={alt}
        className="shrink-0 object-contain"
        style={{
          imageRendering: thumbRendering(loaded?.url === url ? loaded.width : null, SIZE),
        }}
        onLoad={(e) => setLoaded({ url, width: e.currentTarget.naturalWidth })}
        onError={() => setFailedUrl(url)}
      />
    );
  }
  return (
    <span
      className="shrink-0 flex items-center justify-center rounded-md border border-dashed border-outline-variant text-on-surface-variant"
      style={{ width: SIZE, height: SIZE }}
    >
      <Icon name="category" size={20} />
      <span className="sr-only">{deviceTypesCopy.thumb.none}</span>
    </span>
  );
}
