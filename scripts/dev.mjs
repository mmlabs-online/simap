// `pnpm dev` launcher (SIM-028): runs `next dev` bound to loopback with the dev-token flag set.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const USAGE =
  "[dev] usage: pnpm dev [--port <n> | -p <n> | --port=<n>]. pnpm dev always binds 127.0.0.1 and accepts no other next dev option (it adds a bearer token); use pnpm exec next dev for other options (no dev token).";
const BAD_PORT = "[dev] invalid port: use 1-65535";

function validPort(value) {
  if (value === undefined || !/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 65535) {
    throw new Error(BAD_PORT);
  }
  return value;
}

// Allowlist: only a port is accepted; the argv for next is built here from literals plus the validated port.
export function nextDevArgs(argv) {
  let port;
  let seen = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let value;
    if (a === "--port" || a === "-p") value = argv[++i];
    else if (a.startsWith("--port=")) value = a.slice("--port=".length);
    else throw new Error(USAGE);
    if (seen) throw new Error(USAGE);
    seen = true;
    port = validPort(value);
  }
  return ["dev", "-H", "127.0.0.1", ...(seen ? ["--port", port] : [])];
}

// Refuse inspect/debug in any spelling: Next copies NODE_OPTIONS to the dev child and the inspector is unauthenticated.
export function assertNodeOptionsSafe(env) {
  const squashed = String(env.NODE_OPTIONS ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (/inspect|debug/.test(squashed)) {
    throw new Error(
      "[dev] NODE_OPTIONS must not contain inspect or debug options (the Node inspector would expose the dev token); unset it, or use pnpm exec next dev",
    );
  }
}

export function devEnv(env) {
  return { ...env, NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" };
}

function main() {
  let args;
  try {
    assertNodeOptionsSafe(process.env);
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
