import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { seatsCopy } from "../copy/seats";
import { EntityFormDialog } from "../EntityFormDialog";
import { DeviceFormFields } from "./DeviceFormDialog";
import { emptyForm, type DeviceForm } from "./device-form";

const noop = () => {};
const loadPage = vi.fn();
const copy = devicesCopy.form;

type Props = Partial<Parameters<typeof DeviceFormFields>[0]>;
const render = (p: Props = {}) =>
  renderToStaticMarkup(
    <DeviceFormFields
      mode="create"
      isAdmin={false}
      form={emptyForm()}
      ownerName={null}
      suggestions={devicesCopy.typeSuggestions}
      loadPage={loadPage}
      onField={noop}
      onOwner={noop}
      {...p}
    />,
  );
const withOwner = (owner: DeviceForm["owner"]): DeviceForm => ({ ...emptyForm(), owner });

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
  it("non-Admin create has no owner UI", () => {
    const html = render();
    expect(html).not.toContain('name="owner-kind"');
    expect(html).not.toContain(seatsCopy.actions.pickerSearch);
  });
  it("Admin create shows Me / Another member", () => {
    const html = render({ isAdmin: true });
    expect(html.match(/name="owner-kind"/g)).toHaveLength(2);
    expect(html).toContain(copy.ownerMe);
    expect(html).toContain(copy.ownerOther);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).not.toContain(seatsCopy.actions.pickerSearch);
  });
  it("picker only for Another member", () => {
    const html = render({ isAdmin: true, form: withOwner({ kind: "member", member: null }) });
    expect(html).toContain(seatsCopy.actions.pickerSearch);
    expect(html).not.toContain(copy.ownerSelected(""));
    expect(loadPage).not.toHaveBeenCalled();
    const picked = render({
      isAdmin: true,
      form: withOwner({
        kind: "member",
        member: { id: "m1", displayName: "Linh", employeeCode: null },
      }),
    });
    expect(picked).toContain(copy.ownerSelected("Linh"));
  });
  it("edit shows the owner as text, no radios, no picker", () => {
    for (const isAdmin of [false, true]) {
      const html = render({ mode: "edit", isAdmin, ownerName: "Ha" });
      expect(html).toContain("Ha");
      expect(html).toContain("The owner can&#x27;t be changed.");
      expect(html).not.toContain('type="radio"');
      expect(html).not.toContain(seatsCopy.actions.pickerSearch);
    }
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
