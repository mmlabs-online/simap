import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import type { Atlas } from "../roomlayout/loadAtlas";
import { libraryFrameKey } from "./map-item-art";
import { MapItemCard } from "./MapItemCard";
import { dto } from "./test-items";

const noop = () => {};
const frame = { x: 0, y: 0, w: 32, h: 32, anchor: [0, 0], tiles: [1, 1], blocks: false };
const atlasOf = (...keys: string[]) =>
  ({
    manifest: { frames: Object.fromEntries(keys.map((k) => [k, frame])) },
    image: {},
  }) as unknown as Atlas;
type Props = Partial<Parameters<typeof MapItemCard>[0]>;
const render = (item = dto("door"), p: Props = {}) =>
  renderToStaticMarkup(<MapItemCard item={item} onEdit={noop} {...p} />);
const withArt = (key: string, art: { sprite?: string; hasImage?: boolean }, dir = "s") => {
  const base = dto(key);
  return {
    ...base,
    art: {
      ...base.art,
      [dir]: { sprite: art.sprite ?? null, hasImage: art.hasImage ?? false, imageVersion: 1 },
    },
  };
};

describe("MapItemCard", () => {
  it("base: name, key, group, size badge with a spoken size, library source, one pencil", () => {
    const door = dto("door");
    const html = render(door);
    expect(html).toMatch(/<h3[^>]*title="[^"]*"[^>]*>/);
    expect(html).toContain(door.builtinKey);
    expect(html).toContain(door.group);
    expect(html).toContain(mapItemsCopy.card.size(door.w, door.h));
    expect(html).toContain(mapItemsCopy.card.sizeLabel(door.w, door.h));
    expect(html).toContain(mapItemsCopy.card.source.library);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('type="button"');
    expect(html).toContain(`aria-label="${mapItemsCopy.editLabel(door.name)}"`);
    expect(html).toContain("size-control");
  });

  it("fixed size shows only for fixed items", () => {
    expect(render(dto("desk.single"))).toContain(mapItemsCopy.list.fixed);
    expect(render(dto("door"))).not.toContain(mapItemsCopy.list.fixed);
  });

  it("hidden: a Hidden pill after the name and a dimmed preview", () => {
    const html = render(dto("door", { hidden: true }));
    expect(html.indexOf(mapItemsCopy.list.hidden)).toBeGreaterThan(html.indexOf("</h3>"));
    expect(html).toContain("opacity-50");
    const shown = render(dto("door"));
    expect(shown).not.toContain(mapItemsCopy.list.hidden);
    expect(shown).not.toContain("opacity-50");
  });

  it("custom image: a pixelated img with empty alt and the Custom image label", () => {
    const html = render(withArt("desk.single", { hasImage: true }), { thumbUrl: () => "blob:t" });
    expect(html).toContain('src="blob:t"');
    expect(html).toContain('alt=""');
    expect(html).toContain("image-rendering:pixelated");
    expect(html).toContain(mapItemsCopy.card.source.image);
  });

  it("package sprite: one canvas and the Package sprite label", () => {
    const html = render(withArt("plant.large", { sprite: "plant.large" }), {
      atlas: atlasOf("plant.large"),
    });
    expect(html.match(/<canvas/g)).toHaveLength(1);
    expect(html).toContain(mapItemsCopy.card.source.sprite);
  });

  it("library frame: a canvas when the atlas has it; no canvas or img without an atlas", () => {
    const door = dto("door");
    const key = libraryFrameKey(door, "s")!;
    expect(render(door, { atlas: atlasOf(key) }).match(/<canvas/g)).toHaveLength(1);
    const none = render(door, { atlas: null });
    expect(none).not.toContain("<canvas");
    expect(none).not.toContain("<img");
    expect(none).toContain("h-36");
  });

  it("non-directional item with an image only on n shows the library label", () => {
    const html = render(withArt("plant.large", { hasImage: true }, "n"));
    expect(html).toContain(mapItemsCopy.card.source.library);
  });

  it("the preview is aria-hidden and holds neither the button nor the size badge", () => {
    const html = render(dto("door"));
    const start = html.indexOf('<div aria-hidden="true"');
    expect(start).toBeGreaterThan(-1);
    const preview = html.slice(start, html.indexOf("</div>", start));
    expect(preview).not.toContain("<button");
    expect(preview).not.toContain("sr-only");
  });

  it("renders a Vietnamese name unchanged", () => {
    expect(render(dto("table.meeting", { name: "Bàn họp" }))).toContain(">Bàn họp<");
  });
});
