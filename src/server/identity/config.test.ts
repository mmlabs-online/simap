import { describe, expect, it } from "vitest";
import { loadIdentityConfig, loadSuperAdminRole } from "./config";

const ISS = "https://api.mmlabs.online";
const prod = { NODE_ENV: "production" };

describe("loadIdentityConfig", () => {
  it("missing issuer throws, naming the variable", () => {
    expect(() => loadIdentityConfig({})).toThrow(/MM_IDENTITY_ISSUER/);
  });
  it("accepts the production issuer", () => {
    expect(loadIdentityConfig({ ...prod, MM_IDENTITY_ISSUER: ISS })).toEqual({
      issuer: ISS,
      jwksUrl: `${ISS}/.well-known/jwks.json`,
    });
  });
  it("rejects userinfo, port, path, query, fragment, trailing slash; never prints the value", () => {
    for (const v of [
      "https://u:p@api.mmlabs.online",
      "https://api.mmlabs.online:8443",
      "https://api.mmlabs.online/x",
      "https://api.mmlabs.online?a=1",
      "https://api.mmlabs.online#f",
      "https://api.mmlabs.online/",
      "not a url",
    ]) {
      expect(() => loadIdentityConfig({ MM_IDENTITY_ISSUER: v })).toThrow(/MM_IDENTITY_ISSUER/);
      try {
        loadIdentityConfig({ MM_IDENTITY_ISSUER: v });
      } catch (e) {
        expect((e as Error).message).not.toContain("mmlabs.online:8443");
        expect((e as Error).message).not.toContain("u:p");
      }
    }
  });
  it("production allows only the production issuer", () => {
    for (const v of ["https://evil.example", "http://localhost:8000", "http://api.mmlabs.online"]) {
      expect(() => loadIdentityConfig({ ...prod, MM_IDENTITY_ISSUER: v })).toThrow(
        /MM_IDENTITY_ISSUER/,
      );
    }
  });
  it("outside production: https hosts and http://localhost:<port> only", () => {
    expect(loadIdentityConfig({ MM_IDENTITY_ISSUER: "http://localhost:8000" }).issuer).toBe(
      "http://localhost:8000",
    );
    expect(loadIdentityConfig({ MM_IDENTITY_ISSUER: "https://staging.example" }).issuer).toBe(
      "https://staging.example",
    );
    for (const v of ["http://127.0.0.1:8000", "http://example.com", "http://localhost"]) {
      expect(() => loadIdentityConfig({ MM_IDENTITY_ISSUER: v })).toThrow(/MM_IDENTITY_ISSUER/);
    }
  });
});

describe("loadSuperAdminRole", () => {
  it("unset or empty -> null; a valid key -> value", () => {
    expect(loadSuperAdminRole({})).toBeNull();
    expect(loadSuperAdminRole({ SIMAP_SUPER_ADMIN_ROLE: "" })).toBeNull();
    expect(loadSuperAdminRole({ SIMAP_SUPER_ADMIN_ROLE: "simap:super-admin" })).toBe(
      "simap:super-admin",
    );
  });
  it("membership keys, uppercase, spaces, other scopes and a bare prefix throw without the value", () => {
    for (const v of [
      "simap:admin",
      "simap:manager",
      "simap:user",
      "simap:member",
      "simap:Super-Admin",
      "simap:super admin",
      " simap:super-admin",
      "admin:super-admin",
      "simap:",
    ]) {
      expect(() => loadSuperAdminRole({ SIMAP_SUPER_ADMIN_ROLE: v })).toThrow(
        /SIMAP_SUPER_ADMIN_ROLE/,
      );
      try {
        loadSuperAdminRole({ SIMAP_SUPER_ADMIN_ROLE: v });
      } catch (e) {
        expect((e as Error).message).not.toContain(v.trim() || "@@");
      }
    }
  });
});
