import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapItemsCopy } from "../copy/mapItems";
import { SpriteBrowser } from "./SpriteBrowser";
import { browserChoices } from "./map-item-art";
import type { Atlas } from "../roomlayout/loadAtlas";
import { dto } from "./test-items";

const noop = () => {};
const render = (p: Partial<Parameters<typeof SpriteBrowser>[0]> = {}) =>
  renderToStaticMarkup(
    <SpriteBrowser
      item={dto("desk.single")}
      dir="n"
      selected={null}
      query=""
      allTypes
      busy={false}
      onPick={noop}
      onQuery={noop}
      onAllTypes={noop}
      {...p}
    />,
  );
const copy = mapItemsCopy.art.browser;
const ed = mapItemsCopy.editor;
const keys = browserChoices(dto("desk.single"), "n", null, {
  allTypes: true,
  query: "",
}).groups.flatMap((g) => g.keys);

describe("SpriteBrowser", () => {
  it("tiles are a radiogroup by group; the selected key is checked; no Use/Cancel buttons; search and All types controls", () => {
    const html = render({ selected: "desk.single.n" });
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Package sprites for North"');
    expect(html).toContain("<h4");
    expect(html.match(/type="radio"/g)).toHaveLength(keys.length);
    expect(html.match(/checked=""/g)).toHaveLength(2); // the tile and the All types checkbox
    expect(html).toMatch(
      /value="desk\.single\.n"[^>]*checked=""|checked=""[^>]*value="desk\.single\.n"/,
    );
    expect(html).toContain(`aria-label="${ed.searchLabel}"`);
    expect(html).toContain(`placeholder="${ed.search}"`);
    expect(html).toContain(ed.allTypes);
    expect(html).not.toContain("<button");
    expect(html).toContain("sr-only");
  });

  it("an item with no fitting sprite shows the empty text; a query with no match shows the no-match text", () => {
    const none = render({ item: { ...dto("desk.single"), w: 0, h: 0 } });
    expect(none).toContain(copy.empty);
    expect(none).not.toContain('type="radio"');
    expect(render({ query: "zzz-nothing" })).toContain(ed.noMatch);
  });

  it("without All types the list is the item's own group and the title names it", () => {
    const own = browserChoices(dto("desk.single"), "n", null, { allTypes: false, query: "" });
    const html = render({ allTypes: false });
    expect(own.title).not.toBeNull();
    expect(html).toContain(`${own.title} · `);
    expect(html.match(/type="radio"/g)).toHaveLength(own.count);
  });

  it("a staged smaller frame shows the bottom-left note once", () => {
    const html = render({ item: dto("table.meeting") });
    expect(html.split(copy.smaller).length - 1).toBe(1);
  });

  const frame = { x: 0, y: 0, w: 32, h: 32, anchor: [0, 0], tiles: [1, 1], blocks: false };
  const atlas = (frames: string[]) =>
    ({
      manifest: { frames: Object.fromEntries(frames.map((k) => [k, frame])) },
      image: {},
    }) as unknown as Atlas;

  it("thumbnails: one canvas per tile; none without an atlas", () => {
    expect(render({ atlas: atlas(keys) }).match(/<canvas/g)).toHaveLength(keys.length);
    expect(render()).not.toContain("<canvas");
  });

  it("with an atlas that has meta.sources only bundled keys are listed", () => {
    const sources = Object.fromEntries(keys.map((k, i) => [k, i === 0 ? "map" : "placeholder"]));
    const a = {
      manifest: { frames: { [keys[0]!]: frame }, meta: { sources } },
      image: {},
    } as unknown as Atlas;
    const html = render({ atlas: a });
    expect(html.match(/type="radio"/g)).toHaveLength(1);
    expect(html).toContain(`value="${keys[0]}"`);
    expect(html).toContain(copy.count(1));
  });

  it("frame missing in atlas: no canvas, the tile text stays", () => {
    const html = render({ atlas: atlas([]) });
    expect(html).not.toContain("<canvas");
    expect(html).toContain(keys[0]!);
  });
});
