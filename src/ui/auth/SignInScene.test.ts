import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpriteManifest } from "@/lib/sprites/types";
import type { Atlas } from "../roomlayout/loadAtlas";
import { paintSignInScene } from "./SignInScene";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;
const atlas: Atlas = { manifest, image: {} as HTMLImageElement };

function fakeCanvas(log: unknown[][], withContext = true) {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, name: string) =>
      name in t
        ? t[name]
        : (...args: unknown[]) => {
            log.push([name, ...args]);
          },
    set: (t, name: string, value) => {
      t[name] = value;
      log.push([`set ${name}`, value]);
      return true;
    },
  });
  return {
    width: 0,
    height: 0,
    getContext: () => (withContext ? ctx : null),
  } as unknown as HTMLCanvasElement;
}

describe("paintSignInScene", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paints 384x224 at zoom 1 with smoothing off first", () => {
    const log: unknown[][] = [];
    const canvas = fakeCanvas(log);
    vi.stubGlobal("document", { createElement: () => fakeCanvas([]) });
    expect(paintSignInScene(canvas, atlas)).toBe(true);
    expect([canvas.width, canvas.height]).toEqual([384, 224]);
    expect(log[0]).toEqual(["set imageSmoothingEnabled", false]);
    expect(log).toContainEqual(["scale", 1, 1]);
  });

  it("returns false without a 2D context so the placeholder stays", () => {
    expect(paintSignInScene(fakeCanvas([], false), atlas)).toBe(false);
  });
});
