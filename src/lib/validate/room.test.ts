import { describe, expect, it } from "vitest";
import { validateRoomCreate, validateRoomPatch } from "./room";

const ok = { code: "C302", name: "Meeting room" };

describe("validateRoomCreate", () => {
  it("valid create; trims; optional fields default to null", () => {
    expect(validateRoomCreate({ code: " C302 ", name: "  Meeting  " })).toEqual({
      ok: true,
      value: { code: "C302", name: "Meeting", description: null, floor: null },
    });
  });

  it("code charset after normalisation", () => {
    expect(validateRoomCreate({ ...ok, code: "A.b_c-1" }).ok).toBe(true);
    for (const code of ["C 302", "C/302", "Phòng", ""]) {
      expect(validateRoomCreate({ ...ok, code })).toEqual({ ok: false, field: "code" });
    }
    expect(validateRoomCreate({ ...ok, code: "A".repeat(33) })).toEqual({
      ok: false,
      field: "code",
    });
  });

  it("lowercase input is stored uppercase (Q2)", () => {
    for (const code of ["c302", " c302 "]) {
      const r = validateRoomCreate({ ...ok, code });
      expect(r.ok && r.value.code).toBe("C302");
    }
  });

  it("c302 and C302 normalise to the same value", () => {
    const a = validateRoomCreate({ ...ok, code: "c302" });
    const b = validateRoomCreate({ ...ok, code: "C302" });
    expect(a).toEqual(b);
  });

  it("length is checked after trim and uppercase", () => {
    expect(validateRoomCreate({ ...ok, code: ` ${"a".repeat(32)} ` }).ok).toBe(true);
    expect(validateRoomCreate({ ...ok, code: "a".repeat(33) }).ok).toBe(false);
  });

  it("name accepts diacritics, is NFC-normalised, max 120", () => {
    const nfd = "Phòng họp".normalize("NFD");
    const r = validateRoomCreate({ ...ok, name: nfd });
    expect(r.ok && r.value.name).toBe("Phòng họp".normalize("NFC"));
    expect(validateRoomCreate({ ...ok, name: "x".repeat(120) }).ok).toBe(true);
    expect(validateRoomCreate({ ...ok, name: "x".repeat(121) })).toEqual({
      ok: false,
      field: "name",
    });
    expect(validateRoomCreate({ ...ok, name: "   " })).toEqual({ ok: false, field: "name" });
  });

  it("description > 500 and floor > 40 rejected; empty string -> null", () => {
    expect(validateRoomCreate({ ...ok, description: "d".repeat(501) })).toEqual({
      ok: false,
      field: "description",
    });
    expect(validateRoomCreate({ ...ok, floor: "f".repeat(41) })).toEqual({
      ok: false,
      field: "floor",
    });
    const r = validateRoomCreate({ ...ok, description: "", floor: "" });
    expect(r.ok && r.value).toMatchObject({ description: null, floor: null });
  });

  it("unknown keys are rejected with that field", () => {
    for (const key of ["seat_counter", "org_id", "seatCode"]) {
      expect(validateRoomCreate({ ...ok, [key]: 1 })).toEqual({ ok: false, field: key });
    }
  });

  it("non-object body and non-string fields are rejected", () => {
    for (const b of [null, [], "x", 5]) {
      expect(validateRoomCreate(b)).toEqual({ ok: false, field: "body" });
    }
    expect(validateRoomCreate({ code: 1, name: "n" })).toEqual({ ok: false, field: "code" });
    expect(validateRoomCreate({ code: "A", name: 1 })).toEqual({ ok: false, field: "name" });
    expect(validateRoomCreate({ ...ok, floor: 3 })).toEqual({ ok: false, field: "floor" });
  });
});

describe("validateRoomPatch", () => {
  it("uppercases code", () => {
    const r = validateRoomPatch({ code: " c303 " });
    expect(r).toEqual({ ok: true, value: { code: "C303" } });
  });

  it("{} rejected; code/name null rejected; description null accepted", () => {
    expect(validateRoomPatch({})).toEqual({ ok: false, field: "body" });
    expect(validateRoomPatch({ code: null })).toEqual({ ok: false, field: "code" });
    expect(validateRoomPatch({ name: null })).toEqual({ ok: false, field: "name" });
    expect(validateRoomPatch({ description: null })).toEqual({
      ok: true,
      value: { description: null },
    });
  });

  it("only provided keys appear; unknown keys rejected", () => {
    expect(validateRoomPatch({ floor: "" })).toEqual({ ok: true, value: { floor: null } });
    expect(validateRoomPatch({ name: "n", seat_counter: 9 })).toEqual({
      ok: false,
      field: "seat_counter",
    });
  });
});
