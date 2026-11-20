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
  it("triggers only on push to release/v*", () => {
    expect(release).toMatch(/^on:\n {2}push:\n {4}branches: \["release\/v\*"\]\n/m);
    expect(release).not.toMatch(/pull_request|workflow_dispatch|schedule/);
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
  it("no ${{ inside run blocks", () => {
    for (const m of release.matchAll(/^ {8}run: \|\n((?: {10}.*\n|\n)+)/gm)) {
      expect(m[1]).not.toContain("${{");
    }
  });
  it("deploys nothing itself: GitHub runner, no docker compose, no ssh", () => {
    expect(release).toContain("runs-on: ubuntu-latest");
    expect(release).not.toMatch(/self-hosted|docker compose|\bssh\b/);
  });
});
