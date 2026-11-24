import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getGroupImpact: vi.fn(),
  listGroups: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectImpact: vi.fn(),
  listProjects: vi.fn(),
}));
const seatSvc = vi.hoisted(() => ({ setSeatTags: vi.fn() }));
vi.mock("@/server/groups/groups", () => svc);
vi.mock("@/server/seats/seats", () => seatSvc);
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { PATCH as tagsPATCH } from "../seats/[id]/tags/route";
import { GET as projectsGET, POST as projectsPOST } from "../projects/route";
import { DELETE as projectDELETE, PATCH as projectPATCH } from "../projects/[id]/route";
import { GET as projectImpactGET } from "../projects/[id]/delete-impact/route";
import { DELETE, PATCH } from "./[id]/route";
import { GET as impactGET } from "./[id]/delete-impact/route";
import { GET, POST } from "./route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const idRoute = { params: Promise.resolve({ id: ID }) };

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

const json = (method: string, body: unknown = {}, url = "http://x/api/groups") =>
  new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const plain = (method: string, url = "http://x/api/groups") =>
  new Request(url, { method, headers: { authorization: "Bearer t" } });

const G = { name: "Dev", color: "#5B6CF0" };
const P = { code: "p1", name: "Proj" };

beforeEach(() => {
  for (const f of [...Object.values(svc), ...Object.values(seatSvc)]) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("groups routes: permissions", () => {
  it("no Authorization -> 401", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/groups", { method: m });
    const rs = [await GET(bare("GET"), idRoute), await POST(bare("POST"), idRoute)];
    expect(rs.map((r) => r.status)).toEqual([401, 401]);
  });

  it("user tier gets 403 on every write, impact and tags; services not called", async () => {
    fakeAuth(["simap:user"]);
    const rs = [
      await POST(json("POST", G), idRoute),
      await PATCH(json("PATCH", { name: "x" }), idRoute),
      await DELETE(plain("DELETE"), idRoute),
      await impactGET(plain("GET"), idRoute),
      await projectsPOST(json("POST", P), idRoute),
      await projectPATCH(json("PATCH", { name: "x" }), idRoute),
      await projectDELETE(plain("DELETE"), idRoute),
      await projectImpactGET(plain("GET"), idRoute),
      await tagsPATCH(json("PATCH", { groupId: null }), idRoute),
    ];
    for (const r of rs) {
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "forbidden" } });
    }
    for (const f of [...Object.values(svc), ...Object.values(seatSvc)]) {
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("user tier may list groups and projects", async () => {
    fakeAuth(["simap:user"]);
    svc.listGroups.mockResolvedValue([{ id: ID, name: "Dev", color: "#5B6CF0" }]);
    svc.listProjects.mockResolvedValue([]);
    const g = await GET(plain("GET"), idRoute);
    expect(g.status).toBe(200);
    expect(await g.json()).toEqual({ groups: [{ id: ID, name: "Dev", color: "#5B6CF0" }] });
    expect(await (await projectsGET(plain("GET"), idRoute)).json()).toEqual({ projects: [] });
  });

  it("manager tier passes the guard on writes", async () => {
    fakeAuth(["simap:manager"]);
    svc.createGroup.mockResolvedValue({ ok: true, value: { id: ID, ...G } });
    svc.deleteGroup.mockResolvedValue({ ok: true, value: null });
    seatSvc.setSeatTags.mockResolvedValue({ ok: true, value: { id: ID } });
    expect((await POST(json("POST", G), idRoute)).status).toBe(201);
    expect((await DELETE(plain("DELETE"), idRoute)).status).toBe(204);
    expect((await tagsPATCH(json("PATCH", { projectId: null }), idRoute)).status).toBe(200);
  });
});

describe("groups routes: input and mapping", () => {
  it("non-canonical id -> 404 without calling the service", async () => {
    fakeAuth(["simap:manager"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    for (const r of [
      await PATCH(json("PATCH", { name: "x" }), bad),
      await DELETE(plain("DELETE"), bad),
      await impactGET(plain("GET"), bad),
      await projectPATCH(json("PATCH", { name: "x" }), bad),
      await projectDELETE(plain("DELETE"), bad),
      await projectImpactGET(plain("GET"), bad),
      await tagsPATCH(json("PATCH", { groupId: null }), bad),
    ]) {
      expect(r.status).toBe(404);
    }
    for (const f of [...Object.values(svc), ...Object.values(seatSvc)]) {
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("invalid body -> 400", async () => {
    fakeAuth(["simap:manager"]);
    for (const r of [
      await POST(json("POST", { name: "x", color: "red" }), idRoute),
      await PATCH(json("PATCH", {}), idRoute),
      await projectsPOST(json("POST", { code: "", name: "x" }), idRoute),
      await projectPATCH(json("PATCH", { bogus: 1 }), idRoute),
      await tagsPATCH(json("PATCH", {}), idRoute),
      await tagsPATCH(json("PATCH", { groupId: "abc" }), idRoute),
    ]) {
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    expect(svc.createGroup).not.toHaveBeenCalled();
    expect(seatSvc.setSeatTags).not.toHaveBeenCalled();
  });

  it("maps 409 and 422 refusals, passes force and the uppercase code", async () => {
    fakeAuth(["simap:manager"]);
    svc.createGroup.mockResolvedValue({ ok: false, status: 409, code: "group_name_taken" });
    expect(await (await POST(json("POST", G), idRoute)).json()).toEqual({
      error: { code: "group_name_taken" },
    });
    svc.deleteGroup.mockResolvedValue({ ok: false, status: 409, code: "in_use" });
    const del = await DELETE(plain("DELETE"), idRoute);
    expect(del.status).toBe(409);
    expect(svc.deleteGroup.mock.calls[0]![4]).toBe(false);
    svc.deleteGroup.mockResolvedValue({ ok: true, value: null });
    await DELETE(plain("DELETE", "http://x/api/groups/1?force=true"), idRoute);
    expect(svc.deleteGroup.mock.calls[1]![4]).toBe(true);
    svc.createProject.mockResolvedValue({ ok: false, status: 409, code: "project_code_taken" });
    expect((await projectsPOST(json("POST", P), idRoute)).status).toBe(409);
    expect(svc.createProject.mock.calls[0]![3]).toEqual({ code: "P1", name: "Proj" });
    seatSvc.setSeatTags.mockResolvedValue({ ok: false, status: 422, code: "invalid_group" });
    const t = await tagsPATCH(json("PATCH", { groupId: ID }), idRoute);
    expect(t.status).toBe(422);
    expect(await t.json()).toEqual({ error: { code: "invalid_group" } });
  });

  it("impact endpoints return counts or 404", async () => {
    fakeAuth(["simap:manager"]);
    svc.getGroupImpact.mockResolvedValue({ ok: true, value: { seats: 2, members: 1 } });
    expect(await (await impactGET(plain("GET"), idRoute)).json()).toEqual({ seats: 2, members: 1 });
    svc.getProjectImpact.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await projectImpactGET(plain("GET"), idRoute)).status).toBe(404);
  });
});
