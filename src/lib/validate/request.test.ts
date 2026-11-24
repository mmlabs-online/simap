import { describe, expect, it } from "vitest";
import { validateRequestCreate } from "./request";

const ID = "33333333-3333-4333-8333-333333333333";

describe("validateRequestCreate", () => {
  it("accepts { seatId }", () => {
    expect(validateRequestCreate({ seatId: ID })).toEqual({ ok: true, value: { seatId: ID } });
  });

  it("refuses a non-object body", () => {
    for (const b of [null, undefined, "x", 1, [ID]]) {
      expect(validateRequestCreate(b)).toEqual({ ok: false, field: "body" });
    }
  });

  it("refuses a missing or non-canonical seatId", () => {
    expect(validateRequestCreate({})).toEqual({ ok: false, field: "seatId" });
    expect(validateRequestCreate({ seatId: "abc" })).toEqual({ ok: false, field: "seatId" });
    expect(validateRequestCreate({ seatId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" })).toEqual({
      ok: false,
      field: "seatId",
    });
  });

  it("refuses subjectId, note and any other key", () => {
    for (const k of ["subjectId", "note", "other"]) {
      expect(validateRequestCreate({ seatId: ID, [k]: ID })).toEqual({ ok: false, field: k });
    }
  });
});
