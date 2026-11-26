import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const listRoomPresence = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/presence/read", () => ({
  listRoomPresence: (...a: unknown[]) => listRoomPresence(...a),
}));

const { GET } = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const ID = "5b0c9a4e-1f3d-4c6a-9d2e-7a8b1c2d3e4f";

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

const get = (id: string) =>
  GET(
    new Request(`http://x/api/rooms/${id}/presence`, { headers: { authorization: "Bearer t" } }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  listRoomPresence.mockReset();
  fakeAuth();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("/api/rooms/[id]/presence", () => {
  it("a non-uuid id is 404 without a service call", async () => {
    expect((await get("nope")).status).toBe(404);
    expect(listRoomPresence).not.toHaveBeenCalled();
  });

  it("200 for a simap:user token, scoped by the token org", async () => {
    const body = { roomId: ID, workDate: "2026-11-26", members: [] };
    listRoomPresence.mockResolvedValue({ ok: true, value: body });
    const r = await get(ID);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual(body);
    const a = listRoomPresence.mock.calls[0]!;
    expect(a[1]).toEqual(expect.objectContaining({ orgId: "o1" }));
    expect(a[2]).toBe(ID);
  });

  it("404 passes through; 503 without a pool", async () => {
    listRoomPresence.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await get(ID)).status).toBe(404);
    getPool.mockImplementation(() => null);
    expect((await get(ID)).status).toBe(503);
  });
});
