"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  editorFlags,
  editorReducer,
  initEditor,
  savePayload,
} from "@/lib/layout-editor/editor-state";
import { catalogPalette } from "@/lib/layout-editor/palette";
import { runSave } from "@/lib/layout-editor/save-run";
import { isTextField, keyAction } from "@/lib/layout-editor/shortcuts";
import { roomDetailHref } from "@/lib/nav";
import type { Zoom } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import { roomlayoutCopy } from "../copy/roomlayout";
import type { MapItemsState } from "../mapItems/useMapItems";
import type { SeatsApi } from "../seats/seats-api";
import type { CatalogImages } from "./catalog-images";
import { EditorCanvas } from "./EditorCanvas";
import { EditorInspector } from "./EditorInspector";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusLine, LeaveDialog, SaveErrorBanner } from "./EditorViews";
import { Palette, PlacePanel } from "./Palette";
import { ShortcutList } from "./ShortcutList";
import { useLeaveGuard } from "./useLeaveGuard";

type Props = {
  view: MapView;
  roomId: string;
  roomCode: string;
  seatsApi: SeatsApi;
  catalogImages?: CatalogImages;
  /** The org's map item catalog for the palette and the sizes. */
  palette: Pick<MapItemsState, "status" | "items" | "reload">;
  /** Refetches the layout; the page remounts this editor with the new view. */
  onReload: () => void;
};

/** The editor for one loaded layout: draft state, the save flow and the leave guard. */
export function LayoutEditor({
  view,
  roomId,
  roomCode,
  seatsApi,
  catalogImages,
  palette,
  onReload,
}: Props) {
  const [state, dispatch] = useReducer(editorReducer, view, (v: MapView) =>
    initEditor(v, palette.items),
  );
  const [zoom, setZoom] = useState<Zoom>(2);
  useEffect(() => {
    dispatch({ type: "catalog", items: palette.items });
  }, [palette.items]);
  const groups = useMemo(() => catalogPalette(palette.items), [palette.items]);
  // Layout rows win over palette rows, so a placed hidden item keeps its name.
  const names = useMemo(
    () => new Map([...palette.items, ...view.items].map((i) => [i.builtinKey, i.name])),
    [palette.items, view.items],
  );
  const flags = editorFlags(state);
  const saving = state.save.status === "saving";
  const guard = useLeaveGuard(flags.dirty);
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
          tool.kind === "fixture" ? names.get(tool.sprite) : undefined,
        );
  const backHref = roomDetailHref(roomCode) ?? "/rooms";

  // Ctrl+S is a second trigger: the ref makes a duplicate PUT impossible before the next render.
  const inFlight = useRef(false);
  const save = async () => {
    if (inFlight.current || !flags.canSave) return;
    const payload = savePayload(state);
    if (!payload.ok) return;
    inFlight.current = true;
    dispatch({ type: "saveStart" });
    try {
      const out = await runSave(
        {
          draft: state.history.present,
          baseline: state.baseline,
          baseVersion: state.baseVersion,
          roomId,
          footprints: state.footprints,
        },
        seatsApi,
      );
      if (out.status === "saved") dispatch({ type: "saveDone", view: out.view });
      else
        dispatch({
          type: "saveFailed",
          code: out.code,
          detail: out.detail,
          progress: out.progress,
        });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        const r = keyAction(
          {
            key: e.key,
            ctrl: e.ctrlKey,
            meta: e.metaKey,
            shift: e.shiftKey,
            alt: e.altKey,
            repeat: e.repeat,
            composing: e.nativeEvent.isComposing,
            defaultPrevented: e.defaultPrevented,
            inTextField: isTextField(e.target as HTMLElement | null),
          },
          // The canvas stops keys while a gesture runs, so none reach this handler then.
          {
            dialogOpen: guard.pending !== null,
            gesturing: false,
            armed: tool !== null,
            hasSelection: state.selection.length > 0,
          },
        );
        if (!r) return;
        e.preventDefault();
        if (r.type === "nudge") dispatch(r);
        else if (r.type === "save") void save();
        else if (r.type === "escape") dispatch({ type: tool ? "disarm" : "selectNone" });
        else dispatch({ type: r.type });
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
          detail={state.save.detail}
          roomHref={backHref}
          onReload={onReload}
          onRetry={() => void save()}
        />
      )}
      <EditorStatusLine notice={state.notice} />
      <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-4">
        <EditorCanvas
          draft={draft}
          seatDevices={state.seatDevices}
          selection={state.selection}
          zoom={zoom}
          tool={tool}
          frozen={frozen}
          onAction={dispatch}
          catalogImages={catalogImages}
          footprints={state.footprints}
        />
        <div className="flex flex-col gap-4">
          <PlacePanel
            toolName={toolName}
            disabled={frozen}
            onPlace={(x, y) => dispatch({ type: "place", x, y })}
            onDone={() => dispatch({ type: "disarm" })}
          />
          <Palette
            groups={groups}
            status={palette.status}
            onRetry={palette.reload}
            armed={
              tool?.kind === "fixture" ? tool.sprite : tool?.kind === "desk" ? "desk.single" : null
            }
            disabled={frozen}
            onArm={(e) =>
              dispatch({
                type: "arm",
                tool: e.kind === "seat" ? { kind: "desk" } : { kind: "fixture", sprite: e.sprite },
              })
            }
          />
          <EditorInspector
            draft={draft}
            selection={state.selection}
            disabled={frozen}
            tool={tool}
            names={names}
            resizeRefused={resizeRefused}
            onArmTray={(seatId) => dispatch({ type: "arm", tool: { kind: "tray", seatId } })}
            onResize={(w, h) => dispatch({ type: "resize", w, h })}
            onSelect={(key, additive) => dispatch({ type: "select", key, additive })}
            onMove={(dx, dy) => dispatch({ type: "move", dx, dy })}
            onRotate={() => dispatch({ type: "rotate" })}
            onDelete={() => dispatch({ type: "delete" })}
          />
          <ShortcutList />
        </div>
      </div>
      <LeaveDialog open={guard.pending !== null} onStay={guard.stay} onLeave={guard.leave} />
    </div>
  );
}
