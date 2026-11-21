// `pnpm dev:prod` (SIM-029, D56): runs the local app against the production database through the Cloudflare pg-tunnel.
// Steps, stopping at the first failure with nothing started: token, tunnel, .env.local check and hidden password, app.
// The password lives only in memory and in the app's child environment. It is never printed or stored.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tunnelPorts } from "../db/target.js";
import { assertNodeOptionsSafe, devEnv, nextDevArgs } from "./dev.mjs";
import { JWT_SHAPE, promptPassword, tokenFilePath } from "./dev-token.mjs";

const CONTAINER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const MIN_TOKEN_LIFE_S = 120;
const PG_VARS = [
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGPASSFILE",
];

function payloadOf(token) {
  if (typeof token !== "string" || !JWT_SHAPE.test(token.trim())) return null;
  try {
    return JSON.parse(Buffer.from(token.trim().split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Same pattern as the verifier (src/lib/validate/uuid.ts); a plain Node script cannot import that TS file.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The token's `org` claim when it is a lowercase canonical UUID, else null. */
export function tokenOrg(token) {
  const org = payloadOf(token)?.org;
  return typeof org === "string" && CANONICAL_UUID.test(org) ? org : null;
}

/**
 * True when the token has a payload `exp` more than 120 s after `nowSec` and an `org` claim
 * (equal to `expectedOrg`, case-insensitive, when that is given).
 */
export function tokenIsFresh(token, nowSec, expectedOrg) {
  const org = tokenOrg(token);
  if (!org) return false;
  if (expectedOrg && org.toLowerCase() !== expectedOrg.toLowerCase()) return false;
  const exp = payloadOf(token)?.exp;
  return typeof exp === "number" && exp - nowSec > MIN_TOKEN_LIFE_S;
}

/** True when a line of the .env file sets `key` (plain, indented, `export`, BOM, CRLF). `key` is a constant. */
export function envFileSetsKey(text, key) {
  const re = new RegExp(String.raw`^\uFEFF?\s*(?:export\s+)?${key}(?:\s*=|:(?:\s|$))`);
  return String(text)
    .split(/\r?\n/)
    .some((line) => re.test(line));
}

/** True when a line of the .env file sets DATABASE_URL. */
export function envFileSetsDatabaseUrl(text) {
  return envFileSetsKey(text, "DATABASE_URL");
}

export function buildProdUrl(password, port) {
  return `postgres://simap:${encodeURIComponent(password)}@127.0.0.1:${port}/simap`;
}

function childEnv(env, url, tokenFile, org) {
  const copy = { ...env };
  for (const v of PG_VARS) delete copy[v];
  // Windows env names are case-insensitive: drop every case variant before setting the pin.
  for (const k of Object.keys(copy))
    if (k.toUpperCase() === "SIMAP_DEV_EXPECTED_ORG") delete copy[k];
  return {
    ...devEnv({
      ...copy,
      DATABASE_URL: url,
      SIMAP_DB_TARGET: "production",
      SIMAP_DEV_TOKEN_FILE: tokenFile,
      SIMAP_DEV_EXPECTED_ORG: org,
    }),
    // Browser-only: shows the red "Production data" badge. It grants nothing.
    NEXT_PUBLIC_SIMAP_DEV_PROD: "1",
  };
}

/** All I/O comes through `deps`, so tests can drive it. Returns the exit code. */
export async function run(deps) {
  const { env, argv, now, readTokenFile, runDevToken, docker, probe, sleep, readEnvFile } = deps;
  const { promptPassword: ask, spawnApp, out, err } = deps;
  try {
    let args;
    let ports;
    const name = env.SIMAP_PG_TUNNEL || "pg-tunnel-pg-tunnel-1";
    try {
      assertNodeOptionsSafe(env);
      args = nextDevArgs(argv);
      const opts = String(env.NODE_OPTIONS ?? "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      if (opts.includes("report")) {
        throw new Error(
          "[dev:prod] NODE_OPTIONS must not contain report options (the report would include the password)",
        );
      }
    } catch (e) {
      err(e.message.replace(/^\[dev\]/, "[dev:prod]"));
      return 1;
    }
    if (!CONTAINER_RE.test(name)) {
      err("[dev:prod] SIMAP_PG_TUNNEL is not a valid container name");
      return 1;
    }
    ports = tunnelPorts(env);
    if (!ports.valid) {
      err("[dev:prod] SIMAP_PROD_TUNNEL_PORT must be a port number (1-65535)");
      return 1;
    }

    // 1. Token
    const file = tokenFilePath(env);
    const wantOrg = String(env.SIMAP_DEV_ORG ?? "").trim() || null;
    let token = readTokenFile(file);
    if (!tokenIsFresh(token, now(), wantOrg)) {
      out("[dev:prod] token missing, expiring or for another org: running dev:token");
      const code = await runDevToken();
      token = readTokenFile(file);
      if (code !== 0 || !tokenIsFresh(token, now(), wantOrg)) {
        if (code === 0 && !tokenOrg(token)) {
          err(
            "[dev:prod] the token has no valid org: run pnpm dev:token --org <uuid> (or set SIMAP_DEV_ORG) and retry",
          );
        } else if (code === 0 && tokenIsFresh(token, now())) {
          err("[dev:prod] the token org does not match SIMAP_DEV_ORG: nothing started");
        } else {
          err("[dev:prod] no fresh dev token: run pnpm dev:token --org <uuid> and retry");
        }
        return 1;
      }
    }

    // 2. Tunnel
    const inspect = docker(["inspect", "-f", "{{.State.Running}}", name]);
    if (inspect.status !== 0) {
      err(`[dev:prod] tunnel container "${name}" not found: start the pg-tunnel project first`);
      return 1;
    }
    if (inspect.stdout.trim() !== "true") {
      if (docker(["start", name]).status !== 0) {
        err(`[dev:prod] could not start the tunnel container "${name}"`);
        return 1;
      }
    }
    let up = false;
    for (let i = 0; i < 10 && !up; i++) {
      up = await probe(ports.primary);
      if (!up) await sleep(1000);
    }
    if (!up) {
      err(`[dev:prod] the tunnel does not answer on 127.0.0.1:${ports.primary}`);
      return 1;
    }

    // 3. .env.local and password
    const envText = readEnvFile(".env.local");
    if (envText !== null && envFileSetsDatabaseUrl(envText)) {
      err(
        "[dev:prod] .env.local sets DATABASE_URL: comment that line out while using dev:prod, restore it for local work",
      );
      return 2;
    }
    for (const name of [".env.development.local", ".env.local", ".env.development", ".env"]) {
      const text = readEnvFile(name);
      if (text !== null && envFileSetsKey(text, "SIMAP_DEV_ORG")) {
        err(`[dev:prod] ${name} sets SIMAP_DEV_ORG: remove that line and set it in the shell`);
        return 2;
      }
    }
    const password = await ask("Password for database role simap: ");
    if (!password) {
      err("[dev:prod] empty password");
      return 1;
    }

    // 4. App
    const org = tokenOrg(token);
    out(`[dev:prod] production data, org ${org}: every change is real`);
    return await spawnApp({
      args,
      env: childEnv(env, buildProdUrl(password, ports.primary), file, org),
    });
  } catch {
    err("[dev:prod] unexpected error");
    return 1;
  }
}

function probePort(port) {
  return new Promise((done) => {
    const socket = net.connect({ host: "127.0.0.1", port, timeout: 2000 });
    socket.once("connect", () => (socket.destroy(), done(true)));
    socket.once("timeout", () => (socket.destroy(), done(false)));
    socket.once("error", () => (socket.destroy(), done(false)));
  });
}

function spawnNext({ args, env }) {
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [next, ...args], { stdio: "inherit", env });
    const stop = () => child.kill();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    child.once("error", () => fail(new Error("spawn failed")));
    child.once("exit", (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error(
      "[dev:prod] needs an interactive terminal (PowerShell, Windows Terminal or macOS Terminal)",
    );
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  process.exit(
    await run({
      env: process.env,
      argv: process.argv.slice(2),
      now: () => Math.floor(Date.now() / 1000),
      readTokenFile: (file) => {
        try {
          return readFileSync(file, "utf8").trim();
        } catch {
          return null;
        }
      },
      runDevToken: () =>
        spawnSync(process.execPath, [resolve(root, "scripts", "dev-token.mjs")], {
          stdio: "inherit",
          env: process.env,
        }).status ?? 1,
      docker: (a) => {
        const r = spawnSync("docker", a, { encoding: "utf8" });
        return { status: r.status ?? 1, stdout: r.stdout ?? "" };
      },
      probe: probePort,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      readEnvFile: (name) => {
        try {
          return readFileSync(resolve(root, name), "utf8");
        } catch {
          return null;
        }
      },
      promptPassword,
      spawnApp: spawnNext,
      out: (m) => console.log(m),
      err: (m) => console.error(m),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
