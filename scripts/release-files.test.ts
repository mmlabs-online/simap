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
  it("triggers only on push to release/[0-9]* (branch release/X.Y.Z, D57)", () => {
    expect(release).toMatch(/^on:\n {2}push:\n {4}branches: \["release\/\[0-9\]\*"\]\n/m);
    expect(release).not.toMatch(/pull_request|workflow_dispatch|schedule/);
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
  it("deploys nothing itself: macbook-runner (D60), no docker compose, no ssh", () => {
    expect(release).toContain("runs-on: [self-hosted, macbook-runner]");
    expect(release).not.toContain("ubuntu-latest");
    expect(release).not.toMatch(/docker compose|\bssh\b/);
  });
  it("deployment clone lives in RUNNER_TEMP and keeps no token", () => {
    const pr = stepRun("pull request on the deployment repo");
    expect(pr).toContain('"$RUNNER_TEMP/deployment"');
    expect(pr).toContain(
      "git remote set-url origin https://github.com/mmlabs-online/deployment.git",
    );
    expect(pr).toContain(
      'git push "https://x-access-token:$GH_TOKEN@github.com/mmlabs-online/deployment.git" "$branch"',
    );
    const cleanup = stepRun("cleanup");
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain('rm -rf "$RUNNER_TEMP/deployment" "$RUNNER_TEMP/docker"');
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
