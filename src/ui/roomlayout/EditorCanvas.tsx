"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canvasCell } from "@/lib/layout-editor/canvas-point";
import { draftToRoomLayout } from "@/lib/layout-editor/draft";
import { placementPreview, type Tool } from "@/lib/layout-editor/place-tool";
import {
  dragPreview,
  gestureCancel,
  gestureDown,
  gestureMove,
  gestureUp,
  marqueeBox,
  marqueeKeys,
  type Gesture,
  type GestureCtx,
  type GestureEffect,
  type GestureStep,
  type PointerSample,
} from "@/lib/layout-editor/pointer-gesture";
import { footprintBox, type Point } from "@/lib/layout-editor/tiles";
import type { Draft } from "@/lib/layout-editor/types";
import type { FootprintLookup } from "@/lib/validate/layout";
import { ZOOM_LEVELS, type LayoutItem, type SeatDevice, type Zoom } from "@/lib/sprites/layout";
import { buildDrawList, TILE } from "@/lib/sprites/placement";
import { allowedZooms, clampZoom } from "@/lib/sprites/zoom";
import { roomlayoutCopy } from "../copy/roomlayout";
import { GestureOverlay } from "./GestureOverlay";
import type { CatalogImages } from "./catalog-images";
import { paintRoom } from "./paint";
import { RoomMapStatus } from "./RoomMap";
import { useAtlas } from "./useAtlas";

type Props = {
  draft: Draft;
  /** Drawn on the desks; not selectable and not part of the draft. */
  seatDevices: Record<string, SeatDevice[]>;
  selection: readonly string[];
  zoom: Zoom;
  /** The armed tool: a press places instead of selecting or dragging. */
  tool: Tool | null;
  /** Saving or read-only: nothing can be dragged. */
  frozen: boolean;
  /** Select, drag-move and place actions from the pointer gestures. */
  onAction: (effect: GestureEffect) => void;
  /** Catalog device images from `useCatalogImages`. */
  catalogImages?: CatalogImages;
  /** Catalog rows for the art (layout rows merged with the palette); without them items draw built-in frames. */
  items?: readonly LayoutItem[];
  /** Catalog sizes for the ghost, outlines and hit areas (default: the registry). */
  footprints?: FootprintLookup;
};

/**
 * The draft painted as the room map, with a pointer layer (click, drag, rectangle select) and outlines for
 * the selection. Seats show no occupancy here. The pointer layer is hidden from assistive tech: the Items
 * list and the keyboard are the accessible path.
 */
export function EditorCanvas({
  draft,
  seatDevices,
  selection,
  zoom,
  tool,
  frozen,
  onAction,
  catalogImages,
  items,
  footprints,
}: Props) {
  const { atlas, failed, setFailed } = useAtlas();
  const [hover, setHover] = useState<Point | null>(null);
  const [gesture, setGesture] = useState<Gesture>({ kind: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture>(gesture);
  const pending = useRef<PointerSample | null>(null);
  const frame = useRef(0);
  const ctxRef = useRef<GestureCtx>({ draft, selection, tool, frozen, footprints });
  ctxRef.current = { draft, selection, tool, frozen, footprints };
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const list = useMemo(
    () =>
      atlas
        ? buildDrawList(
            draftToRoomLayout(draft),
            {},
            atlas.manifest,
            seatDevices,
            catalogImages?.ready,
            { items, image: catalogImages?.itemSize },
          )
        : null,
    [atlas, draft, seatDevices, items, catalogImages?.version],
  );
  const allowed = useMemo(() => (list ? allowedZooms(list.bounds) : []), [list]);
  const effective = clampZoom(zoom, allowed);
  const preview = useMemo(
    () => placementPreview(draft, tool, hover, footprints),
    [draft, tool, hover, footprints],
  );
  const ghost = useMemo(
    () => dragPreview(draft, gesture, footprints),
    [draft, gesture, footprints],
  );
  const marquee = useMemo(() => {
    const box = marqueeBox(gesture);
    if (!box) return null;
    const keys = marqueeKeys(draft, gesture, footprints);
    return {
      box,
      items: draft.items
        .filter((i) => keys.includes(i.key))
        .map((i) => footprintBox(i, footprints)),
    };
  }, [draft, gesture, footprints]);

  const apply = useCallback((step: GestureStep) => {
    gestureRef.current = step.gesture;
    setGesture((g) => (g === step.gesture ? g : step.gesture));
    for (const effect of step.effects) onActionRef.current(effect);
  }, []);

  const cancel = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    pending.current = null;
    apply({ gesture: gestureCancel(), effects: [] });
  }, [apply]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!atlas || !list || !canvas || effective === null) return;
    if (!paintRoom(canvas, atlas, list, effective, undefined, catalogImages?.source)) {
      setFailed(true);
    }
  }, [atlas, list, effective, setFailed, catalogImages]);

  // A running gesture is stale once the draft or the zoom changes under it (undo, zoom control).
  useEffect(() => cancel(), [draft, effective, cancel]);
  useEffect(() => () => cancel(), [cancel]);

  const active = gesture.kind !== "idle";
  useEffect(() => {
    if (!active) return;
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, [active, cancel]);

  if (failed) return <RoomMapStatus status="error" />;
  if (!atlas || !list) return <RoomMapStatus status="loading" />;
  if (effective === null) return <RoomMapStatus status="tooLarge" />;

  const { bounds } = list;
  const width = bounds.w * effective;
  const height = bounds.h * effective;

  const sampleOf = (e: React.PointerEvent<HTMLDivElement>): PointerSample => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return {
      id: e.pointerId,
      offset,
      cell: canvasCell(offset, bounds, effective),
      shift: e.shiftKey,
    };
  };

  const onHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = canvasCell({ x: e.clientX - rect.left, y: e.clientY - rect.top }, bounds, effective);
    const tile = c.x < 0 || c.y < 0 || c.x >= draft.w || c.y >= draft.h ? null : c;
    setHover((h) => (h?.x === tile?.x && h?.y === tile?.y ? h : tile));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const step = gestureDown(
      gestureRef.current,
      {
        ...sampleOf(e),
        primary: e.isPrimary,
        button: e.button,
        pointerType: e.pointerType,
      },
      ctxRef.current,
    );
    if (step.gesture === gestureRef.current || step.gesture.kind === "idle") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    regionRef.current?.focus({ preventScroll: true });
    apply(step);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gestureRef.current.kind === "idle") return;
    pending.current = sampleOf(e);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const s = pending.current;
      pending.current = null;
      if (s) apply(gestureMove(gestureRef.current, s, ctxRef.current));
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    pending.current = null;
    apply(gestureUp(gestureRef.current, sampleOf(e), ctxRef.current));
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // While a gesture runs no editor shortcut fires; Escape cancels it.
  const onRegionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (gestureRef.current.kind === "idle") return;
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    e.stopPropagation();
  };

  const dragging = gesture.kind === "drag" || gesture.kind === "marquee";

  return (
    <div className="space-y-2">
      {allowed.length < ZOOM_LEVELS.length && (
        <p role="status" className="text-label font-normal text-text-secondary">
          {roomlayoutCopy.zoomLimited}
        </p>
      )}
      <div
        ref={regionRef}
        role="region"
        tabIndex={0}
        aria-label={roomlayoutCopy.regionLabel}
        onKeyDown={onRegionKeyDown}
        className="max-h-[70vh] overflow-auto overscroll-contain rounded-md border border-divider"
      >
        <div className="relative" style={{ width, height }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="block"
            style={{ width, height, imageRendering: "pixelated" }}
          />
          <div
            aria-hidden="true"
            className={`absolute inset-0 select-none ${dragging ? "touch-none" : ""} ${tool ? "cursor-crosshair" : gesture.kind === "drag" ? "cursor-grabbing" : "cursor-pointer"}`}
            data-testid="editor-click-layer"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancel}
            onLostPointerCapture={cancel}
            onMouseMove={onHover}
            onMouseLeave={() => setHover(null)}
          >
            {preview && (
              <div
                data-testid="place-ghost"
                className={`pointer-events-none absolute border-2 ${preview.ok ? "border-text-primary bg-text-primary/20" : "border-dashed border-danger bg-danger/20"}`}
                style={{
                  left: (preview.x * TILE - bounds.x) * effective,
                  top: (preview.y * TILE - bounds.y) * effective,
                  width: preview.w * TILE * effective,
                  height: preview.h * TILE * effective,
                }}
              />
            )}
            {draft.items
              .filter((i) => selection.includes(i.key))
              .map((i) => {
                const b = footprintBox(i, footprints);
                return (
                  <div
                    key={i.key}
                    className="pointer-events-none absolute border-2 border-text-primary outline-2 -outline-offset-4 outline-dashed outline-text-primary"
                    style={{
                      left: (b.x * TILE - bounds.x) * effective,
                      top: (b.y * TILE - bounds.y) * effective,
                      width: b.w * TILE * effective,
                      height: b.h * TILE * effective,
                    }}
                  />
                );
              })}
            <GestureOverlay bounds={bounds} zoom={effective} drag={ghost} marquee={marquee} />
          </div>
        </div>
      </div>
    </div>
  );
}
