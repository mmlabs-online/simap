import { describe, expect, it, vi } from "vitest";
import {
  createWarnOnce,
  devAuthorizationFor,
  isLoopbackHost,
  parseDevToken,
  warningFor,
  type DevRequest,
  type Reason,
} from "./token";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (exp: number) => `${b64({ alg: "ES256" })}.${b64({ exp })}.sig_-x`;
const NOW = 1_700_000_000_000;
const GOOD = jwt(NOW / 1000 + 3600);

const req = (over: Partial<DevRequest> = {}): DevRequest => ({
  pathname: "/api/me",
  host: "localhost:3000",
  origin: null,
  secFetchSite: null,
  ...over,
});
const ok = { status: "ok", token: GOOD } as const;

describe("parseDevToken", () => {
  it("classifies missing, malformed, expired and ok", () => {
    expect(parseDevToken(null, NOW)).toEqual({ status: "missing" });
    expect(parseDevToken("", NOW)).toEqual({ status: "malformed" });
    expect(parseDevToken("not-a-jwt", NOW)).toEqual({ status: "malformed" });
    expect(parseDevToken(`${b64({})}.${b64({ sub: "x" })}.s`, NOW)).toEqual({
      status: "malformed",
    });
    expect(parseDevToken(jwt(NOW / 1000), NOW)).toEqual({ status: "expired" });
    expect(parseDevToken(jwt(NOW / 1000 - 5), NOW)).toEqual({ status: "expired" });
    expect(parseDevToken(`${GOOD}\r\n`, NOW)).toEqual({ status: "ok", token: GOOD });
  });
});

describe("isLoopbackHost", () => {
  it("accepts loopback names and refuses the rest", () => {
    for (const h of ["localhost:3000", "LOCALHOST", "127.0.0.1:3001", "[::1]:3000", "localhost"]) {
      expect(isLoopbackHost(h), h).toBe(true);
    }
    for (const h of [
      null,
      "",
      "evil.example:3000",
      "192.168.1.5:3000",
      "localhost.evil.example",
      "127.0.0.1.nip.io",
      "[::]:3000",
    ]) {
      expect(isLoopbackHost(h), String(h)).toBe(false);
    }
  });
});

describe("devAuthorizationFor", () => {
  it("returns the file token for same-origin or non-browser requests", () => {
    expect(devAuthorizationFor(req({ secFetchSite: "same-origin" }), ok)).toEqual({
      header: `Bearer ${GOOD}`,
      reason: "ok",
    });
    expect(devAuthorizationFor(req(), ok).header).toBe(`Bearer ${GOOD}`);
    expect(devAuthorizationFor(req({ origin: "http://localhost:3000" }), ok).header).toBe(
      `Bearer ${GOOD}`,
    );
  });

  it("refuses cross-site, same-site and none", () => {
    for (const s of ["cross-site", "same-site", "none"]) {
      expect(devAuthorizationFor(req({ secFetchSite: s }), ok)).toEqual({
        header: null,
        reason: "cross_site",
      });
    }
  });

  it("refuses a non-/api/ path, a non-loopback Host and a foreign Origin", () => {
    for (const pathname of ["/healthz", "/apix"]) {
      expect(devAuthorizationFor(req({ pathname }), ok)).toEqual({ header: null, reason: "path" });
    }
    expect(devAuthorizationFor(req({ host: "evil.example" }), ok).reason).toBe("host");
    for (const origin of ["https://evil.example", "https://localhost:3000", "null", "garbage"]) {
      expect(devAuthorizationFor(req({ origin }), ok)).toEqual({ header: null, reason: "origin" });
    }
  });

  it("never returns a client Authorization: only the file token or null", () => {
    const input = { ...req(), authorization: "Bearer client" };
    expect(devAuthorizationFor(input, ok).header).toBe(`Bearer ${GOOD}`);
    expect(devAuthorizationFor(input, { status: "missing" }).header).toBeNull();
  });

  it("reports missing, malformed and expired", () => {
    for (const status of ["missing", "malformed", "expired"] as const) {
      expect(devAuthorizationFor(req(), { status })).toEqual({ header: null, reason: status });
    }
  });
});

describe("warningFor / createWarnOnce", () => {
  const reasons: Reason[] = [
    "missing",
    "malformed",
    "expired",
    "path",
    "host",
    "origin",
    "cross_site",
  ];

  it("names pnpm dev:token or the refusal and never the token", () => {
    expect(warningFor("ok")).toBeNull();
    for (const r of reasons) {
      const w = warningFor(r)!;
      expect(w.startsWith("[dev-token]")).toBe(true);
      expect(w).not.toContain(GOOD);
    }
    for (const r of ["missing", "malformed", "expired"] as const) {
      expect(warningFor(r)).toContain("pnpm dev:token");
    }
  });

  it("logs on the first failure, not again for the same reason, again after a change", () => {
    const log = vi.fn();
    const warn = createWarnOnce(log);
    warn("ok");
    expect(log).not.toHaveBeenCalled();
    warn("missing");
    warn("missing");
    expect(log).toHaveBeenCalledTimes(1);
    warn("expired");
    expect(log).toHaveBeenCalledTimes(2);
    warn("ok");
    warn("expired");
    expect(log).toHaveBeenCalledTimes(3);
  });
});
