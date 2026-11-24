import { describe, expect, it } from "vitest";
import { DriveConfigError, loadDriveConfig } from "./config";

const S = "SECRET-SENTINEL";
const valid = {
  GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: `${S}-client-secret`,
  GOOGLE_REFRESH_TOKEN: `${S}-refresh-token`,
  DRIVE_FOLDER_ID: "1AbCdEfGhIjKlMnOp",
};
const NAMES = Object.keys(valid) as (keyof typeof valid)[];

function fail(env: Record<string, string | undefined>): string {
  try {
    loadDriveConfig(env);
  } catch (e) {
    expect(e).toBeInstanceOf(DriveConfigError);
    return (e as Error).message;
  }
  throw new Error("expected loadDriveConfig to throw");
}

describe("loadDriveConfig", () => {
  it("all four unset → off", () => {
    expect(loadDriveConfig({})).toEqual({ mode: "off" });
    expect(loadDriveConfig(Object.fromEntries(NAMES.map((n) => [n, ""])))).toEqual({
      mode: "off",
    });
  });

  it("all four valid → on with values", () => {
    expect(loadDriveConfig(valid)).toEqual({
      mode: "on",
      clientId: valid.GOOGLE_CLIENT_ID,
      clientSecret: valid.GOOGLE_CLIENT_SECRET,
      refreshToken: valid.GOOGLE_REFRESH_TOKEN,
      folderId: valid.DRIVE_FOLDER_ID,
    });
  });

  it("each single missing var → names exactly the missing ones", () => {
    for (const n of NAMES) {
      const env = { ...valid, [n]: undefined };
      const msg = fail(env);
      expect(msg).toContain(n);
      for (const o of NAMES.filter((x) => x !== n)) expect(msg).not.toContain(o);
    }
    for (const only of NAMES) {
      const msg = fail({ [only]: valid[only] });
      for (const o of NAMES.filter((x) => x !== only)) expect(msg).toContain(o);
      expect(msg).not.toContain(only);
    }
  });

  it("whitespace in any value → malformed, names it", () => {
    for (const n of NAMES) {
      for (const bad of [` ${valid[n]}`, `${valid[n]} `, `${valid[n]}\tx`, `a\nb${valid[n]}`]) {
        const msg = fail({ ...valid, [n]: bad });
        expect(msg).toContain("malformed");
        expect(msg).toContain(n);
      }
    }
  });

  it("client id without .apps.googleusercontent.com → GOOGLE_CLIENT_ID", () => {
    const msg = fail({ ...valid, GOOGLE_CLIENT_ID: "123-abc.example.com" });
    expect(msg).toContain("GOOGLE_CLIENT_ID");
    expect(msg).not.toContain("DRIVE_FOLDER_ID");
  });

  it("folder id outside /^[A-Za-z0-9_-]{10,200}$/ → DRIVE_FOLDER_ID", () => {
    for (const bad of [
      "a".repeat(9),
      "a".repeat(201),
      "abcdefghij/k",
      "abcdefghij'k",
      "abcdefghiđk",
    ]) {
      const msg = fail({ ...valid, DRIVE_FOLDER_ID: bad });
      expect(msg).toContain("DRIVE_FOLDER_ID");
      expect(msg).not.toContain("GOOGLE_CLIENT_ID");
    }
  });

  it("messages never contain any value", () => {
    const sentinel = Object.fromEntries(NAMES.map((n) => [n, `${S}-${n} bad`]));
    const cases: Record<string, string | undefined>[] = [
      sentinel,
      { ...sentinel, DRIVE_FOLDER_ID: undefined },
      { ...valid, GOOGLE_CLIENT_ID: `${S}-id`, DRIVE_FOLDER_ID: `${S}/x` },
      { GOOGLE_CLIENT_SECRET: `${S}-only` },
    ];
    for (const env of cases) {
      const msg = fail(env);
      expect(msg).not.toContain(S);
      for (const v of Object.values(env)) if (v) expect(msg).not.toContain(v);
    }
  });
});
