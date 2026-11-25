import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { DeviceRowActions } from "./DeviceRowActions";
import { detailHandlers } from "./device-detail-actions";
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

describe("DeviceDetailView actions and notice", () => {
  const actions = <button>ACTION-MARK</button>;
  const withBar = (device: DeviceDto) => (
    <DeviceRowActions device={device} handlers={detailHandlers(noop, noop)} />
  );

  it("ready renders the actions node; loading, error and notFound do not", () => {
    expect(render({ actions })).toContain("ACTION-MARK");
    expect(render({ actions, status: "loading", device: null })).not.toContain("ACTION-MARK");
    expect(render({ actions, status: "error", device: null, errorCode: "internal" })).not.toContain(
      "ACTION-MARK",
    );
    expect(render({ actions, status: "notFound", device: null })).not.toContain("ACTION-MARK");
  });

  it("DeviceRowActions gating: holder sees Transfer and Give back, a plain viewer none, never Edit or Delete", () => {
    const holder = { ...base, canTransfer: true, canReturn: true, canEdit: true, canDelete: true };
    const html = render({ actions: withBar(holder) });
    expect(html).toContain(devicesCopy.actions.transfer);
    expect(html).toContain(devicesCopy.actions.giveBack);
    expect(html).not.toContain(devicesCopy.actions.edit);
    expect(html).not.toContain(devicesCopy.actions.delete);
    expect(render({ actions: withBar(base) })).not.toContain("<button");
  });

  it("the live region is mounted in every status and empty without a notice", () => {
    for (const p of [
      {},
      { status: "loading" as const, device: null },
      { status: "error" as const, device: null, errorCode: "internal" },
      { status: "notFound" as const, device: null },
    ]) {
      expect(render(p)).toContain('<div aria-live="polite"></div>');
    }
  });

  it("status notice is role=status, error is role=alert, notFound still shows it", () => {
    const status = render({ notice: { tone: "status", text: "SENT-MARK" } });
    expect(status).toContain('role="status"');
    expect(status).toContain("SENT-MARK");
    const err = render({ notice: { tone: "error", text: "ERR-MARK" } });
    expect(err).toContain('role="alert"');
    const nf = render({
      status: "notFound",
      device: null,
      notice: { tone: "status", text: "N-MARK" },
    });
    expect(nf).toContain("N-MARK");
  });
});
