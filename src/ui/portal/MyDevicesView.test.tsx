import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { portalCopy } from "../copy/portal";
import { devicesCopy } from "../copy/devices";
import { MyDevicesView, type MyDevicesViewProps } from "./MyDevicesView";

const noop = () => {};
const dev = (n: number, over: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: `d${n}`,
    name: `Máy Đỗ ${n}`,
    type: "PC",
    inventoryNumber: `INV-${n}`,
    mac: null,
    details: null,
    mine: true,
    overdue: false,
    owner: { id: "m", displayName: "Nguyễn Thị Ánh" },
    holding: { note: null, expiresOn: "2026-12-31" },
    placement: null,
    pendingHandoff: null,
    ...over,
  }) as DeviceDto;

const render = (p: Partial<MyDevicesViewProps> = {}) =>
  renderToStaticMarkup(
    <MyDevicesView
      status="ready"
      devices={[dev(1)]}
      hasMore={false}
      loadingMore={false}
      errorCode={null}
      actions={{}}
      busyId={null}
      notice={null}
      onRetry={noop}
      onLoadMore={noop}
      {...p}
    />,
  );

describe("MyDevicesView", () => {
  it("renders rows with name, type, inventory number and expiry", () => {
    const html = render({ devices: [dev(1, { overdue: true })] });
    expect(html).toContain(portalCopy.devices.heading);
    expect(html).toContain("Máy Đỗ 1");
    expect(html).toContain("INV-1");
    expect(html).toContain("2026-12-31");
    expect(html).toContain(devicesCopy.overdueChip);
  });
  it("empty state; no Load more without hasMore", () => {
    const html = render({ devices: [] });
    expect(html).toContain(portalCopy.devices.empty);
    expect(html).not.toContain(portalCopy.devices.loadMore);
  });
  it("error shows an alert and Retry", () => {
    const html = render({ status: "error", devices: [], errorCode: "internal" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(portalCopy.devices.retry);
  });
  it("error with rows keeps the table and shows no error card", () => {
    const html = render({ status: "error", errorCode: "internal" });
    expect(html).toContain("INV-1");
    expect(html).not.toContain('role="alert"');
  });
  it("Load more only when hasMore", () => {
    expect(render({ hasMore: true })).toContain(portalCopy.devices.loadMore);
  });
  it("banner and incoming slots render above the list", () => {
    const html = render({ banner: <p>BANNER</p>, incoming: <p>INCOMING</p> });
    expect(html.indexOf("BANNER")).toBeGreaterThan(-1);
    expect(html.indexOf("BANNER")).toBeLessThan(html.indexOf("INCOMING"));
    expect(html.indexOf("INCOMING")).toBeLessThan(html.indexOf("INV-1"));
  });
  it("notice renders as status or alert", () => {
    expect(render({ notice: { tone: "status", text: "Done" } })).toContain('role="status"');
    expect(render({ notice: { tone: "error", text: "Bad" } })).toContain('role="alert"');
  });
});
