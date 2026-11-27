import { mapItemImageFits, spriteFits } from "@/lib/map-items/art";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { artDirs } from "./map-item-art";
import { formFromItem, patchFrom, type MapItemForm } from "./map-item-form";
import { artOutcome } from "./map-item-image";
import type { MapItemsApi, MapItemsResult } from "./map-items-api";
import { mapItemErrorMessage } from "./map-items-state";

const copy = mapItemsCopy.editor;

type Px = { width: number; height: number };

/** One staged art change for a direction; nothing is sent until Save. */
export type ArtEdit =
  | { kind: "sprite"; key: string }
  | { kind: "library" }
  | { kind: "image"; bytes: Uint8Array<ArrayBuffer>; url: string; px: Px };

export type ArtEdits = Partial<Record<Direction, ArtEdit>>;
export type EditorTab = "appearance" | "details";
export type EditorError = { message: string; tab: EditorTab; dir?: Direction };

export type EditorState = {
  tab: EditorTab;
  dir: Direction;
  source: "library" | "upload";
  form: MapItemForm;
  art: ArtEdits;
  query: string;
  allTypes: boolean;
  phase: "idle" | "saving" | "confirmDiscard" | "confirmReset" | "resetting";
  error: EditorError | null;
  /** Per-direction notes: client image check errors and "dropped by resize". */
  dirNotes: Partial<Record<Direction, string>>;
  /** "Saved." after a full save. */
  notice: string | null;
};

export function initEditor(item: MapItemDto): EditorState {
  return {
    tab: "appearance",
    dir: artDirs(item)[0]!,
    source: "library",
    form: formFromItem(item),
    art: {},
    query: "",
    allTypes: false,
    phase: "idle",
    error: null,
    dirNotes: {},
    notice: null,
  };
}

/** The item as it will be after the pending size change: used to check images and sprites against the new size. */
export const pendingItem = (item: MapItemDto, form: MapItemForm): MapItemDto => ({
  ...item,
  w: form.w,
  h: form.h,
});

export const isDirty = (item: MapItemDto, state: EditorState): boolean =>
  patchFrom(item, state.form).kind !== "unchanged" || Object.keys(state.art).length > 0;

export type EffectiveArt = {
  source: "image" | "sprite" | "library";
  spriteKey: string | null;
  /** The object URL of a staged image; null for a saved image (the caller has its URL). */
  stagedUrl: string | null;
  /** This art is staged, not saved. */
  staged: boolean;
  /** A saved image or sprite that the pending resize will remove. */
  removedOnSave: boolean;
};

/** What a direction shows: staged image > staged sprite > staged library > saved image > saved sprite > library. */
export function effectiveArt(item: MapItemDto, state: EditorState, dir: Direction): EffectiveArt {
  const edit = state.art[dir];
  if (edit?.kind === "image") {
    return {
      source: "image",
      spriteKey: null,
      stagedUrl: edit.url,
      staged: true,
      removedOnSave: false,
    };
  }
  if (edit?.kind === "sprite") {
    return {
      source: "sprite",
      spriteKey: edit.key,
      stagedUrl: null,
      staged: true,
      removedOnSave: false,
    };
  }
  if (edit?.kind === "library") {
    return {
      source: "library",
      spriteKey: null,
      stagedUrl: null,
      staged: true,
      removedOnSave: false,
    };
  }
  const { sprite, hasImage } = item.art[dir];
  const resized = state.form.w !== item.w || state.form.h !== item.h;
  const imageGone = hasImage && resized;
  const spriteGone =
    sprite !== null && resized && !spriteFits(sprite, dir, state.form.w, state.form.h);
  const removedOnSave = imageGone || spriteGone;
  if (hasImage && !imageGone) {
    return { source: "image", spriteKey: null, stagedUrl: null, staged: false, removedOnSave };
  }
  if (sprite !== null && !spriteGone) {
    return { source: "sprite", spriteKey: sprite, stagedUrl: null, staged: false, removedOnSave };
  }
  return { source: "library", spriteKey: null, stagedUrl: null, staged: false, removedOnSave };
}

export const stagedUrls = (art: ArtEdits): string[] =>
  Object.values(art).flatMap((e) => (e?.kind === "image" ? [e.url] : []));

export type CloseDecision = "close" | "confirm" | "ignore";

export function closeDecision(item: MapItemDto, state: EditorState): CloseDecision {
  if (state.phase === "saving" || state.phase === "resetting") return "ignore";
  return isDirty(item, state) ? "confirm" : "close";
}

export type SaveResult =
  | { kind: "blocked"; message: string }
  | { kind: "done"; patched: MapItemDto | null }
  | {
      kind: "failed";
      /** The item returned by a PATCH that already succeeded. */
      patched: MapItemDto | null;
      /** Staged art not yet saved: the failing direction and the later ones. */
      remaining: ArtEdits;
      error: EditorError;
      /** Something was saved (or the image changed under us): reload the list. */
      reload: boolean;
    }
  | { kind: "gone" };

type SaveApi = Pick<MapItemsApi, "patch" | "putArt" | "putImage" | "deleteImage">;

/**
 * Applies the pending changes: the details PATCH first (a size change removes custom images), then the art per
 * direction in `artDirs` order, one request at a time. Stops at the first refusal.
 */
export async function saveEditor(
  api: SaveApi,
  item: MapItemDto,
  state: EditorState,
): Promise<SaveResult> {
  const key = item.builtinKey;
  const patch = patchFrom(item, state.form);
  if (patch.kind === "invalid") {
    return {
      kind: "blocked",
      message: mapItemsCopy.fieldErrors[patch.field] ?? mapItemsCopy.fieldErrors.body,
    };
  }
  if (patch.kind === "needsConfirm") {
    return { kind: "blocked", message: mapItemsCopy.form.confirmFirst };
  }

  let base = item;
  let patched: MapItemDto | null = null;
  if (patch.kind === "patch") {
    const res = await api.patch(key, patch.value);
    if (!res.ok) {
      if (res.code === "not_found") return { kind: "gone" };
      return {
        kind: "failed",
        patched: null,
        remaining: state.art,
        error: { message: mapItemErrorMessage(res.code, res.rooms), tab: "details" },
        reload: false,
      };
    }
    base = patched = res.value;
  }

  const pending = pendingItem(item, state.form);
  const dirs = artDirs(item).filter((d) => state.art[d]);
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const edit = state.art[dir]!;
    const calls: (() => Promise<MapItemsResult<unknown>>)[] = [];
    if (edit.kind === "sprite") calls.push(() => api.putArt(key, dir, edit.key));
    else if (edit.kind === "image") calls.push(() => api.putImage(key, dir, edit.bytes));
    else {
      // Restore default: only the calls the post-PATCH item still needs (both are idempotent).
      if (base.art[dir].hasImage) calls.push(() => api.deleteImage(key, dir));
      if (base.art[dir].sprite !== null) calls.push(() => api.putArt(key, dir, null));
    }
    for (const call of calls) {
      const out = artOutcome(await call(), pending, dir);
      if (out.kind === "gone") return { kind: "gone" };
      if (out.kind !== "saved") {
        const remaining: ArtEdits = {};
        for (const d of dirs.slice(i)) remaining[d] = state.art[d];
        return {
          kind: "failed",
          patched,
          remaining,
          error: { message: out.message, tab: "appearance", dir },
          reload: patched !== null || i > 0 || out.kind === "reload",
        };
      }
    }
  }
  return { kind: "done", patched };
}

/** The state after a save attempt. `phase` stays as it is: the component ends it after the list reload. */
export function applySaveResult(state: EditorState, result: SaveResult): EditorState {
  switch (result.kind) {
    case "done":
      return {
        ...state,
        form: result.patched
          ? formFromItem(result.patched)
          : { ...state.form, confirmResize: false },
        art: {},
        dirNotes: {},
        error: null,
        notice: copy.status.saved,
      };
    case "failed":
      return {
        ...state,
        form: result.patched ? formFromItem(result.patched) : state.form,
        art: result.remaining,
        error: result.error,
        tab: result.error.tab,
        dir: result.error.dir ?? state.dir,
        notice: null,
      };
    case "blocked":
      return { ...state, error: { message: result.message, tab: "details" }, notice: null };
    case "gone":
      return state;
  }
}

export type EditorAction =
  | { type: "tab"; tab: EditorTab }
  | { type: "dir"; dir: Direction }
  | { type: "source"; source: "library" | "upload" }
  | { type: "form"; patch: Partial<MapItemForm> }
  | { type: "stageSprite"; dir: Direction; key: string }
  | { type: "stageImage"; dir: Direction; edit: Extract<ArtEdit, { kind: "image" }> }
  | { type: "dirNote"; dir: Direction; message: string | null }
  | { type: "restore"; dir: Direction }
  | { type: "query"; query: string }
  | { type: "allTypes"; allTypes: boolean }
  | { type: "askDiscard" }
  | { type: "keepEditing" }
  | { type: "askReset" }
  | { type: "resetStart" }
  | { type: "saveStart" }
  | { type: "saveApplied"; result: SaveResult }
  | { type: "saveEnd" }
  | { type: "resetApplied"; item: MapItemDto }
  | { type: "error"; error: EditorError };

const without = (art: ArtEdits, dir: Direction): ArtEdits => {
  const next = { ...art };
  delete next[dir];
  return next;
};
const withoutNote = (notes: EditorState["dirNotes"], dir: Direction) => {
  const next = { ...notes };
  delete next[dir];
  return next;
};

/** Drops staged images and sprites that do not fit the new size, with a note per direction. */
function dropMisfits(item: MapItemDto, state: EditorState, form: MapItemForm): EditorState {
  let art = state.art;
  let notes = state.dirNotes;
  for (const dir of artDirs(item)) {
    const edit = art[dir];
    if (!edit || edit.kind === "library") continue;
    const fits =
      edit.kind === "image"
        ? mapItemImageFits(item, dir, form.w, form.h, edit.px)
        : spriteFits(edit.key, dir, form.w, form.h);
    if (fits) continue;
    art = without(art, dir);
    notes = { ...notes, [dir]: copy.droppedByResize(mapItemsCopy.art.dirs[dir]) };
  }
  return { ...state, form, art, dirNotes: notes };
}

export function editorReducer(item: MapItemDto, state: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case "tab":
      return { ...state, tab: a.tab };
    case "dir":
      return { ...state, dir: a.dir };
    case "source":
      return { ...state, source: a.source };
    case "form": {
      const form = { ...state.form, ...a.patch };
      const resized = a.patch.w !== undefined || a.patch.h !== undefined;
      return { ...(resized ? dropMisfits(item, state, form) : { ...state, form }), notice: null };
    }
    case "stageSprite": {
      const saved = item.art[a.dir];
      const same = saved.sprite === a.key && !saved.hasImage;
      return {
        ...state,
        art: same
          ? without(state.art, a.dir)
          : { ...state.art, [a.dir]: { kind: "sprite", key: a.key } },
        dirNotes: withoutNote(state.dirNotes, a.dir),
        notice: null,
      };
    }
    case "stageImage":
      return {
        ...state,
        art: { ...state.art, [a.dir]: a.edit },
        dirNotes: withoutNote(state.dirNotes, a.dir),
        notice: null,
      };
    case "dirNote":
      return {
        ...state,
        dirNotes: a.message
          ? { ...state.dirNotes, [a.dir]: a.message }
          : withoutNote(state.dirNotes, a.dir),
      };
    case "restore": {
      const saved = item.art[a.dir];
      const savedLibrary = !saved.hasImage && saved.sprite === null;
      return {
        ...state,
        art: savedLibrary
          ? without(state.art, a.dir)
          : { ...state.art, [a.dir]: { kind: "library" } },
        dirNotes: withoutNote(state.dirNotes, a.dir),
        notice: null,
      };
    }
    case "query":
      return { ...state, query: a.query };
    case "allTypes":
      return { ...state, allTypes: a.allTypes };
    case "askDiscard":
      return { ...state, phase: "confirmDiscard" };
    case "keepEditing":
      return { ...state, phase: "idle" };
    case "askReset":
      return { ...state, phase: "confirmReset" };
    case "resetStart":
      return { ...state, phase: "resetting", error: null, notice: null };
    case "saveStart":
      return { ...state, phase: "saving", error: null, notice: null };
    case "saveApplied":
      return applySaveResult(state, a.result);
    case "saveEnd":
      return { ...state, phase: "idle" };
    case "resetApplied":
      return {
        ...state,
        form: formFromItem(a.item),
        art: {},
        dirNotes: {},
        error: null,
        notice: null,
        phase: "idle",
      };
    case "error":
      return { ...state, error: a.error, phase: "idle" };
  }
}
