import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeCursor } from "@/lib/audit/cursor";

const read = vi.hoisted(() => ({
  listRequests: vi.fn(),
  listMyRequests: vi.fn(),
  markRequestsSeen: vi.fn(),
}));
const write = vi.hoisted(() => ({ approveRequest: vi.fn() }));
vi.mock("@/server/requests/read", () => read);
vi.mock("@/server/requests/requests", () => ({ createRequest: vi.fn(), ...write }));
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { POST as approvePOST } from "./[id]/approve/route";
import { GET as listGET } from "./route";
import { GET as mineGET } from "./mine/route";
import { POST as seenPOST } from "./mine/seen/route";

const ISSUER = "https://api.mmlabs.online";
const noRoute = { params: Promise.resolve({}) };
const CUR = { at: "2026-11-24T05:00:00.123456Z", id: "33333333-3333-4333-8333-333333333333" };

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

const get = (path: string) =>
  new Request(`http://x/api/requests${path}`, { headers: { authorization: "Bearer t" } });
const seen = (body: string) =>
  new Request("http://x/api/requests/mine/seen", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });

beforeEach(() => {
  for (const f of [...Object.values(read), ...Object.values(write)]) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("requests read routes: authentication and tiers", () => {
  it("no Authorization -> 401 on list, mine and seen; service not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const rs = [
      await listGET(new Request("http://x/api/requests"), noRoute),
      await mineGET(new Request("http://x/api/requests/mine"), noRoute),
      await seenPOST(new Request("http://x/api/requests/mine/seen", { method: "POST" }), noRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401]);
    for (const f of Object.values(read)) expect(f).not.toHaveBeenCalled();
  });

  it("tier user: list -> 403, mine and seen reach the service", async () => {
    fakeAuth(["simap:user"]);
    const r = await listGET(get(""), noRoute);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "forbidden" } });
    expect(read.listRequests).not.toHaveBeenCalled();
    read.listMyRequests.mockResolvedValue({ items: [], unseen: 0, nextCursor: null });
    read.markRequestsSeen.mockResolvedValue({ unseen: 0, requestsSeenAt: null });
    expect((await mineGET(get("/mine"), noRoute)).status).toBe(200);
    expect((await seenPOST(seen("{}"), noRoute)).status).toBe(200);
  });

  it("tier manager: list passes status, limit and cursor from the URL", async () => {
    fakeAuth(["simap:manager"]);
    read.listRequests.mockResolvedValue({ items: [], nextCursor: null });
    const r = await listGET(get(`?status=approved&limit=10&cursor=${encodeCursor(CUR)}`), noRoute);
    expect(r.status).toBe(200);
    expect(read.listRequests.mock.calls[0]!.slice(2)).toEqual([
      { status: "approved", limit: 10, cursor: CUR },
    ]);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("requests read routes: input and mapping", () => {
  it("bad query -> 400 invalid_request, service not called", async () => {
    fakeAuth(["simap:manager"]);
    for (const p of ["?status=nope", "?limit=500", "?cursor=!!!"]) {
      const r = await listGET(get(p), noRoute);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    expect((await mineGET(get("/mine?limit=0"), noRoute)).status).toBe(400);
    expect(read.listRequests).not.toHaveBeenCalled();
    expect(read.listMyRequests).not.toHaveBeenCalled();
  });

  it("bad seen body -> 400, service not called", async () => {
    fakeAuth(["simap:user"]);
    for (const b of ["{", '{"seenUpTo":"2026-11-24T05:00:00Z"}', '{"x":1}']) {
      expect((await seenPOST(seen(b), noRoute)).status).toBe(400);
    }
    expect(read.markRequestsSeen).not.toHaveBeenCalled();
  });

  it("mine and seen pass the token sub; responses are no-store", async () => {
    fakeAuth(["simap:user"]);
    read.listMyRequests.mockResolvedValue({ items: [], unseen: 0, nextCursor: null });
    read.markRequestsSeen.mockResolvedValue({ unseen: 0, requestsSeenAt: null });
    const a = await mineGET(get("/mine?sub=other"), noRoute);
    const b = await seenPOST(seen('{"seenUpTo":"2026-11-24T05:00:00.123456Z"}'), noRoute);
    expect(read.listMyRequests.mock.calls[0]![2]).toBe("s1");
    expect(read.markRequestsSeen.mock.calls[0]!.slice(2)).toEqual([
      "s1",
      "2026-11-24T05:00:00.123456Z",
    ]);
    for (const r of [a, b]) expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST /api/requests/mine/approve is the [id] route with id mine -> 404", async () => {
    fakeAuth(["simap:admin"]);
    const r = await approvePOST(
      new Request("http://x/api/requests/mine/approve", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
      { params: Promise.resolve({ id: "mine" }) },
    );
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: { code: "not_found" } });
    expect(write.approveRequest).not.toHaveBeenCalled();
  });
});
