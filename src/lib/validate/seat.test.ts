import { describe, expect, it } from "vitest";
import { validateCannotSeat, validateOccupantPut, validateSeatAdd } from "./seat";

const U = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("validateSeatAdd", () => {
  it("1 and 50 ok; 0, 51, 1.5, string, null, missing, extra key error", () => {
    expect(validateSeatAdd({ count: 1 }).ok).toBe(true);
    expect(validateSeatAdd({ count: 50 }).ok).toBe(true);
    const bad = [
      { count: 0 },
      { count: 51 },
      { count: 1.5 },
      { count: "2" },
      { count: null },
      {},
      { count: 1, x: 1 },
      null,
      [],
    ];
    for (const b of bad) expect(validateSeatAdd(b).ok).toBe(false);
  });
});

describe("validateOccupantPut", () => {
  it("uuid/null combinations ok", () => {
    for (const memberId of [U, null]) {
      for (const expectedOccupantId of [U, null]) {
        expect(validateOccupantPut({ memberId, expectedOccupantId })).toEqual({
          ok: true,
          value: { memberId, expectedOccupantId },
        });
      }
    }
  });
  it("missing keys, bad uuids and extra keys error", () => {
    const bad = [
      { memberId: U },
      { expectedOccupantId: U },
      { memberId: U.toUpperCase(), expectedOccupantId: null },
      { memberId: "abc", expectedOccupantId: null },
      { memberId: null, expectedOccupantId: 5 },
      { memberId: null, expectedOccupantId: null, x: 1 },
      "x",
    ];
    for (const b of bad) expect(validateOccupantPut(b).ok).toBe(false);
  });
});

describe("validateCannotSeat", () => {
  it("true keeps a Vietnamese reason in NFC, trimmed", () => {
    const r = validateCannotSeat({
      cannotSeat: true,
      reason: "  " + "Hỏng ghế".normalize("NFD") + " ",
    });
    expect(r).toEqual({
      ok: true,
      value: { cannotSeat: true, reason: "Hỏng ghế".normalize("NFC") },
    });
  });
  it("true with a missing, blank or 201-char reason errors", () => {
    for (const reason of [undefined, "   ", "a".repeat(201), null, 5]) {
      expect(validateCannotSeat({ cannotSeat: true, reason }).ok).toBe(false);
    }
    expect(validateCannotSeat({ cannotSeat: true, reason: "a".repeat(200) }).ok).toBe(true);
  });
  it("rejects NUL, zero-width-only and filler-only reasons; keeps Vietnamese text", () => {
    for (const reason of ["a\u0000b", "​", "ㅤ", "ᅟ ​"]) {
      expect(validateCannotSeat({ cannotSeat: true, reason })).toEqual({
        ok: false,
        field: "reason",
      });
    }
    expect(validateCannotSeat({ cannotSeat: true, reason: "Ghế hỏng, đang sửa" }).ok).toBe(true);
  });
  it("false ok; false with a non-null reason errors; non-boolean errors", () => {
    expect(validateCannotSeat({ cannotSeat: false })).toEqual({
      ok: true,
      value: { cannotSeat: false },
    });
    expect(validateCannotSeat({ cannotSeat: false, reason: null }).ok).toBe(true);
    expect(validateCannotSeat({ cannotSeat: false, reason: "x" }).ok).toBe(false);
    expect(validateCannotSeat({ cannotSeat: "true", reason: "x" }).ok).toBe(false);
    expect(validateCannotSeat({}).ok).toBe(false);
    expect(validateCannotSeat({ cannotSeat: false, y: 1 }).ok).toBe(false);
  });
});
