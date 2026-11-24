import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardDto } from "@/lib/dashboard/types";
import { apiCopy } from "../copy/api";
import { dashboardCopy as copy } from "../copy/dashboard";
import { DashboardView, type DashboardViewProps } from "./DashboardView";

const base: DashboardDto = {
  totals: { rooms: 2, seats: 8, occupied: 2, devicesPlaced: 5, devicesInventory: 3 },
  rooms: [
    {
      id: "1",
      code: "C302",
      name: "Phòng họp",
      description: null,
      floor: "3",
      seatCount: 8,
      occupiedCount: 2,
    },
    {
      id: "2",
      code: "C400",
      name: "Kho",
      description: null,
      floor: null,
      seatCount: 0,
      occupiedCount: 0,
    },
  ],
  roomsTruncated: false,
  deactivatedHolders: null,
};

const render = (p: Partial<DashboardViewProps> = {}) =>
  renderToStaticMarkup(
    <DashboardView status="ready" data={base} errorCode={null} onRetry={() => {}} {...p} />,
  );
const withData = (d: Partial<DashboardDto>) => render({ data: { ...base, ...d } });

describe("DashboardView", () => {
  it("loading: aria-busy skeleton", () => {
    const html = render({ status: "loading", data: null });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(copy.tiles.rooms);
  });
  it("error: role=alert with apiErrorMessage and retry button", () => {
    const html = render({ status: "error", data: null, errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(copy.retry);
  });
  it("ready: renders the six stat tiles with values", () => {
    const html = render();
    for (const label of Object.values(copy.tiles)) expect(html).toContain(label);
    expect(html).toContain(">2<");
    expect(html).toContain(">8<");
    expect(html).toContain(">5<");
    expect(html).toContain(">3<");
    expect(html).toContain(`>${copy.percent(25)}<`);
  });
  it("ready with zero seats shows 0%", () => {
    const html = withData({
      totals: { rooms: 0, seats: 0, occupied: 0, devicesPlaced: 0, devicesInventory: 0 },
      rooms: [],
    });
    expect(html).toContain(`>${copy.percent(0)}<`);
  });
  it("ready: renders one RoomCard per room, without edit/delete actions", () => {
    const html = render();
    expect(html).toContain('href="/rooms/C302"');
    expect(html).toContain('href="/rooms/C400"');
    expect(html).toContain("Phòng họp");
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).not.toContain("<button");
  });
  it("ready: no rooms -> empty-state copy", () => {
    expect(withData({ rooms: [] })).toContain(copy.noRooms);
  });
  it("roomsTruncated shows the truncated note", () => {
    const html = withData({ roomsTruncated: true });
    expect(html).toContain(copy.roomsTruncated(2, 2));
    expect(render()).not.toContain(copy.roomsTruncated(2, 2));
  });
  it("warning shown when holders total > 0", () => {
    const html = withData({
      deactivatedHolders: {
        total: 3,
        items: [
          {
            member: { id: "m1", displayName: "Nguyễn Văn An" },
            seatCount: 12,
            seats: [{ id: "s1", code: "C302-01", roomId: "1", roomCode: "C302" }],
          },
        ],
      },
    });
    expect(html).toContain(copy.holders.title(3));
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain('href="/rooms/C302"');
    expect(html).toContain("C302-01");
    expect(html).toContain(copy.holders.moreSeats(11));
    expect(html).toContain(copy.holders.moreMembers(2));
  });
  it("export card shown only when canExport", () => {
    expect(render()).not.toContain(copy.export.heading);
    const html = render({ canExport: true });
    expect(html).toContain(copy.export.heading);
    for (const l of [copy.export.seats, copy.export.devices, copy.export.members]) {
      expect(html).toContain(`>${l}</button>`);
    }
    expect(render({ canExport: true, status: "loading", data: null })).not.toContain(
      copy.export.heading,
    );
  });
  it("export buttons are enabled when idle and disabled while exporting", () => {
    expect(render({ canExport: true }).match(/disabled=""/g)).toBeNull();
    const html = render({ canExport: true, exporting: "devices" });
    expect(html.match(/disabled=""/g)).toHaveLength(3);
    expect(html).toContain(copy.export.busy);
  });
  it("shows export error and truncation notice", () => {
    const html = render({
      canExport: true,
      exportError: "forbidden",
      exportNotice: copy.export.truncated(10000),
    });
    expect(html).toContain(apiCopy.errors.forbidden.replace("'", "&#x27;"));
    expect(html).toContain("Export limited to the first 10,000 rows.");
    expect(html).toContain('role="status"');
  });
  it("no warning when holders null or total 0", () => {
    expect(render()).not.toContain(copy.holders.hint);
    expect(withData({ deactivatedHolders: { total: 0, items: [] } })).not.toContain(
      copy.holders.hint,
    );
  });
});
