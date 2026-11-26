import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import {
  effectiveType,
  filterDevices,
  tileValue,
  typeIcon,
  typeSummary,
} from "./my-devices-filter";

const d = (n: number, over: Partial<DeviceDto> = {}): DeviceDto =>
  ({
    id: `d${n}`,
    name: `Device ${n}`,
    type: "PC",
    inventoryNumber: `INV-${n}`,
    mac: null,
    ...over,
  }) as DeviceDto;

describe("typeSummary", () => {
  it("groups by type key, first-seen trimmed label, count desc then key; [] for none", () => {
    const s = typeSummary([
      d(1, { type: "Monitor" }),
      d(2, { type: "PC" }),
      d(3, { type: "monitor" }),
      d(4, { type: " Monitor " }),
      d(5, { type: "Laptop" }),
    ]);
    expect(s).toEqual([
      { key: "monitor", label: "Monitor", count: 3 },
      { key: "laptop", label: "Laptop", count: 1 },
      { key: "pc", label: "PC", count: 1 },
    ]);
    expect(typeSummary([])).toEqual([]);
  });
  it('keeps "Máy in" and "May in" apart', () => {
    expect(typeSummary([d(1, { type: "Máy in" }), d(2, { type: "May in" })])).toHaveLength(2);
  });
});

describe("filterDevices", () => {
  const list = [
    d(1, { name: "Máy Đỗ 1", mac: "aa:bb:cc:dd:ee:ff" }),
    d(2, { type: "Monitor" }),
    d(3, { type: "Monitor", name: "Screen" }),
  ];
  const ids = (x: DeviceDto[]) => x.map((v) => v.id);
  it("empty or whitespace query and no type returns all in order", () => {
    expect(ids(filterDevices(list, "", ""))).toEqual(["d1", "d2", "d3"]);
    expect(ids(filterDevices(list, "   ", ""))).toEqual(["d1", "d2", "d3"]);
  });
  it("ignores case and diacritics", () => {
    for (const q of ["may do", "MÁY ĐỖ", "Máy Đõ 1"]) {
      expect(ids(filterDevices(list, q, ""))).toEqual(["d1"]);
    }
  });
  it("matches inventory number and MAC with or without separators; null mac never matches", () => {
    expect(ids(filterDevices(list, "inv-2", ""))).toEqual(["d2"]);
    for (const q of ["AA:BB", "aabb", "aa-bb"])
      expect(ids(filterDevices(list, q, ""))).toEqual(["d1"]);
    expect(ids(filterDevices(list, "ee:ff", ""))).toEqual(["d1"]);
  });
  it("type filters exactly, combines with query, no match gives []", () => {
    expect(ids(filterDevices(list, "", "monitor"))).toEqual(["d2", "d3"]);
    expect(ids(filterDevices(list, "screen", "monitor"))).toEqual(["d3"]);
    expect(filterDevices(list, "screen", "pc")).toEqual([]);
  });
});

describe("effectiveType, tileValue, typeIcon", () => {
  const opts = [{ key: "pc", label: "PC", count: 1 }];
  it("effectiveType", () => {
    expect(effectiveType(opts, "pc")).toBe("pc");
    expect(effectiveType(opts, "monitor")).toBe("");
  });
  it("tileValue", () => {
    const f = (n: number) => `${n}+`;
    expect(tileValue(5, false, f)).toBe("5");
    expect(tileValue(50, true, f)).toBe("50+");
  });
  it("typeIcon", () => {
    expect(typeIcon("Monitor")).toBe("desktop_windows");
    expect(typeIcon("monitor")).toBe("desktop_windows");
    for (const t of ["PC", "Laptop", "Máy in"]) expect(typeIcon(t)).toBe("grid_view");
  });
});
