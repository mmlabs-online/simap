import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { WITH_AUTH_MARK } from "@/server/http/with-auth";

const API_DIR = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../../test/fixtures/routes/", import.meta.url));
const PROBES = new Set(["healthz/route.ts", "readyz/route.ts"]);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return routes(p);
    return name === "route.ts" ? [p] : [];
  });
}

/** HTTP method exports that did not go through `withAuth` (no marker on the exported function). */
function unguardedMethods(mod: Record<string, unknown>): string[] {
  return METHODS.filter((m) => {
    if (!(m in mod)) return false;
    const fn = mod[m];
    return !(
      typeof fn === "function" &&
      (fn as unknown as Record<symbol, unknown>)[WITH_AUTH_MARK] === true
    );
  });
}

const load = (abs: string) => import(/* @vite-ignore */ pathToFileURL(abs).href);

describe("unguardedMethods", () => {
  it("flags fixture: unwrapped GET", async () => {
    expect(unguardedMethods(await load(join(FIXTURES, "unwrapped-get.ts")))).toEqual(["GET"]);
  });

  it("flags fixture: export { h as POST }", async () => {
    expect(unguardedMethods(await load(join(FIXTURES, "aliased-post.ts")))).toEqual(["POST"]);
  });

  it("flags fixture: HEAD and OPTIONS", async () => {
    expect(unguardedMethods(await load(join(FIXTURES, "head-options.ts")))).toEqual([
      "HEAD",
      "OPTIONS",
    ]);
  });

  it("accepts fixture: wrapped GET + non-method exports", async () => {
    expect(unguardedMethods(await load(join(FIXTURES, "wrapped.ts")))).toEqual([]);
  });
});

describe("api routes", () => {
  it("every real route.ts except healthz/readyz is guarded", async () => {
    const files = routes(API_DIR).map((p) => [relative(API_DIR, p).replaceAll("\\", "/"), p]);
    expect(files.length).toBeGreaterThan(0);
    for (const [rel, abs] of files) {
      if (PROBES.has(rel)) continue;
      const mod = await load(abs);
      expect(unguardedMethods(mod), rel).toEqual([]);
      expect(
        METHODS.some((m) => m in mod),
        `${rel} exports no HTTP method`,
      ).toBe(true);
      expect(readFileSync(abs, "utf8"), rel).not.toMatch(/authorization/i);
    }
  });
});
