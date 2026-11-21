import { describe, expect, it } from "vitest";
import { classifyTarget, tunnelPorts } from "./target.js";

const prod = (databaseUrl: string | undefined, env: Record<string, string | undefined> = {}) =>
  classifyTarget({ databaseUrl, env }).production;
const LOCAL = "postgres://simap@127.0.0.1:5432/simap";

describe("tunnelPorts", () => {
  it("default and override tunnel ports", () => {
    expect(tunnelPorts({}).ports).toEqual([15432]);
    expect(tunnelPorts({ SIMAP_PROD_TUNNEL_PORT: "" })).toMatchObject({
      valid: true,
      primary: 15432,
    });
    expect(tunnelPorts({ SIMAP_PROD_TUNNEL_PORT: "16000" })).toEqual({
      ports: [15432, 16000],
      primary: 16000,
      valid: true,
    });
    for (const bad of ["abc", "0", "65536", "1.5"]) {
      expect(tunnelPorts({ SIMAP_PROD_TUNNEL_PORT: bad }).valid, bad).toBe(false);
      expect(prod(LOCAL, { SIMAP_PROD_TUNNEL_PORT: bad }), bad).toBe(true);
    }
  });
});

describe("classifyTarget", () => {
  it("SIMAP_DB_TARGET values", () => {
    for (const v of [undefined, "", "local", " Dev "]) {
      const env = v === undefined ? {} : { SIMAP_DB_TARGET: v };
      expect(prod(LOCAL, env), String(v)).toBe(false);
    }
    for (const v of ["production", "PROD", "locl"]) {
      expect(prod(LOCAL, { SIMAP_DB_TARGET: v }), v).toBe(true);
    }
  });

  it("URL port forms", () => {
    for (const u of [
      "postgres://u@127.0.0.1:15432/simap",
      "postgres://u@[::1]:15432/simap",
      "postgres://u@localhost:015432/simap",
      "postgresql://u@localhost:15432/simap",
    ]) {
      expect(prod(u), u).toBe(true);
    }
    expect(prod("postgres://u@localhost/simap")).toBe(false);
    expect(prod(LOCAL)).toBe(false);
    expect(prod("postgres://u@localhost:16000/simap", { SIMAP_PROD_TUNNEL_PORT: "16000" })).toBe(
      true,
    );
  });

  it("query and PGPORT", () => {
    expect(prod(`${LOCAL}?port=5432`)).toBe(true);
    for (const p of ["15432", "015432", "15432abc"])
      expect(prod(LOCAL, { PGPORT: p }), p).toBe(true);
    expect(prod(LOCAL, { PGPORT: "5432" })).toBe(false);
  });

  it("malformed and multi-host fail closed, result carries no URL text", () => {
    for (const u of [undefined, "not a url secret-pw", "postgres://a:1,b:2/db"]) {
      const r = classifyTarget({ databaseUrl: u, env: {} });
      expect(r.production, String(u)).toBe(true);
      expect(JSON.stringify(r)).not.toContain("secret-pw");
    }
  });
});
