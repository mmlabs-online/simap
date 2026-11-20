import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Next inlines NEXT_PUBLIC_* only for literal `process.env.NAME` reads, and `production` must be a build-time constant.
const source = readFileSync(join(process.cwd(), "src/ui/auth/runtime.ts"), "utf8");

describe("runtime.ts env reads", () => {
  it("reads both NEXT_PUBLIC names and NODE_ENV literally; no dynamic access or destructuring", () => {
    expect(source).toContain("process.env.NEXT_PUBLIC_MM_IDENTITY_BASE");
    expect(source).toContain("process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(source).toContain('process.env.NODE_ENV === "production"');
    expect(source).not.toMatch(/process\.env\[/);
    expect(source).not.toMatch(/\{[^}]*\}\s*=\s*process\.env/);
  });
});
