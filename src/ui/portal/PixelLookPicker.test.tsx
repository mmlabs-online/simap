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
  busy: null,
  canSave: true,
  canReset: true,
  notice: null,
  atlas: null,
  atlasFailed: false,
  onChoose: () => {},
  onSave: () => {},
  onReset: () => {},
  ...p,
});
const render = (p: Partial<PixelLookPickerProps> = {}) =>
  renderToStaticMarkup(<PixelLookPicker {...props(p)} />);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const buttons = (html: string) =>
  (html.match(/<button[^>]*>[^<]*<\/button>/g) ?? []).map((b) => b.replace(/class="[^"]*"/, ""));

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

  it("atlas ready: four canvases with role=img and the four preview labels; width = box x scale", () => {
    const html = render({ atlas });
    expect(count(html, /<canvas/g)).toBe(4);
    for (const view of [copy.views.front, copy.views.back]) {
      for (const scale of [1, 2]) {
        expect(html).toContain(`aria-label="${copy.previewLabel(view, scale)}"`);
      }
    }
    expect(count(html, /role="img"/g)).toBe(4);
    expect(html).toContain('width="10"');
    expect(html).toContain('width="20"');
  });

  it("atlas missing: no canvas; atlasFailed shows previewUnavailable; the radios and Save are still there", () => {
    const html = render({ atlasFailed: true });
    expect(html).not.toContain("<canvas");
    expect(html).toContain(copy.previewUnavailable);
    expect(count(html, /type="radio"/g)).toBe(RADIOS);
    expect(html).toContain(copy.save);
  });

  it("isDerived shows the automatic line; a saved look does not", () => {
    expect(render({ isDerived: true })).toContain(copy.automatic);
    expect(render({ isDerived: false })).not.toContain(copy.automatic);
  });

  it("canSave false disables Save; canReset false disables Reset; busy save/reset shows the busy labels and disables both", () => {
    const [save, reset] = buttons(render({ canSave: false, canReset: true }));
    expect(save).toContain("disabled");
    expect(reset).not.toContain("disabled");
    const [s2, r2] = buttons(render({ canSave: true, canReset: false }));
    expect(s2).not.toContain("disabled");
    expect(r2).toContain("disabled");
    const busySave = buttons(render({ busy: "save", canSave: false, canReset: false }));
    expect(busySave[0]).toContain(copy.saving);
    expect(busySave.every((b) => b.includes("disabled"))).toBe(true);
    const busyReset = buttons(render({ busy: "reset", canSave: false, canReset: false }));
    expect(busyReset[1]).toContain(copy.resetting);
  });

  it("status notice renders role=status, error notice renders role=alert; status loading shows aria-busy and disabled radios", () => {
    expect(render({ notice: { tone: "status", text: "ok!" } })).toContain('role="status"');
    expect(render({ notice: { tone: "error", text: "bad!" } })).toContain('role="alert"');
    const html = render({ status: "loading" });
    expect(html).toContain('aria-busy="true"');
    expect(count(html, /<input[^>]*disabled=""/g)).toBe(RADIOS);
  });
});
