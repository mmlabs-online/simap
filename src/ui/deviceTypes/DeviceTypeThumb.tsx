"use client";

import { useState } from "react";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { Icon } from "../Icon";

const SIZE = 48;

/** A device type image at 2x with nearest-neighbour zoom, or a dashed placeholder. */
export function DeviceTypeThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        width={SIZE}
        height={SIZE}
        alt={alt}
        className="shrink-0 object-contain [image-rendering:pixelated]"
        style={{ imageRendering: "pixelated" }}
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
