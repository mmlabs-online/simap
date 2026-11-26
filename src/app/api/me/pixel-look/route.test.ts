import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const getOwnPixelLook = vi.fn();
const setOwnPixelLook = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/members/pixel-look", () => ({
  getOwnPixelLook: (...a: unknown[]) => getOwnPixelLook(...a),
  setOwnPixelLook: (...a: unknown[]) => setOwnPixelLook(...a),
}));

const { GET, PUT, DELETE } = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const LOOK = { skin: 1, hair: 2, style: 3, shirt: 4 };

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

const ctx = { params: Promise.resolve({}) };
const url = "http://x/api/me/pixel-look";
const authz = { authorization: "Bearer t" };
const get = () => GET(new Request(url, { headers: authz }), ctx);
const del = () => DELETE(new Request(url, { method: "DELETE", headers: authz }), ctx);
const put = (body: unknown, type = "application/json") =>
  PUT(
    new Request(url, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": type, ...authz },
    }),
    ctx,
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  getOwnPixelLook.mockReset();
  setOwnPixelLook.mockReset();
  fakeAuth();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("/api/me/pixel-look", () => {
  it("GET returns {look} with no-store; 404 when the service says not_found", async () => {
    getOwnPixelLook.mockResolvedValue({ ok: true, value: LOOK });
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ look: LOOK });
    expect(getOwnPixelLook.mock.calls[0]!.slice(1)).toEqual([expect.anything(), "s1"]);
    getOwnPixelLook.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const n = await get();
    expect(n.status).toBe(404);
    expect(await n.json()).toEqual({ error: { code: "not_found" } });
  });

  it("PUT malformed JSON or a non-object -> 400 invalid_request; non-preset -> 422 invalid_look; service not called", async () => {
    for (const r of [await put("{nope"), await put([1]), await put({ skin: 1 }, "text/plain")]) {
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    for (const body of [
      { ...LOOK, skin: 9 },
      { ...LOOK, extra: 1 },
      { skin: 1 },
      { ...LOOK, hair: "1" },
    ]) {
      const r = await put(body);
      expect(r.status).toBe(422);
      expect(await r.json()).toEqual({ error: { code: "invalid_look" } });
    }
    expect(setOwnPixelLook).not.toHaveBeenCalled();
  });

  it("PUT valid -> service gets ctx.scope, ctx.sub and the look; 200 {look}", async () => {
    setOwnPixelLook.mockResolvedValue({ ok: true, value: LOOK });
    const r = await put(LOOK);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ look: LOOK });
    const a = setOwnPixelLook.mock.calls[0]!;
    expect(a[1]).toEqual(expect.objectContaining({ orgId: "o1" }));
    expect(a.slice(2)).toEqual(["s1", LOOK]);
  });

  it("PUT service refusal member_deactivated -> 403", async () => {
    setOwnPixelLook.mockResolvedValue({ ok: false, status: 403, code: "member_deactivated" });
    const r = await put(LOOK);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: { code: "member_deactivated" } });
  });

  it("DELETE -> service called with null; 200 {look:null}; 503 without a pool", async () => {
    setOwnPixelLook.mockResolvedValue({ ok: true, value: null });
    const r = await del();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ look: null });
    expect(setOwnPixelLook.mock.calls[0]!.slice(2)).toEqual(["s1", null]);
    getPool.mockImplementation(() => null);
    expect((await del()).status).toBe(503);
    expect((await get()).status).toBe(503);
    expect((await put(LOOK)).status).toBe(503);
  });
});
