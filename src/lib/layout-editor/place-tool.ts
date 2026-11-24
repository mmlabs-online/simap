import {
  LAYOUT_LIMITS,
  SEAT_SPRITES,
  footprintOf,
  type LayoutRuleCode,
} from "@/lib/validate/layout";
import { placeFromTray, placeItem } from "./draft";
import type { Point } from "./tiles";
import type { Draft } from "./types";

/** What a map click places: a fixture sprite, a new desk, or one seat from the tray. */
export type Tool =
  | { kind: "fixture"; sprite: string }
  | { kind: "desk" }
  | { kind: "tray"; seatId: string };

export type PlaceResult =
  | { ok: true; draft: Draft; key: string }
  | { ok: false; code: LayoutRuleCode | "fixture_limit" | "seat_limit" };

export function sameTool(a: Tool | null, b: Tool | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "desk") return b.kind === "desk";
  if (a.kind === "fixture") return b.kind === "fixture" && a.sprite === b.sprite;
  return b.kind === "tray" && a.seatId === b.seatId;
}

/** Place the tool's item at a tile, rotation 0. A fixture tool never places a seat sprite. */
export function tryPlace(draft: Draft, tool: Tool, x: number, y: number): PlaceResult {
  if (tool.kind === "tray") {
    const r = placeFromTray(draft, tool.seatId, x, y, 0);
    return r.ok ? { ok: true, draft: r.draft, key: `s:${tool.seatId}` } : r;
  }
  if (tool.kind === "desk") {
    const seats = draft.items.filter((i) => i.kind === "seat").length + draft.tray.length;
    if (seats >= LAYOUT_LIMITS.seats) return { ok: false, code: "seat_limit" };
    const r = placeItem(draft, "desk.single", x, y, 0);
    return r.ok ? { ok: true, draft: r.draft, key: `n:${draft.nextKey}` } : r;
  }
  if (SEAT_SPRITES.includes(tool.sprite)) return { ok: false, code: "layout_unknown_sprite" };
  if (draft.items.filter((i) => i.kind === "fixture").length >= LAYOUT_LIMITS.fixtures) {
    return { ok: false, code: "fixture_limit" };
  }
  const key = `f:${draft.nextKey}`;
  const r = placeItem(draft, tool.sprite, x, y, 0);
  return r.ok ? { ok: true, draft: r.draft, key } : r;
}

/** The ghost under the pointer: tile, footprint size and whether the place would succeed. */
export function placementPreview(
  draft: Draft,
  tool: Tool | null,
  tile: Point | null,
): { x: number; y: number; w: number; h: number; ok: boolean } | null {
  if (!tool || !tile) return null;
  const sprite = tool.kind === "fixture" ? tool.sprite : "desk.single";
  const [w, h] = footprintOf(sprite, 0) ?? [1, 1];
  return { x: tile.x, y: tile.y, w, h, ok: tryPlace(draft, tool, tile.x, tile.y).ok };
}

/** After a place: a fixture or desk tool stays, a tray tool moves to the next tray seat or ends. */
export function nextTool(tool: Tool, draft: Draft): Tool | null {
  if (tool.kind !== "tray") return tool;
  const next = draft.tray[0];
  return next ? { kind: "tray", seatId: next.id } : null;
}

/** Drop a tray tool whose seat is no longer in the tray (after an undo). */
export function reconcileTool(tool: Tool | null, draft: Draft): Tool | null {
  if (tool?.kind === "tray" && !draft.tray.some((t) => t.id === tool.seatId)) return null;
  return tool;
}

/** A whole number from digits only (spaces around are fine), else null. */
export function parseWhole(s: string): number | null {
  return /^\s*\d+\s*$/.test(s) ? Number(s) : null;
}

export function parseRoomSize(
  w: string,
  h: string,
): { ok: true; w: number; h: number } | { ok: false } {
  const pw = parseWhole(w);
  const ph = parseWhole(h);
  const max = LAYOUT_LIMITS.grid;
  if (pw === null || ph === null || pw < 1 || ph < 1 || pw > max || ph > max) return { ok: false };
  return { ok: true, w: pw, h: ph };
}
