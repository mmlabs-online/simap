import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { DeleteDeviceBody } from "./DeleteDeviceDialog";

const device = {
  id: "d1",
  name: "Máy trạm",
  inventoryNumber: "INV-1",
  placement: null,
} as DeviceDto;

describe("DeleteDeviceBody", () => {
  it("renders the confirm body only: names the device and says it can't be undone", () => {
    const html = renderToStaticMarkup(<DeleteDeviceBody device={device} />);
    expect(html).toContain("Máy trạm");
    expect(html).toContain("INV-1");
    expect(html).toContain("can&#x27;t be undone");
    expect(html).not.toContain("seat");
    expect(html).not.toContain("Moved to inventory.");
  });
});
