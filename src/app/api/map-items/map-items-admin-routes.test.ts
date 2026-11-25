import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  updateMapItem: vi.fn(),
  setMapItemArt: vi.fn(),
  resetMapItem: vi.fn(),
}));
vi.mock("@/server/map-items/edit", () => svc);
const cleanup = vi.hoisted(() => ({ discardMapItemFiles: vi.fn() }));
vi.mock("@/server/map-items/drive-cleanup", () => cleanup);
const pool = vi.hoisted(() => ({ getPool: vi.fn(() => ({})) }));
vi.mock("@/server/db/pool", () => pool);

import { PATCH } from "./[key]/route";
import { PUT } from "./[key]/art/[dir]/route";
import { POST } from "./[key]/reset/route";

const ISSUER = "https://api.mmlabs.online";
const KEY = "plant.large";
const keyRoute = { params: Promise.resolve({ key: KEY }) };
const artRoute = { params: Promise.resolve({ key: KEY, dir: "s" }) };

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
  new Request("http://x/api/map-items/plant.large", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const dto = { builtinKey: KEY, name: "Cây" };
const outcome = (ids: string[] = []) => ({ ok: true, value: { item: dto, discardFileIds: ids } });

beforeEach(() => {
  for (const f of [...Object.values(svc), cleanup.discardMapItemFiles]) f.mockReset();
  pool.getPool.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("map-items admin routes", () => {
  it("401 without token (PATCH, PUT, POST); service not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/map-items/plant.large", { method: m });
    const rs = [
      await PATCH(bare("PATCH"), keyRoute),
      await PUT(bare("PUT"), artRoute),
      await POST(bare("POST"), keyRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("403 forbidden for user and manager on PATCH, PUT art, POST reset; service not called", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      const rs = [
        await PATCH(req("PATCH", { name: "X" }), keyRoute),
        await PUT(req("PUT", { sprite: null }), artRoute),
        await POST(req("POST"), keyRoute),
      ];
      expect(rs.map((r) => r.status)).toEqual([403, 403, 403]);
      expect((await rs[0]!.json()).error.code).toBe("forbidden");
    }
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("admin PATCH/PUT/POST -> 200 no-store with the DTO; service gets ctx.scope, ctx.sub and the key", async () => {
    fakeAuth(["simap:admin"]);
    svc.updateMapItem.mockResolvedValue(outcome());
    svc.setMapItemArt.mockResolvedValue({ ok: true, value: dto });
    svc.resetMapItem.mockResolvedValue(outcome());
    const rs = [
      await PATCH(req("PATCH", { name: " Cây " }), keyRoute),
      await PUT(req("PUT", { sprite: "plant.small" }), artRoute),
      await POST(req("POST"), keyRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    for (const r of rs) {
      expect(r.headers.get("Cache-Control")).toBe("no-store");
      expect(await r.json()).toEqual(dto);
    }
    expect(svc.updateMapItem.mock.calls[0]!.slice(2)).toEqual(["s1", KEY, { name: "Cây" }]);
    expect(svc.setMapItemArt.mock.calls[0]!.slice(2)).toEqual(["s1", KEY, "s", "plant.small"]);
    expect(svc.resetMapItem.mock.calls[0]!.slice(2)).toEqual(["s1", KEY]);
    expect(svc.updateMapItem.mock.calls[0]![1]).toBeTruthy();
  });

  it("bad key / bad dir -> 404 before getPool; bad body -> 400; no pool -> 503", async () => {
    fakeAuth(["simap:admin"]);
    const badKey = { params: Promise.resolve({ key: "Bad..Key" }) };
    const badDir = { params: Promise.resolve({ key: KEY, dir: "x" }) };
    expect((await PATCH(req("PATCH", { name: "x" }), badKey)).status).toBe(404);
    expect((await POST(req("POST"), badKey)).status).toBe(404);
    expect((await PUT(req("PUT", { sprite: null }), badDir)).status).toBe(404);
    expect(pool.getPool).not.toHaveBeenCalled();
    expect((await PATCH(req("PATCH", {}), keyRoute)).status).toBe(400);
    expect((await PATCH(req("PATCH", { order: 1 }), keyRoute)).status).toBe(400);
    expect((await PUT(req("PUT", { sprite: "nope" }), artRoute)).status).toBe(400);
    const badJson = new Request("http://x/api/map-items/plant.large", {
      method: "PATCH",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    expect((await PATCH(badJson, keyRoute)).status).toBe(400);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
    pool.getPool.mockReturnValueOnce(null as never);
    expect((await PATCH(req("PATCH", { name: "x" }), keyRoute)).status).toBe(503);
  });

  it('refusals map to status+code; 409 item_in_use body is { error: { code: "item_in_use", rooms: 2 } } with no-store', async () => {
    fakeAuth(["simap:admin"]);
    svc.updateMapItem.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 2,
    });
    const a = await PATCH(req("PATCH", { w: 2 }), keyRoute);
    expect([a.status, await a.json()]).toEqual([409, { error: { code: "item_in_use", rooms: 2 } }]);
    expect(a.headers.get("Cache-Control")).toBe("no-store");
    svc.resetMapItem.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 1,
    });
    const b = await POST(req("POST"), keyRoute);
    expect([b.status, await b.json()]).toEqual([409, { error: { code: "item_in_use", rooms: 1 } }]);
    svc.updateMapItem.mockResolvedValueOnce({ ok: false, status: 422, code: "item_fixed_size" });
    const c = await PATCH(req("PATCH", { w: 2 }), keyRoute);
    expect([c.status, await c.json()]).toEqual([422, { error: { code: "item_fixed_size" } }]);
    svc.setMapItemArt.mockResolvedValueOnce({ ok: false, status: 422, code: "sprite_not_allowed" });
    expect((await PUT(req("PUT", { sprite: "plant.small" }), artRoute)).status).toBe(422);
    svc.updateMapItem.mockResolvedValueOnce({ ok: false, status: 404, code: "not_found" });
    expect((await PATCH(req("PATCH", { name: "x" }), keyRoute)).status).toBe(404);
  });

  it("resize/reset success calls discardMapItemFiles with the returned ids after the service; a refusal does not call it", async () => {
    fakeAuth(["simap:admin"]);
    svc.updateMapItem.mockResolvedValueOnce(outcome(["file_aaaaaaaaaa"]));
    await PATCH(req("PATCH", { w: 2 }), keyRoute);
    expect(cleanup.discardMapItemFiles.mock.calls[0]!.slice(1)).toEqual([["file_aaaaaaaaaa"], KEY]);
    svc.resetMapItem.mockResolvedValueOnce(outcome(["file_bbbbbbbbbb"]));
    await POST(req("POST"), keyRoute);
    expect(cleanup.discardMapItemFiles.mock.calls[1]!.slice(1)).toEqual([["file_bbbbbbbbbb"], KEY]);
    cleanup.discardMapItemFiles.mockClear();
    svc.updateMapItem.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 1,
    });
    await PATCH(req("PATCH", { w: 2 }), keyRoute);
    expect(cleanup.discardMapItemFiles).not.toHaveBeenCalled();
  });
});
