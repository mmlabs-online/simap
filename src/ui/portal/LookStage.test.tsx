import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpriteFrame, SpriteManifest } from "@/lib/sprites/types";
import { portalCopy } from "../copy/portal";
import type { Atlas } from "../roomlayout/loadAtlas";
import { LookStage, type LookStageProps } from "./LookStage";

const copy = portalCopy.profile.character;
const frame = (w: number, h: number): SpriteFrame => ({
  x: 0,
  y: 0,
  w,
  h,
  anchor: [0, 0],
  tiles: [1, 1],
  blocks: false,
});
const frames: Record<string, SpriteFrame> = {};
for (const v of ["front", "back"]) {
  frames[`avatar.body.${v}`] = frame(10, 20);
  frames[`avatar.shirt.${v}`] = frame(10, 10);
  for (const s of [1, 2, 3]) frames[`avatar.hair.${s}.${v}`] = frame(10, 6);
}
const atlas = {
  manifest: { tile: 32, frames, layers: [] } as SpriteManifest,
  image: {} as HTMLImageElement,
} as Atlas;

const render = (p: Partial<LookStageProps> = {}) =>
  renderToStaticMarkup(
    <LookStage
      atlas={atlas}
      atlasFailed={false}
      look={{ skin: 1, hair: 2, style: 3, shirt: 0 }}
      view="front"
      onViewChange={() => {}}
      {...p}
    />,
  );
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const chip = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>${label}</button>`))![0];

describe("LookStage", () => {
  it("front view: large 4x canvas, corner 1x and 2x, Front chip aria-checked", () => {
    const html = render();
    expect(count(html, /<canvas/g)).toBe(3);
    for (const scale of [1, 2, 4]) {
      expect(html).toContain(`aria-label="${copy.previewLabel(copy.views.front, scale)}"`);
    }
    expect(html).toContain('width="40"');
    expect(html).toContain(copy.stageLabel);
    expect(html).toContain(copy.mapsCaption);
    expect(chip(html, "Front")).toContain('aria-checked="true"');
    expect(chip(html, "Back")).toContain('aria-checked="false"');
  });

  it("back view: labels use 'Back'; Back chip aria-checked, Front not", () => {
    const html = render({ view: "back" });
    for (const scale of [1, 2, 4]) {
      expect(html).toContain(`aria-label="${copy.previewLabel(copy.views.back, scale)}"`);
    }
    expect(html).not.toContain(copy.previewLabel(copy.views.front, 1));
    expect(chip(html, "Back")).toContain('aria-checked="true"');
    expect(chip(html, "Front")).toContain('aria-checked="false"');
  });

  it("atlasFailed: no canvas, previewUnavailable shown, toggle still present", () => {
    const html = render({ atlas: null, atlasFailed: true });
    expect(html).not.toContain("<canvas");
    expect(html).toContain(copy.previewUnavailable);
    expect(html).toContain(`aria-label="${copy.viewToggleLabel}"`);
  });

  it("atlas null (loading): aria-busy placeholders, no canvas", () => {
    const html = render({ atlas: null });
    expect(html).not.toContain("<canvas");
    expect(html).toContain('aria-busy="true"');
  });
});
