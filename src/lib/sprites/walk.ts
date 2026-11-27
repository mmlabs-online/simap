import type { SeatPresence } from "@/lib/presence/seat-presence";
import {
  avatarFrames,
  avatarView,
  avatarWalkFrames,
  walkDir,
  WALK_STEPS,
  type AvatarView,
  type WalkPose,
} from "./avatar";
import type { SeatView } from "./layout";
import { TILE, type DrawOp } from "./placement";
import { resolveLook, type PixelLook } from "./pixel-look";
import type { SpriteManifest } from "./types";
import { findPath, pathFromDoor, type Tile, type WalkGrid } from "./walk-path";

/** Walk and fade timing (PRE-07): 250 ms per tile, a whole walk capped at 3 s, at most 8 walkers at once. */
export const STEP_MS = 250;
export const MAX_WALK_MS = 3000;
export const FADE_MS = 250;
export const MAX_WALKERS = 8;

export type Who = { seed: string; look: PixelLook | null };

/** What changed in a room's presence between two answers. */
export type Intent =
  | { kind: "in"; seat: string; who: Who }
  | { kind: "out"; seat: string; who: Who }
  | { kind: "move"; from: string; to: string; who: Who };

type Views = Readonly<Record<string, SeatView>>;
type Presence = Readonly<Record<string, SeatPresence>>;

/** The last known presence of one room. */
export type Baseline = { roomId: string; layout?: object; presence: Presence; views: Views };

/** One character on the walker layer: a walk along `path`, or a fade at `path[0]`. Times in ms. */
export type ActiveWalk = {
  id: string;
  seed: string;
  kind: "walk" | "fade";
  mode: "in" | "out" | "move";
  who: Who;
  path: Tile[];
  t0: number;
  duration: number;
  /** The pose before the first step and after the last (null: face the walking direction). */
  startView: AvatarView | null;
  endView: AvatarView | null;
  /** The seat drawn as away on the static layer until this walk ends. */
  hideSeat: string | null;
};

export type WalkState = { walks: ActiveWalk[] };

export const NO_WALKS: WalkState = { walks: [] };

const isHere = (presence: Presence, views: Views, seat: string): string | null => {
  const seed = views[seat]?.avatarSeed ?? null;
  return presence[seat] === "present" ? seed : null;
};

function present(presence: Presence, views: Views): Map<string, { seat: string; who: Who }> {
  const out = new Map<string, { seat: string; who: Who }>();
  for (const seat of Object.keys(presence).sort()) {
    const seed = isHere(presence, views, seat);
    if (seed !== null) out.set(`${seat}|${seed}`, { seat, who: { seed, look: views[seat].look } });
  }
  return out;
}

/** Check-ins, check-outs and moves between two presence answers. A member out of one seat and into another is one move. */
export function diffPresence(
  prev: { presence: Presence; views: Views },
  next: { presence: Presence; views: Views },
): Intent[] {
  const before = present(prev.presence, prev.views);
  const after = present(next.presence, next.views);
  const outs = [...before].filter(([k]) => !after.has(k)).map(([, v]) => v);
  const ins = [...after].filter(([k]) => !before.has(k)).map(([, v]) => v);
  const intents: Intent[] = [];
  const moved = new Set<string>();
  for (const o of outs) {
    const to = ins.find((i) => i.who.seed === o.who.seed && !moved.has(i.seat));
    if (to) {
      moved.add(to.seat);
      intents.push({ kind: "move", from: o.seat, to: to.seat, who: to.who });
    } else intents.push({ kind: "out", seat: o.seat, who: o.who });
  }
  for (const i of ins)
    if (!moved.has(i.seat)) intents.push({ kind: "in", seat: i.seat, who: i.who });
  return intents;
}

/**
 * The next baseline and the changes since the previous one. The first answer of a room is only a baseline (a member
 * already checked in is shown seated, PRE-04); an unknown answer (undefined) keeps the baseline; a room or layout change
 * resets it (presence can arrive before the new room's layout).
 */
export function presenceStep(
  baseline: Baseline | null,
  input: { roomId: string; layout?: object; presence: Presence | undefined; views: Views },
): { baseline: Baseline | null; intents: Intent[] } {
  const same =
    baseline !== null && baseline.roomId === input.roomId && baseline.layout === input.layout;
  if (input.presence === undefined) return { baseline: same ? baseline : null, intents: [] };
  const next = {
    roomId: input.roomId,
    layout: input.layout,
    presence: input.presence,
    views: input.views,
  };
  return { baseline: next, intents: same ? diffPresence(baseline, next) : [] };
}

function plan(intent: Intent, grid: WalkGrid, now: number): ActiveWalk[] {
  const chair = (seat: string) => grid.chairs[seat];
  const seated = (seat: string) => avatarView(chair(seat).key);
  const base = { seed: intent.who.seed, who: intent.who, t0: now };
  const walk = (mode: ActiveWalk["mode"], path: Tile[], v: Partial<ActiveWalk>): ActiveWalk => ({
    ...base,
    id: base.seed,
    kind: "walk",
    mode,
    path,
    duration: Math.min(MAX_WALK_MS, STEP_MS * (path.length - 1)),
    startView: null,
    endView: null,
    hideSeat: null,
    ...v,
  });
  const fade = (mode: "in" | "out", seat: string, id: string): ActiveWalk =>
    walk(mode, [chair(seat)], {
      id,
      kind: "fade",
      duration: FADE_MS,
      startView: seated(seat),
      endView: seated(seat),
      hideSeat: mode === "in" ? seat : null,
    });

  if (intent.kind === "move") {
    if (!chair(intent.from) || !chair(intent.to)) return [];
    const path = findPath(grid, [chair(intent.from)], chair(intent.to));
    if (path && path.length > 1) {
      return [
        walk("move", path, {
          startView: seated(intent.from),
          endView: seated(intent.to),
          hideSeat: intent.to,
        }),
      ];
    }
    return [fade("out", intent.from, `${base.seed}#out`), fade("in", intent.to, `${base.seed}#in`)];
  }
  if (!chair(intent.seat)) return [];
  const door = pathFromDoor(grid, intent.seat);
  if (!door.ok || door.path.length < 2) return [fade(intent.kind, intent.seat, base.seed)];
  if (intent.kind === "in") {
    return [walk("in", door.path, { endView: seated(intent.seat), hideSeat: intent.seat })];
  }
  return [walk("out", [...door.path].reverse(), { startView: seated(intent.seat) })];
}

/** Adds the animations of `intents` (replacing a member's running one). Reduced motion shows the end state at once (PRE-07). */
export function startWalks(
  state: WalkState,
  intents: readonly Intent[],
  grid: WalkGrid,
  now: number,
  opts: { reduced: boolean },
): WalkState {
  if (opts.reduced) return NO_WALKS;
  let walks = state.walks;
  for (const intent of intents) {
    const added = plan(intent, grid, now);
    if (added.length === 0) continue;
    const kept = walks.filter((w) => w.seed !== intent.who.seed);
    if (kept.length + added.length > MAX_WALKERS) continue;
    walks = [...kept, ...added];
  }
  return walks === state.walks ? state : { walks };
}

export type WalkFrame = {
  /** Tile units (fractional while walking). */
  x: number;
  y: number;
  view: AvatarView;
  /** The walking pose (direction of travel and step) while walking; null for the seated frames (fades, start, end). */
  walk: WalkPose | null;
  alpha: number;
  /** Pixels to lift the character, 0 or 1 (a step bob). */
  bob: number;
  done: boolean;
};

/** Where one character is at `now`; time past the end is clamped (a hidden tab). */
export function walkFrame(walk: ActiveWalk, now: number): WalkFrame {
  const p = walk.duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - walk.t0) / walk.duration));
  const done = p >= 1;
  if (walk.kind === "fade") {
    const t = walk.path[0];
    return {
      x: t.x,
      y: t.y,
      view: walk.endView ?? "front",
      walk: null,
      alpha: walk.mode === "in" ? p : 1 - p,
      bob: 0,
      done,
    };
  }
  const segments = walk.path.length - 1;
  const pos = p * segments;
  const i = Math.min(Math.floor(pos), segments - 1);
  const a = walk.path[i];
  const b = walk.path[i + 1];
  const f = pos - i;
  const dir = walkDir(a, b);
  let view: AvatarView = dir === "n" ? "back" : "front";
  let pose: WalkPose | null = { dir, step: Math.floor(pos * 2) % WALK_STEPS };
  if (p <= 0 && walk.startView) {
    view = walk.startView;
    pose = null;
  }
  if (done && walk.endView) {
    view = walk.endView;
    pose = null;
  }
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    view,
    walk: pose,
    alpha: walk.mode === "out" && done ? 0 : 1,
    bob: Math.floor(pos * 2) % 2,
    done,
  };
}

/** The avatar frames of a character at a tile position: the ops `buildDrawList` emits for a seated one, at pixel offsets. */
export function walkerOps(
  manifest: SpriteManifest,
  who: Who,
  view: AvatarView,
  x: number,
  y: number,
  bob = 0,
  walk: WalkPose | null = null,
): Extract<DrawOp, { type: "frame" }>[] {
  const ops: Extract<DrawOp, { type: "frame" }>[] = [];
  const look = resolveLook(who.look, who.seed);
  const seated = avatarFrames(look, view);
  const frames = walk ? avatarWalkFrames(look, walk) : seated;
  for (const [i, wanted] of frames.entries()) {
    // A walk key missing from the manifest falls back to the layer's seated frame.
    const f = manifest.frames[wanted.key] ? wanted : seated[i];
    const frame = manifest.frames[f.key];
    if (!frame) continue;
    ops.push({
      type: "frame",
      layer: "avatar",
      key: f.key,
      tint: f.tint,
      x: Math.round(x * TILE) + frame.anchor[0],
      y: Math.round(y * TILE) + frame.anchor[1] - bob,
      w: frame.w,
      h: frame.h,
    });
  }
  return ops;
}

/** Seats whose character is still walking in, so the static layer must not draw it yet. */
export function hiddenSeats(state: WalkState): ReadonlySet<string> {
  return new Set(state.walks.flatMap((w) => (w.hideSeat === null ? [] : [w.hideSeat])));
}

/** The presence the static layer draws: hidden seats count as away. The same object when nothing is hidden. */
export function drawPresence(
  presence: Presence | undefined,
  hidden: ReadonlySet<string>,
): Presence | undefined {
  if (!presence || hidden.size === 0) return presence;
  const out: Record<string, SeatPresence> = { ...presence };
  for (const seat of hidden) if (seat in out) out[seat] = "away";
  return out;
}

/** Everything jumps to its end state. */
export const skipAll = (_state: WalkState): WalkState => NO_WALKS;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

/** A click or any key skips the walks (PRE-07); a modifier alone does not. */
export function isSkipEvent(e: { type: string; key?: string }): boolean {
  if (e.type === "pointerdown") return true;
  return e.type === "keydown" && !MODIFIER_KEYS.has(e.key ?? "");
}
