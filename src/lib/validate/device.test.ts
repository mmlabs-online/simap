import { describe, expect, it } from "vitest";
import {
  normalizeMac,
  parseDeviceQuery,
  validateDeviceCreate,
  validateAssign,
  validateDevicePatch,
  validateHandoffBox,
  validateHandoffStart,
  validateHoldingPatch,
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
    expect(q("placement=unowned")).toEqual({ ok: true, value: "unowned" });
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
  it("trims, keeps diacritics, defaults mac to null", () => {
    expect(validateDeviceCreate({ ...base, name: "  Máy in tầng 3 " })).toEqual({
      ok: true,
      value: { ...base, mac: null, serial: null, manufacturer: null, brand: null },
    });
    expect(validateDeviceCreate({ ...base, mac: "AA-BB-CC-DD-EE-FF" })).toEqual({
      ok: true,
      value: { ...base, mac: "aa:bb:cc:dd:ee:ff", serial: null, manufacturer: null, brand: null },
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

  it("rejects blank, control or format characters, missing fields, ownerId as an unknown key, unknown keys, bad bodies", () => {
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
    expect(validateDeviceCreate({ ...base, ownerId: A })).toEqual({
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

describe("serial, manufacturer and brand", () => {
  const none = { serial: null, manufacturer: null, brand: null };
  it("create: missing and blank become null, values are trimmed and NFC", () => {
    expect(validateDeviceCreate({ ...base })).toEqual({
      ok: true,
      value: { ...base, mac: null, ...none },
    });
    expect(validateDeviceCreate({ ...base, serial: "  ", brand: null })).toEqual({
      ok: true,
      value: { ...base, mac: null, ...none },
    });
    const r = validateDeviceCreate({ ...base, serial: " SN-1 ", manufacturer: "Nguyễn" });
    expect(r).toEqual({
      ok: true,
      value: { ...base, mac: null, ...none, serial: "SN-1", manufacturer: "Nguyễn" },
    });
  });
  it("create: limit 100, control chars and non-strings refused", () => {
    for (const k of ["serial", "manufacturer", "brand"]) {
      expect(validateDeviceCreate({ ...base, [k]: "a".repeat(100) }).ok).toBe(true);
      expect(validateDeviceCreate({ ...base, [k]: "a".repeat(101) })).toEqual({
        ok: false,
        field: k,
      });
      expect(validateDeviceCreate({ ...base, [k]: "a\u0007" })).toEqual({ ok: false, field: k });
      expect(validateDeviceCreate({ ...base, [k]: 5 })).toEqual({ ok: false, field: k });
    }
  });
  it("create and patch refuse holding and owner keys", () => {
    for (const k of ["holdingNote", "ownerId", "note", "expiresOn"]) {
      expect(validateDeviceCreate({ ...base, [k]: "x" })).toEqual({ ok: false, field: k });
      expect(validateDevicePatch({ [k]: "x" })).toEqual({ ok: false, field: k });
    }
  });
  it("patch: a lone null is a valid patch, values are checked", () => {
    expect(validateDevicePatch({ serial: null })).toEqual({ ok: true, value: { serial: null } });
    expect(validateDevicePatch({ brand: " " })).toEqual({ ok: true, value: { brand: null } });
    expect(validateDevicePatch({ brand: " HP " })).toEqual({ ok: true, value: { brand: "HP" } });
    expect(validateDevicePatch({ serial: "a".repeat(101) })).toEqual({
      ok: false,
      field: "serial",
    });
  });
});

describe("validateAssign", () => {
  const today = "2026-11-25";
  const ok = (o: object) => validateAssign({ memberId: A, ...o }, today);
  it("requires a canonical uuid and a plain object", () => {
    expect(validateAssign("x", today)).toEqual({ ok: false, field: "body" });
    expect(validateAssign({}, today)).toEqual({ ok: false, field: "memberId" });
    expect(validateAssign({ memberId: A.toUpperCase() }, today)).toEqual({
      ok: false,
      field: "memberId",
    });
    expect(ok({ extra: 1 })).toEqual({ ok: false, field: "extra" });
  });
  it("defaults note and expiry to null", () => {
    const empty = { ok: true, value: { memberId: A, note: null, expiresOn: null } };
    expect(ok({})).toEqual(empty);
    expect(ok({ note: null, expiresOn: null })).toEqual(empty);
    expect(ok({ note: "  ", expiresOn: "" })).toEqual(empty);
  });
  it("note: 500 ok, 501 refused, newline ok, other control refused", () => {
    expect(ok({ note: "a".repeat(500) }).ok).toBe(true);
    expect(ok({ note: "a".repeat(501) })).toEqual({ ok: false, field: "note" });
    expect(ok({ note: "a\r\nb" })).toEqual({
      ok: true,
      value: { memberId: A, note: "a\nb", expiresOn: null },
    });
    expect(ok({ note: "a\u0007" })).toEqual({ ok: false, field: "note" });
    expect(ok({ note: 5 })).toEqual({ ok: false, field: "note" });
  });
  it("expiry: today allowed, yesterday and impossible dates refused", () => {
    expect(ok({ expiresOn: "2026-11-25" }).ok).toBe(true);
    expect(ok({ expiresOn: "2026-11-24" })).toEqual({ ok: false, field: "expiresOn" });
    expect(ok({ expiresOn: "2026-02-30" })).toEqual({ ok: false, field: "expiresOn" });
    expect(ok({ expiresOn: 5 })).toEqual({ ok: false, field: "expiresOn" });
  });
});

describe("validateHoldingPatch", () => {
  const today = "2026-11-25";
  it("refuses an empty or non-object body and unknown keys", () => {
    expect(validateHoldingPatch({}, today)).toEqual({ ok: false, field: "body" });
    expect(validateHoldingPatch(null, today)).toEqual({ ok: false, field: "body" });
    expect(validateHoldingPatch({ memberId: A }, today)).toEqual({ ok: false, field: "memberId" });
  });
  it("a note-only patch ignores the expiry rule", () => {
    expect(validateHoldingPatch({ note: "hi" }, today)).toEqual({
      ok: true,
      value: { note: "hi" },
    });
  });
  it("past expiry refused, null clears", () => {
    expect(validateHoldingPatch({ expiresOn: "2026-11-24" }, today)).toEqual({
      ok: false,
      field: "expiresOn",
    });
    expect(validateHoldingPatch({ expiresOn: null }, today)).toEqual({
      ok: true,
      value: { expiresOn: null },
    });
    expect(validateHoldingPatch({ note: null, expiresOn: "2026-12-01" }, today)).toEqual({
      ok: true,
      value: { note: null, expiresOn: "2026-12-01" },
    });
  });
});

describe("validateHandoffStart", () => {
  const ok = (o: object) => validateHandoffStart({ kind: "transfer", toMemberId: A, ...o });
  it("accepts a transfer with and without a note", () => {
    expect(ok({})).toEqual({
      ok: true,
      value: { kind: "transfer", toMemberId: A, note: null },
    });
    expect(ok({ note: " hi " })).toMatchObject({ ok: true, value: { note: "hi" } });
  });
  it("refuses a non-object, extra keys, other kinds and bad ids", () => {
    expect(validateHandoffStart("x")).toEqual({ ok: false, field: "body" });
    expect(ok({ extra: 1 })).toEqual({ ok: false, field: "extra" });
    expect(ok({ kind: "return" })).toEqual({ ok: false, field: "kind" });
    expect(ok({ toMemberId: A.toUpperCase() })).toEqual({ ok: false, field: "toMemberId" });
    expect(validateHandoffStart({ kind: "transfer" })).toEqual({
      ok: false,
      field: "toMemberId",
    });
  });
  it("limits the note to 500 characters", () => {
    expect(ok({ note: "x".repeat(500) }).ok).toBe(true);
    expect(ok({ note: "x".repeat(501) })).toEqual({ ok: false, field: "note" });
  });
  it("normalises a Vietnamese note to NFC and treats blank as null", () => {
    const decomposed = "Chuyển máy cho Hương".normalize("NFD");
    const r = ok({ note: decomposed });
    expect(r.ok && r.value.note).toBe(decomposed.normalize("NFC"));
    expect(ok({ note: "   " })).toMatchObject({ ok: true, value: { note: null } });
  });
});

describe("validateHandoffBox", () => {
  const box = (s: string) => validateHandoffBox(new URLSearchParams(s));
  it("accepts only one box=incoming", () => {
    expect(box("box=incoming")).toEqual({ ok: true, value: "incoming" });
    expect(box("")).toEqual({ ok: false, field: "box" });
    expect(box("box=outgoing")).toEqual({ ok: false, field: "box" });
    expect(box("box=incoming&box=incoming")).toEqual({ ok: false, field: "box" });
  });
});
