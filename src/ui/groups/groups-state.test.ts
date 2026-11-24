import { describe, expect, it } from "vitest";
import { canManageGroups } from "./groups-state";

describe("canManageGroups", () => {
  it("is false without a session or for a user", () => {
    expect(canManageGroups(null)).toBe(false);
    expect(canManageGroups(undefined)).toBe(false);
    expect(canManageGroups("user")).toBe(false);
  });
  it("is true for manager and admin", () => {
    expect(canManageGroups("manager")).toBe(true);
    expect(canManageGroups("admin")).toBe(true);
  });
});
