import { describe, expect, it } from "vitest";
import { roomConflict } from "./pg-error";

describe("roomConflict", () => {
  it("23505 on rooms_org_code_key or seats_org_code_key -> room_code_taken", () => {
    expect(roomConflict({ code: "23505", constraint: "rooms_org_code_key" })).toBe(
      "room_code_taken",
    );
    expect(roomConflict({ code: "23505", constraint: "seats_org_code_key" })).toBe(
      "room_code_taken",
    );
  });

  it("other codes, constraints and non-errors -> null", () => {
    expect(roomConflict({ code: "23505", constraint: "devices_org_mac_key" })).toBeNull();
    expect(roomConflict({ code: "23503", constraint: "rooms_org_code_key" })).toBeNull();
    expect(roomConflict(null)).toBeNull();
    expect(roomConflict(new Error("x"))).toBeNull();
  });
});
