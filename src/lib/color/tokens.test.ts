import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, isOpaque, mixSrgb } from "./contrast";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const tokensCss = read("../../styles/tokens.css").replace(/\/\*[\s\S]*?\*\//g, "");
const globalsCss = read("../../app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

type Decl = { name: string; value: string };

/** tokens.css has no nested rules, so a flat `selector { declarations }` parse is enough. */
function parseBlocks(css: string) {
  const light: Decl[] = [];
  const dark: Decl[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const target = m[1].includes("data-theme") ? dark : light;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      target.push({ name: d[1], value: d[2].trim() });
    }
  }
  return { light, dark };
}

const { light, dark } = parseBlocks(tokensCss);
const lightMap = new Map(light.map((d) => [d.name, d.value]));
const darkMap = new Map(dark.map((d) => [d.name, d.value]));

const BRIEF_TOKENS = [
  "--color-workspace-primary",
  "--color-workspace-hover",
  "--color-pixel-primary",
  "--color-pixel-hover",
  "--color-canvas",
  "--color-surface",
  "--color-cream",
  "--color-tile",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-pixel",
  "--color-border",
  "--color-divider",
  "--color-focus",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
  "--color-room-floor",
  "--color-room-green",
  "--font-family-sans",
  "--font-family-mono",
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-8",
  "--space-12",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--radius-2xl",
  "--radius-full",
  "--shadow-card",
  "--shadow-dialog",
  "--shadow-pixel",
  "--breakpoint-md",
  "--breakpoint-lg",
  "--breakpoint-xl",
  "--size-control-min",
  "--size-sidebar",
  "--width-content",
  "--width-library",
  "--duration-ui",
  "--duration-step",
  "--duration-arrival",
];
const DERIVED_TOKENS = [
  "--color-workspace-action",
  "--color-workspace-action-hover",
  "--color-on-action",
  "--color-border-strong",
  "--color-success-tint",
  "--color-warning-tint",
  "--color-danger-tint",
  "--color-info-tint",
];

describe("tokens.css", () => {
  it("defines every brief token exactly once (light)", () => {
    for (const name of [...BRIEF_TOKENS, ...DERIVED_TOKENS]) {
      expect(light.filter((d) => d.name === name).length, name).toBe(1);
    }
    for (const name of ["caption", "label", "body", "subtitle", "title", "display", "hero"]) {
      for (const suffix of ["", "--line-height", "--font-weight"]) {
        expect(lightMap.has(`--text-${name}${suffix}`), `--text-${name}${suffix}`).toBe(true);
      }
    }
    expect(lightMap.get("--size-control-min")).toBe("44px");
    expect(new Set(light.map((d) => d.name)).size).toBe(light.length);
  });

  it("every --color-* token has a value in dark, and dark defines nothing that light lacks", () => {
    const colours = light.filter((d) => d.name.startsWith("--color-")).map((d) => d.name);
    for (const name of colours) expect(darkMap.has(name), name).toBe(true);
    for (const name of darkMap.keys()) expect(lightMap.has(name), name).toBe(true);
  });
});

/** Resolves a token to an opaque hex; tints are color-mix(in srgb, <fg> N%, <bg>) of other tokens. */
function resolve(map: Map<string, string>, name: string): string {
  const value = map.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  const mix = /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+(\d+)%,\s*var\((--[\w-]+)\)\)$/.exec(
    value,
  );
  if (mix) return mixSrgb(resolve(map, mix[1]), resolve(map, mix[3]), Number(mix[2]) / 100);
  if (!isOpaque(value)) throw new Error(`${name} is not an opaque hex: ${value}`);
  return value;
}

const t = (n: string) => `--color-${n}`;
const TEXT_PAIRS: [string, string][] = [
  ["text-primary", "canvas"],
  ["text-primary", "surface"],
  ["text-secondary", "canvas"],
  ["text-secondary", "surface"],
  ["text-pixel", "cream"],
  ["text-pixel", "tile"],
  ["on-action", "workspace-action"],
  ["on-action", "workspace-action-hover"],
  ["on-action", "pixel-primary"],
  ["on-action", "pixel-hover"],
];
for (const f of ["success", "warning", "danger", "info"]) {
  for (const bg of ["surface", "canvas", `${f}-tint`]) TEXT_PAIRS.push([f, bg]);
}
const NON_TEXT_PAIRS: [string, string][] = [
  ["focus", "canvas"],
  ["focus", "surface"],
  ["focus", "cream"],
  ["focus", "tile"],
  ["border-strong", "surface"],
  ["border-strong", "canvas"],
  ["workspace-primary", "surface"],
  ["workspace-primary", "canvas"],
  ["workspace-action", "surface"],
  ["workspace-action", "canvas"],
];

describe.each([
  ["light", lightMap],
  ["dark", darkMap],
] as const)("%s theme contrast", (theme, own) => {
  // dark inherits any token it does not override (none today, but stay correct)
  const map = new Map([...lightMap, ...own]);
  const ratio = (a: string, b: string) => contrastRatio(resolve(map, t(a)), resolve(map, t(b)));

  it(`${theme} pairs pass AA (text 4.5:1)`, () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it(`${theme}: focus ring and control border pass 3:1 (WCAG 1.4.11)`, () => {
    for (const [fg, bg] of NON_TEXT_PAIRS) {
      expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("globals.css", () => {
  it("focus ring uses --color-focus, 2px, with an offset", () => {
    const rule = /:focus-visible\s*\{([^}]*)\}/.exec(globalsCss);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/outline:\s*2px solid var\(--color-focus\)/);
    expect(rule![1]).toMatch(/outline-offset:\s*2px/);
  });

  it("field box ring, checkbox accent, state layer and no status-dot", () => {
    const field = /\.field-box:focus-within\s*\{([^}]*)\}/.exec(globalsCss);
    expect(field).not.toBeNull();
    expect(field![1]).toMatch(/outline:\s*2px solid var\(--color-focus\)/);
    expect(field![1]).toMatch(/outline-offset:\s*2px/);
    expect(globalsCss.indexOf(".field-box:focus-within")).toBeGreaterThan(
      globalsCss.search(/:focus-visible\s*\{/),
    );
    expect(globalsCss).toContain("accent-color: var(--color-workspace-action)");
    expect(globalsCss).toContain(".state-layer:not(:disabled):hover::after");
    expect(globalsCss).not.toContain(".status-dot");
  });

  it("reduced-motion block sets animation and transition to none", () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\n\})/.exec(globalsCss);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/animation:\s*none\s*!important/);
    expect(block![1]).toMatch(/transition:\s*none\s*!important/);
  });

  it("@theme inline does not redefine any token defined in tokens.css", () => {
    const inline = /@theme inline\s*\{([^}]*)\}/.exec(globalsCss);
    expect(inline).not.toBeNull();
    const names = [...inline![1].matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
    for (const name of names) {
      expect(lightMap.has(name), name).toBe(false);
    }
  });
});
