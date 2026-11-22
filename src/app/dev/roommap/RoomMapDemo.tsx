"use client";

import { useState } from "react";
import { ZOOM_LEVELS, type Zoom } from "@/lib/sprites/layout";
import { roomlayoutCopy } from "@/ui/copy/roomlayout";
import { RoomMap } from "@/ui/roomlayout";
import { DEMO_FIXTURE_MARKER, DEMO_LAYOUT, DEMO_VIEWS } from "./fixture";

/** Dev-only room map demo (SIM-024.1): fixture data, no API. */
export function RoomMapDemo() {
  const [zoom, setZoom] = useState<Zoom>(ZOOM_LEVELS[0]);
  return (
    <main className="space-y-4 p-4" data-demo-fixture={DEMO_FIXTURE_MARKER}>
      <div role="group" aria-label={roomlayoutCopy.zoomLabel} className="flex gap-2">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={z === zoom}
            onClick={() => setZoom(z)}
            className="rounded-md border border-current px-3 py-1 text-sm aria-pressed:font-bold aria-pressed:underline"
          >
            {roomlayoutCopy.zoomOption(z)}
          </button>
        ))}
      </div>
      <RoomMap layout={DEMO_LAYOUT} seatViews={DEMO_VIEWS} zoom={zoom} />
    </main>
  );
}
