import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import type { Placement, RoomLayout } from "./layout";

/** The computed layout of a room with no saved one (D59): seats in input order on a 3 x 2 tile pitch. */
export function defaultLayout(seats: readonly { id: string; code: string }[]): RoomLayout {
  const list = seats.slice(0, LAYOUT_LIMITS.seats);
  const n = list.length;
  const cols = Math.min(21, Math.max(4, Math.ceil(Math.sqrt(n))));
  const rows = Math.max(Math.ceil(n / cols), 1);
  const w = Math.max(12, cols * 3);
  const h = Math.max(8, rows * 2);
  return {
    w,
    h,
    floors: [{ sprite: "floor.wood", x: 0, y: 0, w, h }],
    seats: list.map((s, i): Placement & { code: string } => ({
      id: s.id,
      code: s.code,
      sprite: "desk.single",
      x: 3 * (i % cols),
      y: 2 * Math.floor(i / cols),
      rotation: 0,
    })),
    fixtures: [],
  };
}
