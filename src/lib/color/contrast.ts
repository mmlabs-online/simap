// WCAG 2.x contrast helpers (pure, no dependencies). Used by the token tests (SIM-071).

export type Rgb = readonly [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** True for #rgb and #rrggbb (no alpha channel). */
export function isOpaque(hex: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim());
}

/** Parses #rgb, #rrggbb or #rrggbbaa; the alpha channel is dropped. */
export function parseHex(hex: string): Rgb {
  const m = HEX.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Same as CSS `color-mix(in srgb, fg pct%, bg)`, rounded per channel. `pct` is 0..1. */
export function mixSrgb(fg: string, bg: string, pct: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  return toHex(f.map((v, i) => Math.round(v * pct + b[i] * (1 - pct))) as unknown as Rgb);
}
