import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { portalCopy } from "../copy/portal";
import { MyDevicesTiles } from "./MyDevicesTiles";

const d = (n: number, type: string) => ({ id: `d${n}`, type }) as DeviceDto;
const devices = [d(1, "Monitor"), d(2, "monitor"), d(3, "PC")];

describe("MyDevicesTiles", () => {
  it("total tile first, then one tile per type in summary order", () => {
    const html = renderToStaticMarkup(<MyDevicesTiles devices={devices} hasMore={false} />);
    const iTotal = html.indexOf(portalCopy.devices.totalTile);
    const iMon = html.indexOf(">Monitor<");
    const iPc = html.indexOf(">PC<");
    expect(iTotal).toBeGreaterThan(-1);
    expect(iTotal).toBeLessThan(iMon);
    expect(iMon).toBeLessThan(iPc);
    expect(html).toContain(">3<");
    expect(html).toContain(">2<");
    expect(html.match(/<li/g)).toHaveLength(3);
  });
  it("hasMore adds + to every value; list is labelled; grid classes", () => {
    const html = renderToStaticMarkup(<MyDevicesTiles devices={devices} hasMore />);
    expect(html).toContain(">3+<");
    expect(html).toContain(">2+<");
    expect(html).toContain(`aria-label="${portalCopy.devices.tilesLabel}"`);
    expect(html).toContain("grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3");
  });
});
