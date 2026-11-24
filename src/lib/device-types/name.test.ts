import { describe, expect, it } from "vitest";
import { DEVICE_SPRITE } from "@/lib/sprites/device-slots";
import { VI_LOWER, VI_UPPER, deviceTypeKey } from "./name";
import { DEVICE_KINDS, SEED_DEVICE_TYPES } from "./types";

describe("deviceTypeKey", () => {
  it("trims, collapses ASCII whitespace, lowercases ASCII", () => {
    expect(deviceTypeKey("  IP \t PHONE ")).toBe("ip phone");
  });

  it("VI capitals fold", () => {
    expect(deviceTypeKey("MÁY IN")).toBe(deviceTypeKey("máy in"));
    expect(deviceTypeKey("ĐIỆN THOẠI")).toBe("điện thoại");
    expect(deviceTypeKey("Ơ")).toBe("ơ");
    expect(deviceTypeKey("Ư")).toBe("ư");
  });

  it("diacritics are not stripped", () => {
    expect(deviceTypeKey("May")).not.toBe(deviceTypeKey("Máy"));
  });
});

describe("VI map", () => {
  it("VI_UPPER/VI_LOWER: same length, 67 chars, each pair lowercases, no duplicates", () => {
    const up = [...VI_UPPER];
    const low = [...VI_LOWER];
    expect(up).toHaveLength(67);
    expect(low).toHaveLength(67);
    expect(new Set(up).size).toBe(67);
    up.forEach((c, i) => expect(c.toLowerCase()).toBe(low[i]));
  });
});

describe("catalog constants", () => {
  it("SEED_DEVICE_TYPES keys are distinct and every slot is in DEVICE_KINDS", () => {
    const keys = SEED_DEVICE_TYPES.map((t) => deviceTypeKey(t.name));
    expect(new Set(keys).size).toBe(SEED_DEVICE_TYPES.length);
    for (const t of SEED_DEVICE_TYPES) expect(DEVICE_KINDS).toContain(t.slot);
  });

  it("DEVICE_KINDS equals Object.keys(DEVICE_SPRITE)", () => {
    expect([...DEVICE_KINDS].sort()).toEqual(Object.keys(DEVICE_SPRITE).sort());
  });
});
