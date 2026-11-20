import "server-only";
import { atLeast, tierFromOrgRoles, type Tier } from "@/lib/auth/tier";
import { loadIdentityConfig } from "@/server/identity/config";
import { createIdentityVerifier, type IdentityVerifier } from "@/server/identity/verify";
import type { OrgScope } from "./org-scope";
import { apiError } from "./respond";

export type AuthContext = Readonly<{
  sub: string;
  email: string | null;
  org: string; // verified `org` claim, for display / responses only
  tier: Tier;
  scope: OrgScope; // the only way to reach org data; built once by withAuth from the verified token
}>;

/** Runtime marker so tests can prove a route export went through `withAuth`. Non-enumerable on the wrapper. */
export const WITH_AUTH_MARK = Symbol.for("simap.withAuth");

const scopeFor = (org: string): OrgScope => Object.freeze({ orgId: org }) as OrgScope;

/** Org-local member check (SIM-011 plugs the deny list in here). Must fail closed: a throw becomes 503. */
export type MemberGate = (scope: OrgScope, sub: string) => Promise<"active" | "deactivated">;

type Log = (entry: Record<string, unknown>) => void;
export type AuthDeps = { verifier: IdentityVerifier; memberGate: MemberGate; log: Log };

type RouteContext<P> = { params: Promise<P> };

const logEntry: Log = (entry) => console.error(JSON.stringify(entry));
const allowAll: MemberGate = async () => "active";

/** `deps` may throw (missing or invalid config); the guard then answers 503 and logs once per process. */
export function createWithAuth(deps: () => AuthDeps, configLog: Log = logEntry) {
  let configLogged = false;
  return function withAuth<P = Record<string, string | string[]>>(
    handler: (req: Request, ctx: AuthContext, route: RouteContext<P>) => Promise<Response>,
    opts: { tier: Tier },
  ): (req: Request, route: RouteContext<P>) => Promise<Response> {
    const guarded = async (req: Request, route: RouteContext<P>): Promise<Response> => {
      let d: AuthDeps;
      try {
        d = deps();
      } catch {
        if (!configLogged) {
          configLogged = true;
          configLog({ event: "identity_config_invalid" });
        }
        return apiError(503, "unavailable");
      }
      try {
        const v = await d.verifier.verify(req.headers.get("authorization"));
        if (!v.ok) {
          if (v.unavailable) {
            d.log({ event: "jwks_unavailable" });
            return apiError(503, "unavailable");
          }
          return apiError(401, "unauthenticated");
        }
        const { sub, email, org, orgRoles } = v.identity;
        if (org === null) return apiError(403, "org_required");
        const tier = tierFromOrgRoles(orgRoles ?? []);
        if (!tier || !atLeast(tier, opts.tier)) return apiError(403, "forbidden");
        const ctx: AuthContext = Object.freeze({ sub, email, org, tier, scope: scopeFor(org) });
        try {
          if ((await d.memberGate(ctx.scope, sub)) === "deactivated") {
            return apiError(403, "member_deactivated");
          }
        } catch {
          d.log({ event: "member_gate_failed" });
          return apiError(503, "unavailable");
        }
        try {
          return await handler(req, ctx, route);
        } catch (err) {
          const code = (err as { code?: unknown } | null)?.code;
          d.log({ event: "api_unhandled", code: typeof code === "string" ? code : "error" });
          return apiError(500, "internal");
        }
      } catch {
        d.log({ event: "api_unhandled", code: "error" });
        return apiError(500, "internal");
      }
    };
    Object.defineProperty(guarded, WITH_AUTH_MARK, { value: true });
    return guarded;
  };
}

declare global {
  var __simapAuth: { issuer: string; deps: AuthDeps } | undefined;
}

/** Lazy: reads env on the first request, never at import (so `next build` needs no env or network). */
function getAuthDeps(): AuthDeps {
  const { issuer, jwksUrl } = loadIdentityConfig(process.env);
  if (globalThis.__simapAuth?.issuer !== issuer) {
    globalThis.__simapAuth = {
      issuer,
      deps: {
        verifier: createIdentityVerifier({ issuer, jwksUrl, log: logEntry }),
        memberGate: allowAll, // SIM-011 replaces this with the org-local deny list.
        log: logEntry,
      },
    };
  }
  return globalThis.__simapAuth.deps;
}

export const withAuth = createWithAuth(getAuthDeps);
