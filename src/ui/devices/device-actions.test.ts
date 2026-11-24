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
