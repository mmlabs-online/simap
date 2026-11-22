import { describe, expect, it } from "vitest";
import { canInviteRole, inviteRoleOptions } from "./roles";

describe("inviteRoleOptions", () => {
  it("offers nothing to a user, user to a manager, user and manager to an admin", () => {
    expect(inviteRoleOptions("user")).toEqual([]);
    expect(inviteRoleOptions("manager")).toEqual(["simap:user"]);
    expect(inviteRoleOptions("admin")).toEqual(["simap:user", "simap:manager"]);
  });
  it("never contains simap:admin", () => {
    for (const t of ["user", "manager", "admin"] as const) {
      expect(inviteRoleOptions(t)).not.toContain("simap:admin");
    }
  });
});

describe("canInviteRole", () => {
  it.each([
    ["manager", "simap:user", true],
    ["manager", "simap:manager", false],
    ["admin", "simap:admin", false],
    ["admin", "simap:manager", true],
    ["admin", "simap:user", true],
    ["user", "simap:user", false],
    ["admin", "simap:member", false],
    ["admin", "simap:org:invite", false],
    ["admin", " simap:user", false],
    ["admin", "SIMAP:USER", false],
    ["admin", null, false],
    ["admin", 42, false],
  ] as const)("%s + %s -> %s", (tier, role, want) => {
    expect(canInviteRole(tier, role)).toBe(want);
  });
});
