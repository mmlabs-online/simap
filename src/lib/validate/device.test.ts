import { describe, expect, it } from "vitest";
import { parseDeviceQuery, validatePlacementPut } from "./device";

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
