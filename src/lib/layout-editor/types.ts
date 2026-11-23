import type { FloorZone, Rotation } from "@/lib/sprites/layout";
import type { LayoutRuleCode } from "@/lib/validate/layout";

/** One item on the editor grid. `seatId` is null for a desk that has no seat record yet (created on save). */
export type EditorItem = {
  key: string;
  kind: "seat" | "fixture";
  sprite: string;
  x: number;
  y: number;
  rotation: Rotation;
  seatId: string | null;
  code: string | null;
};

export type SeatRef = { id: string; code: string };

/** Immutable editor state; every operation returns a new draft. */
export type Draft = {
  w: number;
  h: number;
  floors: FloorZone[];
  items: EditorItem[];
  tray: SeatRef[];
  removed: SeatRef[];
  nextKey: number;
};

export type OpResult = { ok: true; draft: Draft } | { ok: false; code: LayoutRuleCode };
