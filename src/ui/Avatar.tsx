"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

// The photo is decorative: the span is aria-hidden and the name sits next to it. A constant keeps the copy scan quiet.
const DECORATIVE = "";

/**
 * Initial-based circular avatar, optionally tinted by a group colour (then white text). With `src` (a photo URL)
 * it shows the photo instead, and falls back to the initials when the image fails to load.
 */
export function Avatar({
  name,
  color,
  size = 44,
  src,
}: {
  name: string;
  color?: string;
  size?: number;
  src?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!src && failed !== src;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-extrabold flex-none"
      style={{
        width: size,
        height: size,
        background: color ?? "var(--secondary-container)",
        color: color ? "#ffffff" : "var(--on-secondary-container)",
        fontSize: Math.round(size * 0.34),
      }}
      aria-hidden
    >
      {showPhoto ? (
        <img
          src={src}
          alt={DECORATIVE}
          width={size}
          height={size}
          draggable={false}
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
