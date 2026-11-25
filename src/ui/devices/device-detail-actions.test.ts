import { describe, expect, it, vi } from "vitest";
import type { DeviceDto, HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { rowActions } from "./device-actions";
import {
  afterRefresh,
  detailCancelOutcome,
  detailHandlers,
  dialogFor,
  doneNotice,
  refreshOk,
  type DetailDialog,
} from "./device-detail-actions";
import { cancelOutcome } from "./transfer-device";

const device = {
  id: "d1",
  name: "Máy trạm",
  inventoryNumber: "INV-1",
  owner: { id: "u1", displayName: "Hà" },
  placement: { seatId: "s1", seatCode: "C-01", roomId: "r1", roomCode: "C", role: "primary" },
  mine: true,
  overdue: true,
  canEdit: true,
  canPlace: true,
  canDelete: true,
  canAssign: true,
  canEditHolding: true,
  canTransfer: true,
  canReturn: true,
  canTakeBack: true,
  pendingHandoff: null,
} as unknown as DeviceDto;
const plain = {
  ...device,
  mine: false,
  overdue: false,
  canEdit: false,
  canPlace: false,
  canDelete: false,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  canReturn: false,
  canTakeBack: false,
  placement: null,
} as DeviceDto;
const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (code: string) => ({ ok: false as const, code });
const { name, inventoryNumber: inv } = device;

describe("detailHandlers", () => {
  it("has the 8 handlers and no onEdit/onDelete", () => {
    const h = detailHandlers(vi.fn(), vi.fn());
    expect(Object.keys(h).sort()).toEqual(
      [
        "onAssign",
        "onCancelHandoff",
        "onEditHolding",
        "onExtend",
        "onPlace",
        "onReturn",
        "onTakeBack",
        "onTransfer",
      ].sort(),
    );
  });

  it("rowActions on a device with every flag true lists no Edit/Delete; a plain viewer has none", () => {
    const h = detailHandlers(vi.fn(), vi.fn());
    const keys = rowActions(device, h).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["transfer", "giveBack", "takeBack", "assign"]));
    expect(keys).not.toContain("edit");
    expect(keys).not.toContain("delete");
    expect(rowActions(plain, h)).toEqual([]);
  });

  it("each handler opens its dialog kind with the device (and mode); cancel calls onCancel", () => {
    const open = vi.fn();
    const cancel = vi.fn();
    const h = detailHandlers(open, cancel);
    h.onTransfer?.(device);
    h.onReturn?.(device);
    h.onExtend?.(device);
    h.onTakeBack?.(device);
    h.onAssign?.(device, "assign");
    h.onEditHolding?.(device, "edit");
    h.onPlace?.(device, "move");
    expect(open.mock.calls.map((c) => c[0])).toEqual([
      { kind: "transfer", device },
      { kind: "return", device },
      { kind: "extend", device },
      { kind: "takeBack", device },
      { kind: "assign", device, mode: "assign" },
      { kind: "assign", device, mode: "edit" },
      { kind: "place", device, mode: "move" },
    ]);
    h.onCancelHandoff?.(device);
    expect(cancel).toHaveBeenCalledWith(device);
    expect(open).toHaveBeenCalledTimes(7);
  });
});

describe("dialogFor", () => {
  it("returns the device only for the matching kind", () => {
    const slot: DetailDialog = { kind: "transfer", device };
    expect(dialogFor(slot, "transfer")).toBe(device);
    expect(dialogFor(slot, "return")).toBeNull();
    expect(dialogFor(null, "transfer")).toBeNull();
  });
});

describe("doneNotice", () => {
  it("maps every kind to its copy, tone status, Vietnamese name kept", () => {
    const text = (d: DetailDialog) => doneNotice(d);
    expect(text({ kind: "transfer", device })).toEqual({
      tone: "status",
      text: devicesCopy.transfer.sent(name, inv),
    });
    expect(text({ kind: "return", device }).text).toBe(devicesCopy.giveBack.sent(name, inv));
    expect(text({ kind: "extend", device }).text).toBe(devicesCopy.extend.sent(name, inv));
    const back = text({ kind: "takeBack", device }).text;
    expect(back).toBe(devicesCopy.takeBack.done(name, inv));
    expect(back).not.toContain(devicesCopy.returns.filterHint);
    const d = devicesCopy.detail.done;
    expect(text({ kind: "assign", device, mode: "assign" }).text).toBe(d.assigned(name, inv));
    expect(text({ kind: "assign", device, mode: "edit" }).text).toBe(d.holdingSaved(name, inv));
    expect(text({ kind: "place", device, mode: "place" }).text).toBe(d.placed(name, inv));
    expect(text({ kind: "place", device, mode: "move" }).text).toBe(d.moved(name, inv));
    expect(text({ kind: "place", device, mode: "return" }).text).toBe(
      d.returnedToInventory(name, inv),
    );
    expect(text({ kind: "place", device, mode: "move" }).text).toContain("Máy trạm");
  });
});

describe("detailCancelOutcome", () => {
  const handoff = ok({ id: "h1" } as HandoffDto);
  it("ok = cancelOutcome; gone codes use the detail wording; others pass through", () => {
    expect(detailCancelOutcome(handoff, device, "transfer")).toEqual(
      cancelOutcome(handoff, device, "transfer"),
    );
    for (const code of ["handoff_not_pending", "not_found"]) {
      expect(detailCancelOutcome(fail(code), device, "return")).toEqual({
        refresh: true,
        notice: { tone: "status", text: devicesCopy.detail.done.handoffGone },
      });
    }
    expect(detailCancelOutcome(fail("unavailable"), device, "transfer")).toEqual({
      refresh: false,
      notice: { tone: "error", text: apiErrorMessage("unavailable") },
    });
    expect(detailCancelOutcome(fail("not_allowed"), device, "transfer")).toEqual(
      cancelOutcome(fail("not_allowed"), device, "transfer"),
    );
  });
});

describe("refreshOk / afterRefresh", () => {
  it("refreshOk: both ok or detail not_found is true; any other failure false", () => {
    expect(refreshOk(ok(1), ok(1))).toBe(true);
    expect(refreshOk(fail("not_found"), fail("internal"))).toBe(true);
    expect(refreshOk(fail("internal"), ok(1))).toBe(false);
    expect(refreshOk(ok(1), fail("internal"))).toBe(false);
  });

  it("afterRefresh: ok keeps the notice; failed adds refreshFailed as an error", () => {
    const failed = devicesCopy.detail.done.refreshFailed;
    const status = { tone: "status" as const, text: "Done." };
    expect(afterRefresh(status, true)).toBe(status);
    expect(afterRefresh(status, false)).toEqual({ tone: "error", text: `Done. ${failed}` });
    expect(afterRefresh({ tone: "error", text: "Bad." }, false)).toEqual({
      tone: "error",
      text: `Bad. ${failed}`,
    });
    expect(afterRefresh(null, false)).toEqual({ tone: "error", text: failed });
  });
});
