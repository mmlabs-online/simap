import type { DrawOp, IdleSeat } from "./placement";

type FrameOp = Extract<DrawOp, { type: "frame" }>;

/** The typing idle (PRE-06) steps every 500 ms: about 2 frames per second. */
export const IDLE_MS = 500;

/** How many pixels the seated character is lifted at time `now` (ms). */
export function idleBob(now: number): 0 | 1 {
  return Math.floor(now / IDLE_MS) % 2 === 1 ? 1 : 0;
}

/** The idle seats' avatar ops, each lifted by the bob, as painters for the overlay canvas. */
export function idlePainters(
  idle: readonly IdleSeat[],
  now: number,
): { ops: FrameOp[]; alpha: number }[] {
  const bob = idleBob(now);
  return idle.map((s) => ({ ops: s.ops.map((o) => ({ ...o, y: o.y - bob })), alpha: 1 }));
}

/** Whether the idle animation may run at all: presence view, motion allowed, overlay paint working. */
export function idleOn(o: { presenceView: boolean; reduced: boolean; failed: boolean }): boolean {
  return o.presenceView && !o.reduced && !o.failed;
}

/** The timer runs only while an idle seat is on the map and the tab is visible. */
export function idleTicking(o: { seats: number; hidden: boolean }): boolean {
  return o.seats > 0 && !o.hidden;
}

/** True when there are walks and all of them have ended. */
export function walksDone(frames: readonly { done: boolean }[]): boolean {
  return frames.length > 0 && frames.every((f) => f.done);
}
