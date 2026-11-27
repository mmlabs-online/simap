import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MapLoadState, MapView } from "@/lib/sprites/map-view";
import { apiErrorMessage } from "../copy/api";
import { roomlayoutCopy } from "../copy/roomlayout";
import { RoomMapSection } from "./RoomMapSection";

const view = (over: Partial<MapView> = {}): MapView => ({
  layout: {
    w: 4,
    h: 3,
    floors: [],
    seats: [{ id: "s1", code: "A1", sprite: "desk.single", x: 1, y: 1, rotation: 0 }],
    fixtures: [],
  },
  seatViews: {},
  seatDevices: {},
  items: [],
  unplaced: [],
  truncated: false,
  saved: true,
  version: 1,
  empty: false,
  ...over,
});
const render = (state: MapLoadState) =>
  renderToStaticMarkup(<RoomMapSection state={state} onRetry={() => {}} onSelect={() => {}} />);
const ready = (v: MapView): MapLoadState => ({ status: "ready", view: v, errorCode: null });

describe("RoomMapSection", () => {
  it("fill: the card fills its parent from lg; without it the card keeps its own height", () => {
    const state: MapLoadState = { status: "loading", view: null, errorCode: null };
    const filled = renderToStaticMarkup(
      <RoomMapSection state={state} onRetry={() => {}} onSelect={() => {}} fill />,
    );
    expect(filled).toContain("lg:h-full lg:min-h-0");
    expect(render(state)).not.toContain("lg:h-full");
  });

  it("loading state", () => {
    const html = render({ status: "loading", view: null, errorCode: null });
    expect(html).toContain(roomlayoutCopy.heading);
    expect(html).toContain(roomlayoutCopy.loading);
  });

  it("error shows the API message and a retry button", () => {
    const html = render({ status: "error", view: null, errorCode: "unavailable" });
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html).toContain(roomlayoutCopy.retry);
    expect(html).not.toContain(roomlayoutCopy.loading);
  });

  it("empty map shows emptyMap copy", () => {
    expect(render(ready(view({ empty: true })))).toContain(roomlayoutCopy.emptyMap);
  });

  it("a ready map starts at the atlas loading view in static markup", () => {
    expect(render(ready(view()))).toContain(roomlayoutCopy.loading);
  });

  it("shows the unplaced note with the count (1 and 3) and the truncated note", () => {
    const one = render(ready(view({ unplaced: [{ id: "u1", code: "A9" }] })));
    expect(one).toContain(roomlayoutCopy.unplacedNote(1));
    const three = render(
      ready(view({ unplaced: ["a", "b", "c"].map((c) => ({ id: c, code: c })), truncated: true })),
    );
    expect(three).toContain(roomlayoutCopy.unplacedNote(3));
    expect(three).toContain(roomlayoutCopy.truncated(500));
    expect(render(ready(view()))).not.toContain("not placed");
  });

  it("Edit layout link only with editHref, also on an empty map, hidden when truncated", () => {
    const withLink = (state: MapLoadState) =>
      renderToStaticMarkup(
        <RoomMapSection
          state={state}
          onRetry={() => {}}
          onSelect={() => {}}
          editHref="/rooms/C1/edit"
        />,
      );
    expect(withLink(ready(view()))).toContain('href="/rooms/C1/edit"');
    expect(withLink(ready(view()))).toContain(roomlayoutCopy.editLayout);
    expect(render(ready(view()))).not.toContain(roomlayoutCopy.editLayout);
    const empty = view({ empty: true });
    expect(withLink(ready(empty))).toContain(roomlayoutCopy.editLayout);
    expect(withLink(ready(view({ truncated: true })))).not.toContain(roomlayoutCopy.editLayout);
  });
});
