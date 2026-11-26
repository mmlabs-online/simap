import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  addSeats: vi.fn(),
  deleteSeat: vi.fn(),
  getSeat: vi.fn(),
  listRoomSeats: vi.fn(),
  releaseSeat: vi.fn(),
  setCannotSeat: vi.fn(),
  setOccupant: vi.fn(),
}));
vi.mock("@/server/seats/seats", () => svc);
vi.mock("@/server/db/pool", () => ({ getPool: () => ({}) }));

import { GET as roomGET, POST as roomPOST } from "../rooms/[id]/seats/route";
import { PATCH as cannotPATCH } from "./[id]/cannot-seat/route";
import { PUT as occupantPUT } from "./[id]/occupant/route";
import { POST as releasePOST } from "./[id]/release/route";
import { DELETE, GET } from "./[id]/route";

const ISSUER = "https://api.mmlabs.online";
const ID = "33333333-3333-4333-8333-333333333333";
const M = "44444444-4444-4444-8444-444444444444";
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

const json = (method: string, body: unknown = {}) =>
  new Request("http://x/api/seats", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const plain = (method: string) =>
  new Request("http://x/api/seats", { method, headers: { authorization: "Bearer t" } });

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("seats routes: authentication", () => {
  it("no Authorization -> 401 on every handler", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/seats", { method: m });
    const rs = [
      await roomGET(bare("GET"), idRoute),
      await roomPOST(bare("POST"), idRoute),
      await GET(bare("GET"), idRoute),
      await DELETE(bare("DELETE"), idRoute),
      await occupantPUT(bare("PUT"), idRoute),
      await releasePOST(bare("POST"), idRoute),
      await cannotPATCH(bare("PATCH"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });
});

describe("seats routes: permissions", () => {
  it("User and Manager: POST room seats and DELETE seat -> 403 forbidden, service not called", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      for (const r of [
        await roomPOST(json("POST", { count: 1 }), idRoute),
        await DELETE(plain("DELETE"), idRoute),
      ]) {
        expect(r.status).toBe(403);
        expect(await r.json()).toEqual({ error: { code: "forbidden" } });
      }
    }
    expect(svc.addSeats).not.toHaveBeenCalled();
    expect(svc.deleteSeat).not.toHaveBeenCalled();
  });

  it("User: PUT occupant and PATCH cannot-seat -> 403; GET and release pass the guard", async () => {
    fakeAuth(["simap:user"]);
    for (const r of [
      await occupantPUT(json("PUT", { memberId: M, expectedOccupantId: null }), idRoute),
      await cannotPATCH(json("PATCH", { cannotSeat: false }), idRoute),
    ]) {
      expect(r.status).toBe(403);
    }
    expect(svc.setOccupant).not.toHaveBeenCalled();
    expect(svc.setCannotSeat).not.toHaveBeenCalled();
    svc.getSeat.mockResolvedValue({ ok: true, value: { id: ID } });
    svc.listRoomSeats.mockResolvedValue({ ok: true, value: { items: [] } });
    svc.releaseSeat.mockResolvedValue({ ok: true, value: { id: ID } });
    expect((await GET(plain("GET"), idRoute)).status).toBe(200);
    expect((await roomGET(plain("GET"), idRoute)).status).toBe(200);
    expect((await releasePOST(plain("POST"), idRoute)).status).toBe(200);
    expect(svc.getSeat.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID]);
    expect(svc.listRoomSeats.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID]);
    expect(svc.releaseSeat.mock.calls[0]!.slice(2)).toEqual(["s1", "user", ID]);
  });

  it("Manager: GET seat, GET room seats and release pass the manager tier", async () => {
    fakeAuth(["simap:manager"]);
    svc.getSeat.mockResolvedValue({ ok: true, value: { id: ID } });
    svc.listRoomSeats.mockResolvedValue({ ok: true, value: { items: [] } });
    svc.releaseSeat.mockResolvedValue({ ok: true, value: { id: ID } });
    await GET(plain("GET"), idRoute);
    await roomGET(plain("GET"), idRoute);
    await releasePOST(plain("POST"), idRoute);
    expect(svc.getSeat.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID]);
    expect(svc.listRoomSeats.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID]);
    expect(svc.releaseSeat.mock.calls[0]!.slice(2)).toEqual(["s1", "manager", ID]);
  });
});

describe("seats routes: input and mapping", () => {
  it("non-canonical id -> 404 without calling the service", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    for (const r of [
      await roomGET(plain("GET"), bad),
      await roomPOST(json("POST", { count: 1 }), bad),
      await GET(plain("GET"), bad),
      await DELETE(plain("DELETE"), bad),
      await occupantPUT(json("PUT", { memberId: null, expectedOccupantId: null }), bad),
      await releasePOST(plain("POST"), bad),
      await cannotPATCH(json("PATCH", { cannotSeat: false }), bad),
    ]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: { code: "not_found" } });
    }
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("bad JSON or invalid body -> 400", async () => {
    fakeAuth(["simap:admin"]);
    const badJson = new Request("http://x/api/seats", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
    });
    expect((await roomPOST(badJson, idRoute)).status).toBe(400);
    expect((await roomPOST(json("POST", { count: 0 }), idRoute)).status).toBe(400);
    expect((await occupantPUT(json("PUT", { memberId: M }), idRoute)).status).toBe(400);
    expect((await cannotPATCH(json("PATCH", { cannotSeat: true }), idRoute)).status).toBe(400);
    expect(svc.addSeats).not.toHaveBeenCalled();
    expect(svc.setOccupant).not.toHaveBeenCalled();
    expect(svc.setCannotSeat).not.toHaveBeenCalled();
  });

  it("refusals map to status and code; release refusal is 409, never 403; no-store everywhere", async () => {
    fakeAuth(["simap:admin"]);
    const refusal = (status: number, code: string) => ({ ok: false, status, code });
    svc.setOccupant.mockResolvedValue(refusal(409, "occupant_changed"));
    svc.releaseSeat.mockResolvedValue(refusal(409, "not_allowed"));
    svc.deleteSeat.mockResolvedValue(refusal(409, "seat_not_empty"));
    svc.addSeats.mockResolvedValue({ ok: true, value: [{ id: ID }] });
    svc.getSeat.mockResolvedValue(refusal(404, "not_found"));

    const occ = await occupantPUT(json("PUT", { memberId: M, expectedOccupantId: null }), idRoute);
    expect([occ.status, await occ.json()]).toEqual([409, { error: { code: "occupant_changed" } }]);
    const rel = await releasePOST(plain("POST"), idRoute);
    expect([rel.status, await rel.json()]).toEqual([409, { error: { code: "not_allowed" } }]);
    const del = await DELETE(plain("DELETE"), idRoute);
    expect([del.status, await del.json()]).toEqual([409, { error: { code: "seat_not_empty" } }]);
    const add = await roomPOST(json("POST", { count: 2 }), idRoute);
    expect(add.status).toBe(201);
    expect(await add.json()).toEqual({ items: [{ id: ID }] });
    expect(svc.addSeats.mock.calls[0]!.slice(3)).toEqual([ID, 2]);
    const get = await GET(plain("GET"), idRoute);
    expect(get.status).toBe(404);
    for (const r of [occ, rel, del, add, get]) {
      expect(r.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("successful delete is 204 with no-store", async () => {
    fakeAuth(["simap:admin"]);
    svc.deleteSeat.mockResolvedValue({ ok: true, value: null });
    const r = await DELETE(plain("DELETE"), idRoute);
    expect(r.status).toBe(204);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});
