import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  createRequest: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("@/server/requests/requests", () => svc);
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { POST as approvePOST } from "./[id]/approve/route";
import { POST as cancelPOST } from "./[id]/cancel/route";
import { POST as rejectPOST } from "./[id]/reject/route";
import { POST as createPOST } from "./route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const SEAT = "44444444-4444-4444-8444-444444444444";
const idRoute = { params: Promise.resolve({ id: ID }) };
const noRoute = { params: Promise.resolve({}) };
const DTO = { id: ID, status: "pending" };

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

const json = (body: unknown) =>
  new Request("http://x/api/requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const plain = () =>
  new Request("http://x/api/requests", { method: "POST", headers: { authorization: "Bearer t" } });

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("requests routes: authentication and tiers", () => {
  it("no Authorization -> 401 on all four handlers, service not called", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = () => new Request("http://x/api/requests", { method: "POST" });
    const rs = [
      await createPOST(bare(), noRoute),
      await approvePOST(bare(), idRoute),
      await rejectPOST(bare(), idRoute),
      await cancelPOST(bare(), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("tier user: approve and reject -> 403 forbidden; create and cancel reach the service", async () => {
    fakeAuth(["simap:user"]);
    for (const r of [await approvePOST(plain(), idRoute), await rejectPOST(plain(), idRoute)]) {
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: { code: "forbidden" } });
    }
    expect(svc.approveRequest).not.toHaveBeenCalled();
    expect(svc.rejectRequest).not.toHaveBeenCalled();
    svc.createRequest.mockResolvedValue({ ok: true, value: { created: true, request: DTO } });
    svc.cancelRequest.mockResolvedValue({ ok: true, value: DTO });
    expect((await createPOST(json({ seatId: SEAT }), noRoute)).status).toBe(201);
    expect((await cancelPOST(plain(), idRoute)).status).toBe(200);
  });

  it("tier manager: approve and reject reach the service", async () => {
    fakeAuth(["simap:manager"]);
    svc.approveRequest.mockResolvedValue({ ok: true, value: DTO });
    svc.rejectRequest.mockResolvedValue({ ok: true, value: DTO });
    expect((await approvePOST(plain(), idRoute)).status).toBe(200);
    expect((await rejectPOST(plain(), idRoute)).status).toBe(200);
  });
});

describe("requests routes: input and mapping", () => {
  it("non-canonical id -> 404 without calling the service", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    for (const r of [
      await approvePOST(plain(), bad),
      await rejectPOST(plain(), bad),
      await cancelPOST(plain(), bad),
    ]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: { code: "not_found" } });
    }
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("create: bad JSON, missing seatId or a subjectId key -> 400, service not called", async () => {
    fakeAuth(["simap:user"]);
    const badJson = new Request("http://x/api/requests", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    expect((await createPOST(badJson, noRoute)).status).toBe(400);
    expect((await createPOST(json({}), noRoute)).status).toBe(400);
    expect((await createPOST(json({ seatId: SEAT, subjectId: ID }), noRoute)).status).toBe(400);
    expect(svc.createRequest).not.toHaveBeenCalled();
  });

  it("create: created -> 201, duplicate -> 200 with the same body; subject is always the token's sub", async () => {
    fakeAuth(["simap:user"]);
    svc.createRequest.mockResolvedValueOnce({ ok: true, value: { created: true, request: DTO } });
    svc.createRequest.mockResolvedValueOnce({ ok: true, value: { created: false, request: DTO } });
    const a = await createPOST(json({ seatId: SEAT }), noRoute);
    const b = await createPOST(json({ seatId: SEAT }), noRoute);
    expect([a.status, b.status]).toEqual([201, 200]);
    expect(await a.json()).toEqual(DTO);
    expect(await b.json()).toEqual(DTO);
    expect(svc.createRequest.mock.calls[0]!.slice(2)).toEqual(["s1", SEAT]);
    for (const r of [a, b]) expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refusals map to status and code, never 401/403", async () => {
    fakeAuth(["simap:admin"]);
    const refusal = (status: number, code: string) => ({ ok: false, status, code });
    svc.createRequest.mockResolvedValue(refusal(409, "seat_taken"));
    svc.approveRequest.mockResolvedValue(refusal(409, "seat_cannot_seat"));
    svc.rejectRequest.mockResolvedValue(refusal(404, "not_found"));
    svc.cancelRequest.mockResolvedValue(refusal(404, "not_found"));
    const rs = [
      await createPOST(json({ seatId: SEAT }), noRoute),
      await approvePOST(plain(), idRoute),
      await rejectPOST(plain(), idRoute),
      await cancelPOST(plain(), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([409, 409, 404, 404]);
    expect(await rs[0]!.json()).toEqual({ error: { code: "seat_taken" } });
    expect(await rs[1]!.json()).toEqual({ error: { code: "seat_cannot_seat" } });
    for (const r of rs) expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});
