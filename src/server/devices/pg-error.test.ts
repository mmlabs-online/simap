import { describe, expect, it } from "vitest";
import { deviceConflict } from "./pg-error";

const pgErr = (code: string, constraint: string) =>
  Object.assign(new Error("x"), { code, constraint });

describe("deviceConflict", () => {
  it("maps the one-primary index and the owner trigger; ignores other codes and constraints", () => {
    expect(deviceConflict(pgErr("23505", "devices_one_primary_per_seat"))).toBe("seat_has_primary");
    expect(deviceConflict(pgErr("23514", "devices_primary_owner_is_occupant"))).toBe(
      "owner_not_occupant",
    );
    expect(deviceConflict(pgErr("23505", "devices_org_inventory_number_key"))).toBe(
      "inventory_number_taken",
    );
    expect(deviceConflict(pgErr("23505", "devices_org_mac_key"))).toBe("mac_taken");
    expect(deviceConflict(pgErr("23505", "devices_pkey"))).toBeNull();
    expect(deviceConflict(pgErr("23514", "devices_org_mac_key"))).toBeNull();
    expect(deviceConflict(pgErr("23514", "devices_role_check"))).toBeNull();
    expect(deviceConflict(pgErr("23503", "devices_seat_fkey"))).toBeNull();
    expect(deviceConflict(new Error("boom"))).toBeNull();
    expect(deviceConflict(null)).toBeNull();
  });
});
