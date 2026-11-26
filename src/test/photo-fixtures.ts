import { deflateSync } from "node:zlib";

export const bytesOf = (parts: Uint8Array[]): Uint8Array => {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
};

const text = (s: string) => new TextEncoder().encode(s);

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

export const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(text(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};

/** A structurally valid PNG. `before` chunks go between IHDR and IDAT; `padTo` adds a tEXt chunk to reach a size. */
export function pngOf(
  w: number,
  h: number,
  opts: { before?: Uint8Array[]; padTo?: number } = {},
): Uint8Array {
  const hd = new Uint8Array(13);
  new DataView(hd.buffer).setUint32(0, w);
  new DataView(hd.buffer).setUint32(4, h);
  hd.set([8, 6, 0, 0, 0], 8);
  const build = (before: Uint8Array[]) => [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", hd),
    ...before,
    pngChunk("IDAT", new Uint8Array(deflateSync(Buffer.alloc(97 * 24)))),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const before = opts.before ?? [];
  if (opts.padTo) {
    const base = bytesOf(build(before)).length;
    before.push(pngChunk("tEXt", new Uint8Array(opts.padTo - base - 12)));
  }
  return bytesOf(build(before));
}

export const seg = (marker: number, payload: Uint8Array): Uint8Array =>
  bytesOf([
    new Uint8Array([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]),
    payload,
  ]);

export const sofSeg = (w: number, h: number, marker = 0xc0, nf = 3): Uint8Array => {
  const p = new Uint8Array(6 + 3 * nf);
  p[0] = 8;
  p.set([h >> 8, h & 0xff, w >> 8, w & 0xff, nf], 1);
  return seg(marker, p);
};

export const SOI = new Uint8Array([0xff, 0xd8]);
export const EOI = new Uint8Array([0xff, 0xd9]);
/** SOS header plus scan data with a stuffed FF00 and an RST0 marker. */
export const SCAN = bytesOf([
  seg(0xda, new Uint8Array([1, 1, 0, 0, 63, 0])),
  new Uint8Array([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]),
]);

/** A structurally valid JPEG. Metadata segments are optional; `progressive` uses SOF2. */
export function jpegOf(
  w: number,
  h: number,
  opts: {
    progressive?: boolean;
    app0?: boolean;
    exif?: string;
    iptc?: boolean;
    com?: string;
    padTo?: number;
  } = {},
): Uint8Array {
  const parts: Uint8Array[] = [SOI];
  if (opts.app0) parts.push(seg(0xe0, text("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")));
  if (opts.exif) parts.push(seg(0xe1, text(`Exif\0\0${opts.exif}`)));
  if (opts.iptc) parts.push(seg(0xed, text("Photoshop 3.0\0")));
  if (opts.com) parts.push(seg(0xfe, text(opts.com)));
  parts.push(seg(0xdb, new Uint8Array(65)));
  parts.push(sofSeg(w, h, opts.progressive ? 0xc2 : 0xc0));
  parts.push(seg(0xc4, new Uint8Array(17)));
  parts.push(SCAN);
  if (opts.padTo) {
    // APP2 segments (kept by the strip) of at most 60000 bytes each, up to the exact total size
    let left = opts.padTo - bytesOf(parts).length - 2;
    while (left > 0) {
      const n = Math.min(left - 4, 60000);
      parts.splice(1, 0, seg(0xe2, new Uint8Array(n)));
      left -= n + 4;
    }
  }
  parts.push(EOI);
  return bytesOf(parts);
}
