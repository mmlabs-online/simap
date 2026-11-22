import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roomlayoutCopy } from "../copy/roomlayout";
import { RoomMap, RoomMapStatus } from "./RoomMap";

describe("RoomMap", () => {
  it("first render shows loading", () => {
    const html = renderToStaticMarkup(
      <RoomMap
        layout={{ w: 1, h: 1, floors: [], seats: [], fixtures: [] }}
        seatViews={{}}
        zoom={2}
      />,
    );
    expect(html).toContain(roomlayoutCopy.loading);
    expect(html).not.toContain("<canvas");
  });

  it("error view shows the copy with role=alert", () => {
    const html = renderToStaticMarkup(<RoomMapStatus status="error" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(roomlayoutCopy.error);
  });
});
