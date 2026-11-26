import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SeatDto } from "@/lib/seats/types";
import { apiCopy } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import type { PanelView } from "./seat-view";
import { SeatDetailPanel, returnFocusTarget } from "./SeatDetailPanel";

const owner = { id: "m1", displayName: "Nguyễn Văn Ân" };
const seat: SeatDto = {
  id: "s1",
  code: "C302-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C302",
  status: "occupied",
  cannotSeat: true,
  cannotSeatReason: "Sàn đang sửa",
  occupant: owner,
  mine: false,
  group: { id: "g1", name: "Nhóm Mạng", color: "#fff" },
  project: { id: "p1", code: "P1", name: "Dự án" },
  deviceCount: 3,
  devices: [
    {
      id: "d1",
      name: "Laptop chính",
      type: "laptop",
      inventoryNumber: "I1",
      role: "primary",
      owner,
    },
    {
      id: "d2",
      name: "Màn hình",
      type: "monitor",
      inventoryNumber: "I2",
      role: "secondary",
      owner,
    },
  ],
};
const render = (view: PanelView, actions?: React.ReactNode) =>
  renderToStaticMarkup(
    <SeatDetailPanel
      view={view}
      seatCode="C302-01"
      onClose={() => {}}
      onRetry={() => {}}
      actions={actions}
    />,
  );

describe("SeatDetailPanel", () => {
  it("hidden devices: primary and secondary show None shown; none hidden: None", () => {
    const hidden = render({ kind: "ready", seat: { ...seat, deviceCount: 2, devices: [] } });
    expect(hidden.split(seatsCopy.panel.noneShown)).toHaveLength(3);
    expect(hidden).toContain(seatsCopy.panel.moreDevices(2));
    const none = render({ kind: "ready", seat: { ...seat, deviceCount: 0, devices: [] } });
    expect(none).not.toContain(seatsCopy.panel.noneShown);
    expect(none).toContain(seatsCopy.panel.noPrimary);
  });
  it("renders nothing when closed", () => {
    expect(render({ kind: "closed" })).toBe("");
  });
  it("shows all SEA-05 fields and keeps Vietnamese diacritics", () => {
    const html = render({ kind: "ready", seat });
    for (const s of [
      "C302-01",
      "C302",
      seatsCopy.status.occupied,
      "Nguyễn Văn Ân",
      "Laptop chính",
      "Màn hình",
      seatsCopy.panel.owner("Nguyễn Văn Ân"),
      seatsCopy.panel.primaryDevice,
      seatsCopy.panel.secondaryDevices,
      "Nhóm Mạng",
      "Dự án",
      seatsCopy.panel.moreDevices(1),
    ]) {
      expect(html).toContain(s);
    }
  });
  it("shows the reason inside the clip container", () => {
    const html = render({ kind: "ready", seat });
    expect(html).toMatch(
      /<p data-reason[^>]*overflow-hidden[^>]*\[contain:paint\][^>]*>Sàn đang sửa<\/p>/,
    );
    expect(html).toContain(seatsCopy.status.cannotSeat);
  });
  it("device name links to /devices/<id>", () => {
    const html = render({ kind: "ready", seat });
    expect(html).toContain(`href="/devices/d1"`);
    expect(html).toContain(`href="/devices/d2"`);
  });
  it("has no edit control for tags", () => {
    const html = render({ kind: "ready", seat });
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html.match(/<button/g)).toHaveLength(1);
  });
  it("not-found, with truncation wording", () => {
    expect(render({ kind: "notFound", truncated: false })).toContain(seatsCopy.panel.notFoundBody);
    expect(render({ kind: "notFound", truncated: true })).toContain(
      seatsCopy.panel.notFoundTruncated,
    );
  });
  it("loading and error", () => {
    expect(render({ kind: "loading" })).toContain(seatsCopy.panel.loading);
    const html = render({ kind: "error", code: "unavailable" });
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(seatsCopy.retry);
  });
  it("renders the actions slot", () => {
    expect(render({ kind: "ready", seat }, <p>slot-marker</p>)).toContain("slot-marker");
  });
  it("the heading is focusable for the focus fallback", () => {
    expect(render({ kind: "loading" })).toMatch(/<h2[^>]*tabindex="-1"/);
  });

  it("returnFocusTarget prefers a connected map opener; otherwise row, then previous, then null", () => {
    const el = (map: boolean, connected = true) => ({
      isConnected: connected,
      hasAttribute: (n: string) => map && n === "data-map-seat",
    });
    const row = el(false);
    const mapSeat = el(true);
    expect(returnFocusTarget(row, mapSeat)).toBe(mapSeat);
    expect(returnFocusTarget(row, el(true, false))).toBe(row);
    expect(returnFocusTarget(row, el(false))).toBe(row);
    const plain = el(false);
    expect(returnFocusTarget(null, plain)).toBe(plain);
    expect(returnFocusTarget(null, el(false, false))).toBeNull();
    expect(returnFocusTarget(null, null)).toBeNull();
    const body = el(false);
    expect(returnFocusTarget(null, body, body)).toBeNull();
  });
});
