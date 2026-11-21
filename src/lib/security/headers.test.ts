import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, buildCsp, identityOriginFrom } from "./headers";

const ORIGIN = "https://api.mmlabs.online";
const csp = (dev = false, nonce = "abc123==") => buildCsp({ nonce, identityOrigin: ORIGIN, dev });
const directive = (policy: string, name: string) =>
  policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("buildCsp", () => {
  it("equals the agreed policy exactly (prod)", () => {
    expect(csp()).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-abc123==' 'strict-dynamic' https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://api.mmlabs.online",
        "frame-src https://challenges.cloudflare.com",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'none'",
        "object-src 'none'",
      ].join("; "),
    );
  });

  it("connect-src carries the Identity origin only", () => {
    expect(identityOriginFrom("https://api.mmlabs.online/api/v1")).toBe(ORIGIN);
    expect(identityOriginFrom("http://localhost:4000/api/v1")).toBe("http://localhost:4000");
    expect(csp()).not.toContain("/api/v1");
  });

  it("allows Turnstile in script-src and frame-src", () => {
    for (const d of ["script-src", "frame-src"]) {
      expect(directive(csp(), d)).toContain("https://challenges.cloudflare.com");
    }
  });

  it("script-src has the nonce and strict-dynamic, never unsafe-inline; style-src has no nonce", () => {
    const script = directive(csp(), "script-src");
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    const style = directive(csp(), "style-src");
    expect(style).toContain("'unsafe-inline'");
    expect(style).not.toContain("nonce");
  });

  it("'unsafe-eval' only in dev", () => {
    expect(csp(false)).not.toContain("'unsafe-eval'");
    expect(directive(csp(true), "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp(true), "style-src")).not.toContain("'unsafe-eval'");
  });

  it("throws on an empty or non-base64 nonce", () => {
    for (const bad of ["", "a;b", "a b", "a\r\nb"]) expect(() => csp(false, bad)).toThrow();
  });

  it("is one header value: no comma, no newline", () => {
    expect(csp(true)).not.toMatch(/[,\r\n]/);
  });
});

describe("SECURITY_HEADERS", () => {
  it("has the agreed names and values and no CSP", () => {
    expect(SECURITY_HEADERS).toEqual([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ]);
    expect(SECURITY_HEADERS.some((h) => /content-security-policy/i.test(h.key))).toBe(false);
  });
});
