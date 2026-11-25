import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  listDeviceTypes: vi.fn(),
  createDeviceType: vi.fn(),
  updateDeviceType: vi.fn(),
  deleteDeviceType: vi.fn(),
}));
vi.mock("@/server/device-types/device-types", () => svc);
const img = vi.hoisted(() => ({ discardImageFile: vi.fn() }));
vi.mock("@/server/device-types/image", () => img);
const pool = vi.hoisted(() => ({ getPool: vi.fn(() => ({})) }));
vi.mock("@/server/db/pool", () => pool);

import { GET as listGET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
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

const req = (method: string, body?: unknown) =>
  new Request("http://x/api/device-types", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const dto = { id: ID, name: "PC", slot: "pc", hasImage: false, imageVersion: 0, sprite: null };

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  pool.getPool.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("device-types routes", () => {
  it("401 without token (all methods)", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/device-types", { method: m });
    const rs = [
      await listGET(bare("GET"), noParams),
      await POST(bare("POST"), noParams),
      await PATCH(bare("PATCH"), idRoute),
      await DELETE(bare("DELETE"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("403 forbidden for user and manager on POST, PATCH, DELETE; service not called", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      const rs = [
        await POST(req("POST", { name: "X", slot: "pc" }), noParams),
        await PATCH(req("PATCH", { name: "X" }), idRoute),
        await DELETE(req("DELETE"), idRoute),
      ];
      expect(rs.map((r) => r.status)).toEqual([403, 403, 403]);
      expect((await rs[0]!.json()).error.code).toBe("forbidden");
    }
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("GET allowed for the user tier; no-store; service gets ctx.scope", async () => {
    fakeAuth(["simap:user"]);
    svc.listDeviceTypes.mockResolvedValue({ ok: true, value: { items: [dto] } });
    const r = await listGET(req("GET"), noParams);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ items: [dto] });
    expect(svc.listDeviceTypes.mock.calls[0]![1]).toBeTruthy();
  });

  it("admin: POST 201, PATCH 200, DELETE 204 call the service with scope and sub; no-store", async () => {
    fakeAuth(["simap:admin"]);
    svc.createDeviceType.mockResolvedValue({ ok: true, value: dto });
    svc.updateDeviceType.mockResolvedValue({ ok: true, value: dto });
    svc.deleteDeviceType.mockResolvedValue({ ok: true, value: { imageFileId: null } });
    const post = await POST(req("POST", { name: " PC ", slot: "pc" }), noParams);
    const patch = await PATCH(req("PATCH", { slot: "laptop" }), idRoute);
    const del = await DELETE(req("DELETE"), idRoute);
    expect([post.status, patch.status, del.status]).toEqual([201, 200, 204]);
    for (const r of [post, patch, del]) expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await del.text()).toBe("");
    expect(svc.createDeviceType.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      { name: "PC", slot: "pc" },
    ]);
    expect(svc.updateDeviceType.mock.calls[0]!.slice(2)).toEqual(["s1", ID, { slot: "laptop" }]);
    expect(svc.deleteDeviceType.mock.calls[0]!.slice(2)).toEqual(["s1", ID]);
  });

  it("bad uuid -> 404 before getPool; invalid body -> 400; service not called", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await PATCH(req("PATCH", { name: "x" }), bad)).status).toBe(404);
    expect((await DELETE(req("DELETE"), bad)).status).toBe(404);
    expect(pool.getPool).not.toHaveBeenCalled();
    expect((await POST(req("POST", { name: "x" }), noParams)).status).toBe(400);
    expect((await POST(req("POST", { name: "x", slot: "pc", image: 1 }), noParams)).status).toBe(
      400,
    );
    expect((await PATCH(req("PATCH", {}), idRoute)).status).toBe(400);
    const badJson = new Request("http://x/api/device-types", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    expect((await POST(badJson, noParams)).status).toBe(400);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("service refusal maps to its status and code", async () => {
    fakeAuth(["simap:admin"]);
    svc.createDeviceType.mockResolvedValue({ ok: false, status: 409, code: "name_taken" });
    svc.updateDeviceType.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const p = await POST(req("POST", { name: "X", slot: "pc" }), noParams);
    expect([p.status, await p.json()]).toEqual([409, { error: { code: "name_taken" } }]);
    const u = await PATCH(req("PATCH", { name: "X" }), idRoute);
    expect([u.status, await u.json()]).toEqual([404, { error: { code: "not_found" } }]);
  });

  it("sprite: PATCH and POST forward it; bad shape 400 without service call; 422 mapped", async () => {
    fakeAuth(["simap:admin"]);
    svc.createDeviceType.mockResolvedValue({ ok: true, value: dto });
    svc.updateDeviceType.mockResolvedValue({ ok: true, value: dto });
    await POST(req("POST", { name: "X", slot: "pc", sprite: "device.pc" }), noParams);
    await PATCH(req("PATCH", { sprite: null }), idRoute);
    expect(svc.createDeviceType.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      { name: "X", slot: "pc", sprite: "device.pc" },
    ]);
    expect(svc.updateDeviceType.mock.calls[0]!.slice(2)).toEqual(["s1", ID, { sprite: null }]);
    svc.createDeviceType.mockClear();
    svc.updateDeviceType.mockClear();
    expect((await PATCH(req("PATCH", { sprite: " x" }), idRoute)).status).toBe(400);
    expect((await POST(req("POST", { name: "X", slot: "pc", sprite: 1 }), noParams)).status).toBe(
      400,
    );
    expect(svc.createDeviceType).not.toHaveBeenCalled();
    expect(svc.updateDeviceType).not.toHaveBeenCalled();
    svc.updateDeviceType.mockResolvedValue({ ok: false, status: 422, code: "sprite_not_allowed" });
    const r = await PATCH(req("PATCH", { sprite: "plant.large" }), idRoute);
    expect([r.status, await r.json()]).toEqual([422, { error: { code: "sprite_not_allowed" } }]);
  });

  it("DELETE type: the image file is discarded after commit, and not on a 404", async () => {
    fakeAuth(["simap:admin"]);
    svc.deleteDeviceType.mockResolvedValue({ ok: true, value: { imageFileId: "fileid_123456" } });
    const r = await DELETE(req("DELETE"), idRoute);
    expect(r.status).toBe(204);
    expect(img.discardImageFile.mock.calls[0]!.slice(1)).toEqual(["fileid_123456", ID]);
    img.discardImageFile.mockClear();
    svc.deleteDeviceType.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await DELETE(req("DELETE"), idRoute)).status).toBe(404);
    expect(img.discardImageFile).not.toHaveBeenCalled();
  });

  it("503 when there is no pool", async () => {
    fakeAuth(["simap:admin"]);
    pool.getPool.mockReturnValueOnce(null as never);
    expect((await listGET(req("GET"), noParams)).status).toBe(503);
  });
});
