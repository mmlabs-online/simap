import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("bash -n passes", () => {
    const r = spawnSync(BASH, ["-n", "scripts/start-dev.sh"], { cwd: ROOT, encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });
});
