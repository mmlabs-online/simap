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
    <MapItemsView access="ok" items={ready([])} onEdit={noop} onRetry={noop} {...p} />,
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
});
