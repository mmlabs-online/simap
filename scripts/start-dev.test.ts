import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const WIN = process.platform === "win32";
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";
const BASH = WIN ? GIT_BASH : "bash";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "simap-start-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Stub `node`: `-e` (the TTY probe) exits with $STUB_TTY, anything else is logged to $STUB_LOG.
const log = join(dir, "log.txt");
writeFileSync(
  join(dir, "node"),
  '#!/bin/sh\nif [ "$1" = "-e" ]; then exit "${STUB_TTY:-0}"; fi\necho "$@" >> "$STUB_LOG"\nexit 0\n',
);
chmodSync(join(dir, "node"), 0o755);

const usable = !WIN || existsSync(GIT_BASH);
const wrapper = (args: string[], env: Record<string, string>) =>
  spawnSync(BASH, ["scripts/start-dev.sh", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...env, STUB_LOG: log } as unknown as NodeJS.ProcessEnv,
  });
const pathWith = (first: string) => [first, process.env.PATH ?? ""].join(delimiter);

describe.skipIf(!usable)("start-dev.sh", () => {
  it("hands off to dev-prod.mjs with the arguments", () => {
    rmSync(log, { force: true });
    const r = wrapper(["--port", "3456"], { PATH: pathWith(dir), STUB_TTY: "0" });
    expect(r.status).toBe(0);
    expect(readFileSync(log, "utf8").trim()).toBe("scripts/dev-prod.mjs --port 3456");
  });

  it("no TTY and no usable winpty: exit 1, names a supported terminal, launcher not run", () => {
    rmSync(log, { force: true });
    const r = wrapper([], { PATH: pathWith(dir), STUB_TTY: "1" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("interactive terminal");
    expect(r.stderr).toContain("PowerShell");
    expect(existsSync(log)).toBe(false);
  });

  const bare = WIN ? "C:\\Program Files\\Git\\usr\\bin" : "/usr/bin:/bin";
  const hasNode =
    !WIN && spawnSync("sh", ["-c", "PATH=/usr/bin:/bin command -v node"]).status === 0;
  it.skipIf(hasNode)("node missing: exit 1, names node", () => {
    const r = wrapper([], { PATH: bare });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("node not found");
  });

  it("cd ignores CDPATH, so nothing extra is printed", () => {
    rmSync(log, { force: true });
    const r = wrapper([], { PATH: pathWith(dir), STUB_TTY: "0", CDPATH: dir });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    expect(readFileSync(log, "utf8").trim()).toBe("scripts/dev-prod.mjs");
  });

  it("bash -n passes", () => {
    const r = spawnSync(BASH, ["-n", "scripts/start-dev.sh"], { cwd: ROOT, encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });
});

describe.skipIf(!WIN)("start-dev.ps1", () => {
  const sys32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const ps = join(sys32, "WindowsPowerShell", "v1.0", "powershell.exe");
  const psLog = join(dir, "ps-log.txt");
  const nodeOnly = join(dir, "ps-node");
  const withFnm = join(dir, "ps-fnm");
  mkdirSync(nodeOnly);
  mkdirSync(withFnm);
  writeFileSync(
    join(nodeOnly, "node.cmd"),
    '@echo off\r\nif "%~1"=="--version" (echo %STUB_VERSION%& exit /b 0)\r\necho node %*>>"%STUB_LOG%"\r\nexit /b 7\r\n',
  );
  writeFileSync(
    join(withFnm, "fnm.cmd"),
    '@echo off\r\necho fnm %*>>"%STUB_LOG%"\r\nexit /b 5\r\n',
  );
  const run = (args: string[], path: string[], version = "v22.1.0") => {
    rmSync(psLog, { force: true });
    return spawnSync(
      ps,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(ROOT, "scripts", "start-dev.ps1"),
        ...args,
      ],
      {
        cwd: dir,
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: [...path, sys32].join(delimiter),
          STUB_LOG: psLog,
          STUB_VERSION: version,
        },
      },
    );
  };

  it("Node 22: hands off with the arguments and keeps the exit code", () => {
    const r = run(["--port", "3456"], [nodeOnly]);
    expect(r.status).toBe(7);
    expect(readFileSync(psLog, "utf8").trim()).toBe("node scripts/dev-prod.mjs --port 3456");
  }, 40_000);

  it("another Node with fnm: runs through fnm on Node 22", () => {
    const r = run(["--port", "3456"], [nodeOnly, withFnm], "v20.1.0");
    expect(r.status).toBe(5);
    expect(readFileSync(psLog, "utf8").trim()).toBe(
      "fnm exec --using=22 -- node scripts/dev-prod.mjs --port 3456",
    );
  }, 40_000);

  it("no Node 22 and no fnm: exit 1, names Node 22, launcher not run", () => {
    const r = run([], [nodeOnly], "v20.1.0");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Node 22 not found");
    expect(existsSync(psLog)).toBe(false);
  }, 40_000);
});
