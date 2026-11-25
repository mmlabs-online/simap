import type { FootprintLookup } from "@/lib/validate/layout";

/** A lookup over catalog rows (size at rotation 0); an unlisted key goes to `fallback`, else null. */
export function catalogFootprints(
  items: readonly { builtinKey: string; w: number; h: number }[],
  fallback?: FootprintLookup,
): FootprintLookup {
  const sizes = new Map<string, readonly [number, number]>();
  for (const i of items) sizes.set(i.builtinKey, [i.w, i.h]);
  return (key) => sizes.get(key) ?? fallback?.(key) ?? null;
}
