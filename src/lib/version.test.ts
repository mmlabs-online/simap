import { describe, expect, it } from "vitest";
import { DEV_VERSION, parseVersion } from "./version";

describe("parseVersion", () => {
  it("v1.2.3 and v0.1.9 and v10.20.30 pass through", () => {
    for (const v of ["v1.2.3", "v0.1.9", "v10.20.30"]) expect(parseVersion(v)).toBe(v);
  });

  it("undefined and empty give dev", () => {
    expect(parseVersion(undefined)).toBe(DEV_VERSION);
    expect(parseVersion("")).toBe("dev");
  });

  it("malformed values give dev", () => {
    const bad = [
      "1.2.3",
      "v1.2",
      "v1.2.3-rc",
      "v01.2.3",
      " v1.2.3",
      "v1.2.3\n",
      "dev",
      "x".repeat(200),
    ];
    for (const v of bad) expect(parseVersion(v)).toBe("dev");
    expect(parseVersion(`v1.2.${"9".repeat(40)}`)).toBe("dev");
  });
});
