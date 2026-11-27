import { describe, expect, it, vi } from "vitest";
import type { Tier } from "@/lib/auth/tier";
import type { VerifyCode, VerifyResult } from "@/server/identity/verify";
import type { AccessAudit } from "@/server/audit/access";
import { writeAccessAudit } from "@/server/audit/access";
import { dbMemberGate } from "@/server/members/gate";
import {
  WITH_AUTH_MARK,
  withAuth,
  createWithAuth,
  type AuthContext,
  type AuthDeps,
  type MemberGate,
} from "./with-auth";

const SUB = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const EMAIL = "someone@example.com";

const okResult = (
  orgRoles: string[] | null,
  over: Partial<{
    org: string | null;
    email: string | null;
    appRoles: string[];
    orgAccess: string | null;
    lifetimeS: number;
  }> = {},
): VerifyResult => ({
  ok: true,
  identity: { sub: SUB, email: EMAIL, org: ORG, orgRoles, ...over },
});

const SA_KEY = "simap:super-admin";
const SA = { appRoles: [SA_KEY], orgAccess: "super_admin", lifetimeS: 3600 };

function setup(
  result: VerifyResult | (() => never),
  gate?: MemberGate,
  opts: { superAdminRole?: string | null; accessAudit?: AccessAudit | null } = {},
) {
  const logs: Array<Record<string, unknown>> = [];
  const configLogs: Array<Record<string, unknown>> = [];
  const verify = vi.fn(async (_h: string | null) => {
    if (typeof result === "function") return result();
    return result;
  });
  const memberGate = vi.fn<MemberGate>(gate ?? (async () => "active"));
  const accessAudit = vi.fn<AccessAudit>(async () => {});
  const deps: AuthDeps = {
    verifier: { verify },
    memberGate,
    log: (e) => logs.push(e),
    superAdminRole: "superAdminRole" in opts ? opts.superAdminRole : SA_KEY,
    ...(opts.accessAudit !== null && { accessAudit: opts.accessAudit ?? accessAudit }),
  };
  const withAuth = createWithAuth(
    () => deps,
    (e) => configLogs.push(e),
  );
  const handler = vi.fn(async (_req: Request, ctx: AuthContext) => Response.json(ctx));
  const call = (tier: Tier, method = "GET") =>
    withAuth(handler, { tier })(
      new Request(`http://x/api/t/${ORG}?q=1`, {
        method,
        headers: { authorization: "Bearer a.b.c" },
      }),
      { params: Promise.resolve({}) },
    );
  return { logs, configLogs, verify, memberGate, handler, call, withAuth, accessAudit };
}

const body = async (r: Response) => JSON.stringify(await r.json());

describe("withAuth authorization dep (dev only)", () => {
  const call = (authorization: AuthDeps["authorization"], result: VerifyResult) => {
    const verify = vi.fn(async (_h: string | null) => result);
    const deps: AuthDeps = {
      verifier: { verify },
      memberGate: async () => "active",
      log: () => {},
      authorization,
    };
    const route = createWithAuth(() => deps)(async () => new Response("ok"), { tier: "user" });
    const run = () =>
      route(new Request("http://x/api/t", { headers: { authorization: "Bearer client" } }), {
        params: Promise.resolve({}),
      });
    return { verify, run };
  };

  it("verifier gets the dep result, not the client header", async () => {
    const t = call(async () => "Bearer dev", okResult(["simap:user"]));
    expect((await t.run()).status).toBe(200);
    expect(t.verify).toHaveBeenCalledWith("Bearer dev");
  });

  it("dep returning null -> 401 unauthenticated even with a client Authorization header", async () => {
    const t = call(async () => null, { ok: false, code: "missing" });
    const r = await t.run();
    expect(r.status).toBe(401);
    expect(t.verify).toHaveBeenCalledWith(null);
  });

  it("no dep -> verifier gets req.headers.get('authorization') unchanged", async () => {
    const t = call(undefined, okResult(["simap:user"]));
    await t.run();
    expect(t.verify).toHaveBeenCalledWith("Bearer client");
  });
});

describe("withAuth", () => {
  it("manager token reaches a manager route with {sub,email,org,tier}", async () => {
    const t = setup(okResult(["simap:manager"]));
    const r = await t.call("manager");
    expect(r.status).toBe(200);
    expect(t.handler).toHaveBeenCalledTimes(1);
    expect(t.handler.mock.calls[0][1]).toEqual({
      sub: SUB,
      email: EMAIL,
      org: ORG,
      tier: "manager",
      access: "member",
      scope: { orgId: ORG },
    });
    expect(t.verify).toHaveBeenCalledWith("Bearer a.b.c");
  });

  it("ctx.scope comes from the verified org, is frozen, and is the scope given to the member gate", async () => {
    const t = setup(okResult(["simap:user"]));
    await t.call("user");
    const ctx = t.handler.mock.calls[0][1];
    expect(ctx.scope.orgId).toBe(ORG);
    expect(Object.isFrozen(ctx.scope)).toBe(true);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(t.memberGate.mock.calls[0][0]).toBe(ctx.scope);
  });

  it("returned function carries a non-enumerable withAuth marker", () => {
    const t = setup(okResult(["simap:user"]));
    const fn = t.withAuth(t.handler, { tier: "user" }) as unknown as Record<symbol, unknown>;
    expect(WITH_AUTH_MARK).toBe(Symbol.for("simap.withAuth"));
    expect(fn[WITH_AUTH_MARK]).toBe(true);
    expect(Object.keys(fn)).not.toContain(String(WITH_AUTH_MARK));
    expect(Object.getOwnPropertySymbols(fn)).toContain(WITH_AUTH_MARK);
    expect(Object.keys(fn)).toEqual([]);
  });

  it("admin token passes a manager route with tier admin; user token on a manager route -> 403 forbidden", async () => {
    const admin = setup(okResult(["simap:user", "simap:admin"]));
    expect((await admin.call("manager")).status).toBe(200);
    expect(admin.handler.mock.calls[0][1].tier).toBe("admin");
    const user = setup(okResult(["simap:user"]));
    const r = await user.call("manager");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "forbidden" } });
    expect(user.handler).not.toHaveBeenCalled();
  });

  it("every token failure is 401 {error:{code:'unauthenticated'}} with WWW-Authenticate: Bearer", async () => {
    const causes: VerifyCode[] = [
      "missing",
      "too_large",
      "malformed",
      "alg",
      "signature",
      "expired",
      "unknown_kid",
      "key_in_header",
      "email_unverified",
      "sub_invalid",
      "org_invalid",
      "org_roles_missing",
      "org_roles_invalid",
      "invalid",
      "claim_iss",
      "claim_aud",
      "claim_typ",
    ];
    const bodies = new Set<string>();
    for (const code of causes) {
      const t = setup({ ok: false, code });
      const r = await t.call("user");
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toBe("Bearer");
      bodies.add(await body(r));
      expect(t.handler).not.toHaveBeenCalled();
      expect(t.logs).toEqual([]);
    }
    expect([...bodies]).toEqual([JSON.stringify({ error: { code: "unauthenticated" } })]);
  });

  it("no org -> 403 org_required", async () => {
    const t = setup(okResult(null, { org: null }));
    const r = await t.call("user");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "org_required" } });
  });

  it("org_roles without a simap tier role -> 403 forbidden; simap:admin only in roles -> 403 forbidden", async () => {
    // `roles` never reaches the guard (the verifier does not read it), so such a token has no org_roles tier.
    for (const roles of [["simap:member"], [], ["other:admin"]]) {
      const t = setup(okResult(roles));
      const r = await t.call("user");
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "forbidden" } });
      expect(t.memberGate).not.toHaveBeenCalled();
    }
  });

  it("JWKS unavailable -> 503 unavailable with Retry-After; handler not called", async () => {
    const t = setup({ ok: false, code: "jwks_unavailable", unavailable: true });
    const r = await t.call("user");
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBe("5");
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
    expect(t.handler).not.toHaveBeenCalled();
    expect(t.logs).toEqual([{ event: "jwks_unavailable" }]);
  });

  it("missing/invalid config -> 503 unavailable and one log {event:'identity_config_invalid'}", async () => {
    const configLogs: Array<Record<string, unknown>> = [];
    const withAuth = createWithAuth(
      () => {
        throw new Error("MM_IDENTITY_ISSUER must be set");
      },
      (e) => configLogs.push(e),
    );
    const handler = vi.fn(async () => new Response("x"));
    const route = withAuth(handler, { tier: "user" });
    for (let i = 0; i < 3; i++) {
      const r = await route(new Request("http://x/api/t"), { params: Promise.resolve({}) });
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: { code: "unavailable" } });
    }
    expect(handler).not.toHaveBeenCalled();
    expect(configLogs).toEqual([{ event: "identity_config_invalid" }]);
  });

  it("member gate: default allows; deactivated -> 403 member_deactivated; throws -> 503 + log; not called when tier check fails", async () => {
    expect((await setup(okResult(["simap:user"])).call("user")).status).toBe(200);

    const dead = setup(okResult(["simap:user"]), async () => "deactivated");
    const r = await dead.call("user");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "member_deactivated" } });
    expect(dead.handler).not.toHaveBeenCalled();

    const boom = setup(okResult(["simap:user"]), async () => {
      throw new Error("db down");
    });
    const r2 = await boom.call("user");
    expect(r2.status).toBe(503);
    expect(await r2.json()).toEqual({ error: { code: "unavailable" } });
    expect(boom.logs).toEqual([{ event: "member_gate_failed" }]);

    const low = setup(okResult(["simap:user"]));
    await low.call("admin");
    expect(low.memberGate).not.toHaveBeenCalled();

    const scoped = setup(okResult(["simap:user"]));
    await scoped.call("user");
    expect(scoped.memberGate.mock.calls[0][0].orgId).toBe(ORG);
    expect(scoped.memberGate.mock.calls[0][1]).toBe(SUB);
  });

  it("default deps wire the DB member gate", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", "https://api.mmlabs.online");
    globalThis.__simapAuth = undefined;
    try {
      const r = await withAuth(async () => Response.json({}), { tier: "user" })(
        new Request("http://x/api/t"),
        { params: Promise.resolve({}) },
      );
      expect(r.status).toBe(401);
      const deps = (globalThis.__simapAuth as { deps: AuthDeps } | undefined)?.deps;
      expect(deps?.memberGate).toBe(dbMemberGate);
      expect(deps?.accessAudit).toBe(writeAccessAudit);
    } finally {
      globalThis.__simapAuth = undefined;
      vi.unstubAllEnvs();
    }
  });

  it("handler throws -> 500 internal, body has no message, log has only {event:'api_unhandled', code}", async () => {
    const t = setup(okResult(["simap:user"]));
    t.handler.mockRejectedValueOnce(Object.assign(new Error("secret detail"), { code: "23505" }));
    const r = await t.call("user");
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: { code: "internal" } });
    t.handler.mockRejectedValueOnce(new Error("secret detail"));
    await t.call("user");
    expect(t.logs).toEqual([
      { event: "api_unhandled", code: "23505" },
      { event: "api_unhandled", code: "error" },
    ]);
  });

  it("verifier throwing is a 500 internal, never a pass", async () => {
    const t = setup(() => {
      throw new Error("boom");
    });
    const r = await t.call("user");
    expect(r.status).toBe(500);
    expect(t.handler).not.toHaveBeenCalled();
  });

  it("forwards Next route params promise to the handler", async () => {
    const t = setup(okResult(["simap:user"]));
    const withAuth = t.withAuth<{ id: string }>(
      async (_req, _ctx, route) => Response.json(await route.params),
      { tier: "user" },
    );
    const r = await withAuth(new Request("http://x/api/t/7"), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(await r.json()).toEqual({ id: "7" });
  });

  it("logs never contain the token, sub, email or org (spy injected log and console)", async () => {
    const spies = (["log", "error", "warn", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m),
    );
    const cases = [
      setup({ ok: false, code: "jwks_unavailable", unavailable: true }),
      setup(okResult(["simap:user"]), async () => {
        throw new Error(`${SUB} ${EMAIL}`);
      }),
      setup(okResult([], SA), undefined, {
        accessAudit: async () => {
          throw new Error(`${SUB} ${ORG}`);
        },
      }),
      setup(okResult(["simap:user"])),
    ];
    cases[3].handler.mockRejectedValueOnce(new Error(`${SUB} ${EMAIL} ${ORG} a.b.c`));
    for (const c of cases) await c.call("user", c === cases[2] ? "POST" : "GET");
    const out = JSON.stringify([
      ...cases.flatMap((c) => c.logs),
      ...spies.flatMap((s) => s.mock.calls),
    ]);
    expect(out).not.toContain(SUB);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(ORG);
    expect(out).not.toContain("a.b.c");
    expect(cases.flatMap((c) => c.logs).length).toBe(4);
  });

  describe("super admin (D86)", () => {
    const withSa = (over = {}) => okResult([], { ...SA, ...over });

    it("reaches an admin route with tier admin, access super_admin", async () => {
      const t = setup(withSa());
      const r = await t.call("admin");
      expect(r.status).toBe(200);
      const ctx = t.handler.mock.calls[0][1];
      expect(ctx.tier).toBe("admin");
      expect(ctx.access).toBe("super_admin");
    });

    it("near-miss role / org_access member / role unset in config -> 403 forbidden, handler and gate not called", async () => {
      const cases = [
        setup(withSa({ appRoles: ["simap:admin"] })),
        setup(withSa({ appRoles: ["simap:super-admin "] })),
        setup(withSa({ orgAccess: "member" })),
        setup(withSa({ lifetimeS: 3601 })),
        setup(withSa(), undefined, { superAdminRole: null }),
        setup(okResult(["simap:user"], SA), undefined, {}),
      ];
      for (const t of cases) {
        const r = await t.call("user", "POST");
        expect(r.status).toBe(403);
        expect(await r.json()).toEqual({ error: { code: "forbidden" } });
        expect(t.handler).not.toHaveBeenCalled();
        expect(t.memberGate).not.toHaveBeenCalled();
        expect(t.accessAudit).not.toHaveBeenCalled();
      }
    });

    it("claims without org -> 403 org_required", async () => {
      const t = setup(withSa({ org: null }));
      const r = await t.call("user");
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "org_required" } });
    });

    it("ctx.scope is {orgId: org}, frozen, same object given to gate and audit", async () => {
      const t = setup(withSa());
      await t.call("admin", "POST");
      const ctx = t.handler.mock.calls[0][1];
      expect(ctx.scope).toEqual({ orgId: ORG });
      expect(Object.isFrozen(ctx.scope)).toBe(true);
      expect(t.memberGate.mock.calls[0][0]).toBe(ctx.scope);
      expect(t.accessAudit.mock.calls[0][0]).toBe(ctx.scope);
    });

    it("write (POST/PUT/PATCH/DELETE) calls accessAudit once before the handler with scope, sub, {method, route}", async () => {
      for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
        const t = setup(withSa());
        const order: string[] = [];
        t.accessAudit.mockImplementation(async () => void order.push("audit"));
        t.handler.mockImplementation(async () => {
          order.push("handler");
          return new Response("ok");
        });
        expect((await t.call("admin", m)).status).toBe(200);
        expect(order).toEqual(["audit", "handler"]);
        expect(t.accessAudit).toHaveBeenCalledTimes(1);
        expect(t.accessAudit).toHaveBeenCalledWith({ orgId: ORG }, SUB, {
          method: m,
          route: "/api/t/:id",
        });
      }
    });

    it("GET/HEAD: no access audit; member token write: no access audit", async () => {
      for (const m of ["GET", "HEAD"]) {
        const t = setup(withSa());
        await t.call("admin", m);
        expect(t.accessAudit).not.toHaveBeenCalled();
      }
      const t = setup(okResult(["simap:admin"]));
      await t.call("admin", "POST");
      expect(t.accessAudit).not.toHaveBeenCalled();
    });

    it("accessAudit throws or is missing -> 503 unavailable, handler not called, log access_audit_failed", async () => {
      const boom = setup(withSa(), undefined, {
        accessAudit: async () => {
          throw new Error("db down");
        },
      });
      const missing = setup(withSa(), undefined, { accessAudit: null });
      for (const t of [boom, missing]) {
        const r = await t.call("admin", "POST");
        expect(r.status).toBe(503);
        expect(await r.json()).toEqual({ error: { code: "unavailable" } });
        expect(t.handler).not.toHaveBeenCalled();
        expect(t.logs).toEqual([{ event: "access_audit_failed" }]);
      }
    });

    it("deactivated row -> 403 member_deactivated, no access audit, handler not called", async () => {
      const t = setup(withSa(), async () => "deactivated");
      const r = await t.call("admin", "POST");
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "member_deactivated" } });
      expect(t.accessAudit).not.toHaveBeenCalled();
      expect(t.handler).not.toHaveBeenCalled();
    });
  });
});
