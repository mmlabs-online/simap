"use client";

import { useReducer, useState } from "react";
import {
  editorFlags,
  editorReducer,
  initEditor,
  savePayload,
} from "@/lib/layout-editor/editor-state";
import { fixturePalette } from "@/lib/layout-editor/palette";
import { escDisarms } from "@/lib/layout-editor/place-tool";
import { roomDetailHref } from "@/lib/nav";
import type { Zoom } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import { roomlayoutCopy } from "../copy/roomlayout";
import type { SeatsApi } from "../seats/seats-api";
import { EditorCanvas } from "./EditorCanvas";
import { EditorInspector } from "./EditorInspector";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusLine, LeaveDialog, SaveErrorBanner } from "./EditorViews";
import { Palette, PlacePanel } from "./Palette";
import { useLeaveGuard } from "./useLeaveGuard";

const GROUPS = fixturePalette();

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
  const draft = state.history.present;
  const { tool } = state;
  const frozen = state.readOnly || saving;
  const resizeRefused = state.notice?.kind === "refused" && state.notice.code === "resize_cut";
  const trayCode =
    tool?.kind === "tray" ? draft.tray.find((t) => t.id === tool.seatId)?.code : null;
  const toolName =
    tool === null
      ? null
      : roomlayoutCopy.editor.itemName(
          tool.kind === "fixture"
            ? { kind: "fixture", sprite: tool.sprite, code: null }
            : { kind: "seat", sprite: "desk.single", code: trayCode ?? null },
        );
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
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        const armed = tool !== null;
        const dialogOpen = guard.pending !== null;
        if (escDisarms(e.key, { armed, dialogOpen, defaultPrevented: e.defaultPrevented })) {
          dispatch({ type: "disarm" });
        }
      }}
    >
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
          draft={draft}
          selection={state.selection}
          zoom={zoom}
          tool={tool}
          onPlace={(x, y) => dispatch({ type: "place", x, y })}
          onPick={(key, additive) =>
            dispatch(key === null ? { type: "selectNone" } : { type: "select", key, additive })
          }
        />
        <div className="flex flex-col gap-4">
          <PlacePanel
            toolName={toolName}
            disabled={frozen}
            onPlace={(x, y) => dispatch({ type: "place", x, y })}
            onDone={() => dispatch({ type: "disarm" })}
          />
          <Palette
            groups={GROUPS}
            armed={tool?.kind === "fixture" ? tool.sprite : null}
            disabled={frozen}
            onArm={(sprite) => dispatch({ type: "arm", tool: { kind: "fixture", sprite } })}
          />
          <EditorInspector
            draft={draft}
            selection={state.selection}
            disabled={frozen}
            tool={tool}
            resizeRefused={resizeRefused}
            onArmTray={(seatId) => dispatch({ type: "arm", tool: { kind: "tray", seatId } })}
            onResize={(w, h) => dispatch({ type: "resize", w, h })}
            onSelect={(key, additive) => dispatch({ type: "select", key, additive })}
            onMove={(dx, dy) => dispatch({ type: "move", dx, dy })}
            onRotate={() => dispatch({ type: "rotate" })}
            onDelete={() => dispatch({ type: "delete" })}
          />
        </div>
      </div>
      <LeaveDialog open={guard.pending !== null} onStay={guard.stay} onLeave={guard.leave} />
    </div>
  );
}
