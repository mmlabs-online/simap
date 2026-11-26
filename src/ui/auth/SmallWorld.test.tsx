import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { avatarDrawList, CARD_LOOK, WORLD_ROOMS } from "@/lib/sprites/small-world-scenes";
import type { SpriteManifest } from "@/lib/sprites/types";
import { authCopy } from "../copy/auth";
import type { Atlas } from "../roomlayout/loadAtlas";
import { CardAvatar, paintVignette, SmallWorld, WORLD_MEDIA } from "./SmallWorld";

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

const esc = (s: string) => s.replace(/&/g, "&amp;");
const markup = () =>
  renderToStaticMarkup(
    <SmallWorld>
      <p id="card-slot" />
    </SmallWorld>,
  );
const [centerHtml, sidesHtml] = (() => {
  const out = markup();
  const i = out.indexOf('<div class="aw-world-side"');
  return [out.slice(0, i), out.slice(i)];
})();

describe("paintVignette", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paints each room 384x224 at zoom 1 with smoothing off first", () => {
    vi.stubGlobal("document", { createElement: () => fakeCanvas([]) });
    for (const r of WORLD_ROOMS) {
      const log: unknown[][] = [];
      const canvas = fakeCanvas(log);
      expect(paintVignette(canvas, atlas, r.drawList(manifest))).toBe(true);
      expect([canvas.width, canvas.height]).toEqual([384, 224]);
      expect(log[0]).toEqual(["set imageSmoothingEnabled", false]);
      expect(log).toContainEqual(["scale", 1, 1]);
    }
  });

  it("paints a path avatar 32x32 at zoom 1", () => {
    const log: unknown[][] = [];
    const canvas = fakeCanvas(log);
    vi.stubGlobal("document", { createElement: () => fakeCanvas([]) });
    expect(paintVignette(canvas, atlas, avatarDrawList(CARD_LOOK, manifest))).toBe(true);
    expect([canvas.width, canvas.height]).toEqual([32, 32]);
    expect(log).toContainEqual(["scale", 1, 1]);
  });

  it("returns false without a 2D context so the placeholder stays", () => {
    const list = avatarDrawList(CARD_LOOK, manifest);
    expect(paintVignette(fakeCanvas([], false), atlas, list)).toBe(false);
  });
});

describe("SmallWorld server markup", () => {
  it("has four labelled rooms, two notes and the path inside aria-hidden sides", () => {
    const out = markup();
    expect(out.match(/class="aw-room"/g)).toHaveLength(4);
    expect(sidesHtml.match(/<div class="aw-world-side"[^>]*aria-hidden="true"/g)).toHaveLength(2);
    for (const label of Object.values(authCopy.world.rooms)) {
      expect(sidesHtml).toContain(esc(label));
      expect(centerHtml).not.toContain(esc(label));
    }
    for (const note of authCopy.world.notes) {
      expect(sidesHtml).toContain(esc(note));
      expect(centerHtml).not.toContain(esc(note));
    }
    expect(out).toContain('<div class="aw-world-path" aria-hidden="true">');
  });

  it("has no canvas", () => {
    expect(markup()).not.toContain("<canvas");
  });

  it("decoration has no control, tabindex, heading or img", () => {
    expect(sidesHtml).not.toMatch(/<button|<a |<input|tabindex=|<h[1-6]|<img/);
  });

  it("the card slot is not inside an aria-hidden element", () => {
    expect(centerHtml).toContain('<div class="aw-world"><div class="aw-world-center">');
    expect(centerHtml).toContain('id="card-slot"');
    expect(centerHtml).not.toContain("aria-hidden");
  });

  it("CardAvatar renders an aria-hidden box with no canvas on the server", () => {
    const out = renderToStaticMarkup(<CardAvatar />);
    expect(out).toContain('class="aw-card-avatar"');
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain("<canvas");
  });
});

describe("SmallWorld CSS", () => {
  it("the CSS hides the world below the same media query the JS gate uses", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("/* SIM-068.1 small world (aw-world) */"));
    const query = `@media ${WORLD_MEDIA}`;
    expect(WORLD_MEDIA).toBe("(min-width: 1280px)");
    expect(block).toContain(query);
    const outside = block.slice(0, block.indexOf(query));
    expect(outside).toMatch(
      /\.aw-world-side,\s*\.aw-world-path,\s*\.aw-card-avatar\s*\{\s*display: none;/,
    );
    expect(block.slice(block.indexOf(query))).toMatch(/\.aw-card-avatar\s*\{\s*display: block;/);
  });
});
