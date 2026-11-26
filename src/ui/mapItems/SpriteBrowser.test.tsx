import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { SpriteBrowser } from "./SpriteBrowser";
import { spriteChoices } from "./map-item-art";
import type { Atlas } from "../roomlayout/loadAtlas";
import { dto } from "./test-items";

const noop = () => {};
const render = (p: Partial<Parameters<typeof SpriteBrowser>[0]> = {}) =>
  renderToStaticMarkup(
    <SpriteBrowser
      item={dto("desk.single")}
      dir="n"
      current={null}
      staged={null}
      busy={false}
      onStage={noop}
      onUse={noop}
      onCancel={noop}
      {...p}
    />,
  );
const copy = mapItemsCopy.art.browser;

describe("SpriteBrowser", () => {
  it("lists choices as a radiogroup by group; current sprite is checked; empty state text when none fit", () => {
    const html = render({ current: "desk.single.n" });
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Package sprites for North"');
    expect(html).toContain('role="status"');
    expect(html).toContain("<h4");
    expect(html.match(/<input/g)!.length).toBe(
      spriteChoices(dto("desk.single"), "n").flatMap((g) => g.keys).length,
    );
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(
      /value="desk\.single\.n"[^>]*checked=""|checked=""[^>]*value="desk\.single\.n"/,
    );
    const none = render({ item: { ...dto("desk.single"), w: 0, h: 0 } });
    expect(none).toContain(copy.empty);
    expect(none).not.toContain("<input");
  });

  it("confirm step shows the key, frame tiles vs item tiles, the bottom-left note when smaller, Use this sprite and Cancel", () => {
    const small = render({ item: dto("table.meeting"), staged: "desk.single.n" });
    expect(small).toContain(copy.staged("desk.single.n"));
    expect(small).toContain(copy.tiles(2, 1, 3, 2, "North"));
    expect(small).toContain(copy.smaller);
    expect(small).toContain(copy.use);
    expect(small).toContain(copy.cancel);
    const exact = render({ staged: "desk.single.n" });
    expect(exact).not.toContain(copy.smaller);
    expect(render()).not.toContain(copy.use);
  });

  const frame = { x: 0, y: 0, w: 32, h: 32, anchor: [0, 0], tiles: [1, 1], blocks: false };
  const atlas = (keys: string[]) =>
    ({
      manifest: { frames: Object.fromEntries(keys.map((k) => [k, frame])) },
      image: {},
    }) as unknown as Atlas;
  const keys = spriteChoices(dto("desk.single"), "n").flatMap((g) => g.keys);

  it("thumbnails: one canvas per row and one on the staged block; none without an atlas", () => {
    const html = render({ atlas: atlas(keys) });
    expect(html.match(/<canvas/g)).toHaveLength(keys.length);
    expect(render({ atlas: atlas(keys), staged: keys[0]! }).match(/<canvas/g)).toHaveLength(
      keys.length + 1,
    );
    expect(render({ staged: keys[0]! })).not.toContain("<canvas");
  });

  it("with an atlas that has meta.sources only bundled keys are listed", () => {
    const sources = Object.fromEntries(keys.map((k, i) => [k, i === 0 ? "map" : "placeholder"]));
    const a = {
      manifest: { frames: { [keys[0]!]: frame }, meta: { sources } },
      image: {},
    } as unknown as Atlas;
    const html = render({ atlas: a });
    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain(`value="${keys[0]}"`);
    expect(html).toContain(copy.count(1));
  });

  it("frame missing in atlas: no canvas, the row text stays", () => {
    const html = render({ atlas: atlas([]) });
    expect(html).not.toContain("<canvas");
    expect(html).toContain(keys[0]!);
  });
});
