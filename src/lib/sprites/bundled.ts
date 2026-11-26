/**
 * Frame keys of the bundled art package: frames whose `meta.sources[key]` is `map` or `export` (not `placeholder`).
 * Null when the manifest has no usable `meta.sources` (callers then keep the full list).
 */
export function bundledKeys(
  manifest: { meta?: unknown } | null | undefined,
): ReadonlySet<string> | null {
  const meta = manifest?.meta;
  if (typeof meta !== "object" || meta === null) return null;
  const sources = (meta as { sources?: unknown }).sources;
  if (typeof sources !== "object" || sources === null) return null;
  const keys = new Set<string>();
  for (const [key, source] of Object.entries(sources)) {
    if (source === "map" || source === "export") keys.add(key);
  }
  return keys;
}
