// Builds public/sprites/office.png + office.json. Node built-ins only. Run: `pnpm sprites:pack`.
// Flags: --out <dir> (default public/sprites), --no-map (placeholders and exports only), --force (skip the overwrite guard).
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pack } from "./sprites/pack.mjs";

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--out");
  const outDir = i >= 0 ? resolve(args[i + 1] ?? "") : undefined;
  if (i >= 0 && !args[i + 1]) {
    console.error("sprites:pack: --out needs a directory");
    process.exit(1);
  }
  const r = pack({
    outDir,
    useMap: !args.includes("--no-map"),
    force: args.includes("--force"),
    log: (line) => console.warn(line),
  });
  if (!r.ok) {
    for (const e of r.errors) console.error(`error: ${e}`);
    process.exit(1);
  }
  const n = { export: 0, map: 0, placeholder: 0 };
  for (const s of Object.values(r.sources)) n[/** @type {keyof typeof n} */ (s)]++;
  console.log(
    `sprites:pack: ${Object.keys(r.sources).length} frames (${n.export} export, ${n.map} map, ${n.placeholder} placeholder)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
