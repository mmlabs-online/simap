import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiCopy } from "../copy/api";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { groupsCopy } from "../copy/groups";
import { shellCopy } from "../copy/shell";
import { DeviceTypesView, type DeviceTypesViewProps } from "./DeviceTypesView";

const noop = () => {};
const ready = { status: "ready", items: [], errorCode: null } as const;
const render = (p: Partial<DeviceTypesViewProps> = {}) =>
  renderToStaticMarkup(
    <DeviceTypesView
      access="ok"
      types={ready}
      onNew={noop}
      onEdit={noop}
      onDelete={noop}
      onRetry={noop}
      imageUrl={() => null}
      {...p}
    />,
  );

const type = {
  id: "t1",
  name: "Máy in",
  slot: "pc",
  hasImage: false,
  imageVersion: 0,
  sprite: null,
} as const;

describe("DeviceTypesView", () => {
  it("forbidden shows the title and a no-access alert, no New button", () => {
    const html = render({ access: "forbidden" });
    expect(html).toContain(shellCopy.pages.deviceTypes.title);
    expect(html).toMatch(/role="alert"[^>]*>[^<]*Only admins/);
    expect(html).toContain(deviceTypesCopy.noAccess);
    expect(html).not.toContain("<button");
  });
  it("loading is busy", () => {
    expect(render({ types: { status: "loading", items: [], errorCode: null } })).toContain(
      'aria-busy="true"',
    );
  });
  it("error shows the message and a retry button", () => {
    const html = render({ types: { status: "error", items: [], errorCode: "unavailable" } });
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(groupsCopy.retry);
  });
  it("empty shows the empty text", () => {
    expect(render()).toContain(deviceTypesCopy.list.empty);
  });
  it("ready shows names, slot labels and per-row aria labels", () => {
    const html = render({ types: { status: "ready", items: [type], errorCode: null } });
    expect(html).toContain("Máy in");
    expect(html).toContain(deviceTypesCopy.slots.pc.label);
    expect(html).toContain(`aria-label="${deviceTypesCopy.editLabel("Máy in")}"`);
    expect(html).toContain(`aria-label="${deviceTypesCopy.deleteLabel("Máy in")}"`);
    expect(html).toContain(deviceTypesCopy.list.new);
  });
  it("row shows the image when imageUrl returns a url; placeholder otherwise", () => {
    const types = { status: "ready", items: [type], errorCode: null } as const;
    const withImg = render({ types, imageUrl: () => "blob:x" });
    expect(withImg).toMatch(/<img[^>]*src="blob:x"[^>]*image-rendering:pixelated/);
    const without = render({ types });
    expect(without).not.toContain("<img");
    expect(without).toContain(deviceTypesCopy.thumb.none);
  });
});
