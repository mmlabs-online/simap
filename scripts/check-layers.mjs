// R1 import guard (CLAUDE.md). Node built-ins only. Run: `pnpm check:layers`.
// Layers: proxy (src/proxy.ts) -> lib | api (src/app/api) -> server, lib | pages (src/app) -> ui, lib | ui -> lib | server -> lib | lib -> nothing.
// Every layer may also import itself. Also: non-test files in src/server start with `import "server-only"`.
// Known gap: non-literal dynamic imports (import(variable)) are not seen.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED = {
  proxy: ["proxy", "lib"],
  api: ["api", "server", "lib"],
  pages: ["pages", "ui", "lib"],
  ui: ["ui", "lib"],
  server: ["server", "lib"],
  lib: ["lib"],
};

const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;
const SPECIFIERS = [
  /\b(?:import|export)\s[^'";]*?\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];
const SERVER_ONLY = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*import\s+["']server-only["']/;

/** @param {string} p posix path starting with `src/` @returns {keyof typeof ALLOWED | null} */
function layerOf(p) {
  if (/^src\/proxy(?:\.test)?\.[cm]?[jt]sx?$/.test(p)) return "proxy";
  if (p.startsWith("src/app/api/")) return "api";
  if (p.startsWith("src/app/")) return "pages";
  for (const l of ["ui", "server", "lib"]) if (p.startsWith(`src/${l}/`)) return l;
  return null;
}

/** @param {string} file @param {string} spec */
function resolveSpecifier(file, spec) {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) return posix.join(posix.dirname(file), spec);
  return null;
}

/**
 * @param {{ path: string; source: string }[]} files paths are posix, relative to the repo root
 * @returns {{ file: string; specifier: string; rule: string }[]}
 */
export function findViolations(files) {
  const out = [];
  for (const { path, source } of files) {
    const from = layerOf(path);
    if (!from || !CODE.test(path)) continue;
    if (from === "server" && !TEST.test(path) && !SERVER_ONLY.test(source)) {
      out.push({
        file: path,
        specifier: "",
        rule: 'src/server files must start with import "server-only"',
      });
    }
    const seen = new Set();
    for (const re of SPECIFIERS) for (const m of source.matchAll(re)) seen.add(m[1]);
    for (const specifier of seen) {
      const target = resolveSpecifier(path, specifier);
      const to = target && layerOf(target);
      if (to && !ALLOWED[from].includes(to)) {
        out.push({ file: path, specifier, rule: `${from} must not import ${to}` });
      }
    }
  }
  return out;
}

function main() {
  const files = readdirSync("src", { recursive: true })
    .map((p) => `src/${String(p).split("\\").join("/")}`)
    .filter((p) => statSync(p).isFile())
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
  const violations = findViolations(files);
  for (const v of violations) console.error(`${v.file}: ${v.specifier} (${v.rule})`);
  if (violations.length > 0) process.exit(1);
  console.log(`check-layers: ${files.length} files, no violations`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
