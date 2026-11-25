import { describe, expect, it, vi } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { bannerHandlers, hasAnyAction, rowActions } from "./device-actions";

const d = (over: Partial<DeviceDto> = {}) =>
  ({ id: "d1", inventoryNumber: "INV-7", placement: null, canPlace: true, ...over }) as DeviceDto;
const placedDevice = d({
  placement: { seatId: "s", seatCode: "C", roomId: "r", roomCode: "C", role: "secondary" },
});

describe("rowActions", () => {
  it("no actions when canPlace is false", () => {
    expect(rowActions(d({ canPlace: false }), { onPlace: vi.fn() })).toEqual([]);
  });
  it("place for an unplaced device; move and return for a placed one", () => {
    const onPlace = vi.fn();
    const a = rowActions(d(), { onPlace });
    expect(a.map((x) => x.key)).toEqual(["place"]);
    a[0].run();
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }), "place");
    expect(rowActions(placedDevice, { onPlace }).map((x) => x.key)).toEqual(["move", "return"]);
  });
  it("aria-labels include the inventory number; no handler means no action", () => {
    const a = rowActions(placedDevice, { onPlace: vi.fn() });
    expect(a.map((x) => x.ariaLabel)).toEqual([
      "Move device INV-7",
      "Return device INV-7 to inventory",
    ]);
    expect(rowActions(d(), {})).toEqual([]);
  });
});

describe("hasAnyAction", () => {
  it("false when no row can place, true otherwise", () => {
    const h = { onPlace: vi.fn() };
    expect(hasAnyAction([d({ canPlace: false })], h)).toBe(false);
    expect(hasAnyAction([d({ canPlace: false }), d()], h)).toBe(true);
  });
});

describe("delete action", () => {
  it("Delete only when canDelete and onDelete; marked danger; after edit", () => {
    const onDelete = vi.fn();
    expect(rowActions(d({ canPlace: false, canDelete: true }), {})).toEqual([]);
    expect(rowActions(d({ canPlace: false, canEdit: true }), { onDelete })).toEqual([]);
    const row = d({ canEdit: true, canDelete: true });
    expect(
      rowActions(row, { onPlace: vi.fn(), onEdit: vi.fn(), onDelete }).map((x) => x.key),
    ).toEqual(["place", "edit", "delete"]);
    const a = rowActions(row, { onDelete });
    expect(a[0].danger).toBe(true);
    expect(a[0].ariaLabel).toBe("Delete device INV-7");
    a[0].run();
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });
  it("hasAnyAction is true for a canDelete-only row with onDelete", () => {
    expect(hasAnyAction([d({ canPlace: false, canDelete: true })], { onDelete: vi.fn() })).toBe(
      true,
    );
  });
});

describe("edit action", () => {
  it("Edit only when canEdit and onEdit", () => {
    const onEdit = vi.fn();
    expect(rowActions(d({ canPlace: false, canEdit: true }), {})).toEqual([]);
    expect(rowActions(d({ canPlace: false, canEdit: false }), { onEdit })).toEqual([]);
    const a = rowActions(d({ canPlace: false, canEdit: true }), { onEdit });
    expect(a.map((x) => x.key)).toEqual(["edit"]);
    expect(a[0].ariaLabel).toBe("Edit device INV-7");
    a[0].run();
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });
  it("place and edit actions are independent", () => {
    const row = d({ canEdit: true });
    expect(rowActions(row, { onEdit: vi.fn() }).map((x) => x.key)).toEqual(["edit"]);
    expect(rowActions(row, { onPlace: vi.fn(), onEdit: vi.fn() }).map((x) => x.key)).toEqual([
      "place",
      "edit",
    ]);
    expect(rowActions(row, {})).toEqual([]);
  });
  it("hasAnyAction is true for a canEdit-only row with onEdit", () => {
    expect(hasAnyAction([d({ canPlace: false, canEdit: true })], { onEdit: vi.fn() })).toBe(true);
  });
});

describe("assign and holding actions", () => {
  it("Assign only with canAssign and onAssign; listed first", () => {
    const onAssign = vi.fn();
    const row = d({ canAssign: true, canEdit: true });
    expect(rowActions(row, {})).toEqual([]);
    expect(rowActions(d({ canAssign: false }), { onAssign })).toEqual([]);
    const a = rowActions(row, { onAssign, onPlace: vi.fn(), onEdit: vi.fn() });
    expect(a.map((x) => x.key)).toEqual(["assign", "place", "edit"]);
    expect(a[0].label).toBe("Assign");
    expect(a[0].ariaLabel).toBe("Assign device INV-7");
    a[0].run();
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }), "assign");
  });
  it("Note / expiry only with canEditHolding and onEditHolding; listed first", () => {
    const onEditHolding = vi.fn();
    const row = d({ canEditHolding: true, canEdit: true, canPlace: false });
    expect(rowActions(row, {})).toEqual([]);
    expect(rowActions(d({ canEditHolding: false }), { onEditHolding })).toEqual([]);
    const a = rowActions(row, { onEditHolding, onEdit: vi.fn() });
    expect(a.map((x) => x.key)).toEqual(["editHolding", "edit"]);
    expect(a[0].label).toBe("Note / expiry");
    expect(a[0].ariaLabel).toBe("Edit note and expiry of device INV-7");
    a[0].run();
    expect(onEditHolding).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }), "edit");
  });
  it("hasAnyAction is true for a canAssign-only row", () => {
    expect(hasAnyAction([d({ canPlace: false, canAssign: true })], { onAssign: vi.fn() })).toBe(
      true,
    );
  });
});

describe("transfer actions", () => {
  const pending = (over: object = {}) => ({
    id: "h1",
    kind: "transfer" as const,
    to: { id: "m", displayName: "Hương" },
    requestedBy: { id: "u", displayName: "Hà" },
    newExpiresOn: null,
    createdAt: "2026-11-25T00:00:00Z",
    canCancel: true,
    ...over,
  });
  it("transfer is shown only with canTransfer and onTransfer, after place and before edit", () => {
    const onTransfer = vi.fn();
    const row = d({
      canTransfer: true,
      canEdit: true,
      canDelete: true,
      placement: placedDevice.placement,
    });
    expect(rowActions(row, {})).toEqual([]);
    expect(rowActions(d({ canTransfer: false }), { onTransfer })).toEqual([]);
    const a = rowActions(row, { onPlace: vi.fn(), onTransfer, onEdit: vi.fn(), onDelete: vi.fn() });
    expect(a.map((x) => x.key)).toEqual(["move", "return", "transfer", "edit", "delete"]);
    const t = a.find((x) => x.key === "transfer")!;
    expect(t.ariaLabel).toBe("Transfer device INV-7");
    t.run();
    expect(onTransfer).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });
  it("an org-inventory row (owner null, canTransfer false) has no transfer", () => {
    expect(
      rowActions(d({ owner: null, canTransfer: false, canPlace: false }), { onTransfer: vi.fn() }),
    ).toEqual([]);
  });
  it("cancelTransfer is first, gated by a transfer pendingHandoff with canCancel", () => {
    const onCancelHandoff = vi.fn();
    const row = d({ canPlace: true, pendingHandoff: pending() });
    const a = rowActions(row, { onPlace: vi.fn(), onCancelHandoff });
    expect(a.map((x) => x.key)).toEqual(["cancelTransfer", "place"]);
    expect(a[0].ariaLabel).toBe("Cancel transfer of device INV-7");
    expect(a[0].danger).toBeUndefined();
    a[0].run();
    expect(onCancelHandoff).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
    const no = (p: object) =>
      rowActions(d({ canPlace: false, pendingHandoff: pending(p) }), { onCancelHandoff });
    expect(no({ canCancel: false })).toEqual([]);
    expect(no({ kind: "extension", canCancel: false })).toEqual([]);
    expect(rowActions(d({ canPlace: false, pendingHandoff: null }), { onCancelHandoff })).toEqual(
      [],
    );
    expect(rowActions(d({ canPlace: false, pendingHandoff: pending() }), {})).toEqual([]);
  });
  it("busyId disables every action of that row only", () => {
    const h = { onPlace: vi.fn(), onCancelHandoff: vi.fn() };
    const row = d({ pendingHandoff: pending() });
    expect(rowActions(row, h, "d1").every((x) => x.disabled === true)).toBe(true);
    expect(rowActions(row, h, "d1").length).toBe(2);
    expect(rowActions(row, h, "other").some((x) => x.disabled)).toBe(false);
    expect(rowActions(row, h).some((x) => x.disabled)).toBe(false);
  });
});

describe("return and take-back actions", () => {
  const pending = (over: object = {}) => ({
    id: "h1",
    kind: "transfer" as const,
    to: { id: "m", displayName: "Hương" },
    requestedBy: { id: "u", displayName: "Hà" },
    newExpiresOn: null,
    createdAt: "2026-11-25T00:00:00Z",
    canCancel: true,
    ...over,
  });
  const owned = (over: Partial<DeviceDto> = {}) =>
    d({
      owner: { id: "m1", displayName: "Nguyễn Thị Hà" },
      canPlace: false,
      canReturn: true,
      canTakeBack: true,
      ...over,
    });
  it("giveBack only when canReturn and onReturn is given; placed after transfer", () => {
    const onReturn = vi.fn();
    expect(rowActions(owned(), {}).map((x) => x.key)).toEqual([]);
    expect(rowActions(owned({ canReturn: false }), { onReturn })).toEqual([]);
    const h = { onReturn, onTransfer: vi.fn(), onEdit: vi.fn() };
    const row = owned({ canTransfer: true, canEdit: true });
    const a = rowActions(row, h);
    expect(a.map((x) => x.key)).toEqual(["transfer", "giveBack", "edit"]);
    a[1].run();
    expect(onReturn).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
  });
  it("cancelReturn for a pending return with canCancel; cancelTransfer for a transfer; none without canCancel; extension -> cancelExtension", () => {
    const onCancelHandoff = vi.fn();
    const p = (over: object) =>
      owned({
        canReturn: false,
        canTakeBack: false,
        pendingHandoff: pending(over),
      });
    expect(rowActions(p({ kind: "return" }), { onCancelHandoff }).map((x) => x.key)).toEqual([
      "cancelReturn",
    ]);
    expect(rowActions(p({ kind: "transfer" }), { onCancelHandoff }).map((x) => x.key)).toEqual([
      "cancelTransfer",
    ]);
    expect(rowActions(p({ kind: "return", canCancel: false }), { onCancelHandoff })).toEqual([]);
    const ext = rowActions(p({ kind: "extension" }), { onCancelHandoff });
    expect(ext.map((x) => x.key)).toEqual(["cancelExtension"]);
    expect(ext[0].label).toBe("Cancel extension");
    expect(ext[0].ariaLabel).toBe("Cancel extension of device INV-7");
    expect(rowActions(p({ kind: "extension", canCancel: false }), { onCancelHandoff })).toEqual([]);
  });
  it("extend: mine && overdue && no pending -> extend; otherwise none; busyId disables it", () => {
    const onExtend = vi.fn();
    const row = owned({ canReturn: false, canTakeBack: false, mine: true, overdue: true });
    const a = rowActions(row, { onExtend });
    expect(a.map((x) => x.key)).toEqual(["extend"]);
    expect(a[0].ariaLabel).toBe("Request an extension for device INV-7");
    a[0].run();
    expect(onExtend).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
    expect(rowActions({ ...row, mine: false }, { onExtend })).toEqual([]);
    expect(rowActions({ ...row, overdue: false }, { onExtend })).toEqual([]);
    expect(
      rowActions({ ...row, pendingHandoff: pending({ kind: "extension" }) }, { onExtend }),
    ).toEqual([]);
    expect(rowActions(row, {})).toEqual([]);
    expect(rowActions(row, { onExtend }, "d1")[0].disabled).toBe(true);
  });
  it("takeBack when canTakeBack (danger), also with a pending transfer alongside cancelTransfer; absent when canTakeBack is false", () => {
    const onTakeBack = vi.fn();
    const onCancelHandoff = vi.fn();
    const a = rowActions(owned({ canReturn: false }), { onTakeBack });
    expect(a.map((x) => x.key)).toEqual(["takeBack"]);
    expect(a[0].danger).toBe(true);
    a[0].run();
    expect(onTakeBack).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
    const both = rowActions(owned({ canReturn: false, pendingHandoff: pending() }), {
      onTakeBack,
      onCancelHandoff,
    });
    expect(both.map((x) => x.key)).toEqual(["cancelTransfer", "takeBack"]);
    expect(rowActions(owned({ canTakeBack: false }), { onTakeBack })).toEqual([]);
  });
  it("takeBack aria names the owner; giveBack label differs from the place-mode Return label", () => {
    const row = owned({ canPlace: true, placement: placedDevice.placement });
    const a = rowActions(row, { onPlace: vi.fn(), onReturn: vi.fn(), onTakeBack: vi.fn() });
    expect(a.find((x) => x.key === "takeBack")!.ariaLabel).toBe(
      "Take device INV-7 back from Nguyễn Thị Hà",
    );
    const giveBack = a.find((x) => x.key === "giveBack")!;
    const placeReturn = a.find((x) => x.key === "return")!;
    expect(giveBack.label).not.toBe(placeReturn.label);
    expect(giveBack.ariaLabel).not.toBe(placeReturn.ariaLabel);
  });
  it("busyId disables the new actions too", () => {
    const row = owned({ pendingHandoff: pending({ kind: "return" }) });
    const a = rowActions(
      row,
      { onReturn: vi.fn(), onTakeBack: vi.fn(), onCancelHandoff: vi.fn() },
      "d1",
    );
    expect(a.length).toBe(3);
    expect(a.every((x) => x.disabled === true)).toBe(true);
  });
});

describe("bannerHandlers", () => {
  it("keeps only onExtend, onReturn and onCancelHandoff from the full handler set", () => {
    const fn = vi.fn();
    const full = {
      onAssign: fn,
      onEditHolding: fn,
      onPlace: fn,
      onEdit: fn,
      onDelete: fn,
      onTransfer: fn,
      onCancelHandoff: fn,
      onReturn: fn,
      onExtend: fn,
      onTakeBack: fn,
    };
    expect(Object.keys(bannerHandlers(full)).sort()).toEqual(
      ["onCancelHandoff", "onExtend", "onReturn"].sort(),
    );
    const row = d({ mine: true, overdue: true, canReturn: true } as Partial<DeviceDto>);
    const allowed = ["extend", "giveBack", "cancelTransfer", "cancelExtension"];
    const keys = rowActions(row, bannerHandlers(full)).map((a) => a.key);
    expect(keys).toContain("extend");
    expect(keys.every((k) => allowed.includes(k))).toBe(true);
    expect(rowActions(row, full).length).toBeGreaterThan(keys.length);
  });
});
