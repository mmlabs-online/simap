// @vitest-environment node
// SIM-034 (D60): static checks on the workflows that run on the self-hosted macOS runner. They cannot run locally;
// the PR's own CI run is the end-to-end check.
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

describe("workflows on the self-hosted runner", () => {
  it("every job runs on [self-hosted, macbook-runner]", () => {
    for (const [name, s] of Object.entries(workflows)) {
      const runs = s.match(/^ {4}runs-on: \[self-hosted, macbook-runner\]/gm) ?? [];
      expect(runs.length, name).toBe(jobCount(s));
      expect(s, name).not.toContain("ubuntu-latest");
    }
  });
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
  it("PR-triggered jobs skip fork PRs", () => {
    const guard = "github.event.pull_request.head.repo.full_name == github.repository";
    expect(
      ci.match(
        new RegExp(`if: github.event_name == 'push' \\|\\| ${guard.replaceAll(".", "\\.")}`, "g"),
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
});
