"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomLayout, SeatView } from "@/lib/sprites/layout";
import { buildDrawList } from "@/lib/sprites/placement";
import { roomlayoutCopy } from "../copy/roomlayout";
import { loadAtlas, type Atlas } from "./loadAtlas";
import { paintRoom } from "./paint";
import { SeatOverlay } from "./SeatOverlay";

/** The loading and error views of the map. */
export function RoomMapStatus({ status }: { status: "loading" | "error" }) {
  return status === "error" ? (
    <p role="alert" className="rounded-md border border-red-500/40 p-4 text-sm">
      {roomlayoutCopy.error}
    </p>
  ) : (
    <p role="status" className="p-4 text-sm">
      {roomlayoutCopy.loading}
    </p>
  );
}

type Props = { layout: RoomLayout; seatViews: Record<string, SeatView>; zoom: number };

/** Canvas art plus an HTML seat overlay. Loads `/sprites/office.png|json`; a bad atlas shows an error view. */
export function RoomMap({ layout, seatViews, zoom }: Props) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!atlas || !list || !canvas) return;
    if (!paintRoom(canvas, atlas, list, zoom)) setFailed(true);
  }, [atlas, list, zoom]);

  if (failed) return <RoomMapStatus status="error" />;
  if (!atlas || !list) return <RoomMapStatus status="loading" />;

  const width = list.bounds.w * zoom;
  const height = list.bounds.h * zoom;
  return (
    <div
      role="region"
      aria-label={roomlayoutCopy.regionLabel}
      className="overflow-auto overscroll-contain"
    >
      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block"
          style={{ width, height, imageRendering: "pixelated" }}
        />
        <SeatOverlay list={list} views={seatViews} zoom={zoom} />
      </div>
    </div>
  );
}
