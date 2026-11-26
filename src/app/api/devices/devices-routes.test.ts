import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
  getDevice: vi.fn(),
  listDevices: vi.fn(),
  placeDevice: vi.fn(),
  assignDevice: vi.fn(),
  updateHolding: vi.fn(),
}));
const hsvc = vi.hoisted(() => ({
  startTransfer: vi.fn(),
  startReturn: vi.fn(),
  startExtension: vi.fn(),
  takeBack: vi.fn(),
}));
vi.mock("@/server/devices/devices", () => svc);
vi.mock("@/server/devices/handoffs", () => hsvc);
const histSvc = vi.hoisted(() => ({ listDeviceHistory: vi.fn() }));
vi.mock("@/server/devices/history", () => histSvc);
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { GET as listGET, POST } from "./route";
import { DELETE, GET, PATCH } from "./[id]/route";
import { PUT } from "./[id]/placement/route";
import { POST as ASSIGN } from "./[id]/assignment/route";
import { PATCH as HOLDING } from "./[id]/holding/route";
import { POST as TRANSFER } from "./[id]/handoffs/route";
import { POST as TAKE_BACK } from "./[id]/take-back/route";
import { GET as HISTORY } from "./[id]/history/route";

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
  for (const f of Object.values(hsvc)) f.mockReset();
  histSvc.listDeviceHistory.mockReset();
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
    const [, scopeArg, sub, tier, filter, day] = svc.listDevices.mock.calls[0]!;
    expect([sub, tier, filter]).toEqual(["s1", "manager", "placed"]);
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(scopeArg).toBeTruthy();
    expect(svc.getDevice.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      "manager",
      ID,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ]);
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

  it("422 seat_not_yours passes through", async () => {
    fakeAuth(["simap:user"]);
    svc.placeDevice.mockResolvedValue({ ok: false, status: 422, code: "seat_not_yours" });
    const p = await PUT(req("PUT", undefined, okPut), idRoute);
    expect([p.status, await p.json()]).toEqual([422, { error: { code: "seat_not_yours" } }]);
  });
});

describe("devices write routes", () => {
  const create = { name: "Laptop", type: "Laptop", inventoryNumber: "INV-1" };
  const createValue = { ...create, mac: null, serial: null, manufacturer: null, brand: null };

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
    expect(
      (await POST(req("POST", undefined, { ...create, ownerId: SEAT }), noParams)).status,
    ).toBe(400);
    expect((await PATCH(req("PATCH", undefined, { ownerId: SEAT }), idRoute)).status).toBe(400);
    expect((await PATCH(req("PATCH", undefined, {}), idRoute)).status).toBe(400);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("refusal -> apiError(status, code)", async () => {
    fakeAuth(["simap:user"]);
    svc.deleteDevice.mockResolvedValue({ ok: false, status: 409, code: "handoff_pending" });
    svc.placeDevice.mockResolvedValue({ ok: false, status: 422, code: "device_unowned" });
    svc.createDevice.mockResolvedValue({ ok: false, status: 409, code: "mac_taken" });
    svc.updateDevice.mockResolvedValue({ ok: false, status: 422, code: "not_allowed" });
    const d = await DELETE(req("DELETE"), idRoute);
    const c = await POST(req("POST", undefined, create), noParams);
    const u = await PATCH(req("PATCH", undefined, { name: "x" }), idRoute);
    expect([d.status, await d.json()]).toEqual([409, { error: { code: "handoff_pending" } }]);
    const p = await PUT(req("PUT", undefined, okPut), idRoute);
    expect([p.status, await p.json()]).toEqual([422, { error: { code: "device_unowned" } }]);
    svc.deleteDevice.mockResolvedValue({ ok: false, status: 409, code: "device_owned" });
    const o = await DELETE(req("DELETE"), idRoute);
    expect([o.status, await o.json()]).toEqual([409, { error: { code: "device_owned" } }]);
    expect([c.status, await c.json()]).toEqual([409, { error: { code: "mac_taken" } }]);
    expect([u.status, await u.json()]).toEqual([422, { error: { code: "not_allowed" } }]);
  });
});

describe("assignment and holding routes", () => {
  const MEMBER = "88888888-8888-4888-8888-888888888888";

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 2026-11-26 in UTC+7
    vi.setSystemTime(new Date("2026-11-25T17:30:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("without a token both are 401 and the service is not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/devices", { method: m });
    expect((await ASSIGN(bare("POST"), idRoute)).status).toBe(401);
    expect((await HOLDING(bare("PATCH"), idRoute)).status).toBe(401);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("POST assignment: 400 for a bad body and for an expiry before today (UTC+7), 404 for a non-uuid id", async () => {
    fakeAuth(["simap:manager"]);
    const post = (b: unknown) => ASSIGN(req("POST", undefined, b), idRoute);
    expect((await post({})).status).toBe(400);
    expect((await post({ memberId: MEMBER, extra: 1 })).status).toBe(400);
    expect((await post({ memberId: MEMBER, expiresOn: "2026-11-25" })).status).toBe(400);
    expect((await post({ memberId: MEMBER, note: "x".repeat(501) })).status).toBe(400);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await ASSIGN(req("POST", undefined, { memberId: MEMBER }), bad)).status).toBe(404);
    expect(svc.assignDevice).not.toHaveBeenCalled();
  });

  it("POST assignment: 200 with the DTO, no-store; today (UTC+7) is allowed", async () => {
    fakeAuth(["simap:manager"]);
    svc.assignDevice.mockResolvedValue({ ok: true, value: { id: ID } });
    const r = await ASSIGN(
      req("POST", undefined, { memberId: MEMBER, note: " hi ", expiresOn: "2026-11-26" }),
      idRoute,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ id: ID });
    expect(svc.assignDevice.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      "manager",
      ID,
      { memberId: MEMBER, note: "hi", expiresOn: "2026-11-26" },
    ]);
  });

  it("POST assignment: a refusal becomes apiError", async () => {
    fakeAuth(["simap:manager"]);
    svc.assignDevice.mockResolvedValue({ ok: false, status: 409, code: "device_owned" });
    const r = await ASSIGN(req("POST", undefined, { memberId: MEMBER }), idRoute);
    expect([r.status, await r.json()]).toEqual([409, { error: { code: "device_owned" } }]);
  });

  it("PATCH holding: 400 for an empty body or a past expiry, 200 otherwise", async () => {
    fakeAuth(["simap:manager"]);
    const patch = (b: unknown) => HOLDING(req("PATCH", undefined, b), idRoute);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ expiresOn: "2026-11-25" })).status).toBe(400);
    expect(svc.updateHolding).not.toHaveBeenCalled();
    svc.updateHolding.mockResolvedValue({ ok: true, value: { id: ID } });
    const r = await patch({ note: null, expiresOn: "2026-12-01" });
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(svc.updateHolding.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      "manager",
      ID,
      { note: null, expiresOn: "2026-12-01" },
    ]);
    svc.updateHolding.mockResolvedValue({ ok: false, status: 409, code: "not_assigned" });
    const n = await patch({ note: "x" });
    expect([n.status, await n.json()]).toEqual([409, { error: { code: "not_assigned" } }]);
  });
});

describe("POST /api/devices/:id/handoffs", () => {
  const MEMBER = "66666666-6666-4666-8666-666666666666";
  const ok = { kind: "transfer", toMemberId: MEMBER, note: "x" };
  it("201 on success, no-store, with the caller's context", async () => {
    fakeAuth(["simap:user"]);
    hsvc.startTransfer.mockResolvedValue({ ok: true, value: { id: "h1" } });
    const r = await TRANSFER(req("POST", undefined, ok), idRoute);
    expect(r.status).toBe(201);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(hsvc.startTransfer.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID, ok]);
  });
  it("400 on a bad body, 404 on a bad id, no service call", async () => {
    fakeAuth(["simap:user"]);
    expect((await TRANSFER(req("POST", undefined, { kind: "swap" }), idRoute)).status).toBe(400);
    expect(
      (await TRANSFER(req("POST", undefined, { kind: "return", toMemberId: MEMBER }), idRoute))
        .status,
    ).toBe(400);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await TRANSFER(req("POST", undefined, ok), bad)).status).toBe(404);
    expect(hsvc.startTransfer).not.toHaveBeenCalled();
  });
  it("maps a refusal to its status and code", async () => {
    fakeAuth(["simap:user"]);
    hsvc.startTransfer.mockResolvedValue({ ok: false, status: 409, code: "handoff_pending" });
    const r = await TRANSFER(req("POST", undefined, ok), idRoute);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: { code: "handoff_pending" } });
  });
});

describe("POST /api/devices/:id/handoffs with kind return", () => {
  it("201 and calls startReturn, not startTransfer", async () => {
    fakeAuth(["simap:user"]);
    hsvc.startReturn.mockResolvedValue({ ok: true, value: { id: "h1" } });
    const body = { kind: "return", note: "x" };
    const r = await TRANSFER(req("POST", undefined, body), idRoute);
    expect(r.status).toBe(201);
    expect(hsvc.startReturn.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID, body]);
    expect(hsvc.startTransfer).not.toHaveBeenCalled();
  });
});

describe("GET /api/devices?placement=overdue", () => {
  it("is accepted and passes the filter and today (UTC+7) to the service", async () => {
    fakeAuth(["simap:user"]);
    svc.listDevices.mockResolvedValue({ ok: true, value: { items: [], truncated: false } });
    const r = await listGET(req("GET", "http://x/api/devices?placement=overdue"), noParams);
    expect(r.status).toBe(200);
    expect(svc.listDevices.mock.calls[0]!.slice(4)).toEqual([
      "overdue",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ]);
  });
});

describe("POST /api/devices/:id/handoffs with kind extension", () => {
  const body = { kind: "extension", newExpiresOn: "2100-01-01", note: "x" };
  it("201 and calls startExtension only", async () => {
    fakeAuth(["simap:user"]);
    hsvc.startExtension.mockResolvedValue({ ok: true, value: { id: "h1" } });
    const r = await TRANSFER(req("POST", undefined, body), idRoute);
    expect(r.status).toBe(201);
    expect(hsvc.startExtension.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID, body]);
    expect(hsvc.startTransfer).not.toHaveBeenCalled();
    expect(hsvc.startReturn).not.toHaveBeenCalled();
  });
  it("400 for a date not after today or a missing date, no service call", async () => {
    fakeAuth(["simap:user"]);
    for (const newExpiresOn of ["2000-01-01", undefined]) {
      const r = await TRANSFER(req("POST", undefined, { ...body, newExpiresOn }), idRoute);
      expect(r.status).toBe(400);
    }
    expect(hsvc.startExtension).not.toHaveBeenCalled();
  });
  it("maps a refusal to its status and code", async () => {
    fakeAuth(["simap:user"]);
    hsvc.startExtension.mockResolvedValue({ ok: false, status: 409, code: "handoff_pending" });
    const r = await TRANSFER(req("POST", undefined, body), idRoute);
    expect([r.status, await r.json()]).toEqual([409, { error: { code: "handoff_pending" } }]);
  });
});

describe("POST /api/devices/:id/take-back", () => {
  it("200 no-store for an Admin with the caller's context", async () => {
    fakeAuth(["simap:admin"]);
    hsvc.takeBack.mockResolvedValue({ ok: true, value: { id: ID } });
    const r = await TAKE_BACK(req("POST"), idRoute);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(hsvc.takeBack.mock.calls[0]!.slice(2)).toEqual(["s1", "admin", ID]);
  });
  it("403 from the wrapper for a Manager, before the service runs", async () => {
    fakeAuth(["simap:manager"]);
    expect((await TAKE_BACK(req("POST"), idRoute)).status).toBe(403);
    expect(hsvc.takeBack).not.toHaveBeenCalled();
  });
  it("bad uuid -> 404; refusals map to their status", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await TAKE_BACK(req("POST"), bad)).status).toBe(404);
    hsvc.takeBack.mockResolvedValue({ ok: false, status: 409, code: "handoff_pending" });
    const r = await TAKE_BACK(req("POST"), idRoute);
    expect([r.status, await r.json()]).toEqual([409, { error: { code: "handoff_pending" } }]);
  });
});

describe("GET /api/devices/:id/history", () => {
  const CURSOR = Buffer.from(
    JSON.stringify({ at: "2026-03-05T17:30:00.123456Z", id: ID }),
    "utf8",
  ).toString("base64url");
  const url = (qs = "") => `http://x/api/devices/${ID}/history${qs}`;

  it("bad uuid is 404 not_found, no service call", async () => {
    fakeAuth(["simap:user"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    const r = await HISTORY(req("GET", url()), bad);
    expect([r.status, await r.json()]).toEqual([404, { error: { code: "not_found" } }]);
    expect(histSvc.listDeviceHistory).not.toHaveBeenCalled();
  });

  it("401 without a token, before the service", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const r = await HISTORY(new Request(url(), { method: "GET" }), idRoute);
    expect(r.status).toBe(401);
    expect(histSvc.listDeviceHistory).not.toHaveBeenCalled();
  });

  it("bad limit / bad cursor is 400 invalid_request, no service call", async () => {
    fakeAuth(["simap:user"]);
    for (const qs of ["?limit=0", "?limit=101", "?cursor=nope", "?limit=1&limit=2"]) {
      const r = await HISTORY(req("GET", url(qs)), idRoute);
      expect([r.status, await r.json()]).toEqual([400, { error: { code: "invalid_request" } }]);
    }
    expect(histSvc.listDeviceHistory).not.toHaveBeenCalled();
  });

  it("passes scope, id and parsed query; returns the page with no-store", async () => {
    fakeAuth(["simap:user"]);
    const page = { items: [], nextCursor: null, holderSince: null };
    histSvc.listDeviceHistory.mockResolvedValue({ ok: true, value: page });
    const r = await HISTORY(req("GET", url(`?limit=2&cursor=${CURSOR}`)), idRoute);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual(page);
    const [, scopeArg, id, q] = histSvc.listDeviceHistory.mock.calls[0]!;
    expect(scopeArg).toBeTruthy();
    expect(id).toBe(ID);
    expect(q).toEqual({ limit: 2, cursor: { at: "2026-03-05T17:30:00.123456Z", id: ID } });
  });

  it("service not_found is 404", async () => {
    fakeAuth(["simap:user"]);
    histSvc.listDeviceHistory.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const r = await HISTORY(req("GET", url()), idRoute);
    expect([r.status, await r.json()]).toEqual([404, { error: { code: "not_found" } }]);
  });
});
