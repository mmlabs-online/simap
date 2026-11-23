"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ZOOM_LEVELS, type RoomLayout, type SeatView, type Zoom } from "@/lib/sprites/layout";
import { buildDrawList } from "@/lib/sprites/placement";
import { allowedZooms, clampZoom } from "@/lib/sprites/zoom";
import { roomlayoutCopy } from "../copy/roomlayout";
import { loadAtlas, type Atlas } from "./loadAtlas";
import { paintRoom } from "./paint";
import { SeatOverlay } from "./SeatOverlay";
import { ZoomControl } from "./ZoomControl";

const STATUS = "rounded-md border border-outline-variant p-4 text-sm text-on-surface";

/** The loading, error and too-large views of the map. */
export function RoomMapStatus({ status }: { status: "loading" | "error" | "tooLarge" }) {
  if (status === "loading") {
    return (
      <p role="status" className={STATUS}>
        {roomlayoutCopy.loading}
      </p>
    );
  }
  return (
    <p role="alert" className={`${STATUS} border-error/40`}>
      {status === "tooLarge" ? roomlayoutCopy.tooLarge : roomlayoutCopy.error}
    </p>
  );
}

type Props = {
  layout: RoomLayout;
  seatViews: Record<string, SeatView>;
  zoom: number;
  /** Shows the zoom buttons when given. */
  onZoom?: (zoom: Zoom) => void;
  onSelect?: (seatCode: string) => void;
};

/** Canvas art plus an HTML seat overlay. Loads `/sprites/office.png|json`; a bad atlas shows an error view. */
export function RoomMap({ layout, seatViews, zoom, onZoom, onSelect }: Props) {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadAtlas({
      fetch: (url, init) => window.fetch(url, init),
      createImage: () => new Image(),
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setAtlas(result.atlas);
      else setFailed(true);
    });
    return () => controller.abort();
  }, []);

  const list = useMemo(
    () => (atlas ? buildDrawList(layout, seatViews, atlas.manifest) : null),
    [atlas, layout, seatViews],
  );

  const allowed = useMemo(() => (list ? allowedZooms(list.bounds) : []), [list]);
  const effective = clampZoom(zoom, allowed);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!atlas || !list || !canvas || effective === null) return;
    if (!paintRoom(canvas, atlas, list, effective)) setFailed(true);
  }, [atlas, list, effective]);

  if (failed) return <RoomMapStatus status="error" />;
  if (!atlas || !list) return <RoomMapStatus status="loading" />;

  if (effective === null) return <RoomMapStatus status="tooLarge" />;

  const width = list.bounds.w * effective;
  const height = list.bounds.h * effective;
  return (
    <div className="space-y-2">
      {onZoom && <ZoomControl zoom={effective} onZoom={onZoom} allowed={allowed} />}
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
          <SeatOverlay list={list} views={seatViews} zoom={effective} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
