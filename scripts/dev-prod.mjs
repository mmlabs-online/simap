// `pnpm dev:prod` (SIM-029, D56): runs the local app against the production database through the Cloudflare pg-tunnel.
// Steps, stopping at the first failure with nothing started: read-only preflight (.env refusals, tools, port), token,
// tunnel, hidden password and one login check, app.
// The password lives only in memory and in the app's child environment. It is never printed or stored.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tunnelPorts } from "../db/target.js";
import {
  assertNodeOptionsSafe,
  devEnv,
  devProdFileMessage,
  ENV_FILE_NAMES,
  EnvReadFailure,
  envReadMessage,
  envFileSetsKey,
  envFileSettingDevProd,
  makeEnvReader,
  nextDevArgs,
} from "./dev.mjs";
import { checkTools, portBusy, probeReady, startApp } from "./dev-process.mjs";
import { JWT_SHAPE, promptPassword, tokenFilePath } from "./dev-token.mjs";

// Same value as src/server/identity/config.ts; a plain Node script cannot import that server-only TS module.
const ISSUER_PROD = "https://api.mmlabs.online";
const ISSUER_KEY = "MM_IDENTITY_ISSUER";
const PINNED_KEYS = new Set(["SIMAP_DEV_EXPECTED_ORG", ISSUER_KEY]);
const CONTAINER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const MIN_TOKEN_LIFE_S = 120;
// Every PG* variable (any letter case) changes how pg connects, so none reaches the app or the login check.
const PG_KEY = /^PG/i;

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

export { envFileSetsKey };

/** True when a line of the .env file sets DATABASE_URL. */
export function envFileSetsDatabaseUrl(text) {
  return envFileSetsKey(text, "DATABASE_URL");
}

/**
 * True when a line of the .env text sets `key` in a letter case other than `key` itself (same matching as
 * envFileSetsKey, case-insensitive). On Windows such a line can overwrite a value pinned in the process environment.
 */
export function envFileSetsKeyVariant(text, key) {
  const re = new RegExp(String.raw`^\s*(?:export\s+)?(${key})(?:\s*=|:(?:\s|$))`, "gim");
  const body = String(text).replace(/\r\n?/g, "\n");
  for (let m = re.exec(body); m; m = re.exec(body)) if (m[1] !== key) return true;
  return false;
}

/** The first PG* key (any letter case) the .env text sets, else null. Same matching as envFileSetsKey. */
export function envFilePgKey(text) {
  const body = String(text).replace(/\r\n?/g, "\n");
  const m = /^\s*(?:export\s+)?(PG[A-Za-z0-9_]*)(?:\s*=|:(?:\s|$))/im.exec(body);
  return m ? m[1] : null;
}

export function buildProdUrl(password, port) {
  return `postgres://simap:${encodeURIComponent(password)}@127.0.0.1:${port}/simap`;
}

function childEnv(env, url, tokenFile, org) {
  const copy = { ...env };
  // Windows env names are case-insensitive: drop every case variant before setting the pin.
  for (const k of Object.keys(copy))
    if (PG_KEY.test(k) || PINNED_KEYS.has(k.toUpperCase())) delete copy[k];
  return {
    ...devEnv({
      ...copy,
      DATABASE_URL: url,
      SIMAP_DB_TARGET: "production",
      SIMAP_DEV_TOKEN_FILE: tokenFile,
      SIMAP_DEV_EXPECTED_ORG: org,
      [ISSUER_KEY]: ISSUER_PROD,
    }),
    // Browser-only: shows the red "Production data" badge. It grants nothing.
    NEXT_PUBLIC_SIMAP_DEV_PROD: "1",
  };
}

const READY_MS = 30_000;
const POLL_MS = 2000;
const SIGNAL_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

/** All I/O comes through `deps`, so tests can drive it. Returns the exit code. */
export async function run(deps) {
  const { env, argv, now, readTokenFile, runDevToken, docker, probe, sleep } = deps;
  const rawRead = deps.readEnvFile;
  const { promptPassword: ask, promptOrg, spawnApp, out, err } = deps;
  let handle = null;
  let halted = false;
  try {
    let args;
    let ports;
    let port;
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
      // Next retries other ports when none is given, so always pass an explicit one.
      const given = args[args.indexOf("--port") + 1];
      const fromEnv = String(env.PORT ?? "").trim();
      port = args.includes("--port")
        ? given
        : fromEnv
          ? nextDevArgs(["--port", fromEnv])[4]
          : "3000";
      args = nextDevArgs(["--port", port]);
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

    // 1. Read-only preflight, before any sign-in, tunnel or prompt: .env files, tools, app port.
    const readEnvFile = (n) => {
      try {
        return rawRead(n);
      } catch {
        throw new EnvReadFailure(n);
      }
    };
    for (const n of [".env.local", ...ENV_FILE_NAMES.filter((x) => x !== ".env.local")]) {
      const text = readEnvFile(n);
      if (text !== null && envFileSetsKey(text, "DATABASE_URL", true)) {
        err(
          `[dev:prod] ${n} sets DATABASE_URL: comment that line out while using dev:prod, restore it for local work`,
        );
        return 2;
      }
    }
    for (const n of ENV_FILE_NAMES) {
      const text = readEnvFile(n);
      if (text !== null && envFileSetsKey(text, "SIMAP_DEV_ORG")) {
        err(`[dev:prod] ${n} sets SIMAP_DEV_ORG: remove that line and set it in the shell`);
        return 2;
      }
    }
    for (const n of ENV_FILE_NAMES) {
      const text = readEnvFile(n);
      if (text !== null && envFileSetsKeyVariant(text, ISSUER_KEY)) {
        err(
          `[dev:prod] ${n} sets ${ISSUER_KEY} in a different letter case: remove that line (dev:prod pins the issuer)`,
        );
        return 2;
      }
    }
    for (const n of ENV_FILE_NAMES) {
      const text = readEnvFile(n);
      const key = text === null ? null : envFilePgKey(text);
      if (key) {
        err(`[dev:prod] ${n} sets ${key}: remove that line (dev:prod removes every PG* variable)`);
        return 2;
      }
    }
    const badFile = envFileSettingDevProd(readEnvFile);
    if (badFile) {
      err(devProdFileMessage(badFile, "dev:prod"));
      return 2;
    }
    const missing = deps.checkTools();
    if (missing.length) {
      err(`[dev:prod] missing tool: ${missing.join(", ")} (nothing started)`);
      return 1;
    }
    if (await deps.portBusy(Number(port))) {
      err(`[dev:prod] port ${port} is in use: stop that process or pass --port <n>`);
      return 1;
    }

    // 2. Token and org
    const file = tokenFilePath(env);
    const wantOrg = String(env.SIMAP_DEV_ORG ?? "").trim() || null;
    let token = readTokenFile(file);
    if (!tokenIsFresh(token, now(), wantOrg)) {
      let requestedOrg = null;
      if (!wantOrg) {
        requestedOrg = tokenOrg(token);
        if (!requestedOrg) {
          const answer = String((await promptOrg()) ?? "")
            .trim()
            .toLowerCase();
          if (!CANONICAL_UUID.test(answer)) {
            err("[dev:prod] that is not a valid org UUID: nothing started");
            return 1;
          }
          requestedOrg = answer;
          out(`[dev:prod] org ${requestedOrg}`);
        }
      }
      out("[dev:prod] token missing, expiring or for another org: running dev:token");
      const code = requestedOrg ? await runDevToken(requestedOrg) : await runDevToken();
      token = readTokenFile(file);
      if (code !== 0 || !tokenIsFresh(token, now(), wantOrg ?? requestedOrg)) {
        if (code === 0 && !tokenOrg(token)) {
          err(
            "[dev:prod] the token has no valid org: run pnpm dev:token --org <uuid> (or set SIMAP_DEV_ORG) and retry",
          );
        } else if (code === 0 && tokenIsFresh(token, now())) {
          err(
            `[dev:prod] the token org does not match ${wantOrg ? "SIMAP_DEV_ORG" : "the requested org"}: nothing started`,
          );
        } else {
          err("[dev:prod] no fresh dev token: run pnpm dev:token --org <uuid> and retry");
        }
        return 1;
      }
    }

    // 3. Tunnel
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

    // 4. Password
    const password = await ask("Password for database role simap: ");
    if (!password) {
      err("[dev:prod] empty password");
      return 1;
    }

    // One login check before the app starts, so a wrong password costs one production login, never a retry loop.
    let dbOk = false;
    let authFailed = false;
    try {
      const r = await deps.checkDb({ password, port: ports.primary });
      dbOk = r?.ok === true;
      authFailed = r?.code === "28P01";
    } catch {}
    if (!dbOk) {
      err(
        authFailed
          ? "[dev:prod] the database rejected the password for role simap: nothing started"
          : "[dev:prod] could not log in to the production database through the tunnel: nothing started",
      );
      return 1;
    }

    // 5. App: start, wait for readiness, check ownership. Every way out stops the whole child tree (never the tunnel).
    const org = tokenOrg(token);
    out(`[dev:prod] production data, org ${org}: every change is real`);
    let signalCode = null;
    let wake;
    const signalled = new Promise((r) => (wake = r));
    deps.onStopSignal((code) => {
      signalCode ??= code;
      wake("signal");
    });
    const halt = async (code, grace = false) => {
      halted = true;
      const left = handle ? await handle.stop({ grace, port: Number(port) }) : [];
      if (left.length) {
        const pids = left.filter(Boolean);
        err(
          `[dev:prod] could not confirm every child stopped${pids.length ? ` (PIDs: ${pids.join(", ")})` : ""}. The app may still be running on port ${port}: stop it before continuing`,
        );
        return code || 1;
      }
      return code;
    };
    handle = await spawnApp({
      args,
      env: childEnv(env, buildProdUrl(password, ports.primary), file, org),
    });
    let exitCode = null;
    const exited = handle.exit.then((c) => ((exitCode = c), "exit"));
    if (signalCode !== null) return await halt(signalCode, true);
    if (handle.rooted === false) {
      err("[dev:prod] could not identify the app process: stopping it");
      return await halt(1);
    }
    const t0 = deps.monoMs();
    let ready = false;
    while (!ready) {
      const left = READY_MS - (deps.monoMs() - t0);
      if (left <= 0) {
        err(
          "[dev:prod] the app did not become ready in 30 s (database password or tunnel?): stopping it",
        );
        return await halt(1);
      }
      const r = await Promise.race([
        deps.probeReady(Number(port), Math.min(10_000, left)),
        exited,
        signalled,
      ]);
      if (r === "signal" || signalCode !== null) return await halt(signalCode ?? 1, true);
      if (r === "exit" || exitCode !== null) {
        err("[dev:prod] the app exited before it was ready");
        return await halt(1);
      }
      ready = r === true;
      if (!ready) {
        const after = await Promise.race([
          sleep(Math.min(POLL_MS, Math.max(0, READY_MS - (deps.monoMs() - t0)))),
          exited,
          signalled,
        ]);
        if (after === "signal" || signalCode !== null) return await halt(signalCode ?? 1, true);
        if (after === "exit" || exitCode !== null) {
          err("[dev:prod] the app exited before it was ready");
          return await halt(1);
        }
      }
    }
    if ((await handle.owner(Number(port))) !== "owned") {
      err(`[dev:prod] port ${port} is not owned by the app we started: stopping it`);
      return await halt(1);
    }
    out(`[dev:prod] local URL: http://127.0.0.1:${port}`);
    out("PRODUCTION DATA: every change is real.");
    const end = await Promise.race([exited, signalled]);
    if (end === "signal" || signalCode !== null) return await halt(signalCode ?? 1, true);
    return await halt(exitCode ?? 1);
  } catch (e) {
    if (e instanceof EnvReadFailure) {
      err(envReadMessage(e.envFile, "dev:prod"));
      return 2;
    }
    err("[dev:prod] unexpected error");
    return 1;
  } finally {
    if (handle && !halted) await handle.stop().catch(() => {});
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

/** One login with the password, nothing else: connect, then close. Resolves { ok } or { ok: false, code } (pg error code). */
async function checkDb({ password, port }) {
  const { Client } = createRequire(import.meta.url)("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user: "simap",
    password,
    database: "simap",
    ssl: false,
    connectionTimeoutMillis: 5000,
  });
  client.on("error", () => {});
  try {
    await client.connect();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: typeof e?.code === "string" ? e.code : undefined };
  } finally {
    // A stalled tunnel must not hang the close: give it 2 s, then drop the socket.
    await Promise.race([client.end().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
    client.connection?.stream?.destroy();
  }
}

function spawnNext({ args, env }) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  return startApp({ cmd: process.execPath, args: [next, ...args], env, cwd: root });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error(
      "[dev:prod] needs an interactive terminal (PowerShell, Windows Terminal or macOS Terminal)",
    );
    process.exit(1);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  // pg reads PG* from process.env when its config leaves a value unset (the login check); the app gets a clean copy too.
  for (const k of Object.keys(process.env)) if (PG_KEY.test(k)) delete process.env[k];
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
      runDevToken: (org) =>
        spawnSync(
          process.execPath,
          [resolve(root, "scripts", "dev-token.mjs"), ...(org ? ["--org", org] : [])],
          {
            stdio: "inherit",
            env: process.env,
          },
        ).status ?? 1,
      docker: (a) => {
        const r = spawnSync("docker", a, { encoding: "utf8" });
        return { status: r.status ?? 1, stdout: r.stdout ?? "" };
      },
      probe: probePort,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      readEnvFile: makeEnvReader(root),
      promptPassword,
      promptOrg: () => promptPassword("Org UUID: "),
      checkTools: () => checkTools(root),
      portBusy,
      probeReady,
      checkDb,
      monoMs: () => performance.now(),
      onStopSignal: (cb) => {
        for (const [sig, code] of Object.entries(SIGNAL_CODES)) process.on(sig, () => cb(code));
      },
      spawnApp: spawnNext,
      out: (m) => console.log(m),
      err: (m) => console.error(m),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
