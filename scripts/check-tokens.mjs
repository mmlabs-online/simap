// SIM-071 token guard. Node built-ins only. Runs inside `pnpm test` (scripts/check-tokens.test.ts).
// Flags hard-coded colours, arbitrary sizes and off-scale spacing in src/**/*.{ts,tsx,css}. Files that still have
// violations are listed with their count in scripts/check-tokens.pending.json (ratchet: it may only shrink).
// `node scripts/check-tokens.mjs` checks; `--list` prints the current counts as JSON.
// Known gaps: inline style numbers (borderRadius: 12), non-hex/rgb/hsl style strings, font-bold/extrabold weights.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** @type {{ pattern: string; reason: string }[]} */
export const ALLOWLIST = [
  { pattern: "src/styles/tokens.css", reason: "the one file that defines token values" },
  { pattern: "src/lib/sprites/**", reason: "pixel-art sprite data and art colours" },
  { pattern: "src/ui/roomlayout/paint.ts", reason: "canvas paint of the room layout, art colours" },
  { pattern: "src/ui/portal/photo-canvas.ts", reason: "canvas photo rendering colours" },
  {
    pattern: "src/ui/groups/group-form.ts",
    reason: "default group colour is user data, not UI chrome",
  },
];

const TS = ["ts", "tsx"];
const ALL = ["ts", "tsx", "css"];
const SCALE = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "12"]);
const LEN = /\d(?:px|rem|em)\b/;
const arb = (id, prefix) => ({ id, exts: TS, re: new RegExp(`(?<![\\w-])${prefix}-\\[`, "g") });

/** @type {{ id: string; exts: string[]; re: RegExp; test?: (m: RegExpMatchArray) => boolean }[]} */
const RULES = [
  {
    // 6/8 digits always; 3/4 digits need a digit or one repeated letter (#fff), so href="#bad" passes.
    id: "hex",
    exts: ALL,
    re: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|(?=[0-9a-fA-F]*\d)[0-9a-fA-F]{3,4}|([0-9a-fA-F])\1{2,3})(?![\w-])/g,
  },
  { id: "color-fn", exts: ALL, re: /\b(?:rgba?|hsla?)\(/g },
  arb("shadow-arb", "shadow"),
  {
    id: "rounded-arb",
    exts: TS,
    re: /(?<![\w-])rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|ee|es))?-\[/g,
  },
  arb("font-arb", "font"),
  arb("text-arb", "text"),
  arb("ease-arb", "ease"),
  arb("duration-arb", "duration"),
  { id: "arbitrary-px", exts: TS, re: /\[[^\]\s]*\d(?:px|rem|em)[^\]\s]*\]/g },
  {
    id: "spacing-scale",
    exts: TS,
    re: /(?<![\w-])-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?![\w.-])/g,
    test: (m) => !SCALE.has(m[1]),
  },
  {
    id: "css-radius",
    exts: ["css"],
    re: /(?<![\w-])border-radius\s*:\s*([^;}]*)/g,
    test: (m) => LEN.test(m[1]),
  },
  {
    id: "css-shadow",
    exts: ["css"],
    re: /(?<![\w-])box-shadow\s*:\s*([^;}]*)/g,
    test: (m) => {
      const v = m[1].trim();
      return !(v === "none" || v === "inherit" || /^var\([^)]*\)(?:\s*,\s*var\([^)]*\))*$/.test(v));
    },
  },
  {
    id: "css-font-size",
    exts: ["css"],
    re: /(?<![\w-])font-size\s*:\s*([^;}]*)/g,
    test: (m) => LEN.test(m[1]),
  },
  {
    id: "css-font-family",
    exts: ["css"],
    re: /(?<![\w-])font-family\s*:\s*([^;}]*)/g,
    test: (m) => {
      const v = m[1].trim();
      return !(v.startsWith("var(") || v === "inherit");
    },
  },
];

const blank = (s) => s.replace(/[^\n]/g, " ");

/** @param {string} path @param {string} text */
function stripComments(path, text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (path.endsWith(".css")) return noBlock;
  return noBlock.replace(/(^|\s)\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/** @param {string} path posix path relative to the repo root */
export function isScanned(path) {
  return (
    path.startsWith("src/") && /\.(?:ts|tsx|css)$/.test(path) && !/\.test\.[cm]?[jt]sx?$/.test(path)
  );
}

/** @param {string} path */
export function isAllowed(path) {
  return ALLOWLIST.some(({ pattern }) =>
    pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
}

/**
 * @param {string} path
 * @param {string} text
 * @returns {{ line: number; rule: string; match: string }[]}
 */
export function findViolations(path, text) {
  if (!isScanned(path) || isAllowed(path)) return [];
  const ext = path.slice(path.lastIndexOf(".") + 1);
  const src = stripComments(path, text);
  const out = [];
  for (const rule of RULES) {
    if (!rule.exts.includes(ext)) continue;
    for (const m of src.matchAll(rule.re)) {
      if (rule.test && !rule.test(m)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      out.push({ line, rule: rule.id, match: m[0].trim() });
    }
  }
  return out.sort((a, b) => a.line - b.line || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

/**
 * @param {Record<string, number>} counts actual violation counts per scanned file (zero counts may be omitted)
 * @param {Record<string, number>} pending
 */
export function compareToPending(counts, pending) {
  const newViolations = [];
  const stale = [];
  const shrunk = [];
  for (const [path, now] of Object.entries(counts)) {
    const was = pending[path] ?? 0;
    if (now > was) newViolations.push(path);
    else if (now < was && now > 0) shrunk.push({ path, was, now });
  }
  for (const path of Object.keys(pending)) if (!counts[path]) stale.push(path);
  return { newViolations: newViolations.sort(), stale: stale.sort(), shrunk };
}

/** Scans src/ and returns violations per file (files with at least one violation only). */
export function scanRepo(root = ".") {
  const found = {};
  for (const p of readdirSync(resolve(root, "src"), { recursive: true })) {
    const path = `src/${String(p).split("\\").join("/")}`;
    if (!isScanned(path) || !statSync(resolve(root, path)).isFile()) continue;
    const v = findViolations(path, readFileSync(resolve(root, path), "utf8"));
    if (v.length > 0) found[path] = v;
  }
  return found;
}

function readPending() {
  try {
    return JSON.parse(readFileSync("scripts/check-tokens.pending.json", "utf8"));
  } catch (e) {
    if (e && e.code === "ENOENT") return {};
    throw e;
  }
}

function main() {
  const found = scanRepo();
  const counts = Object.fromEntries(Object.entries(found).map(([p, v]) => [p, v.length]));
  if (process.argv.includes("--list")) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
    console.log(JSON.stringify(sorted, null, 2));
    return;
  }
  const pending = readPending();
  const r = compareToPending(counts, pending);
  for (const p of r.newViolations) {
    for (const v of found[p]) console.error(`${p}:${v.line} ${v.rule} ${v.match}`);
    console.error(`${p}: ${counts[p]} violations, pending ${pending[p] ?? 0} (fix the code)`);
  }
  for (const s of r.shrunk)
    console.error(`${s.path}: lower the pending value ${s.was} to ${s.now}`);
  for (const p of r.stale) console.error(`${p}: remove from the pending list`);
  if (r.newViolations.length + r.shrunk.length + r.stale.length > 0) process.exit(1);
  console.log(
    `check-tokens: ${Object.keys(counts).length} files, no violations outside the pending list`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
