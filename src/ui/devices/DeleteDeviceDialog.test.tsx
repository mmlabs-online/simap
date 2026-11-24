import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { DeleteDeviceBody } from "./DeleteDeviceDialog";

const base = {
  id: "d1",
  name: "Máy trạm",
  inventoryNumber: "INV-1",
  placement: null,
} as DeviceDto;
const placedDevice = {
  ...base,
  placement: { seatId: "s1", seatCode: "C302-01", roomId: "r", roomCode: "C302", role: "primary" },
} as DeviceDto;

const render = (device: DeviceDto, step: "placed" | "confirm", moved = false) =>
  renderToStaticMarkup(<DeleteDeviceBody device={device} step={step} moved={moved} />);

describe("DeleteDeviceBody", () => {
  it("placed step: names the device, inventory no. and seat code; Vietnamese diacritics kept", () => {
    const html = render(placedDevice, "placed");
    expect(html).toContain("Máy trạm");
    expect(html).toContain("INV-1");
    expect(html).toContain("C302-01");
    expect(html).toContain("Move it to inventory before deleting it.");
  });

  it("confirm step: names the device and says it can't be undone; no seat text", () => {
    const html = render(base, "confirm");
    expect(html).toContain("Máy trạm");
    expect(html).toContain("INV-1");
    expect(html).toContain("can&#x27;t be undone");
    expect(html).not.toContain("seat");
    expect(html).not.toContain("Moved to inventory.");
  });

  it("confirm after a move shows the moved note", () => {
    const html = render(base, "confirm", true);
    expect(html).toContain("Moved to inventory.");
    expect(html).toContain("can&#x27;t be undone");
  });
});
