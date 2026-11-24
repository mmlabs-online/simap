import { describe, expect, it } from "vitest";
import {
  validateDeviceTypeCreate as create,
  validateDeviceTypePatch as patch,
} from "./device-type";

describe("validateDeviceTypeCreate", () => {
  it("valid; NFC; spaces collapsed; NBSP collapsed", () => {
    expect(create({ name: "PC", slot: "pc" })).toEqual({
      ok: true,
      value: { name: "PC", slot: "pc" },
    });
    expect(create({ name: "  Máy   in  ", slot: "other" })).toMatchObject({
      value: { name: "Máy in" },
    });
    expect(create({ name: "Máy", slot: "other" })).toMatchObject({ value: { name: "Máy" } });
    expect(create({ name: "IP  phone", slot: "phone" })).toMatchObject({
      value: { name: "IP phone" },
    });
  });

  it("rejects empty, blank, too long, control, zero-width, non-string, extra key, missing or bad slot", () => {
    const bad = (b: unknown) => expect(create(b).ok).toBe(false);
    bad({ name: "", slot: "pc" });
    bad({ name: "   ", slot: "pc" });
    bad({ name: "a".repeat(61), slot: "pc" });
    bad({ name: "a\u0007b", slot: "pc" });
    bad({ name: "a​b", slot: "pc" });
    bad({ name: 5, slot: "pc" });
    bad({ name: null, slot: "pc" });
    bad({ name: "x", slot: "pc", extra: 1 });
    bad({ name: "x" });
    bad({ name: "x", slot: "printer" });
    bad({ name: "x", slot: "PC" });
    bad(null);
    bad([]);
  });

  it("counts code points: 60 Vietnamese characters are ok, 61 are not", () => {
    expect(create({ name: "ế".repeat(60), slot: "pc" }).ok).toBe(true);
    expect(create({ name: "ế".repeat(61), slot: "pc" }).ok).toBe(false);
    expect(create({ name: "😀".repeat(60), slot: "pc" }).ok).toBe(true);
  });
});

describe("validateDeviceTypePatch", () => {
  it("accepts name, slot or both; rejects {}, extra keys and null name", () => {
    expect(patch({ name: " Máy  in " })).toEqual({ ok: true, value: { name: "Máy in" } });
    expect(patch({ slot: "laptop" })).toEqual({ ok: true, value: { slot: "laptop" } });
    expect(patch({ name: "X", slot: "pc" })).toEqual({
      ok: true,
      value: { name: "X", slot: "pc" },
    });
    expect(patch({}).ok).toBe(false);
    expect(patch({ name: "X", image: 1 }).ok).toBe(false);
    expect(patch({ name: null }).ok).toBe(false);
    expect(patch({ slot: "nope" }).ok).toBe(false);
    expect(patch("x").ok).toBe(false);
  });
});
