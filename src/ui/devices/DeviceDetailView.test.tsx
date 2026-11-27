import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { DeviceDetailView, type DeviceDetailViewProps } from "./DeviceDetailView";

const noop = () => {};
const base: DeviceDto = {
  id: "d1",
  name: "Máy trạm",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: "AA:BB:CC:DD:EE:FF",
  serial: "SN-9",
  manufacturer: "Dell",
  brand: "Precision",
  holding: { note: "Long note\nsecond line", expiresOn: "2026-12-31" },
  owner: { id: "u1", displayName: "Nguyễn Thị Hà" },
  placement: { seatId: "s1", seatCode: "C302-01", roomId: "r1", roomCode: "C302", role: "primary" },
  mine: false,
  canEdit: false,
  canPlace: false,
  canDelete: false,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  canReturn: false,
  canTakeBack: false,
  overdue: false,
  pendingHandoff: null,
};

const render = (p: Partial<DeviceDetailViewProps> = {}) =>
  renderToStaticMarkup(
    <DeviceDetailView
      status="ready"
      device={base}
      errorCode={null}
      holderSince={null}
      onRetry={noop}
      history={<p>HISTORY-MARK</p>}
      {...p}
    />,
  );

describe("DeviceDetailView states", () => {
  it("loading skeleton is aria-busy; error has role=alert and Retry; notFound has back link and no Retry", () => {
    const loading = render({ status: "loading", device: null });
    expect(loading).toContain('aria-busy="true"');
    const error = render({ status: "error", device: null, errorCode: "unavailable" });
    expect(error).toContain('role="alert"');
    expect(error).toContain(apiErrorMessage("unavailable"));
    expect(error).toContain(devicesCopy.retry);
    const nf = render({ status: "notFound", device: null });
    expect(nf).toContain(devicesCopy.detail.notFoundTitle);
    expect(nf).toContain('href="/devices"');
    expect(nf).not.toContain(devicesCopy.retry);
    expect(nf).not.toContain("HISTORY-MARK");
    expect(error).toContain("HISTORY-MARK");
  });
});

describe("DeviceDetailView ready", () => {
  it("name heading, type, inventory number, MAC, serial, manufacturer, brand (none copy for nulls)", () => {
    const html = render();
    expect(html).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Máy trạm<\/h1>/);
    for (const s of ["PC", "INV-1", "AA:BB:CC:DD:EE:FF", "SN-9", "Dell", "Precision"]) {
      expect(html).toContain(s);
    }
    const bare = render({
      device: { ...base, mac: null, serial: null, manufacturer: null, brand: null },
    });
    expect(bare).toContain(devicesCopy.noMac);
    expect(bare.split(devicesCopy.detail.none).length - 1).toBeGreaterThanOrEqual(3);
    expect(html).toContain("HISTORY-MARK");
  });

  it("placed device links to the room with role chip; unplaced shows in-inventory copy", () => {
    const html = render();
    expect(html).toContain('href="/rooms/C302"');
    expect(html).toContain(devicesCopy.roles.primary);
    const inv = render({ device: { ...base, placement: null } });
    expect(inv).toContain(devicesCopy.inInventory);
    expect(inv).not.toContain('href="/rooms/');
  });

  it("holder with since date, note, expiry and overdue chip; org inventory when unowned", () => {
    const html = render({
      device: { ...base, overdue: true },
      holderSince: "2026-03-05T17:30:00.000000Z",
    });
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).toContain(devicesCopy.detail.holderSince("06 Mar 2026, 00:30"));
    expect(html).toContain("Long note");
    expect(html).toContain(devicesCopy.holding.expired("2026-12-31"));
    expect(html).toContain(devicesCopy.overdueChip);
    expect(html).not.toContain("line-clamp");
    const unowned = render({ device: { ...base, owner: null, holding: null, placement: null } });
    expect(unowned).toContain(devicesCopy.orgInventory);
    expect(unowned).not.toContain(devicesCopy.detail.holderSince(""));
  });

  it("pending transfer shows chip, recipient and requested-by; no pending section without a handoff", () => {
    const pending = render({
      device: {
        ...base,
        pendingHandoff: {
          id: "h1",
          kind: "transfer",
          to: { id: "u2", displayName: "Trần Văn Bình" },
          requestedBy: { id: "u1", displayName: "Nguyễn Thị Hà" },
          newExpiresOn: null,
          createdAt: "2026-03-05T17:30:00.000000Z",
          canCancel: false,
        },
      },
    });
    expect(pending).toContain(devicesCopy.detail.sections.pending);
    expect(pending).toContain(devicesCopy.pending.chip);
    expect(pending).toContain(devicesCopy.pending.to("Trần Văn Bình"));
    expect(pending).toContain(devicesCopy.detail.requestedBy("Nguyễn Thị Hà"));
    expect(render()).not.toContain(devicesCopy.detail.sections.pending);
  });
});

describe("DeviceDetailView notice and actions", () => {
  const statuses = [
    { status: "loading", device: null },
    { status: "error", device: null, errorCode: "unavailable" },
    { status: "notFound", device: null },
    {},
  ] as const;

  it("notice region is always mounted; tones map to roles", () => {
    for (const s of statuses) expect(render({ ...s })).toContain('<div aria-live="polite">');
    const st = render({ notice: { tone: "status", text: "Done Máy" } });
    expect(st).toContain('role="status"');
    expect(st).toContain("Done Máy");
    const er = render({ notice: { tone: "error", text: "Oops" } });
    expect(er).toContain('role="alert"');
  });

  it("actions render after the h1 only when ready", () => {
    const html = render({ actions: <p>ACTIONS-MARK</p> });
    expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf("ACTIONS-MARK"));
    expect(html.indexOf("ACTIONS-MARK")).toBeLessThan(
      html.indexOf(devicesCopy.detail.sections.fields),
    );
    for (const s of statuses.slice(0, 3)) {
      expect(render({ ...s, actions: <p>ACTIONS-MARK</p> })).not.toContain("ACTIONS-MARK");
    }
  });
});

describe("DeviceDetailView tokens", () => {
  it("h1, labels, section headings and the back link use the kit styles", () => {
    const html = render();
    expect(html).toMatch(
      /<h1[^>]*tabindex="-1"[^>]*text-display|<h1[^>]*text-display[^>]*tabindex="-1"/,
    );
    expect(html).toMatch(/<dt[^>]*text-caption[^>]*uppercase/);
    expect(html).toMatch(/<h2[^>]*text-subtitle/);
    expect(html).toMatch(/<a[^>]*min-h-control[^>]*>/);
  });
  it("overdue and pending states are toned pills", () => {
    const overdue = render({
      device: {
        ...base,
        mine: true,
        overdue: true,
        holding: { note: null, expiresOn: "2026-01-01" } as DeviceDto["holding"],
      },
    });
    expect(overdue).toContain("bg-danger-tint");
    const pending = render({
      device: {
        ...base,
        pendingHandoff: {
          id: "h1",
          kind: "transfer",
          to: { id: "u2", displayName: "Bình" },
          requestedBy: { id: "u1", displayName: "Hà" },
          newExpiresOn: null,
          createdAt: "2026-03-05T17:30:00.000000Z",
          canCancel: false,
        },
      },
    });
    expect(pending).toContain("bg-warning-tint");
  });
});
