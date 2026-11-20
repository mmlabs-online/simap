// Pure RGBA helpers for the sprite packer. Image = { w, h, data: Uint8Array } (RGBA8).

/** @typedef {{w:number,h:number,data:Uint8Array}} Img */

/** @param {string} hex "#rrggbb" @returns {[number,number,number,number]} */
export function rgba(hex) {
  const s = hex.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
    255,
  ];
}

/** @param {number} w @param {number} h @returns {Img} */
export function create(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

/** @param {Img} img @param {number} x @param {number} y @param {number} w @param {number} h @returns {Img} */
export function crop(img, x, y, w, h) {
  const out = create(w, h);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= img.h) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= img.w) continue;
      const s = (sy * img.w + sx) * 4;
      out.data.set(img.data.subarray(s, s + 4), (j * w + i) * 4);
    }
  }
  return out;
}

/** @param {Img} img @param {number} n @returns {Img} */
export function scaleNearest(img, n) {
  const out = create(img.w * n, img.h * n);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const s = (Math.floor(y / n) * img.w + Math.floor(x / n)) * 4;
      out.data.set(img.data.subarray(s, s + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

/** Copies src onto dst at (dx, dy), clipped; transparent source pixels are skipped. @param {Img} dst @param {Img} src @param {number} dx @param {number} dy */
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      if (src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.w + tx) * 4);
    }
  }
}

/** @param {Img} img @param {number} x @param {number} y @param {number} w @param {number} h @param {string} hex */
export function fillRect(img, x, y, w, h, hex) {
  const c = rgba(hex);
  for (let j = Math.max(0, y); j < Math.min(img.h, y + h); j++) {
    for (let i = Math.max(0, x); i < Math.min(img.w, x + w); i++) {
      img.data.set(c, (j * img.w + i) * 4);
    }
  }
}

/** Draws a 1 px ring (4-neighbourhood) on transparent pixels next to the silhouette. @param {Img} img @param {string} hex */
export function outline(img, hex) {
  const c = rgba(hex);
  const solid = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] !== 0;
  const ring = [];
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        ring.push((y * img.w + x) * 4);
      }
    }
  }
  for (const o of ring) img.data.set(c, o);
}
