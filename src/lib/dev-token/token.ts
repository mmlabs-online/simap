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
  | "cross_site";

export type DevRequest = {
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
};

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

function expOf(token: string): number | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload?.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
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

/** The client Authorization is not an input, so it can never be returned. */
export function devAuthorizationFor(
  req: DevRequest,
  result: TokenResult,
): { header: string | null; reason: Reason } {
  const refusal = requestRefusal(req);
  if (refusal) return { header: null, reason: refusal };
  if (result.status !== "ok") return { header: null, reason: result.status };
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
