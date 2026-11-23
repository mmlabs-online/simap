import { describe, expect, it } from "vitest";
import type { RoomLayout } from "@/lib/sprites/layout";
import { validateLayoutSave } from "@/lib/validate/layout";
import { deleteItems, draftFromLayout, moveItems, placeItem } from "./draft";
import { commit, startHistory, undo } from "./history";
import {
  assignCreatedSeats,
  buildSavePayload,
  forgetDeletedSeat,
  isDirty,
  planSave,
  restoreRemovedSeat,
} from "./save-plan";
import type { Draft, OpResult } from "./types";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const D = "00000000-0000-4000-8000-00000000000d";

const layout = (p: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 12,
  h: 8,
  floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }],
  seats: [
    { id: A, code: "R-01", sprite: "desk.single", x: 0, y: 0, rotation: 0 },
    { id: B, code: "R-02", sprite: "desk.single", x: 4, y: 0, rotation: 0 },
  ],
  fixtures: [{ id: "", sprite: "plant.large", x: 9, y: 5, rotation: 0 }],
  ...p,
});
const ok = (r: OpResult): Draft => {
  if (!r.ok) throw new Error(`refused: ${r.code}`);
  return r.draft;
};

describe("isDirty", () => {
  it("isDirty false for fresh draft, true after a move, false after undo to the start", () => {
    const d0 = draftFromLayout(layout(), []);
    expect(isDirty(d0, draftFromLayout(layout(), []))).toBe(false);
    let h = startHistory(d0);
    h = commit(h, ok(moveItems(h.present, [`s:${A}`], 0, 2)));
    expect(isDirty(d0, h.present)).toBe(true);
    h = undo(h);
    expect(isDirty(d0, h.present)).toBe(false);
    expect(isDirty(d0, ok(deleteItems(d0, [`s:${A}`])))).toBe(true);
  });
});

describe("planSave", () => {
  it("planSave refuses while seats are unplaced", () => {
    const d = draftFromLayout(layout(), [{ id: C, code: "R-03" }]);
    expect(planSave(d)).toEqual({ ok: false, reason: "unplaced" });
  });

  it("planSave lists deletes of removed existing seats and creates of new desks in add order", () => {
    let d = draftFromLayout(layout(), []);
    d = ok(placeItem(d, "desk.single", 0, 3));
    d = ok(placeItem(d, "plant.small", 8, 0));
    d = ok(placeItem(d, "desk.single", 4, 3));
    d = ok(deleteItems(d, [`s:${B}`]));
    expect(planSave(d)).toEqual({
      ok: true,
      deletes: [{ id: B, code: "R-02" }],
      createKeys: ["n:1", "n:3"],
    });
    expect(planSave(draftFromLayout(layout({ seats: [] }), []))).toEqual({
      ok: true,
      deletes: [],
      createKeys: [],
    });
  });
});

describe("assignCreatedSeats", () => {
  it("assignCreatedSeats maps created seats by ascending seq onto new desks in add order (room code `Phòng-A`)", () => {
    let d = draftFromLayout(layout({ seats: [] }), []);
    d = ok(placeItem(d, "desk.single", 0, 0));
    d = ok(placeItem(d, "desk.single", 4, 0));
    const plan = planSave(d);
    if (!plan.ok) throw new Error("plan");
    const r = assignCreatedSeats(d, plan.createKeys, [
      { id: D, code: "Phòng-A-02", seq: 2 },
      { id: C, code: "Phòng-A-01", seq: 1 },
    ]);
    if (!r.ok) throw new Error("assign");
    expect(
      r.draft.items.filter((i) => i.kind === "seat").map((i) => [i.key, i.seatId, i.code]),
    ).toEqual([
      [`s:${C}`, C, "Phòng-A-01"],
      [`s:${D}`, D, "Phòng-A-02"],
    ]);
  });

  it("assignCreatedSeats refuses a count mismatch", () => {
    const d = ok(placeItem(draftFromLayout(layout({ seats: [] }), []), "desk.single", 0, 0));
    expect(assignCreatedSeats(d, ["n:0"], [])).toEqual({ ok: false, reason: "count_mismatch" });
  });
});

describe("buildSavePayload", () => {
  it("buildSavePayload passes validateLayoutSave with exact keys (no code, no key, fixtures without id)", () => {
    const d = ok(placeItem(draftFromLayout(layout(), []), "plant.small", 8, 0));
    const r = buildSavePayload(d, 7);
    if (!r.ok) throw new Error("payload");
    expect(Object.keys(r.value).sort()).toEqual([
      "baseVersion",
      "fixtures",
      "floors",
      "h",
      "seats",
      "w",
    ]);
    expect(Object.keys(r.value.seats[0]).sort()).toEqual(["id", "rotation", "sprite", "x", "y"]);
    expect(Object.keys(r.value.fixtures[0]).sort()).toEqual(["rotation", "sprite", "x", "y"]);
    expect(r.value.seats.map((s) => s.id)).toEqual([A, B]);
    const v = validateLayoutSave(r.value);
    expect(v.ok).toBe(true);
  });

  it("buildSavePayload refuses while a desk has no seat id or the tray is not empty", () => {
    const withNew = ok(placeItem(draftFromLayout(layout(), []), "desk.single", 0, 3));
    expect(buildSavePayload(withNew, 1)).toEqual({ ok: false, reason: "missing_seat_id" });
    const tray = draftFromLayout(layout(), [{ id: C, code: "R-03" }]);
    expect(buildSavePayload(tray, 1)).toEqual({ ok: false, reason: "unplaced" });
  });
});

describe("refused delete recovery", () => {
  it("restoreRemovedSeat puts a refused delete back at its baseline place, else into the tray", () => {
    const baseline = draftFromLayout(layout(), []);
    const removed = ok(deleteItems(baseline, [`s:${A}`]));
    const back = restoreRemovedSeat(removed, baseline, A);
    expect(back.removed).toEqual([]);
    expect(back.tray).toEqual([]);
    expect(back.items.find((i) => i.seatId === A)).toMatchObject({ x: 0, y: 0, code: "R-01" });
    // the baseline cell is taken meanwhile: the seat goes to the tray
    const taken = ok(placeItem(removed, "plant.large", 0, 0));
    const trayed = restoreRemovedSeat(taken, baseline, A);
    expect(trayed.items.find((i) => i.seatId === A)).toBeUndefined();
    expect(trayed.tray).toEqual([{ id: A, code: "R-01" }]);
    expect(trayed.removed).toEqual([]);
    expect(restoreRemovedSeat(removed, baseline, C)).toBe(removed);
  });

  it("forgetDeletedSeat drops the seat from removed", () => {
    const removed = ok(deleteItems(draftFromLayout(layout(), []), [`s:${A}`, `s:${B}`]));
    expect(forgetDeletedSeat(removed, A).removed).toEqual([{ id: B, code: "R-02" }]);
  });
});
