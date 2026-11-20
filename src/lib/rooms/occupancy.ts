/** Occupied share of a room as a whole percent, 0-100. A room without seats reads 0. */
export function occupancyPercent(occupied: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((occupied / total) * 100)));
}

/** SVG stroke values for a ring of `radius`: the dash length and the offset that leaves `percent` filled. */
export function ringDash(
  percent: number,
  radius: number,
): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  return { circumference, offset: circumference * (1 - percent / 100) };
}
