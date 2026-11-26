import type { Rect } from "./placement";

/** Always-visible name tags of the presence view (D80): positions in overlay pixels, no overlap. Pure, no text measuring. */
export const TAG_H = 22;
export const CHAR_W = 7;
/** Padding, marker and gap inside a tag. */
export const TAG_PAD = 34;
export const TAG_MAX = 160;
export const TAG_MIN = 48;
export const GAP = 2;
/** The marker-only fallback of a tag that finds no room. */
export const DOT = 10;

export type TagSeat = { id: string; left: number; top: number; w: number; h: number; text: string };
export type PlacedTag = {
  id: string;
  kind: "tag" | "dot";
  left: number;
  top: number;
  width: number;
  truncated: boolean;
};

/** Estimated width of a tag: code points of the NFC text, capped at `TAG_MAX` (then the text truncates). */
export function tagWidth(text: string): { width: number; truncated: boolean } {
  const raw = [...text.normalize("NFC")].length * CHAR_W + TAG_PAD;
  return { width: Math.min(TAG_MAX, raw), truncated: raw > TAG_MAX };
}

const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** The open tag button of a desk (D77): centred on the desk, clamped inside the area. */
export function openTagRect(
  seat: Pick<TagSeat, "left" | "top" | "w" | "h">,
  area: { w: number; h: number },
  text: string,
): Rect {
  const w = tagWidth(text).width;
  return {
    x: clamp(Math.round(seat.left + seat.w / 2 - w / 2), 0, Math.max(0, area.w - w)),
    y: clamp(Math.round(seat.top + seat.h / 2 - TAG_H / 2), 0, Math.max(0, area.h - TAG_H)),
    w,
    h: TAG_H,
  };
}

/**
 * Places one tag per seat, in the given (reading) order. Candidates: above or below the seat, centred, then aligned
 * to its left and right edge, then up to two rows further out. The first that hits no placed tag and no obstacle wins.
 * Else the tag shrinks to the seat width (truncated); else it becomes a dot inside the seat rect.
 */
export function layoutTags({
  seats,
  area,
  obstacles = [],
}: {
  seats: readonly TagSeat[];
  area: { w: number; h: number };
  obstacles?: readonly Rect[];
}): PlacedTag[] {
  const taken: Rect[] = [...obstacles];
  const rect = (x: number, y: number, w: number): Rect => ({
    x: clamp(Math.round(x), 0, Math.max(0, area.w - w)),
    y: clamp(Math.round(y), 0, Math.max(0, area.h - TAG_H)),
    w,
    h: TAG_H,
  });
  const free = (r: Rect) => !taken.some((t) => hit(r, t));

  const find = (s: TagSeat, w: number): Rect | null => {
    const first = s.top < 2 * TAG_H ? 1 : -1;
    const step = TAG_H + GAP;
    const base = (side: number) => (side < 0 ? s.top - TAG_H - GAP : s.top + s.h + GAP);
    const xs = [s.left + s.w / 2 - w / 2, s.left, s.left + s.w - w];
    for (const row of [0, 1, 2]) {
      for (const side of [first, -first]) {
        const y = base(side) + side * row * step;
        for (const x of xs) {
          const r = rect(x, y, w);
          if (free(r)) return r;
        }
      }
    }
    return null;
  };

  return seats.map((s) => {
    const full = tagWidth(s.text);
    let r = find(s, full.width);
    let truncated = full.truncated;
    if (!r && full.width > Math.max(TAG_MIN, s.w)) {
      r = find(s, Math.max(TAG_MIN, s.w));
      truncated = true;
    }
    if (!r) {
      return {
        id: s.id,
        kind: "dot",
        left: Math.round(s.left + (s.w - DOT) / 2),
        top: Math.round(s.top),
        width: DOT,
        truncated: false,
      };
    }
    taken.push(r);
    return { id: s.id, kind: "tag", left: r.x, top: r.y, width: r.w, truncated };
  });
}
