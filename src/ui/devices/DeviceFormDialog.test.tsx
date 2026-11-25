import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import { DeviceFormFields } from "./DeviceFormDialog";
import { emptyForm } from "./device-form";

const noop = () => {};
const copy = devicesCopy.form;

type Props = Partial<Parameters<typeof DeviceFormFields>[0]>;
const render = (p: Props = {}) =>
  renderToStaticMarkup(
    <DeviceFormFields
      mode="create"
      form={emptyForm()}
      ownerName={null}
      suggestions={devicesCopy.typeSuggestions}
      onField={noop}
      {...p}
    />,
  );

describe("DeviceFormFields", () => {
  it("fields and datalist", () => {
    const html = render();
    for (const l of [
      copy.fields.name,
      copy.fields.type,
      copy.fields.inventoryNumber,
      copy.fields.mac,
    ]) {
      expect(html).toContain(l);
    }
    expect(html.match(/<datalist/g)).toHaveLength(1);
    expect(html.match(/<option /g)).toHaveLength(devicesCopy.typeSuggestions.length);
    const id = /<datalist id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`list="${id}"`);
    expect(html).toContain('maxLength="120"');
    expect(html.match(/maxLength="60"/g)).toHaveLength(2);
  });
  it("datalist lists the given suggestions; type input stays free text", () => {
    const html = render({ suggestions: ["Scanner", "Máy in"] });
    expect(html.match(/<option /g)).toHaveLength(2);
    expect(html).toContain('value="Máy in"');
    const type = html.match(/<input[^>]*list="[^"]*"[^>]*>/)?.[0] ?? "";
    expect(type).not.toContain("pattern");
    expect(type).toContain('maxLength="60"');
  });
  it("serial, manufacturer and brand fields with maxLength 100", () => {
    const html = render();
    for (const l of [copy.fields.serial, copy.fields.manufacturer, copy.fields.brand]) {
      expect(html).toContain(l);
    }
    expect(html.match(/maxLength="100"/g)).toHaveLength(3);
    const serial = html.match(/<input[^>]*maxLength="100"[^>]*>/)?.[0] ?? "";
    expect(serial).toContain('spellCheck="false"');
    expect(html.match(/required/g)).toHaveLength(3);
  });
  it("create has no owner fields", () => {
    const html = render();
    expect(html).not.toContain(copy.fields.owner);
    expect(html).not.toContain('type="radio"');
  });
  it("edit shows the owner as text, no radios", () => {
    const html = render({ mode: "edit", ownerName: "Ha" });
    expect(html).toContain(copy.fields.owner);
    expect(html).toContain("Ha");
    expect(html).toContain("The owner can&#x27;t be changed.");
    expect(html).not.toContain('type="radio"');
  });
  it("edit of an unowned device shows Org inventory", () => {
    const html = render({ mode: "edit", ownerName: devicesCopy.orgInventory });
    expect(html).toContain(devicesCopy.orgInventory);
  });
  it("error prop renders as an alert", () => {
    const html = renderToStaticMarkup(
      <EntityFormDialog
        open
        title="t"
        submitLabel="s"
        error={apiErrorMessage("mac_taken")}
        onClose={noop}
        onSubmit={noop}
      >
        {null}
      </EntityFormDialog>,
    );
    expect(html).toContain('role="alert"');
  });
});
