import { describe, expect, it } from "vitest";
import { findViolations } from "./check-layers.mjs";

const SO = 'import "server-only";\n';
const f = (path: string, source: string) => ({ path, source });

describe("check-layers findViolations", () => {
  it("allows the documented imports", () => {
    expect(
      findViolations([
        f(
          "src/app/api/x/route.ts",
          'import { a } from "@/server/x/service";\nimport { b } from "@/lib/x";',
        ),
        f("src/app/page.tsx", 'import { C } from "@/ui/c";'),
        f("src/ui/a.tsx", 'import { b } from "@/lib/x";'),
        f("src/server/x/service.ts", `${SO}import { b } from "@/lib/x";`),
        f("src/server/x/queries.ts", `// c\n/* d */\n${SO}`),
      ]),
    ).toEqual([]);
  });

  it("flags UI importing server", () => {
    const v = findViolations([f("src/ui/a.tsx", 'import x from "@/server/foo/service";')]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ file: "src/ui/a.tsx", specifier: "@/server/foo/service" });
  });

  it("flags page and layout importing server", () => {
    const v = findViolations([
      f("src/app/page.tsx", 'import x from "@/server/a/service";'),
      f("src/app/(x)/layout.tsx", 'import x from "@/server/a/service";'),
    ]);
    expect(v.map((i) => i.file)).toEqual(["src/app/page.tsx", "src/app/(x)/layout.tsx"]);
  });

  it("flags lib importing any other layer", () => {
    const v = findViolations([
      f(
        "src/lib/a.ts",
        'import "@/server/a/b";\nimport x from "@/ui/c";\nimport y from "@/app/d";',
      ),
    ]);
    expect(v).toHaveLength(3);
  });

  it("flags server importing ui or app", () => {
    expect(
      findViolations([f("src/server/x/service.ts", `${SO}import x from "@/ui/a";`)]),
    ).toHaveLength(1);
    expect(
      findViolations([f("src/server/x/service.ts", `${SO}import x from "@/app/a";`)]),
    ).toHaveLength(1);
  });

  it("resolves relative cross-layer imports", () => {
    expect(findViolations([f("src/ui/a.tsx", 'import "../server/x/service";')])).toHaveLength(1);
    expect(findViolations([f("src/ui/a.tsx", 'import "./b";')])).toEqual([]);
  });

  it("catches export-from, side-effect, dynamic import() and require", () => {
    for (const source of [
      'export { a } from "@/server/x";',
      'export * from "@/server/x";',
      'import "@/server/x";',
      'const m = await import("@/server/x");',
      'const m = require("@/server/x");',
    ]) {
      expect(findViolations([f("src/ui/a.tsx", source)]), source).toHaveLength(1);
    }
  });

  it("requires server-only in server modules", () => {
    expect(findViolations([f("src/server/x/service.ts", "export const a = 1;")])).toHaveLength(1);
    expect(findViolations([f("src/server/x/service.test.ts", "export const a = 1;")])).toEqual([]);
    expect(findViolations([f("src/server/README.md", "# x")])).toEqual([]);
  });

  it("ignores src/test and non-code files", () => {
    expect(
      findViolations([
        f("src/test/server-only-stub.ts", 'import "@/server/x";'),
        f("src/ui/a.css", '@import "@/server/x";'),
        f("src/ui/a.md", 'import "@/server/x";'),
      ]),
    ).toEqual([]);
  });
});
