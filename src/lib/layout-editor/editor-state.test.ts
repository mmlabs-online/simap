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

  it("delete removes selected fixtures; a selection with a seat is refused with the seat reason and changes nothing", () => {
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
    expect(mixed.notice).toEqual({ kind: "refused", code: "seat_delete" });
    expect(present(mixed).items).toHaveLength(4);
    expect(mixed.history.past).toHaveLength(0);
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

  it("savePayload refuses: unplaced (tray not empty), invalid payload (fixtures over LAYOUT_LIMITS.fixtures → no PUT), pending seat changes (removed or new desks present)", () => {
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

    const s = base();
    const withDraft = (patch: Partial<ReturnType<typeof present>>): EditorState => ({
      ...s,
      history: { ...s.history, present: { ...present(s), ...patch } },
    });
    expect(savePayload(withDraft({ removed: [{ id: S3, code: "x" }] }))).toEqual({
      ok: false,
      reason: "pending_seats",
    });
    const desk = {
      key: "n:9",
      kind: "seat" as const,
      sprite: "desk.single",
      x: 1,
      y: 6,
      rotation: 0 as const,
      seatId: null,
      code: null,
    };
    expect(savePayload(withDraft({ items: [...present(s).items, desk] }))).toEqual({
      ok: false,
      reason: "pending_seats",
    });
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
});
