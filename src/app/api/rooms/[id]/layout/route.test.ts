import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({ getRoomLayout: vi.fn(), getPool: vi.fn() }));
vi.mock("@/server/layout/layout", () => ({ getRoomLayout: svc.getRoomLayout }));
vi.mock("@/server/db/pool", () => ({ getPool: svc.getPool }));

import { GET } from "./route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const route = (id: string) => ({ params: Promise.resolve({ id }) });
const authed = () =>
  new Request("http://x/api/rooms/x/layout", { headers: { authorization: "Bearer t" } });

const fakeAuth = () => {
  vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
  globalThis.__simapAuth = {
    issuer: ISSUER,
    deps: {
      verifier: {
        verify: async () => ({
          ok: true,
          identity: { sub: "s1", email: "a@example.com", org: "o1", orgRoles: ["simap:user"] },
        }),
      },
      memberGate: async () => "active",
      log: () => {},
    },
  };
};

beforeEach(() => {
  svc.getRoomLayout.mockReset();
  svc.getPool.mockReset();
  svc.getPool.mockReturnValue({});
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("GET /api/rooms/{id}/layout", () => {
  it("non-canonical id is 404 without getPool or the service", async () => {
    fakeAuth();
    const res = await GET(authed(), route("not-a-uuid"));
    expect(res.status).toBe(404);
    expect(svc.getPool).not.toHaveBeenCalled();
    expect(svc.getRoomLayout).not.toHaveBeenCalled();
  });

  it("no pool gives 503 unavailable and the service is not called", async () => {
    fakeAuth();
    svc.getPool.mockReturnValue(null);
    const res = await GET(authed(), route(ID));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: "unavailable" } });
    expect(svc.getRoomLayout).not.toHaveBeenCalled();
  });

  it("success is 200 with Cache-Control no-store and passes ctx.scope, ctx.sub and id", async () => {
    fakeAuth();
    svc.getRoomLayout.mockResolvedValue({ ok: true, value: { version: 3 } });
    const res = await GET(authed(), route(ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ version: 3 });
    const [, scope, sub, id] = svc.getRoomLayout.mock.calls[0]!;
    expect(scope).toMatchObject({ orgId: expect.any(String) });
    expect(sub).toBe("s1");
    expect(id).toBe(ID);
  });

  it("service not_found maps to 404 not_found", async () => {
    fakeAuth();
    svc.getRoomLayout.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const res = await GET(authed(), route(ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });

  it("no Authorization gives 401 and the service is not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const res = await GET(new Request("http://x/api/rooms/x/layout"), route(ID));
    expect(res.status).toBe(401);
    expect(svc.getRoomLayout).not.toHaveBeenCalled();
  });
});
