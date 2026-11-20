import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (databaseUrl: string | undefined, extra: Record<string, string> = {}) => {
  const env: Record<string, string | undefined> = { PATH: process.env.PATH, ...extra };
  if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;
  const r = spawnSync(process.execPath, ["scripts/test-db.mjs"], {
    env: env as unknown as NodeJS.ProcessEnv,
    timeout: 15000,
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, err: r.stderr };
};

describe("test-db target guard", () => {
  it("exits 2 before connecting for a non-local DATABASE_URL", () => {
    for (const u of [
      "postgres://u:secret-pw@10.0.0.5:5432/simap",
      "postgres://u:secret-pw@localhost:5432/simap?host=10.0.0.5",
    ]) {
      const r = run(u);
      expect(r.status).toBe(2);
      expect(r.err).toMatch(/not local/);
      expect(r.out).not.toContain("secret-pw");
      expect(r.out).not.toMatch(/RUN|vitest/i);
    }
  });

  it("exits 2 with NODE_ENV=production", () => {
    const r = run("postgres://u:secret-pw@localhost:5432/simap", { NODE_ENV: "production" });
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/production/);
    expect(r.out).not.toContain("secret-pw");
  });

  it("exits 2 when DATABASE_URL is unset", () => {
    const r = run(undefined);
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/not set/);
  });
});
