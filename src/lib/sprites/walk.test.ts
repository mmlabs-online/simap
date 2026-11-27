import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SeatPresence } from "@/lib/presence/seat-presence";
import { avatarFrames, avatarView, avatarWalkFrames } from "./avatar";
import type { RoomLayout, Rotation, SeatView } from "./layout";
import { buildDrawList } from "./placement";
import { resolveLook } from "./pixel-look";
import type { SpriteManifest } from "./types";
import {
  diffPresence,
  drawPresence,
  FADE_MS,
  hiddenSeats,
  isSkipEvent,
  MAX_WALK_MS,
  MAX_WALKERS,
  NO_WALKS,
  presenceStep,
  skipAll,
  startWalks,
  STEP_MS,
  walkerOps,
  walkFrame,
  type Intent,
  type WalkState,
} from "./walk";
import { walkGrid } from "./walk-path";
import { registryFootprints } from "@/lib/validate/layout";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

const view = (seed: string | null): SeatView => ({
  state: seed ? "occupied" : "empty",
  avatarSeed: seed,
  name: seed,
  look: null,
});
const views = (m: Record<string, string | null>): Record<string, SeatView> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, view(v)]));
type P = Record<string, SeatPresence>;

const desk = (id: string, x: number, y: number, rotation: Rotation = 0) => ({
  id,
  code: id,
  sprite: "desk.single",
  x,
  y,
  rotation,
});
const door = { id: "d", sprite: "door", x: 0, y: 0, rotation: 0 as Rotation };
const layout = (over: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 7,
  h: 5,
  floors: [],
  seats: [desk("a", 4, 1), desk("b", 1, 3)],
  fixtures: [door],
  ...over,
});
const gridOf = (l: RoomLayout) => walkGrid(l, registryFootprints);
const plant = (id: string, x: number, y: number) => ({
  id,
  sprite: "plant.large",
  x,
  y,
  rotation: 0 as Rotation,
});

const V = views({ a: "m1", b: "m2" });
const who = (seed: string) => ({ seed, look: null });
const T0 = 1000;
const run = (intents: Intent[], l = layout(), reduced = false, state: WalkState = NO_WALKS) =>
  startWalks(state, intents, gridOf(l), T0, { reduced });

describe("presenceStep", () => {
  it("the first answer is the baseline; an unknown answer keeps it; a room change resets it", () => {
    const first = presenceStep(null, { roomId: "r1", presence: { a: "away" } as P, views: V });
    expect(first.intents).toEqual([]);
    expect(first.baseline?.presence).toEqual({ a: "away" });
    const kept = presenceStep(first.baseline, { roomId: "r1", presence: undefined, views: V });
    expect(kept).toEqual({ baseline: first.baseline, intents: [] });
    const other = presenceStep(first.baseline, {
      roomId: "r2",
      presence: { a: "present" } as P,
      views: V,
    });
    expect(other.intents).toEqual([]);
    expect(other.baseline?.roomId).toBe("r2");
    expect(
      presenceStep(first.baseline, { roomId: "r2", presence: undefined, views: V }).baseline,
    ).toBeNull();
  });

  it("a member already present in the first answer does not walk in", () => {
    const first = presenceStep(null, { roomId: "r1", presence: { a: "present" } as P, views: V });
    expect(first.intents).toEqual([]);
    const same = presenceStep(first.baseline, {
      roomId: "r1",
      presence: { a: "present" } as P,
      views: V,
    });
    expect(same.intents).toEqual([]);
  });
});

describe("diffPresence", () => {
  const diff = (a: P, b: P, va = V, vb = V) =>
    diffPresence({ presence: a, views: va }, { presence: b, views: vb });

  it("away to present is an in, present to away an out", () => {
    expect(diff({ a: "away" }, { a: "present" })).toEqual([
      { kind: "in", seat: "a", who: who("m1") },
    ]);
    expect(diff({ a: "present" }, { a: "away" })).toEqual([
      { kind: "out", seat: "a", who: who("m1") },
    ]);
  });

  it("a seat released while present is an out with the look of the previous views", () => {
    const prev = { a: { ...view("m1"), look: { skin: 1, hair: 2, style: 3 as const, shirt: 4 } } };
    const out = diff({ a: "present" }, {}, prev, {});
    expect(out).toEqual([{ kind: "out", seat: "a", who: { seed: "m1", look: prev.a.look } }]);
  });

  it("the same member out of one seat and into another is one move", () => {
    const next = views({ a: null, b: "m1" });
    expect(diff({ a: "present", b: "away" }, { b: "present" }, V, next)).toEqual([
      { kind: "move", from: "a", to: "b", who: who("m1") },
    ]);
  });

  it("a new occupant on one seat is an out and an in", () => {
    const next = views({ a: "m3", b: "m2" });
    expect(diff({ a: "present" }, { a: "present" }, V, next)).toEqual([
      { kind: "out", seat: "a", who: who("m1") },
      { kind: "in", seat: "a", who: who("m3") },
    ]);
  });

  it("the same pairs in new view objects give nothing", () => {
    expect(diff({ a: "present" }, { a: "present" }, V, views({ a: "m1", b: "m2" }))).toEqual([]);
  });
});

describe("startWalks", () => {
  it("in: a walk from the door entry tile to the chair, hiding the seat until it ends", () => {
    const [w] = run([{ kind: "in", seat: "a", who: who("m1") }]).walks;
    expect(w).toMatchObject({ kind: "walk", mode: "in", hideSeat: "a", endView: "back" });
    expect(w.path[0].x).toBeLessThanOrEqual(1);
    expect(w.path.at(-1)).toEqual({ x: 4, y: 2 });
  });

  it("out: the reversed path, from the chair to the door; the seat is not hidden", () => {
    const [w] = run([{ kind: "out", seat: "a", who: who("m1") }]).walks;
    const [inWalk] = run([{ kind: "in", seat: "a", who: who("m1") }]).walks;
    expect(w.path).toEqual([...inWalk.path].reverse());
    expect(w).toMatchObject({ mode: "out", hideSeat: null, startView: "back" });
  });

  it("move: a path from chair to chair, hiding the new seat", () => {
    const [w] = run([{ kind: "move", from: "a", to: "b", who: who("m1") }]).walks;
    expect(w).toMatchObject({ kind: "walk", mode: "move", hideSeat: "b" });
    expect(w.path[0]).toEqual({ x: 4, y: 2 });
    expect(w.path.at(-1)).toEqual({ x: 1, y: 4 });
  });

  it("no door gives a fade at the chair, in and out", () => {
    const noDoor = layout({ fixtures: [] });
    const fade = run([{ kind: "in", seat: "a", who: who("m1") }], noDoor).walks;
    expect(fade).toHaveLength(1);
    expect(fade[0]).toMatchObject({ kind: "fade", mode: "in", hideSeat: "a" });
    const out = run([{ kind: "out", seat: "a", who: who("m1") }], noDoor).walks;
    expect(out[0]).toMatchObject({ kind: "fade", mode: "out", hideSeat: null });
  });

  it("a move with no chair-to-chair path becomes two fades", () => {
    const l = layout({
      seats: [desk("a", 4, 1), desk("b", 1, 2)],
      fixtures: [door, plant("p1", 0, 3), plant("p2", 2, 3), plant("p3", 1, 4)],
    });
    expect(gridOf(l).chairs.b).toMatchObject({ x: 1, y: 3 });
    const walks = run([{ kind: "move", from: "a", to: "b", who: who("m1") }], l).walks;
    expect(walks.map((w) => [w.kind, w.mode, w.hideSeat])).toEqual([
      ["fade", "out", null],
      ["fade", "in", "b"],
    ]);
  });

  it("reduced motion starts nothing and clears running walks", () => {
    const running = run([{ kind: "in", seat: "a", who: who("m1") }]);
    expect(run([{ kind: "out", seat: "b", who: who("m2") }], layout(), true, running)).toEqual(
      NO_WALKS,
    );
  });

  it("a new intent for a member already walking replaces that walk", () => {
    const first = run([{ kind: "in", seat: "a", who: who("m1") }]);
    const next = run([{ kind: "out", seat: "a", who: who("m1") }], layout(), false, first);
    expect(next.walks).toHaveLength(1);
    expect(next.walks[0].mode).toBe("out");
  });

  it("walks past MAX_WALKERS are not animated; a seat without a chair is dropped", () => {
    const intents: Intent[] = Array.from({ length: MAX_WALKERS + 3 }, (_, i) => ({
      kind: "in",
      seat: "a",
      who: who(`m${i}`),
    }));
    expect(run(intents).walks).toHaveLength(MAX_WALKERS);
    expect(run([{ kind: "in", seat: "nope", who: who("m1") }])).toEqual(NO_WALKS);
  });
});

describe("walkFrame", () => {
  const [w] = run([{ kind: "in", seat: "a", who: who("m1") }]).walks;
  const steps = w.path.length - 1;

  it("starts at the entry tile, ends at the chair in the seated view, and clamps late times", () => {
    expect(walkFrame(w, T0)).toMatchObject({ x: w.path[0].x, y: w.path[0].y, done: false, bob: 0 });
    const end = walkFrame(w, T0 + w.duration);
    expect(end).toMatchObject({
      x: 4,
      y: 2,
      view: avatarView("chair.office.n"),
      done: true,
      bob: 0,
    });
    expect(walkFrame(w, T0 + 10 * w.duration)).toEqual(end);
    expect(walkFrame(w, T0 - 500)).toEqual(walkFrame(w, T0));
  });

  it("moves along the path, 250 ms per step, capped at 3 s", () => {
    expect(w.duration).toBe(Math.min(MAX_WALK_MS, STEP_MS * steps));
    const mid = walkFrame(w, T0 + STEP_MS / 2);
    const [a, b] = w.path;
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
    const long = layout({ w: 30, h: 30, seats: [desk("a", 28, 28)] });
    const [lw] = run([{ kind: "in", seat: "a", who: who("m1") }], long).walks;
    expect(lw.path.length - 1).toBeGreaterThan(MAX_WALK_MS / STEP_MS);
    expect(lw.duration).toBe(MAX_WALK_MS);
  });

  it("faces back when moving north, else front; bobs one pixel on alternate half steps", () => {
    const up = {
      ...w,
      path: [
        { x: 1, y: 3 },
        { x: 1, y: 2 },
      ],
      startView: null,
      endView: null,
      duration: 250,
    };
    expect(walkFrame(up, T0 + 100).view).toBe("back");
    const down = {
      ...up,
      path: [
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ],
    };
    expect(walkFrame(down, T0 + 100).view).toBe("front");
    expect(walkFrame(down, T0 + 50).bob).toBe(0);
    expect(walkFrame(down, T0 + 150).bob).toBe(1);
  });

  it("walk pose: dir from the segment (n/e/s/w), step alternates, seated pose at start/end and in fades", () => {
    const path = [
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ];
    const base = { ...w, path, startView: null, endView: null, duration: 1000 };
    // Segment i covers t in [250 i, 250 (i + 1)); sample its first half and its second half.
    const dirs = ["n", "e", "s", "w"];
    dirs.forEach((dir, i) => {
      expect(walkFrame(base, T0 + 250 * i + 50).walk).toEqual({ dir, step: 0 });
      expect(walkFrame(base, T0 + 250 * i + 150).walk).toEqual({ dir, step: 1 });
    });
    const seated = { ...base, startView: "front" as const, endView: "back" as const };
    expect(walkFrame(seated, T0).walk).toBeNull();
    expect(walkFrame(seated, T0).view).toBe("front");
    expect(walkFrame(seated, T0 + 1000).walk).toBeNull();
    expect(walkFrame(seated, T0 + 1000).view).toBe("back");
    expect(walkFrame(seated, T0 + 500).walk).not.toBeNull();
    const noDoor = layout({ fixtures: [] });
    const [fin] = run([{ kind: "in", seat: "a", who: who("m1") }], noDoor).walks;
    expect(walkFrame(fin, T0 + 100).walk).toBeNull();
  });

  it("fades in from 0 to 1 and out from 1 to 0 over FADE_MS", () => {
    const noDoor = layout({ fixtures: [] });
    const [fin] = run([{ kind: "in", seat: "a", who: who("m1") }], noDoor).walks;
    const [fout] = run([{ kind: "out", seat: "a", who: who("m1") }], noDoor).walks;
    expect(fin.duration).toBe(FADE_MS);
    expect(walkFrame(fin, T0).alpha).toBe(0);
    expect(walkFrame(fin, T0 + FADE_MS / 2).alpha).toBeCloseTo(0.5);
    expect(walkFrame(fin, T0 + FADE_MS)).toMatchObject({ alpha: 1, done: true, x: 4, y: 2 });
    expect(walkFrame(fout, T0).alpha).toBe(1);
    expect(walkFrame(fout, T0 + FADE_MS)).toMatchObject({ alpha: 0, done: true });
  });
});

describe("walkerOps", () => {
  it("at the chair with the seated view equals the avatar ops buildDrawList emits for that seat", () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const l: RoomLayout = {
        w: 8,
        h: 8,
        floors: [],
        seats: [desk("a", 3, 3, rotation)],
        fixtures: [],
      };
      const seatViews = {
        a: { ...view("m1"), look: { skin: 2, hair: 1, style: 2 as const, shirt: 3 } },
      };
      const drawn = buildDrawList(l, seatViews, manifest).ops.filter(
        (o) => o.type === "frame" && o.layer === "avatar",
      );
      const chair = gridOf(l).chairs.a;
      const ops = walkerOps(
        manifest,
        { seed: "m1", look: seatViews.a.look },
        avatarView(chair.key),
        chair.x,
        chair.y,
      );
      expect(drawn).toHaveLength(3);
      expect(ops).toEqual(drawn);
    }
  });

  it("uses only avatar frame keys and lifts the character by the bob", () => {
    const keys = avatarFrames(resolveLook(null, "m1"), "front").map((f) => f.key);
    const ops = walkerOps(manifest, who("m1"), "front", 2.25, 1, 1);
    expect(ops.map((o) => o.key)).toEqual(keys);
    for (const o of ops) expect(o.key).toMatch(/^avatar\.(body|shirt|hair\.\d)\.(front|back)$/);
    const still = walkerOps(manifest, who("m1"), "front", 2.25, 1, 0);
    expect(ops[0].y).toBe(still[0].y - 1);
    expect(Number.isInteger(ops[0].x) && Number.isInteger(ops[0].y)).toBe(true);
  });
  it("walkerOps draws the walk keys for the pose and falls back per layer to the seated key when the manifest lacks one", () => {
    const look = resolveLook(null, "m1");
    const pose = { dir: "e" as const, step: 0 };
    const ops = walkerOps(manifest, who("m1"), "front", 2, 1, 0, pose);
    expect(ops.map((o) => o.key)).toEqual(avatarWalkFrames(look, pose).map((f) => f.key));
    const missing = structuredClone(manifest);
    delete missing.frames["avatar.shirt.walk.e.0"];
    const fb = walkerOps(missing, who("m1"), "front", 2, 1, 0, pose);
    const seated = avatarFrames(look, "front");
    expect(fb.map((o) => o.key)).toEqual([
      avatarWalkFrames(look, pose)[0].key,
      seated[1].key,
      avatarWalkFrames(look, pose)[2].key,
    ]);
  });
});

describe("hidden seats, skip", () => {
  it("hiddenSeats lists the destination of in and move walks; drawPresence marks them away", () => {
    const state = run([
      { kind: "in", seat: "a", who: who("m1") },
      { kind: "out", seat: "b", who: who("m2") },
    ]);
    const hidden = hiddenSeats(state);
    expect([...hidden]).toEqual(["a"]);
    const presence: P = { a: "present", b: "present" };
    expect(drawPresence(presence, hidden)).toEqual({ a: "away", b: "present" });
    expect(drawPresence(presence, new Set())).toBe(presence);
    expect(drawPresence(undefined, hidden)).toBeUndefined();
  });

  it("skipAll empties the walks", () => {
    const state = run([{ kind: "in", seat: "a", who: who("m1") }]);
    expect(skipAll(state).walks).toEqual([]);
    expect(hiddenSeats(skipAll(state)).size).toBe(0);
  });

  it("a click or any key skips; a modifier alone does not", () => {
    expect(isSkipEvent({ type: "pointerdown" })).toBe(true);
    for (const key of ["a", "Tab", "Escape", " ", "Enter"]) {
      expect(isSkipEvent({ type: "keydown", key })).toBe(true);
    }
    for (const key of ["Shift", "Control", "Alt", "Meta"]) {
      expect(isSkipEvent({ type: "keydown", key })).toBe(false);
    }
    expect(isSkipEvent({ type: "keyup", key: "a" })).toBe(false);
  });
});

describe("presenceStep layout change", () => {
  it("presence arriving before the new room's layout does not walk anyone in", () => {
    const l1 = layout();
    const l2 = layout();
    const first = presenceStep(null, {
      roomId: "r1",
      layout: l1,
      presence: { a: "away" } as P,
      views: V,
    });
    // room switch: new presence answer while the old layout is still current
    const mid = presenceStep(first.baseline, {
      roomId: "r2",
      layout: l1,
      presence: { a: "present" } as P,
      views: V,
    });
    expect(mid.intents).toEqual([]);
    // the new layout arrives with the same answer
    const done = presenceStep(mid.baseline, {
      roomId: "r2",
      layout: l2,
      presence: { a: "present" } as P,
      views: V,
    });
    expect(done.intents).toEqual([]);
    expect(done.baseline?.layout).toBe(l2);
    const next = presenceStep(done.baseline, {
      roomId: "r2",
      layout: l2,
      presence: { a: "away" } as P,
      views: V,
    });
    expect(next.intents).toHaveLength(1);
  });

  it("the same-room layout object keeps the baseline", () => {
    const l = layout();
    const first = presenceStep(null, {
      roomId: "r1",
      layout: l,
      presence: { a: "away" } as P,
      views: V,
    });
    const next = presenceStep(first.baseline, {
      roomId: "r1",
      layout: l,
      presence: { a: "present" } as P,
      views: V,
    });
    expect(next.intents).toHaveLength(1);
  });
});

describe("finished walk-out", () => {
  it("is invisible once done", () => {
    const [w] = run([{ kind: "out", seat: "a", who: who("m1") }]).walks;
    expect(w.kind).toBe("walk");
    expect(walkFrame(w, T0).alpha).toBe(1);
    expect(walkFrame(w, T0 + w.duration)).toMatchObject({ done: true, alpha: 0 });
  });
});
