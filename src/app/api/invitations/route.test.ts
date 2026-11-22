import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const record = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/invitations/record", () => ({
  recordInvitation: (...a: unknown[]) => record(...a),
}));

const { POST } = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const IID = "33333333-3333-4333-8333-333333333333";
const noParams = { params: Promise.resolve({}) };
const DTO = { id: IID, email: "a@x.vn", role: "simap:user", createdAt: "c", expiresAt: "e" };

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
const body = (over: Record<string, unknown> = {}) => ({
  email: "A@x.vn",
  role: "simap:user",
  identityInvitationId: IID,
  expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  ...over,
});
const req = (b?: unknown, raw?: string) =>
  new Request("http://x/api/invitations", {
    method: "POST",
    body: raw ?? JSON.stringify(b),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  record.mockReset();
  record.mockResolvedValue(DTO);
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("POST /api/invitations", () => {
  it("no Authorization -> 401, service not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const r = await POST(new Request("http://x/api/invitations", { method: "POST" }), noParams);
    expect(r.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it("user tier -> 403 forbidden from the wrapper, service not called", async () => {
    fakeAuth(["simap:user"]);
    const r = await POST(req(body()), noParams);
    expect(r.status).toBe(403);
    expect(await code(r)).toBe("forbidden");
    expect(record).not.toHaveBeenCalled();
  });

  it("manager + simap:manager -> 422 role_not_allowed, service not called", async () => {
    fakeAuth(["simap:manager"]);
    const r = await POST(req(body({ role: "simap:manager" })), noParams);
    expect(r.status).toBe(422);
    expect(await code(r)).toBe("role_not_allowed");
    expect(record).not.toHaveBeenCalled();
  });

  it("manager + simap:user -> 201; admin + simap:manager -> 201", async () => {
    fakeAuth(["simap:manager"]);
    expect((await POST(req(body()), noParams)).status).toBe(201);
    fakeAuth(["simap:admin"]);
    expect((await POST(req(body({ role: "simap:manager" })), noParams)).status).toBe(201);
  });

  it("admin + simap:admin -> 400", async () => {
    fakeAuth(["simap:admin"]);
    const r = await POST(req(body({ role: "simap:admin" })), noParams);
    expect(r.status).toBe(400);
    expect(await code(r)).toBe("invalid_request");
    expect(record).not.toHaveBeenCalled();
  });

  it("bad JSON, extra key -> 400; no pool -> 503", async () => {
    fakeAuth(["simap:admin"]);
    expect((await POST(req(undefined, "{nope"), noParams)).status).toBe(400);
    expect((await POST(req(body({ token: "x" })), noParams)).status).toBe(400);
    getPool.mockImplementation(() => null);
    const r = await POST(req(body()), noParams);
    expect(r.status).toBe(503);
    expect(await code(r)).toBe("unavailable");
  });

  it("201 body is the service DTO, no-store, service called with the scope and sub", async () => {
    fakeAuth(["simap:manager"]);
    const pool = {};
    getPool.mockImplementation(() => pool);
    const r = await POST(req(body()), noParams);
    expect(r.status).toBe(201);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual(DTO);
    const args = record.mock.calls[0]!;
    expect(args[0]).toBe(pool);
    expect(args[1]).toMatchObject({ orgId: "o1" });
    expect(args[2]).toBe("s1");
    expect(args[3]).toMatchObject({
      email: "a@x.vn",
      role: "simap:user",
      identityInvitationId: IID,
    });
  });
});
