/** Pure dev-token logic (SIM-028). No node imports: safe anywhere in lib. */

export type TokenResult =
  | { status: "ok"; token: string }
  | { status: "missing" | "malformed" | "expired" };

export type Reason =
  | "ok"
  | "missing"
  | "malformed"
  | "expired"
  | "path"
  | "host"
  | "origin"
  | "cross_site"
  | "wrong_org";

export type DevRequest = {
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
};

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

function payloadOf(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function expOf(token: string): number | null {
  const exp = payloadOf(token)?.exp;
  return typeof exp === "number" ? exp : null;
}

function orgOf(token: string): string | null {
  const org = payloadOf(token)?.org;
  return typeof org === "string" ? org : null;
}

/** `raw` is the token file content, or null when the file could not be read. */
export function parseDevToken(raw: string | null, nowMs: number): TokenResult {
  if (raw === null) return { status: "missing" };
  const token = raw.trim();
  if (!JWT_SHAPE.test(token)) return { status: "malformed" };
  const exp = expOf(token);
  if (exp === null) return { status: "malformed" };
  if (exp * 1000 <= nowMs) return { status: "expired" };
  return { status: "ok", token };
}

/** Host header value (hostname with optional port) is localhost, 127.0.0.1 or [::1]. */
export function isLoopbackHost(host: string | null): boolean {
  return host !== null && LOOPBACK.test(host);
}

/** Why a request must not get the dev token, ignoring the token itself; null when it may. */
export function requestRefusal(req: DevRequest): "path" | "host" | "origin" | "cross_site" | null {
  if (!req.pathname.startsWith("/api/")) return "path";
  if (!isLoopbackHost(req.host)) return "host";
  if (req.origin !== null) {
    let ok = false;
    try {
      const u = new URL(req.origin);
      ok = u.protocol === "http:" && isLoopbackHost(u.host);
    } catch {
      ok = false;
    }
    if (!ok) return "origin";
  }
  if (req.secFetchSite !== null && req.secFetchSite !== "same-origin") return "cross_site";
  return null;
}

/**
 * The client Authorization is not an input, so it can never be returned.
 * When `expectedOrg` is set, a token whose (unverified) `org` claim differs is withheld; the claim only ever
 * withholds, and the server still verifies the token it receives.
 */
export function devAuthorizationFor(
  req: DevRequest,
  result: TokenResult,
  expectedOrg?: string | null,
): { header: string | null; reason: Reason } {
  const refusal = requestRefusal(req);
  if (refusal) return { header: null, reason: refusal };
  if (result.status !== "ok") return { header: null, reason: result.status };
  if (expectedOrg && orgOf(result.token)?.toLowerCase() !== expectedOrg.toLowerCase()) {
    return { header: null, reason: "wrong_org" };
  }
  return { header: `Bearer ${result.token}`, reason: "ok" };
}

export function warningFor(reason: Reason): string | null {
  switch (reason) {
    case "ok":
      return null;
    case "missing":
    case "malformed":
    case "expired":
      return `[dev-token] token ${reason} - run pnpm dev:token`;
    case "path":
      return "[dev-token] request refused (path is not /api/)";
    case "host":
      return "[dev-token] request refused (Host is not loopback)";
    case "origin":
      return "[dev-token] request refused (Origin is not a loopback http origin)";
    case "cross_site":
      return "[dev-token] request refused (not same-origin)";
    case "wrong_org":
      return "[dev-token] token is for another org than this server was started with - run pnpm dev:token --org <the org in the dev:prod banner>";
  }
}

/** Logs a warning only when the reason changes; `ok` resets. */
export function createWarnOnce(log: (message: string) => void): (reason: Reason) => void {
  let last: string | null = null;
  return (reason) => {
    const w = warningFor(reason);
    if (w === last) return;
    last = w;
    if (w) log(w);
  };
}
