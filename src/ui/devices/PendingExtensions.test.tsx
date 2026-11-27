import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { PendingExtensions, type PendingExtensionsProps } from "./PendingExtensions";

const c = devicesCopy.extensions;
const noop = () => {};
const item = (id: string, over: Partial<HandoffDto> = {}): HandoffDto => ({
  id,
  kind: "extension",
  status: "pending",
  device: {
    id: `d-${id}`,
    name: "Máy trạm",
    type: "PC",
    inventoryNumber: "INV-1",
    expiresOn: "2026-11-24",
  },
  from: { id: "m1", displayName: "Nguyễn Thị Hà" },
  to: null,
  requestedBy: { id: "m1", displayName: "Nguyễn Thị Hà" },
  decidedBy: null,
  note: null,
  newExpiresOn: "2026-12-25",
  createdAt: "2026-11-25T00:00:00Z",
  decidedAt: null,
  canCancel: true,
  canConfirm: true,
  canDecline: true,
  ...over,
});
const render = (over: Partial<PendingExtensionsProps> = {}) =>
  renderToStaticMarkup(
    <PendingExtensions
      items={[item("h1")]}
      truncated={false}
      errorCode={null}
      busyId={null}
      onApprove={noop}
      onReject={noop}
      onRetry={noop}
      {...over}
    />,
  );

describe("PendingExtensions", () => {
  it("lists device, owner, 'Current expiry X -> requested Y' and the note, with Approve and Reject", () => {
    const html = render({ items: [item("h1", { note: "Cần thêm thời gian" })] });
    expect(html).toContain(c.heading(1));
    expect(html).toContain("Approving sets the device");
    expect(html).toContain("Máy trạm");
    expect(html).toContain(devicesCopy.typeLine("PC", "INV-1"));
    expect(html).toContain(c.owner("Nguyễn Thị Hà"));
    expect(html).toContain(c.change("2026-11-24", "2026-12-25"));
    expect(html).toContain("Cần thêm thời gian");
    expect(html).toContain('data-handoff-confirm="h1"');
    expect(html).toContain(c.approve);
    expect(html).toContain(c.reject);
    expect(html).toContain(`aria-label="${c.approveAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
    expect(html).toContain(`aria-label="${c.rejectAria("Máy trạm", "INV-1", "Nguyễn Thị Hà")}"`);
  });
  it("a device with no current expiry says so", () => {
    const html = render({
      items: [item("h1", { device: { ...item("h1").device, expiresOn: null } })],
    });
    expect(html).toContain(c.change(c.noExpiry, "2026-12-25"));
  });
  it("Approve and Reject follow canConfirm and canDecline", () => {
    const html = render({ items: [item("h1", { canConfirm: false, canDecline: false })] });
    expect(html).not.toContain("data-handoff-confirm");
    expect(html).not.toContain(c.approve);
    expect(html).not.toContain(c.reject);
  });
  it("both buttons are disabled while an action is busy", () => {
    const html = render({ busyId: "h1" });
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });
  it("renders nothing when empty and no error", () => {
    expect(render({ items: [] })).toBe("");
  });
  it("an error shows its message and Retry", () => {
    const html = render({ items: [], errorCode: "internal" });
    expect(html).toContain(apiErrorMessage("internal"));
    expect(html).toContain(devicesCopy.retry);
  });
  it("a truncated list says so", () => {
    expect(render({ truncated: true })).toContain(c.truncated(1));
  });
});

describe("PendingExtensions tokens", () => {
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
