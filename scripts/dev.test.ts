import { describe, expect, it } from "vitest";
import { devEnv, nextDevArgs } from "./dev.mjs";

describe("nextDevArgs", () => {
  it("binds 127.0.0.1 by default and passes other arguments through", () => {
    expect(nextDevArgs([])).toEqual(["dev", "-H", "127.0.0.1"]);
    expect(nextDevArgs(["--", "--port", "3001"])).toEqual([
      "dev",
      "-H",
      "127.0.0.1",
      "--port",
      "3001",
    ]);
  });

  it("keeps loopback host values", () => {
    expect(nextDevArgs(["-H", "localhost"])).toEqual(["dev", "-H", "localhost"]);
    expect(nextDevArgs(["--hostname=::1"])).toEqual(["dev", "--hostname=::1"]);
    expect(nextDevArgs(["-H", "127.0.0.1", "--port", "4000"])).toEqual([
      "dev",
      "-H",
      "127.0.0.1",
      "--port",
      "4000",
    ]);
  });

  it("refuses non-loopback or missing host values", () => {
    for (const argv of [
      ["-H", "0.0.0.0"],
      ["--hostname", "::"],
      ["-H", "192.168.1.5"],
      ["--hostname=0.0.0.0"],
      ["-H"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(/must listen on/);
    }
  });
});

describe("devEnv", () => {
  it("sets the dev-token flag and keeps the rest", () => {
    expect(devEnv({ A: "1" })).toEqual({ A: "1", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" });
  });
});
