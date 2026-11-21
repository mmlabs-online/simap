// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

  it("image entry ignores the dev guard", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      SIMAP_DB_TARGET: "production",
      SIMAP_PROD_TUNNEL_PORT: "1",
      DATABASE_URL: "postgres://simap:s3cretpw@127.0.0.1:1/simap",
    };
    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8", timeout: 30_000 });
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/refusing|refused:/i);
  });

  it("imports stay inside the image", () => {
    const dockerfile = readFileSync(path.resolve(import.meta.dirname, "..", "Dockerfile"), "utf8");
    for (const file of ["migrate.js", "migrator.js"]) {
      const src = readFileSync(path.resolve(import.meta.dirname, file), "utf8");
      const specs = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
      for (const s of specs) {
        if (s.startsWith("./")) {
          expect(dockerfile, s).toContain(s.slice(2));
        } else {
          expect(s === "pg" || s.startsWith("node:"), s).toBe(true);
        }
      }
    }
  });
});
