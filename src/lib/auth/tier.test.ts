import { describe, expect, it } from "vitest";
import { accessFromToken, atLeast, tierFromOrgRoles } from "./tier";

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

describe("accessFromToken", () => {
  const KEY = "simap:super-admin";
  const ok = { orgRoles: [], appRoles: [KEY], orgAccess: "super_admin", lifetimeS: 3600 };

  it("grants admin on the exact D86 condition (org_access super_admin, key in roles, org_roles [], lifetime <= 3600)", () => {
    expect(accessFromToken(ok, KEY)).toEqual({ tier: "admin", via: "super_admin" });
  });

  it("near-miss keys and partial D86 claims grant nothing", () => {
    for (const r of [
      "simap:member",
      "simap:admin",
      "admin:super-admin",
      "simap:super-admin ",
      "SIMAP:super-admin",
      "simap:Super-Admin",
      "simap:super-admin-x",
      "simap:super",
    ]) {
      expect(accessFromToken({ ...ok, appRoles: [r] }, KEY)).toBeNull();
    }
    for (const a of ["member", "Super_Admin", " super_admin", null]) {
      const got = accessFromToken({ ...ok, orgAccess: a }, KEY);
      expect(got?.tier ?? null).toBeNull();
    }
    expect(accessFromToken({ ...ok, appRoles: [] }, KEY)).toBeNull();
    expect(accessFromToken(ok, null)).toBeNull();
    expect(accessFromToken({ ...ok, lifetimeS: 3601 }, KEY)).toBeNull();
    expect(accessFromToken({ ...ok, lifetimeS: undefined }, KEY)).toBeNull();
    expect(accessFromToken({ ...ok, orgRoles: ["simap:user"] }, KEY)).toBeNull();
  });

  it("member path unchanged: org_access absent/member uses tierFromOrgRoles and ignores roles", () => {
    for (const orgAccess of [undefined, "member", "other"]) {
      expect(accessFromToken({ orgRoles: [], appRoles: [KEY], orgAccess }, KEY)).toBeNull();
      expect(accessFromToken({ orgRoles: ["simap:user"], orgAccess }, KEY)).toEqual({
        tier: "user",
        via: "member",
      });
    }
  });

  it("roles with __proto__ / constructor entries or a 1,000-entry list never throw", () => {
    const many = Array.from({ length: 1000 }, (_, i) => `x${i}`);
    expect(
      accessFromToken({ ...ok, appRoles: ["__proto__", "constructor", ...many] }, KEY),
    ).toBeNull();
    expect(accessFromToken({ ...ok, appRoles: [...many, KEY] }, KEY)?.tier).toBe("admin");
  });
});
