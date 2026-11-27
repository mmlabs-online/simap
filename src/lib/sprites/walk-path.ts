import { footprintAt, type FootprintLookup } from "@/lib/validate/layout";
import type { RoomLayout, Rotation } from "./layout";
import { chairFor, resolveFrameKey, ROTATION_TO_DIR } from "./placement";
import { REGISTRY } from "./registry";

export type Tile = { x: number; y: number };

/** The tile grid a character walks on (PRE-07): blocked tiles follow the LAY-01 rules, chairs are the goals. */
export type WalkGrid = {
  w: number;
  h: number;
  /** One byte per tile, row-major; 1 = a blocking item or a door. */
  blocked: Uint8Array;
  /** Free in-room tiles 4-adjacent to a door, in row-major order. */
  entries: Tile[];
  /** Per seat id: the chair tile and its frame key (for the seated view). */
  chairs: Record<string, Tile & { key: string }>;
};

export type DoorPath =
  | { ok: true; path: Tile[] }
  | { ok: false; reason: "no_door" | "unreachable" | "no_chair" };

/** Neighbour order is fixed (north, west, east, south) so a path never changes between renders. */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

const inRoom = (grid: { w: number; h: number }, x: number, y: number) =>
  x >= 0 && y >= 0 && x < grid.w && y < grid.h;

/**
 * Blocked tiles, door entry tiles and chair tiles of a layout. Sizes come from `lookup` (the org catalog first, like
 * the validator); blocking and chair direction come from the registry. Items without a frame are skipped.
 */
export function walkGrid(layout: RoomLayout, lookup: FootprintLookup): WalkGrid {
  const { w, h } = layout;
  const blocked = new Uint8Array(w * h);
  const chairs: WalkGrid["chairs"] = {};
  const doorTiles: Tile[] = [];

  const fill = (x: number, y: number, fw: number, fd: number, into?: Tile[]) => {
    for (let dy = 0; dy < fd; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        if (!inRoom({ w, h }, x + dx, y + dy)) continue;
        blocked[(y + dy) * w + x + dx] = 1;
        into?.push({ x: x + dx, y: y + dy });
      }
    }
  };

  for (const fx of layout.fixtures) {
    const key = resolveFrameKey(fx.sprite, fx.rotation);
    const fp = footprintAt(fx.sprite, fx.rotation, lookup);
    if (key === null || fp === null) continue;
    const isDoor = fx.sprite === "door";
    if (REGISTRY[key].blocks || isDoor)
      fill(fx.x, fx.y, fp[0], fp[1], isDoor ? doorTiles : undefined);
  }
  for (const seat of layout.seats) {
    const key = resolveFrameKey(seat.sprite, seat.rotation);
    const fp = footprintAt(seat.sprite, seat.rotation, lookup);
    if (key === null || fp === null) continue;
    if (REGISTRY[key].blocks) fill(seat.x, seat.y, fp[0], fp[1]);
    const dir = REGISTRY[key].dir ?? ROTATION_TO_DIR[seat.rotation as Rotation];
    const chair = chairFor(seat, fp, dir);
    if (inRoom({ w, h }, chair.x, chair.y)) chairs[seat.id] = chair;
  }

  const seen = new Set<number>();
  for (const d of doorTiles) {
    for (const [dx, dy] of STEPS) {
      const x = d.x + dx;
      const y = d.y + dy;
      if (inRoom({ w, h }, x, y) && !blocked[y * w + x]) seen.add(y * w + x);
    }
  }
  const entries = [...seen].sort((a, b) => a - b).map((i) => ({ x: i % w, y: Math.floor(i / w) }));
  return { w, h, blocked, entries, chairs };
}

/** Shortest 4-neighbour path from the nearest start to the goal (both included), or null. The goal is always allowed. */
export function findPath(
  grid: Pick<WalkGrid, "w" | "h" | "blocked">,
  starts: readonly Tile[],
  goal: Tile,
): Tile[] | null {
  if (!inRoom(grid, goal.x, goal.y)) return null;
  const idx = (t: Tile) => t.y * grid.w + t.x;
  const from = new Int32Array(grid.w * grid.h).fill(-2);
  const queue: number[] = [];
  for (const s of starts) {
    if (!inRoom(grid, s.x, s.y) || from[idx(s)] !== -2) continue;
    from[idx(s)] = -1;
    queue.push(idx(s));
  }
  const target = idx(goal);
  for (let head = 0; head < queue.length && from[target] === -2; head++) {
    const cur = queue[head];
    const cx = cur % grid.w;
    const cy = Math.floor(cur / grid.w);
    for (const [dx, dy] of STEPS) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inRoom(grid, x, y)) continue;
      const next = y * grid.w + x;
      if (from[next] !== -2 || (grid.blocked[next] && next !== target)) continue;
      from[next] = cur;
      queue.push(next);
    }
  }
  if (from[target] === -2) return null;
  const path: Tile[] = [];
  for (let i = target; i !== -1; i = from[i])
    path.push({ x: i % grid.w, y: Math.floor(i / grid.w) });
  return path.reverse();
}

/** The walk-in path of a seat: from the nearest door entry tile to its chair. */
export function pathFromDoor(grid: WalkGrid, seatId: string): DoorPath {
  const chair = grid.chairs[seatId];
  if (!chair) return { ok: false, reason: "no_chair" };
  if (grid.entries.length === 0) return { ok: false, reason: "no_door" };
  const path = findPath(grid, grid.entries, chair);
  return path ? { ok: true, path } : { ok: false, reason: "unreachable" };
}
