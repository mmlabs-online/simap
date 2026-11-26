// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const compose = read("deploy/deployment-repo/apps/simap/compose.yml");
const release = read(".github/workflows/release.yml");

/** Lines of one top-level service block (`  name:` up to the next `  other:` / top-level key). */
function service(name: string): string {
  const ls = compose.split("\n");
  const start = ls.findIndex((l) => l === `  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  let end = start + 1;
  while (end < ls.length && (ls[end] === "" || ls[end].startsWith("    "))) end++;
  return ls.slice(start, end).join("\n");
}

describe("compose.yml", () => {
  it("name simap; image from ${SIMAP_IMAGE:?...}; env file outside the checkout", () => {
    expect(compose).toMatch(/^name: simap$/m);
    expect(compose).toContain("image: ${SIMAP_IMAGE:?SIMAP_IMAGE is unset");
    expect(compose).toContain("env_file: /Users/mingming/.config/simap/simap.env");
  });
  it("both services are hardened and log-limited", () => {
    for (const s of [service("simap"), service("migrate")]) {
      expect(s).toContain("cap_drop: [ALL]");
      expect(s).toContain('security_opt: ["no-new-privileges:true"]');
      expect(s).toContain("driver: json-file");
      expect(s).toContain("max-size: 10m");
    }
  });
  it("simap is on [tunnel, db] with a /api/readyz healthcheck and no command", () => {
    const s = service("simap");
    expect(s).toContain("networks: [tunnel, db]");
    expect(s).toContain("127.0.0.1:3000/api/readyz");
    expect(s).not.toMatch(/^ {4}command:/m);
    expect(s).not.toMatch(/^ {4}profiles:/m);
  });
  it("only migrate runs db/migrate.js: db only, profile migrate", () => {
    const s = service("migrate");
    expect(s).toContain("networks: [db]");
    expect(s).toContain("profiles: [migrate]");
    expect(s).toContain('command: ["node", "db/migrate.js"]');
    expect(compose.match(/db\/migrate\.js/g)?.length).toBe(2); // header comment + command
    expect(compose.match(/^ {4}command:/gm)).toHaveLength(1);
  });
  it("publishes no ports and holds no secret value", () => {
    expect(compose).not.toMatch(/^\s*ports:/m);
    expect(compose).not.toContain("postgres://");
  });
});

describe("release.yml", () => {
  const stepRun = (name: string) => {
    const i = release.indexOf(`- name: ${name}\n`);
    expect(i).toBeGreaterThan(-1);
    const next = release.indexOf("\n      - ", i + 1);
    return release.slice(i, next === -1 ? undefined : next);
  };
  it("triggers only on push to release/[0-9]* and workflow_dispatch with the runner input (D57, D84)", () => {
    expect(release).toMatch(/^on:\n {2}push:\n {4}branches: \["release\/\[0-9\]\*"\]\n/m);
    const on = release.match(/^on:\n((?:[ #].*\n|\n)+)/m)![1];
    expect([...on.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1])).toEqual([
      "push",
      "workflow_dispatch",
    ]);
    expect([...on.matchAll(/^ {6}(\w+):/gm)].map((m) => m[1])).toEqual(["runner"]);
    expect(release).not.toMatch(/pull_request|schedule/);
  });
  it("guards still run first and check the ref and main ancestry (dispatch-safe)", () => {
    const afterCheckout = release.slice(release.indexOf("- uses: actions/checkout@v4"));
    expect(afterCheckout.indexOf("- name: guards")).toBeGreaterThan(-1);
    expect(afterCheckout.indexOf("\n      - name:")).toBe(
      afterCheckout.indexOf("\n      - name: guards"),
    );
    const guards = stepRun("guards");
    const tag = guards.indexOf('echo "tag=');
    expect(
      guards.indexOf('git merge-base --is-ancestor "$GITHUB_SHA" origin/main'),
    ).toBeGreaterThan(-1);
    expect(guards.indexOf('git merge-base --is-ancestor "$GITHUB_SHA" origin/main')).toBeLessThan(
      tag,
    );
    expect(guards.indexOf('"$GITHUB_REF_NAME" =~')).toBeGreaterThan(-1);
    expect(guards.indexOf('"$GITHUB_REF_NAME" =~')).toBeLessThan(tag);
    const refType = guards.indexOf('[ "$GITHUB_REF_TYPE" != branch ]');
    expect(refType).toBeGreaterThan(-1);
    expect(refType).toBeLessThan(guards.indexOf("git merge-base"));
  });
  it("release steps are unconditional on runner (no runner.os branching)", () => {
    expect(release).not.toMatch(/runner\.os|RUNNER_OS/i);
    expect(read(".github/workflows/ci.yml")).not.toMatch(/runner\.os|RUNNER_OS/i);
    expect(stepRun("docker config")).toContain("bash scripts/ci-docker-config.sh");
    expect(stepRun("cleanup")).toContain("if: always()");
  });
  it("accepts only release/X.Y.Z branches and tags them vX.Y.Z (D57)", () => {
    const guards = stepRun("guards");
    const m = guards.match(/\[\[ "\$GITHUB_REF_NAME" =~ (\S+) \]\]/);
    expect(m).not.toBeNull();
    const re = new RegExp(m![1]);
    for (const ok of ["release/0.1.0", "release/1.20.3"]) expect(re.test(ok)).toBe(true);
    for (const bad of [
      "release/v0.1.0",
      "release/0.1",
      "release/01.0.0",
      "release/0.1.0-rc1",
      "release/simap-0.1.0",
    ])
      expect(re.test(bad)).toBe(false);
    expect(guards).toContain('TAG="v${BASH_REMATCH[1]}"');
  });
  it("pushes linux/amd64 mingming21400/simap:<tag> with no attestations", () => {
    expect(release).toContain("platforms: linux/amd64");
    expect(release).toContain("provenance: false");
    expect(release).toContain("sbom: false");
    expect(release).toContain("tags: ${{ env.NAMESPACE }}/simap:${{ steps.version.outputs.tag }}");
    expect(release).toContain("NAMESPACE: mingming21400");
  });
  it("runs check-image.sh on the pushed digest before the deployment PR step", () => {
    const verify = stepRun("verify pushed digest");
    expect(verify).toContain('ref="$NAMESPACE/simap@$DIGEST"');
    expect(verify).toContain('bash scripts/check-image.sh "$ref"');
    expect(release.indexOf("- name: verify pushed digest")).toBeLessThan(
      release.indexOf("- name: pull request on the deployment repo"),
    );
  });
  it("release.env pins SIMAP_IMAGE by tag and digest, plus SIMAP_VERSION, and nothing else", () => {
    const pr = stepRun("pull request on the deployment repo");
    expect(pr).toContain('image_ref="$NAMESPACE/simap:$TAG@$DIGEST"');
    expect(pr).toContain('echo "SIMAP_IMAGE=$image_ref"');
    expect(pr).toContain('echo "SIMAP_VERSION=$TAG"');
    expect(pr.match(/^ {12}echo "[A-Z_]+=/gm)).toHaveLength(2);
    expect(pr).toContain('!= "apps/$APP/release.env"');
  });
  it("build and push passes the tag as build arg SIMAP_VERSION", () => {
    const build = stepRun("build and push");
    expect(build).toContain("build-args: SIMAP_VERSION=${{ steps.version.outputs.tag }}");
  });
  it("no ${{ inside run blocks", () => {
    for (const m of release.matchAll(/^ {8}run: \|\n((?: {10}.*\n|\n)+)/gm)) {
      expect(m[1]).not.toContain("${{");
    }
  });
  it("deploys nothing itself: runner from D84, no docker compose, no ssh", () => {
    const runsOn = release.match(/^ {4}runs-on: (.+?)(?: # .*)?$/m)![1];
    expect(runsOn).toBe(
      "${{ ((inputs.runner != 'default' && inputs.runner) || vars.SIMAP_RUNNER) == 'macbook' && fromJSON('[\"self-hosted\",\"macbook-runner\"]') || 'ubuntu-latest' }}",
    );
    expect(release).not.toMatch(/docker compose|\bssh\b/);
  });
  it("deployment clone lives in RUNNER_TEMP and keeps no token", () => {
    const pr = stepRun("pull request on the deployment repo");
    expect(pr).toContain('"$RUNNER_TEMP/deployment"');
    expect(pr).toContain('git push "https://github.com/mmlabs-online/deployment.git" "$branch"');
    const cleanup = stepRun("cleanup");
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain('rm -rf "$RUNNER_TEMP/deployment"');
    expect(cleanup).not.toMatch(/rm -rf[^\n]*docker/);
  });
  it("token-bearing git commands keep the token out of URLs and disable credential helpers", () => {
    expect(release).not.toContain("x-access-token:$GH_TOKEN@");
    for (const name of ["create version tag", "pull request on the deployment repo"]) {
      const s = stepRun(name);
      expect(s, name).toContain("GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0=");
      expect(s, name).toContain("http.https://github.com/.extraheader");
      expect(s.indexOf("GIT_CONFIG_COUNT"), name).toBeLessThan(s.search(/git (push|clone)/));
    }
  });
  it("docker logout only runs against the isolated DOCKER_CONFIG", () => {
    const cleanup = stepRun("cleanup");
    expect(cleanup).toContain(
      'if [ "${DOCKER_CONFIG:-}" = "$RUNNER_TEMP/docker" ]; then docker logout || true; fi',
    );
    expect(cleanup).not.toMatch(/^\s*docker logout/m);
  });
  it("login happens before the version tag is reserved", () => {
    const tag = release.indexOf("- name: create version tag");
    expect(release.indexOf("docker/login-action")).toBeGreaterThan(-1);
    expect(release.indexOf("docker/login-action")).toBeLessThan(tag);
    expect(release.indexOf("docker/setup-buildx-action")).toBeLessThan(tag);
  });
});

describe("Dockerfile", () => {
  const dockerfile = read("Dockerfile");
  const froms = [...dockerfile.matchAll(/^FROM /gm)].map((m) => m.index!);
  const buildStage = dockerfile.slice(froms[0], froms[1]);
  const runtimeStage = dockerfile.slice(froms[1]);
  it("ARG SIMAP_VERSION=dev only in the build stage, inline on the pnpm build RUN", () => {
    expect(froms).toHaveLength(2);
    expect(buildStage).toMatch(/^ARG SIMAP_VERSION=dev$/m);
    expect(buildStage).toMatch(/^RUN NEXT_PUBLIC_SIMAP_VERSION="\$SIMAP_VERSION" .*pnpm build$/m);
    expect(runtimeStage).not.toMatch(/^ARG /m);
    expect(runtimeStage).not.toContain("SIMAP_VERSION");
  });
  it("no ENV with SIMAP or NEXT_PUBLIC", () => {
    expect(dockerfile).not.toMatch(/^ENV .*(SIMAP|NEXT_PUBLIC)/m);
  });
});
