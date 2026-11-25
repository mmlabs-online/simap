import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  setMapItemImage: vi.fn(),
  removeMapItemImage: vi.fn(),
  getMapItemImage: vi.fn(),
}));
vi.mock("@/server/map-items/image", () => svc);
const pool = vi.hoisted(() => ({ getPool: vi.fn(() => ({})) }));
vi.mock("@/server/db/pool", () => pool);
const drive = vi.hoisted(() => ({ getDrive: vi.fn(() => null) }));
vi.mock("@/server/drive/drive", () => drive);

import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { DELETE, GET, PUT } from "./[key]/art/[dir]/image/route";

const ISSUER = "https://api.mmlabs.online";
const route = (key = "door", dir = "e") => ({ params: Promise.resolve({ key, dir }) });

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
function pngOf(w: number, h: number, o: { padTo?: number; apng?: boolean } = {}): Uint8Array {
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
  const parts = o.apng
    ? build([chunk("acTL", new Uint8Array(8))])
    : o.padTo
      ? build([chunk("tEXt", new Uint8Array(o.padTo - base - 12))])
      : build([]);
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}
const PNG = pngOf(32, 64);

const put = (body: Uint8Array | null, headers: Record<string, string> = {}) =>
  new Request("http://x/api/map-items/door/art/e/image", {
    method: "PUT",
    body: body as BodyInit | null,
    headers: { "content-type": "image/png", authorization: "Bearer t", ...headers },
  });
const plain = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api/map-items/door/art/e/image", {
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

describe("map item image routes", () => {
  it("bad key or dir gives 404 before the pool", async () => {
    fakeAuth(["simap:admin"]);
    for (const bad of [route("Door!", "e"), route("door", "x"), route("door", "up")]) {
      expect((await PUT(put(PNG), bad)).status).toBe(404);
      expect((await DELETE(plain("DELETE"), bad)).status).toBe(404);
      expect((await GET(plain("GET"), bad)).status).toBe(404);
    }
    expect(pool.getPool).not.toHaveBeenCalled();
  });

  it("no pool gives 503 unavailable", async () => {
    fakeAuth(["simap:admin"]);
    pool.getPool.mockReturnValueOnce(null as never);
    expect((await PUT(put(PNG), route())).status).toBe(503);
  });

  it("PUT 422: too large (Content-Length and streamed), wrong type, garbage, APNG; the service is not called", async () => {
    fakeAuth(["simap:admin"]);
    const max = MAP_ITEM_LIMITS.imageBytes;
    const cases: [Request, string][] = [
      [put(PNG, { "content-length": String(max + 1) }), "image_too_large"],
      [put(new Uint8Array(max + 1)), "image_too_large"],
      [put(PNG, { "content-type": "image/jpeg" }), "image_not_png"],
      [put(new Uint8Array(0)), "image_not_png"],
      [put(new TextEncoder().encode("<html>x</html>")), "image_not_png"],
      [put(pngOf(32, 64, { apng: true })), "image_not_png"],
    ];
    for (const [r, code] of cases) {
      const res = await PUT(r, route());
      expect([res.status, (await res.json()).error.code]).toEqual([422, code]);
    }
    expect(svc.setMapItemImage).not.toHaveBeenCalled();
    expect(drive.getDrive).not.toHaveBeenCalled();
  });

  it("PUT ok gives 200 DTO, no-store; the service gets the key, dir, bytes and size", async () => {
    fakeAuth(["simap:admin"]);
    svc.setMapItemImage.mockResolvedValue({ ok: true, value: { builtinKey: "door" } });
    const r = await PUT(put(PNG), route());
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ builtinKey: "door" });
    const a = svc.setMapItemImage.mock.calls[0]!;
    expect(a.slice(3, 5)).toEqual(["s1", "door"]);
    expect(a[5]).toBe("e");
    expect(a[6]).toEqual(PNG);
    expect(a[7]).toEqual({ ok: true, width: 32, height: 64 });
  });

  it("a valid PNG of exactly 64 KB reaches the service with the bytes", async () => {
    fakeAuth(["simap:admin"]);
    svc.setMapItemImage.mockResolvedValue({ ok: true, value: {} });
    const big = pngOf(32, 64, { padTo: MAP_ITEM_LIMITS.imageBytes });
    expect(big.length).toBe(65536);
    expect((await PUT(put(big), route())).status).toBe(200);
    expect(svc.setMapItemImage.mock.calls[0]![6]).toEqual(big);
  });

  it("PUT and DELETE with a user or manager token give 403 and never call the service; a user may GET", async () => {
    for (const role of ["simap:user", "simap:manager"]) {
      fakeAuth([role]);
      expect((await PUT(put(PNG), route())).status).toBe(403);
      expect((await DELETE(plain("DELETE"), route())).status).toBe(403);
    }
    expect(svc.setMapItemImage).not.toHaveBeenCalled();
    expect(svc.removeMapItemImage).not.toHaveBeenCalled();
    fakeAuth(["simap:user"]);
    svc.getMapItemImage.mockResolvedValue({ ok: false, status: 404, code: "not_found" });
    expect((await GET(plain("GET"), route())).status).toBe(404);
    expect(svc.getMapItemImage).toHaveBeenCalledTimes(1);
  });

  it("service refusals map to their status and code; DELETE ok gives 204 no-store", async () => {
    fakeAuth(["simap:admin"]);
    for (const [status, code] of [
      [409, "image_changed"],
      [422, "image_bad_size"],
      [422, "not_allowed"],
      [502, "drive_error"],
      [503, "images_unavailable"],
    ] as const) {
      svc.setMapItemImage.mockResolvedValueOnce({ ok: false, status, code });
      const p = await PUT(put(PNG), route());
      expect([p.status, await p.json()]).toEqual([status, { error: { code } }]);
    }
    svc.removeMapItemImage.mockResolvedValueOnce({ ok: false, status: 404, code: "not_found" });
    expect((await DELETE(plain("DELETE"), route())).status).toBe(404);
    svc.removeMapItemImage.mockResolvedValueOnce({ ok: true, value: null });
    const r = await DELETE(plain("DELETE"), route());
    expect([r.status, r.headers.get("Cache-Control"), await r.text()]).toEqual([
      204,
      "no-store",
      "",
    ]);
  });

  it("GET 200 headers: image/png, nosniff, private no-cache, ETag, inline, sandbox, length", async () => {
    fakeAuth(["simap:user"]);
    svc.getMapItemImage.mockResolvedValue({
      ok: true,
      value: { kind: "bytes", bytes: PNG, etag: '"door-e-1"' },
    });
    const r = await GET(plain("GET", { "if-none-match": '"old"' }), route());
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/png");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(r.headers.get("ETag")).toBe('"door-e-1"');
    expect(r.headers.get("Content-Disposition")).toBe("inline");
    expect(r.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(r.headers.get("Content-Length")).toBe(String(PNG.length));
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PNG);
    expect(svc.getMapItemImage.mock.calls[0]![3]).toBe("door");
    expect(svc.getMapItemImage.mock.calls[0]![5]).toBe('"old"');
  });

  it("GET 304 keeps the ETag and cache headers, with an empty body", async () => {
    fakeAuth(["simap:user"]);
    svc.getMapItemImage.mockResolvedValue({
      ok: true,
      value: { kind: "not_modified", etag: '"door-e-1"' },
    });
    const r = await GET(plain("GET"), route());
    expect(r.status).toBe(304);
    expect(await r.text()).toBe("");
    expect(r.headers.get("ETag")).toBe('"door-e-1"');
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
  });
});
