import "server-only";
import { accessFromToken, atLeast, type Tier } from "@/lib/auth/tier";
import { auditRoute } from "@/lib/audit/route";
import { writeAccessAudit, type AccessAudit } from "@/server/audit/access";
import { loadIdentityConfig, loadSuperAdminRole } from "@/server/identity/config";
import { dbMemberGate } from "@/server/members/gate";
import { createIdentityVerifier, type IdentityVerifier } from "@/server/identity/verify";
import type { OrgScope } from "./org-scope";
import { apiError } from "./respond";

export type AuthContext = Readonly<{
  sub: string;
  email: string | null;
  org: string; // verified `org` claim, for display / responses only
  tier: Tier;
  access: "member" | "super_admin"; // how the tier was granted (D86)
  scope: OrgScope; // the only way to reach org data; built once by withAuth from the verified token
}>;

/** Runtime marker so tests can prove a route export went through `withAuth`. Non-enumerable on the wrapper. */
export const WITH_AUTH_MARK = Symbol.for("simap.withAuth");

const scopeFor = (org: string): OrgScope => Object.freeze({ orgId: org }) as OrgScope;

/** Org-local member check (the deny list: `members.status`, SIM-011). Must fail closed: a throw becomes 503. */
export type MemberGate = (scope: OrgScope, sub: string) => Promise<"active" | "deactivated">;

type Log = (entry: Record<string, unknown>) => void;
export type AuthDeps = {
  verifier: IdentityVerifier;
  memberGate: MemberGate;
  log: Log;
  /** D86 app-scope role key; absent or null = super-admin grant off. */
  superAdminRole?: string | null;
  /** Writes the `access.super_admin` row for super-admin writes; missing = writes fail closed (503). */
  accessAudit?: AccessAudit;
  /** Dev only (SIM-028): replaces the client Authorization header. Unset in production. */
  authorization?: (req: Request) => Promise<string | null>;
};

type RouteContext<P> = { params: Promise<P> };

const logEntry: Log = (entry) => console.error(JSON.stringify(entry));

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
        const v = await d.verifier.verify(
          d.authorization ? await d.authorization(req) : req.headers.get("authorization"),
        );
        if (!v.ok) {
          if (v.unavailable) {
            d.log({ event: "jwks_unavailable" });
            return apiError(503, "unavailable");
          }
          return apiError(401, "unauthenticated");
        }
        const { sub, email, org, orgRoles, appRoles, orgAccess, lifetimeS } = v.identity;
        if (org === null) return apiError(403, "org_required");
        const granted = accessFromToken(
          { orgRoles: orgRoles ?? [], appRoles, orgAccess, lifetimeS },
          d.superAdminRole ?? null,
        );
        if (!granted || !atLeast(granted.tier, opts.tier)) return apiError(403, "forbidden");
        const { tier } = granted;
        const access = granted.via;
        const ctx: AuthContext = Object.freeze({
          sub,
          email,
          org,
          tier,
          access,
          scope: scopeFor(org),
        });
        try {
          if ((await d.memberGate(ctx.scope, sub)) === "deactivated") {
            return apiError(403, "member_deactivated");
          }
        } catch {
          d.log({ event: "member_gate_failed" });
          return apiError(503, "unavailable");
        }
        if (access === "super_admin" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
          try {
            if (!d.accessAudit) throw new Error("access_audit_missing");
            await d.accessAudit(ctx.scope, sub, {
              method: req.method,
              route: auditRoute(new URL(req.url).pathname),
            });
          } catch {
            d.log({ event: "access_audit_failed" });
            return apiError(503, "unavailable");
          }
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
  const superAdminRole = loadSuperAdminRole(process.env);
  if (globalThis.__simapAuth?.issuer !== issuer) {
    globalThis.__simapAuth = {
      issuer,
      deps: {
        verifier: createIdentityVerifier({ issuer, jwksUrl, log: logEntry }),
        memberGate: dbMemberGate,
        log: logEntry,
        superAdminRole,
        accessAudit: writeAccessAudit,
        ...(process.env.NODE_ENV === "development" &&
          process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1" && {
            authorization: async (req: Request) =>
              (await import("./dev-token")).devAuthorization(req),
          }),
      },
    };
  }
  return globalThis.__simapAuth.deps;
}

export const withAuth = createWithAuth(getAuthDeps);
