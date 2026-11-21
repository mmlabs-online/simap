// Sprite atlas packer core (SIM-024). Priority per key: assets/art/export/<key>.png > sprite map > placeholder.
// Writes <outDir>/office.png + office.json. Node built-ins only. CLI: scripts/sprites-pack.mjs.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "./png.mjs";
import { drawPlaceholder } from "./placeholders.mjs";
import { blit, create, crop, scaleNearest } from "./raster.mjs";

/** @typedef {import("./raster.mjs").Img} Img */
/** @typedef {{ group: string, dir: string | null, layer: string, tiles: [number, number] | null, blocks: boolean, shadow: boolean }} Entry */
/** @typedef {{ key: string, source: "export" | "map" | "placeholder", img: Img, anchor: [number, number] }} Resolved */

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "../..");
export const ATLAS_WIDTH = 1024;
const TILE = 32;
const HEADROOM = 16;

/** @param {string} p */
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function loadRegistry(root = ROOT) {
  return /** @type {Record<string, Entry>} */ (readJson(join(root, "src/lib/sprites/keys.json")));
}

/** Manifest anchor from a sprite-map anchor: -(anchor * scale); no anchor means [0, 0]. @param {number[] | undefined} anchor @param {number} scale @returns {[number, number]} */
export function mapAnchor(anchor, scale) {
  return anchor ? [0 - anchor[0] * scale, 0 - anchor[1] * scale] : [0, 0];
}

/** Anchor of an export canvas (style guide section 8), or an error message. @param {Entry} entry @param {number} w @param {number} h @returns {{ anchor: [number, number] } | { error: string }} */
export function exportAnchor(entry, w, h) {
  if (!entry.tiles) {
    if (w > TILE || h > TILE)
      return { error: `sub-tile canvas ${w}x${h} must be at most ${TILE}x${TILE}` };
    return { anchor: [Math.floor((TILE - w) / 2), TILE - h] };
  }
  const ew = entry.tiles[0] * TILE;
  const eh = entry.tiles[1] * TILE;
  if (w !== ew || (h !== eh && h !== eh + HEADROOM)) {
    return { error: `canvas ${w}x${h} must be ${ew}x${eh} or ${ew}x${eh + HEADROOM}` };
  }
  return { anchor: [0, 0 - (h - eh)] };
}

/**
 * Resolves every registry key to pixels. Missing sheets warn; malformed input is an error.
 * @param {{ root: string, registry: Record<string, Entry>, useMap: boolean }} opts
 */
export function resolveSources({ root, registry, useMap }) {
  /** @type {Resolved[]} */
  const items = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const keys = Object.keys(registry).sort();

  /** @type {Map<string, { img: Img, anchor: [number, number] }>} */
  const exported = new Map();
  const dir = join(root, "assets/art/export");
  for (const name of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!name.endsWith(".png")) continue;
    const key = name.slice(0, -4);
    if (!registry[key]) {
      errors.push(`export/${name}: unknown key "${key}"`);
      continue;
    }
    try {
      const img = decodePng(readFileSync(join(dir, name)));
      const r = exportAnchor(registry[key], img.w, img.h);
      if ("error" in r) errors.push(`export/${name}: ${r.error}`);
      else exported.set(key, { img, anchor: r.anchor });
    } catch (e) {
      errors.push(`export/${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const mapPath = join(root, "assets/art/sprite-map.json");
  const map = useMap && existsSync(mapPath) ? readJson(mapPath) : null;
  /** @type {Map<string, Img | null>} */
  const sheets = new Map();
  /** @param {any} m @param {string} key */
  const sheetOf = (m, key) => {
    const file = m.sources?.[m.sprites[key].source]?.files?.[m.sprites[key].sheet];
    if (!file) {
      errors.push(`sprite map "${key}": unknown source or sheet`);
      return null;
    }
    if (!sheets.has(file)) {
      const path = join(root, file);
      if (!existsSync(path)) {
        warnings.push(`source sheet missing, using placeholders: ${file}`);
        sheets.set(file, null);
      } else {
        try {
          sheets.set(file, decodePng(readFileSync(path)));
        } catch (e) {
          errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
          sheets.set(file, null);
        }
      }
    }
    return sheets.get(file) ?? null;
  };
  for (const key of Object.keys(map?.sprites ?? {})) {
    const entry = registry[key];
    if (!entry) {
      errors.push(`sprite map: unknown key "${key}"`);
      continue;
    }
    const want = (entry.tiles ?? [1, 1]).join("x");
    if (map.sprites[key].tiles.join("x") !== want) {
      errors.push(`sprite map "${key}": tiles ${map.sprites[key].tiles.join("x")} must be ${want}`);
    }
  }

  for (const key of keys) {
    const ex = exported.get(key);
    if (ex) {
      items.push({ key, source: "export", ...ex });
      continue;
    }
    const m = map?.sprites?.[key];
    const sheet = m ? sheetOf(map, key) : null;
    if (m && sheet) {
      const [x, y, w, h] = m.rect;
      const img = scaleNearest(crop(sheet, x, y, w, h), m.scale);
      items.push({ key, source: "map", img, anchor: mapAnchor(m.anchor, m.scale) });
      continue;
    }
    items.push({ key, source: "placeholder", ...drawPlaceholder(key, registry[key]) });
  }
  return { items, errors, warnings };
}

/** Shelf packing: tallest first, then key; fixed width, 1 px gap between frames. @param {{ key: string, w: number, h: number }[]} frames */
export function shelfPack(frames, width = ATLAS_WIDTH) {
  const sorted = [...frames].sort((a, b) => b.h - a.h || (a.key < b.key ? -1 : 1));
  /** @type {Record<string, { x: number, y: number }>} */
  const pos = {};
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const f of sorted) {
    if (x > 0 && x + f.w > width) {
      y += rowH + 1;
      x = 0;
      rowH = 0;
    }
    pos[f.key] = { x, y };
    x += f.w + 1;
    rowH = Math.max(rowH, f.h);
  }
  return { pos, w: width, h: y + rowH };
}

/** @param {Resolved[]} items @param {Record<string, Entry>} registry @param {ReturnType<typeof shelfPack>} layout @param {string} version */
export function buildManifest(items, registry, layout, version) {
  /** @type {Record<string, unknown>} */
  const frames = {};
  /** @type {Record<string, string>} */
  const sources = {};
  for (const it of [...items].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    const { x, y } = layout.pos[it.key];
    const e = registry[it.key];
    frames[it.key] = {
      x,
      y,
      w: it.img.w,
      h: it.img.h,
      anchor: it.anchor,
      tiles: e.tiles ?? [1, 1],
      blocks: e.blocks,
    };
    sources[it.key] = it.source;
  }
  return {
    tile: 32,
    frames,
    layers: ["floor", "wall", "shadow", "furniture", "avatar", "overlay"],
    meta: { generator: "scripts/sprites-pack.mjs", version, sources },
  };
}

/** Same bounds and key rules as the TS validator (src/lib/validate/sprite-manifest.ts), without importing TS. @param {any} manifest @param {Record<string, Entry>} registry @param {{w:number,h:number}} atlas */
function selfCheck(manifest, registry, atlas) {
  const errors = [];
  for (const key of Object.keys(registry))
    if (!manifest.frames[key]) errors.push(`missing frame ${key}`);
  for (const [key, f] of Object.entries(manifest.frames)) {
    const fr = /** @type {any} */ (f);
    if (!registry[key]) errors.push(`unknown frame ${key}`);
    if (fr.x < 0 || fr.y < 0 || fr.x + fr.w > atlas.w || fr.y + fr.h > atlas.h)
      errors.push(`frame ${key} outside the atlas`);
  }
  return errors;
}

/** @param {string} outDir @param {Record<string, string>} sources @param {boolean} useMap @param {boolean} force */
function guard(outDir, sources, useMap, force) {
  const path = join(outDir, "office.json");
  if (force || !existsSync(path)) return [];
  let old;
  try {
    old = readJson(path).meta?.sources;
  } catch {
    return [];
  }
  const lost = Object.keys(old ?? {}).filter(
    (k) => sources[k] === "placeholder" && (old[k] === "export" || (old[k] === "map" && useMap)),
  );
  return lost.length === 0
    ? []
    : [
        `refusing to overwrite ${path}: ${lost.length} export/map sprites would become placeholders (use --force)`,
      ];
}

/**
 * @param {{ root?: string, outDir?: string, useMap?: boolean, force?: boolean, registry?: Record<string, Entry>, log?: (line: string) => void }} [opts]
 */
export function pack({
  root = ROOT,
  outDir,
  useMap = true,
  force = false,
  registry,
  log = () => {},
} = {}) {
  const out = outDir ?? join(root, "public/sprites");
  const reg = registry ?? loadRegistry();
  const { items, errors, warnings } = resolveSources({ root, registry: reg, useMap });
  for (const w of warnings) log(`warning: ${w}`);
  /** @type {Record<string, string>} */
  const sources = Object.fromEntries(items.map((i) => [i.key, i.source]));
  if (errors.length > 0) return { ok: false, errors, warnings, sources };

  const layout = shelfPack(items.map((i) => ({ key: i.key, w: i.img.w, h: i.img.h })));
  const atlas = create(layout.w, layout.h);
  for (const it of items) blit(atlas, it.img, layout.pos[it.key].x, layout.pos[it.key].y);
  const png = encodePng(atlas);
  const version = createHash("sha256").update(png).digest("hex").slice(0, 12);
  const manifest = buildManifest(items, reg, layout, version);

  const bad = [...selfCheck(manifest, reg, atlas), ...guard(out, sources, useMap, force)];
  if (bad.length > 0) return { ok: false, errors: bad, warnings, sources };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "office.png"), png);
  writeFileSync(join(out, "office.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { ok: true, errors: [], warnings, sources };
}
