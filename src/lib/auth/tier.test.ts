import { describe, expect, it } from "vitest";
import { atLeast, tierFromOrgRoles } from "./tier";

describe("tierFromOrgRoles", () => {
  it("maps each exact key to its tier", () => {
    expect(tierFromOrgRoles(["simap:admin"])).toBe("admin");
    expect(tierFromOrgRoles(["simap:manager"])).toBe("manager");
    expect(tierFromOrgRoles(["simap:user"])).toBe("user");
  });

  it("highest tier wins regardless of order (D15)", () => {
    expect(tierFromOrgRoles(["simap:user", "simap:admin"])).toBe("admin");
    expect(tierFromOrgRoles(["simap:manager", "simap:user"])).toBe("manager");
    expect(tierFromOrgRoles(["simap:user", "simap:user"])).toBe("user");
  });

  it("ignores non-tier and near-miss roles", () => {
    for (const r of [
      "simap:member",
      "simap:org:invite",
      "simap:viewer",
      "simap:Admin",
      " simap:admin",
      "other:admin",
      "",
      "toString",
      "__proto__",
    ])
      expect(tierFromOrgRoles([r])).toBeNull();
    expect(tierFromOrgRoles(["simap:member", "simap:user"])).toBe("user");
  });

  it("empty list -> null", () => {
    expect(tierFromOrgRoles([])).toBeNull();
  });
});

describe("atLeast", () => {
  it("ranks user < manager < admin", () => {
    expect(atLeast("user", "user")).toBe(true);
    expect(atLeast("user", "manager")).toBe(false);
    expect(atLeast("manager", "user")).toBe(true);
    expect(atLeast("manager", "admin")).toBe(false);
    expect(atLeast("admin", "manager")).toBe(true);
  });
});
