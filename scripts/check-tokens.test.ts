import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWLIST,
  compareToPending,
  findViolations,
  isAllowed,
  isScanned,
  scanRepo,
} from "./check-tokens.mjs";

const TSX = "src/ui/X.tsx";
const CSS = "src/app/x.css";
const rules = (text: string, path = TSX) => findViolations(path, text).map((v) => v.rule);
const PENDING_FILE = "scripts/check-tokens.pending.json";
// Slice 7 deleted the pending list: a missing file is {} and every file must be clean.
const pending: Record<string, number> = existsSync(PENDING_FILE)
  ? JSON.parse(readFileSync(PENDING_FILE, "utf8"))
  : {};
const found = scanRepo();
const counts = Object.fromEntries(Object.entries(found).map(([p, v]) => [p, v.length]));

describe("rules", () => {
  it("flags each rule once with the right id and 1-based line", () => {
    const cases: [string, string][] = [
      ['x = "bg-[#ED5B35]"', "hex"],
      ['style={{ color: "rgba(0,0,0,.5)" }}', "color-fn"],
      ['x = "shadow-[0_1px_2px_#000]"', "shadow-arb"],
      ['x = "rounded-[10px]"', "rounded-arb"],
      ['x = "rounded-t-[4px]"', "rounded-arb"],
      ['x = "font-[Georgia]"', "font-arb"],
      ['x = "text-[13px]"', "text-arb"],
      ['x = "ease-[cubic-bezier(.2,0,0,1)]"', "ease-arb"],
      ['x = "duration-[120ms]"', "duration-arb"],
      ['x = "min-h-[68px]"', "arbitrary-px"],
      ['x = "p-7"', "spacing-scale"],
    ];
    for (const [text, rule] of cases) {
      const v = findViolations(TSX, `const a = 1;\n${text}`);
      expect(v.map((x) => x.rule)).toContain(rule);
      expect(v.every((x) => x.line === 2)).toBe(true);
    }
  });

  it("hex: accepts anchors, entities, odd lengths and comments; flags real colours", () => {
    for (const ok of [
      'href="#bad"',
      "&#123;",
      "#12",
      "#12345",
      "// #fff",
      "/* #fff */",
      "x // #ED5B35",
    ]) {
      expect(rules(ok)).toEqual([]);
    }
    for (const bad of ["#fff", "#FFFF", "#ed5b35", "#ED5B35AA", '"#ffffff"']) {
      expect(rules(`x = "${bad}"`)).toContain("hex");
    }
  });

  it("color-fn: flags rgb/rgba/hsl/hsla, ignores mixSrgb and color-mix", () => {
    for (const fn of ["rgb(", "rgba(", "hsl(", "hsla("]) {
      expect(rules(`x = "${fn}0,0,0)"`)).toEqual(["color-fn"]);
    }
    expect(rules("mixSrgb(a, b)")).toEqual([]);
    expect(rules("x = 'color-mix(in srgb, var(--a), var(--b))'")).toEqual([]);
  });

  it("spacing-scale: allows the scale, flags the rest", () => {
    const ok =
      "p-0 px-1 gap-2 mt-3 py-4 m-5 gap-x-6 space-y-8 p-12 -mt-4 md:px-6 px-px px-card".split(" ");
    for (const c of ok) expect(rules(`x = "${c}"`), c).toEqual([]);
    const bad = "p-7 mt-10 px-2.5 gap-1.5 -mt-0.5 md:gap-16 space-x-9".split(" ");
    for (const c of bad) expect(rules(`x = "${c}"`), c).toEqual(["spacing-scale"]);
  });

  it("arbitrary values", () => {
    expect(rules('x = "top-[3px]"')).toEqual(["arbitrary-px"]);
    expect(rules('x = "w-[var(--x)] grid-cols-[1fr_1fr]"')).toEqual([]);
    expect(rules('x = "text-[var(--x)]"')).toEqual(["text-arb"]);
  });

  it("css declarations", () => {
    for (const bad of [
      "border-radius: 8px",
      "border-radius: 0 0 4px 4px",
      "box-shadow: 0 1px 2px var(--c)",
      "font-size: 13px",
      'font-family: "Manrope", sans-serif',
    ]) {
      expect(rules(`a { ${bad}; }`, CSS), bad).toHaveLength(1);
    }
    for (const ok of [
      "border-radius: var(--radius-lg)",
      "border-radius: 50%",
      "box-shadow: var(--shadow-card)",
      "box-shadow: none",
      "font-size: var(--text-label)",
      "font-family: var(--font-family-sans)",
      "--font-family-sans: ui-monospace, monospace",
    ]) {
      expect(rules(`a { ${ok}; }`, CSS), ok).toEqual([]);
    }
    const v = findViolations(CSS, "a {\n  box-shadow:\n    0 1px 2px red,\n    0 2px 4px blue;\n}");
    expect(v).toEqual([expect.objectContaining({ rule: "css-shadow", line: 2 })]);
  });

  it("class-name look-alikes are not flagged", () => {
    const names =
      "px-card p-card-x shadow-card rounded-lg text-label font-heading ease-out duration-150 top-2 group-hover:flex";
    expect(rules(`x = "${names}"`)).toEqual([]);
  });

  it("ignores tests, non-src and other extensions", () => {
    const text = 'x = "bg-[#fff]"';
    expect(findViolations("src/ui/X.test.tsx", text)).toEqual([]);
    expect(findViolations("scripts/x.ts", text)).toEqual([]);
    expect(findViolations("src/ui/x.json", text)).toEqual([]);
    expect(isScanned("src/ui/X.tsx")).toBe(true);
    expect(isScanned("src/ui/X.test.ts")).toBe(false);
  });

  it("gives one entry per match, sorted by line", () => {
    const v = findViolations(TSX, 'a = "p-7"\nb = "p-7 mt-10"');
    expect(v.map((x) => x.line)).toEqual([1, 2, 2]);
  });
});

describe("allowlist", () => {
  it("has reasons, valid patterns and no stale entries", () => {
    const files = scanRepoPaths();
    for (const { pattern, reason } of ALLOWLIST) {
      expect(reason.length).toBeGreaterThan(0);
      expect(pattern.endsWith("/**") || !pattern.includes("*")).toBe(true);
      expect(
        files.some((f) => isAllowed(f) && matches(pattern, f)),
        pattern,
      ).toBe(true);
    }
  });

  it("matches prefix and exact patterns", () => {
    expect(isAllowed("src/lib/sprites/avatar.ts")).toBe(true);
    expect(isAllowed("src/styles/tokens.css")).toBe(true);
    expect(isAllowed("src/ui/Avatar.tsx")).toBe(false);
  });
});

describe("pending", () => {
  it("is a sorted flat object of positive integers for scanned files", () => {
    const keys = Object.keys(pending);
    expect(keys).toEqual([...keys].sort());
    for (const [path, n] of Object.entries(pending)) {
      expect(Number.isInteger(n) && n > 0, path).toBe(true);
      expect(isScanned(path) && !isAllowed(path) && existsSync(path), path).toBe(true);
    }
  });

  it("compareToPending reports new, shrunk and stale", () => {
    const r = compareToPending({ a: 3, b: 1, c: 2 }, { a: 2, b: 2, c: 2, d: 1, e: 1 });
    expect(r.newViolations).toEqual(["a"]);
    expect(r.shrunk).toEqual([{ path: "b", was: 2, now: 1 }]);
    expect(r.stale).toEqual(["d", "e"]);
  });
});

describe("repo", () => {
  it("every scanned file matches its pending count (new violations fail, shrinking must be recorded)", () => {
    const r = compareToPending(counts, pending);
    const lines = [
      ...r.newViolations.map((p) => `${p}: now ${counts[p]}, pending ${pending[p] ?? 0}`),
      ...r.shrunk.map((s) => `${s.path}: was ${s.was}, now ${s.now}, lower the pending value`),
      ...r.stale.map((p) => `${p}: no violations, remove from the pending list`),
    ];
    expect(lines).toEqual([]);
  });

  it("the pending list is gone and src has zero violations (AC 1b)", () => {
    expect(existsSync(PENDING_FILE)).toBe(false);
    expect(counts).toEqual({});
  });
});

describe("cli", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/check-tokens.mjs", ...args], { encoding: "utf8" });

  it("passes on the repo and --list equals the pending file", () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("check-tokens:");
    const l = run("--list");
    expect(l.status).toBe(0);
    expect(JSON.parse(l.stdout)).toEqual(pending);
  });
});

function matches(pattern: string, path: string) {
  return pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern;
}

function scanRepoPaths() {
  return spawnSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .stdout.split("\n")
    .filter(Boolean);
}
