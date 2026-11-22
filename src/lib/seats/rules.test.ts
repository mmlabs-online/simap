import { describe, expect, it } from "vitest";
import {
  decideDelete,
  decideOccupantChange,
  decideRelease,
  inheritedGroup,
  seatStatus,
} from "./rules";

const X = "x";
const Y = "y";
const d = (
  current: string | null,
  target: string | null,
  expected: string | null,
  cannotSeat = false,
) => decideOccupantChange({ current, target, expected, cannotSeat });

describe("seatStatus", () => {
  it("null -> empty, id -> occupied", () => {
    expect(seatStatus(null)).toBe("empty");
    expect(seatStatus(X)).toBe("occupied");
  });
});

describe("decideOccupantChange", () => {
  it("same member is a noop, even on a cannot-seat seat or with a stale expected", () => {
    expect(d(X, X, X)).toBe("noop");
    expect(d(X, X, Y, true)).toBe("noop");
    expect(d(X, X, null)).toBe("noop");
  });
  it("both null is a noop", () => {
    expect(d(null, null, null)).toBe("noop");
    expect(d(null, null, X)).toBe("noop");
  });
  it("empty seat with expected null assigns", () => {
    expect(d(null, X, null)).toBe("assign");
  });
  it("occupied with expected current replaces", () => {
    expect(d(X, Y, X)).toBe("replace");
  });
  it("expected differs refuses as changed", () => {
    expect(d(X, Y, null)).toBe("refuse_changed");
    expect(d(null, Y, X)).toBe("refuse_changed");
    expect(d(X, Y, "z")).toBe("refuse_changed");
  });
  it("cannot-seat refuses assign and replace, allows clear", () => {
    expect(d(null, X, null, true)).toBe("refuse_cannot_seat");
    expect(d(X, Y, X, true)).toBe("refuse_cannot_seat");
    expect(d(X, null, X, true)).toBe("remove");
  });
  it("clear removes with a matching expected and refuses a stale one", () => {
    expect(d(X, null, X)).toBe("remove");
    expect(d(X, null, Y)).toBe("refuse_changed");
    expect(d(X, null, null)).toBe("refuse_changed");
  });
});

describe("decideRelease", () => {
  it("empty -> noop; occupant -> release; other member -> refuse; no member row -> refuse", () => {
    expect(decideRelease({ current: null, actorMemberId: X })).toBe("noop");
    expect(decideRelease({ current: null, actorMemberId: null })).toBe("noop");
    expect(decideRelease({ current: X, actorMemberId: X })).toBe("release");
    expect(decideRelease({ current: X, actorMemberId: Y })).toBe("refuse");
    expect(decideRelease({ current: X, actorMemberId: null })).toBe("refuse");
  });
});

describe("decideDelete", () => {
  it("occupant or devices refuse; empty deletes", () => {
    expect(decideDelete({ occupantId: X, deviceCount: 0 })).toBe("refuse");
    expect(decideDelete({ occupantId: null, deviceCount: 1 })).toBe("refuse");
    expect(decideDelete({ occupantId: null, deviceCount: 0 })).toBe("delete");
  });
});

describe("inheritedGroup", () => {
  it("seat null takes the member group; a seat group is kept; both null stays null", () => {
    expect(inheritedGroup(null, "g1")).toBe("g1");
    expect(inheritedGroup("g2", "g1")).toBe("g2");
    expect(inheritedGroup("g2", null)).toBe("g2");
    expect(inheritedGroup(null, null)).toBeNull();
  });
});
