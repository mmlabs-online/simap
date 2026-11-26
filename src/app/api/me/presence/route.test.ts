import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPool = vi.fn<() => unknown>(() => ({}));
const checkIn = vi.fn();
const checkOut = vi.fn();
const moveSeat = vi.fn();
const getMyPresence = vi.fn();
vi.mock("@/server/db/pool", () => ({ getPool: () => getPool() }));
vi.mock("@/server/presence/presence", () => ({
  checkIn: (...a: unknown[]) => checkIn(...a),
  checkOut: (...a: unknown[]) => checkOut(...a),
  moveSeat: (...a: unknown[]) => moveSeat(...a),
  getMyPresence: (...a: unknown[]) => getMyPresence(...a),
}));

const { GET, PUT, PATCH, DELETE } = await import("./route");

const ISSUER = "https://api.mmlabs.online";
const ID = "5b0c9a4e-1f3d-4c6a-9d2e-7a8b1c2d3e4f";
const DTO = {
  roomId: ID,
  roomCode: "C302",
  seatId: ID,
  seatCode: "C302-01",
  checkedInAt: "2026-11-26T01:00:00.000000Z",
  source: "self",
};

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
const url = "http://x/api/me/presence";
const authz = { authorization: "Bearer t" };
const send = (
  fn: typeof PUT,
  method: string,
  body?: unknown,
  headers: Record<string, string> = authz,
) =>
  fn(
    new Request(url, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    }),
    ctx,
  );

beforeEach(() => {
  getPool.mockImplementation(() => ({}));
  for (const f of [checkIn, checkOut, moveSeat, getMyPresence]) f.mockReset();
  fakeAuth();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("/api/me/presence", () => {
  it("401 without a token and the service is not called", async () => {
    globalThis.__simapAuth = undefined;
    const r = await send(PUT, "PUT", { roomId: ID }, {});
    expect(r.status).toBe(401);
    expect(checkIn).not.toHaveBeenCalled();
  });

  it("PUT bad JSON, a missing roomId or an extra key -> 400, service not called", async () => {
    for (const b of ["{nope", {}, { roomId: ID, checkedInAt: "2026-01-01T00:00:00Z" }]) {
      const r = await send(PUT, "PUT", b);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: { code: "invalid_request" } });
    }
    expect(checkIn).not.toHaveBeenCalled();
  });

  it("PUT 200 passes scope and sub, answers {presence} with no-store", async () => {
    checkIn.mockResolvedValue({ ok: true, value: DTO });
    const r = await send(PUT, "PUT", { roomId: ID });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ presence: DTO });
    const a = checkIn.mock.calls[0]!;
    expect(a[1]).toEqual(expect.objectContaining({ orgId: "o1" }));
    expect(a.slice(2)).toEqual(["s1", ID]);
  });

  it("PUT 409 already_checked_in carries the room code", async () => {
    checkIn.mockResolvedValue({ ok: false, status: 409, code: "already_checked_in", room: "C302" });
    const r = await send(PUT, "PUT", { roomId: ID });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: { code: "already_checked_in", room: "C302" } });
  });

  it("PUT 422 and 404 pass through", async () => {
    checkIn.mockResolvedValue({ ok: false, status: 422, code: "no_seat_in_room" });
    const r = await send(PUT, "PUT", { roomId: ID });
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: { code: "no_seat_in_room" } });
    checkIn.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await send(PUT, "PUT", { roomId: ID })).status).toBe(404);
  });

  it("PATCH 200, 409 not_checked_in, 422 seat_not_yours, 400 on a bad body", async () => {
    moveSeat.mockResolvedValue({ ok: true, value: DTO });
    const ok = await send(PATCH, "PATCH", { seatId: ID });
    expect(ok.status).toBe(200);
    expect(moveSeat.mock.calls[0]!.slice(2)).toEqual(["s1", ID]);
    moveSeat.mockResolvedValue({ ok: false, status: 409, code: "not_checked_in" });
    expect((await send(PATCH, "PATCH", { seatId: ID })).status).toBe(409);
    moveSeat.mockResolvedValue({ ok: false, status: 422, code: "seat_not_yours" });
    expect((await send(PATCH, "PATCH", { seatId: ID })).status).toBe(422);
    expect((await send(PATCH, "PATCH", { roomId: ID })).status).toBe(400);
  });

  it("DELETE 200 {presence:null}; GET 200", async () => {
    checkOut.mockResolvedValue({ ok: true, value: null });
    const r = await send(DELETE, "DELETE");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ presence: null });
    expect(checkOut.mock.calls[0]!.slice(2)).toEqual(["s1"]);
    const body = { workDate: "2026-11-26", presence: DTO, recent: [] };
    getMyPresence.mockResolvedValue(body);
    const g = await send(GET, "GET");
    expect(g.status).toBe(200);
    expect(await g.json()).toEqual(body);
  });

  it("503 without a pool", async () => {
    getPool.mockImplementation(() => null);
    expect((await send(GET, "GET")).status).toBe(503);
    expect((await send(PUT, "PUT", { roomId: ID })).status).toBe(503);
    expect((await send(PATCH, "PATCH", { seatId: ID })).status).toBe(503);
    expect((await send(DELETE, "DELETE")).status).toBe(503);
  });
});
