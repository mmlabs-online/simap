import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeImageField } from "./DeviceTypeImageField";
import type { ImageFieldView } from "./device-type-image";

const noop = () => {};
const none: ImageFieldView = {
  previewUrl: null,
  state: "none",
  showRemove: false,
  showUndo: false,
};
const render = (view: ImageFieldView = none, error: string | null = null, disabled = false) =>
  renderToStaticMarkup(
    <DeviceTypeImageField
      view={view}
      error={error}
      disabled={disabled}
      onPick={noop}
      onRemove={noop}
      onUndo={noop}
    />,
  );
const copy = deviceTypesCopy.form;

describe("DeviceTypeImageField", () => {
  it("starts with legend Image; file input has accept=image/png inside a label", () => {
    const html = render();
    expect(html).toMatch(new RegExp(`<fieldset[^>]*><legend[^>]*>${copy.image}</legend>`));
    expect(html).toMatch(/<label[^>]*>[^<]*<input[^>]*type="file"[^>]*accept="image\/png"/);
  });
  it("no image: placeholder, no Remove button", () => {
    const html = render();
    expect(html).not.toContain("<img");
    expect(html).toContain(deviceTypesCopy.thumb.none);
    expect(html).not.toContain(copy.remove);
  });
  it("preview img has the url, width/height 48 and pixelated rendering", () => {
    const html = render({
      previewUrl: "blob:p",
      state: "staged",
      showRemove: true,
      showUndo: false,
    });
    expect(html).toMatch(/<img[^>]*src="blob:p"/);
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
    expect(html).toContain("image-rendering:pixelated");
    expect(html).toContain(copy.remove);
    expect(html).toContain(copy.alt.staged);
  });
  it("remove state shows the pending note and Keep current image", () => {
    const html = render({ previewUrl: null, state: "remove", showRemove: false, showUndo: true });
    expect(html).toContain(copy.pendingRemove);
    expect(html).toContain(copy.keepCurrent);
  });
  it("error shows role=alert with an id the input references in aria-describedby, and aria-invalid", () => {
    const html = render(none, "Bad file");
    const id = /<p id="([^"]+)" role="alert"[^>]*>Bad file/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-describedby="${id}"`);
    expect(html).toContain('aria-invalid="true"');
  });
  it("disabled disables the input and buttons", () => {
    const html = render(
      { previewUrl: "blob:p", state: "current", showRemove: true, showUndo: false },
      null,
      true,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
