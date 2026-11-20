import "server-only";

export const ISSUER_PROD = "https://api.mmlabs.online";

export class IdentityConfigError extends Error {}

/**
 * MM_IDENTITY_ISSUER must be exactly `https://<host>` (production: https://api.mmlabs.online). Outside
 * production, `http://localhost:<port>` is also allowed (local Identity API). Messages never carry the value.
 */
export function loadIdentityConfig(env: Record<string, string | undefined>): {
  issuer: string;
  jwksUrl: string;
} {
  const raw = env.MM_IDENTITY_ISSUER;
  if (!raw) throw new IdentityConfigError("MM_IDENTITY_ISSUER must be set");
  const bad = new IdentityConfigError("MM_IDENTITY_ISSUER must be https://<host>");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw bad;
  }
  const production = env.NODE_ENV === "production";
  const localhost = u.protocol === "http:" && u.hostname === "localhost" && u.port !== "";
  const plain =
    u.username === "" &&
    u.password === "" &&
    (u.port === "" || localhost) &&
    raw === `${u.protocol}//${u.host}`;
  if (!plain || (u.protocol !== "https:" && !(localhost && !production))) throw bad;
  if (production && raw !== ISSUER_PROD) {
    throw new IdentityConfigError(`MM_IDENTITY_ISSUER must be ${ISSUER_PROD} in production`);
  }
  return { issuer: raw, jwksUrl: `${raw}/.well-known/jwks.json` };
}
