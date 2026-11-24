import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
  getDevice: vi.fn(),
  listDevices: vi.fn(),
  placeDevice: vi.fn(),
}));
vi.mock("@/server/devices/devices", () => svc);
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { GET as listGET, POST } from "./route";
import { DELETE, GET, PATCH } from "./[id]/route";
import { PUT } from "./[id]/placement/route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const SEAT = "55555555-5555-4555-8555-555555555555";
const idRoute = { params: Promise.resolve({ id: ID }) };
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

const req = (method: string, url = "http://x/api/devices", body?: unknown) =>
  new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const okPut = { seatId: SEAT, role: "primary", expectedSeatId: null };

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("devices routes", () => {
  it("401 without token", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/devices", { method: m });
    const rs = [
      await listGET(bare("GET"), noParams),
      await GET(bare("GET"), idRoute),
      await PUT(bare("PUT"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("GET list/detail and PUT placement call the service with ctx.scope, ctx.sub, ctx.tier; 200 is no-store", async () => {
    fakeAuth(["simap:manager"]);
    svc.listDevices.mockResolvedValue({ ok: true, value: { items: [], truncated: false } });
    svc.getDevice.mockResolvedValue({ ok: true, value: { id: ID } });
    svc.placeDevice.mockResolvedValue({ ok: true, value: { id: ID } });
    const list = await listGET(req("GET", "http://x/api/devices?placement=placed"), noParams);
    const one = await GET(req("GET"), idRoute);
    const put = await PUT(req("PUT", undefined, okPut), idRoute);
    for (const r of [list, one, put]) {
      expect(r.status).toBe(200);
      expect(r.headers.get("Cache-Control")).toBe("no-store");
    }
    const [, scopeArg, sub, tier, filter] = svc.listDevices.mock.calls[0]!;
    expect([sub, tier, filter]).toEqual(["s1", "manager", "placed"]);
    expect(scopeArg).toBeTruthy();
    expect(svc.getDevice.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID]);
    expect(svc.placeDevice.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID, okPut]);
  });

  it("non-uuid id -> 404 without calling the service; bad body or query -> 400", async () => {
    fakeAuth(["simap:user"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    for (const r of [await GET(req("GET"), bad), await PUT(req("PUT", undefined, okPut), bad)]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: { code: "not_found" } });
    }
    expect((await PUT(req("PUT", undefined, { seatId: SEAT }), idRoute)).status).toBe(400);
    expect(
      (await listGET(req("GET", "http://x/api/devices?placement=nope"), noParams)).status,
    ).toBe(400);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("refusal -> apiError(status, code), no-store", async () => {
    fakeAuth(["simap:user"]);
    svc.placeDevice.mockResolvedValue({ ok: false, status: 409, code: "seat_has_primary" });
    svc.getDevice.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const p = await PUT(req("PUT", undefined, okPut), idRoute);
    expect([p.status, await p.json()]).toEqual([409, { error: { code: "seat_has_primary" } }]);
    const g = await GET(req("GET"), idRoute);
    expect(g.status).toBe(404);
    for (const r of [p, g]) expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("devices write routes", () => {
  const create = { name: "Laptop", type: "Laptop", inventoryNumber: "INV-1" };
  const createValue = { ...create, mac: null, ownerId: null };

  it("POST 201, PATCH 200, DELETE 204 call the service with ctx.scope, ctx.sub, ctx.tier; all no-store", async () => {
    fakeAuth(["simap:manager"]);
    svc.createDevice.mockResolvedValue({ ok: true, value: { id: ID } });
    svc.updateDevice.mockResolvedValue({ ok: true, value: { id: ID } });
    svc.deleteDevice.mockResolvedValue({ ok: true, value: null });
    const post = await POST(req("POST", undefined, create), noParams);
    const patch = await PATCH(req("PATCH", undefined, { mac: "AA-BB-CC-DD-EE-FF" }), idRoute);
    const del = await DELETE(req("DELETE"), idRoute);
    expect([post.status, patch.status, del.status]).toEqual([201, 200, 204]);
    for (const r of [post, patch, del]) expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await del.text()).toBe("");
    expect(svc.createDevice.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", createValue]);
    expect(svc.updateDevice.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      "manager",
      ID,
      { mac: "aa:bb:cc:dd:ee:ff" },
    ]);
    expect(svc.deleteDevice.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID]);
    expect(svc.createDevice.mock.calls[0]![1]).toBeTruthy();
  });

  it("non-uuid id -> 404 and bad JSON or invalid body (ownerId on PATCH) -> 400, service not called", async () => {
    fakeAuth(["simap:user"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await PATCH(req("PATCH", undefined, { name: "x" }), bad)).status).toBe(404);
    expect((await DELETE(req("DELETE"), bad)).status).toBe(404);
    const badJson = new Request("http://x/api/devices", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    expect((await POST(badJson, noParams)).status).toBe(400);
    expect((await POST(req("POST", undefined, { name: "x" }), noParams)).status).toBe(400);
    expect((await PATCH(req("PATCH", undefined, { ownerId: SEAT }), idRoute)).status).toBe(400);
    expect((await PATCH(req("PATCH", undefined, {}), idRoute)).status).toBe(400);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("refusal -> apiError(status, code)", async () => {
    fakeAuth(["simap:user"]);
    svc.deleteDevice.mockResolvedValue({ ok: false, status: 409, code: "device_placed" });
    svc.createDevice.mockResolvedValue({ ok: false, status: 409, code: "mac_taken" });
    svc.updateDevice.mockResolvedValue({ ok: false, status: 422, code: "not_allowed" });
    const d = await DELETE(req("DELETE"), idRoute);
    const c = await POST(req("POST", undefined, create), noParams);
    const u = await PATCH(req("PATCH", undefined, { name: "x" }), idRoute);
    expect([d.status, await d.json()]).toEqual([409, { error: { code: "device_placed" } }]);
    expect([c.status, await c.json()]).toEqual([409, { error: { code: "mac_taken" } }]);
    expect([u.status, await u.json()]).toEqual([422, { error: { code: "not_allowed" } }]);
  });
});
