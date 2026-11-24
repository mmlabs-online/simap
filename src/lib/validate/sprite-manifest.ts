import { FRAME_KEYS, LAYERS, REGISTRY, isFrameKey } from "@/lib/sprites/registry";
import type { SpriteManifest } from "@/lib/sprites/types";

export type ManifestError = { path: string; message: string };

export type ManifestResult =
  | { ok: true; value: SpriteManifest }
  | { ok: false; errors: ManifestError[] };

const TOP_KEYS = new Set(["tile", "frames", "layers", "meta"]);
const FRAME_FIELDS = new Set(["x", "y", "w", "h", "anchor", "tiles", "blocks"]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function isPair(v: unknown, positive: boolean): boolean {
  return Array.isArray(v) && v.length === 2 && v.every((n) => isInt(n) && (!positive || n > 0));
}

/** Validates a parsed `office.json` against the key registry and the atlas size. Never throws. */
export function validateSpriteManifest(
  json: unknown,
  atlas: { w: number; h: number },
): ManifestResult {
  const errors: ManifestError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  if (!isObject(json)) {
    return { ok: false, errors: [{ path: "", message: "manifest must be an object" }] };
  }
  for (const k of Object.keys(json)) if (!TOP_KEYS.has(k)) err(k, "unknown top-level field");
  if (json.tile !== 32) err("tile", "must be 32");
  const layers = json.layers;
  if (!Array.isArray(layers) || layers.join(",") !== LAYERS.join(",")) {
    err("layers", `must be exactly ${LAYERS.join(", ")}`);
  }
  if ("meta" in json && !isObject(json.meta)) err("meta", "must be an object");

  const frames = json.frames;
  if (!isObject(frames)) {
    err("frames", "must be an object");
    return { ok: false, errors };
  }
  for (const key of Object.keys(frames)) if (!isFrameKey(key)) err(`frames.${key}`, "unknown key");
  for (const key of FRAME_KEYS) {
    if (Object.hasOwn(frames, key)) continue;
    const dir = REGISTRY[key].dir;
    err(
      `frames.${key}`,
      dir ? `missing direction "${dir}" of ${key.slice(0, -2)}` : "missing frame",
    );
  }
  for (const [key, f] of Object.entries(frames)) {
    if (!isFrameKey(key)) continue;
    const p = `frames.${key}`;
    if (!isObject(f)) {
      err(p, "must be an object");
      continue;
    }
    for (const k of Object.keys(f)) if (!FRAME_FIELDS.has(k)) err(`${p}.${k}`, "unknown field");
    const { x, y, w, h } = f;
    if (!isInt(x) || x < 0) err(`${p}.x`, "must be an integer >= 0");
    if (!isInt(y) || y < 0) err(`${p}.y`, "must be an integer >= 0");
    if (!isInt(w) || w <= 0) err(`${p}.w`, "must be an integer > 0");
    if (!isInt(h) || h <= 0) err(`${p}.h`, "must be an integer > 0");
    if (isInt(x) && isInt(w) && x >= 0 && w > 0 && x + w > atlas.w) {
      err(p, `x+w exceeds the atlas width ${atlas.w}`);
    }
    if (isInt(y) && isInt(h) && y >= 0 && h > 0 && y + h > atlas.h) {
      err(p, `y+h exceeds the atlas height ${atlas.h}`);
    }
    if (!isPair(f.anchor, false)) err(`${p}.anchor`, "must be a pair of integers");
    if (!isPair(f.tiles, true)) err(`${p}.tiles`, "must be a pair of integers > 0");
    else {
      const want = REGISTRY[key].tiles ?? [1, 1];
      const got = f.tiles as number[];
      if (got[0] !== want[0] || got[1] !== want[1]) {
        err(`${p}.tiles`, `must match the registry footprint ${want[0]}x${want[1]}`);
      }
    }
    if (typeof f.blocks !== "boolean") err(`${p}.blocks`, "must be a boolean");
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: json as SpriteManifest };
}
