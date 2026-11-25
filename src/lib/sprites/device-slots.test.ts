import { describe, expect, it } from "vitest";
import {
  MAX_PER_KIND,
  SLOTS,
  STACK,
  deviceKind,
  placeDevices,
  resolveDeviceArt,
  type DevicePlacement,
} from "./device-slots";
import type { SeatDeviceType } from "./layout";
import type { Direction } from "./types";

const DIRS: Direction[] = ["s", "e", "n", "w"];
const footprint = (dir: Direction): [number, number] =>
  dir === "s" || dir === "n" ? [2, 1] : [1, 2];
const RIGHT: Record<Direction, [number, number]> = { s: [1, 0], n: [-1, 0], e: [0, -1], w: [0, 1] };
const DESK = { x: 4, y: 3 };
const place = (dir: Direction, types: string[]) => placeDevices(DESK, footprint(dir), dir, types);
const screen = (p: DevicePlacement) => [p.x * 32 + p.offset[0], p.y * 32 + p.offset[1]];
const alongRight = (dir: Direction, p: DevicePlacement) =>
  screen(p)[0] * RIGHT[dir][0] + screen(p)[1] * RIGHT[dir][1];
const insideDesk = (dir: Direction, p: DevicePlacement) => {
  const [w, d] = footprint(dir);
  return p.x >= DESK.x && p.x < DESK.x + w && p.y >= DESK.y && p.y < DESK.y + d;
};

describe("deviceKind", () => {
  it("maps D37 types case- and space-insensitively; anything else is other", () => {
    expect(deviceKind("PC")).toBe("pc");
    expect(deviceKind(" pc ")).toBe("pc");
    expect(deviceKind("Laptop")).toBe("laptop");
    expect(deviceKind("MONITOR")).toBe("monitor");
    expect(deviceKind("IP phone")).toBe("phone");
    expect(deviceKind("ip  Phone")).toBe("phone");
    for (const other of ["Printer", "Headset", "Màn hình", "", "constructor", "__proto__"]) {
      expect(deviceKind(other), other).toBe("other");
    }
  });
});

describe("placeDevices", () => {
  it("0 devices gives an empty list", () => {
    expect(place("s", [])).toEqual([]);
  });

  it("one of every kind: distinct positions inside the desk footprint, all 4 rotations", () => {
    for (const dir of DIRS) {
      const list = place(dir, [
        "monitor",
        "monitor",
        "laptop",
        "laptop",
        "pc",
        "pc",
        "ip phone",
        "ip phone",
        "printer",
        "printer",
      ]);
      expect(list).toHaveLength(10);
      for (const p of list) expect(insideDesk(dir, p), `${dir} ${p.key}`).toBe(true);
      expect(new Set(list.map((p) => screen(p).join())).size, dir).toBe(10);
    }
  });

  it("directional kinds follow the desk, the others use a plain key", () => {
    for (const dir of DIRS) {
      const keys = place(dir, ["Monitor", "Laptop", "PC", "IP phone", "Printer"]).map((p) => p.key);
      expect(keys).toEqual([
        `device.monitor.${dir}`,
        `device.laptop.${dir}`,
        "device.pc",
        "device.phone",
        "device.other",
      ]);
    }
  });

  it("monitor 1 is on the occupant's right of monitor 2, all 4 rotations", () => {
    for (const dir of DIRS) {
      const [m1, m2] = place(dir, ["Monitor", "Monitor"]);
      expect(alongRight(dir, m1)).toBeGreaterThan(alongRight(dir, m2));
    }
  });

  it("only pc is under; first pc slot differs from second", () => {
    const list = place("s", ["Monitor", "Laptop", "PC", "PC", "IP phone", "Printer"]);
    expect(list.filter((p) => p.under).map((p) => p.kind)).toEqual(["pc", "pc"]);
    expect(screen(list[2])).not.toEqual(screen(list[3]));
  });

  it("overflow: the 3rd monitor reuses slot 2 with one stack step; at most 4 per kind", () => {
    const list = place("s", ["Monitor", "Monitor", "Monitor", "Monitor", "Monitor"]);
    expect(list).toHaveLength(MAX_PER_KIND);
    const last = SLOTS.monitor[1];
    expect(list[2].offset).toEqual([last.du + STACK[0], -last.dv + STACK[1]]);
    expect(list[3].offset).toEqual([last.du + 2 * STACK[0], -last.dv + 2 * STACK[1]]);
    expect(list[2].x).toBe(list[1].x);
  });
});

describe("resolveDeviceArt", () => {
  const t = (over: Partial<SeatDeviceType> = {}): SeatDeviceType => ({
    id: "t1",
    slot: "phone",
    hasImage: true,
    imageVersion: 3,
    ...over,
  });
  const ready = () => true;
  const notReady = () => false;

  it("catalog image ready: image art at the type's slot", () => {
    expect(resolveDeviceArt({ type: "Headset", deviceType: t() }, ready)).toEqual({
      kind: "phone",
      art: { type: "image", typeId: "t1", version: 3 },
    });
  });

  it("image not ready (loading or failed): placeholder at the type's slot", () => {
    expect(resolveDeviceArt({ type: "Headset", deviceType: t() }, notReady)).toEqual({
      kind: "phone",
      art: { type: "placeholder" },
    });
  });

  it("no image: built-in sprite of the slot", () => {
    expect(
      resolveDeviceArt({ type: "PC", deviceType: t({ slot: "pc", hasImage: false }) }, ready),
    ).toEqual({ kind: "pc", art: { type: "sprite" } });
  });

  it("deviceType null: device.other placeholder in the other slot", () => {
    expect(resolveDeviceArt({ type: "PC", deviceType: null }, ready)).toEqual({
      kind: "other",
      art: { type: "placeholder" },
    });
  });

  it("deviceType undefined keeps the name-based kind", () => {
    expect(resolveDeviceArt({ type: " laptop " }, ready)).toEqual({
      kind: "laptop",
      art: { type: "sprite" },
    });
  });

  it("placeholder art draws device.other at the kind's slot", () => {
    const [p] = placeDevices(DESK, [2, 1], "s", [{ kind: "phone", art: { type: "placeholder" } }]);
    expect(p.key).toBe("device.other");
    expect(p.kind).toBe("phone");
    expect(p.offset).toEqual([SLOTS.phone[0].du, -SLOTS.phone[0].dv]);
  });
});
