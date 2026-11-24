import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const getDashboard = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/dashboard/dashboard", () => ({
  getDashboard: (...a: unknown[]) => getDashboard(...a),
}));

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

const get = () =>
  route.GET(
    new Request("http://x/api/dashboard", { headers: { authorization: "Bearer t" } }),
    noParams,
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  getDashboard.mockReset();
  getDashboard.mockImplementation(async (_p, _s, opts: { includeHolders: boolean }) => ({
    totals: {},
    rooms: [],
    roomsTruncated: false,
    deactivatedHolders: opts.includeHolders ? { total: 1, items: [{ seatCount: 1 }] } : null,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/dashboard tier gate", () => {
  it("user tier: includeHolders false and deactivatedHolders null", async () => {
    fakeAuth(["simap:user"]);
    const r = await get();
    expect(r.status).toBe(200);
    expect(getDashboard.mock.calls[0]![2]).toEqual({ includeHolders: false });
    expect((await r.json()).deactivatedHolders).toBeNull();
  });

  it("manager and admin: includeHolders true", async () => {
    for (const role of ["simap:manager", "simap:admin"]) {
      getDashboard.mockClear();
      fakeAuth([role]);
      const r = await get();
      expect(getDashboard.mock.calls[0]![2], role).toEqual({ includeHolders: true });
      expect((await r.json()).deactivatedHolders, role).toMatchObject({ total: 1 });
    }
  });

  it("200 carries Cache-Control: no-store", async () => {
    fakeAuth(["simap:user"]);
    expect((await get()).headers.get("cache-control")).toBe("no-store");
  });
});
