// Small PNG codec on node:zlib (no dependency). Used by the sprite packer; see scripts/sprites-pack.mjs.
// Image = { w, h, data: Uint8Array } with RGBA8 data (4 bytes per pixel).
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Uint8Array} buf */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Width and height from the IHDR, without decoding. @param {Buffer} buf */
export function readPngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Unsupported PNG: bad signature");
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes a non-interlaced PNG to RGBA8. Throws `Unsupported PNG: ...` otherwise. @param {Buffer} buf */
export function decodePng(buf) {
  const { w, h } = readPngSize(buf);
  let pos = 8;
  let depth = 0;
  let type = 0;
  let palette = Buffer.alloc(0);
  let trns = Buffer.alloc(0);
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("latin1", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      depth = body[8];
      type = body[9];
      if (body[12] !== 0) throw new Error("Unsupported PNG: interlaced");
    } else if (name === "PLTE") palette = body;
    else if (name === "tRNS") trns = body;
    else if (name === "IDAT") idat.push(body);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  const ch = CHANNELS[/** @type {keyof typeof CHANNELS} */ (type)];
  const okDepth = type === 3 ? [1, 2, 4, 8].includes(depth) : depth === 8;
  if (!ch || !okDepth) throw new Error(`Unsupported PNG: colour type ${type} at ${depth}-bit`);
  const bpp = Math.max(1, (ch * depth) >> 3);
  const stride = Math.ceil((w * ch * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * h) throw new Error("Unsupported PNG: truncated data");
  const rows = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    if (f > 4) throw new Error("Unsupported PNG: bad filter");
    const src = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? rows[y * stride + i - bpp] : 0;
      const up = y > 0 ? rows[(y - 1) * stride + i] : 0;
      const ul = y > 0 && i >= bpp ? rows[(y - 1) * stride + i - bpp] : 0;
      const pred =
        f === 0
          ? 0
          : f === 1
            ? left
            : f === 2
              ? up
              : f === 3
                ? (left + up) >> 1
                : paeth(left, up, ul);
      rows[y * stride + i] = (raw[src + i] + pred) & 0xff;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = y * stride;
      let px;
      if (type === 3) {
        const bit = x * depth;
        const idx = (rows[r + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        const a = idx < trns.length ? trns[idx] : 255;
        px = [palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2], a];
      } else {
        const i = r + x * ch;
        px =
          type === 0
            ? [rows[i], rows[i], rows[i], 255]
            : type === 2
              ? [rows[i], rows[i + 1], rows[i + 2], 255]
              : type === 4
                ? [rows[i], rows[i], rows[i], rows[i + 1]]
                : [rows[i], rows[i + 1], rows[i + 2], rows[i + 3]];
      }
      data.set(px, (y * w + x) * 4);
    }
  }
  return { w, h, data };
}

/** @param {string} name @param {Uint8Array} body */
function chunk(name, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(name, 4, "latin1");
  out.set(body, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** Encodes RGBA8 with filter 0 and only IHDR/IDAT/IEND, so the bytes are stable. @param {{w:number,h:number,data:Uint8Array}} img */
export function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw.set(img.data.subarray(y * img.w * 4, (y + 1) * img.w * 4), y * (img.w * 4 + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
