/** D68 (amends D61): device type images are square PNGs, 24 x 24 to 100 x 100 px, at most 100 KB. */
export const IMAGE_LIMITS = { minPx: 24, maxPx: 100, maxBytes: 102400 } as const;

export type PngResult = { ok: true } | { ok: false; code: "image_not_png" | "image_bad_size" };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, from: number, to: number): number {
  let c = 0xffffffff;
  for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const notPng = { ok: false, code: "image_not_png" } as const;

/**
 * Structural check only: signature, every chunk's bounds and CRC, IHDR first (length 13), at least one IDAT, no
 * APNG (`acTL`), IEND last with length 0 and nothing after it. Pixels are not decoded. Returns the IHDR size and
 * applies no size limit; every failure is `image_not_png`.
 */
export function parsePng(
  bytes: Uint8Array,
): { ok: true; width: number; height: number } | { ok: false; code: "image_not_png" } {
  if (bytes.length < SIGNATURE.length) return notPng;
  for (let i = 0; i < SIGNATURE.length; i++) if (bytes[i] !== SIGNATURE[i]) return notPng;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = SIGNATURE.length;
  let width = -1;
  let height = -1;
  let first = true;
  let idat = false;
  for (;;) {
    if (at + 8 > bytes.length) return notPng;
    const len = view.getUint32(at);
    const type = String.fromCharCode(
      bytes[at + 4]!,
      bytes[at + 5]!,
      bytes[at + 6]!,
      bytes[at + 7]!,
    );
    const end = at + 8 + len;
    if (end + 4 > bytes.length) return notPng;
    if (crc32(bytes, at + 4, end) !== view.getUint32(end)) return notPng;
    if (first) {
      if (type !== "IHDR" || len !== 13) return notPng;
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      first = false;
    } else if (type === "IHDR" || type === "acTL") {
      return notPng;
    } else if (type === "IDAT") {
      idat = true;
    }
    at = end + 4;
    if (type === "IEND") {
      if (len !== 0 || at !== bytes.length || !idat) return notPng;
      break;
    }
  }
  return { ok: true, width, height };
}

/** Device type images: `parsePng` plus the square 24-100 px rule. A wrong size gives `image_bad_size`. */
export function validatePng(bytes: Uint8Array): PngResult {
  const p = parsePng(bytes);
  if (!p.ok) return p;
  const { width, height } = p;
  const { minPx, maxPx } = IMAGE_LIMITS;
  return width === height && width >= minPx && width <= maxPx
    ? { ok: true }
    : { ok: false, code: "image_bad_size" };
}
