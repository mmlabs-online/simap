import { libraryItem } from "@/lib/map-items/library";
import type { MapItemDto } from "@/lib/map-items/types";

const NO_ART = { sprite: null, hasImage: false, imageVersion: 0 };

/** A library item as the API returns it, with optional overrides (tests only). */
export function dto(key: string, over: Partial<MapItemDto> = {}): MapItemDto {
  const lib = libraryItem(key)!;
  return {
    ...lib,
    hidden: false,
    art: { n: NO_ART, e: NO_ART, s: NO_ART, w: NO_ART },
    ...over,
  };
}
