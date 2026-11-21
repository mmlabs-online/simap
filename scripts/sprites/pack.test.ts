import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAME_KEYS, REGISTRY } from "../../src/lib/sprites/registry";
import { validateSpriteManifest } from "../../src/lib/validate/sprite-manifest";
import { exportAnchor, mapAnchor, pack, shelfPack } from "./pack.mjs";
import { decodePng, encodePng, readPngSize } from "./png.mjs";
import { create, fillRect } from "./raster.mjs";

const SHEET = "assets/art/sources/t/sheet.png";

function solid(w: number, h: number, hex: string) {
  const img = create(w, h);
  fillRect(img, 0, 0, w, h, hex);
  return encodePng(img);
}

function write(root: string, rel: string, data: Buffer | string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, data);
}

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "sprites-"));
}

/** A map with one cut: sofa (2x1) from a 4x4 sheet at scale 2, plus whiteboard from a sheet that does not exist. */
function writeMap(root: string) {
  write(
    root,
    "assets/art/sprite-map.json",
    JSON.stringify({
      sources: { t: { files: { s: SHEET, gone: "assets/art/sources/t/gone.png" } } },
      sprites: {
        sofa: {
          source: "t",
          sheet: "s",
          rect: [0, 0, 4, 4],
          scale: 2,
          tiles: [2, 1],
          anchor: [1, 3],
        },
        whiteboard: { source: "t", sheet: "gone", rect: [0, 0, 4, 4], scale: 1, tiles: [2, 1] },
      },
    }),
  );
}

const readManifest = (dir: string) => JSON.parse(readFileSync(join(dir, "office.json"), "utf8"));

describe("sprite packer", () => {
  it("anchor conversion", () => {
    expect(mapAnchor([2, 21], 1)).toEqual([-2, -21]);
    expect(mapAnchor([1, 3], 2)).toEqual([-2, -6]);
    expect(mapAnchor(undefined, 1)).toEqual([0, 0]);
  });

  it("export anchor from canvas size", () => {
    const two = REGISTRY["desk.single.s"];
    expect(exportAnchor(two, 64, 32)).toEqual({ anchor: [0, 0] });
    expect(exportAnchor(two, 64, 48)).toEqual({ anchor: [0, -16] });
    expect(exportAnchor(two, 64, 40)).toHaveProperty("error");
    expect(exportAnchor(REGISTRY["prop.mug"], 10, 12)).toEqual({ anchor: [11, 20] });
  });

  it("priority export > map > placeholder", () => {
    const root = tempRoot();
    writeMap(root);
    write(root, SHEET, solid(4, 4, "#ff0000"));
    write(root, "assets/art/export/sofa.png", solid(64, 32, "#00ff00"));
    write(root, "assets/art/export/plant.small.png", solid(32, 48, "#00ff00"));
    const out = join(root, "out");
    const r = pack({ root, outDir: out });
    expect(r.errors).toEqual([]);
    expect(r.sources.sofa).toBe("export");
    expect(r.sources["plant.small"]).toBe("export");
    expect(r.sources.whiteboard).toBe("placeholder");
    expect(r.warnings).toHaveLength(1);
    expect(readManifest(out).frames["plant.small"].anchor).toEqual([0, -16]);
    // Without the export file the map wins and the anchor comes from the map.
    const root2 = tempRoot();
    writeMap(root2);
    write(root2, SHEET, solid(4, 4, "#ff0000"));
    const r2 = pack({ root: root2, outDir: join(root2, "out") });
    expect(r2.sources.sofa).toBe("map");
    const f = readManifest(join(root2, "out")).frames.sofa;
    expect(f.anchor).toEqual([-2, -6]);
    expect([f.w, f.h]).toEqual([8, 8]);
  });

  it("packs placeholders only when sheets are missing", () => {
    const root = tempRoot();
    mkdirSync(join(root, "assets/art"), { recursive: true });
    copyFileSync("assets/art/sprite-map.json", join(root, "assets/art/sprite-map.json"));
    const out = join(root, "out");
    const r = pack({ root, outDir: out });
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(9);
    const png = readFileSync(join(out, "office.png"));
    const manifest = readManifest(out);
    const v = validateSpriteManifest(manifest, readPngSize(png));
    expect(v.ok ? [] : v.errors).toEqual([]);
    expect(Object.keys(manifest.frames).sort()).toEqual([...FRAME_KEYS]);
    expect(new Set(Object.values(manifest.meta.sources))).toEqual(new Set(["placeholder"]));
  });

  it("rejects unknown export key", () => {
    const root = tempRoot();
    write(root, "assets/art/export/desk.bogus.png", solid(32, 32, "#ffffff"));
    write(root, "assets/art/export/.gitkeep", "");
    const r = pack({ root, outDir: join(root, "out") });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toContain('unknown key "desk.bogus"');
  });

  it("rejects wrong export canvas size", () => {
    const root = tempRoot();
    write(root, "assets/art/export/sofa.png", solid(64, 40, "#ffffff"));
    const r = pack({ root, outDir: join(root, "out") });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toContain("sofa.png: canvas 64x40");
  });

  it("fails on an undecodable sheet", () => {
    const root = tempRoot();
    writeMap(root);
    write(root, SHEET, "not a png");
    const r = pack({ root, outDir: join(root, "out") });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toContain(SHEET);
  });

  it("shelf packer leaves a 1 px gap and no overlaps", () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({
      key: `k${i}`,
      w: 10 + (i % 7) * 9,
      h: 8 + (i % 5) * 6,
    }));
    const { pos, w, h } = shelfPack(frames, 100);
    const boxes = frames.map((f) => ({ ...pos[f.key], w: f.w, h: f.h }));
    for (const b of boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(w);
      expect(b.y + b.h).toBeLessThanOrEqual(h);
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        // Expanding one box by 1 px on every side must still not touch the other.
        const apart =
          a.x + a.w + 1 <= b.x ||
          b.x + b.w + 1 <= a.x ||
          a.y + a.h + 1 <= b.y ||
          b.y + b.h + 1 <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("output is byte-stable", () => {
    const root = tempRoot();
    const a = join(root, "a");
    const b = join(root, "b");
    expect(pack({ root, outDir: a }).ok).toBe(true);
    expect(pack({ root, outDir: b }).ok).toBe(true);
    for (const f of ["office.png", "office.json"]) {
      expect(readFileSync(join(a, f)).equals(readFileSync(join(b, f)))).toBe(true);
    }
    expect(decodePng(readFileSync(join(a, "office.png"))).w).toBe(1024);
  });

  it('overwrite guard refuses to turn "map" sources into "placeholder" without --force; --no-map bypasses it', () => {
    const root = tempRoot();
    writeMap(root);
    write(root, SHEET, solid(4, 4, "#ff0000"));
    const out = join(root, "out");
    expect(pack({ root, outDir: out }).sources.sofa).toBe("map");
    // The sheet disappears: sofa would fall back to a placeholder.
    write(root, SHEET, solid(4, 4, "#ff0000"));
    writeMap(root);
    const gone = JSON.parse(readFileSync(join(root, "assets/art/sprite-map.json"), "utf8"));
    gone.sources.t.files.s = "assets/art/sources/t/missing.png";
    write(root, "assets/art/sprite-map.json", JSON.stringify(gone));
    const refused = pack({ root, outDir: out });
    expect(refused.ok).toBe(false);
    expect(refused.errors.join("\n")).toContain("--force");
    expect(readManifest(out).meta.sources.sofa).toBe("map");
    expect(pack({ root, outDir: out, force: true }).ok).toBe(true);
    expect(readManifest(out).meta.sources.sofa).toBe("placeholder");
    // --no-map on a fresh map build is allowed.
    const root2 = tempRoot();
    writeMap(root2);
    write(root2, SHEET, solid(4, 4, "#ff0000"));
    const out2 = join(root2, "out");
    pack({ root: root2, outDir: out2 });
    expect(pack({ root: root2, outDir: out2, useMap: false }).ok).toBe(true);
  });
});
