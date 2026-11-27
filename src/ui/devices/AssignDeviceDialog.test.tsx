import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { AssignDeviceFields } from "./AssignDeviceDialog";
import { emptyAssignForm, holdingForm } from "./assign-device";

const noop = () => {};
const copy = devicesCopy.assign;
const device = {
  id: "d1",
  owner: { id: "u1", displayName: "Nguyễn Thị Hà" },
  holding: { note: "Máy mượn", expiresOn: "2026-12-31" },
} as DeviceDto;

type Props = Partial<Parameters<typeof AssignDeviceFields>[0]>;
const render = (p: Props = {}) =>
  renderToStaticMarkup(
    <AssignDeviceFields
      mode="assign"
      device={device}
      picker={<div data-picker />}
      form={emptyAssignForm()}
      min="2026-11-25"
      onNote={noop}
      onNoExpiry={noop}
      onDate={noop}
      {...p}
    />,
  );

describe("AssignDeviceFields assign mode", () => {
  it("renders the picker slot, the note box with hint and counter, and the expiry fieldset", () => {
    const html = render();
    expect(html).toContain("data-picker");
    expect(html).not.toContain(copy.holder);
    expect(html).toContain('maxLength="500"');
    expect(html).toContain("0/500");
    expect(html).toContain("Visible to everyone in your organization");
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1].split(" ") ?? [];
    expect(described).toHaveLength(2);
    for (const id of described) expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Expiry<\/legend>/);
    expect(html).toContain(copy.tzHint);
  });
  it("No expiry checked disables the date input, which has a min", () => {
    const html = render();
    expect(html).toMatch(/type="checkbox"[^>]*checked/);
    const date = html.match(/<input[^>]*type="date"[^>]*>/)?.[0] ?? "";
    expect(date).toContain('disabled=""');
    expect(date).toContain('min="2026-11-25"');
  });
});

describe("AssignDeviceFields edit mode", () => {
  it("shows the holder instead of the picker; unchecked enables the date with its value", () => {
    const html = render({ mode: "edit", form: holdingForm(device) });
    expect(html).not.toContain("data-picker");
    expect(html).toContain(copy.holder);
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
    const date = html.match(/<input[^>]*type="date"[^>]*>/)?.[0] ?? "";
    expect(date).not.toContain("disabled=");
    expect(date).toContain('value="2026-12-31"');
    expect(html).toContain("Máy mượn");
  });
});

describe("AssignDeviceFields tokens", () => {
  it("checkbox row is 44 px, the note box carries the focus ring class, no legacy caption", () => {
    const html = render();
    expect(html).toMatch(/<label[^>]*min-h-control[^>]*>\s*<input[^>]*type="checkbox"/);
    expect(html).toMatch(
      /<input[^>]*size-5[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*size-5/,
    );
    expect(html).toMatch(/<legend[^>]*text-label/);
    expect(html).toMatch(/field-box[^>]*><textarea[^>]*outline-none/);
    expect(html).not.toContain("text-[11px]");
  });
});
