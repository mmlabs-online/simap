import { describe, expect, it } from "vitest";
import { REGISTRY } from "./registry";
import { DEVICE_SPRITE_FAMILIES, deviceFrameKey, deviceSpriteAllowed } from "./device-sprites";
import type { Direction } from "./types";

const DIRS: Direction[] = ["n", "e", "s", "w"];

describe("device sprite families", () => {
  it("families are the device group bases", () => {
    expect(DEVICE_SPRITE_FAMILIES).toEqual([
      "device.laptop",
      "device.monitor",
      "device.monitor.dual",
      "device.other",
      "device.pc",
      "device.phone",
    ]);
    for (const f of DEVICE_SPRITE_FAMILIES) {
      for (const d of DIRS) {
        const key = deviceFrameKey(f, d)!;
        expect(REGISTRY[key], `${f} ${d}`).toBeDefined();
        expect(REGISTRY[key]!.tiles === null || REGISTRY[key]!.tiles!.join() === "1,1").toBe(true);
      }
    }
  });

  it("deviceSpriteAllowed", () => {
    for (const f of DEVICE_SPRITE_FAMILIES) expect(deviceSpriteAllowed(f)).toBe(true);
    for (const k of ["device.laptop.s", "plant.large", "", "device", "device.printer"]) {
      expect(deviceSpriteAllowed(k), k).toBe(false);
    }
  });

  it("deviceFrameKey", () => {
    expect(deviceFrameKey("device.laptop", "e")).toBe("device.laptop.e");
    expect(deviceFrameKey("device.pc", "n")).toBe("device.pc");
    expect(deviceFrameKey("device.monitor.dual", "w")).toBe("device.monitor.dual");
    expect(deviceFrameKey("device.printer", "s")).toBeNull();
  });
});
