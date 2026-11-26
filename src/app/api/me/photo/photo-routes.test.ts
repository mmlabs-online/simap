import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  setOwnPhoto: vi.fn(),
  removeOwnPhoto: vi.fn(),
  getOwnPhoto: vi.fn(),
  removeMemberPhoto: vi.fn(),
  getMemberPhoto: vi.fn(),
}));
vi.mock("@/server/members/photo", () => svc);
const pool = vi.hoisted(() => ({ getPool: vi.fn(() => ({})) }));
vi.mock("@/server/db/pool", () => pool);
const drive = vi.hoisted(() => ({ getDrive: vi.fn(() => null) }));
vi.mock("@/server/drive/drive", () => drive);

import { PHOTO_LIMITS } from "@/lib/validate/photo";
import { jpegOf, pngOf } from "@/test/photo-fixtures";
import * as memberRoute from "../../members/[id]/photo/route";
import { DELETE, GET, PUT } from "./route";

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

const JPEG = jpegOf(64, 64);
const PNG = pngOf(64, 64);
const put = (body: Uint8Array | null, headers: Record<string, string> = {}) =>
  new Request("http://x/api/me/photo", {
    method: "PUT",
    body: body as BodyInit | null,
    headers: { "content-type": "image/jpeg", authorization: "Bearer t", ...headers },
  });
const plain = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api/me/photo", {
    method,
    headers: { authorization: "Bearer t", ...headers },
  });

beforeEach(() => {
  for (const f of Object.values(svc)) f.mockReset();
  pool.getPool.mockClear();
  drive.getDrive.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapAuth = undefined;
});

describe("own photo routes", () => {
  it("no bearer gives 401 on every handler", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/", { method: m });
    const rs = [
      await PUT(bare("PUT"), noParams),
      await DELETE(bare("DELETE"), noParams),
      await GET(bare("GET"), noParams),
      await memberRoute.GET(bare("GET"), idRoute),
      await memberRoute.DELETE(bare("DELETE"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("PUT refusals: 422 code, getPool and the service are not called", async () => {
    fakeAuth(["simap:user"]);
    const badJpeg = JPEG.subarray(0, JPEG.length - 2);
    const cases: [Request, string][] = [
      [put(JPEG, { "content-type": "image/gif" }), "image_not_supported"],
      [put(new Uint8Array(0)), "image_not_supported"],
      [put(JPEG, { "content-length": String(PHOTO_LIMITS.maxBytes + 1) }), "image_too_large"],
      [put(new Uint8Array(PHOTO_LIMITS.maxBytes + 1)), "image_too_large"],
      [put(badJpeg), "image_not_supported"],
      [put(jpegOf(513, 513)), "image_bad_size"],
      [put(pngOf(64, 100), { "content-type": "image/png" }), "image_bad_size"],
    ];
    for (const [r, code] of cases) {
      const res = await PUT(r, noParams);
      expect([res.status, (await res.json()).error.code]).toEqual([422, code]);
    }
    expect(svc.setOwnPhoto).not.toHaveBeenCalled();
    expect(pool.getPool).not.toHaveBeenCalled();
    expect(drive.getDrive).not.toHaveBeenCalled();
  });

  it("PUT ok passes stripped bytes and the type; 200 with no-store", async () => {
    fakeAuth(["simap:user"]);
    svc.setOwnPhoto.mockResolvedValue({ ok: true, value: { hasPhoto: true, photoVersion: 1 } });
    const r = await PUT(put(jpegOf(64, 64, { exif: "GPS 10N", com: "x" })), noParams);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ hasPhoto: true, photoVersion: 1 });
    const a = svc.setOwnPhoto.mock.calls[0]!;
    expect(a[2]).toMatchObject({ orgId: "o1" });
    expect(a[3]).toBe("s1");
    expect(a[4].type).toBe("jpeg");
    expect(a[4].bytes).toEqual(JPEG);
    // the bytes decide the type: a PNG sent as image/jpeg is stored as png
    await PUT(put(PNG), noParams);
    expect(svc.setOwnPhoto.mock.calls[1]![4].type).toBe("png");
  });

  it("PUT service refusals map 1:1; the handler never answers 401 or 403", async () => {
    fakeAuth(["simap:user"]);
    const cases = [
      [404, "not_found"],
      [409, "image_changed"],
      [409, "not_allowed"],
      [502, "drive_error"],
      [503, "images_unavailable"],
    ] as const;
    for (const [status, code] of cases) {
      svc.setOwnPhoto.mockResolvedValueOnce({ ok: false, status, code });
      const r = await PUT(put(JPEG), noParams);
      expect([r.status, (await r.json()).error.code]).toEqual([status, code]);
    }
  });

  it("no pool gives 503 unavailable", async () => {
    fakeAuth(["simap:user"]);
    pool.getPool.mockReturnValueOnce(null as never);
    expect((await PUT(put(JPEG), noParams)).status).toBe(503);
  });

  it("DELETE 204 no-store and refusals map", async () => {
    fakeAuth(["simap:user"]);
    svc.removeOwnPhoto.mockResolvedValueOnce({ ok: true, value: null });
    const r = await DELETE(plain("DELETE"), noParams);
    expect([r.status, r.headers.get("Cache-Control"), await r.text()]).toEqual([
      204,
      "no-store",
      "",
    ]);
    svc.removeOwnPhoto.mockResolvedValueOnce({ ok: false, status: 409, code: "not_allowed" });
    expect((await DELETE(plain("DELETE"), noParams)).status).toBe(409);
  });

  it("GET 200 headers: type from the bytes, ETag, private no-cache, nosniff, inline, sandbox, length", async () => {
    fakeAuth(["simap:user"]);
    svc.getOwnPhoto.mockResolvedValue({
      ok: true,
      value: { kind: "bytes", bytes: JPEG, etag: `"${ID}-2"`, contentType: "image/jpeg" },
    });
    const r = await GET(plain("GET", { "if-none-match": '"old"' }), noParams);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/jpeg");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(r.headers.get("ETag")).toBe(`"${ID}-2"`);
    expect(r.headers.get("Content-Disposition")).toBe("inline");
    expect(r.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(r.headers.get("Content-Length")).toBe(String(JPEG.length));
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(JPEG);
    expect(svc.getOwnPhoto.mock.calls[0]![4]).toBe('"old"');
  });

  it("GET 304 keeps ETag and Cache-Control; failures stay 404/502/503", async () => {
    fakeAuth(["simap:user"]);
    svc.getOwnPhoto.mockResolvedValueOnce({
      ok: true,
      value: { kind: "not_modified", etag: `"${ID}-2"` },
    });
    const r = await GET(plain("GET"), noParams);
    expect([r.status, await r.text(), r.headers.get("ETag")]).toEqual([304, "", `"${ID}-2"`]);
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
    for (const [status, code] of [
      [404, "not_found"],
      [502, "drive_error"],
      [503, "images_unavailable"],
    ] as const) {
      svc.getOwnPhoto.mockResolvedValueOnce({ ok: false, status, code });
      expect((await GET(plain("GET"), noParams)).status).toBe(status);
    }
  });
});

describe("member photo routes", () => {
  it("a non-UUID id gives 404 before getPool", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await memberRoute.GET(plain("GET"), bad)).status).toBe(404);
    expect((await memberRoute.DELETE(plain("DELETE"), bad)).status).toBe(404);
    expect(pool.getPool).not.toHaveBeenCalled();
  });

  it("GET as user works; the id and If-None-Match reach the service", async () => {
    fakeAuth(["simap:user"]);
    svc.getMemberPhoto.mockResolvedValue({
      ok: true,
      value: { kind: "bytes", bytes: PNG, etag: `"${ID}-1"`, contentType: "image/png" },
    });
    const r = await memberRoute.GET(plain("GET", { "if-none-match": '"a"' }), idRoute);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/png");
    expect(svc.getMemberPhoto.mock.calls[0]!.slice(3)).toEqual([ID, '"a"']);
  });

  it("DELETE as user gives 403 from withAuth and the service is not called", async () => {
    fakeAuth(["simap:user"]);
    const r = await memberRoute.DELETE(plain("DELETE"), idRoute);
    expect([r.status, (await r.json()).error.code]).toEqual([403, "forbidden"]);
    expect(svc.removeMemberPhoto).not.toHaveBeenCalled();
  });

  it("DELETE as manager and admin gives 204 with the actor and target", async () => {
    for (const role of ["simap:manager", "simap:admin"]) {
      fakeAuth([role]);
      svc.removeMemberPhoto.mockResolvedValueOnce({ ok: true, value: null });
      const r = await memberRoute.DELETE(plain("DELETE"), idRoute);
      expect(r.status).toBe(204);
    }
    expect(svc.removeMemberPhoto.mock.calls[0]!.slice(3)).toEqual(["s1", ID]);
  });

  it("exports no PUT (405 from Next; OQ-61)", () => {
    expect("PUT" in memberRoute).toBe(false);
    expect("POST" in memberRoute).toBe(false);
  });
});
