// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "migrate.js");

function runCli(databaseUrl?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;
  const r = spawnSync(process.execPath, [script], { env, encoding: "utf8", timeout: 30_000 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("node db/migrate.js", () => {
  it("exit 2 when DATABASE_URL is unset", () => {
    const r = runCli();
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/DATABASE_URL is not set/);
  });

  it("exit 1 on unreachable host; output has no URL/password/host", () => {
    const url = "postgres://simap:s3cretpw@127.0.0.1:1/simap";
    const r = runCli(url);
    expect(r.code).toBe(1);
    expect(r.out).not.toContain("s3cretpw");
    expect(r.out).not.toContain("127.0.0.1");
    expect(r.out).not.toContain(url);
  });
});
