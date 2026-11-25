import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { mapItemsCopy } from "../copy/mapItems";
import { shellCopy } from "../copy/shell";
import { MapItemsView, type MapItemsViewProps } from "./MapItemsView";
import { dto } from "./test-items";

const noop = () => {};
const ready = (items: ReturnType<typeof dto>[]) =>
  ({ status: "ready", items, errorCode: null }) as const;
const render = (p: Partial<MapItemsViewProps> = {}) =>
  renderToStaticMarkup(
    <MapItemsView access="ok" items={ready([])} onEdit={noop} onArt={noop} onRetry={noop} {...p} />,
  );

describe("MapItemsView", () => {
  it("forbidden shows the title and a no-access alert, no rows or Edit buttons", () => {
    const html = render({ access: "forbidden", items: ready([dto("door")]) });
    expect(html).toContain(shellCopy.pages.mapItems.title);
    expect(html).toContain('role="alert"');
    expect(html).toContain(mapItemsCopy.noAccess);
    expect(html).not.toContain(mapItemsCopy.edit);
  });

  it("loading is an aria-busy skeleton; error is an alert with Retry", () => {
    expect(render({ items: { status: "loading", items: [], errorCode: null } })).toContain(
      'aria-busy="true"',
    );
    const html = render({ items: { status: "error", items: [], errorCode: "internal" } });
    expect(html).toContain(apiErrorMessage("internal"));
    expect(html).toContain(groupsCopy.retry);
  });

  it("empty ready list shows the catalog-not-ready text", () => {
    expect(render()).toContain(mapItemsCopy.list.empty);
  });

  it("ready: group headings in name order, w × h on every row, badges, aria-labelled Edit buttons, no New", () => {
    const html = render({
      items: ready([
        dto("table.meeting", { group: "Zeta", name: "Bàn họp", hidden: true }),
        dto("desk.single", { group: "Alpha" }),
      ]),
    });
    expect(html.indexOf("<h2")).toBeLessThan(html.indexOf("Zeta"));
    expect(html.indexOf(">Alpha<")).toBeLessThan(html.indexOf(">Zeta<"));
    expect(html).toContain("3 × 2");
    expect(html).toContain("2 × 1");
    expect(html.match(new RegExp(mapItemsCopy.list.hidden, "g"))).toHaveLength(1);
    expect(html.match(new RegExp(mapItemsCopy.list.fixed, "g"))).toHaveLength(1);
    expect(html).toContain(`aria-label="${mapItemsCopy.editLabel("Bàn họp")}"`);
    expect(html).not.toMatch(/New|Move up|Move down/);
  });

  it("each row has an Art button labelled with the item name", () => {
    const html = render({ items: ready([dto("desk.single"), dto("door")]) });
    expect(html).toContain(
      `aria-label="${mapItemsCopy.artLabel("Bàn đơn")}"`.replace(
        "Bàn đơn",
        dto("desk.single").name,
      ),
    );
    expect(html.match(new RegExp(`aria-label="Edit art of map item`, "g"))).toHaveLength(2);
  });

  it("Customised badge only when isCustomised; thumbnail img only when thumbUrl returns a URL", () => {
    const desk = dto("desk.single");
    const custom = {
      ...desk,
      art: { ...desk.art, s: { sprite: null, hasImage: true, imageVersion: 1 } },
    };
    const html = render({
      items: ready([custom, dto("door")]),
      thumbUrl: (i) => (i.builtinKey === "desk.single" ? "blob:t" : null),
    });
    expect(html.match(new RegExp(mapItemsCopy.list.customised, "g"))).toHaveLength(1);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain('src="blob:t"');
    expect(render({ items: ready([dto("door")]) })).not.toContain("<img");
  });
});
