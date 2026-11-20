const MAX_LENGTH = 2048;
const BASE = "http://return-to.invalid";

/**
 * A same-origin path to land on after sign-in. Anything else (other origin, scheme, backslash, control characters,
 * non-string, too long, the sign-in page itself) becomes `/`, so `?returnTo=` is never an open redirect.
 */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw))
    return "/";
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE) return "/";
  if (url.pathname === "/sign-in" || url.pathname.startsWith("/sign-in/")) return "/";
  return raw;
}
