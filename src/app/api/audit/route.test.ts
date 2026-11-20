import { afterEach, describe, expect, it, vi } from "vitest";

const pool = { query: vi.fn() };
const getPool = vi.fn<() => unknown>(() => pool);
const listAudit = vi.fn(async (..._a: unknown[]) => ({ items: [], nextCursor: null }));
const listAuditFacets = vi.fn(async (..._a: unknown[]) => ({ actors: [], entities: [] }));

vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/audit/audit", () => ({
  listAudit: (...a: unknown[]) => listAudit(...a),
  listAuditFacets: (...a: unknown[]) => listAuditFacets(...a),
}));

const { GET } = await import("./route");
const { GET: facetsGET } = await import("./facets/route");

const ISSUER = "https://api.mmlabs.online";
const noParams = { params: Promise.resolve({}) };
const ACTOR = "22222222-2222-4222-8222-222222222222";

const fakeAuth = (orgRoles: string[]) => {
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
const req = (qs = "", path = "/api/audit") =>
  new Request(`http://x${path}${qs}`, { headers: { authorization: "Bearer t" } });

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
  vi.clearAllMocks();
  getPool.mockImplementation(() => pool);
});

describe("audit routes", () => {
  it("no Authorization -> 401 on both handlers", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (p: string) => new Request(`http://x${p}`);
    expect((await GET(bare("/api/audit"), noParams)).status).toBe(401);
    expect((await facetsGET(bare("/api/audit/facets"), noParams)).status).toBe(401);
  });

  it("user and manager get 403 forbidden, service not called; admin passes the gate", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      for (const r of [
        await GET(req(), noParams),
        await facetsGET(req("", "/api/audit/facets"), noParams),
      ]) {
        expect(r.status).toBe(403);
        expect(await r.json()).toEqual({ error: { code: "forbidden" } });
      }
    }
    expect(listAudit).not.toHaveBeenCalled();
    expect(listAuditFacets).not.toHaveBeenCalled();
    fakeAuth(["simap:admin"]);
    expect((await GET(req(), noParams)).status).toBe(200);
    expect((await facetsGET(req("", "/api/audit/facets"), noParams)).status).toBe(200);
  });

  it("invalid query -> 400 invalid_request, service not called", async () => {
    fakeAuth(["simap:admin"]);
    const r = await GET(req("?limit=1000"), noParams);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    expect(listAudit).not.toHaveBeenCalled();
  });

  it("filters reach the service; org in the query string is ignored, token org is the scope", async () => {
    fakeAuth(["simap:admin"]);
    await GET(req(`?org=other&actor=${ACTOR}&entity=room&limit=7`), noParams);
    const [db, scope, filter] = listAudit.mock.calls[0] as [unknown, { orgId: string }, unknown];
    expect(db).toBe(pool);
    expect(scope.orgId).toBe("o1");
    expect(filter).toEqual({ actor: ACTOR, entity: "room", limit: 7 });
  });

  it("no pool -> 503 on both handlers", async () => {
    fakeAuth(["simap:admin"]);
    getPool.mockImplementation(() => null);
    expect((await GET(req(), noParams)).status).toBe(503);
    expect((await facetsGET(req("", "/api/audit/facets"), noParams)).status).toBe(503);
  });

  it("response has Cache-Control: no-store", async () => {
    fakeAuth(["simap:admin"]);
    expect((await GET(req(), noParams)).headers.get("cache-control")).toBe("no-store");
    expect(
      (await facetsGET(req("", "/api/audit/facets"), noParams)).headers.get("cache-control"),
    ).toBe("no-store");
  });
});
