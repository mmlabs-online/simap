import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({ listMapItems: vi.fn() }));
vi.mock("@/server/map-items/map-items", () => svc);
const pool = vi.hoisted(() => ({ getPool: vi.fn((): object | null => ({})) }));
vi.mock("@/server/db/pool", () => pool);

import { GET } from "./route";

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

const req = () => new Request("http://x/api/map-items", { headers: { authorization: "Bearer t" } });

beforeEach(() => {
  svc.listMapItems.mockReset();
  pool.getPool.mockReset();
  pool.getPool.mockReturnValue({});
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/map-items", () => {
  it("401 without token; service not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const r = await GET(new Request("http://x/api/map-items"), noParams);
    expect(r.status).toBe(401);
    expect(svc.listMapItems).not.toHaveBeenCalled();
  });

  it("200 with no-store; service gets ctx.scope", async () => {
    fakeAuth(["simap:user"]);
    svc.listMapItems.mockResolvedValue({ ok: true, value: { items: [] } });
    const r = await GET(req(), noParams);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ items: [] });
    expect(svc.listMapItems.mock.calls[0]![1]).toMatchObject({ orgId: "o1" });
  });

  it("admin tier passes includeHidden true; manager and user pass false", async () => {
    svc.listMapItems.mockResolvedValue({ ok: true, value: { items: [] } });
    const seen: boolean[] = [];
    for (const role of ["simap:admin", "simap:manager", "simap:user"]) {
      fakeAuth([role]);
      await GET(req(), noParams);
      seen.push(svc.listMapItems.mock.calls.at(-1)![2].includeHidden);
    }
    expect(seen).toEqual([true, false, false]);
  });

  it("503 unavailable when no pool", async () => {
    fakeAuth(["simap:user"]);
    pool.getPool.mockReturnValue(null);
    const r = await GET(req(), noParams);
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("unavailable");
    expect(svc.listMapItems).not.toHaveBeenCalled();
  });
});
