import { describe, expect, it } from "vitest";
import { seatViewOf } from "./seat-view";

const base = { cannotSeat: false, mine: false, occupantId: null, occupantName: null };
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
    });
  });

  it("seed is the occupant member id", () => {
    expect(seatViewOf({ ...base, ...who }).avatarSeed).toBe("m-1");
  });

  it("empty has null seed and name", () => {
    expect(seatViewOf(base)).toEqual({ state: "empty", avatarSeed: null, name: null });
  });

  it("never emits pending", () => {
    for (const cannotSeat of [true, false]) {
      for (const mine of [true, false]) {
        for (const o of [who, { occupantId: null, occupantName: null }]) {
          expect(seatViewOf({ cannotSeat, mine, ...o }).state).not.toBe("pending");
        }
      }
    }
  });
});
