"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canvasTile } from "@/lib/layout-editor/canvas-point";
import { draftToRoomLayout } from "@/lib/layout-editor/draft";
import { placementPreview, type Tool } from "@/lib/layout-editor/place-tool";
import { footprintCells, itemAt, type Point } from "@/lib/layout-editor/tiles";
import type { Draft } from "@/lib/layout-editor/types";
import { ZOOM_LEVELS, type Zoom } from "@/lib/sprites/layout";
import { buildDrawList, TILE } from "@/lib/sprites/placement";
import { allowedZooms, clampZoom } from "@/lib/sprites/zoom";
import { roomlayoutCopy } from "../copy/roomlayout";
import { paintRoom } from "./paint";
import { RoomMapStatus } from "./RoomMap";
import { useAtlas } from "./useAtlas";

type Props = {
  draft: Draft;
  selection: readonly string[];
  zoom: Zoom;
  /** The armed tool: a click places instead of selecting. */
  tool: Tool | null;
  onPlace: (x: number, y: number) => void;
  /** A click on an item, or on nothing (`key` null). */
  onPick: (key: string | null, additive: boolean) => void;
};

/**
 * The draft painted as the room map, with a click layer and outlines for the selection. Seats show no
 * occupancy here. The click layer is hidden from assistive tech: the Items list is the accessible path.
 */
export function EditorCanvas({ draft, selection, zoom, tool, onPlace, onPick }: Props) {
  const { atlas, failed, setFailed } = useAtlas();
  const [hover, setHover] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const list = useMemo(
    () => (atlas ? buildDrawList(draftToRoomLayout(draft), {}, atlas.manifest) : null),
    [atlas, draft],
  );
  const allowed = useMemo(() => (list ? allowedZooms(list.bounds) : []), [list]);
  const effective = clampZoom(zoom, allowed);
  const preview = useMemo(() => placementPreview(draft, tool, hover), [draft, tool, hover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!atlas || !list || !canvas || effective === null) return;
    if (!paintRoom(canvas, atlas, list, effective)) setFailed(true);
  }, [atlas, list, effective, setFailed]);

  if (failed) return <RoomMapStatus status="error" />;
  if (!atlas || !list) return <RoomMapStatus status="loading" />;
  if (effective === null) return <RoomMapStatus status="tooLarge" />;

  const { bounds } = list;
  const width = bounds.w * effective;
  const height = bounds.h * effective;

  const tileOf = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return canvasTile(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      bounds,
      effective,
      draft.w,
      draft.h,
    );
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const tile = tileOf(e);
    setHover((h) => (h?.x === tile?.x && h?.y === tile?.y ? h : tile));
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const tile = tileOf(e);
    if (tool) {
      if (tile) onPlace(tile.x, tile.y);
      return;
    }
    const hit = tile ? itemAt(draft, tile.x, tile.y) : null;
    onPick(hit ? hit.key : null, e.shiftKey);
  };

  return (
    <div className="space-y-2">
      {allowed.length < ZOOM_LEVELS.length && (
        <p role="status" className="text-sm text-on-surface-variant">
          {roomlayoutCopy.zoomLimited}
        </p>
      )}
      <div
        role="region"
        tabIndex={0}
        aria-label={roomlayoutCopy.regionLabel}
        className="max-h-[70vh] overflow-auto overscroll-contain rounded-md border border-outline-variant outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            className={`absolute inset-0 ${tool ? "cursor-crosshair" : "cursor-pointer"}`}
            data-testid="editor-click-layer"
            onClick={onClick}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {preview && (
              <div
                data-testid="place-ghost"
                className={`pointer-events-none absolute border-2 ${preview.ok ? "border-primary bg-primary/20" : "border-dashed border-error bg-error/20"}`}
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
                const cells = footprintCells(i);
                const w = Math.max(...cells.map((c) => c.x)) - i.x + 1;
                const h = Math.max(...cells.map((c) => c.y)) - i.y + 1;
                return (
                  <div
                    key={i.key}
                    className="pointer-events-none absolute border-2 border-primary outline-2 -outline-offset-4 outline-dashed outline-on-surface"
                    style={{
                      left: (i.x * TILE - bounds.x) * effective,
                      top: (i.y * TILE - bounds.y) * effective,
                      width: w * TILE * effective,
                      height: h * TILE * effective,
                    }}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
