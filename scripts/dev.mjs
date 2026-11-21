// `pnpm dev` launcher (SIM-028): runs `next dev` bound to loopback with the dev-token flag set.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// Sets the dev-token flag. An inherited production-data flag (any letter case on Windows) is dropped, so plain
// `pnpm dev` never shows the red badge; only dev:prod sets it again, after this call. NODE_ENV is forced to
// "development" (inherited value dropped in any letter case) so Next loads the four .env files the launchers check,
// never .env.test*.
export function devEnv(env) {
  const copy = { ...env };
  for (const k of Object.keys(copy)) {
    const u = k.toUpperCase();
    if (u === "NEXT_PUBLIC_SIMAP_DEV_PROD" || u === "NODE_ENV") delete copy[k];
  }
  return { ...copy, NODE_ENV: "development", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" };
}

/**
 * True when the .env text sets `key`, parsed the way @next/env does: CR and CRLF become LF, then one multiline match
 * (key and "=" may sit on separate lines; "^" also follows U+2028/2029). "\s" covers the BOM. `key` is a constant.
 */
export function envFileSetsKey(text, key, ignoreCase = false) {
  const re = new RegExp(
    String.raw`^\s*(?:export\s+)?${key}(?:\s*=|:(?:\s|$))`,
    ignoreCase ? "im" : "m",
  );
  return re.test(String(text).replace(/\r\n?/g, "\n"));
}

/** Thrown when an .env file exists but cannot be read; carries only the file name, never the cause or content. */
export class EnvReadFailure extends Error {
  constructor(name) {
    super("cannot read " + name);
    this.envFile = name;
  }
}

export const envReadMessage = (name, tag) =>
  `[${tag}] cannot read ${name}: close whatever holds it and retry (nothing started)`;

/**
 * Reader for .env files under root: null only when the file is missing (ENOENT); anything else throws EnvReadFailure.
 * @param {string} root
 * @param {(path: string, encoding: "utf8") => string} [read]
 */
export function makeEnvReader(root, read = readFileSync) {
  return (name) => {
    try {
      return read(resolve(root, name), "utf8");
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw new EnvReadFailure(name);
    }
  };
}

export const ENV_FILE_NAMES = [".env.development.local", ".env.local", ".env.development", ".env"];

/**
 * Name of the first .env file that sets the production-data flag in any letter case, else null. Next loads these files
 * after the launcher builds the environment, so a line there could fake or suppress the red badge.
 */
export function envFileSettingDevProd(readEnvFile) {
  for (const name of ENV_FILE_NAMES) {
    const text = readEnvFile(name);
    if (text !== null && envFileSetsKey(text, "NEXT_PUBLIC_SIMAP_DEV_PROD", true)) return name;
  }
  return null;
}

export const devProdFileMessage = (name, tag) =>
  `[${tag}] ${name} sets NEXT_PUBLIC_SIMAP_DEV_PROD: remove that line (only dev:prod sets it, in the environment)`;

function main() {
  let args;
  try {
    assertNodeOptionsSafe(process.env);
    args = nextDevArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  let bad;
  try {
    bad = envFileSettingDevProd(makeEnvReader(root));
  } catch (e) {
    if (!(e instanceof EnvReadFailure)) throw e;
    console.error(envReadMessage(e.envFile, "dev"));
    process.exit(2);
  }
  if (bad) {
    console.error(devProdFileMessage(bad, "dev"));
    process.exit(2);
  }
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [next, ...args], {
    stdio: "inherit",
    env: devEnv(process.env),
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
