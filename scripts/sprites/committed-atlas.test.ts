import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_KEYS } from "../../src/lib/sprites/registry";
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

  it("committed atlas is placeholder-only (M-10 default)", () => {
    // Delete this test if Ming allows committing the Imersa build (plan A1).
    for (const [key, source] of Object.entries(json.meta.sources)) {
      expect(["placeholder", "export"], key).toContain(source);
    }
  });
});
