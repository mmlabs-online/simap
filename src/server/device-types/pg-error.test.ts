import { describe, expect, it } from "vitest";
import { deviceTypeConflict } from "./pg-error";

const pgErr = (code: string, constraint: string) =>
  Object.assign(new Error("x"), { code, constraint });

describe("deviceTypeConflict", () => {
  it("23505 device_types_org_name_key -> name_taken; other constraint or code -> null", () => {
    expect(deviceTypeConflict(pgErr("23505", "device_types_org_name_key"))).toBe("name_taken");
    expect(deviceTypeConflict(pgErr("23505", "device_types_pkey"))).toBeNull();
    expect(deviceTypeConflict(pgErr("23514", "device_types_org_name_key"))).toBeNull();
    expect(deviceTypeConflict(new Error("boom"))).toBeNull();
    expect(deviceTypeConflict(null)).toBeNull();
  });
});
