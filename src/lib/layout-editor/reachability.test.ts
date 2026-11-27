import { describe, expect, it } from "vitest";
import type { MapView } from "@/lib/sprites/map-view";
import type { Placement, RoomLayout, Rotation } from "@/lib/sprites/layout";
import { registryFootprints } from "@/lib/validate/layout";
import { draftFromLayout } from "./draft";
import { editorFlags, editorReducer, initEditor, savePayload } from "./editor-state";
import { draftWarnings } from "./reachability";
import type { Draft } from "./types";

const room = (over: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 7,
  h: 5,
  floors: [],
  seats: [],
  fixtures: [],
  ...over,
});
const desk = (id: string, x: number, y: number, rotation: Rotation = 0) => ({
  id,
  code: `R-${id}`,
  sprite: "desk.single",
  x,
  y,
  rotation,
});
const fx = (id: string, sprite: string, x: number, y: number): Placement => ({
  id,
  sprite,
  x,
  y,
  rotation: 0,
});
const S = "11111111-1111-4111-8111-111111111111";
const door = fx("door", "door", 0, 0);
const plant = (id: string, x: number, y: number) => fx(id, "plant.large", x, y);
const warn = (d: Draft) => draftWarnings(d, registryFootprints);
const draftOf = (l: RoomLayout) => draftFromLayout(l, []);

describe("draftWarnings", () => {
  it("reachable chair gives no warnings", () => {
    const w = warn(draftOf(room({ seats: [desk("s", 4, 1)], fixtures: [door] })));
    expect(w).toEqual({ noDoor: false, unreachable: [] });
  });

  it("chair walled off is unreachable", () => {
    const walls = [plant("a", 3, 2), plant("b", 5, 2), plant("c", 4, 3)];
    const w = warn(draftOf(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...walls] })));
    expect(w.noDoor).toBe(false);
    expect(w.unreachable).toEqual([{ key: "s:s", code: "R-s" }]);
  });

  it("seats but no door sets noDoor", () => {
    const w = warn(draftOf(room({ seats: [desk("s", 4, 1)] })));
    expect(w).toEqual({ noDoor: true, unreachable: [] });
  });

  it("no seats and no door gives no warning", () => {
    expect(warn(draftOf(room()))).toEqual({ noDoor: false, unreachable: [] });
    expect(warn(draftOf(room({ fixtures: [plant("a", 2, 2)] })))).toEqual({
      noDoor: false,
      unreachable: [],
    });
  });

  it("door fully blocked in counts as no door", () => {
    const plug = [plant("a", 1, 0), plant("b", 1, 1), plant("c", 0, 2)];
    const w = warn(draftOf(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...plug] })));
    expect(w).toEqual({ noDoor: true, unreachable: [] });
  });

  it("unplaced new desk uses key and null code", () => {
    const d = draftOf(
      room({ fixtures: [door, plant("a", 3, 2), plant("b", 5, 2), plant("c", 4, 3)] }),
    );
    const withNew: Draft = {
      ...d,
      items: [
        ...d.items,
        {
          key: "n:1",
          kind: "seat",
          sprite: "desk.single",
          x: 4,
          y: 1,
          rotation: 0,
          seatId: null,
          code: null,
        },
      ],
    };
    expect(warn(withNew).unreachable).toEqual([{ key: "n:1", code: null }]);
  });

  it("chair outside the room is unreachable", () => {
    const w = warn(draftOf(room({ seats: [desk("s", 4, 4)], fixtures: [door] })));
    expect(w.unreachable).toEqual([{ key: "s:s", code: "R-s" }]);
  });

  it("warned draft still saves", () => {
    const view = {
      layout: room({ seats: [desk(S, 4, 1)] }),
      seatViews: {},
      seatDevices: {},
      items: [],
      unplaced: [],
      truncated: false,
      saved: true,
      version: 1,
      empty: false,
    } as MapView;
    const state = editorReducer(
      editorReducer(initEditor(view), { type: "select", key: `s:${S}`, additive: false }),
      { type: "rotate" },
    );
    expect(warn(state.history.present).noDoor).toBe(true);
    expect(editorFlags(state).canSave).toBe(true);
    expect(savePayload(state).ok).toBe(true);
  });
});
