import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeSpriteField } from "./DeviceTypeSpriteField";

const copy = deviceTypesCopy.form.sprite;
const render = (over: Partial<Parameters<typeof DeviceTypeSpriteField>[0]> = {}) =>
  renderToStaticMarkup(
    <DeviceTypeSpriteField
      value={null}
      slot="pc"
      imageShown={false}
      atlas={null}
      onChange={() => {}}
      {...over}
    />,
  );

describe("DeviceTypeSpriteField", () => {
  it("radios for built-in plus each family, no canvas without an atlas", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(7);
    expect(html).toContain(copy.builtIn("PC"));
    expect(html).toContain("device.laptop");
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain(copy.hiddenByImage);
  });

  it("notes an image that hides the pick and an unavailable pick", () => {
    expect(render({ value: "device.pc", imageShown: true })).toContain(copy.hiddenByImage);
    expect(render({ value: "device.printer" })).toContain(
      copy.unavailable("device.printer").replaceAll('"', "&quot;"),
    );
  });
});

describe("DeviceTypeSpriteField tokens", () => {
  it("option rows are 44 px with a 20 px radio", () => {
    const rows = render().match(/<label[^>]*>\s*<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r).toContain("min-h-control");
      expect(r).toContain("size-5");
    }
  });
});
