import "server-only";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createWarnOnce,
  devAuthorizationFor,
  parseDevToken,
  requestRefusal,
  type DevRequest,
  type TokenResult,
} from "@/lib/dev-token/token";

declare global {
  var __simapDevTokenWarn: ReturnType<typeof createWarnOnce> | undefined;
}

export function tokenFilePath(
  env: Record<string, string | undefined>,
  home: string = homedir(),
): string {
  return env.SIMAP_DEV_TOKEN_FILE || join(home, ".config", "simap", "dev-token");
}

/** Synchronous and uncached on purpose: a refreshed token file needs no restart. */
export function readDevTokenFile(file: string, nowMs: number): TokenResult {
  try {
    return parseDevToken(readFileSync(file, "utf8"), nowMs);
  } catch {
    return parseDevToken(null, nowMs);
  }
}

/** `Bearer <file token>` for a same-origin loopback /api request, else null. Never returns the client header. */
export function devAuthorization(req: Request): string | null {
  const warn = (globalThis.__simapDevTokenWarn ??= createWarnOnce((m) => console.warn(m)));
  const input: DevRequest = {
    pathname: new URL(req.url).pathname,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
  };
  const refusal = requestRefusal(input);
  if (refusal) {
    warn(refusal);
    return null;
  }
  const { header, reason } = devAuthorizationFor(
    input,
    readDevTokenFile(tokenFilePath(process.env), Date.now()),
    process.env.NODE_ENV !== "production" ? process.env.SIMAP_DEV_EXPECTED_ORG : undefined,
  );
  warn(reason);
  return header;
}
