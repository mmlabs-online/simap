import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { TakeBackDeviceBody } from "./TakeBackDeviceDialog";

const copy = devicesCopy.takeBack;
const device = (over: Partial<DeviceDto> = {}) =>
  ({
    id: "d1",
    owner: { id: "a", displayName: "Nguyễn Thị Hà" },
    placement: { seatCode: "C302-01" },
    pendingHandoff: null,
    ...over,
  }) as DeviceDto;
const render = (d: DeviceDto) => renderToStaticMarkup(<TakeBackDeviceBody device={d} />);

describe("TakeBackDeviceBody", () => {
  it("names the owner and the seat code, and says it becomes unowned", () => {
    const html = render(device());
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).toContain("C302-01");
    expect(html).toContain(copy.effect);
    expect(html).not.toContain(copy.notPlaced);
  });
  it("says 'not placed' without a placement", () => {
    expect(render(device({ placement: null }))).toContain(copy.notPlaced);
  });
  it("the transfer-cancel sentence only for a pending transfer", () => {
    const transfer = { id: "h", kind: "transfer" } as DeviceDto["pendingHandoff"];
    expect(render(device({ pendingHandoff: transfer }))).toContain(copy.cancelsTransfer);
    expect(render(device())).not.toContain(copy.cancelsTransfer);
  });
});
