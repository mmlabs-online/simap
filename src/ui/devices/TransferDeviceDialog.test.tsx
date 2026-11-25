import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { INITIAL_PICKER, type PickerState } from "../seats/member-picker";
import { TransferDeviceFields } from "./TransferDeviceDialog";

const noop = () => {};
const copy = devicesCopy.transfer;
const device = { id: "d1", owner: { id: "a", displayName: "Nguyễn Thị Hà" } } as DeviceDto;
const state: PickerState = {
  ...INITIAL_PICKER,
  status: "ready",
  items: [
    { id: "a", displayName: "Nguyễn Thị Hà", employeeCode: null },
    { id: "b", displayName: "Trần Hương", employeeCode: null },
  ],
};

const render = (recipientName: string | null = null) =>
  renderToStaticMarkup(
    <TransferDeviceFields
      device={device}
      picker={{
        state,
        query: "",
        canMore: false,
        onQuery: noop,
        onSelect: noop,
        onMore: noop,
        onRetry: noop,
      }}
      form={{ note: "" }}
      recipientName={recipientName}
      onNote={noop}
    />,
  );

describe("TransferDeviceFields", () => {
  it("shows the current owner and a Transfer to radiogroup with the owner disabled", () => {
    const html = render();
    expect(html).toContain(copy.currentOwner);
    expect(html).toContain(`aria-label="${copy.recipients}"`);
    const radios = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(radios[0]).toContain("disabled");
    expect(radios[1]).not.toContain("disabled");
    expect(html).toContain(`(${copy.ownerSuffix})`);
    expect(html).not.toContain("sits here");
  });
  it("has no expiry input or legend, only the hint", () => {
    const html = render();
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("<legend");
    expect(html).toContain(copy.expiryHint);
  });
  it("has the note label, hint and counter", () => {
    const html = render();
    expect(html).toContain(copy.note);
    expect(html).toContain(copy.noteHint);
    expect(html).toContain("0/500");
  });
  it("what happens next is linked from the radiogroup wrapper and names the recipient", () => {
    const before = render();
    const id = /aria-describedby="([^"]+)" class="flex flex-col gap-3"/.exec(before)?.[1] ?? "";
    expect(id).not.toBe("");
    expect(before).toContain(`id="${id}"`);
    expect(before).toContain("Transfer pending");
    const after = render("Trần Hương");
    expect(after).toContain("Trần Hương will see this");
    expect(after).not.toContain("The recipient must confirm");
  });
});
