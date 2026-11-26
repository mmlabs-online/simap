import { describe, expect, it } from "vitest";
import { seatViewOf } from "./seat-view";

const base = {
  cannotSeat: false,
  mine: false,
  occupantId: null,
  occupantName: null,
  occupantLook: null,
};
const who = { occupantId: "m-1", occupantName: "An" };

describe("seatViewOf", () => {
  it("precedence: cannot, then mine, then occupied, then empty", () => {
    expect(seatViewOf({ ...base, cannotSeat: true, mine: true, ...who }).state).toBe("cannot");
    expect(seatViewOf({ ...base, cannotSeat: true, ...who }).state).toBe("cannot");
    expect(seatViewOf({ ...base, mine: true, ...who }).state).toBe("mine");
    expect(seatViewOf({ ...base, ...who }).state).toBe("occupied");
    expect(seatViewOf(base).state).toBe("empty");
  });

  it("cannot-seat with an occupant keeps seed and name", () => {
    expect(seatViewOf({ ...base, cannotSeat: true, ...who })).toEqual({
      state: "cannot",
      avatarSeed: "m-1",
      name: "An",
      look: null,
    });
  });

  it("seed is the occupant member id", () => {
    expect(seatViewOf({ ...base, ...who }).avatarSeed).toBe("m-1");
  });

  it("empty has null seed and name", () => {
    expect(seatViewOf(base)).toEqual({ state: "empty", avatarSeed: null, name: null, look: null });
  });

  it("passes the occupant look through; an invalid look is null; an empty seat has no look", () => {
    const L = { skin: 1, hair: 2, style: 3, shirt: 4 };
    expect(seatViewOf({ ...base, ...who, occupantLook: L }).look).toEqual(L);
    expect(seatViewOf({ ...base, ...who, occupantLook: { ...L, shirt: 7 } }).look).toBeNull();
    expect(seatViewOf({ ...base, occupantLook: L }).look).toBeNull();
  });

  it("never emits pending", () => {
    for (const cannotSeat of [true, false]) {
      for (const mine of [true, false]) {
        for (const o of [who, { occupantId: null, occupantName: null }]) {
          expect(seatViewOf({ cannotSeat, mine, occupantLook: null, ...o }).state).not.toBe(
            "pending",
          );
        }
      }
    }
  });
});
