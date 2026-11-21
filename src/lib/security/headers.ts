/** Security headers and the Content-Security-Policy. Pure (lib layer): the proxy and next.config import it. */

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Static headers for every response (`next.config.ts` headers()). The CSP is NOT here: it carries a nonce (proxy). */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
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

export const identityOriginFrom = (base: string): string => new URL(base).origin;

const NONCE_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function buildCsp({
  nonce,
  identityOrigin,
  dev,
}: {
  nonce: string;
  identityOrigin: string;
  dev: boolean;
}): string {
  if (!NONCE_RE.test(nonce)) throw new Error("invalid CSP nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${identityOrigin}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join("; ");
}
