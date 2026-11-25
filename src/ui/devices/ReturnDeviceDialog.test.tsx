import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { ReturnDeviceFields } from "./ReturnDeviceDialog";

const copy = devicesCopy.giveBack;
const device = { id: "d1", owner: { id: "a", displayName: "Nguyễn Thị Hà" } } as DeviceDto;

describe("ReturnDeviceFields", () => {
  const html = renderToStaticMarkup(
    <ReturnDeviceFields device={device} form={{ note: "" }} onNote={() => {}} />,
  );
  it("shows the owner, the note label and hint, and the Admin-must-confirm text", () => {
    expect(html).toContain(copy.currentOwner);
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).toContain(copy.note);
    expect(html).toContain(copy.noteHint);
    expect(html).toContain("An Admin must confirm");
  });
  it("has no recipient picker", () => {
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain("radiogroup");
  });
});
