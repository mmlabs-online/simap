import { describe, expect, it } from "vitest";
import { assertNodeOptionsSafe, devEnv, nextDevArgs } from "./dev.mjs";

const LAST = ["-H", "127.0.0.1"];

describe("nextDevArgs", () => {
  it("binds 127.0.0.1 by default and passes other arguments through", () => {
    expect(nextDevArgs([])).toEqual(["dev", ...LAST]);
    expect(nextDevArgs(["--", "--port", "3001"])).toEqual(["dev", "--port", "3001", ...LAST]);
    expect(nextDevArgs(["--port", "4000"])).toEqual(["dev", "--port", "4000", ...LAST]);
  });

  it("keeps loopback host values but always ends with -H 127.0.0.1", () => {
    expect(nextDevArgs(["-H", "localhost"])).toEqual(["dev", "-H", "localhost", ...LAST]);
    expect(nextDevArgs(["--hostname=::1"])).toEqual(["dev", "--hostname=::1", ...LAST]);
    expect(nextDevArgs(["-H127.0.0.1"])).toEqual(["dev", "-H127.0.0.1", ...LAST]);
  });

  it("ends with -H 127.0.0.1 when a host flag is another option's value", () => {
    for (const argv of [
      ["--experimental-https-key", "--hostname=localhost"],
      ["--experimental-https-cert", "-Hlocalhost"],
      ["--experimental-upload-trace", "-H", "localhost"],
    ]) {
      expect(nextDevArgs(argv).slice(-2), argv.join(" ")).toEqual(LAST);
    }
  });

  it("accepts --inspect only bare or on loopback", () => {
    for (const argv of [
      ["--inspect"],
      ["--inspect", "9229"],
      ["--inspect=9229"],
      ["--inspect=127.0.0.1:9229"],
      ["--inspect", "localhost:9229"],
      ["--inspect=[::1]:9229"],
      ["--inspect", "--port", "3001"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).not.toThrow();
    }
  });

  it("refuses --inspect with a non-loopback or odd address", () => {
    for (const argv of [
      ["--inspect", "0.0.0.0:9229"],
      ["--inspect=0.0.0.0:9229"],
      ["--inspect=0.0.0.0"],
      ["--inspect", "192.168.1.5:9229"],
      ["--inspect=[::]:9229"],
      ["--inspect=localhost"],
      ["--inspect=example.com:9229"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(/--inspect/);
    }
  });

  it("refuses non-loopback or missing host values", () => {
    for (const argv of [
      ["-H", "0.0.0.0"],
      ["--hostname", "::"],
      ["-H", "192.168.1.5"],
      ["--hostname=0.0.0.0"],
      ["-H"],
      ["-H0.0.0.0"],
      ["-H=0.0.0.0"],
      ["-H", "127.0.0.1", "-H0.0.0.0"],
      ["-H192.168.1.5"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(/must listen on/);
    }
  });
});

describe("assertNodeOptionsSafe", () => {
  it("allows no NODE_OPTIONS and loopback or bare inspect", () => {
    for (const NODE_OPTIONS of [
      undefined,
      "",
      "--max-old-space-size=4096",
      "--inspect",
      "--inspect=9229",
      "--inspect=127.0.0.1:9229 --max-old-space-size=1",
      "--inspect-brk=localhost:9229",
    ]) {
      expect(() => assertNodeOptionsSafe({ NODE_OPTIONS }), String(NODE_OPTIONS)).not.toThrow();
    }
  });

  it("refuses a non-loopback inspector in NODE_OPTIONS", () => {
    for (const NODE_OPTIONS of [
      "--inspect=0.0.0.0",
      "--inspect=0.0.0.0:9229",
      "--inspect-brk=0.0.0.0:9229",
      "--max-old-space-size=1 --inspect 192.168.1.5:9229",
      "--inspect-port=0.0.0.0:9230",
    ]) {
      expect(() => assertNodeOptionsSafe({ NODE_OPTIONS }), NODE_OPTIONS).toThrow(/--inspect/);
    }
  });
});

describe("devEnv", () => {
  it("sets the dev-token flag and keeps the rest", () => {
    expect(devEnv({ A: "1" })).toEqual({ A: "1", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" });
  });
});
