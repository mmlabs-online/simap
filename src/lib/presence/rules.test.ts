import { describe, expect, it } from "vitest";
import {
  decideCheckIn,
  decideCheckOut,
  decideMove,
  decideProviderCheckIn,
  isActive,
} from "./rules";

const A = { roomId: "r1", seatId: "s1" };

describe("decideCheckIn", () => {
  const base = { roomId: "r1", todayRowExists: false, lowestSeatId: "s1" as string | null };
  it("active in the same room is the same record", () => {
    expect(decideCheckIn({ ...base, active: A })).toBe("same");
  });
  it("active in another room is refused, even when the target room has no seat", () => {
    expect(decideCheckIn({ ...base, roomId: "r2", lowestSeatId: null, active: A })).toBe(
      "refuse_other_room",
    );
  });
  it("no active and no seat is refused", () => {
    expect(decideCheckIn({ ...base, active: null, lowestSeatId: null })).toBe("refuse_no_seat");
  });
  it("a closed or stale row today is reopened", () => {
    expect(decideCheckIn({ ...base, active: null, todayRowExists: true })).toBe("reopen");
  });
  it("no row inserts", () => {
    expect(decideCheckIn({ ...base, active: null })).toBe("insert");
  });
});

describe("decideMove", () => {
  const mine = { id: "s2", roomId: "r1", occupantId: "m1" };
  const i = { active: A, memberId: "m1", target: mine };
  it("no active check-in wins over a bad target", () => {
    expect(decideMove({ ...i, active: null, target: null })).toBe("refuse_not_checked_in");
  });
  it("unknown, not mine and other room are refused", () => {
    expect(decideMove({ ...i, target: null })).toBe("refuse_not_yours");
    expect(decideMove({ ...i, target: { ...mine, occupantId: "m2" } })).toBe("refuse_not_yours");
    expect(decideMove({ ...i, target: { ...mine, roomId: "r2" } })).toBe("refuse_not_yours");
  });
  it("the seat already used is a no-op", () => {
    expect(decideMove({ ...i, target: { ...mine, id: "s1" } })).toBe("noop");
  });
  it("another own seat moves", () => {
    expect(decideMove(i)).toBe("move");
  });
});

describe("decideCheckOut", () => {
  it("none is a no-op, active checks out", () => {
    expect(decideCheckOut({ active: null })).toBe("noop");
    expect(decideCheckOut({ active: A })).toBe("check_out");
  });
});

describe("isActive", () => {
  const ok = {
    workDate: "2026-11-26",
    today: "2026-11-26",
    checkedOut: false,
    seatOccupantId: "m1",
    memberId: "m1",
  };
  it("today, open and held is active", () => {
    expect(isActive(ok)).toBe(true);
  });
  it("an earlier work date, a checked-out row or a lost seat is ended", () => {
    expect(isActive({ ...ok, workDate: "2026-11-25" })).toBe(false);
    expect(isActive({ ...ok, checkedOut: true })).toBe(false);
    expect(isActive({ ...ok, seatOccupantId: "m2" })).toBe(false);
    expect(isActive({ ...ok, seatOccupantId: null })).toBe(false);
  });
});

describe("decideProviderCheckIn", () => {
  const base = { active: null, todayRowExists: false, lowestSeatId: "s1" as string | null };
  it("active in the same room -> skip_active", () => {
    expect(decideProviderCheckIn({ ...base, active: A })).toBe("skip_active");
  });
  it("active in another room -> skip_active (never a refusal)", () => {
    expect(decideProviderCheckIn({ ...base, active: { roomId: "r2", seatId: "s9" } })).toBe(
      "skip_active",
    );
  });
  it("no active, row for today (checked out) -> skip_today_row", () => {
    expect(decideProviderCheckIn({ ...base, todayRowExists: true })).toBe("skip_today_row");
  });
  it("no row today, no seat in the room -> skip_no_seat", () => {
    expect(decideProviderCheckIn({ ...base, lowestSeatId: null })).toBe("skip_no_seat");
  });
  it("no row today, seat -> insert", () => {
    expect(decideProviderCheckIn(base)).toBe("insert");
  });
});
