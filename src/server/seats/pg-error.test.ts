import { describe, expect, it } from "vitest";
import { seatConflict } from "./pg-error";

const e = (code: string, constraint?: string) =>
  Object.assign(new Error("x"), { code, constraint });

describe("seatConflict", () => {
  it("23503 on devices_seat_fkey maps to seat_not_empty", () => {
    expect(seatConflict(e("23503", "devices_seat_fkey"))).toBe("seat_not_empty");
  });
  it("other constraints or codes map to null", () => {
    expect(seatConflict(e("23503", "seats_room_fkey"))).toBeNull();
    expect(seatConflict(e("23505", "devices_seat_fkey"))).toBeNull();
    expect(seatConflict(new Error("x"))).toBeNull();
    expect(seatConflict(null)).toBeNull();
  });
});
