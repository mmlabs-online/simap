"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import { parsePng } from "@/lib/validate/png";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Button, IconButton } from "../Button";
import type { Atlas } from "../roomlayout/loadAtlas";
import { TabBar } from "../TabBar";
import { MapItemEditorAppearance } from "./MapItemEditorAppearance";
import { MapItemEditorDetails } from "./MapItemEditorDetails";
import {
  closeDecision,
  editorReducer,
  initEditor,
  isDirty,
  pendingItem,
  saveEditor,
  stagedUrls,
  type EditorAction,
  type EditorState,
  type EditorTab,
} from "./map-item-editor";
import { patchFrom } from "./map-item-form";
import { artErrorMessage, checkMapItemImage } from "./map-item-image";
import type { MapItemsApi } from "./map-items-api";
import { mapItemErrorMessage } from "./map-items-state";

const copy = mapItemsCopy.editor;

export type EditorFrameProps = {
  item: MapItemDto;
  state: EditorState;
  groups: readonly string[];
  /** Base for the ids that tie tabs, panels and the title together. */
  idBase: string;
  imageUrl: (dir: Direction) => string | null;
  atlas?: Atlas | null;
  atlasFailed?: boolean;
  dispatch: (action: EditorAction) => void;
  onUpload: (dir: Direction, file: File) => void;
  onSave: () => void;
  onRequestClose: () => void;
  onDiscard: () => void;
  onReset: () => void;
};

/** The editor body: header, tabs, both panels, error banner and footer. Props only, so the markup can be tested without effects. */
export function MapItemEditorFrame(p: EditorFrameProps) {
  const { item, state, dispatch } = p;
  const busy = state.phase === "saving" || state.phase === "resetting";
  const dirty = isDirty(item, state);
  const tabId = (id: EditorTab) => `${p.idBase}-tab-${id}`;
  const panelId = (id: EditorTab) => `${p.idBase}-panel-${id}`;
  const status = busy ? copy.status.saving : dirty ? copy.status.dirty : copy.status.clean;
  const appearanceChanged = Object.keys(state.art).length > 0;
  const detailsChanged = patchFrom(item, state.form).kind !== "unchanged";
  return (
    <div className="flex max-h-[92dvh] flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-wide text-text-secondary uppercase">
            {copy.eyebrow}
          </p>
          <h2 id={`${p.idBase}-title`} className="text-subtitle text-text-primary">
            {copy.title(item.name)}
          </h2>
          <p className="font-mono text-caption text-text-secondary">{item.builtinKey}</p>
        </div>
        <IconButton
          icon="close"
          label={copy.close}
          onClick={p.onRequestClose}
          className="shrink-0"
        />
      </div>
      <div className="px-5">
        <TabBar
          ariaLabel={copy.tabsLabel}
          active={state.tab}
          onSelect={(tab) => dispatch({ type: "tab", tab })}
          tabIdOf={tabId}
          panelIdOf={panelId}
          tabs={[
            {
              id: "appearance",
              label: copy.tabs.appearance,
              chip: appearanceChanged ? copy.changed : undefined,
            },
            {
              id: "details",
              label: copy.tabs.details,
              chip: detailsChanged ? copy.changed : undefined,
            },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {state.error && (
          <p role="alert" className="mb-3 text-label font-semibold text-danger">
            {state.error.message}
          </p>
        )}
        <div
          role="tabpanel"
          id={panelId("appearance")}
          aria-labelledby={tabId("appearance")}
          hidden={state.tab !== "appearance"}
        >
          <MapItemEditorAppearance
            item={item}
            state={state}
            busy={busy}
            imageUrl={p.imageUrl}
            atlas={p.atlas}
            atlasFailed={p.atlasFailed}
            onDir={(dir) => dispatch({ type: "dir", dir })}
            onSource={(source) => dispatch({ type: "source", source })}
            onPick={(key) => dispatch({ type: "stageSprite", dir: state.dir, key })}
            onQuery={(query) => dispatch({ type: "query", query })}
            onAllTypes={(allTypes) => dispatch({ type: "allTypes", allTypes })}
            onUpload={p.onUpload}
            onRestore={(dir) => dispatch({ type: "restore", dir })}
          />
        </div>
        <div
          role="tabpanel"
          id={panelId("details")}
          aria-labelledby={tabId("details")}
          hidden={state.tab !== "details"}
        >
          <MapItemEditorDetails
            item={item}
            form={state.form}
            groups={p.groups}
            busy={busy}
            dirty={dirty}
            confirmingReset={state.phase === "confirmReset" || state.phase === "resetting"}
            onChange={(patch) => dispatch({ type: "form", patch })}
            onAskReset={() => dispatch({ type: "askReset" })}
            onKeepEditing={() => dispatch({ type: "keepEditing" })}
            onReset={p.onReset}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-divider px-5 py-3">
        <p role="status" className="text-caption font-semibold text-text-secondary">
          {status}
          {state.notice && !busy && !dirty ? ` ${state.notice}` : ""}
        </p>
        {state.phase === "confirmDiscard" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold text-text-primary">{copy.discard.title}</span>
            <Button
              variant="tonal"
              size="sm"

              onClick={() => dispatch({ type: "keepEditing" })}
            >
              {copy.discard.keep}
            </Button>
            <Button variant="danger" size="sm" onClick={p.onDiscard}>
              {copy.discard.discard}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="tonal" disabled={busy} onClick={p.onRequestClose}>
              {copy.cancel}
            </Button>
            <Button variant="pixel" disabled={busy || !dirty} onClick={p.onSave}>
              {copy.save}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The Item editor: one native `<dialog>` for an item's art, details and reset. Edits are staged and sent by one Save;
 * the list reloads through `onReload`. Keyed by the item key in the page, so a reload keeps the draft.
 */
export function MapItemEditor({
  item,
  groups,
  api,
  imageUrl,
  atlas,
  atlasFailed,
  onReload,
  onClose,
  onGone,
}: {
  item: MapItemDto;
  groups: readonly string[];
  api: MapItemsApi;
  imageUrl: (item: MapItemDto, dir: Direction) => string | null;
  atlas?: Atlas | null;
  atlasFailed?: boolean;
  onReload(): Promise<void>;
  onClose: () => void;
  onGone: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnScrim = useRef(false);
  const inFlight = useRef(false);
  const idBase = useId();
  const [state, dispatch] = useReducer(
    (s: EditorState, a: EditorAction) => editorReducer(item, s, a),
    item,
    initEditor,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    document.getElementById(`${idBase}-tab-appearance`)?.focus();
    return () => {
      el.close();
      previous?.focus?.();
    };
  }, [idBase]);

  // Object URLs of staged images: revoke the ones that left the draft, and all on unmount.
  const live = useRef(new Set<string>());
  const urls = stagedUrls(state.art);
  const urlKey = urls.join("\n");
  useEffect(() => {
    for (const u of live.current) {
      if (!urls.includes(u)) {
        URL.revokeObjectURL(u);
        live.current.delete(u);
      }
    }
    for (const u of urls) live.current.add(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);
  useEffect(() => {
    const set = live.current;
    return () => {
      for (const u of set) URL.revokeObjectURL(u);
      set.clear();
    };
  }, []);

  function requestClose() {
    const decision = closeDecision(item, stateRef.current);
    if (decision === "close") onClose();
    else if (decision === "confirm") dispatch({ type: "askDiscard" });
  }

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    const draft = stateRef.current;
    dispatch({ type: "saveStart" });
    try {
      const result = await saveEditor(api, item, draft);
      if (result.kind === "gone") return onGone();
      dispatch({ type: "saveApplied", result });
      if (result.kind === "done" || (result.kind === "failed" && result.reload)) await onReload();
      dispatch({ type: "saveEnd" });
    } finally {
      inFlight.current = false;
    }
  }

  async function reset() {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: "resetStart" });
    try {
      const res = await api.reset(item.builtinKey);
      if (!res.ok && res.code === "not_found") return onGone();
      if (!res.ok) {
        dispatch({
          type: "error",
          error: { message: mapItemErrorMessage(res.code, res.rooms), tab: "details" },
        });
        return;
      }
      await onReload();
      dispatch({ type: "resetApplied", item: res.value });
    } finally {
      inFlight.current = false;
    }
  }

  async function upload(dir: Direction, file: File) {
    const pending = pendingItem(item, stateRef.current.form);
    const check = await checkMapItemImage(file, pending, dir);
    if (!check.ok) {
      dispatch({
        type: "dirNote",
        dir,
        message: artErrorMessage(check.code, pending, dir, check.px),
      });
      return;
    }
    const png = parsePng(check.bytes);
    const px = png.ok ? { width: png.width, height: png.height } : { width: 0, height: 0 };
    const url = URL.createObjectURL(new Blob([check.bytes], { type: "image/png" }));
    dispatch({ type: "stageImage", dir, edit: { kind: "image", bytes: check.bytes, url, px } });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${idBase}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (stateRef.current.phase === "confirmDiscard") dispatch({ type: "keepEditing" });
        else requestClose();
      }}
      onPointerDown={(e) => {
        pressedOnScrim.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        if (pressedOnScrim.current && e.target === e.currentTarget) requestClose();
        pressedOnScrim.current = false;
      }}
      className="m-auto w-[calc(100%-var(--space-6))] max-w-145 overflow-hidden rounded-2xl bg-surface p-0 text-text-primary shadow-dialog"
      style={{ animation: "popin var(--duration-ui) ease-out" }}
    >
      <MapItemEditorFrame
        item={item}
        state={state}
        groups={groups}
        idBase={idBase}
        imageUrl={(dir) => imageUrl(item, dir)}
        atlas={atlas}
        atlasFailed={atlasFailed}
        dispatch={dispatch}
        onUpload={(dir, file) => void upload(dir, file)}
        onSave={() => void save()}
        onRequestClose={requestClose}
        onDiscard={onClose}
        onReset={() => void reset()}
      />
    </dialog>
  );
}
