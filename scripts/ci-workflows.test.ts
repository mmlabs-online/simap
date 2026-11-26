// @vitest-environment node
// SIM-034 (D60), SIM-065 (D84): static checks on the workflows that run on GitHub-hosted or the self-hosted runner
// (SIMAP_RUNNER). They cannot run locally; the PR's own CI run is the end-to-end check.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const workflows: Record<string, string> = {
  "ci.yml": read(".github/workflows/ci.yml"),
  "risk-tier.yml": read(".github/workflows/risk-tier.yml"),
  "release.yml": read(".github/workflows/release.yml"),
};
const ci = workflows["ci.yml"];
const pgScript = read("scripts/ci-postgres.sh");
const scripts = [pgScript, read("scripts/ci-docker-config.sh"), read("scripts/check-image.sh")];
const all = [...Object.values(workflows), ...scripts];

/** Number of jobs: keys indented two spaces under the top-level `jobs:`. */
const jobCount = (s: string) => {
  const body = s.slice(s.indexOf("\njobs:\n"));
  return [...body.matchAll(/^ {2}[a-z][\w-]*:\s*$/gm)].length;
};
/** The step starting at `- name: <name>` (up to the next step). */
const step = (s: string, name: string) => {
  const i = s.indexOf(`- name: ${name}\n`);
  expect(i).toBeGreaterThan(-1);
  const next = s.indexOf("\n      - ", i + 1);
  return s.slice(i, next === -1 ? undefined : next);
};

const RUNS_ON_DISPATCH =
  "${{ ((inputs.runner != 'default' && inputs.runner) || vars.SIMAP_RUNNER) == 'macbook' && fromJSON('[\"self-hosted\",\"macbook-runner\"]') || 'ubuntu-latest' }}";
const RUNS_ON_VARS =
  "${{ vars.SIMAP_RUNNER == 'macbook' && fromJSON('[\"self-hosted\",\"macbook-runner\"]') || 'ubuntu-latest' }}";

/** `runs-on:` expression texts of all jobs (a trailing ` # comment` is dropped). */
const runsOn = (s: string) =>
  [...s.matchAll(/^ {4}runs-on: (.+)$/gm)].map((m) => m[1].replace(/ # .*$/, ""));

type Val = string | number | boolean | null | unknown[];
const truthy = (v: Val) => !(v === null || v === "" || v === false || v === 0 || Number.isNaN(v));
const num = (v: Val) =>
  v === null || v === "" ? 0 : typeof v === "string" ? Number(v) : Number(v);
const eq = (a: Val, b: Val) =>
  typeof a === "string" && typeof b === "string"
    ? a.toLowerCase() === b.toLowerCase()
    : num(a) === num(b);

/**
 * Evaluates the subset of GitHub expressions used by runs-on: ( ) && || == !=, single-quoted strings,
 * inputs.runner, vars.SIMAP_RUNNER, fromJSON('...'). Unknown tokens throw, so a changed expression fails loudly.
 */
function evalExpr(expr: string, ctx: { runner: string | null; variable: string | null }): Val {
  const body = expr.match(/^\$\{\{ (.+) \}\}$/)?.[1];
  if (!body) throw new Error(`not an expression: ${expr}`);
  const toks = body.match(/\(|\)|&&|\|\||==|!=|'[^']*'|[\w.]+/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const primary = (): Val => {
    const t = toks[i++];
    if (t === "(") {
      const v = or();
      if (toks[i++] !== ")") throw new Error("missing )");
      return v;
    }
    if (t?.startsWith("'")) return t.slice(1, -1);
    if (t === "inputs.runner") return ctx.runner;
    if (t === "vars.SIMAP_RUNNER") return ctx.variable;
    if (t === "fromJSON") {
      if (toks[i++] !== "(") throw new Error("fromJSON(");
      const arg = toks[i++];
      if (toks[i++] !== ")") throw new Error("fromJSON)");
      return JSON.parse(arg.slice(1, -1));
    }
    throw new Error(`unknown token ${t}`);
  };
  const cmp = (): Val => {
    let l = primary();
    while (peek() === "==" || peek() === "!=") {
      const op = toks[i++];
      const r = primary();
      l = op === "==" ? eq(l, r) : !eq(l, r);
    }
    return l;
  };
  const and = (): Val => {
    let l = cmp();
    while (peek() === "&&") {
      i++;
      const r = cmp();
      l = truthy(l) ? r : l;
    }
    return l;
  };
  const or = (): Val => {
    let l = and();
    while (peek() === "||") {
      i++;
      const r = and();
      l = truthy(l) ? l : r;
    }
    return l;
  };
  const v = or();
  if (i !== toks.length) throw new Error(`trailing token ${toks[i]}`);
  return v;
}

describe("workflows runner choice (D84)", () => {
  const MAC = ["self-hosted", "macbook-runner"];
  it("every job's runs-on is the D84 runner expression", () => {
    for (const [name, s] of Object.entries(workflows)) {
      const runs = runsOn(s);
      expect(runs.length, name).toBe(jobCount(s));
      for (const r of runs)
        expect(r, name).toBe(name === "risk-tier.yml" ? RUNS_ON_VARS : RUNS_ON_DISPATCH);
      expect(s, name).not.toMatch(/^ {4}runs-on: \[self-hosted/m);
    }
  });
  it("runs-on resolves per SIMAP_RUNNER and the dispatch input", () => {
    for (const [name, s] of Object.entries(workflows)) {
      for (const expr of runsOn(s)) {
        const at = (runner: string | null, variable: string | null) =>
          evalExpr(expr, { runner, variable });
        for (const v of [null, "", "github", "foo"])
          expect(at(null, v), `${name} ${v}`).toBe("ubuntu-latest");
        expect(at(null, "macbook"), name).toEqual(MAC);
        expect(at(null, "MacBook"), name).toEqual(MAC); // == is case-insensitive in GitHub expressions
        if (name === "risk-tier.yml") continue;
        expect(at("github", "macbook"), name).toBe("ubuntu-latest");
        expect(at("macbook", null), name).toEqual(MAC);
        expect(at("default", "macbook"), name).toEqual(MAC);
        expect(at("default", null), name).toBe("ubuntu-latest");
      }
    }
  });
  it("ci.yml and release.yml take a workflow_dispatch runner input", () => {
    for (const name of ["ci.yml", "release.yml"]) {
      expect(workflows[name], name).toMatch(
        /^on:\n(?:.*\n)*? {2}workflow_dispatch:\n {4}inputs:\n {6}runner:\n(?: {8}description: .*\n)? {8}type: choice\n {8}options: \[default, github, macbook\]\n {8}default: default\n/m,
      );
    }
    expect(workflows["risk-tier.yml"]).not.toContain("workflow_dispatch");
  });
  it("runner-neutral: no macOS-only commands or paths", () => {
    const macOnly =
      /\bbrew\b|\/opt\/homebrew|osascript|launchctl|\bsecurity (find|add|delete|unlock)-|stat -f|date -j|sed -i ''|colima|\.docker\/run/;
    for (const s of all) expect(s).not.toMatch(macOnly);
    const users = all.flatMap((s) => s.split("\n").filter((l) => l.includes("/Users/")));
    expect(users).toHaveLength(1);
    expect(users[0]).toMatch(/^ {10}prod=\/Users\/mingming\/\.config\/simap$/);
    expect(ci).toContain(users[0]);
  });
});

describe("workflows on either runner", () => {
  it("no services: containers", () => {
    for (const [name, s] of Object.entries(workflows))
      expect(s, name).not.toMatch(/^ {4}services:/m);
  });
  it("no sudo in workflows or CI scripts", () => {
    for (const s of all) expect(s).not.toMatch(/\bsudo\b/);
  });
  it("ci.yml never names production resources", () => {
    expect(ci.match(/\/Users\/mingming\/\.config\/simap/g)).toHaveLength(1);
    expect(ci).not.toMatch(/-p simap( |$)/m);
    expect(ci).not.toContain("5432:5432");
    expect(ci).not.toContain("--network host");
    expect(ci).not.toMatch(/docker system prune|image prune|rmi postgres/);
  });
  it("compose copy safety check matches the production env path, not the runner home", () => {
    // BUG-006: RUNNER_TEMP lives under /Users/mingming on the runner, so a home-wide pattern always fires.
    const s = step(ci, "compose config");
    const check = s.match(/^\s*if grep (?:-\w+ )?("?[^"\s]+"?) "\$d\/compose\.yml"; then$/m);
    expect(check).not.toBeNull();
    const prod = s.match(/^\s*prod=(\S+)$/m)?.[1];
    const raw = check![1].replace(/^"|"$/g, "");
    const pattern = raw === "$prod" ? prod : raw;
    expect(pattern).toBe("/Users/mingming/.config/simap");
    const runnerCopy = "/Users/mingming/actions-runner/_work/_temp/compose-ci/simap.env";
    expect(runnerCopy.includes(pattern!)).toBe(false);
    expect("env_file: /Users/mingming/.config/simap/simap.env".includes(pattern!)).toBe(true);
  });
  it("Postgres start/stop pairs with if: always()", () => {
    const jobs = ci.split(/^ {2}image:$/m);
    expect(jobs).toHaveLength(2);
    for (const [job, mode] of [
      [jobs[0], "host"],
      [jobs[1], "network"],
    ]) {
      expect(job).toContain("bash scripts/ci-postgres.sh sweep");
      expect(job).toContain(`bash scripts/ci-postgres.sh start ${mode}`);
      const stop = job.split("\n      - ").find((s) => s.includes("ci-postgres.sh stop"));
      expect(stop).toBeDefined();
      expect(stop).toContain("if: always()");
    }
  });
  it("ci-postgres.sh only touches simap-ci resources", () => {
    expect(pgScript).toContain("--label simap-ci=1");
    expect(pgScript).toContain("--tmpfs /var/lib/postgresql/data");
    expect(pgScript).toContain("rm -f -v");
    expect(pgScript).not.toMatch(/--network host|-p 5432|prune/);
    expect(pgScript).toContain("15432");
    for (const m of pgScript.matchAll(/--name "\$(\w+)"|network create [^"]*"\$(\w+)"/g)) {
      expect(["PG", "NET"]).toContain(m[1] ?? m[2]);
    }
    expect(pgScript).toContain('PG="simap-ci-pg-');
    expect(pgScript).toContain('NET="simap-ci-net-');
  });
  it("no GNU-only commands", () => {
    const gnu =
      /head -n -|\btimeout |sed -i|readlink -f|date -d|grep -P|xargs -r|\bmapfile\b|declare -A/;
    for (const s of all) expect(s).not.toMatch(gnu);
  });
  it("every checkout sets persist-credentials: false", () => {
    for (const [name, s] of Object.entries(workflows)) {
      const uses = s.match(/uses: actions\/checkout@v4/g) ?? [];
      const safe = s.match(/persist-credentials: false/g) ?? [];
      expect(safe.length, name).toBe(uses.length);
    }
  });
  it("every job has timeout-minutes", () => {
    for (const [name, s] of Object.entries(workflows)) {
      expect((s.match(/^ {4}timeout-minutes: \d+$/gm) ?? []).length, name).toBe(jobCount(s));
    }
  });
  it("PR-triggered jobs skip fork PRs; dispatch runs are not skipped", () => {
    const guard = "github.event.pull_request.head.repo.full_name == github.repository";
    expect(
      ci.match(
        new RegExp(
          `if: github.event_name == 'push' \\|\\| github.event_name == 'workflow_dispatch' \\|\\| ${guard.replaceAll(".", "\\.")}`,
          "g",
        ),
      ),
    ).toHaveLength(2);
    expect(workflows["risk-tier.yml"]).toContain(`if: ${guard}`);
  });
  it("no ${{ inside run blocks (ci.yml, risk-tier.yml)", () => {
    for (const name of ["ci.yml", "risk-tier.yml"]) {
      for (const m of workflows[name].matchAll(/^ {8}run: \|\n((?: {10}.*\n|\n)+)/gm)) {
        expect(m[1], name).not.toContain("${{");
      }
    }
  });
  it("risk-tier uses a portable last-line strip and checks host tools", () => {
    const rt = workflows["risk-tier.yml"];
    expect(rt).toContain("sed '$d' tier.txt");
    expect(step(rt, "host tools")).toContain("command -v gh");
  });
  it("image job uses the isolated docker config, a per-run tag and removes it", () => {
    expect(ci).toContain("bash scripts/ci-docker-config.sh");
    expect(ci).toContain("tags: simap-ci:${{ github.run_id }}");
    expect(step(ci, "cleanup")).toContain("if: always()");
  });
  it("never removes the docker config dir in a main step (the buildx post step needs it)", () => {
    for (const name of ["ci.yml", "release.yml"]) {
      expect(workflows[name], name).not.toMatch(/rm -rf[^\n]*RUNNER_TEMP\/docker"/);
    }
  });
  it("isolated docker config pins an auths entry (no host credential helper auto-detect) and a private umask", () => {
    const sh = read("scripts/ci-docker-config.sh");
    expect(sh).toContain('{"auths":{"ci.invalid":{}},');
    expect(sh.indexOf("umask 077")).toBeGreaterThan(-1);
    expect(sh.indexOf("umask 077")).toBeLessThan(sh.indexOf('mkdir -p "$dir"'));
  });
  it("every check-image docker run -d is labelled simap-ci=1", () => {
    const sh = read("scripts/check-image.sh");
    const runs = sh.match(/docker run -d[^\n]*/g) ?? [];
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r).toContain("--label simap-ci=1");
  });
});
