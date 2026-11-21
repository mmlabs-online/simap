// `pnpm dev` launcher (SIM-028): runs `next dev` bound to loopback with the dev-token flag set.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED = new Set(["127.0.0.1", "localhost", "::1"]);
const REFUSED =
  "[dev] the dev server must listen on 127.0.0.1, localhost or ::1 (it adds a bearer token)";

export function nextDevArgs(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : [...argv];
  const out = [];
  let hasHost = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-H" || a === "--hostname") {
      const host = args[++i];
      if (host === undefined || !ALLOWED.has(host)) throw new Error(REFUSED);
      hasHost = true;
      out.push(a, host);
    } else if (a.startsWith("--hostname=")) {
      if (!ALLOWED.has(a.slice("--hostname=".length))) throw new Error(REFUSED);
      hasHost = true;
      out.push(a);
    } else if (/^-[^-]/.test(a) && a.includes("H")) {
      // Attached forms: -H<host>, -H=<host>, and short-flag clusters containing H.
      const value = a.slice(a.indexOf("H") + 1).replace(/^=/, "");
      if (!ALLOWED.has(value)) throw new Error(REFUSED);
      hasHost = true;
      out.push(a);
    } else {
      out.push(a);
    }
  }
  return hasHost ? ["dev", ...out] : ["dev", "-H", "127.0.0.1", ...out];
}

export function devEnv(env) {
  return { ...env, NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" };
}

function main() {
  let args;
  try {
    args = nextDevArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [next, ...args], {
    stdio: "inherit",
    env: devEnv(process.env),
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
