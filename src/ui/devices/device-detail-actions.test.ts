import { describe, expect, it, vi } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { rowActions } from "./device-actions";
import {
  detailHandlers,
  doneNotice,
  finishAction,
  type DetailDialog,
  type Notice,
} from "./device-detail-actions";
import type { RefreshResult } from "./useDeviceDetail";

const dev = (p: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: "d1",
    name: "Máy trạm",
    inventoryNumber: "INV-1",
    owner: null,
    placement: null,
    mine: false,
    overdue: false,
    pendingHandoff: null,
    canEdit: false,
    canPlace: false,
    canDelete: false,
    canAssign: false,
    canEditHolding: false,
    canTransfer: false,
    canReturn: false,
    canTakeBack: false,
    ...p,
  }) as DeviceDto;

const keys = (d: DeviceDto) => rowActions(d, detailHandlers(vi.fn(), vi.fn())).map((a) => a.key);
const pending = (kind: string) =>
  ({ id: "h1", kind, canCancel: true }) as unknown as DeviceDto["pendingHandoff"];

describe("detailHandlers: flag table", () => {
  it("each flag alone gives exactly its button", () => {
    expect(keys(dev({ canTransfer: true }))).toEqual(["transfer"]);
    expect(keys(dev({ canReturn: true }))).toEqual(["giveBack"]);
    expect(keys(dev({ canAssign: true }))).toEqual(["assign"]);
    expect(keys(dev({ canEditHolding: true }))).toEqual(["editHolding"]);
    expect(keys(dev({ canTakeBack: true }))).toEqual(["takeBack"]);
    expect(keys(dev({ mine: true, overdue: true }))).toEqual(["extend"]);
  });

  it("place modes, no Edit/Delete, cancel hides Extend", () => {
    expect(keys(dev({ canPlace: true }))).toEqual(["place"]);
    const placed = { seatId: "s" } as DeviceDto["placement"];
    expect(keys(dev({ canPlace: true, placement: placed }))).toEqual(["move", "return"]);
    expect(keys(dev({ canEdit: true, canDelete: true }))).toEqual([]);
    expect(keys(dev())).toEqual([]);
    expect(keys(dev({ mine: true, overdue: true, pendingHandoff: pending("transfer") }))).toEqual([
      "cancelTransfer",
    ]);
    expect(keys(dev({ pendingHandoff: pending("return") }))).toEqual(["cancelReturn"]);
    expect(keys(dev({ pendingHandoff: pending("extension") }))).toEqual(["cancelExtension"]);
  });
});

describe("detailHandlers opens the matching dialog", () => {
  it("calls open/cancel with the right kind and mode", () => {
    const open = vi.fn();
    const cancel = vi.fn();
    const h = detailHandlers(open, cancel);
    const d = dev();
    h.onTransfer?.(d);
    h.onReturn?.(d);
    h.onExtend?.(d);
    h.onTakeBack?.(d);
    h.onPlace?.(d, "move");
    h.onAssign?.(d, "assign");
    h.onEditHolding?.(d, "edit");
    h.onCancelHandoff?.(d);
    expect(open.mock.calls.map((c) => c[0])).toEqual([
      { kind: "transfer", device: d },
      { kind: "return", device: d },
      { kind: "extend", device: d },
      { kind: "takeBack", device: d },
      { kind: "place", device: d, mode: "move" },
      { kind: "assign", device: d, mode: "assign" },
      { kind: "assign", device: d, mode: "edit" },
    ]);
    expect(cancel).toHaveBeenCalledWith(d);
    expect(h.onEdit).toBeUndefined();
    expect(h.onDelete).toBeUndefined();
  });
});

describe("doneNotice per action", () => {
  const d = dev();
  const text = (x: DetailDialog) => doneNotice(x).text;
  it("maps each dialog to its copy", () => {
    const [n, i] = ["Máy trạm", "INV-1"];
    expect(text({ kind: "transfer", device: d })).toBe(devicesCopy.transfer.sent(n, i));
    expect(text({ kind: "return", device: d })).toBe(devicesCopy.giveBack.sent(n, i));
    expect(text({ kind: "extend", device: d })).toBe(devicesCopy.extend.sent(n, i));
    expect(text({ kind: "takeBack", device: d })).toBe(devicesCopy.takeBack.done(n, i));
    expect(text({ kind: "assign", device: d, mode: "assign" })).toBe(
      devicesCopy.detail.done.assigned(n, i),
    );
    expect(text({ kind: "assign", device: d, mode: "edit" })).toBe(
      devicesCopy.detail.done.holdingSaved(n, i),
    );
    for (const mode of ["place", "move", "return"] as const) {
      expect(text({ kind: "place", device: d, mode })).toBe(
        devicesCopy.detail.done.placement(n, i),
      );
    }
    expect(doneNotice({ kind: "transfer", device: d }).tone).toBe("status");
  });
});

describe("finishAction", () => {
  const setup = (result: RefreshResult | null) => {
    const calls: string[] = [];
    const notices: (Notice | null)[] = [];
    const deps = {
      notice: { tone: "status", text: "ok" } as Notice | null,
      refresh:
        result === null
          ? null
          : async () => {
              calls.push("refresh");
              return result;
            },
      setNotice: (n: Notice | null) => {
        calls.push("setNotice");
        notices.push(n);
      },
      requestFocus: () => {
        calls.push("focus");
      },
    };
    return { calls, notices, deps };
  };

  it("sets the notice before refresh, then requests focus", async () => {
    const { calls, notices, deps } = setup({ ok: true });
    await finishAction(deps);
    expect(calls).toEqual(["setNotice", "refresh", "focus"]);
    expect(notices).toEqual([{ tone: "status", text: "ok" }]);
  });

  it("refresh failure replaces the notice with refreshFailed", async () => {
    const { notices, calls, deps } = setup({ ok: false, code: "unavailable" });
    await finishAction(deps);
    expect(notices.at(-1)).toEqual({ tone: "error", text: devicesCopy.detail.refreshFailed });
    expect(calls.at(-1)).toBe("focus");
  });

  it("refresh not_found clears the notice", async () => {
    const { notices, calls, deps } = setup({ ok: false, code: "not_found" });
    await finishAction(deps);
    expect(notices.at(-1)).toBeNull();
    expect(calls.at(-1)).toBe("focus");
  });

  it("without refresh keeps the notice and still requests focus", async () => {
    const { notices, calls, deps } = setup(null);
    await finishAction(deps);
    expect(calls).toEqual(["setNotice", "focus"]);
    expect(notices).toEqual([{ tone: "status", text: "ok" }]);
  });
});
