import { catalogFootprints } from "@/lib/map-items/footprints";
import type { MapItemDto } from "@/lib/map-items/types";
import type { LayoutItem, LayoutSaveValue, SeatDevice } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import {
  LAYOUT_LIMITS,
  registryFootprints,
  validateLayoutSave,
  type FootprintLookup,
  type LayoutRuleCode,
} from "@/lib/validate/layout";
import {
  deleteItems,
  draftFromLayout,
  moveItems,
  resizeRoom,
  rotateItems,
  withoutDeskFixtures,
} from "./draft";
import { canUndo, commit, replacePresent, startHistory, undo, type History } from "./history";
import { nextTool, reconcileTool, sameTool, tryPlace, type Tool } from "./place-tool";
import { buildSavePayload, isDirty, planSave, withPlaceholderSeatIds } from "./save-plan";
import { saveErrorKind } from "./save-errors";
import type { SaveDetail, SaveProgress } from "./save-run";
import type { Draft, OpResult } from "./types";

export type EditorNotice =
  | {
      kind: "refused";
      code: LayoutRuleCode | "fixture_limit" | "seat_limit" | "resize_cut";
    }
  | {
      kind: "done";
      what: "moved" | "rotated" | "deleted" | "undone" | "saved" | "placed" | "resized";
    }
  | { kind: "cleaned"; count: number };

export type EditorState = {
  history: History;
  baseline: Draft;
  baseVersion: number;
  readOnly: boolean;
  /** Devices drawn on the desks; never edited or saved. */
  seatDevices: Record<string, SeatDevice[]>;
  /** Catalog rows the layout references (hidden ones included). */
  layoutItems: LayoutItem[];
  /** The palette's catalog rows (not part of the undo history). */
  palette: MapItemDto[];
  /** Footprints for every check: layout rows first, then the palette, then the registry. */
  footprints: FootprintLookup;
  selection: string[];
  /** Selection signature of the running arrow-key run (one undo step), else null. */
  nudge: string | null;
  tool: Tool | null;
  notice: EditorNotice | null;
  save: { status: "idle" | "saving" } | { status: "error"; code: string; detail?: SaveDetail };
};

export type EditorAction =
  | { type: "select"; key: string; additive: boolean }
  | { type: "selectNone" }
  | { type: "selectMany"; keys: string[]; additive: boolean }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "move"; dx: number; dy: number }
  | { type: "rotate" }
  | { type: "delete" }
  | { type: "arm"; tool: Tool }
  | { type: "disarm" }
  | { type: "place"; x: number; y: number }
  | { type: "resize"; w: number; h: number }
  | { type: "catalog"; items: MapItemDto[] }
  | { type: "undo" }
  | { type: "saveStart" }
  | { type: "saveDone"; view: MapView }
  | { type: "saveFailed"; code: string; detail?: SaveDetail; progress?: SaveProgress | null };

/** Layout rows are listed last so they win over the palette rows for the same key. */
export function editorFootprints(
  layoutItems: readonly LayoutItem[],
  palette: readonly MapItemDto[],
): FootprintLookup {
  return catalogFootprints([...palette, ...layoutItems], registryFootprints);
}

export function initEditor(view: MapView, palette: MapItemDto[] = []): EditorState {
  const footprints = editorFootprints(view.items, palette);
  const loaded = draftFromLayout(view.layout, view.unplaced);
  // Older layouts may hold a fixture on a desk: drop it from the draft (a read-only view keeps what is stored).
  const { draft, dropped } = view.truncated
    ? { draft: loaded, dropped: 0 }
    : withoutDeskFixtures(loaded, footprints);
  return {
    history: startHistory(draft),
    baseline: loaded,
    baseVersion: view.version,
    readOnly: view.truncated,
    seatDevices: view.seatDevices,
    layoutItems: view.items,
    palette,
    footprints,
    selection: [],
    nudge: null,
    tool: null,
    notice: dropped > 0 ? { kind: "cleaned", count: dropped } : null,
    save: { status: "idle" },
  };
}

export type SaveRefusal =
  | { ok: false; reason: "read_only" | "unplaced" }
  | { ok: false; reason: "invalid"; code: string };

/**
 * The pre-Save check: the PUT body built with dry-run ids for new desks, or why the draft cannot be saved.
 * The body is for validation only; the runner builds the real one after the seats are created.
 */
export function savePayload(
  state: EditorState,
): { ok: true; value: LayoutSaveValue } | SaveRefusal {
  if (state.readOnly) return { ok: false, reason: "read_only" };
  const draft = state.history.present;
  const plan = planSave(draft);
  if (!plan.ok) return { ok: false, reason: "unplaced" };
  const built = buildSavePayload(withPlaceholderSeatIds(draft), state.baseVersion);
  if (!built.ok) return { ok: false, reason: "invalid", code: built.reason };
  const checked = validateLayoutSave(built.value, state.footprints);
  if (!checked.ok) return { ok: false, reason: "invalid", code: checked.code };
  return { ok: true, value: built.value };
}

export type SaveBlock = "read_only" | "unplaced" | "invalid" | null;

export function editorFlags(state: EditorState): {
  dirty: boolean;
  canUndo: boolean;
  canSave: boolean;
  saveBlock: SaveBlock;
} {
  const dirty = isDirty(state.baseline, state.history.present);
  const payload = savePayload(state);
  let saveBlock: SaveBlock = null;
  if (!payload.ok) saveBlock = payload.reason;
  const conflict = state.save.status === "error" && saveErrorKind(state.save.code) === "conflict";
  return {
    dirty,
    canUndo: canUndo(state.history),
    canSave: dirty && payload.ok && state.save.status !== "saving" && !conflict,
    saveBlock,
  };
}

function applyEdit(
  state: EditorState,
  result: OpResult,
  what: "moved" | "rotated" | "deleted" | "placed" | "resized",
  selection: string[] = state.selection,
): EditorState {
  if (!result.ok) return { ...state, notice: { kind: "refused", code: result.code } };
  const staleError = state.save.status === "error" && saveErrorKind(state.save.code) !== "conflict";
  return {
    ...state,
    history: commit(state.history, result.draft),
    selection,
    notice: { kind: "done", what },
    save: staleError ? { status: "idle" } : state.save,
  };
}

function reduce(state: EditorState, action: EditorAction): EditorState {
  const present = state.history.present;
  const frozen = state.readOnly || state.save.status === "saving";
  switch (action.type) {
    case "select": {
      if (!present.items.some((i) => i.key === action.key)) return state;
      const has = state.selection.includes(action.key);
      const selection = action.additive
        ? has
          ? state.selection.filter((k) => k !== action.key)
          : [...state.selection, action.key]
        : [action.key];
      return { ...state, selection };
    }
    case "selectNone":
      return state.selection.length === 0 ? state : { ...state, selection: [] };
    case "selectMany": {
      const known = new Set(present.items.map((i) => i.key));
      const keys = action.keys.filter((k) => known.has(k));
      const selection = action.additive
        ? [...state.selection, ...keys.filter((k) => !state.selection.includes(k))]
        : keys;
      return { ...state, selection };
    }
    case "nudge": {
      if (frozen || state.selection.length === 0 || (action.dx === 0 && action.dy === 0)) {
        return state;
      }
      const r = moveItems(present, state.selection, action.dx, action.dy, state.footprints);
      if (!r.ok) return { ...state, notice: { kind: "refused", code: r.code } };
      const sig = state.selection.join(",");
      if (state.nudge !== sig) return { ...applyEdit(state, r, "moved"), nudge: sig };
      return {
        ...state,
        history: replacePresent(state.history, r.draft),
        notice: { kind: "done", what: "moved" },
      };
    }
    case "move":
      if (frozen || state.selection.length === 0 || (action.dx === 0 && action.dy === 0)) {
        return state;
      }
      return applyEdit(
        state,
        moveItems(present, state.selection, action.dx, action.dy, state.footprints),
        "moved",
      );
    case "rotate":
      if (frozen || state.selection.length === 0) return state;
      return applyEdit(state, rotateItems(present, state.selection, state.footprints), "rotated");
    case "delete": {
      if (frozen || state.selection.length === 0) return state;
      return applyEdit(state, deleteItems(present, state.selection), "deleted", []);
    }
    case "arm": {
      if (frozen) return state;
      if (sameTool(state.tool, action.tool)) return { ...state, tool: null };
      if (reconcileTool(action.tool, present) === null) return state;
      return { ...state, tool: action.tool, selection: [] };
    }
    case "disarm":
      return state.tool === null ? state : { ...state, tool: null };
    case "place": {
      if (frozen || !state.tool) return state;
      const r = tryPlace(present, state.tool, action.x, action.y, state.footprints);
      if (!r.ok) return { ...state, notice: { kind: "refused", code: r.code } };
      const next = applyEdit(state, { ok: true, draft: r.draft }, "placed", [r.key]);
      return { ...next, tool: nextTool(state.tool, r.draft) };
    }
    case "resize": {
      if (frozen || (action.w === present.w && action.h === present.h)) return state;
      const r = resizeRoom(present, action.w, action.h, state.footprints);
      if (r.ok) return applyEdit(state, r, "resized");
      const max = LAYOUT_LIMITS.grid;
      const inRange = [action.w, action.h].every((n) => Number.isInteger(n) && n >= 1 && n <= max);
      return { ...state, notice: { kind: "refused", code: inRange ? "resize_cut" : r.code } };
    }
    case "catalog":
      return {
        ...state,
        palette: action.items,
        footprints: editorFootprints(state.layoutItems, action.items),
      };
    case "undo": {
      if (frozen || !canUndo(state.history)) return state;
      const history = undo(state.history);
      const keys = new Set(history.present.items.map((i) => i.key));
      return {
        ...state,
        history,
        selection: state.selection.filter((k) => keys.has(k)),
        tool: reconcileTool(state.tool, history.present),
        notice: { kind: "done", what: "undone" },
      };
    }
    case "saveStart":
      return state.save.status === "saving" ? state : { ...state, save: { status: "saving" } };
    case "saveDone":
      return { ...initEditor(action.view, state.palette), notice: { kind: "done", what: "saved" } };
    case "saveFailed": {
      const save = { status: "error" as const, code: action.code, detail: action.detail };
      const p = action.progress;
      if (!p) return { ...state, save };
      // After a server change an undo would resend a DELETE or create a duplicate: start a new history.
      const keys = new Set(p.draft.items.map((i) => i.key));
      return {
        ...state,
        history: p.reset ? startHistory(p.draft) : replacePresent(state.history, p.draft),
        baseline: p.baseline,
        selection: state.selection.filter((k) => keys.has(k)),
        tool: reconcileTool(state.tool, p.draft),
        save,
      };
    }
  }
}

/** Any action other than `nudge` ends a run of arrow moves (the next nudge starts a new undo step). */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const next = reduce(state, action);
  return action.type !== "nudge" && next.nudge !== null ? { ...next, nudge: null } : next;
}
