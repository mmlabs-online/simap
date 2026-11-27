import "server-only";
// mmlabs Identity access-token verification (port of tudocuatui server/identity.js; org-admin-api
// docs/consumers.md, "Verifying (backend)"). Header only; fail closed; the result carries a fixed `code` and nothing
// else. Never logs, never reads err.message, never touches the database. No tier or HTTP logic lives here.
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { createJwksResolver, JwksUnavailable } from "./jwks";

export const AUDIENCE = "simap";
export const MAX_TOKEN_CHARS = 8192; // consumers.md: tokens are up to ~5 KB
const MAX_TOKEN_AGE_S = 43200; // 12-hour Identity tokens (D7)
const CLAIMS = new Set(["iss", "aud", "typ", "iat", "nbf", "exp", "sub", "jti"]);
const TOKEN_RE = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i;

export type VerifyCode =
  | "missing"
  | "too_large"
  | "malformed"
  | "alg"
  | "signature"
  | "expired"
  | "unknown_kid"
  | "jwks_unavailable"
  | "key_in_header"
  | "email_unverified"
  | "sub_invalid"
  | "org_invalid"
  | "org_roles_missing"
  | "org_roles_invalid"
  | "invalid"
  | `claim_${"iss" | "aud" | "typ" | "iat" | "nbf" | "exp" | "sub" | "jti"}`;

export type VerifiedIdentity = {
  sub: string;
  email: string | null;
  org: string | null;
  orgRoles: string[] | null;
  /** Raw claims for the D86 super-admin check; set only when `org` is present. Absent = no grant. */
  appRoles?: readonly string[];
  orgAccess?: string | null;
  lifetimeS?: number;
};

export type VerifyResult =
  | { ok: true; identity: VerifiedIdentity }
  | { ok: false; code: VerifyCode; unavailable?: true };

class KeyInHeader extends Error {}

function codeOf(err: unknown): VerifyCode {
  if (err instanceof JwksUnavailable) return "jwks_unavailable";
  if (err instanceof KeyInHeader) return "key_in_header";
  const e = err as { code?: unknown; claim?: unknown } | null;
  switch (e?.code) {
    case "ERR_JWS_INVALID":
    case "ERR_JWT_INVALID":
      return "malformed";
    case "ERR_JOSE_ALG_NOT_ALLOWED":
      return "alg";
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED":
      return "signature";
    case "ERR_JWT_EXPIRED":
      return "expired";
    case "ERR_JWKS_NO_MATCHING_KEY":
      return "unknown_kid";
    case "ERR_JWT_CLAIM_VALIDATION_FAILED":
      return typeof e.claim === "string" && CLAIMS.has(e.claim)
        ? (`claim_${e.claim}` as VerifyCode)
        : "invalid";
    default:
      return "invalid";
  }
}

export type IdentityVerifier = { verify(authorization: string | null): Promise<VerifyResult> };

export function createIdentityVerifier({
  issuer,
  jwksUrl,
  jwks,
  fetch,
  timeoutMs,
  now,
  log,
}: {
  issuer: string;
  jwksUrl?: string;
  jwks?: JWTVerifyGetKey;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
}): IdentityVerifier {
  let remote: JWTVerifyGetKey | undefined = jwks;
  const getKey: JWTVerifyGetKey = async (header, token) => {
    // A token must never carry its own key or a key location (D50); checked before any key lookup.
    for (const f of ["jku", "x5u", "jwk", "x5c"]) if (f in header) throw new KeyInHeader();
    // Lazy: no fetch at startup (image start checks run without a network).
    remote ??= createJwksResolver({
      url: jwksUrl ?? `${issuer}/.well-known/jwks.json`,
      fetch,
      timeoutMs,
      now,
      log,
    });
    try {
      return await remote(header, token);
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      if (
        err instanceof JwksUnavailable ||
        code === "ERR_JWKS_NO_MATCHING_KEY" ||
        code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS"
      )
        throw err;
      throw new JwksUnavailable();
    }
  };
  return {
    async verify(header) {
      if (typeof header !== "string" || !/^Bearer /i.test(header))
        return { ok: false, code: "missing" };
      if (header.length > 7 + MAX_TOKEN_CHARS) return { ok: false, code: "too_large" };
      const m = TOKEN_RE.exec(header);
      if (!m) return { ok: false, code: "malformed" };
      try {
        const { payload } = await jwtVerify(m[1], getKey, {
          algorithms: ["ES256"],
          issuer,
          audience: AUDIENCE,
          typ: "at+jwt",
          requiredClaims: ["exp", "iat", "sub", "jti", "iss", "aud"],
          clockTolerance: 30,
          maxTokenAge: MAX_TOKEN_AGE_S,
        });
        if (typeof payload.aud !== "string") return { ok: false, code: "claim_aud" };
        if (typeof payload.jti !== "string" || payload.jti === "")
          return { ok: false, code: "claim_jti" };
        if (payload.email_verified !== true) return { ok: false, code: "email_unverified" };
        const sub = payload.sub;
        if (!isCanonicalUuid(sub)) return { ok: false, code: "sub_invalid" };
        const email =
          typeof payload.email === "string" && payload.email !== "" ? payload.email : null;
        // `roles` and `org_access` are read only when `org` is present and only returned as claims (D86);
        // a bad shape never fails the token, it only removes the grant. Policy lives in `accessFromToken`.
        // `ent` is ignored on purpose (D9: simap does not read or enforce it).
        const { org, org_roles: orgRoles } = payload;
        if (org === undefined) {
          if (orgRoles !== undefined) return { ok: false, code: "org_roles_invalid" };
          return { ok: true, identity: { sub, email, org: null, orgRoles: null } };
        }
        if (!isCanonicalUuid(org)) return { ok: false, code: "org_invalid" };
        if (orgRoles === undefined) return { ok: false, code: "org_roles_missing" };
        if (!Array.isArray(orgRoles) || !orgRoles.every((r) => typeof r === "string"))
          return { ok: false, code: "org_roles_invalid" };
        const { roles, org_access: orgAccess } = payload;
        const appRoles =
          Array.isArray(roles) && roles.every((r) => typeof r === "string")
            ? (roles as string[])
            : [];
        return {
          ok: true,
          identity: {
            sub,
            email,
            org,
            orgRoles: orgRoles as string[],
            appRoles,
            orgAccess: typeof orgAccess === "string" ? orgAccess : null,
            lifetimeS: (payload.exp as number) - (payload.iat as number),
          },
        };
      } catch (err) {
        const code = codeOf(err);
        return code === "jwks_unavailable"
          ? { ok: false, code, unavailable: true }
          : { ok: false, code };
      }
    },
  };
}
