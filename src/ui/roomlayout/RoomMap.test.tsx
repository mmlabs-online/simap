import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roomlayoutCopy } from "../copy/roomlayout";
import { RoomMap, RoomMapStatus } from "./RoomMap";
import { ZoomControl } from "./ZoomControl";

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

  it("tooLarge status shows its copy with role=alert", () => {
    const html = renderToStaticMarkup(<RoomMapStatus status="tooLarge" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(roomlayoutCopy.tooLarge);
  });

  it("status views use theme tokens (no raw red border)", () => {
    for (const status of ["loading", "error", "tooLarge"] as const) {
      const html = renderToStaticMarkup(<RoomMapStatus status={status} />);
      expect(html).toContain("border-outline-variant");
      expect(html).not.toContain("red-500");
    }
  });
});

describe("ZoomControl", () => {
  it("renders 2x/3x/4x with aria-pressed on the value and disabled on levels not allowed", () => {
    const html = renderToStaticMarkup(<ZoomControl zoom={2} onZoom={() => {}} allowed={[2]} />);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toContain('aria-pressed="true"');
    expect(buttons[1]).toContain('aria-pressed="false"');
    expect(buttons[0]).not.toContain('disabled=""');
    expect(buttons[1]).toContain('disabled=""');
    expect(buttons[2]).toContain('disabled=""');
    expect(html).toContain("2x");
  });
});
