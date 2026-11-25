import { describe, expect, it, vi } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { hasAnyAction, rowActions } from "./device-actions";

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
    const onCancelTransfer = vi.fn();
    const row = d({ canPlace: true, pendingHandoff: pending() });
    const a = rowActions(row, { onPlace: vi.fn(), onCancelTransfer });
    expect(a.map((x) => x.key)).toEqual(["cancelTransfer", "place"]);
    expect(a[0].ariaLabel).toBe("Cancel transfer of device INV-7");
    expect(a[0].danger).toBeUndefined();
    a[0].run();
    expect(onCancelTransfer).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
    const no = (p: object) =>
      rowActions(d({ canPlace: false, pendingHandoff: pending(p) }), { onCancelTransfer });
    expect(no({ canCancel: false })).toEqual([]);
    expect(no({ kind: "return" })).toEqual([]);
    expect(rowActions(d({ canPlace: false, pendingHandoff: null }), { onCancelTransfer })).toEqual(
      [],
    );
    expect(rowActions(d({ canPlace: false, pendingHandoff: pending() }), {})).toEqual([]);
  });
  it("busyId disables every action of that row only", () => {
    const h = { onPlace: vi.fn(), onCancelTransfer: vi.fn() };
    const row = d({ pendingHandoff: pending() });
    expect(rowActions(row, h, "d1").every((x) => x.disabled === true)).toBe(true);
    expect(rowActions(row, h, "d1").length).toBe(2);
    expect(rowActions(row, h, "other").some((x) => x.disabled)).toBe(false);
    expect(rowActions(row, h).some((x) => x.disabled)).toBe(false);
  });
});
