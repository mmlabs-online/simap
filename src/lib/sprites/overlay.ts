import type { SeatState } from "./layout";

/** Name-tag dot colour per seat state (style guide section 6). The shape carries the state, not the colour. */
export const STATUS_DOT: Record<SeatState, string> = {
  occupied: "#16a34a",
  empty: "#8a93a3",
  mine: "#14b8a6",
  pending: "#f59e0b",
  cannot: "#ef4444",
};

export type OverlayItem = {
  key: string;
  target: "desk" | "chair";
  /** Tile inside the target footprint, in tiles from its top-left corner. */
  tile: [number, number];
  /** Extra pixel offset after the frame anchor. */
  offset: [number, number];
};

/** Sprite overlays of one seat state. `footprint` is the desk's `[w, d]` in tiles. */
export function overlayFor(state: SeatState, footprint: [number, number]): OverlayItem[] {
  const [w, d] = footprint;
  switch (state) {
    case "pending":
      return [{ key: "state.pending", target: "chair", tile: [0, 0], offset: [0, -24] }];
    case "cannot":
      return [
        {
          key: "state.cannot",
          target: "desk",
          tile: [Math.floor((w - 1) / 2), Math.floor((d - 1) / 2)],
          offset: [0, -8],
        },
      ];
    case "mine": {
      const items: OverlayItem[] = [];
      for (let row = 0; row < d; row++) {
        for (let col = 0; col < w; col++) {
          items.push({ key: "state.mine.tint", target: "desk", tile: [col, row], offset: [0, 0] });
        }
      }
      return items;
    }
    default:
      return [];
  }
}

export type TagPlacement = { side: "above" | "below"; align: "start" | "center" | "end" };

const EDGE_PX = 80;

/** Where a name tag goes: below the seat near the top edge, aligned inward near the left and right edges. */
export function tagPlacement(tileY: number, centerX: number, widthPx: number): TagPlacement {
  const align = centerX < EDGE_PX ? "start" : centerX > widthPx - EDGE_PX ? "end" : "center";
  return { side: tileY < 2 ? "below" : "above", align };
}
