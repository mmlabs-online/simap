import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { deviceDetailHref } from "@/lib/nav";
import { devicesCopy } from "../copy/devices";
import { portalCopy } from "../copy/portal";
import { rowActions, type DeviceRowHandlers } from "../devices/device-actions";
import { MyDevicesTable, type MyDevicesTableProps } from "./MyDevicesTable";

const copy = portalCopy.devices;
const dev = (n: number, over: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: `d${n}`,
    name: `Dev ${n}`,
    type: "PC",
    inventoryNumber: `INV-${n}`,
    mac: null,
    serial: null,
    manufacturer: null,
    brand: null,
    mine: true,
    overdue: false,
    canPlace: true,
    canTransfer: true,
    canReturn: true,
    owner: { id: "m", displayName: "Ann" },
    holding: { note: null, expiresOn: "2026-12-31" },
    placement: null,
    pendingHandoff: null,
    ...over,
  }) as DeviceDto;
const placed = (role: "primary" | "secondary") =>
  ({ seatId: "s", seatCode: "S-1", roomId: "r", roomCode: "R1", role }) as DeviceDto["placement"];

const fn = vi.fn();
const handlers: DeviceRowHandlers = {
  onPlace: fn,
  onTransfer: fn,
  onReturn: fn,
  onExtend: fn,
  onCancelHandoff: fn,
};
const render = (p: Partial<MyDevicesTableProps> = {}) =>
  renderToStaticMarkup(
    <MyDevicesTable
      devices={[dev(1), dev(2, { type: "Monitor" }), dev(3)]}
      hasMore={false}
      loadingMore={false}
      errorCode={null}
      actions={handlers}
      busyId={null}
      query=""
      typeKey=""
      onQueryChange={fn}
      onTypeChange={fn}
      onClear={fn}
      onLoadMore={fn}
      {...p}
    />,
  );
const rowOf = (html: string, inv: string) =>
  html.split("<tr").find((r) => r.includes(`>${inv}<`)) ?? "";

describe("MyDevicesTable header", () => {
  it("title, count chip, labelled search and type select", () => {
    const html = render();
    expect(html).toMatch(/<h3[^>]*>Your assigned devices<\/h3><span[^>]*>3<\/span>/);
    expect(html).toContain(`aria-label="${copy.searchLabel}"`);
    expect(html).toContain(
      `<label for="my-devices-type" class="sr-only">${copy.typeLabel}</label>`,
    );
    expect(html).toContain(`>${copy.allTypes}<`);
    expect(html).toContain(">Monitor</option>");
    expect(html).toContain(">PC</option>");
    expect(render({ hasMore: true })).toMatch(/<span[^>]*>3\+<\/span>/);
  });
});

describe("MyDevicesTable table", () => {
  it("caption, eight column headers, scroll wrapper, no card list", () => {
    const html = render();
    expect(html).toContain(`<caption class="sr-only">${copy.tableCaption}</caption>`);
    expect(html.match(/<th scope="col"/g)).toHaveLength(8);
    for (const c of Object.values(devicesCopy.columns)) expect(html).toContain(`>${c}</th>`);
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-240");
    expect(html).not.toContain("md:hidden");
  });
  it("placement variants", () => {
    const html = render({
      devices: [
        dev(1, { placement: placed("primary") }),
        dev(2, { placement: placed("secondary") }),
        dev(3),
      ],
    });
    expect(rowOf(html, "INV-1")).toContain("S-1");
    expect(rowOf(html, "INV-1")).toContain(devicesCopy.roles.primary);
    expect(rowOf(html, "INV-2")).toContain(devicesCopy.roles.secondary);
    expect(rowOf(html, "INV-3")).toContain(copy.inMyInventory);
  });
  it("owner variants: You chip, expiry, No expiry, Overdue", () => {
    const html = render({
      devices: [dev(1, { overdue: true }), dev(2, { holding: { note: null, expiresOn: null } })],
    });
    expect(rowOf(html, "INV-1")).toContain(devicesCopy.you);
    expect(rowOf(html, "INV-1")).toContain("2026-12-31");
    expect(rowOf(html, "INV-1")).toContain(devicesCopy.overdueChip);
    expect(rowOf(html, "INV-2")).not.toContain(devicesCopy.overdueChip);
    expect(rowOf(html, "INV-2")).not.toContain("2026-12-31");
  });
  it("name link, MAC and details", () => {
    const html = render({
      devices: [dev(1, { mac: "aa:bb:cc:dd:ee:ff", manufacturer: "Dell", serial: "SN9" })],
    });
    expect(html).toContain(`href="${deviceDetailHref("d1")}"`);
    expect(html).toContain("aa:bb:cc:dd:ee:ff");
    expect(html).toContain("Dell");
    expect(html).toContain("SN9");
  });
});

describe("MyDevicesTable actions", () => {
  const pending = {
    id: "h",
    kind: "transfer",
    to: { id: "x", displayName: "Bob" },
    requestedBy: { id: "m", displayName: "Ann" },
    newExpiresOn: null,
    createdAt: "",
    canCancel: true,
  } as unknown as DeviceDto["pendingHandoff"];
  it("buttons equal rowActions labels for each variant", () => {
    const variants = [
      dev(1),
      dev(2, { placement: placed("primary") }),
      dev(3, { overdue: true }),
      dev(4, { pendingHandoff: pending, canTransfer: false, canReturn: false }),
    ];
    const html = render({ devices: variants });
    for (const v of variants) {
      const row = rowOf(html, v.inventoryNumber);
      const labels = rowActions(v, handlers).map((a) => a.label);
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels) expect(row).toContain(`>${l}</button>`);
      expect(row.match(/<button/g)).toHaveLength(labels.length);
    }
    const p = rowOf(html, "INV-4");
    expect(p).toContain(devicesCopy.actions.cancelTransfer);
    expect(p).not.toContain(`>${devicesCopy.actions.transfer}<`);
    expect(p).not.toContain(`>${devicesCopy.actions.giveBack}<`);
    expect(p).not.toContain(`>${devicesCopy.actions.extend}<`);
  });
  it("busy row is disabled", () => {
    const row = rowOf(render({ busyId: "d1" }), "INV-1");
    expect(row.match(/<button/g)!.length).toBeGreaterThan(0);
    expect(row.match(/<button/g)!.length).toBe(row.match(/disabled=""/g)!.length);
  });
  it("no Actions column when no row has an action", () => {
    const html = render({ actions: {} });
    expect(html.match(/<th scope="col"/g)).toHaveLength(7);
    expect(html).not.toContain(`>${devicesCopy.columns.actions}<`);
  });
});

describe("MyDevicesTable filter and footer", () => {
  it("query narrows rows; chip keeps the total", () => {
    const html = render({ query: "inv-2" });
    expect(html).toContain(copy.showing(1, 3));
    expect(html).toContain("INV-2");
    expect(html).not.toContain(">INV-1<");
    expect(html).toMatch(/<\/h3><span[^>]*>3<\/span>/);
  });
  it("type key narrows rows", () => {
    const html = render({ typeKey: "monitor" });
    expect(html).toContain(copy.showing(1, 3));
    expect(html).not.toContain(">INV-1<");
  });
  it("no match shows a message and Clear filters", () => {
    const html = render({ query: "zzz" });
    expect(html).toContain('colSpan="8"');
    expect(html).toContain(copy.noMatches);
    expect(html).toContain(`>${copy.clearFilters}</button>`);
    expect(html).toContain(copy.showing(0, 3));
  });
  it("hasMore footer, Load more and load-more error", () => {
    const html = render({ hasMore: true, errorCode: "unavailable" });
    expect(html).toContain(copy.showingLoaded(3, 3));
    expect(html).toContain(`>${copy.loadMore}</button>`);
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.loadMoreFailed);
    expect(render({ hasMore: true, loadingMore: true })).toMatch(
      /<button[^>]*disabled=""[^>]*>Load more<\/button>/,
    );
    expect(render()).not.toContain(copy.loadMore);
  });
  it("tokens: header, select and search sizes, no arbitrary text", () => {
    const html = render();
    const th = html.match(/<th [^>]*>/)![0];
    expect(th).toContain("text-caption");
    expect(th).toContain("uppercase");
    const select = html.match(/<select [^>]*>/)![0];
    expect(select).toContain("min-h-control");
    expect(select).toContain("border-border-strong");
    expect(html).not.toContain("h-10!");
    expect(html).not.toContain("text-[");
  });
});
