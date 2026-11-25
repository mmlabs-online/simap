import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { MapItemArtBody, type ArtBodyProps } from "./MapItemArtDialog";
import { dto } from "./test-items";

const noop = () => {};
const copy = mapItemsCopy.art;
const render = (p: Partial<ArtBodyProps> = {}) =>
  renderToStaticMarkup(
    <MapItemArtBody
      item={dto("desk.single")}
      imageUrl={() => null}
      busy={false}
      errors={{}}
      browser={null}
      status={null}
      onChoose={noop}
      onStage={noop}
      onUseSprite={noop}
      onCancelBrowser={noop}
      onUpload={noop}
      onUseLibrary={noop}
      onRemove={noop}
      {...p}
    />,
  );
const withArt = (
  key: string,
  dir: "n" | "e" | "s" | "w",
  sprite: string | null,
  hasImage: boolean,
) => {
  const d = dto(key);
  return { ...d, art: { ...d.art, [dir]: { sprite, hasImage, imageVersion: 1 } } };
};
const count = (html: string, text: string) => html.split(text).length - 1;

describe("MapItemArtBody", () => {
  it("a directional item renders four panels with legends North, East, South, West", () => {
    const html = render();
    expect(count(html, "<fieldset")).toBe(4);
    const legends = [...html.matchAll(/<legend[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(legends).toEqual(["North", "East", "South", "West"]);
  });

  it("a non-directional item renders one panel and no direction legends", () => {
    const html = render({ item: dto("plant.large") });
    expect(count(html, "<fieldset")).toBe(1);
    expect(html).toContain(copy.sameForAll);
    for (const l of ["North", "East", "West"]) expect(html).not.toContain(`>${l}<`);
  });

  it("source text: Custom image / Package sprite: <key> / Library sprite; the hidden line", () => {
    expect(render()).toContain(copy.source.library);
    const sprite = render({ item: withArt("desk.single", "n", "desk.single.n", false) });
    expect(sprite).toContain(copy.source.sprite("desk.single.n"));
    expect(sprite).not.toContain(copy.source.hidden("desk.single.n"));
    const both = render({ item: withArt("desk.single", "n", "desk.single.n", true) });
    expect(both).toContain(copy.source.image);
    expect(both).toContain(copy.source.hidden("desk.single.n"));
  });

  it("a panel offers Choose package sprite, Upload image, Use library sprite (disabled without a sprite), and Remove custom image only with an image", () => {
    const plain = render({ item: dto("plant.large") });
    expect(plain).toContain(copy.choose);
    expect(plain).toContain(copy.upload);
    expect(plain).toContain(copy.useLibrary);
    expect(plain).toMatch(/disabled=""[^>]*>Use library sprite/);
    expect(plain).not.toContain(copy.remove);
    expect(plain).toContain('accept="image/png"');
    const img = render({ item: withArt("plant.large", "s", null, true) });
    expect(img).toContain(copy.remove);
    const sprite = render({ item: withArt("plant.large", "s", "plant.large", false) });
    expect(sprite).not.toMatch(/disabled=""[^>]*>Use library sprite/);
  });

  it("previews: an image URL renders two pixelated imgs at 1x and 2x width; an image without a URL yet shows 'Preview not available'", () => {
    const item = withArt("plant.large", "s", null, true); // 1x1 -> 32 px wide
    const html = render({ item, imageUrl: () => "blob:x" });
    expect(count(html, "<img")).toBe(2);
    expect(html).toContain("image-rendering:pixelated");
    expect(html).toContain("width:32px");
    expect(html).toContain("width:64px");
    expect(render({ item })).toContain(copy.previewNA);
    expect(render({ item: dto("plant.large"), imageUrl: () => "blob:x" })).not.toContain("<img");
  });

  it("an error shows as role=alert inside its own direction panel only", () => {
    const html = render({ errors: { e: "Drive is down" } });
    expect(count(html, 'role="alert"')).toBe(1);
    const panels = html.split("<fieldset").slice(1);
    expect(panels.map((p) => p.includes("Drive is down"))).toEqual([false, true, false, false]);
  });

  it("busy disables every action button in every panel", () => {
    const html = render({ busy: true, item: withArt("desk.single", "n", "desk.single.n", true) });
    const buttons = html.match(/<button[^>]*>/g)!;
    expect(buttons.length).toBeGreaterThanOrEqual(13);
    expect(buttons.every((b) => b.includes('disabled=""'))).toBe(true);
  });

  it("no copy-to-other-directions control is rendered", () => {
    expect(render().toLowerCase()).not.toMatch(/copy|apply to|all directions|rotate/);
  });
});
