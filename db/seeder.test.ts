import { describe, expect, it } from "vitest";
import { SEED_ORGS, assertDevSeedTarget, seedRows } from "./seeder.js";

const url = (host: string) => `postgres://u:secret-pw@${host}:5432/simap`;

describe("assertDevSeedTarget", () => {
  it("accepts localhost, 127.0.0.1 and ::1", () => {
    for (const h of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(() =>
        assertDevSeedTarget({ databaseUrl: url(h), nodeEnv: "development" }),
      ).not.toThrow();
    }
  });

  it("refuses any other host", () => {
    for (const h of ["10.0.0.5", "db.internal", "localhost.example.com", "127.0.0.1.evil.net"]) {
      expect(() => assertDevSeedTarget({ databaseUrl: url(h), nodeEnv: undefined })).toThrow(
        /not local/,
      );
    }
  });

  it("refuses ?host= / ?hostaddr= overrides without echoing the URL", () => {
    for (const q of ["host=10.0.0.5", "hostaddr=10.0.0.5", "host=localhost"]) {
      let message = "";
      try {
        assertDevSeedTarget({ databaseUrl: `${url("localhost")}?${q}`, nodeEnv: undefined });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message, q).toMatch(/not local/);
      expect(message).not.toContain("secret-pw");
    }
  });

  it("refuses an empty host and a unix socket path", () => {
    for (const u of [
      "postgres:///simap",
      "postgres://u:secret-pw@%2Fvar%2Frun%2Fpostgresql/simap",
    ]) {
      let message = "";
      try {
        assertDevSeedTarget({ databaseUrl: u, nodeEnv: undefined });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/not local/);
      expect(message).not.toContain("secret-pw");
    }
  });

  it("refuses NODE_ENV=production even on localhost", () => {
    expect(() =>
      assertDevSeedTarget({ databaseUrl: url("localhost"), nodeEnv: "production" }),
    ).toThrow(/production/);
  });

  it("refuses a missing or unparsable DATABASE_URL without echoing it", () => {
    expect(() => assertDevSeedTarget({ databaseUrl: undefined, nodeEnv: undefined })).toThrow(
      /missing or invalid/,
    );
    let message = "";
    try {
      assertDevSeedTarget({ databaseUrl: "not a url secret-pw", nodeEnv: undefined });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/missing or invalid/);
    expect(message).not.toContain("secret-pw");
    try {
      assertDevSeedTarget({ databaseUrl: url("10.0.0.5"), nodeEnv: undefined });
    } catch (err) {
      expect((err as Error).message).not.toContain("secret-pw");
    }
  });
});

describe("seed data", () => {
  it("uses only @simap.example emails and fixed fake ids", () => {
    const uuid = /^00000000-0000-4000-8[0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const o of SEED_ORGS) {
      expect(o.org).toMatch(uuid);
      const { members, uid } = seedRows(o);
      expect(uid("6", 11)).toMatch(uuid);
      for (const m of members) {
        expect(m.email.endsWith("@simap.example")).toBe(true);
        expect(m.id).toMatch(uuid);
        expect(m.sub).toMatch(uuid);
      }
    }
  });
});
