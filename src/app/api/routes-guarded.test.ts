import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const API_DIR = fileURLToPath(new URL(".", import.meta.url));
const PROBES = new Set(["healthz/route.ts", "readyz/route.ts"]);

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return routes(p);
    return name === "route.ts" ? [p] : [];
  });
}

describe("api routes", () => {
  it("every route.ts except healthz/readyz uses withAuth", () => {
    const files = routes(API_DIR).map((p) => [relative(API_DIR, p).replaceAll("\\", "/"), p]);
    expect(files.length).toBeGreaterThan(0);
    for (const [rel, abs] of files) {
      if (PROBES.has(rel)) continue;
      const src = readFileSync(abs, "utf8");
      expect(src, rel).toMatch(
        /import\s*\{[^}]*\bwithAuth\b[^}]*\}\s*from\s*"@\/server\/http\/with-auth"/,
      );
      expect(src, rel).not.toMatch(/authorization/i);
      // Every exported HTTP method must be wrapped.
      for (const m of src.matchAll(
        /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b([^\n]*)/g,
      )) {
        expect(m[2], `${rel} ${m[1]}`).toMatch(/withAuth\(/);
      }
    }
  });
});
