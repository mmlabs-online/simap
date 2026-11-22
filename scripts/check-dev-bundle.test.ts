import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FORBIDDEN, findForbidden } from "./check-dev-bundle.mjs";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "devbundle-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("findForbidden", () => {
  it("clean synthetic dir -> no findings", () => {
    const d = tmp();
    writeFileSync(join(d, "a.js"), "console.log('hello')");
    expect(findForbidden(d)).toEqual([]);
  });

  it("each marker in a nested file, including a .map -> finding with file and marker", () => {
    for (const marker of FORBIDDEN) {
      const d = tmp();
      mkdirSync(join(d, "chunks", "x"), { recursive: true });
      const file = join(d, "chunks", "x", "a.js.map");
      writeFileSync(file, `before ${marker} after`);
      expect(findForbidden(d), marker).toContainEqual({ file, marker });
    }
  });

  it("covers the dev:prod flag and badge strings", () => {
    expect(FORBIDDEN).toEqual(
      expect.arrayContaining(["SIMAP_DEV_PROD", "Production data", "Dev token"]),
    );
  });

  it("the demo marker is in fixture.ts and FORBIDDEN", () => {
    const fixture = readFileSync(
      new URL("../src/app/dev/roommap/fixture.ts", import.meta.url),
      "utf8",
    );
    expect(FORBIDDEN).toContain("simap-roommap-fixture-9c41");
    expect(fixture).toContain("simap-roommap-fixture-9c41");
  });

  it("missing dir and empty dir -> throws", () => {
    expect(() => findForbidden(join(tmp(), "nope"))).toThrow();
    expect(() => findForbidden(tmp())).toThrow();
  });

  it("the sentinel and badge labels are in src/ui/copy/dev-token.ts, and no marker is in shell.ts", () => {
    const copy = readFileSync(new URL("../src/ui/copy/dev-token.ts", import.meta.url), "utf8");
    for (const m of ["No usable dev token", "Production data", "Dev token"])
      expect(copy).toContain(m);
    const shell = readFileSync(new URL("../src/ui/copy/shell.ts", import.meta.url), "utf8");
    for (const m of FORBIDDEN) expect(shell).not.toContain(m);
  });
});
