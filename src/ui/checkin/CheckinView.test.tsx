import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkinCopy } from "../copy/checkin";
import { CheckinView, type CheckinViewState } from "./CheckinView";

const render = (state: CheckinViewState) =>
  renderToStaticMarkup(<CheckinView state={state} switcher={<p>switcher-marker</p>} />);
const room: CheckinViewState = { kind: "room", roomHeading: "A1 - Lab", map: <p>map-marker</p> };

describe("CheckinView", () => {
  it("room state: map slot, Who's here section labelled by its heading, switcher, button slot", () => {
    const html = render(room);
    expect(html).toContain("map-marker");
    expect(html).toContain("switcher-marker");
    expect(html).toContain('data-slot="checkin-button"');
    const labelledBy = /<section aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeDefined();
    expect(html).toContain(`<h2 id="${labelledBy}"`);
    expect(html).toContain(checkinCopy.whosHereTitle.replace("'", "&#x27;"));
  });
  it("grid: lg:grid-cols-[minmax(0,1fr)_--spacing(75)], single column below lg; Who's here after the map in DOM order", () => {
    const html = render(room);
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_--spacing(75)]");
    expect(html.indexOf("map-marker")).toBeLessThan(html.indexOf("<section"));
  });
  it("fits the viewport from lg: full-height page, the map row takes the rest", () => {
    const html = render(room);
    expect(html).toMatch(/class="page-content max-w-none! [^"]*lg:h-full/);
    expect(html).toMatch(
      /class="grid [^"]*lg:min-h-0 lg:flex-1[^"]*lg:grid-rows-\[minmax\(0,1fr\)\]/,
    );
  });
  it("tokens: Display h1, Subtitle h2, 44 px no-seat link, floating slot clears the tab bar", () => {
    const html = render(room);
    expect(html).toMatch(/<h1 class="[^"]*text-display/);
    expect(html).toMatch(/<h2 [^>]*class="[^"]*text-subtitle/);
    expect(html).toContain("bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))]");
    expect(html).not.toContain("text-[");
    expect(html).not.toContain("font-extrabold");
    expect(render({ kind: "noSeat" })).toMatch(
      /<a [^>]*href="\/rooms"[^>]*min-h-control|<a [^>]*min-h-control[^>]*href="\/rooms"/,
    );
  });
  it("noSeat state shows the PRE-02 copy and a Request a seat link to /rooms, no map", () => {
    const html = render({ kind: "noSeat" });
    expect(html).toContain("You don&#x27;t have a seat yet");
    expect(html).toMatch(/<a [^>]*href="\/rooms"[^>]*>Request a seat</);
    expect(html).not.toContain("map-marker");
    expect(html).toContain("switcher-marker");
  });
  it("button prop renders inside data-slot=checkin-button", () => {
    const html = renderToStaticMarkup(
      <CheckinView state={room} switcher={<p>s</p>} button={<b>btn-marker</b>} />,
    );
    expect(html).toMatch(/data-slot="checkin-button"[^>]*><b>btn-marker<\/b>/);
  });
  it("loading shows aria-busy skeleton; error shows message and retry", () => {
    expect(render({ kind: "loading" })).toContain('aria-busy="true"');
    const html = render({ kind: "error", code: "internal", onRetry: () => {} });
    expect(html).toContain('role="alert"');
    expect(html).toContain(checkinCopy.retry);
  });
});

describe("CheckinView whosHere slot", () => {
  it("whosHere prop replaces the placeholder inside the Who's here card", () => {
    const html = renderToStaticMarkup(
      <CheckinView state={room} switcher={<p>s</p>} whosHere={<ul>list-marker</ul>} />,
    );
    expect(html).toContain("list-marker");
    expect(html).not.toContain(checkinCopy.whosHerePlaceholder);
    expect(render(room)).toContain(checkinCopy.whosHerePlaceholder);
  });
});
