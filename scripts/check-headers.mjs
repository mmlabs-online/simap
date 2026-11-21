// Security header check against a running (built) server. Node built-ins and global fetch only, so it can be piped
// into the image: `node --input-type=module - < scripts/check-headers.mjs` with CHECK_HEADERS_URL set.
// Keep EXPECTED_STATIC_HEADERS in step with src/lib/security/headers.ts (scripts/check-headers.test.ts guards it).
export const IDENTITY_ORIGIN = "https://api.mmlabs.online";
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const EXPECTED_STATIC_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
const PAGES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/rooms",
];
const NOT_FOUND = "/sim027-not-found";

/** @param {string} value @returns {Map<string, string[]>} lower-case directive name -> sources */
export function parseCsp(value) {
  const out = new Map();
  for (const part of value.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out.set(name.toLowerCase(), sources);
  }
  return out;
}

/** @param {Headers} headers @returns {string[]} */
export function checkStaticHeaders(headers) {
  const errors = [];
  for (const { key, value } of EXPECTED_STATIC_HEADERS) {
    const got = headers.get(key);
    if (got === null) errors.push(`missing header ${key}`);
    else if (got !== value) errors.push(`header ${key} is "${got}", expected "${value}"`);
  }
  return errors;
}

/** @param {Headers} headers @returns {{ errors: string[]; nonce: string | null }} */
export function checkDocumentCsp(headers) {
  const errors = [];
  if (headers.get("content-security-policy-report-only") !== null) {
    errors.push("content-security-policy-report-only must not be set");
  }
  const raw = headers.get("content-security-policy");
  if (raw === null) return { errors: [...errors, "missing content-security-policy"], nonce: null };
  if (raw.includes(","))
    return { errors: [...errors, "more than one content-security-policy"], nonce: null };
  const csp = parseCsp(raw);
  const script = csp.get("script-src") ?? [];
  const nonces = script.map((s) => /^'nonce-([A-Za-z0-9+/]+={0,2})'$/.exec(s)?.[1]).filter(Boolean);
  const nonce = nonces[0] ?? null;
  if (nonce === null) errors.push("script-src has no nonce");
  if (script.includes("'unsafe-inline'"))
    errors.push("script-src must not contain 'unsafe-inline'");
  if (!script.includes(TURNSTILE_ORIGIN)) errors.push("script-src lacks Turnstile");
  if (!(csp.get("frame-src") ?? []).includes(TURNSTILE_ORIGIN))
    errors.push("frame-src lacks Turnstile");
  if (!(csp.get("connect-src") ?? []).includes(IDENTITY_ORIGIN))
    errors.push("connect-src lacks the Identity origin");
  const fa = csp.get("frame-ancestors") ?? [];
  if (fa.length !== 1 || fa[0] !== "'none'") errors.push("frame-ancestors is not 'none'");
  return { errors, nonce };
}

/** @param {string} html @param {string} nonce @returns {string[]} */
export function checkScriptNonces(html, nonce) {
  const errors = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let themeSeen = false;
  for (const m of html.matchAll(re)) {
    const has = new RegExp(`\\bnonce="${nonce}"`).test(m[1]);
    if (!has) errors.push(`<script${m[1].slice(0, 60)}> has no matching nonce`);
    if (m[2].includes("dataset.theme")) themeSeen = has || themeSeen;
  }
  if (!themeSeen) errors.push("no theme script with the nonce found");
  return errors;
}

/** @param {string} baseUrl @param {typeof fetch} [fetchFn] @returns {Promise<string[]>} */
export async function runChecks(baseUrl, fetchFn = fetch) {
  const errors = [];
  const get = (path) => fetchFn(new URL(path, baseUrl), { redirect: "manual" });
  const pages = [...PAGES.map((p) => [p, 200]), [NOT_FOUND, 404]];
  /** @type {string | null} */
  let home = null;
  for (const [path, status] of pages) {
    const res = await get(path);
    const html = await res.text();
    if (path === "/") home = html;
    const at = (e) => errors.push(`${path}: ${e}`);
    if (res.status !== status) at(`status ${res.status}, expected ${status}`);
    checkStaticHeaders(res.headers).forEach(at);
    const csp = checkDocumentCsp(res.headers);
    csp.errors.forEach(at);
    if (csp.nonce) checkScriptNonces(html, csp.nonce).forEach(at);
  }
  const a = checkDocumentCsp((await get("/sign-in")).headers).nonce;
  const b = checkDocumentCsp((await get("/sign-in")).headers).nonce;
  if (a !== null && a === b) errors.push("/sign-in: the nonce is the same on two requests");

  const asset = /\/_next\/static\/[^"]+\.(?:js|css)/.exec(home ?? "")?.[0];
  const noCsp = [["/api/healthz"], ...(asset ? [[asset]] : [])];
  if (!asset) errors.push("no /_next/static asset referenced by /");
  for (const [path] of noCsp) {
    const res = await get(path);
    await res.arrayBuffer();
    const at = (e) => errors.push(`${path}: ${e}`);
    if (res.status !== 200) at(`status ${res.status}, expected 200`);
    checkStaticHeaders(res.headers).forEach(at);
    if (res.headers.get("content-security-policy") !== null)
      at("must not carry a content-security-policy");
  }
  return errors;
}

async function main() {
  const errors = await runChecks(process.env.CHECK_HEADERS_URL);
  for (const e of errors) console.error(e);
  if (errors.length > 0) process.exit(1);
  console.log("check-headers: ok");
}

if (process.env.CHECK_HEADERS_URL) await main();
