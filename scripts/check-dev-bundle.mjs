// `pnpm check:dev-bundle` (SIM-028.1): after `pnpm build`, fails if the client bundle holds dev-token code or strings.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// "No usable dev token" is the sentinel taken from src/ui/copy/dev-token.ts (guarded by the test); minifiers rename
// `DevGate`, so the strings carry the proof. The next three are the dev:prod flag and the badge labels; the last is the
// room map demo fixture marker (SIM-024.1, src/app/dev/roommap/fixture.ts).
export const FORBIDDEN = [
  "DevGate",
  "[dev-token]",
  "pnpm dev:token",
  ".config/simap",
  "dev-token",
  "dev:token",
  "No usable dev token",
  "SIMAP_DEV_TOKEN",
  "SIMAP_DEV_PROD",
  "Production data",
  "Dev token",
  "simap-roommap-fixture-9c41",
];

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

/** `{ file, marker }` for every forbidden marker in any file under `dir` (maps included). Throws if nothing was scanned. */
export function findForbidden(dir) {
  const files = filesUnder(dir);
  if (files.length === 0) throw new Error(`no files under ${dir}`);
  const found = [];
  for (const file of files) {
    const data = readFileSync(file);
    for (const marker of FORBIDDEN) if (data.includes(marker)) found.push({ file, marker });
  }
  return found;
}

function main() {
  const dir = resolve(".next", "static");
  let found;
  try {
    found = findForbidden(dir);
  } catch {
    console.error("check-dev-bundle: .next/static is missing or empty: run pnpm build first");
    process.exit(1);
  }
  for (const f of found) console.error(`${f.file}: ${f.marker}`);
  if (found.length > 0) process.exit(1);
  console.log("check-dev-bundle: no dev-token strings in .next/static");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
