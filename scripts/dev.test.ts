import { describe, expect, it } from "vitest";
import { assertNodeOptionsSafe, devEnv, nextDevArgs, USAGE } from "./dev.mjs";

const HEAD = ["dev", "-H", "127.0.0.1"];

describe("nextDevArgs", () => {
  const accepted: [string[], string[]][] = [
    [[], HEAD],
    [
      ["--port", "3001"],
      [...HEAD, "--port", "3001"],
    ],
    [
      ["-p", "3001"],
      [...HEAD, "--port", "3001"],
    ],
    [["--port=3001"], [...HEAD, "--port", "3001"]],
    [
      ["--port", "1"],
      [...HEAD, "--port", "1"],
    ],
    [
      ["-p", "65535"],
      [...HEAD, "--port", "65535"],
    ],
  ];

  it("builds the argv itself", () => {
    for (const [argv, expected] of accepted) {
      expect(nextDevArgs(argv), argv.join(" ")).toEqual(expected);
    }
  });

  it("every accepted argv starts with dev -H 127.0.0.1 and has length 3 or 5", () => {
    for (const [argv] of accepted) {
      const out = nextDevArgs(argv);
      expect(out.slice(0, 3)).toEqual(HEAD);
      expect([3, 5]).toContain(out.length);
      if (out.length === 5) {
        expect(out[3]).toBe("--port");
        expect(out[4]).toMatch(/^[1-9][0-9]{0,4}$/);
      }
    }
  });

  it("refuses any --", () => {
    for (const argv of [
      ["--"],
      ["--", "--port", "3001"],
      ["--port", "3001", "--"],
      [".", "--"],
      ["--", ".", "--"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(USAGE);
    }
  });

  it("refuses positionals and every other next dev option", () => {
    for (const argv of [
      ["."],
      ["src"],
      ["--port", "3001", "."],
      ["-H", "127.0.0.1"],
      ["-H", "localhost"],
      ["-H0.0.0.0"],
      ["-H=0.0.0.0"],
      ["--hostname", "0.0.0.0"],
      ["--hostname=::1"],
      ["--inspect"],
      ["--inspect", "9229"],
      ["--inspect=127.0.0.1:9229"],
      ["--turbopack"],
      ["--turbo"],
      ["--webpack"],
      ["--experimental-https"],
      ["--experimental-https-key", "k"],
      ["--experimental-upload-trace", "x"],
      ["--disable-source-maps"],
      ["-h"],
      ["--help"],
      ["-pH"],
      ["--PORT", "3001"],
      ["--port 3001"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(USAGE);
    }
  });

  it("refuses attached short port forms", () => {
    for (const argv of [["-p=3001"], ["-p3001"]]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(USAGE);
    }
  });

  it("refuses a repeated port flag", () => {
    for (const argv of [
      ["--port", "3001", "--port", "3002"],
      ["--port", "3001", "-p", "3002"],
      ["--port=3001", "--port=3002"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow();
    }
  });

  it("refuses a missing or invalid port value", () => {
    for (const argv of [
      ["--port"],
      ["-p"],
      ["--port="],
      ["--port", "-H"],
      ["--port", "--"],
      ["-p", "--hostname=0.0.0.0"],
      ["--port", "0"],
      ["--port", "65536"],
      ["--port", "99999"],
      ["--port", "03001"],
      ["--port", "3001a"],
      ["--port", " 3001"],
      ["--port", "+3001"],
      ["--port", "3e3"],
      ["--port", "0x10"],
      ["--port", "3001.0"],
      ["--port", "-1"],
      ["--port=0.0.0.0"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow(/invalid port/);
    }
  });

  it("refuses the attempt-3 bypass inputs", () => {
    for (const argv of [
      [".", "--"],
      ["--", ".", "--"],
      [".", "--experimental-https-key"],
      [".", "--experimental-https-ca"],
      [".", "--experimental-upload-trace"],
      ["--experimental-https-key", "--hostname=localhost"],
    ]) {
      expect(() => nextDevArgs(argv), argv.join(" ")).toThrow();
    }
  });
});

describe("assertNodeOptionsSafe", () => {
  it("allows NODE_OPTIONS without inspect or debug", () => {
    for (const NODE_OPTIONS of [
      undefined,
      "",
      "   ",
      "--max-old-space-size=4096",
      "--enable-source-maps --max-old-space-size=4096",
      "--no-warnings",
    ]) {
      expect(() => assertNodeOptionsSafe({ NODE_OPTIONS }), String(NODE_OPTIONS)).not.toThrow();
    }
  });

  it("refuses inspect and debug in any spelling", () => {
    for (const NODE_OPTIONS of [
      "--inspect",
      "--inspect=9229",
      "--inspect=127.0.0.1:9229",
      "--inspect-brk",
      "--inspect-brk=0.0.0.0:9229",
      "--inspect-port=0.0.0.0:9230",
      "--inspect-wait",
      "--inspect-publish-uid=http",
      "--inspect_brk=0.0.0.0",
      "--debug-port=0.0.0.0:9229",
      "--inspect --debug-port=0.0.0.0:9229",
      "--debug_port=0.0.0.0",
      "--debug",
      "--debug-brk",
      "--INSPECT",
      "--Inspect-Brk=0.0.0.0",
      '"--inspect=0.0.0.0:9229"',
      "'--inspect'",
      '--ins"pect"=0.0.0.0:9229',
      "--ins\\pect",
      "--max-old-space-size=1 --inspect 192.168.1.5:9229",
      "--max-old-space-size=1\t--inspect",
      "-r ./debug-hook.js",
    ]) {
      expect(() => assertNodeOptionsSafe({ NODE_OPTIONS }), NODE_OPTIONS).toThrow(/NODE_OPTIONS/);
    }
  });
});

describe("devEnv", () => {
  it("sets the dev-token flag and keeps the rest", () => {
    expect(devEnv({ A: "1" })).toEqual({ A: "1", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" });
  });

  it("drops an inherited production-data flag in any letter case (plain dev never shows it)", () => {
    const out = devEnv({
      NEXT_PUBLIC_SIMAP_DEV_PROD: "1",
      next_public_simap_dev_prod: "1",
      A: "1",
    });
    expect(out).toEqual({ A: "1", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" });
  });
});
