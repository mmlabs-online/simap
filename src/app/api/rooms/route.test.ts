import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as impactGET } from "./[id]/delete-impact/route";
import { DELETE, PATCH } from "./[id]/route";
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

const json = (method: string, body: unknown = {}) =>
  new Request("http://x/api/rooms", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer t" },
  });
const plain = (method: string, url = "http://x/api/rooms/" + ID) =>
  new Request(url, { method, headers: { authorization: "Bearer t" } });

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("rooms routes: authentication", () => {
  it("no Authorization -> 401 on every handler", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/api/rooms", { method: m });
    const rs = [
      await GET(bare("GET"), { params: Promise.resolve({}) }),
      await POST(bare("POST"), { params: Promise.resolve({}) }),
      await PATCH(bare("PATCH"), idRoute),
      await DELETE(bare("DELETE"), idRoute),
      await impactGET(bare("GET"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });
});

describe("rooms routes: permissions (AC4, API)", () => {
  it("User and Manager get 403 forbidden on POST, PATCH, DELETE and delete-impact", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      const rs = [
        await POST(json("POST", { code: "A", name: "n" }), { params: Promise.resolve({}) }),
        await PATCH(json("PATCH", { name: "n" }), idRoute),
        await DELETE(plain("DELETE"), idRoute),
        await impactGET(plain("GET"), idRoute),
      ];
      for (const r of rs) {
        expect(r.status).toBe(403);
        expect(await r.json()).toEqual({ error: { code: "forbidden" } });
      }
    }
  });

  it("User passes the GET gate (503 unavailable with DATABASE_URL unset)", async () => {
    fakeAuth(["simap:user"]);
    vi.stubEnv("DATABASE_URL", "");
    const r = await GET(plain("GET", "http://x/api/rooms"), { params: Promise.resolve({}) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "unavailable" } });
  });
});

describe("rooms routes: input", () => {
  it("non-UUID id -> 404 not_found without touching the DB (admin)", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "not-a-uuid" }) };
    for (const r of [
      await PATCH(json("PATCH", { name: "n" }), bad),
      await DELETE(plain("DELETE"), bad),
      await impactGET(plain("GET"), bad),
    ]) {
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ error: { code: "not_found" } });
    }
  });

  it("admin with no database -> 503 unavailable", async () => {
    fakeAuth(["simap:admin"]);
    vi.stubEnv("DATABASE_URL", "");
    const r = await POST(json("POST", { code: "A", name: "n" }), { params: Promise.resolve({}) });
    expect(r.status).toBe(503);
  });
});
