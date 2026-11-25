import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  setDeviceTypeImage: vi.fn(),
  removeDeviceTypeImage: vi.fn(),
  getDeviceTypeImage: vi.fn(),
}));
vi.mock("@/server/device-types/image", () => svc);
const pool = vi.hoisted(() => ({ getPool: vi.fn(() => ({})) }));
vi.mock("@/server/db/pool", () => pool);
const drive = vi.hoisted(() => ({ getDrive: vi.fn(() => null) }));
vi.mock("@/server/drive/drive", () => drive);

import { IMAGE_LIMITS } from "@/lib/validate/png";
import { DELETE, GET, PUT } from "./[id]/image/route";

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

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngOf(w: number, h: number, padTo = 0): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const hd = new Uint8Array(13);
  new DataView(hd.buffer).setUint32(0, w);
  new DataView(hd.buffer).setUint32(4, h);
  hd.set([8, 6, 0, 0, 0], 8);
  const build = (pad: Uint8Array[]) => [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", hd),
    ...pad,
    chunk("IDAT", new Uint8Array(deflateSync(Buffer.alloc(97 * 24)))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const base = build([]).reduce((n, p) => n + p.length, 0);
  const parts = padTo ? build([chunk("tEXt", new Uint8Array(padTo - base - 12))]) : build([]);
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}
const PNG = pngOf(24, 24);

const put = (body: Uint8Array | null, headers: Record<string, string> = {}) =>
  new Request("http://x/api/device-types/x/image", {
    method: "PUT",
    body: body as BodyInit | null,
    headers: {
      "content-type": "image/png",
      authorization: "Bearer t",
      "content-disposition": "attachment; filename=evil.html",
      "x-filename": "evil.html",
      ...headers,
    },
  });
const plain = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api/device-types/x/image", {
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

describe("device type image routes", () => {
  it("401 without token on PUT, DELETE and GET", async () => {
    vi.stubEnv("MM_IDENTITY_ISSUER", ISSUER);
    const bare = (m: string) => new Request("http://x/", { method: m });
    const rs = [
      await PUT(bare("PUT"), idRoute),
      await DELETE(bare("DELETE"), idRoute),
      await GET(bare("GET"), idRoute),
    ];
    expect(rs.map((r) => r.status)).toEqual([401, 401, 401]);
    for (const f of Object.values(svc)) expect(f).not.toHaveBeenCalled();
  });

  it("user and manager get 403 on PUT and DELETE; a user may GET", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      expect((await PUT(put(PNG), idRoute)).status).toBe(403);
      expect((await DELETE(plain("DELETE"), idRoute)).status).toBe(403);
    }
    expect(svc.setDeviceTypeImage).not.toHaveBeenCalled();
    expect(svc.removeDeviceTypeImage).not.toHaveBeenCalled();
    fakeAuth(["simap:user"]);
    svc.getDeviceTypeImage.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await GET(plain("GET"), idRoute)).status).toBe(404);
    expect(svc.getDeviceTypeImage).toHaveBeenCalledTimes(1);
  });

  it("bad uuid gives 404 before getPool", async () => {
    fakeAuth(["simap:admin"]);
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await PUT(put(PNG), bad)).status).toBe(404);
    expect((await DELETE(plain("DELETE"), bad)).status).toBe(404);
    expect((await GET(plain("GET"), bad)).status).toBe(404);
    expect(pool.getPool).not.toHaveBeenCalled();
  });

  it("no pool gives 503 unavailable", async () => {
    fakeAuth(["simap:admin"]);
    pool.getPool.mockReturnValueOnce(null as never);
    expect((await PUT(put(PNG), idRoute)).status).toBe(503);
  });

  it("422 cases: the service and getDrive are not called", async () => {
    fakeAuth(["simap:admin"]);
    const cases: [Request, number, string][] = [
      [put(PNG, { "content-type": "image/jpeg" }), 422, "image_not_png"],
      [put(PNG, { "content-length": String(IMAGE_LIMITS.maxBytes + 1) }), 422, "image_too_large"],
      [put(new Uint8Array(IMAGE_LIMITS.maxBytes + 1)), 422, "image_too_large"],
      [put(new Uint8Array(0)), 422, "image_not_png"],
      [put(new TextEncoder().encode("<html>x</html>")), 422, "image_not_png"],
      [put(pngOf(23, 24)), 422, "image_bad_size"],
      [put(pngOf(101, 101)), 422, "image_bad_size"],
    ];
    for (const [r, status, code] of cases) {
      const res = await PUT(r, idRoute);
      expect([res.status, (await res.json()).error.code]).toEqual([status, code]);
    }
    expect(svc.setDeviceTypeImage).not.toHaveBeenCalled();
    expect(drive.getDrive).not.toHaveBeenCalled();
  });

  it("PUT ok gives 200 DTO, no-store; the service gets the bytes, scope and sub", async () => {
    fakeAuth(["simap:admin"]);
    const dto = { id: ID, name: "PC", slot: "pc", hasImage: true, imageVersion: 1 };
    svc.setDeviceTypeImage.mockResolvedValue({ ok: true, value: dto });
    const r = await PUT(put(PNG), idRoute);
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual(dto);
    const a = svc.setDeviceTypeImage.mock.calls[0]!;
    expect(a[3]).toBe("s1");
    expect(a[4]).toBe(ID);
    expect(a[5]).toEqual(PNG);
  });

  it("a 100x100 PNG padded to maxBytes reaches the service", async () => {
    fakeAuth(["simap:admin"]);
    svc.setDeviceTypeImage.mockResolvedValue({
      ok: true,
      value: { id: ID, name: "PC", slot: "pc", hasImage: true, imageVersion: 1 },
    });
    const big = pngOf(100, 100, IMAGE_LIMITS.maxBytes);
    expect(big.length).toBe(IMAGE_LIMITS.maxBytes);
    expect((await PUT(put(big), idRoute)).status).toBe(200);
    expect(svc.setDeviceTypeImage.mock.calls[0]![5]).toEqual(big);
  });

  it("service refusal maps to its status and code", async () => {
    fakeAuth(["simap:admin"]);
    svc.setDeviceTypeImage.mockResolvedValue({ ok: false, status: 409, code: "image_changed" });
    svc.removeDeviceTypeImage.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    const p = await PUT(put(PNG), idRoute);
    expect([p.status, await p.json()]).toEqual([409, { error: { code: "image_changed" } }]);
    expect((await DELETE(plain("DELETE"), idRoute)).status).toBe(404);
  });

  it("DELETE ok gives 204 no-store", async () => {
    fakeAuth(["simap:admin"]);
    svc.removeDeviceTypeImage.mockResolvedValue({ ok: true, value: null });
    const r = await DELETE(plain("DELETE"), idRoute);
    expect([r.status, r.headers.get("Cache-Control"), await r.text()]).toEqual([
      204,
      "no-store",
      "",
    ]);
  });

  it("GET 200 headers: fixed image/png, nosniff, private no-cache, ETag, inline, sandbox, length", async () => {
    fakeAuth(["simap:user"]);
    svc.getDeviceTypeImage.mockResolvedValue({
      ok: true,
      value: { kind: "bytes", bytes: PNG, etag: `"${ID}-1"` },
    });
    const r = await GET(plain("GET", { "if-none-match": '"old"' }), idRoute);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/png");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(r.headers.get("ETag")).toBe(`"${ID}-1"`);
    expect(r.headers.get("Content-Disposition")).toBe("inline");
    expect(r.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(r.headers.get("Content-Length")).toBe(String(PNG.length));
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PNG);
    expect(svc.getDeviceTypeImage.mock.calls[0]![4]).toBe('"old"');
  });

  it("GET 304: empty body, ETag and headers kept", async () => {
    fakeAuth(["simap:user"]);
    svc.getDeviceTypeImage.mockResolvedValue({
      ok: true,
      value: { kind: "not_modified", etag: `"${ID}-1"` },
    });
    const r = await GET(plain("GET"), idRoute);
    expect(r.status).toBe(304);
    expect(await r.text()).toBe("");
    expect(r.headers.get("ETag")).toBe(`"${ID}-1"`);
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("Drive failures from the service stay 5xx", async () => {
    fakeAuth(["simap:user"]);
    for (const [status, code] of [
      [502, "drive_error"],
      [503, "images_unavailable"],
    ] as const) {
      svc.getDeviceTypeImage.mockResolvedValueOnce({ ok: false, status, code });
      const r = await GET(plain("GET"), idRoute);
      expect([r.status, (await r.json()).error.code]).toEqual([status, code]);
    }
  });
});
