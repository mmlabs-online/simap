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
  canDelete: false,
  serial: null,
  manufacturer: null,
  brand: null,
  holding: null,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  canReturn: false,
  canTakeBack: false,
  overdue: false,
  pendingHandoff: null,
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

describe("DevicesView incoming slot", () => {
  it("incoming slot renders between the notice and the filter chips", () => {
    const html = render({
      notice: { tone: "status", text: "NOTICE-MARK" },
      incoming: <p>INCOMING-MARK</p>,
    });
    const at = (s: string) => html.indexOf(s);
    expect(at("NOTICE-MARK")).toBeGreaterThan(-1);
    expect(at("INCOMING-MARK")).toBeGreaterThan(at("NOTICE-MARK"));
    expect(at("radiogroup")).toBeGreaterThan(at("INCOMING-MARK"));
    expect(render()).not.toContain("INCOMING-MARK");
  });
});

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
    expect(inv).not.toContain('href="/rooms/');
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
    expect(html.match(/<th scope="col"/g)).toHaveLength(7);
    expect(html.match(/<button/g)).toHaveLength(5); // only the filter chips
    expect(html).not.toMatch(/Edit|Delete|Move to/);
  });
});

describe("DevicesView row actions", () => {
  const actions = { onPlace: noop };
  const placeable: DeviceDto = { ...base, id: "d4", canPlace: true };
  const inventoryItem: DeviceDto = { ...stored, id: "d5", canPlace: true };

  it("actions column only when a row has an action", () => {
    expect(render({ actions }).match(/<th scope="col"/g)).toHaveLength(7);
    expect(render({ actions, devices: [placeable] }).match(/<th scope="col"/g)).toHaveLength(8);
    expect(render({ devices: [placeable] }).match(/<th scope="col"/g)).toHaveLength(7);
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
  it("renders five radios in a radiogroup with only the current one checked", () => {
    const html = render({ filter: "placed" });
    expect(html).toContain(`role="radiogroup" aria-label="${devicesCopy.filterLabel}"`);
    expect(html.match(/role="radio"/g)).toHaveLength(5);
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
  it("unowned row shows Org inventory and no Place/Delete for a non-Admin", () => {
    const unowned: DeviceDto = {
      ...stored,
      id: "d9",
      owner: null,
      mine: false,
      canEdit: false,
      canPlace: false,
      canDelete: false,
    };
    const html = render({
      devices: [unowned],
      actions: { onPlace: noop, onDelete: noop, onEdit: noop },
    });
    expect(html).toContain(devicesCopy.orgInventory);
    expect(html).not.toMatch(/Place device|Delete device|Edit device/);
  });
  it("Delete buttons on canDelete rows with aria-label 'Delete device <inv>'", () => {
    const html = render({
      actions: { onDelete: noop },
      devices: [
        { ...base, canDelete: true },
        { ...secondary, inventoryNumber: "INV-2", canEdit: true, canDelete: false },
      ],
    });
    expect(html.match(/aria-label="Delete device INV-1"/g)).toHaveLength(2);
    expect(html).not.toContain("Delete device INV-2");
  });
  it("h1 is focusable (tabindex -1)", () => {
    expect(render()).toMatch(/<h1[^>]*tabindex="-1"/i);
  });
});

describe("DevicesView details and holding", () => {
  const full: DeviceDto = {
    ...base,
    id: "d6",
    manufacturer: "Dell",
    brand: "XPS",
    serial: "SN-123",
  };
  const held: DeviceDto = {
    ...stored,
    id: "d7",
    holding: { note: "Máy mượn cho dự án", expiresOn: "2026-12-31" },
  };
  const heldNoExpiry: DeviceDto = { ...held, id: "d8", holding: { note: null, expiresOn: null } };

  it("Details column: maker over the serial; a dash when empty", () => {
    const html = render({ devices: [full] });
    expect(html).toContain(devicesCopy.columns.details);
    expect(html).toContain("Dell XPS");
    expect(html).toContain("SN: SN-123");
    expect(html.indexOf("Dell XPS")).toBeLessThan(html.indexOf("SN: SN-123"));
    expect(render({ devices: [base] })).toContain(devicesCopy.details.none);
  });

  it("owner cell shows Until, No expiry and the note with a title; none on an unowned row", () => {
    const html = render({ devices: [held, heldNoExpiry] });
    expect(html).toContain("Until 2026-12-31");
    expect(html).toContain("No expiry");
    expect(html).toContain('title="Máy mượn cho dự án"');
    expect(html).toContain("Máy mượn cho dự án");
    const plain = render({ devices: [base] });
    expect(plain).not.toContain("Until");
    expect(plain).not.toContain("No expiry");
  });

  it("an overdue row shows the Overdue chip and 'Expired on <date>'; overdue false shows neither", () => {
    const html = render({ devices: [{ ...held, overdue: true }] });
    // The filter chip also reads "Overdue"; the row chip adds one per layout (table and card).
    expect(html.split(devicesCopy.overdueChip)).toHaveLength(4);
    expect(html).toContain("Expired on 2026-12-31");
    expect(html).not.toContain("Until 2026-12-31");
    const plain = render({ devices: [held, heldNoExpiry] });
    expect(plain.split(devicesCopy.overdueChip)).toHaveLength(2);
    expect(plain).not.toContain("Expired on");
  });

  it("Assign and Note / expiry buttons follow the flags; neither when both are false", () => {
    const assignable: DeviceDto = { ...stored, id: "d9", owner: null, canAssign: true };
    const editable: DeviceDto = { ...held, canEditHolding: true };
    const actions = { onAssign: noop, onEditHolding: noop };
    const html = render({ actions, devices: [assignable, editable] });
    expect(html.match(/aria-label="Assign device INV-1"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Edit note and expiry of device INV-1"/g)).toHaveLength(2);
    expect(html).toContain(">Note / expiry<");
    const none = render({ actions, devices: [base] });
    expect(none).not.toContain("Assign device");
    expect(none).not.toContain("Note / expiry");
  });
});

describe("DevicesView pending transfer", () => {
  const pendingDevice: DeviceDto = {
    ...base,
    id: "d10",
    pendingHandoff: {
      id: "h1",
      kind: "transfer",
      to: { id: "m1", displayName: "Hương" },
      requestedBy: { id: "u1", displayName: "Nguyễn Thị Hà" },
      newExpiresOn: null,
      createdAt: "2026-11-25T00:00:00Z",
      canCancel: true,
    },
  };
  const actions = { onTransfer: noop, onCancelHandoff: noop };

  it("shows the chip and 'To Hương' in the table and the card, and keeps the owner", () => {
    const html = render({ devices: [pendingDevice], actions });
    expect(html.match(new RegExp(devicesCopy.pending.chip, "g"))).toHaveLength(2);
    expect(html.match(/To Hương/g)).toHaveLength(2);
    expect(html).toContain("Nguyễn Thị Hà");
  });
  it("Cancel transfer button with its aria-label when canCancel; none when false", () => {
    const html = render({ devices: [pendingDevice], actions });
    expect(html.match(/aria-label="Cancel transfer of device INV-1"/g)).toHaveLength(2);
    expect(html).not.toContain("Transfer device INV-1");
    const off = {
      ...pendingDevice,
      pendingHandoff: { ...pendingDevice.pendingHandoff!, canCancel: false },
    };
    expect(render({ devices: [off], actions })).not.toContain("Cancel transfer of device");
  });
  it("a Transfer button follows canTransfer", () => {
    const html = render({ devices: [{ ...base, canTransfer: true }], actions });
    expect(html.match(/aria-label="Transfer device INV-1"/g)).toHaveLength(2);
  });
  it("busyId disables the buttons of that row", () => {
    const html = render({ devices: [pendingDevice], actions, busyId: "d10" });
    expect(html.match(/<button[^>]*Cancel transfer of device[^>]*disabled=""/g)).toHaveLength(2);
  });
  it("notice region is always mounted; error tone has role=alert", () => {
    const none = render();
    expect(none).toContain('<div aria-live="polite"></div>');
    const status = render({ notice: { tone: "status", text: "Done ✓" } });
    expect(status).toMatch(/<p role="status"[^>]*>Done ✓<\/p>/);
    const err = render({ notice: { tone: "error", text: "Nope" } });
    expect(err).toMatch(/<p role="alert"[^>]*>Nope<\/p>/);
  });
});

describe("DevicesView name link", () => {
  it("device name links to /devices/<id> (table and mobile card)", () => {
    const html = render({ devices: [base] });
    expect(html.split('href="/devices/d1"').length - 1).toBe(2);
  });
});

describe("DevicesView tokens", () => {
  it("h1 uses the display style; the table shows from lg and the cards below it", () => {
    const html = render();
    expect(html).toMatch(/<h1[^>]*text-display/);
    expect(html).toContain("hidden lg:block");
    expect(html).toContain("lg:hidden");
    expect(html).not.toContain("md:block");
    expect(html).not.toContain("md:hidden");
    expect(html).toMatch(/<th[^>]*text-caption[^>]*uppercase/);
    expect(html).not.toContain("text-[");
  });

  it("the Overdue and pending states are toned pills", () => {
    const overdue = render({ devices: [{ ...base, mine: true, overdue: true }] });
    expect(overdue).toContain("bg-danger-tint");
    expect(overdue).not.toContain("--error-container");
    expect(render({ devices: [base] })).not.toContain("bg-danger-tint");
    const pending = render({
      devices: [
        {
          ...base,
          pendingHandoff: {
            id: "h1",
            kind: "transfer",
            to: { id: "m1", displayName: "Hương" },
            requestedBy: { id: "u1", displayName: "Hà" },
            newExpiresOn: null,
            createdAt: "2026-11-25T00:00:00Z",
            canCancel: true,
          },
        },
      ],
    });
    expect(pending).toContain("bg-warning-tint");
  });

  it("row action buttons are 44 px and wrap with gap-2", () => {
    const html = render({
      devices: [{ ...base, canEdit: true }],
      actions: { onEdit: noop },
    });
    expect(html).toContain("flex flex-wrap items-center gap-2");
    const edits = html.match(/<button[^>]*aria-label="Edit[^>]*>/g) ?? [];
    expect(edits.length).toBeGreaterThan(0);
    for (const b of edits) {
      expect(b).toContain("min-h-control");
    }
  });
});
