"use client";

import { useReducer, useState } from "react";
import {
  editorFlags,
  editorReducer,
  initEditor,
  savePayload,
} from "@/lib/layout-editor/editor-state";
import { roomDetailHref } from "@/lib/nav";
import type { Zoom } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import type { SeatsApi } from "../seats/seats-api";
import { EditorCanvas } from "./EditorCanvas";
import { EditorInspector } from "./EditorInspector";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusLine, LeaveDialog, SaveErrorBanner } from "./EditorViews";
import { useLeaveGuard } from "./useLeaveGuard";

type Props = {
  view: MapView;
  roomId: string;
  roomCode: string;
  seatsApi: SeatsApi;
  /** Refetches the layout; the page remounts this editor with the new view. */
  onReload: () => void;
};

/** The editor for one loaded layout: draft state, the save flow and the leave guard. */
export function LayoutEditor({ view, roomId, roomCode, seatsApi, onReload }: Props) {
  const [state, dispatch] = useReducer(editorReducer, view, initEditor);
  const [zoom, setZoom] = useState<Zoom>(2);
  const flags = editorFlags(state);
  const saving = state.save.status === "saving";
  const guard = useLeaveGuard(flags.dirty && !saving);
  const backHref = roomDetailHref(roomCode) ?? "/rooms";

  const save = async () => {
    if (!flags.canSave) return;
    const payload = savePayload(state);
    if (!payload.ok) return;
    dispatch({ type: "saveStart" });
    const result = await seatsApi.saveLayout(roomId, payload.value);
    if (result.ok) dispatch({ type: "saveDone", view: result.value });
    else dispatch({ type: "saveFailed", code: result.code });
  };

  return (
    <div className="flex flex-col gap-3">
      <EditorToolbar
        dirty={flags.dirty}
        canUndo={flags.canUndo && !saving}
        canSave={flags.canSave}
        saving={saving}
        saveBlock={flags.saveBlock}
        zoom={zoom}
        onBack={() => guard.request(backHref)}
        onUndo={() => dispatch({ type: "undo" })}
        onSave={() => void save()}
        onZoom={setZoom}
      />
      {state.save.status === "error" && (
        <SaveErrorBanner
          code={state.save.code}
          roomHref={backHref}
          onReload={onReload}
          onRetry={() => void save()}
        />
      )}
      <EditorStatusLine notice={state.notice} />
      <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-4">
        <EditorCanvas
          draft={state.history.present}
          selection={state.selection}
          zoom={zoom}
          onPick={(key, additive) =>
            dispatch(key === null ? { type: "selectNone" } : { type: "select", key, additive })
          }
        />
        <EditorInspector
          draft={state.history.present}
          selection={state.selection}
          disabled={state.readOnly || saving}
          onSelect={(key, additive) => dispatch({ type: "select", key, additive })}
          onMove={(dx, dy) => dispatch({ type: "move", dx, dy })}
          onRotate={() => dispatch({ type: "rotate" })}
          onDelete={() => dispatch({ type: "delete" })}
        />
      </div>
      <LeaveDialog open={guard.pending !== null} onStay={guard.stay} onLeave={guard.leave} />
    </div>
  );
}
