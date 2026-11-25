import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { ExtendDeviceFields } from "./ExtendDeviceDialog";

const copy = devicesCopy.extend;
const device = {
  id: "d1",
  holding: { note: null, expiresOn: "2026-11-20" },
} as DeviceDto;

describe("ExtendDeviceFields", () => {
  const html = renderToStaticMarkup(
    <ExtendDeviceFields
      device={device}
      form={{ newExpiresOn: "", note: "" }}
      min="2026-11-26"
      onDate={() => {}}
      onNote={() => {}}
    />,
  );
  it("the date input is required and its min is tomorrow", () => {
    expect(html).toContain('type="date"');
    expect(html).toContain("required");
    expect(html).toContain('min="2026-11-26"');
    expect(html).toContain(copy.newDate);
  });
  it("shows the current expiry, the note label and what happens next", () => {
    expect(html).toContain(copy.currentExpiry);
    expect(html).toContain("2026-11-20");
    expect(html).toContain(copy.note);
    expect(html).toContain(copy.noteHint);
    expect(html).toContain("An Admin or Manager must approve");
  });
});
