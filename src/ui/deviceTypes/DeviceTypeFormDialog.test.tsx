import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeFormDialog, DeviceTypeFormFields } from "./DeviceTypeFormDialog";

const noop = () => {};
const render = (slot: "pc" | "other" = "pc") =>
  renderToStaticMarkup(
    <DeviceTypeFormFields form={{ name: "", slot, sprite: null }} onName={noop} onSlot={noop} />,
  );

describe("DeviceTypeFormFields", () => {
  it("name is required with maxLength 60", () => {
    const html = render();
    expect(html).toContain(deviceTypesCopy.form.name);
    expect(html).toContain('maxLength="60"');
    expect(html).toContain('required=""');
  });
  it("five slot radios with the form's slot checked", () => {
    const html = render("pc");
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    for (const s of Object.values(deviceTypesCopy.slots)) expect(html).toContain(s.label);
    expect(/<input[^>]*checked=""[^>]*\/>\s*<span[^>]*><span[^>]*>PC</.test(html)).toBe(true);
  });
  it("the diagram is decorative", () => {
    expect(render()).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
  it("every fieldset starts with its legend", () => {
    const html = render();
    const count = html.match(/<fieldset/g)?.length ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(html.match(/<fieldset[^>]*><legend/g)).toHaveLength(count);
  });
});

describe("DeviceTypeFormDialog sprite wiring", () => {
  const item = {
    id: "t1",
    name: "Cam",
    slot: "pc",
    hasImage: true,
    imageVersion: 1,
    sprite: "device.pc",
  } as const;
  const dialog = (over: { hasImage?: boolean } = {}) =>
    renderToStaticMarkup(
      <DeviceTypeFormDialog
        item={{ ...item, ...over }}
        api={{} as never}
        imageUrl={() => null}
        atlas={null}
        onClose={noop}
        onDone={noop}
      />,
    );
  it("shows the sprite field, with the hidden-by-image note when the type has an image", () => {
    expect(dialog()).toContain(deviceTypesCopy.form.sprite.legend);
    expect(dialog()).toContain(deviceTypesCopy.form.sprite.hiddenByImage);
    expect(dialog({ hasImage: false })).not.toContain(deviceTypesCopy.form.sprite.hiddenByImage);
  });
});
