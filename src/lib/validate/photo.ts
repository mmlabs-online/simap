import { parsePng } from "./png";

/** OQ-56: profile photos are square PNG or JPEG, 64 x 64 to 512 x 512 px, at most 256 KB. */
export const PHOTO_LIMITS = { minPx: 64, maxPx: 512, maxBytes: 262144 } as const;

export type PhotoType = "png" | "jpeg";
export type PhotoCode = "image_too_large" | "image_not_supported" | "image_bad_size";
export type PhotoResult =
  | { ok: true; type: PhotoType; size: number }
  | { ok: false; code: PhotoCode };

export const PHOTO_MIME: Record<PhotoType, string> = { png: "image/png", jpeg: "image/jpeg" };
export const PHOTO_EXT: Record<PhotoType, string> = { png: "png", jpeg: "jpg" };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bad = { ok: false, code: "image_not_supported" } as const;

type Jpeg = { ok: true; width: number; height: number } | { ok: false };

const isStandalone = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd7);
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/**
 * Strict JPEG structure walk, no decoding: SOI first, every segment length inside the buffer, exactly one SOF
 * (baseline, extended or progressive only), SOS after it, one or more scans, EOI as the last two bytes. Lossless,
 * arithmetic and hierarchical frames, a nested SOI, a zero height (DNL) and trailing bytes are refused.
 */
export function parseJpeg(bytes: Uint8Array): Jpeg {
  const n = bytes.length;
  if (n < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false };
  let at = 2;
  let width = -1;
  let height = -1;
  let sos = false;
  for (;;) {
    while (at + 1 < n && bytes[at] === 0xff && bytes[at + 1] === 0xff) at++;
    if (at + 1 >= n || bytes[at] !== 0xff) return { ok: false };
    const m = bytes[at + 1]!;
    if (m === 0xd9)
      return sos && at + 2 === n && width > 0 ? { ok: true, width, height } : { ok: false };
    if (m === 0x00 || m === 0xd8 || isStandalone(m)) return { ok: false };
    if (at + 4 > n) return { ok: false };
    const len = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    if (len < 2 || at + 2 + len > n) return { ok: false };
    if (isSof(m)) {
      if (m > 0xc2 || width >= 0 || len < 8) return { ok: false };
      const nf = bytes[at + 9];
      if ((nf !== 1 && nf !== 3) || len !== 8 + 3 * nf) return { ok: false };
      height = (bytes[at + 5]! << 8) | bytes[at + 6]!;
      width = (bytes[at + 7]! << 8) | bytes[at + 8]!;
      if (height === 0 || width === 0) return { ok: false };
    }
    at += 2 + len;
    if (m !== 0xda) continue;
    if (width < 0) return { ok: false };
    sos = true;
    for (;;) {
      if (at >= n) return { ok: false };
      if (bytes[at] !== 0xff) {
        at++;
        continue;
      }
      const next = bytes[at + 1];
      if (next === undefined) return { ok: false };
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) at += 2;
      else if (next === 0xff) at++;
      else break;
    }
  }
}

/** OQ-56 check. The magic bytes decide the format; the size cap comes first, before any parsing. */
export function validatePhoto(bytes: Uint8Array): PhotoResult {
  if (bytes.length > PHOTO_LIMITS.maxBytes) return { ok: false, code: "image_too_large" };
  let type: PhotoType;
  let width: number;
  let height: number;
  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    const p = parsePng(bytes);
    if (!p.ok) return bad;
    type = "png";
    ({ width, height } = p);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const p = parseJpeg(bytes);
    if (!p.ok) return bad;
    type = "jpeg";
    ({ width, height } = p);
  } else {
    return bad;
  }
  const { minPx, maxPx } = PHOTO_LIMITS;
  if (width !== height || width < minPx || width > maxPx) {
    return { ok: false, code: "image_bad_size" };
  }
  return { ok: true, type, size: width };
}

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

/**
 * Privacy (A3): drops metadata before storing. JPEG: APP1 (Exif, XMP), APP13 (IPTC) and COM segments before the
 * first scan. PNG: eXIf, tEXt, zTXt, iTXt and tIME chunks. Everything else is copied byte for byte. The input must
 * already have passed `validatePhoto`; the caller validates the result again.
 */
export function stripPhotoMetadata(bytes: Uint8Array, type: PhotoType): Uint8Array {
  const parts: Uint8Array[] = [];
  if (type === "png") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    parts.push(bytes.subarray(0, 8));
    let at = 8;
    while (at + 8 <= bytes.length) {
      const end = at + 12 + view.getUint32(at);
      const name = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (!PNG_DROP.has(name)) parts.push(bytes.subarray(at, end));
      at = end;
    }
    return concat(parts);
  }
  parts.push(bytes.subarray(0, 2));
  let at = 2;
  while (at + 3 < bytes.length) {
    const start = at;
    while (bytes[at + 1] === 0xff) at++;
    const m = bytes[at + 1]!;
    if (m === 0xda) {
      parts.push(bytes.subarray(start));
      return concat(parts);
    }
    const end = at + 2 + ((bytes[at + 2]! << 8) | bytes[at + 3]!);
    if (!JPEG_DROP.has(m)) parts.push(bytes.subarray(start, end));
    at = end;
  }
  return concat(parts);
}
