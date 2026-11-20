import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const getOrCreateMember = vi.fn();
const setOwnDisplayName = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/members/members", () => ({
  getOrCreateMember: (...a: unknown[]) => getOrCreateMember(...a),
  setOwnDisplayName: (...a: unknown[]) => setOwnDisplayName(...a),
}));

const { GET, PATCH } = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const MEMBER = { id: "m1", displayName: "a", status: "active", needsProfile: true };

const fakeAuth = (orgRoles: string[] = ["simap:user"]) => {
  vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
  globalThis.__simapAuth = {
    issuer: ISSUER,
    deps: {
      verifier: {
        verify: async () => ({
          ok: true,
          identity: { sub: "s1", email: "a@example.com", org: "o1", orgRoles },
        }),
      },
      memberGate: async () => "active",
      log: () => {},
    },
  };
};

const ctx = { params: Promise.resolve({}) };
const get = () =>
  GET(new Request("http://x/api/me", { headers: { authorization: "Bearer t" } }), ctx);
const patch = (body: unknown, type = "application/json") =>
  PATCH(
    new Request("http://x/api/me", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": type, authorization: "Bearer t" },
    }),
    ctx,
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  getOrCreateMember.mockReset();
  setOwnDisplayName.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/me wiring", () => {
  it("no MM_IDENTITY_ISSUER -> 503 unavailable (fails closed, lazy config)", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await get();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("GET returns {sub,email,org,tier,member}", async () => {
    fakeAuth();
    getOrCreateMember.mockResolvedValue({ ok: true, value: MEMBER });
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({
      sub: "s1",
      email: "a@example.com",
      org: "o1",
      tier: "user",
      member: MEMBER,
    });
    expect(getOrCreateMember.mock.calls[0]![2]).toEqual({ sub: "s1", email: "a@example.com" });
  });

  it("GET, user tier, DATABASE_URL unset -> 503 unavailable", async () => {
    fakeAuth();
    getPool.mockImplementation(() => null);
    const r = await get();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("GET maps a service refusal to its status and code", async () => {
    fakeAuth();
    getOrCreateMember.mockResolvedValue({ ok: false, status: 403, code: "forbidden" });
    const r = await get();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "forbidden" } });
  });

  it("token without simap org role -> 403 forbidden, service not called", async () => {
    fakeAuth(["other:role"]);
    const r = await get();
    expect(r.status).toBe(403);
    expect(getOrCreateMember).not.toHaveBeenCalled();
  });

  it("no Authorization -> 401 on GET and PATCH, no network call", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const bare = (method: string) => new Request("http://x/api/me", { method });
    for (const [fn, m] of [
      [GET, "GET"],
      [PATCH, "PATCH"],
    ] as const) {
      const r = await fn(bare(m), ctx);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: { code: "unauthenticated" } });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/me", () => {
  it("invalid bodies -> 400 invalid_request without a database", async () => {
    fakeAuth();
    getPool.mockImplementation(() => null);
    const bad = [
      patch({ displayName: "x" }, "text/plain"),
      patch({ displayName: "x", sub: "s2" }),
      patch({ displayName: "   " }),
      patch({ displayName: "a".repeat(81) }),
    ];
    for (const p of bad) {
      const r = await p;
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    expect(setOwnDisplayName).not.toHaveBeenCalled();
  });

  it("valid body, DATABASE_URL unset -> 503", async () => {
    fakeAuth();
    getPool.mockImplementation(() => null);
    expect((await patch({ displayName: "An" })).status).toBe(503);
  });

  it("valid body -> 200 same shape as GET, sub from the token", async () => {
    fakeAuth();
    const m = { ...MEMBER, displayName: "An", needsProfile: false };
    setOwnDisplayName.mockResolvedValue({ ok: true, value: m });
    const r = await patch({ displayName: " An " });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      sub: "s1",
      email: "a@example.com",
      org: "o1",
      tier: "user",
      member: m,
    });
    expect(setOwnDisplayName.mock.calls[0]![2]).toEqual({ sub: "s1", email: "a@example.com" });
    expect(setOwnDisplayName.mock.calls[0]![3]).toBe("An");
  });

  it("service refusal member_deactivated -> 403", async () => {
    fakeAuth();
    setOwnDisplayName.mockResolvedValue({ ok: false, status: 403, code: "member_deactivated" });
    const r = await patch({ displayName: "An" });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "member_deactivated" } });
  });
});
