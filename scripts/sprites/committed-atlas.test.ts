import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_KEYS, REGISTRY } from "../../src/lib/sprites/registry";
import { validateSpriteManifest } from "../../src/lib/validate/sprite-manifest";
import { readPngSize } from "./png.mjs";

const json = JSON.parse(readFileSync("public/sprites/office.json", "utf8"));
const size = readPngSize(readFileSync("public/sprites/office.png"));

describe("committed atlas", () => {
  it("committed manifest validates against the PNG size", () => {
    const r = validateSpriteManifest(json, size);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it("committed manifest keys equal the registry", () => {
    expect(Object.keys(json.frames).sort()).toEqual([...FRAME_KEYS]);
  });

  it("committed manifest blocks equal the registry", () => {
    // The server validates with the registry, the client draws with the manifest (placement.ts).
    for (const [key, frame] of Object.entries<{ blocks: boolean }>(json.frames)) {
      expect(frame.blocks, key).toBe(REGISTRY[key].blocks);
    }
  });

  it("meta.version is the sha256 of office.png (first 12 hex)", () => {
    const hash = createHash("sha256")
      .update(readFileSync("public/sprites/office.png"))
      .digest("hex");
    expect(json.meta.version).toBe(hash.slice(0, 12));
  });

  it("every sprite-map key is a map frame; every other key is placeholder or export", () => {
    const map = JSON.parse(readFileSync("assets/art/sprite-map.json", "utf8"));
    const mapKeys = new Set(Object.keys(map.sprites));
    expect(mapKeys.size).toBeGreaterThan(0);
    for (const [key, source] of Object.entries<string>(json.meta.sources)) {
      if (mapKeys.has(key)) expect(source, key).toBe("map");
      else expect(["placeholder", "export"], key).toContain(source);
    }
    for (const key of mapKeys) expect(json.meta.sources[key], key).toBe("map");
  });
});
