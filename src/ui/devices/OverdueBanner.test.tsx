import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { OverdueBanner, type OverdueBannerProps } from "./OverdueBanner";

const noop = () => {};
const dev = (n: number, over: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: `d${n}`,
    name: `Máy ${n}`,
    type: "PC",
    inventoryNumber: `INV-${n}`,
    mine: true,
    overdue: true,
    canReturn: true,
    holding: { note: null, expiresOn: "2026-11-20" },
    pendingHandoff: null,
    ...over,
  }) as DeviceDto;

const render = (p: Partial<OverdueBannerProps> = {}) =>
  renderToStaticMarkup(
    <OverdueBanner
      devices={[dev(1)]}
      truncated={false}
      handlers={{ onExtend: noop, onReturn: noop, onCancelHandoff: noop }}
      busyId={null}
      onShowAll={noop}
      {...p}
    />,
  );

describe("OverdueBanner", () => {
  it("lists only my overdue devices with Extend and Give back", () => {
    const html = render({
      devices: [
        dev(1),
        dev(2, { mine: false }),
        dev(3, { overdue: false }),
        dev(4, { name: "Máy Đỗ" }),
      ],
    });
    expect(html).toContain(devicesCopy.overdueBanner.heading(2));
    expect(html).toContain("Máy 1");
    expect(html).toContain("Máy Đỗ");
    expect(html).not.toContain("Máy 2");
    expect(html).not.toContain("Máy 3");
    expect(html).toContain("Expired on 2026-11-20");
    expect(html).toContain(devicesCopy.actions.extendAria("INV-1"));
    expect(html).toContain(devicesCopy.actions.giveBackAria("INV-1"));
  });
  it("renders nothing when none of the devices is mine and overdue", () => {
    expect(render({ devices: [] })).toBe("");
    expect(render({ devices: [dev(1, { mine: false }), dev(2, { overdue: false })] })).toBe("");
  });
  it("a pending extension shows its chip and Cancel instead of Extend", () => {
    const pending = {
      id: "h1",
      kind: "extension" as const,
      to: null,
      requestedBy: { id: "u", displayName: "Hà" },
      newExpiresOn: "2026-12-31",
      createdAt: "2026-11-25T00:00:00Z",
      canCancel: true,
    };
    const html = render({ devices: [dev(1, { pendingHandoff: pending, canReturn: false })] });
    expect(html).toContain(devicesCopy.pending.extensionChip);
    expect(html).toContain("Requested until 2026-12-31");
    expect(html).toContain(devicesCopy.actions.cancelExtensionAria("INV-1"));
    expect(html).not.toContain(devicesCopy.actions.extendAria("INV-1"));
  });
  it("more than 5 shows 5 rows and Show all overdue; truncated also shows it", () => {
    const many = [1, 2, 3, 4, 5, 6].map((n) => dev(n));
    const html = render({ devices: many });
    expect(html).toContain("Máy 5");
    expect(html).not.toContain("Máy 6");
    expect(html).toContain(devicesCopy.overdueBanner.heading(6));
    expect(html).toContain(devicesCopy.overdueBanner.showAll);
    expect(render({ truncated: true })).toContain(devicesCopy.overdueBanner.showAll);
    expect(render()).not.toContain(devicesCopy.overdueBanner.showAll);
  });
});
