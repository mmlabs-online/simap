import { describe, expect, it } from "vitest";
import { formatSeatCode, nextSeatSeq, renameSeatCodes } from "./seat-code";

describe("formatSeatCode", () => {
  it("pads to 2 digits and never truncates", () => {
    expect(formatSeatCode("C302", 1)).toBe("C302-01");
    expect(formatSeatCode("C302", 9)).toBe("C302-09");
    expect(formatSeatCode("C302", 10)).toBe("C302-10");
    expect(formatSeatCode("C302", 99)).toBe("C302-99");
    expect(formatSeatCode("C302", 100)).toBe("C302-100");
  });

  it("does not change the case of the room code", () => {
    expect(formatSeatCode("c302", 1)).toBe("c302-01");
  });

  it("throws for seq 0, negative and non-integer", () => {
    expect(() => formatSeatCode("C302", 0)).toThrow(RangeError);
    expect(() => formatSeatCode("C302", -1)).toThrow(RangeError);
    expect(() => formatSeatCode("C302", 1.5)).toThrow(RangeError);
  });
});

describe("nextSeatSeq (D30)", () => {
  it("is counter + 1", () => {
    expect(nextSeatSeq(0)).toBe(1);
    expect(nextSeatSeq(7)).toBe(8);
  });

  it("after seats 1..3 and deleting 3, next seq is 4, not 3", () => {
    const counter = 3; // the counter only grows; deleting seat 3 does not lower it
    const remaining = [1, 2];
    expect(nextSeatSeq(counter)).toBe(4);
    expect(nextSeatSeq(counter)).not.toBe(Math.max(...remaining) + 1);
  });

  it("rejects a corrupt counter", () => {
    expect(() => nextSeatSeq(-1)).toThrow(RangeError);
  });
});

describe("renameSeatCodes", () => {
  it("C302 -> C303 derives from seq", () => {
    const out = renameSeatCodes("C303", [
      { id: "a", seq: 1 },
      { id: "b", seq: 2 },
      { id: "c", seq: 110 },
    ]);
    expect(out).toEqual([
      { id: "a", code: "C303-01" },
      { id: "b", code: "C303-02" },
      { id: "c", code: "C303-110" },
    ]);
  });

  it("repairs a corrupted old code (derived from seq, not by string replace)", () => {
    expect(renameSeatCodes("C303", [{ id: "a", seq: 5 }])).toEqual([{ id: "a", code: "C303-05" }]);
  });

  it("no seats -> []", () => {
    expect(renameSeatCodes("C303", [])).toEqual([]);
  });
});
