import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  cancelHandoff: vi.fn(),
  declineHandoff: vi.fn(),
  confirmHandoff: vi.fn(),
  listHandoffs: vi.fn(),
  countHandoffs: vi.fn(),
}));
const pool = vi.hoisted(() => ({ value: {} as object | null }));
vi.mock("@/server/devices/handoffs", () => svc);
vi.mock("@/server/db/pool", () => ({ getPool: () => pool.value }));

import { GET as LIST } from "./route";
import { GET as COUNT } from "./count/route";
import { POST as CANCEL } from "./[id]/cancel/route";
import { POST as DECLINE } from "./[id]/decline/route";
import { POST as CONFIRM } from "./[id]/confirm/route";

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
const req = (method: string, url = "http://x/api/handoffs") =>
  new Request(url, { method, headers: { authorization: "Bearer t" } });

beforeEach(() => {
  pool.value = {};
  for (const f of Object.values(svc)) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

const actions = [
  ["cancel", CANCEL, svc.cancelHandoff],
  ["decline", DECLINE, svc.declineHandoff],
  ["confirm", CONFIRM, svc.confirmHandoff],
] as const;

describe("handoff action routes", () => {
  for (const [name, handler, fn] of actions) {
    it(`${name}: 200 no-store with the caller's context`, async () => {
      fakeAuth(["simap:user"]);
      fn.mockResolvedValue({ ok: true, value: { id: ID } });
      const r = await handler(req("POST"), idRoute);
      expect(r.status).toBe(200);
      expect(r.headers.get("Cache-Control")).toBe("no-store");
      expect(fn.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID]);
    });
    it(`${name}: bad uuid -> 404, no pool -> 503, no service call`, async () => {
      fakeAuth(["simap:user"]);
      const bad = { params: Promise.resolve({ id: "nope" }) };
      expect((await handler(req("POST"), bad)).status).toBe(404);
      pool.value = null;
      expect((await handler(req("POST"), idRoute)).status).toBe(503);
      expect(fn).not.toHaveBeenCalled();
    });
    it(`${name}: refusals map to their status; the handler emits no 401 or 403`, async () => {
      fakeAuth(["simap:user"]);
      for (const [status, code] of [
        [404, "not_found"],
        [422, "not_allowed"],
        [409, "handoff_not_pending"],
        [409, "handoff_stale"],
      ] as const) {
        fn.mockResolvedValue({ ok: false, status, code });
        const r = await handler(req("POST"), idRoute);
        expect(r.status).toBe(status);
        expect(await r.json()).toEqual({ error: { code } });
      }
    });
    it(`${name}: 401 without a token`, async () => {
      vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
      const r = await handler(new Request("http://x/api/handoffs", { method: "POST" }), idRoute);
      expect(r.status).toBe(401);
      expect(fn).not.toHaveBeenCalled();
    });
  }
});

describe("GET /api/handoffs", () => {
  it("lists the inbox for box=incoming", async () => {
    fakeAuth(["simap:user"]);
    svc.listHandoffs.mockResolvedValue({ ok: true, value: { items: [], truncated: false } });
    const r = await LIST(req("GET", "http://x/api/handoffs?box=incoming"), noParams);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(svc.listHandoffs.mock.calls[0]!.slice(2)).toEqual(["s1", "user"]);
  });
  it("400 on a missing or unknown box; 503 without a pool", async () => {
    fakeAuth(["simap:user"]);
    expect((await LIST(req("GET"), noParams)).status).toBe(400);
    const out = await LIST(req("GET", "http://x/api/handoffs?box=outgoing"), noParams);
    expect(out.status).toBe(400);
    pool.value = null;
    const none = await LIST(req("GET", "http://x/api/handoffs?box=incoming"), noParams);
    expect(none.status).toBe(503);
    expect(svc.listHandoffs).not.toHaveBeenCalled();
  });
});

describe("GET /api/handoffs/count", () => {
  it("returns { incoming }", async () => {
    fakeAuth(["simap:user"]);
    svc.countHandoffs.mockResolvedValue({ ok: true, value: { incoming: 2 } });
    const r = await COUNT(req("GET", "http://x/api/handoffs/count"), noParams);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ incoming: 2 });
    expect(svc.countHandoffs.mock.calls[0]!.slice(2)).toEqual(["s1"]);
  });
  it("503 without a pool", async () => {
    fakeAuth(["simap:user"]);
    pool.value = null;
    expect((await COUNT(req("GET"), noParams)).status).toBe(503);
  });
});
