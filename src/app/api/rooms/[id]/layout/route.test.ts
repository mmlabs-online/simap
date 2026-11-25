import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  getRoomLayout: vi.fn(),
  saveRoomLayout: vi.fn(),
  getPool: vi.fn(),
}));
vi.mock("@/server/layout/layout", () => ({ getRoomLayout: svc.getRoomLayout }));
vi.mock("@/server/layout/save", () => ({ saveRoomLayout: svc.saveRoomLayout }));
vi.mock("@/server/db/pool", () => ({ getPool: svc.getPool }));

import { GET, PUT } from "./route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const route = (id: string) => ({ params: Promise.resolve({ id }) });
const authed = () =>
  new Request("http://x/api/rooms/x/layout", { headers: { authorization: "Bearer t" } });

const fakeAuth = (role = "simap:user") => {
  vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
  globalThis.__simapAuth = {
    issuer: ISSUER,
    deps: {
      verifier: {
        verify: async () => ({
          ok: true,
          identity: { sub: "s1", email: "a@example.com", org: "o1", orgRoles: [role] },
        }),
      },
      memberGate: async () => "active",
      log: () => {},
    },
  };
};

beforeEach(() => {
  svc.getRoomLayout.mockReset();
  svc.saveRoomLayout.mockReset();
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

const SAVE = { baseVersion: 0, w: 4, h: 4, floors: [], seats: [], fixtures: [] };
const put = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api/rooms/x/layout", {
    method: "PUT",
    headers: { authorization: "Bearer t", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("PUT /api/rooms/{id}/layout", () => {
  it("non-canonical id is 404, no pool is 503, service not called", async () => {
    fakeAuth("simap:admin");
    expect((await PUT(put(SAVE), route("nope"))).status).toBe(404);
    svc.getPool.mockReturnValue(null);
    expect((await PUT(put(SAVE), route(ID))).status).toBe(503);
    expect(svc.saveRoomLayout).not.toHaveBeenCalled();
  });

  it("user and manager get 403, service not called", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth(role);
      expect((await PUT(put(SAVE), route(ID))).status).toBe(403);
    }
    expect(svc.saveRoomLayout).not.toHaveBeenCalled();
  });

  it("no Authorization gives 401", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const req = new Request("http://x/api/rooms/x/layout", { method: "PUT", body: "{}" });
    expect((await PUT(req, route(ID))).status).toBe(401);
    expect(svc.saveRoomLayout).not.toHaveBeenCalled();
  });

  it("bad JSON, wrong content type and a body over 262,144 bytes give 400", async () => {
    fakeAuth("simap:admin");
    expect((await PUT(put("{nope"), route(ID))).status).toBe(400);
    const wrongType = put(SAVE, { "content-type": "text/plain" });
    expect((await PUT(wrongType, route(ID))).status).toBe(400);
    const big = put(JSON.stringify({ ...SAVE, pad: "x".repeat(262_144) }));
    expect((await PUT(big, route(ID))).status).toBe(400);
    expect(svc.saveRoomLayout).not.toHaveBeenCalled();
  });

  it("validator invalid_request gives 400 and a rule code gives 422; service not called", async () => {
    fakeAuth("simap:admin");
    expect((await PUT(put({ ...SAVE, w: "4" }), route(ID))).status).toBe(400);
    const unknown = { ...SAVE, fixtures: [{ sprite: "no_such_sprite", x: 0, y: 0, rotation: 0 }] };
    const res = await PUT(put(unknown), route(ID));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: { code: "layout_unknown_sprite" } });
    expect(svc.saveRoomLayout).not.toHaveBeenCalled();
  });

  it("a fixture on a desk passes the pre-check and reaches the service", async () => {
    fakeAuth("simap:admin");
    const onDesk = {
      ...SAVE,
      seats: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          sprite: "desk.single",
          x: 1,
          y: 1,
          rotation: 0,
        },
      ],
      fixtures: [{ sprite: "prop.mug", x: 1, y: 1, rotation: 0 }],
    };
    svc.saveRoomLayout.mockResolvedValue({ ok: true, value: { version: 1 } });
    const res = await PUT(put(onDesk), route(ID));
    expect(res.status).toBe(200);
    expect(svc.saveRoomLayout).toHaveBeenCalledTimes(1);
  });

  it("maps each refusal: 404, 409 stale, 409 seats changed, 422 too many seats, overlap, hidden", async () => {
    fakeAuth("simap:admin");
    const cases = [
      [404, "not_found"],
      [409, "layout_stale"],
      [409, "layout_seats_changed"],
      [422, "layout_too_many_seats"],
      [422, "layout_overlap"],
      [422, "layout_item_hidden"],
    ] as const;
    for (const [status, code] of cases) {
      svc.saveRoomLayout.mockResolvedValueOnce({ ok: false, status, code });
      const res = await PUT(put(SAVE), route(ID));
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ error: { code } });
    }
  });

  it("success is 200, no-store, and passes ctx.scope, ctx.sub, id and the validated value", async () => {
    fakeAuth("simap:admin");
    svc.saveRoomLayout.mockResolvedValue({ ok: true, value: { version: 1 } });
    const res = await PUT(put(SAVE), route(ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ version: 1 });
    const [, scope, sub, id, value] = svc.saveRoomLayout.mock.calls[0]!;
    expect(scope).toMatchObject({ orgId: expect.any(String) });
    expect(sub).toBe("s1");
    expect(id).toBe(ID);
    expect(value).toEqual(SAVE);
  });
});
