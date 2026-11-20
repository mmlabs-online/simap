import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (databaseUrl: string, extra: Record<string, string> = {}) => {
  const r = spawnSync(process.execPath, ["scripts/schema-check.mjs"], {
    env: {
      PATH: process.env.PATH,
      DATABASE_URL: databaseUrl,
      ...extra,
    } as unknown as NodeJS.ProcessEnv,
    timeout: 15000,
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, err: r.stderr };
};

describe("schema-check target guard", () => {
  it("exits 2 before connecting for a non-local DATABASE_URL", () => {
    for (const u of [
      "postgres://u:secret-pw@10.0.0.5:5432/simap",
      "postgres://u:secret-pw@localhost:5432/simap?host=10.0.0.5",
    ]) {
      const r = run(u);
      expect(r.status).toBe(2);
      expect(r.err).toMatch(/not local/);
      expect(r.out).not.toContain("secret-pw");
      expect(r.out).not.toMatch(/pass:/);
    }
  });

  it("exits 2 with NODE_ENV=production", () => {
    const r = run("postgres://u:secret-pw@localhost:5432/simap", { NODE_ENV: "production" });
    expect(r.status).toBe(2);
    expect(r.err).toMatch(/production/);
    expect(r.out).not.toContain("secret-pw");
  });
});
