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

  it("status views use the divider token (no raw red border)", () => {
    for (const status of ["loading", "error", "tooLarge"] as const) {
      const html = renderToStaticMarkup(<RoomMapStatus status={status} />);
      expect(html).toContain("border-divider");
      expect(html).not.toContain("red-500");
    }
  });
});

describe("ZoomControl", () => {
  it("renders 1x/2x/3x/4x with aria-pressed on the value and disabled on levels not allowed", () => {
    const html = renderToStaticMarkup(<ZoomControl zoom={2} onZoom={() => {}} allowed={[1, 2]} />);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toContain('aria-pressed="false"');
    expect(buttons[1]).toContain('aria-pressed="true"');
    expect(buttons[0]).not.toContain('disabled=""');
    expect(buttons[1]).not.toContain('disabled=""');
    expect(buttons[2]).toContain('disabled=""');
    expect(buttons[3]).toContain('disabled=""');
    expect(html).toContain("1x");
    expect(html).toContain("2x");
  });

  it("the pressed button is ink-bordered and 600, not 800", () => {
    const html = renderToStaticMarkup(<ZoomControl zoom={2} onZoom={() => {}} allowed={[1, 2]} />);
    const pressed = (html.match(/<button[^>]*>/g) ?? [])[1] ?? "";
    expect(pressed).toContain("aria-pressed:border-text-primary");
    expect(pressed).not.toContain("font-extrabold");
  });
});
