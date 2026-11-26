import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const MARKER = "/* SIM-068 auth world (aw-*) */";
const block = css.slice(css.indexOf(MARKER));

function tokens(selector: string): Record<string, string> {
  const start = block.indexOf(`${selector} {`);
  const body = block.slice(start, block.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--aw-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
  );
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const light = tokens(":root");
const dark = tokens('[data-theme="dark"]');

describe("auth world palette", () => {
  it("light and dark aw tokens meet AA", () => {
    for (const t of [light, dark]) {
      expect(ratio(t["--aw-ink"]!, t["--aw-bg"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["--aw-muted"]!, t["--aw-bg"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["--aw-serif-ink"]!, t["--aw-bg"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["--aw-ink"]!, t["--aw-strip"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["--aw-on-accent"]!, t["--aw-accent"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t["--aw-accent"]!, t["--aw-bg"]!)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the aw block defines every token in both themes and only appends", () => {
    expect(css.split(MARKER)).toHaveLength(2);
    expect(css.indexOf(MARKER)).toBeGreaterThan(css.lastIndexOf(".px-scene-canvas"));
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(8);
    for (const v of [...Object.values(light), ...Object.values(dark)])
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("the aw block has no animation or transition", () => {
    expect(block).not.toMatch(/animation|transition|@keyframes/);
  });
});
