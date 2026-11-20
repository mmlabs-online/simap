// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW = path.resolve(
  __dirname,
  "../deploy/deployment-repo/.github/workflows/deploy-simap.yml",
);
const yml = fs.readFileSync(WORKFLOW, "utf8");
const lines = yml.split("\n");

const hasBash = process.platform !== "win32" && spawnSync("bash", ["-c", "true"]).status === 0;
const d = hasBash ? describe : describe.skip;

/** Lines of the step whose `- name:` is `name` (up to the next step). */
function stepLines(name: string): string[] {
  const start = lines.findIndex((l) => l === `      - name: ${name}`);
  expect(start).toBeGreaterThan(-1);
  let end = start + 1;
  while (
    end < lines.length &&
    !lines[end].startsWith("      - ") &&
    !lines[end].startsWith("      #")
  )
    end++;
  return lines.slice(start, end);
}

/** The `run: |` block of a step, de-indented. */
function runBlock(name: string): string {
  const s = stepLines(name);
  const i = s.findIndex((l) => l === "        run: |");
  expect(i).toBeGreaterThan(-1);
  return s
    .slice(i + 1)
    .map((l) => l.slice(10))
    .join("\n");
}

const FAKE_PW = "fakepassword0123456789";
const DB_LINE = `DATABASE_URL=postgres://simap:${FAKE_PW}@postgres:5432/simap\n`;

const dirs: string[] = [];
afterEach(() => {
  for (const x of dirs.splice(0)) fs.rmSync(x, { recursive: true, force: true });
});

function setup(pwfile: string | null = FAKE_PW + "\n") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "envfile-"));
  dirs.push(root);
  const cwd = path.join(root, "checkout");
  fs.mkdirSync(path.join(cwd, "postgres/secrets/apps"), { recursive: true });
  if (pwfile !== null)
    fs.writeFileSync(path.join(cwd, "postgres/secrets/apps/simap.password"), pwfile);
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  const script = path.join(root, "step.sh");
  fs.writeFileSync(script, runBlock("envfile"));
  const envFile = path.join(home, ".config/simap/simap.env");
  const output = path.join(root, "output");
  fs.writeFileSync(output, "");
  function exec(envFileOverride?: string) {
    const r = spawnSync("bash", ["-e", script], {
      cwd,
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH ?? "",
        HOME: home,
        ENV_FILE: envFileOverride ?? envFile,
        DB_APP: "simap",
        GITHUB_OUTPUT: output,
      },
    });
    return { ...r, output: fs.readFileSync(output, "utf8") };
  }
  const seed = (text: string) => {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, text);
  };
  const dirFiles = () =>
    fs.existsSync(path.dirname(envFile)) ? fs.readdirSync(path.dirname(envFile)) : [];
  return { exec, seed, envFile, dirFiles, root };
}

d("envfile step (real run block)", () => {
  it("writes only DATABASE_URL, mode 600; changed=true first, false on re-run", () => {
    const t = setup();
    const a = t.exec();
    expect(a.status).toBe(0);
    expect(fs.readFileSync(t.envFile, "utf8")).toBe(DB_LINE);
    expect(fs.statSync(t.envFile).mode & 0o777).toBe(0o600);
    expect(a.output).toContain("changed=true");
    expect(a.stdout + a.stderr).not.toContain(FAKE_PW);
    const b = t.exec();
    expect(b.status).toBe(0);
    expect(b.output).toContain("changed=false");
    expect(t.dirFiles()).toEqual(["simap.env"]);
  });

  it("malformed or missing password file: exit 1, old file unchanged, no temp left, password not printed", () => {
    for (const pw of ["short\n", "bad pw with spaces 0123456789\n", null]) {
      const t = setup(pw);
      t.seed("OLD=1\n");
      const r = t.exec();
      expect(r.status).toBe(1);
      expect(r.stdout + r.stderr).not.toContain("bad pw");
      expect(fs.readFileSync(t.envFile, "utf8")).toBe("OLD=1\n");
      expect(t.dirFiles()).toEqual(["simap.env"]);
    }
  });

  it("ENV_FILE outside $HOME: exit 1, nothing written", () => {
    const t = setup();
    const outside = path.join(t.root, "elsewhere/simap.env");
    const r = t.exec(outside);
    expect(r.status).toBe(1);
    expect(fs.existsSync(outside)).toBe(false);
    expect(fs.existsSync(path.dirname(outside))).toBe(false);
  });
});

describe("deploy-simap.yml static checks", () => {
  it("job deploy runs only on main, has no environment key and no secrets.* reference", () => {
    expect(yml).toMatch(/^ {2}deploy:\n {4}if: github\.ref == 'refs\/heads\/main'\n {4}runs-on:/m);
    expect(yml).not.toMatch(/^\s*environment:/m);
    expect(yml).not.toMatch(/\$\{\{\s*secrets\./);
  });
  it("no run block contains ${{", () => {
    for (const name of [
      "release",
      "envfile",
      "pull",
      "backup",
      "migrate",
      "deploy",
      "rollback",
      "notify",
    ]) {
      expect(runBlock(name), name).not.toContain("${{");
    }
  });
  it("image pattern is ^mingming21400/simap:vX.Y.Z@sha256:<64 hex>$; deploy and rollback target service simap", () => {
    expect(runBlock("release")).toContain(
      String.raw`pattern='^mingming21400/simap:v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?@sha256:[0-9a-f]{64}$'`,
    );
    expect(runBlock("release")).toContain("SIMAP_IMAGE=");
    expect(runBlock("deploy")).toMatch(/\bup -d --wait .* simap$/m);
    expect(runBlock("rollback")).toContain('pull simap || ! "${compose[@]}" up -d --wait');
  });
  it("migrate runs before deploy, after backup and pull", () => {
    const at = (n: string) => lines.findIndex((l) => l === `      - name: ${n}`);
    expect(at("pull")).toBeLessThan(at("backup"));
    expect(at("backup")).toBeLessThan(at("migrate"));
    expect(at("migrate")).toBeLessThan(at("deploy"));
    expect(stepLines("deploy").join("\n")).toContain("steps.migrate.outcome == 'success'");
    expect(runBlock("migrate")).toContain("run --rm migrate");
  });
  it("deploy adds --force-recreate only when the env file changed or on workflow_dispatch", () => {
    const s = stepLines("deploy").join("\n");
    expect(s.match(/--force-recreate/g)).toHaveLength(1);
    expect(s).toContain(
      'if [ "$CHANGED" = "true" ] || [ "$EVENT" = "workflow_dispatch" ]; then recreate=(--force-recreate); fi',
    );
  });
});
