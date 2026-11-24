import { describe, expect, it } from "vitest";
import type { MapView } from "@/lib/sprites/map-view";
import { LAYOUT_LIMITS, validateLayoutSave } from "@/lib/validate/layout";
import {
  editorFlags,
  editorReducer,
  initEditor,
  savePayload,
  type EditorAction,
  type EditorState,
} from "./editor-state";
import type { Tool } from "./place-tool";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const S3 = "33333333-3333-4333-8333-333333333333";

const view = (over: Partial<MapView> = {}, layout: Partial<MapView["layout"]> = {}): MapView => ({
  layout: {
    w: 12,
    h: 8,
    floors: [],
    seats: [
      { id: S1, code: "Phòng-A-01", sprite: "desk.single", x: 2, y: 2, rotation: 0 },
      { id: S2, code: "Phòng-A-02", sprite: "desk.single", x: 6, y: 2, rotation: 0 },
    ],
    fixtures: [
      { id: "", sprite: "plant.large", x: 9, y: 5, rotation: 0 },
      { id: "", sprite: "door", x: 0, y: 3, rotation: 0 },
    ],
    ...layout,
  },
  seatViews: {},
  unplaced: [],
  truncated: false,
  saved: true,
  version: 7,
  empty: false,
  ...over,
});

const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const sel = (key: string): EditorAction => ({ type: "select", key, additive: false });
const base = () => initEditor(view());
const present = (s: EditorState) => s.history.present;
const seatX = (s: EditorState, id: string) => present(s).items.find((i) => i.seatId === id)?.x;

describe("editor state", () => {
  it("initEditor builds draft and baseline from the view, version as baseVersion, not dirty", () => {
    const s = base();
    expect(s.baseVersion).toBe(7);
    expect(s.baseline).toBe(present(s));
    expect(present(s).items).toHaveLength(4);
    expect(editorFlags(s).dirty).toBe(false);
    expect(s.selection).toEqual([]);
  });

  it("select replaces, additive select toggles, selectNone clears", () => {
    let s = run(base(), sel(`s:${S1}`));
    expect(s.selection).toEqual([`s:${S1}`]);
    s = run(s, { type: "select", key: `s:${S2}`, additive: true });
    expect(s.selection).toEqual([`s:${S1}`, `s:${S2}`]);
    s = run(s, { type: "select", key: `s:${S1}`, additive: true });
    expect(s.selection).toEqual([`s:${S2}`]);
    s = run(s, sel(`s:${S1}`));
    expect(s.selection).toEqual([`s:${S1}`]);
    expect(run(s, sel("nope")).selection).toEqual([`s:${S1}`]);
    expect(run(s, { type: "selectNone" }).selection).toEqual([]);
  });

  it("move by (1,0) commits one step; a refused move (edge, overlap) keeps the draft, adds no step and sets the refusal notice", () => {
    const s = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 });
    expect(s.history.past).toHaveLength(1);
    expect(seatX(s, S1)).toBe(3);
    expect(s.notice).toEqual({ kind: "done", what: "moved" });

    const edge = run(base(), sel(`s:${S1}`), { type: "move", dx: -5, dy: 0 });
    expect(edge.history.past).toHaveLength(0);
    expect(edge.notice).toEqual({ kind: "refused", code: "layout_out_of_bounds" });
    expect(seatX(edge, S1)).toBe(2);

    const overlap = run(base(), sel(`s:${S1}`), { type: "move", dx: 4, dy: 0 });
    expect(overlap.history.past).toHaveLength(0);
    expect(overlap.notice).toEqual({ kind: "refused", code: "layout_overlap" });
  });

  it("move or delete with an empty selection does nothing (no undo step)", () => {
    const s = base();
    expect(run(s, { type: "move", dx: 1, dy: 0 })).toBe(s);
    expect(run(s, { type: "delete" })).toBe(s);
    expect(run(s, { type: "rotate" })).toBe(s);
    expect(run(s, sel(`s:${S1}`), { type: "move", dx: 0, dy: 0 }).history.past).toHaveLength(0);
  });

  it("rotate cycles a seat 0→90; rotate of only non-directional items is refused with layout_bad_rotation", () => {
    const s = run(base(), sel(`s:${S1}`), { type: "rotate" });
    expect(present(s).items.find((i) => i.seatId === S1)?.rotation).toBe(90);
    expect(s.history.past).toHaveLength(1);
    const plant = run(base(), sel("f:0"), { type: "rotate" });
    expect(plant.notice).toEqual({ kind: "refused", code: "layout_bad_rotation" });
    expect(plant.history.past).toHaveLength(0);
  });

  it("delete of an existing seat moves it to removed in one undo step; a new desk is dropped; undo brings the seat back with removed empty", () => {
    const s = run(base(), sel("f:0"), { type: "delete" });
    expect(present(s).items).toHaveLength(3);
    expect(s.selection).toEqual([]);
    expect(s.history.past).toHaveLength(1);
    const mixed = run(
      base(),
      sel("f:0"),
      { type: "select", key: `s:${S1}`, additive: true },
      { type: "delete" },
    );
    expect(present(mixed).items).toHaveLength(2);
    expect(present(mixed).removed).toEqual([{ id: S1, code: "Phòng-A-01" }]);
    expect(mixed.history.past).toHaveLength(1);
    const back = run(mixed, { type: "undo" });
    expect(present(back).items).toHaveLength(4);
    expect(present(back).removed).toEqual([]);
    expect(editorFlags(back).dirty).toBe(false);
    const withNew = run(
      base(),
      { type: "arm", tool: { kind: "desk" } },
      { type: "place", x: 1, y: 6 },
      { type: "disarm" },
      sel("n:2"),
      { type: "delete" },
    );
    expect(present(withNew).removed).toEqual([]);
    expect(present(withNew).items).toHaveLength(4);
  });

  it("undo restores the previous draft and drops selected keys that no longer exist", () => {
    const deleted = run(base(), sel("f:0"), { type: "delete" });
    expect(present(run(deleted, { type: "undo" })).items).toHaveLength(4);
    const moved = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 });
    const undone = run(moved, { type: "undo" });
    expect(undone.selection).toEqual([`s:${S1}`]);
    expect(editorFlags(undone).dirty).toBe(false);
    const forged: EditorState = { ...moved, selection: ["f:99", `s:${S1}`] };
    expect(run(forged, { type: "undo" }).selection).toEqual([`s:${S1}`]);
  });

  it("move and rotate then savePayload carries the new placements and baseVersion, and passes validateLayoutSave", () => {
    const s = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 1 }, { type: "rotate" });
    const p = savePayload(s);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.baseVersion).toBe(7);
    expect(p.value.seats[0]).toEqual({ id: S1, sprite: "desk.single", x: 3, y: 3, rotation: 90 });
    expect(validateLayoutSave(p.value).ok).toBe(true);
    expect(editorFlags(s).canSave).toBe(true);
  });

  it("savePayload refuses: unplaced (tray not empty), invalid payload (fixtures over LAYOUT_LIMITS.fixtures → no PUT)", () => {
    const tray = initEditor(view({ unplaced: [{ id: S3, code: "Phòng-A-03" }] }));
    expect(savePayload(tray)).toEqual({ ok: false, reason: "unplaced" });
    expect(editorFlags(tray).saveBlock).toBe("unplaced");

    const many = Array.from({ length: LAYOUT_LIMITS.fixtures + 1 }, () => ({
      id: "",
      sprite: "plant.large",
      x: 0,
      y: 0,
      rotation: 0 as const,
    }));
    const big = initEditor(view({}, { fixtures: many }));
    const r = savePayload(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
    expect(editorFlags(big).saveBlock).toBe("invalid");
  });

  it("savePayload accepts removed seats and new desks (dry-run ids); a fixture count over the cap still refuses as invalid", () => {
    const s = run(
      base(),
      sel(`s:${S1}`),
      { type: "delete" },
      { type: "arm", tool: { kind: "desk" } },
      { type: "place", x: 1, y: 6 },
    );
    const p = savePayload(s);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.seats.map((x) => x.id)).toHaveLength(2);
    expect(p.value.seats.some((x) => x.id === S1)).toBe(false);
    expect(validateLayoutSave(p.value).ok).toBe(true);
    expect(editorFlags(s).canSave).toBe(true);
    const many = Array.from({ length: LAYOUT_LIMITS.fixtures + 1 }, () => ({
      id: "",
      sprite: "plant.large",
      x: 0,
      y: 0,
      rotation: 0 as const,
    }));
    expect(savePayload(initEditor(view({}, { fixtures: many }))).ok).toBe(false);
  });

  it("saveDone resets baseline, history, selection and version from the response; dirty false", () => {
    const edited = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 });
    const saving = run(edited, { type: "saveStart" });
    expect(saving.save.status).toBe("saving");
    const next = view({ version: 8 });
    next.layout = {
      ...next.layout,
      seats: next.layout.seats.map((s) => (s.id === S1 ? { ...s, x: 3 } : s)),
    };
    const done = run(saving, { type: "saveDone", view: next });
    expect(done.baseVersion).toBe(8);
    expect(done.history.past).toEqual([]);
    expect(done.selection).toEqual([]);
    expect(done.save.status).toBe("idle");
    expect(done.notice).toEqual({ kind: "done", what: "saved" });
    expect(editorFlags(done).dirty).toBe(false);
    expect(editorFlags(done).canUndo).toBe(false);
  });

  it("saveFailed keeps the draft and history and records the code; editing during error is allowed but Save stays off for a conflict", () => {
    const edited = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 });
    const conflict = run(
      edited,
      { type: "saveStart" },
      { type: "saveFailed", code: "layout_stale" },
    );
    expect(conflict.save).toEqual({ status: "error", code: "layout_stale" });
    expect(conflict.history).toBe(edited.history);
    const more = run(conflict, { type: "move", dx: 1, dy: 0 });
    expect(more.history.past).toHaveLength(2);
    expect(more.save.status).toBe("error");
    expect(editorFlags(more).canSave).toBe(false);

    const retry = run(edited, { type: "saveStart" }, { type: "saveFailed", code: "unavailable" });
    expect(editorFlags(retry).canSave).toBe(true);
    expect(run(retry, { type: "move", dx: 1, dy: 0 }).save.status).toBe("idle");
  });

  it("edits are ignored while saving", () => {
    const s = run(base(), sel(`s:${S1}`), { type: "saveStart" });
    expect(run(s, { type: "move", dx: 1, dy: 0 })).toBe(s);
  });

  it("editorFlags: dirty, canUndo, canSave and saveBlock reason for a truncated (read-only) view", () => {
    const s = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 });
    expect(editorFlags(s)).toEqual({ dirty: true, canUndo: true, canSave: true, saveBlock: null });
    expect(editorFlags(base()).canSave).toBe(false);
    const ro = initEditor(view({ truncated: true }));
    expect(editorFlags(ro).saveBlock).toBe("read_only");
    expect(editorFlags(ro).canSave).toBe(false);
    expect(run(ro, sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 }).history.past).toHaveLength(0);
  });

  const S4 = "44444444-4444-4444-8444-444444444444";
  const plant: Tool = { kind: "fixture", sprite: "plant.large" };
  const trayView = () =>
    initEditor(
      view({
        unplaced: [
          { id: S3, code: "Phòng-A-03" },
          { id: S4, code: "Phòng-A-04" },
        ],
      }),
    );
  const arm = (tool: Tool): EditorAction => ({ type: "arm", tool });
  const place = (x: number, y: number): EditorAction => ({ type: "place", x, y });

  it("arm sets the tool and clears the selection; arming the same tool again disarms; disarm clears; arming a tray seat not in the tray does nothing", () => {
    const s = run(base(), sel(`s:${S1}`), arm(plant));
    expect(s.tool).toEqual(plant);
    expect(s.selection).toEqual([]);
    expect(run(s, arm(plant)).tool).toBeNull();
    expect(run(s, { type: "disarm" }).tool).toBeNull();
    const none = run(base(), arm({ kind: "tray", seatId: "nope" }));
    expect(none.tool).toBeNull();
  });

  it("place with a fixture tool commits one step, selects the new f: key, keeps the tool armed, notice placed", () => {
    const s = run(base(), arm(plant), place(4, 5));
    expect(s.history.past).toHaveLength(1);
    expect(s.selection).toEqual(["f:2"]);
    expect(s.tool).toEqual(plant);
    expect(s.notice).toEqual({ kind: "done", what: "placed" });
    expect(present(s).items).toHaveLength(5);
  });

  it("place without a tool, or on a taken tile, adds no step; the refusal sets the notice", () => {
    const b = base();
    expect(run(b, place(4, 5))).toBe(b);
    const s = run(b, arm(plant), place(2, 2));
    expect(s.history.past).toHaveLength(0);
    expect(s.notice).toEqual({ kind: "refused", code: "layout_overlap" });
    expect(s.tool).toEqual(plant);
  });

  it("place at the fixture limit sets the fixture_limit notice and adds no step", () => {
    const fixtures = Array.from({ length: LAYOUT_LIMITS.fixtures }, (_, k) => ({
      id: "",
      sprite: "plant.small",
      x: k % 64,
      y: Math.floor(k / 64),
      rotation: 0 as const,
    }));
    const s = run(
      initEditor(view({}, { w: 64, h: 64, seats: [], fixtures })),
      arm({ kind: "fixture", sprite: "plant.small" }),
      place(63, 63),
    );
    expect(s.notice).toEqual({ kind: "refused", code: "fixture_limit" });
    expect(s.history.past).toHaveLength(0);
  });

  it("a placed fixture is in savePayload and passes validateLayoutSave; saveDone with that view keeps it and is clean", () => {
    const s = run(base(), arm(plant), place(4, 5));
    const p = savePayload(s);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(validateLayoutSave(p.value).ok).toBe(true);
    expect(p.value.fixtures).toContainEqual(
      expect.objectContaining({ sprite: "plant.large", x: 4, y: 5 }),
    );
    const fixtures = [
      ...view().layout.fixtures,
      { id: "", sprite: "plant.large", x: 4, y: 5, rotation: 0 as const },
    ];
    const done = run(s, { type: "saveDone", view: view({ version: 8 }, { fixtures }) });
    expect(present(done).items).toHaveLength(5);
    expect(editorFlags(done).dirty).toBe(false);
    expect(done.tool).toBeNull();
  });

  it("tray tool advances to the next tray seat, then disarms", () => {
    let s = run(trayView(), arm({ kind: "tray", seatId: S3 }), place(4, 5));
    expect(s.tool).toEqual({ kind: "tray", seatId: S4 });
    expect(s.selection).toEqual([`s:${S3}`]);
    s = run(s, place(10, 0));
    expect(s.tool).toBeNull();
    expect(present(s).tray).toEqual([]);
  });

  it("placing the last tray seat empties the tray: canSave true, saveBlock null, savePayload has the seat at its tile", () => {
    const one = initEditor(view({ unplaced: [{ id: S3, code: "Phòng-A-03" }] }));
    expect(editorFlags(one).saveBlock).toBe("unplaced");
    const s = run(one, arm({ kind: "tray", seatId: S3 }), place(4, 5));
    const flags = editorFlags(s);
    expect(flags.canSave).toBe(true);
    expect(flags.saveBlock).toBeNull();
    const p = savePayload(s);
    expect(p.ok && p.value.seats).toContainEqual(expect.objectContaining({ id: S3, x: 4, y: 5 }));
  });

  it("resize to a larger size commits one step, savePayload has the new w/h; the same size is a no-op", () => {
    const b = base();
    expect(run(b, { type: "resize", w: 12, h: 8 })).toBe(b);
    const s = run(b, { type: "resize", w: 20, h: 10 });
    expect(s.history.past).toHaveLength(1);
    expect(s.notice).toEqual({ kind: "done", what: "resized" });
    const p = savePayload(s);
    expect(p.ok && [p.value.w, p.value.h]).toEqual([20, 10]);
  });

  it("resize that cuts off an item is refused as resize_cut and keeps the draft and history", () => {
    const s = run(base(), { type: "resize", w: 8, h: 8 });
    expect(s.notice).toEqual({ kind: "refused", code: "resize_cut" });
    expect(s.history.past).toHaveLength(0);
    expect(present(s).w).toBe(12);
  });

  it("resize out of 1–64 is refused as layout_out_of_bounds", () => {
    for (const [w, h] of [
      [0, 8],
      [65, 8],
      [12, 100],
    ]) {
      const s = run(base(), { type: "resize", w, h });
      expect(s.notice).toEqual({ kind: "refused", code: "layout_out_of_bounds" });
      expect(s.history.past).toHaveLength(0);
    }
  });

  it("place, arm and resize are ignored while saving", () => {
    const s = run(run(base(), arm(plant)), { type: "saveStart" });
    expect(run(s, place(4, 5))).toBe(s);
    expect(run(s, arm({ kind: "fixture", sprite: "door" }))).toBe(s);
    expect(run(s, { type: "resize", w: 20, h: 10 })).toBe(s);
    const ro = initEditor(view({ truncated: true }));
    expect(run(ro, arm(plant))).toBe(ro);
  });

  it("undo of a place and of a resize; a tray tool whose seat is no longer in the tray is cleared", () => {
    const placed = run(base(), arm(plant), place(4, 5), { type: "undo" });
    expect(present(placed).items).toHaveLength(4);
    const resized = run(base(), { type: "resize", w: 20, h: 10 }, { type: "undo" });
    expect(present(resized).w).toBe(12);
    const t = run(trayView(), arm({ kind: "tray", seatId: S3 }), place(4, 5));
    expect(run(t, { type: "undo" }).tool).toEqual({ kind: "tray", seatId: S4 });
    const gone = { ...t, tool: { kind: "tray", seatId: "S9" } as Tool };
    expect(run(gone, { type: "undo" }).tool).toBeNull();
  });

  it("saveDone clears the tool", () => {
    const s = run(base(), arm(plant), { type: "saveStart" }, { type: "saveDone", view: view() });
    expect(s.tool).toBeNull();
  });

  it("selectMany replaces; additive unions without toggling; unknown keys are dropped; an empty non-additive list clears", () => {
    const a = `s:${S1}`;
    const b = `s:${S2}`;
    const s1 = run(base(), { type: "selectMany", keys: [a, "nope"], additive: false });
    expect(s1.selection).toEqual([a]);
    const s2 = run(s1, { type: "selectMany", keys: [a, b], additive: true });
    expect(s2.selection).toEqual([a, b]);
    expect(run(s2, { type: "selectMany", keys: [b], additive: false }).selection).toEqual([b]);
    expect(run(s2, { type: "selectMany", keys: [], additive: false }).selection).toEqual([]);
  });

  const nudge = (dx: number, dy: number): EditorAction => ({ type: "nudge", dx, dy });
  const steps = (s: EditorState) => s.history.past.length;

  it("consecutive nudges with the same selection are one undo step; one undo returns to the state before the run", () => {
    const s0 = run(base(), sel(`s:${S1}`));
    const s = run(s0, nudge(1, 0), nudge(1, 0), nudge(0, 1));
    expect(steps(s)).toBe(1);
    expect(present(s).items.find((i) => i.seatId === S1)).toMatchObject({ x: 4, y: 3 });
    const u = run(s, { type: "undo" });
    expect(present(u)).toBe(present(s0));
  });

  it("a nudge after another action (inspector move, select, selectMany, undo) starts a new undo step", () => {
    const s0 = run(base(), sel(`s:${S1}`), nudge(1, 0));
    expect(steps(run(s0, { type: "move", dx: 0, dy: 1 }, nudge(0, 1)))).toBe(3);
    expect(steps(run(s0, sel(`s:${S1}`), nudge(1, 0)))).toBe(2);
    const many: EditorAction = { type: "selectMany", keys: [`s:${S1}`], additive: false };
    expect(steps(run(s0, many, nudge(0, 1)))).toBe(2);
  });

  it("undo after a run, then a nudge, commits a new step and does not overwrite the restored state", () => {
    const s0 = run(base(), sel(`s:${S1}`));
    const s = run(s0, nudge(1, 0), nudge(1, 0), { type: "undo" }, nudge(0, 1));
    expect(steps(s)).toBe(1);
    expect(seatX(s, S1)).toBe(2);
    expect(present(run(s, { type: "undo" }))).toBe(present(s0));
  });

  it("a refused nudge sets the refusal notice, keeps the draft and does not end the run", () => {
    const s0 = run(base(), sel(`s:${S1}`), nudge(1, 0));
    const refused = run(s0, nudge(-10, 0));
    expect(refused.notice).toEqual({ kind: "refused", code: "layout_out_of_bounds" });
    expect(present(refused)).toBe(present(s0));
    expect(steps(run(refused, nudge(1, 0)))).toBe(1);
  });

  it("nudge is ignored while saving, with an empty selection and for (0,0)", () => {
    const s0 = run(base(), sel(`s:${S1}`));
    expect(run(s0, { type: "saveStart" }, nudge(1, 0))).toEqual(run(s0, { type: "saveStart" }));
    expect(steps(run(base(), nudge(1, 0)))).toBe(0);
    expect(run(s0, nudge(0, 0))).toBe(s0);
  });

  it("place with a desk tool adds an n:<k> desk, selects it, keeps the tool armed; dirty and canSave true", () => {
    const s = run(base(), { type: "arm", tool: { kind: "desk" } }, { type: "place", x: 1, y: 6 });
    expect(s.selection).toEqual(["n:2"]);
    expect(s.tool).toEqual({ kind: "desk" });
    expect(present(s).items.find((i) => i.key === "n:2")).toMatchObject({ seatId: null, y: 6 });
    const f = editorFlags(s);
    expect(f.dirty).toBe(true);
    expect(f.canSave).toBe(true);
  });

  it("saveFailed with progress reset: present and baseline replaced, history cleared, selection kept only for existing keys, tool reconciled; without reset the past stays; without progress only the error is set", () => {
    const edited = run(base(), sel(`s:${S1}`), { type: "move", dx: 1, dy: 0 }, sel(`s:${S2}`));
    const prog = (reset: boolean) => ({
      draft: { ...present(edited), items: present(edited).items.filter((i) => i.seatId !== S1) },
      baseline: { ...edited.baseline, tray: [] },
      reset,
    });
    const detail = {
      stage: "delete" as const,
      deleted: 1,
      created: 0,
      seat: null,
      restored: null,
    };
    const withTool: EditorState = { ...edited, tool: { kind: "tray", seatId: "gone" } };
    const reset = run(withTool, {
      type: "saveFailed",
      code: "unavailable",
      detail,
      progress: prog(true),
    });
    expect(reset.history.past).toEqual([]);
    expect(present(reset).items.some((i) => i.seatId === S1)).toBe(false);
    expect(reset.baseline.tray).toEqual([]);
    expect(reset.selection).toEqual([`s:${S2}`]);
    expect(reset.tool).toBeNull();
    expect(reset.save).toEqual({ status: "error", code: "unavailable", detail });
    const keep = run(edited, {
      type: "saveFailed",
      code: "seat_not_empty",
      progress: prog(false),
    });
    expect(keep.history.past).toHaveLength(edited.history.past.length);
    expect(present(keep).items.some((i) => i.seatId === S1)).toBe(false);
    const none = run(edited, { type: "saveFailed", code: "unavailable", progress: null });
    expect(none.history).toBe(edited.history);
    expect(none.baseline).toBe(edited.baseline);
  });

  it("saveDone after desk add: the desk carries its code from the view, dirty false", () => {
    const s = run(base(), { type: "arm", tool: { kind: "desk" } }, { type: "place", x: 1, y: 6 });
    const NEW = "44444444-4444-4444-8444-444444444444";
    const next = view({ version: 8 });
    next.layout = {
      ...next.layout,
      seats: [
        ...next.layout.seats,
        { id: NEW, code: "Phòng-A-06", sprite: "desk.single", x: 1, y: 6, rotation: 0 },
      ],
    };
    const done = run(s, { type: "saveStart" }, { type: "saveDone", view: next });
    expect(present(done).items.find((i) => i.seatId === NEW)?.code).toBe("Phòng-A-06");
    expect(editorFlags(done).dirty).toBe(false);
  });
});
