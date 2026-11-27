import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "@/lib/sprites/avatar";
import type { SpriteFrame, SpriteManifest } from "@/lib/sprites/types";
import { portalCopy } from "../copy/portal";
import type { Atlas } from "../roomlayout/loadAtlas";
import { PixelLookPicker, type PixelLookPickerProps } from "./PixelLookPicker";

const copy = portalCopy.profile.character;
const RADIOS = SKIN_RAMP.length + HAIR_RAMP.length + 3 + SHIRT_RAMP.length;
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

const props = (p: Partial<PixelLookPickerProps> = {}): PixelLookPickerProps => ({
  draft: { skin: 1, hair: 2, style: 3, shirt: 0 },
  isDerived: false,
  status: "ready",
  locked: false,
  canReset: true,
  atlas: null,
  atlasFailed: false,
  onChoose: () => {},
  onReset: () => {},
  ...p,
});
const render = (p: Partial<PixelLookPickerProps> = {}) =>
  renderToStaticMarkup(<PixelLookPicker {...props(p)} />);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("PixelLookPicker", () => {
  it("one radio per preset per layer inside four fieldsets with legends; the draft's options are checked", () => {
    const html = render();
    expect(count(html, /<fieldset/g)).toBe(4);
    expect(count(html, /<legend/g)).toBe(4);
    for (const [key, n] of [
      ["skin", SKIN_RAMP.length],
      ["hair", HAIR_RAMP.length],
      ["style", 3],
      ["shirt", SHIRT_RAMP.length],
    ] as const) {
      expect(count(html, new RegExp(`name="pixel-look-${key}"`, "g"))).toBe(n);
    }
    expect(count(html, /type="radio"/g)).toBe(RADIOS);
    expect(count(html, /checked=""/g)).toBe(4);
  });

  it("swatch aria-labels say 'Skin 2 of 4'; hair styles have text labels", () => {
    const html = render();
    expect(html).toContain(`aria-label="${copy.option(copy.layers.skin, 2, SKIN_RAMP.length)}"`);
    for (const n of [1, 2, 3]) expect(html).toContain(copy.styleName(n));
  });

  it("atlas ready: three stage canvases (4x, 1x, 2x) with role=img; width = box x scale", () => {
    const html = render({ atlas });
    expect(count(html, /<canvas/g)).toBe(3 + 3);
    for (const scale of [1, 2, 4]) {
      expect(html).toContain(`aria-label="${copy.previewLabel(copy.views.front, scale)}"`);
    }
    expect(count(html, /role="img"/g)).toBe(3);
    expect(html).toContain('width="10"');
    expect(html).toContain('width="20"');
    expect(html).toContain('width="40"');
  });

  it("hairstyle cards: 3 radios, each card has a canvas with atlas", () => {
    const html = render({ atlas });
    const style = html.match(/<fieldset(?:(?!<\/fieldset>).)*pixel-look-style.*?<\/fieldset>/s)![0];
    expect(count(style, /type="radio"/g)).toBe(3);
    expect(count(style, /<canvas/g)).toBe(3);
    expect(count(style, /<label/g)).toBe(3);
  });

  it("hairstyle cards without atlas: text names only, no canvas", () => {
    const html = render();
    const style = html.match(/<fieldset(?:(?!<\/fieldset>).)*pixel-look-style.*?<\/fieldset>/s)![0];
    expect(style).not.toContain("<canvas");
    for (const n of [1, 2, 3]) expect(style).toContain(copy.styleName(n));
  });

  it("selected swatch shows check icon; unselected do not; exactly 4 checks (3 swatches + the style card)", () => {
    const html = render();
    expect(count(html, />check<\/span>/g)).toBe(4);
    const skin = html.match(/<fieldset(?:(?!<\/fieldset>).)*pixel-look-skin.*?<\/fieldset>/s)![0];
    expect(count(skin, />check<\/span>/g)).toBe(1);
  });

  it("swatch and card labels carry min 44 px classes", () => {
    const html = render();
    const labels = html.match(/<label[^>]*>/g)!;
    expect(labels).toHaveLength(RADIOS);
    for (const l of labels) expect(l).toContain("min-h-11");
    for (const l of labels) expect(l).toContain("min-w-11");
  });

  it("atlas missing: no canvas; atlasFailed shows previewUnavailable; the radios are still there", () => {
    const html = render({ atlasFailed: true });
    expect(html).not.toContain("<canvas");
    expect(html).toContain(copy.previewUnavailable);
    expect(count(html, /type="radio"/g)).toBe(RADIOS);
  });

  it("isDerived shows the automatic line; a saved look does not", () => {
    expect(render({ isDerived: true })).toContain(copy.automatic);
    expect(render({ isDerived: false })).not.toContain(copy.automatic);
  });

  it("Reset character is disabled when !canReset or locked", () => {
    const reset = (p: Partial<PixelLookPickerProps>) =>
      render(p)
        .match(/<button[^>]*>/g)!
        .at(-1)!;
    expect(reset({})).not.toContain('disabled=""');
    expect(reset({ canReset: false })).toContain('disabled=""');
    expect(reset({ locked: true })).toContain('disabled=""');
    expect(render()).toContain(copy.reset);
    expect(render()).not.toContain("Save");
  });

  it("the card is labelled by its heading; the load-failure line shows only when status is failed", () => {
    const html = render();
    expect(html).toContain('aria-labelledby="pixel-look-heading"');
    expect(html).toContain('id="pixel-look-heading"');
    expect(html).toContain(copy.heading);
    expect(html).toContain(copy.mapsCaption);
    expect(html).not.toContain(copy.loadFailed);
    expect(render({ status: "failed" })).toContain(copy.loadFailed);
  });

  it("status loading shows aria-busy and disabled radios when locked", () => {
    const html = render({ status: "loading", locked: true });
    expect(html).toContain('aria-busy="true"');
    expect(count(html, /<input[^>]*disabled=""/g)).toBe(RADIOS);
  });
});
