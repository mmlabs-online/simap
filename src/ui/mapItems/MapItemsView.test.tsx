import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { mapItemsCopy } from "../copy/mapItems";
import { shellCopy } from "../copy/shell";
import { MapItemsList, MapItemsView, type MapItemsViewProps } from "./MapItemsView";
import { dto } from "./test-items";

const noop = () => {};
const ready = (items: ReturnType<typeof dto>[]) =>
  ({ status: "ready", items, errorCode: null }) as const;
const render = (p: Partial<MapItemsViewProps> = {}) =>
  renderToStaticMarkup(
    <MapItemsView access="ok" items={ready([])} onEdit={noop} onRetry={noop} {...p} />,
  );

const five = () => [
  dto("desk.single", { group: "Alpha" }),
  dto("chair.office", { group: "Alpha" }),
  dto("door", { group: "Beta", hidden: true }),
  dto("plant.large", { group: "Beta" }),
  dto("table.meeting", { group: "Zeta", name: "Bàn họp" }),
];
const list = (group: string | null = null, query = "") =>
  renderToStaticMarkup(
    <MapItemsList
      items={five()}
      group={group}
      query={query}
      onGroup={noop}
      onQuery={noop}
      onEdit={noop}
    />,
  );

describe("MapItemsView", () => {
  it("forbidden: title, no-access alert, no tablist and no Edit buttons", () => {
    const html = render({ access: "forbidden", items: ready([dto("door")]) });
    expect(html).toContain(shellCopy.pages.mapItems.title);
    expect(html).toContain('role="alert"');
    expect(html).toContain(mapItemsCopy.noAccess);
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("Edit map item");
  });

  it("loading: an aria-busy grid of 4 skeleton cards, no stats, tabs, search or zeros", () => {
    const html = render({ items: { status: "loading", items: [], errorCode: null } });
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/animate-pulse/g)).toHaveLength(4);
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain("0 map items");
  });

  it("error: an alert with the message and Retry", () => {
    const html = render({ items: { status: "error", items: [], errorCode: "internal" } });
    expect(html).toContain(apiErrorMessage("internal"));
    expect(html).toContain(groupsCopy.retry);
  });

  it("not ready (0 items): the catalog text and no tabs, search or footer", () => {
    const html = render();
    expect(html).toContain(mapItemsCopy.list.empty);
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain('role="status"');
  });

  it("ready: header eyebrow, h1 with an aria-hidden dot, subtitle", () => {
    const html = render({ items: ready(five()) });
    expect(html).toContain(mapItemsCopy.header.eyebrow);
    expect(html).toContain("Small details. A space that feels like yours.");
    expect(html).toMatch(
      new RegExp(
        `<h1[^>]*>${shellCopy.pages.mapItems.title}<span aria-hidden="true"[^>]*>\\.</span></h1>`,
      ),
    );
    expect(html).toContain("page-library");
  });
});

describe("MapItemsList", () => {
  it("stats: totals, palette, customised and the note; the bar wraps", () => {
    const html = list();
    expect(html).toContain(">5</span><span");
    expect(html).toContain("map items");
    expect(html).toContain("in palette");
    expect(html).toContain("customised");
    expect(html).toContain(mapItemsCopy.stats.note);
    expect(html).toMatch(/<section[^>]*flex-wrap/);
    expect(html).toContain(">4</span>");
  });

  it("tabs: All selected with count 5, one tab per group in order, one panel", () => {
    const html = list();
    expect(html).toMatch(/<div role="tablist" aria-label="Item groups"/);
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html.indexOf(">Alpha<")).toBeLessThan(html.indexOf(">Beta<"));
    expect(html.indexOf(">Beta<")).toBeLessThan(html.indexOf(">Zeta<"));
    expect(html.match(/aria-controls="map-items-panel"/g)).toHaveLength(4);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(html).toMatch(/id="map-items-tab-0"[^>]*aria-selected="true"/);
    expect(html).toContain('id="map-items-panel" aria-labelledby="map-items-tab-0"');
    expect(new Set(html.match(/id="map-items-tab-\d+"/g)).size).toBe(4);
  });

  it("search: a labelled search input, autocomplete off, named", () => {
    const html = list();
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain(`aria-label="${mapItemsCopy.search.label}"`);
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('name="map-items-search"');
  });

  it("grid: a list with the responsive columns, one card and pencil per item, no New or Move", () => {
    const html = list();
    expect(html).toMatch(
      /<ul role="list" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"/,
    );
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html.match(/aria-label="Edit map item /g)).toHaveLength(5);
    expect(html).not.toMatch(/New|Move up|Move down/);
  });

  it("footer: a status with the count, and the never-deleted note outside it", () => {
    const html = list();
    expect(html).toContain('<span role="status">Showing 5 of 5 items</span>');
    expect(html).toContain(mapItemsCopy.footer.note);
    expect(html.indexOf("</span>", html.indexOf('role="status"'))).toBeLessThan(
      html.indexOf(mapItemsCopy.footer.note),
    );
  });

  it("a group narrows the grid but not the All count", () => {
    const html = list("Zeta");
    expect(html.match(/<li /g)).toHaveLength(1);
    expect(html).toContain("Showing 1 of 5 items");
    expect(html).toMatch(/aria-selected="true"[^>]*>Zeta/);
    expect(html).toMatch(/>All<span class="font-mono text-caption">5</);
  });

  it("a query with no match shows the message in the panel, no list", () => {
    const html = list(null, "zzzz");
    expect(html).toContain(mapItemsCopy.grid.noMatch);
    expect(html).not.toContain("<ul");
    expect(html).toContain("Showing 0 of 5 items");
  });

  it("a vanished group falls back to All with every card", () => {
    const html = list("Gone");
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).toMatch(/id="map-items-tab-0"[^>]*aria-selected="true"/);
  });

  it("390 px layout classes: stacked controls, shrinkable tabs, full-width search", () => {
    const html = list();
    expect(html).toContain("flex flex-col gap-3 sm:flex-row");
    expect(html).toContain('class="min-w-0 flex-1"');
    expect(html).toMatch(/role="tablist"[^>]*overflow-x-auto/);
    expect(html).toContain('role="search" class="w-full shrink-0 sm:w-72"');
  });
});
