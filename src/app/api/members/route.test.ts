import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const svc = {
  listMembers: vi.fn(),
  getMember: vi.fn(),
  updateMember: vi.fn(),
  getDeactivationImpact: vi.fn(),
  deactivateMember: vi.fn(),
  reactivateMember: vi.fn(),
  listPendingInvitations: vi.fn(),
};
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/members/manage", () => ({
  listMembers: (...a: unknown[]) => svc.listMembers(...a),
  getMember: (...a: unknown[]) => svc.getMember(...a),
  updateMember: (...a: unknown[]) => svc.updateMember(...a),
  getDeactivationImpact: (...a: unknown[]) => svc.getDeactivationImpact(...a),
  deactivateMember: (...a: unknown[]) => svc.deactivateMember(...a),
  reactivateMember: (...a: unknown[]) => svc.reactivateMember(...a),
  listPendingInvitations: (...a: unknown[]) => svc.listPendingInvitations(...a),
}));

const list = await import("./route");
const invitations = await import("./invitations/route");
const detail = await import("./[id]/route");
const impact = await import("./[id]/deactivation-impact/route");
const deactivate = await import("./[id]/deactivate/route");
const reactivate = await import("./[id]/reactivate/route");

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

const req = (method: string, url = "http://x/api/members/" + ID, body?: unknown) =>
  new Request(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });

const DTO = { id: ID, displayName: "Nguyễn Văn A" };

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  for (const f of Object.values(svc)) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("members routes: authentication", () => {
  it("no Authorization -> 401 on every handler", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/members", { method: m });
    const rs = [
      await list.GET(bare("GET"), noParams),
      await invitations.GET(bare("GET"), noParams),
      await detail.GET(bare("GET"), idRoute),
      await detail.PATCH(bare("PATCH"), idRoute),
      await impact.GET(bare("GET"), idRoute),
      await deactivate.POST(bare("POST"), idRoute),
      await reactivate.POST(bare("POST"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });
});

describe("members routes: permissions (AC4, API)", () => {
  it("User: GET list and detail pass; PATCH, deactivate, reactivate, impact, invitations -> 403 forbidden", async () => {
    fakeAuth(["simap:user"]);
    svc.listMembers.mockResolvedValue({ items: [], nextCursor: null, groups: [] });
    svc.getMember.mockResolvedValue({ ok: true, value: DTO });
    expect((await list.GET(req("GET", "http://x/api/members"), noParams)).status).toBe(200);
    expect((await detail.GET(req("GET"), idRoute)).status).toBe(200);
    const rs = [
      await detail.PATCH(req("PATCH", undefined, { displayName: "n" }), idRoute),
      await deactivate.POST(req("POST", undefined, { release: true }), idRoute),
      await reactivate.POST(req("POST"), idRoute),
      await impact.GET(req("GET"), idRoute),
      await invitations.GET(req("GET"), noParams),
    ];
    for (const r of rs) {
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "forbidden" } });
    }
    for (const f of [svc.updateMember, svc.deactivateMember, svc.reactivateMember]) {
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("Manager passes the guard on every handler", async () => {
    fakeAuth(["simap:manager"]);
    svc.updateMember.mockResolvedValue({ ok: true, value: DTO });
    svc.deactivateMember.mockResolvedValue({ ok: true, value: DTO });
    svc.reactivateMember.mockResolvedValue({ ok: true, value: DTO });
    svc.getDeactivationImpact.mockResolvedValue({ ok: true, value: {} });
    svc.listPendingInvitations.mockResolvedValue([]);
    const rs = [
      await detail.PATCH(req("PATCH", undefined, { displayName: "Nguyễn" }), idRoute),
      await deactivate.POST(req("POST", undefined, { release: true }), idRoute),
      await reactivate.POST(req("POST"), idRoute),
      await impact.GET(req("GET"), idRoute),
      await invitations.GET(req("GET"), noParams),
    ];
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(svc.deactivateMember.mock.calls[0]![4]).toBe(true);
    expect(await rs[4]!.json()).toEqual({ items: [] });
  });
});

describe("members routes: input and errors", () => {
  it("non-canonical id -> 404 not_found without touching the service", async () => {
    fakeAuth(["simap:manager"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    for (const r of [
      await detail.GET(req("GET"), bad),
      await detail.PATCH(req("PATCH", undefined, { displayName: "n" }), bad),
      await impact.GET(req("GET"), bad),
      await deactivate.POST(req("POST", undefined, { release: true }), bad),
      await reactivate.POST(req("POST"), bad),
    ]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: { code: "not_found" } });
    }
    expect(Object.values(svc).every((f) => f.mock.calls.length === 0)).toBe(true);
  });

  it("bad JSON, invalid body and bad query -> 400 invalid_request", async () => {
    fakeAuth(["simap:manager"]);
    const notJson = new Request("http://x/api/members/" + ID, {
      method: "PATCH",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    const rs = [
      await detail.PATCH(notJson, idRoute),
      await detail.PATCH(req("PATCH", undefined, {}), idRoute),
      await detail.PATCH(req("PATCH", undefined, { email: "x@y" }), idRoute),
      await deactivate.POST(req("POST", undefined, {}), idRoute),
      await list.GET(req("GET", "http://x/api/members?limit=0"), noParams),
      await list.GET(req("GET", "http://x/api/members?status=x"), noParams),
    ];
    for (const r of rs) {
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
  });

  it("service refusals map to status and code", async () => {
    fakeAuth(["simap:manager"]);
    svc.updateMember.mockResolvedValue({ ok: false, status: 409, code: "employee_code_taken" });
    svc.deactivateMember.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "member_not_empty",
    });
    svc.deactivateMember.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "cannot_deactivate_self",
    });
    const a = await detail.PATCH(req("PATCH", undefined, { employeeCode: "E1" }), idRoute);
    const b = await deactivate.POST(req("POST", undefined, { release: false }), idRoute);
    const c = await deactivate.POST(req("POST", undefined, { release: true }), idRoute);
    expect([a.status, b.status, c.status]).toEqual([409, 409, 409]);
    expect(await a.json()).toEqual({ error: { code: "employee_code_taken" } });
    expect(await b.json()).toEqual({ error: { code: "member_not_empty" } });
    expect(await c.json()).toEqual({ error: { code: "cannot_deactivate_self" } });
  });

  it("no database -> 503 unavailable", async () => {
    fakeAuth(["simap:manager"]);
    getPool.mockImplementation(() => null);
    const r = await list.GET(req("GET", "http://x/api/members"), noParams);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("responses carry Cache-Control: no-store", async () => {
    fakeAuth(["simap:manager"]);
    svc.listMembers.mockResolvedValue({ items: [], nextCursor: null, groups: [] });
    svc.getMember.mockResolvedValue({ ok: true, value: DTO });
    svc.getDeactivationImpact.mockResolvedValue({ ok: true, value: {} });
    svc.listPendingInvitations.mockResolvedValue([]);
    const rs = [
      await list.GET(req("GET", "http://x/api/members"), noParams),
      await detail.GET(req("GET"), idRoute),
      await impact.GET(req("GET"), idRoute),
      await invitations.GET(req("GET"), noParams),
    ];
    for (const r of rs) expect(r.headers.get("cache-control")).toBe("no-store");
  });
});
