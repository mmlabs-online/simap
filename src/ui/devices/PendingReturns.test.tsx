import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { PendingReturns, type PendingReturnsProps } from "./PendingReturns";

const c = devicesCopy.returns;
const noop = () => {};
const item = (id: string, over: Partial<HandoffDto> = {}): HandoffDto => ({
  id,
  kind: "return",
  status: "pending",
  device: {
    id: `d-${id}`,
    name: "Máy trạm",
    type: "PC",
    inventoryNumber: "INV-1",
    expiresOn: null,
  },
  from: { id: "m1", displayName: "Nguyễn Thị Hà" },
  to: null,
  requestedBy: { id: "m1", displayName: "Nguyễn Thị Hà" },
  decidedBy: null,
  note: null,
  newExpiresOn: null,
  createdAt: "2026-11-25T00:00:00Z",
  decidedAt: null,
  canCancel: true,
  canConfirm: true,
  canDecline: false,
  ...over,
});
const render = (over: Partial<PendingReturnsProps> = {}) =>
  renderToStaticMarkup(
    <PendingReturns
      items={[item("h1")]}
      truncated={false}
      errorCode={null}
      busyId={null}
      onConfirm={noop}
      onCancel={noop}
      onRetry={noop}
      {...over}
    />,
  );

describe("PendingReturns", () => {
  it("renders device, typeLine, From and the note, with Confirm and Cancel but no Decline", () => {
    const html = render({ items: [item("h1", { note: "Nghỉ việc" })] });
    expect(html).toContain("Máy trạm");
    expect(html).toContain(devicesCopy.typeLine("PC", "INV-1"));
    expect(html).toContain(devicesCopy.incoming.from("Nguyễn Thị Hà"));
    expect(html).toContain("Nghỉ việc");
    expect(html).toContain(c.heading(1));
    expect(html).toContain(c.hint);
    expect(html).toContain(c.confirm);
    expect(html).toContain(c.cancel);
    expect(html).not.toContain(devicesCopy.incoming.decline);
  });
  it("Confirm only with canConfirm (data-handoff-confirm); Cancel only with canCancel", () => {
    const noConfirm = render({ items: [item("h1", { canConfirm: false })] });
    expect(noConfirm).not.toContain("data-handoff-confirm");
    expect(noConfirm).toContain(c.cancel);
    const noCancel = render({ items: [item("h1", { canCancel: false })] });
    expect(noCancel).toContain('data-handoff-confirm="h1"');
    expect(noCancel).not.toContain(`>${c.cancel}<`);
  });
  it("aria-labels and the heading wiring", () => {
    const html = render();
    expect(html).toContain(`aria-label="${c.confirmAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
    expect(html).toContain(`aria-label="${c.cancelAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
    expect(html).toContain('aria-labelledby="returns-heading"');
    expect(html).toMatch(/<h2 id="returns-heading"[^>]*tabindex="-1"/i);
  });
  it("busyId set: every button is disabled", () => {
    const buttons =
      render({ items: [item("h1"), item("h2")], busyId: "h1" }).match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b).toContain(" disabled=");
  });
  it("empty and no error: renders nothing", () => {
    expect(render({ items: [] })).toBe("");
  });
  it("error: role=alert message and Retry", () => {
    const html = render({ items: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html).toContain(devicesCopy.retry);
  });
  it("truncated: shows the 'first N' line", () => {
    expect(render({ truncated: true })).toContain(c.truncated(1));
    expect(render()).not.toContain("Showing the first");
  });
});
