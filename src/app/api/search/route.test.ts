import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const search = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/search/search", () => ({ search: (...a: unknown[]) => search(...a) }));

const route = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const noParams = { params: Promise.resolve({}) };

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

const get = (qs: string) =>
  route.GET(
    new Request("http://x/api/search" + qs, { headers: { authorization: "Bearer t" } }),
    noParams,
  );

const BODY = { seats: null, devices: null, members: { items: [], nextCursor: null } };

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  search.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/search", () => {
  it("no Authorization -> 401", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const r = await route.GET(new Request("http://x/api/search?q=a"), noParams);
    expect(r.status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it("user tier passes and gets the service result", async () => {
    fakeAuth(["simap:user"]);
    search.mockResolvedValue(BODY);
    const r = await get("?q=Nguy%E1%BB%85n&kind=member");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(BODY);
    expect(search.mock.calls[0]![2]).toMatchObject({
      q: "Nguyễn",
      folded: "nguyen",
      kind: "member",
    });
  });

  it("bad query -> 400 invalid_request without calling search", async () => {
    fakeAuth(["simap:user"]);
    for (const qs of ["", "?q=", "?q=a&limit=51", "?q=a&kind=x"]) {
      const r = await get(qs);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    expect(search).not.toHaveBeenCalled();
  });

  it("no database -> 503 unavailable", async () => {
    fakeAuth(["simap:user"]);
    getPool.mockImplementation(() => null);
    const r = await get("?q=a");
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("200 carries Cache-Control: no-store", async () => {
    fakeAuth(["simap:user"]);
    search.mockResolvedValue(BODY);
    expect((await get("?q=a")).headers.get("cache-control")).toBe("no-store");
  });
});
