// Heuristic regex scan (it cannot see strings built in code): user-facing text must live in src/ui/copy.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PROPS =
  "aria-label|title|placeholder|alt|label|subtitle|submitLabel|cancelLabel|emptyText|description";
const JSX_TEXT = />([^<>{}();=]*\p{L}[^<>{}();=]*)</gu;
const PROP_LITERAL = new RegExp(`\\b(?:${PROPS})=(?:"[^"]*"|'[^']*')`);

function findLiterals(source: string): string[] {
  const found: string[] = [];
  const lines = source.split("\n").filter((l) => !/\/\/ copy-ok: \S/.test(l));
  for (const m of lines.join("\n").matchAll(JSX_TEXT)) {
    if (m[1].trim()) found.push(m[1].trim());
  }
  for (const l of lines) {
    const m = PROP_LITERAL.exec(l);
    if (m) found.push(m[0]);
  }
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const norm = (p: string) => p.replace(/\\/g, "/");

describe("copy rules", () => {
  it("components contain no user-facing literals", () => {
    expect(findLiterals("<p>Hello</p>")).toEqual(["Hello"]);
    expect(findLiterals('<a aria-label="Hi" />')).toEqual(['aria-label="Hi"']);
    expect(findLiterals("<b>\n  Hello\n</b>")).toEqual(["Hello"]);
    expect(findLiterals("<p>{shellCopy.x}</p>")).toEqual([]);
    expect(findLiterals('<a aria-label="Hi" /> // copy-ok: fixture')).toEqual([]);

    const files = [...walk(join(ROOT, "src/ui")), ...walk(join(ROOT, "src/app"))]
      .map(norm)
      .filter((p) => p.endsWith(".tsx") && !/\.test\./.test(p) && !p.includes("/src/app/api/"));
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.flatMap((f) =>
      findLiterals(readFileSync(f, "utf8")).map((x) => `${f}: ${x}`),
    );
    expect(offenders).toEqual([]);
  });

  it("copy files contain no Vietnamese diacritics", () => {
    const dir = join(ROOT, "src/ui/copy");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(2);
    for (const f of files) {
      const s = readFileSync(join(dir, f), "utf8").normalize("NFD");
      expect(s, f).not.toMatch(/[̀-ͯ]|[đĐ]/);
    }
  });

  it("root layout declares lang en", () => {
    const s = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(s).toContain('lang="en"');
    expect(s).not.toContain('lang="vi"');
  });
});
