import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeFormFields } from "./DeviceTypeFormDialog";

const noop = () => {};
const render = (slot: "pc" | "other" = "pc") =>
  renderToStaticMarkup(
    <DeviceTypeFormFields form={{ name: "", slot }} onName={noop} onSlot={noop} />,
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
