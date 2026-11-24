import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { shellCopy } from "../copy/shell";
import { DevicesView, type DevicesViewProps } from "./DevicesView";

const noop = () => {};
const base: DeviceDto = {
  id: "d1",
  name: "Máy trạm",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: "AA:BB:CC:DD:EE:FF",
  owner: { id: "u1", displayName: "Nguyễn Thị Hà" },
  placement: {
    seatId: "s1",
    seatCode: "C302-01",
    roomId: "r1",
    roomCode: "C302",
    role: "primary",
  },
  mine: false,
  canEdit: false,
  canPlace: false,
};
const secondary: DeviceDto = {
  ...base,
  id: "d2",
  name: "Man hinh",
  placement: { ...base.placement!, seatCode: "C302-02", role: "secondary" },
};
const stored: DeviceDto = {
  ...base,
  id: "d3",
  name: "Laptop",
  mac: null,
  placement: null,
  mine: true,
};

const render = (p: Partial<DevicesViewProps> = {}) =>
  renderToStaticMarkup(
    <DevicesView
      status="ready"
      devices={[base, secondary, stored]}
      truncated={false}
      errorCode={null}
      filter="all"
      onFilter={noop}
      onRetry={noop}
      {...p}
    />,
  );

describe("DevicesView rows", () => {
  it("shows placement, role tag and room link, or 'In inventory' without a link", () => {
    const html = render({ devices: [base, secondary] });
    expect(html).toContain("At seat C302-01");
    expect(html).toContain("At seat C302-02");
    expect(html).toContain(devicesCopy.roles.primary);
    expect(html).toContain(devicesCopy.roles.secondary);
    expect(html).toContain('href="/rooms/C302"');
    const inv = render({ devices: [stored] });
    expect(inv).toContain(devicesCopy.inInventory);
    expect(inv).not.toContain("href=");
    expect(inv).not.toContain(devicesCopy.roles.primary);
  });

  it("shows the MAC or a dash, the owner as is, and 'You' only when mine", () => {
    const html = render({ devices: [base] });
    expect(html).toContain("AA:BB:CC:DD:EE:FF");
    expect(html).toContain("Nguyễn Thị Hà");
    expect(html).not.toContain(`>${devicesCopy.you}<`);
    const mine = render({ devices: [stored] });
    expect(mine).toContain(`>${devicesCopy.you}<`);
    expect(mine).toContain(devicesCopy.noMac);
  });

  it("has a caption, th scope=col per column and no action controls", () => {
    const html = render();
    expect(html).toContain(`<caption class="sr-only">${devicesCopy.caption}</caption>`);
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html.match(/<button/g)).toHaveLength(3); // only the filter chips
    expect(html).not.toMatch(/Edit|Delete|Move to/);
  });
});

describe("DevicesView row actions", () => {
  const actions = { onPlace: noop };
  const placeable: DeviceDto = { ...base, id: "d4", canPlace: true };
  const inventoryItem: DeviceDto = { ...stored, id: "d5", canPlace: true };

  it("actions column only when a row has an action", () => {
    expect(render({ actions }).match(/<th scope="col"/g)).toHaveLength(6);
    expect(render({ actions, devices: [placeable] }).match(/<th scope="col"/g)).toHaveLength(7);
    expect(render({ devices: [placeable] }).match(/<th scope="col"/g)).toHaveLength(6);
  });

  it("Place / Move / Return buttons per canPlace row, none on a canPlace:false row", () => {
    const html = render({ actions, devices: [placeable, inventoryItem, secondary] });
    // table and card list each render the buttons
    expect(html.match(/aria-label="Move device INV-1"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Return device INV-1 to inventory"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Place device INV-1"/g)).toHaveLength(2);
    expect(html.match(/>Move</g)).toHaveLength(2);
    expect(render({ actions, devices: [secondary] })).not.toContain("Move device");
  });
});

describe("DevicesView filter and states", () => {
  it("renders three radios in a radiogroup with only the current one checked", () => {
    const html = render({ filter: "placed" });
    expect(html).toContain(`role="radiogroup" aria-label="${devicesCopy.filterLabel}"`);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*>Placed</);
  });

  it("loading is aria-busy with no table; error shows the message and Try again", () => {
    const loading = render({ status: "loading", devices: [] });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toContain("<table");
    const err = render({ status: "error", devices: [], errorCode: "unavailable" });
    expect(err).toContain('role="alert"');
    expect(err).toContain(apiErrorMessage("unavailable"));
    expect(err).toContain(devicesCopy.retry);
  });

  it("empty text follows the filter; Show all only when filtered", () => {
    const all = render({ devices: [], filter: "all" });
    expect(all).toContain(shellCopy.pages.devices.empty);
    expect(all).not.toContain(devicesCopy.showAll);
    const placed = render({ devices: [], filter: "placed" });
    expect(placed).toContain(devicesCopy.empty.placed);
    expect(placed).toContain(devicesCopy.showAll);
    const inv = render({ devices: [], filter: "inventory" });
    expect(inv).toContain(devicesCopy.empty.inventory);
    expect(inv).toContain(devicesCopy.showAll);
  });

  it("renders the truncated notice only when truncated", () => {
    expect(render({ truncated: true })).toContain(devicesCopy.truncated(1000));
    expect(render({ truncated: false })).not.toContain("Showing the first");
  });
});

describe("DevicesView create and edit entries", () => {
  it("New device button when onNew is given", () => {
    expect(render({ onNew: noop })).toContain(devicesCopy.newDevice);
    expect(render()).not.toContain(devicesCopy.newDevice);
  });
  it("Edit buttons on canEdit rows", () => {
    const html = render({
      actions: { onEdit: noop },
      devices: [
        { ...base, canEdit: true },
        { ...secondary, canEdit: false },
      ],
    });
    expect(html.match(/aria-label="Edit device INV-1"/g)).toHaveLength(2);
  });
  it("Delete buttons on canEdit rows with aria-label 'Delete device <inv>'", () => {
    const html = render({
      actions: { onDelete: noop },
      devices: [
        { ...base, canEdit: true },
        { ...secondary, inventoryNumber: "INV-2", canEdit: false },
      ],
    });
    expect(html.match(/aria-label="Delete device INV-1"/g)).toHaveLength(2);
    expect(html).not.toContain("Delete device INV-2");
  });
  it("h1 is focusable (tabindex -1)", () => {
    expect(render()).toMatch(/<h1[^>]*tabindex="-1"/i);
  });
});
