import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { IncomingTransfers, type IncomingTransfersProps } from "./IncomingTransfers";

const c = devicesCopy.incoming;
const noop = () => {};
const item = (id: string, over: Partial<HandoffDto> = {}): HandoffDto => ({
  id,
  kind: "transfer",
  status: "pending",
  device: {
    id: `d-${id}`,
    name: "Máy trạm",
    type: "PC",
    inventoryNumber: "INV-1",
    expiresOn: null,
  },
  from: { id: "m1", displayName: "Nguyễn Thị Hà" },
  to: { id: "m2", displayName: "Trần Văn Bình" },
  requestedBy: { id: "m1", displayName: "Nguyễn Thị Hà" },
  decidedBy: null,
  note: null,
  newExpiresOn: null,
  createdAt: "2026-11-25T00:00:00Z",
  decidedAt: null,
  canCancel: false,
  canConfirm: true,
  canDecline: true,
  ...over,
});
const render = (over: Partial<IncomingTransfersProps> = {}) =>
  renderToStaticMarkup(
    <IncomingTransfers
      items={[item("h1")]}
      truncated={false}
      errorCode={null}
      busyId={null}
      onConfirm={noop}
      onDecline={noop}
      onRetry={noop}
      {...over}
    />,
  );

describe("IncomingTransfers", () => {
  it("renders each item with name, type, inventory number, From <sender> and the note", () => {
    const html = render({
      items: [
        item("h1", { note: "Bàn giao máy" }),
        item("h2", { device: { ...item("x").device, name: "Laptop" } }),
      ],
    });
    expect(html).toContain("Máy trạm");
    expect(html).toContain("Laptop");
    expect(html).toContain(devicesCopy.typeLine("PC", "INV-1"));
    expect(html).toContain(c.from("Nguyễn Thị Hà"));
    expect(html).toContain("Bàn giao máy");
    expect(html).toContain(c.heading(2));
    expect(html).toContain(c.confirm);
    expect(html).toContain(c.decline);
  });
  it("a Vietnamese sender and device name render intact; a note keeps line breaks (whitespace-pre-line)", () => {
    const html = render({ items: [item("h1", { note: "Dòng một\nDòng hai" })] });
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).toContain("Máy trạm");
    expect(html).toMatch(/class="[^"]*whitespace-pre-line[^"]*"[^>]*>Dòng một\nDòng hai</);
  });
  it("no note: no note line; canConfirm false: no Confirm button", () => {
    const html = render({ items: [item("h1", { canConfirm: false })] });
    expect(html).not.toContain("whitespace-pre-line");
    expect(html).not.toContain("data-handoff-confirm");
    expect(html).toContain(c.decline);
  });
  it("aria-labels include name, inventory number and sender; heading has tabIndex -1 and labels the section", () => {
    const html = render();
    expect(html).toContain(`aria-label="${c.confirmAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
    expect(html).toContain(`aria-label="${c.declineAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
    expect(html).toContain('aria-labelledby="incoming-heading"');
    expect(html).toMatch(/<h2 id="incoming-heading"[^>]*tabindex="-1"/i);
    expect(html).toContain('data-handoff-confirm="h1"');
  });
  it("busyId set: every Confirm and Decline is disabled", () => {
    const html = render({ items: [item("h1"), item("h2")], busyId: "h1" });
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b).toContain(" disabled=");
    for (const b of render({ items: [item("h1"), item("h2")] }).match(/<button[^>]*>/g) ?? []) {
      expect(b).not.toContain(" disabled=");
    }
  });
  it("empty and no error: renders nothing", () => {
    expect(render({ items: [] })).toBe("");
  });
  it("error: role=alert message and Retry, with or without items", () => {
    for (const items of [[], [item("h1")]]) {
      const html = render({ items, errorCode: "unavailable" });
      expect(html).toContain('role="alert"');
      expect(html).toContain(apiErrorMessage("unavailable"));
      expect(html).toContain(devicesCopy.retry);
    }
  });
  it("truncated: shows the 'first N' line", () => {
    expect(render({ truncated: true })).toContain(c.truncated(1));
    expect(render()).not.toContain("Showing the first");
  });
});

describe("IncomingTransfers tokens", () => {
  it("card switches layout at lg; heading is a focus target; buttons are 44 px", () => {
    const html = render();
    expect(html).toContain("lg:flex-row");
    expect(html).not.toMatch(/(?<![\w-])md:/);
    expect(html).toMatch(
      /<h2[^>]*text-subtitle[^>]*tabindex="-1"|<h2[^>]*tabindex="-1"[^>]*text-subtitle/,
    );
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toContain("min-h-control");
  });
});
