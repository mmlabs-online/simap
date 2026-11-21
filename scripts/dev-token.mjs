// `pnpm dev:token`: signs in to mmlabs Identity from Node and writes a simap token for local dev (SIM-028, D56).
// The password lives only in memory (the login request body). It is never printed or stored.
import { chmodSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

// Same values as src/lib/identity/config.ts (IDENTITY_BASE_PROD); a .mjs script cannot import the TS module.
const BASE = "https://api.mmlabs.online/api/v1";
const APP = "simap";
const ORIGIN = "https://simap.mmlabs.online";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EXPIRES_MAX = 86400;
const USAGE = "usage: pnpm dev:token [--org <uuid>]";

export class DevTokenError extends Error {}
const fail = (message) => new DevTokenError(message);

export function parseArgs(argv, env = {}) {
  let org = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--org") {
      org = argv[++i] ?? "";
    } else if (a.startsWith("--org=")) {
      org = a.slice("--org=".length);
    } else {
      throw fail(`unknown argument "${a}"; ${USAGE}`);
    }
  }
  org ??= env.SIMAP_DEV_ORG || null;
  if (org !== null && !UUID_RE.test(org)) throw fail(`the org must be a UUID; ${USAGE}`);
  return { org: org === null ? null : org.toLowerCase() };
}

/** Keeps only `name=value` of each Set-Cookie, joined for a Cookie header. */
export function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

export function parseLoginAnswer(json) {
  const id = json?.account_id;
  if (typeof id !== "string" || !UUID_RE.test(id)) throw fail("unexpected sign-in answer");
  return { accountId: id };
}

export function parseTokenAnswer(json) {
  const { access_token: t, token_type, expires_in: exp, audience } = json ?? {};
  if (
    typeof t !== "string" ||
    !JWT_SHAPE.test(t) ||
    token_type !== "Bearer" ||
    audience !== APP ||
    typeof exp !== "number" ||
    !Number.isFinite(exp) ||
    exp < 1 ||
    exp > EXPIRES_MAX
  ) {
    throw fail("unexpected token answer");
  }
  return { token: t, expiresIn: exp };
}

function claims(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/** Returns the token's org claim (or null). Throws when `expected` is given and differs. */
export function tokenOrg(token, expected) {
  const raw = claims(token).org;
  const org = typeof raw === "string" ? raw : null;
  if (expected && org?.toLowerCase() !== expected.toLowerCase()) {
    throw fail("the token org does not match --org");
  }
  return org;
}

const codeOf = (code) =>
  typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : "unknown";

export function loginErrorMessage(status, code) {
  const c = codeOf(code);
  if (status === 401 || c === "invalid_credentials") return "wrong email or password";
  if (
    c === "turnstile_required" ||
    c === "turnstile_failed" ||
    status === 429 ||
    c === "rate_limited"
  ) {
    return `Identity asks for a Turnstile check or is rate limiting: sign in once in a browser at ${ORIGIN}, then retry`;
  }
  return `sign-in failed (HTTP ${status}, ${c})`;
}

export function tokenErrorMessage(status, code) {
  const c = codeOf(code);
  if (c === "not_member") return "this account is not a member of that org (or has no org)";
  if (c === "org_access_denied") return "access to that org was denied";
  if (c === "email_unverified") return "the account email is not verified";
  return `token request failed (HTTP ${status}, ${c})`;
}

export function tokenFilePath(env, home = homedir()) {
  return env.SIMAP_DEV_TOKEN_FILE || join(home, ".config", "simap", "dev-token");
}

export function assertOutsideRepo(file, repoRoot, platform = process.platform) {
  const norm = (p) => (platform === "win32" ? resolve(p).toLowerCase() : resolve(p));
  const rel = relative(norm(repoRoot), norm(file));
  const outside = rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (rel === "" || !outside) {
    throw fail("refusing to write the token inside the repository");
  }
}

export function writeTokenFile(file, token) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  rmSync(tmp, { force: true });
  try {
    writeFileSync(tmp, `${token}\n`, { mode: 0o600, flag: "wx" });
    try {
      chmodSync(tmp, 0o600);
    } catch {
      // not supported on this platform
    }
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

async function call(fetchFn, path, body, cookie, timeoutMs) {
  let res;
  try {
    res = await fetchFn(`${BASE}${path}`, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        "X-MM-App": APP,
        Origin: ORIGIN,
        ...(cookie && { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw fail("could not reach Identity (network error or timeout)");
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

/** All I/O comes through `deps`, so tests can drive it. Returns the exit code. */
export async function run(deps) {
  const { fetchFn, promptEmail, promptPassword, env, out, err, argv = [] } = deps;
  const home = deps.home ?? homedir();
  const repoRoot = deps.repoRoot ?? fileURLToPath(new URL("..", import.meta.url));
  try {
    const { org } = parseArgs(argv, env);
    const file = tokenFilePath(env, home);
    assertOutsideRepo(file, repoRoot, deps.platform);
    const email = env.SIMAP_DEV_EMAIL || (await promptEmail());
    const password = await promptPassword();

    const login = await call(fetchFn, "/auth/login", { email, password }, null, 20_000);
    if (!login.res.ok) throw fail(loginErrorMessage(login.res.status, login.json?.error?.code));
    const { accountId } = parseLoginAnswer(login.json);
    const cookie = cookieHeader(login.res.headers.getSetCookie?.() ?? []);

    const tok = await call(
      fetchFn,
      "/auth/token",
      { audience: APP, account_id: accountId, ...(org && { org_id: org }) },
      cookie,
      20_000,
    );
    if (!tok.res.ok) throw fail(tokenErrorMessage(tok.res.status, tok.json?.error?.code));
    const { token, expiresIn } = parseTokenAnswer(tok.json);
    const orgClaim = tokenOrg(token, org);

    try {
      await call(fetchFn, "/auth/logout", { account_id: accountId }, cookie, 5_000);
    } catch {
      // best effort
    }

    writeTokenFile(file, token);
    out(
      `dev-token: wrote ${file} (valid for ${expiresIn}s, ${orgClaim ? `org ${orgClaim}` : "no org"})`,
    );
    if (!orgClaim) out("dev-token: no org in the token; simap needs one: re-run with --org <uuid>");
    return 0;
  } catch (e) {
    err(`dev-token: ${e instanceof DevTokenError ? e.message : "unexpected error"}`);
    return 1;
  }
}

function promptEmail() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question("Email: ", (a) => (rl.close(), res(a.trim()))));
}

export function promptPassword(label = "Password: ") {
  const stdin = process.stdin;
  process.stdout.write(label);
  return new Promise((res) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          done();
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          done();
          return res(value);
        } else if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error(
      "dev-token: needs an interactive terminal (PowerShell, Windows Terminal or macOS Terminal)",
    );
    process.exit(1);
  }
  process.exit(
    await run({
      fetchFn: fetch,
      promptEmail,
      promptPassword,
      env: process.env,
      out: (m) => console.log(m),
      err: (m) => console.error(m),
      argv: process.argv.slice(2),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
