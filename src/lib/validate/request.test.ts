import { describe, expect, it } from "vitest";
import { validateRequestCreate, validateSeenBody } from "./request";

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

describe("validateSeenBody", () => {
  it("{} -> seenUpTo null", () => {
    expect(validateSeenBody({})).toEqual({ ok: true, value: { seenUpTo: null } });
  });

  it("accepts the microsecond form unchanged", () => {
    const s = "2026-11-24T05:00:00.123456Z";
    expect(validateSeenBody({ seenUpTo: s })).toEqual({ ok: true, value: { seenUpTo: s } });
  });

  it("refuses ms form, no fraction, offset, impossible date, non-string", () => {
    for (const v of [
      "2026-11-24T05:00:00.123Z",
      "2026-11-24T05:00:00Z",
      "2026-11-24T05:00:00.123456+07:00",
      "2026-02-30T05:00:00.123456Z",
      1,
      null,
    ]) {
      expect(validateSeenBody({ seenUpTo: v })).toEqual({ ok: false, field: "seenUpTo" });
    }
  });

  it("refuses an extra key and a non-object body", () => {
    expect(validateSeenBody({ other: 1 })).toEqual({ ok: false, field: "other" });
    for (const b of [null, undefined, "x", 1, []]) {
      expect(validateSeenBody(b)).toEqual({ ok: false, field: "body" });
    }
  });
});
