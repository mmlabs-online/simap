import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS, validatePng } from "./png";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array, opts: { len?: number; badCrc?: boolean } = {}) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, opts.len ?? data.length);
  out.set(
    [...type].map((ch) => ch.charCodeAt(0)),
    4,
  );
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  v.setUint32(8 + data.length, opts.badCrc ? crc ^ 1 : crc);
  return out;
}

function ihdr(w: number, h: number, len = 13) {
  const d = new Uint8Array(len);
  const v = new DataView(d.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  if (len >= 13) d.set([8, 6, 0, 0, 0], 8);
  return d;
}

const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const idat = (w = 24, h = 24) =>
  chunk("IDAT", new Uint8Array(deflateSync(Buffer.alloc((w * 4 + 1) * h))));

function png(
  o: { w?: number; h?: number; extra?: Uint8Array[]; noIdat?: boolean; iend?: Uint8Array } = {},
) {
  return join(
    new Uint8Array(SIG),
    chunk("IHDR", ihdr(o.w ?? 24, o.h ?? 24)),
    ...(o.extra ?? []),
    ...(o.noIdat ? [] : [idat()]),
    o.iend ?? chunk("IEND", new Uint8Array(0)),
  );
}

const text = (s: string) => new TextEncoder().encode(s);
const notPng = { ok: false, code: "image_not_png" };

describe("validatePng", () => {
  it("limits", () => expect(IMAGE_LIMITS).toEqual({ px: 24, maxBytes: 20480 }));

  it("accepts a valid 24x24 RGBA PNG fixture", () => {
    expect(validatePng(png())).toEqual({ ok: true });
  });

  it("image_not_png for non-PNG and malformed input", () => {
    const good = png();
    const sigOff = good.slice();
    sigOff[7] = 0x0b;
    const cases: Record<string, Uint8Array> = {
      empty: new Uint8Array(0),
      short: good.slice(0, 7),
      sigOff,
      html: text("<html><body>hi</body></html>"),
      svg: text('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ihdrLen12: join(
        new Uint8Array(SIG),
        chunk("IHDR", ihdr(24, 24, 12)),
        idat(),
        chunk("IEND", new Uint8Array(0)),
      ),
      firstNotIhdr: join(
        new Uint8Array(SIG),
        idat(),
        chunk("IHDR", ihdr(24, 24)),
        chunk("IEND", new Uint8Array(0)),
      ),
      truncated: good.slice(0, 40),
      lenPastEnd: join(
        new Uint8Array(SIG),
        chunk("IHDR", ihdr(24, 24)),
        chunk("IDAT", new Uint8Array(4), { len: 0x7fffffff }),
      ),
      trailing: join(good, new Uint8Array([0])),
      noIend: good.slice(0, good.length - 12),
      iendLen: png({ iend: chunk("IEND", new Uint8Array(1)) }),
      noIdat: png({ noIdat: true }),
      badCrc: png({ extra: [chunk("tEXt", text("a\0b"), { badCrc: true })] }),
      apng: png({ extra: [chunk("acTL", new Uint8Array(8))] }),
    };
    for (const [name, bytes] of Object.entries(cases)) {
      expect({ name, r: validatePng(bytes) }).toEqual({ name, r: notPng });
    }
  });

  it("image_bad_size for a valid PNG of another size", () => {
    const bad = { ok: false, code: "image_bad_size" };
    for (const [w, h] of [
      [23, 24],
      [24, 23],
      [0, 0],
      [48, 48],
      [0xffffffff, 0xffffffff],
    ] as const) {
      expect(validatePng(png({ w, h }))).toEqual(bad);
    }
  });
});
