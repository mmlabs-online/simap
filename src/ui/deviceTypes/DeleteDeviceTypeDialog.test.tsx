import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeleteDeviceTypeBody } from "./DeleteDeviceTypeDialog";

describe("DeleteDeviceTypeBody", () => {
  it("body names the type and shows the placeholder warning", () => {
    const html = renderToStaticMarkup(<DeleteDeviceTypeBody name="Máy in" />);
    expect(html).toContain("Máy in");
    expect(html).toContain(deviceTypesCopy.deleteDialog.body("Máy in").replace(/"/g, "&quot;"));
    expect(html).toContain("placeholder");
  });
});
