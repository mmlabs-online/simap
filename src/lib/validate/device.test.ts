import { describe, expect, it } from "vitest";
import {
  normalizeMac,
  parseDeviceQuery,
  validateDeviceCreate,
  validateDevicePatch,
  validatePlacementPut,
} from "./device";

const A = "50000000-0000-4000-8000-00000000000a";
const B = "50000000-0000-4000-8000-00000000000b";
const q = (s: string) => parseDeviceQuery(new URLSearchParams(s));

describe("parseDeviceQuery", () => {
  it("default all; placed; inventory; blank = all; unknown or repeated -> invalid; other keys ignored", () => {
    expect(q("")).toEqual({ ok: true, value: "all" });
    expect(q("placement=placed")).toEqual({ ok: true, value: "placed" });
    expect(q("placement=inventory")).toEqual({ ok: true, value: "inventory" });
    expect(q("placement=")).toEqual({ ok: true, value: "all" });
    expect(q("x=1")).toEqual({ ok: true, value: "all" });
    expect(q("placement=nope")).toEqual({ ok: false, field: "placement" });
    expect(q("placement=all&placement=placed")).toEqual({ ok: false, field: "placement" });
  });
});

describe("validatePlacementPut", () => {
  it("uuid or null seatId; role required with a seat; absent or secondary for inventory", () => {
    expect(validatePlacementPut({ seatId: A, role: "primary", expectedSeatId: null })).toEqual({
      ok: true,
      value: { seatId: A, role: "primary", expectedSeatId: null },
    });
    expect(validatePlacementPut({ seatId: A, role: "secondary", expectedSeatId: B })).toEqual({
      ok: true,
      value: { seatId: A, role: "secondary", expectedSeatId: B },
    });
    expect(validatePlacementPut({ seatId: null, expectedSeatId: A })).toEqual({
      ok: true,
      value: { seatId: null, role: "secondary", expectedSeatId: A },
    });
    expect(validatePlacementPut({ seatId: null, role: "secondary", expectedSeatId: A }).ok).toBe(
      true,
    );
    expect(validatePlacementPut({ seatId: A, expectedSeatId: null })).toEqual({
      ok: false,
      field: "role",
    });
    expect(validatePlacementPut({ seatId: A, role: "x", expectedSeatId: null }).ok).toBe(false);
  });

  it("primary with a null seat, non-canonical uuid, missing expectedSeatId, extra key, array/null body -> invalid", () => {
    expect(validatePlacementPut({ seatId: null, role: "primary", expectedSeatId: A })).toEqual({
      ok: false,
      field: "role",
    });
    expect(
      validatePlacementPut({ seatId: A.toUpperCase(), role: "primary", expectedSeatId: null }),
    ).toEqual({ ok: false, field: "seatId" });
    expect(validatePlacementPut({ seatId: A, role: "primary" })).toEqual({
      ok: false,
      field: "expectedSeatId",
    });
    expect(validatePlacementPut({ role: "primary", expectedSeatId: null })).toEqual({
      ok: false,
      field: "seatId",
    });
    expect(
      validatePlacementPut({ seatId: A, role: "primary", expectedSeatId: null, x: 1 }),
    ).toEqual({ ok: false, field: "x" });
    expect(validatePlacementPut([])).toEqual({ ok: false, field: "body" });
    expect(validatePlacementPut(null)).toEqual({ ok: false, field: "body" });
  });
});

const DB_MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;

describe("normalizeMac", () => {
  it("all accepted spellings -> lowercase colon form; trims; blank -> null; output matches the DB check", () => {
    for (const s of [
      "AA:BB:CC:DD:EE:FF",
      "aa-bb-cc-dd-ee-ff",
      "AaBb.CcDd.EeFf",
      "aabbccddeeff",
      "  AA-BB-CC-DD-EE-FF  ",
    ]) {
      const out = normalizeMac(s);
      expect(out).toBe("aa:bb:cc:dd:ee:ff");
      expect(out).toMatch(DB_MAC);
    }
    expect(normalizeMac("")).toBeNull();
    expect(normalizeMac("   ")).toBeNull();
    expect(normalizeMac(null)).toBeNull();
  });

  it("rejects mixed separators, wrong lengths, non-hex, inner spaces, Cisco 2-digit groups, non-strings", () => {
    for (const s of [
      "aa:bb-cc:dd:ee:ff",
      "aa:bb:cc:dd:ee",
      "aa:bb:cc:dd:ee:ff:00",
      "aabbccddeef",
      "aabbccddeeff0",
      "gg:bb:cc:dd:ee:ff",
      "aa:bb:cc: dd:ee:ff",
      "aa bb cc dd ee ff",
      "aa.bb.cc.dd.ee.ff",
    ]) {
      expect(normalizeMac(s)).toBeUndefined();
    }
    expect(normalizeMac(123)).toBeUndefined();
    expect(normalizeMac({})).toBeUndefined();
    expect(normalizeMac(undefined)).toBeUndefined();
  });
});

const base = { name: "Máy in tầng 3", type: "Printer", inventoryNumber: "INV-1" };

describe("validateDeviceCreate", () => {
  it("trims, keeps diacritics, defaults mac and ownerId to null", () => {
    expect(validateDeviceCreate({ ...base, name: "  Máy in tầng 3 " })).toEqual({
      ok: true,
      value: { ...base, mac: null, ownerId: null },
    });
    expect(validateDeviceCreate({ ...base, mac: "AA-BB-CC-DD-EE-FF", ownerId: A })).toEqual({
      ok: true,
      value: { ...base, mac: "aa:bb:cc:dd:ee:ff", ownerId: A },
    });
    expect(validateDeviceCreate({ ...base, mac: " " }).ok).toBe(true);
    expect(validateDeviceCreate({ ...base, mac: null }).ok).toBe(true);
  });

  it("enforces caps in code points", () => {
    expect(validateDeviceCreate({ ...base, name: "a".repeat(120) }).ok).toBe(true);
    expect(validateDeviceCreate({ ...base, name: "a".repeat(121) })).toEqual({
      ok: false,
      field: "name",
    });
    expect(validateDeviceCreate({ ...base, name: "😀".repeat(120) }).ok).toBe(true);
    expect(validateDeviceCreate({ ...base, type: "a".repeat(60) }).ok).toBe(true);
    expect(validateDeviceCreate({ ...base, type: "a".repeat(61) }).ok).toBe(false);
    expect(validateDeviceCreate({ ...base, inventoryNumber: "a".repeat(60) }).ok).toBe(true);
    expect(validateDeviceCreate({ ...base, inventoryNumber: "a".repeat(61) }).ok).toBe(false);
  });

  it("rejects blank, control or format characters, missing fields, bad ids, unknown keys, bad bodies", () => {
    expect(validateDeviceCreate({ ...base, name: "   " }).ok).toBe(false);
    for (const bad of ["a\nb", "a\tb", "a​b"]) {
      expect(validateDeviceCreate({ ...base, name: bad }).ok).toBe(false);
    }
    expect(validateDeviceCreate({ type: "x", inventoryNumber: "1" })).toEqual({
      ok: false,
      field: "name",
    });
    expect(validateDeviceCreate({ name: "x", inventoryNumber: "1" }).ok).toBe(false);
    expect(validateDeviceCreate({ name: "x", type: "x" }).ok).toBe(false);
    expect(validateDeviceCreate({ ...base, mac: "nope" })).toEqual({ ok: false, field: "mac" });
    expect(validateDeviceCreate({ ...base, ownerId: A.toUpperCase() })).toEqual({
      ok: false,
      field: "ownerId",
    });
    expect(validateDeviceCreate({ ...base, seatId: A })).toEqual({ ok: false, field: "seatId" });
    expect(validateDeviceCreate([])).toEqual({ ok: false, field: "body" });
    expect(validateDeviceCreate(null)).toEqual({ ok: false, field: "body" });
  });
});

describe("validateDevicePatch", () => {
  it("single field ok; mac null and blank clear it", () => {
    expect(validateDevicePatch({ name: " New " })).toEqual({ ok: true, value: { name: "New" } });
    expect(validateDevicePatch({ mac: null })).toEqual({ ok: true, value: { mac: null } });
    expect(validateDevicePatch({ mac: "" })).toEqual({ ok: true, value: { mac: null } });
    expect(validateDevicePatch({ mac: "AABB.CCDD.EEFF" })).toEqual({
      ok: true,
      value: { mac: "aa:bb:cc:dd:ee:ff" },
    });
  });

  it("empty body, ownerId, seatId, role, bad values -> invalid", () => {
    expect(validateDevicePatch({})).toEqual({ ok: false, field: "body" });
    expect(validateDevicePatch({ ownerId: A })).toEqual({ ok: false, field: "ownerId" });
    expect(validateDevicePatch({ name: "x", ownerId: A }).ok).toBe(false);
    expect(validateDevicePatch({ seatId: A }).ok).toBe(false);
    expect(validateDevicePatch({ role: "primary" }).ok).toBe(false);
    expect(validateDevicePatch({ name: "" }).ok).toBe(false);
    expect(validateDevicePatch({ type: 5 }).ok).toBe(false);
    expect(validateDevicePatch({ inventoryNumber: "a".repeat(61) }).ok).toBe(false);
    expect(validateDevicePatch({ mac: "zz" }).ok).toBe(false);
    expect(validateDevicePatch([]).ok).toBe(false);
  });
});
