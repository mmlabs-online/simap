import type { LayoutSaveValue } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import { LAYOUT_LIMITS, validateLayoutSave, type LayoutRuleCode } from "@/lib/validate/layout";
import { deleteItems, draftFromLayout, moveItems, resizeRoom, rotateItems } from "./draft";
import { canUndo, commit, replacePresent, startHistory, undo, type History } from "./history";
import { nextTool, reconcileTool, sameTool, tryPlace, type Tool } from "./place-tool";
import { buildSavePayload, isDirty, planSave } from "./save-plan";
import { saveErrorKind } from "./save-errors";
import type { Draft, OpResult } from "./types";

export type EditorNotice =
  | { kind: "refused"; code: LayoutRuleCode | "seat_delete" | "fixture_limit" | "resize_cut" }
  | {
      kind: "done";
      what: "moved" | "rotated" | "deleted" | "undone" | "saved" | "placed" | "resized";
    };

export type EditorState = {
  history: History;
  baseline: Draft;
  baseVersion: number;
  readOnly: boolean;
  selection: string[];
  /** Selection signature of the running arrow-key run (one undo step), else null. */
  nudge: string | null;
  tool: Tool | null;
  notice: EditorNotice | null;
  save: { status: "idle" | "saving" } | { status: "error"; code: string };
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
  | { type: "undo" }
  | { type: "saveStart" }
  | { type: "saveDone"; view: MapView }
  | { type: "saveFailed"; code: string };

export function initEditor(view: MapView): EditorState {
  const draft = draftFromLayout(view.layout, view.unplaced);
  return {
    history: startHistory(draft),
    baseline: draft,
    baseVersion: view.version,
    readOnly: view.truncated,
    selection: [],
    nudge: null,
    tool: null,
    notice: null,
    save: { status: "idle" },
  };
}

export type SaveRefusal =
  | { ok: false; reason: "read_only" | "unplaced" | "pending_seats" }
  | { ok: false; reason: "invalid"; code: string };

/** The PUT body, or why the draft cannot be saved. Nothing is sent when it fails (no PUT). */
export function savePayload(
  state: EditorState,
): { ok: true; value: LayoutSaveValue } | SaveRefusal {
  if (state.readOnly) return { ok: false, reason: "read_only" };
  const draft = state.history.present;
  const plan = planSave(draft);
  if (!plan.ok) return { ok: false, reason: "unplaced" };
  // New and removed seats need the DELETE/POST sequence of SIM-015.8.
  if (plan.deletes.length > 0 || plan.createKeys.length > 0) {
    return { ok: false, reason: "pending_seats" };
  }
  const built = buildSavePayload(draft, state.baseVersion);
  if (!built.ok) return { ok: false, reason: "pending_seats" };
  const checked = validateLayoutSave(built.value);
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
  if (!payload.ok) saveBlock = payload.reason === "pending_seats" ? "invalid" : payload.reason;
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
      const r = moveItems(present, state.selection, action.dx, action.dy);
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
      return applyEdit(state, moveItems(present, state.selection, action.dx, action.dy), "moved");
    case "rotate":
      if (frozen || state.selection.length === 0) return state;
      return applyEdit(state, rotateItems(present, state.selection), "rotated");
    case "delete": {
      if (frozen || state.selection.length === 0) return state;
      const hasSeat = present.items.some(
        (i) => i.kind === "seat" && state.selection.includes(i.key),
      );
      if (hasSeat) return { ...state, notice: { kind: "refused", code: "seat_delete" } };
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
      const r = tryPlace(present, state.tool, action.x, action.y);
      if (!r.ok) return { ...state, notice: { kind: "refused", code: r.code } };
      const next = applyEdit(state, { ok: true, draft: r.draft }, "placed", [r.key]);
      return { ...next, tool: nextTool(state.tool, r.draft) };
    }
    case "resize": {
      if (frozen || (action.w === present.w && action.h === present.h)) return state;
      const r = resizeRoom(present, action.w, action.h);
      if (r.ok) return applyEdit(state, r, "resized");
      const max = LAYOUT_LIMITS.grid;
      const inRange = [action.w, action.h].every((n) => Number.isInteger(n) && n >= 1 && n <= max);
      return { ...state, notice: { kind: "refused", code: inRange ? "resize_cut" : r.code } };
    }
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
      return { ...initEditor(action.view), notice: { kind: "done", what: "saved" } };
    case "saveFailed":
      return { ...state, save: { status: "error", code: action.code } };
  }
}

/** Any action other than `nudge` ends a run of arrow moves (the next nudge starts a new undo step). */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const next = reduce(state, action);
  return action.type !== "nudge" && next.nudge !== null ? { ...next, nudge: null } : next;
}
