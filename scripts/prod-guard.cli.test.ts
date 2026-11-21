// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const ENTRIES = [
  "scripts/migrate-dev.mjs",
  "db/seed-dev.js",
  "scripts/test-db.mjs",
  "scripts/schema-check.mjs",
  "scripts/migrate-smoke.mjs",
];
const LOCAL = "postgres://simap:secret-pw@127.0.0.1:5432/simap";
const TARGETS: [string, Record<string, string>][] = [
  ["port 15432", { DATABASE_URL: "postgres://simap:secret-pw@127.0.0.1:15432/simap" }],
  ["SIMAP_DB_TARGET=production", { DATABASE_URL: LOCAL, SIMAP_DB_TARGET: "production" }],
  [
    "override port",
    {
      DATABASE_URL: "postgres://simap:secret-pw@127.0.0.1:16000/simap",
      SIMAP_PROD_TUNNEL_PORT: "16000",
    },
  ],
  ["PGPORT=15432", { DATABASE_URL: LOCAL, PGPORT: "15432" }],
  ["?port=15432", { DATABASE_URL: `${LOCAL}?port=15432` }],
];

// Minimal env: the developer's PG*, SIMAP_* and .env.local must not affect the run.
function runEntry(entry: string, extra: Record<string, string>) {
  const env = { PATH: process.env.PATH, ...extra } as unknown as NodeJS.ProcessEnv;
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  const r = spawnSync(process.execPath, [path.join(root, entry)], {
    env,
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("production guard on the dev scripts", () => {
  for (const entry of ENTRIES) {
    for (const [label, extra] of TARGETS) {
      it(`${entry} exits 2 on ${label}`, () => {
        const r = runEntry(entry, extra);
        expect(r.code).toBe(2);
        expect(r.stdout).toBe("");
        expect(r.stderr).toMatch(/refus/i);
        expect(`${r.stdout}${r.stderr}`).not.toContain("secret-pw");
      });
    }
  }

  it("`pnpm migrate` runs the guarded wrapper", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.scripts.migrate).toContain("scripts/migrate-dev.mjs");
    expect(pkg.scripts.migrate).not.toContain("db/migrate.js");
  });

  it("NODE_ENV=production does not bypass the wrapper", () => {
    const r = runEntry("scripts/migrate-dev.mjs", { DATABASE_URL: LOCAL, NODE_ENV: "production" });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/refus/i);
  });
});
