import { ZOOM_LEVELS, type Zoom } from "@/lib/sprites/layout";
import { Button } from "../Button";
import { roomlayoutCopy } from "../copy/roomlayout";

type Props = { zoom: Zoom; onZoom: (zoom: Zoom) => void; allowed?: readonly Zoom[] };

/** The 1x/2x/3x/4x buttons. A level not in `allowed` is disabled (canvas budget). */
export function ZoomControl({ zoom, onZoom, allowed = ZOOM_LEVELS }: Props) {
  return (
    <div role="group" aria-label={roomlayoutCopy.zoomLabel} className="flex gap-2">
      {ZOOM_LEVELS.map((z) => (
        <Button
          key={z}
          variant="tonal"
          size="sm"
          aria-pressed={z === zoom}
          disabled={!allowed.includes(z)}
          onClick={() => onZoom(z)}
          className="aria-pressed:border-text-primary aria-pressed:font-semibold"
        >
          {roomlayoutCopy.zoomOption(z)}
        </Button>
      ))}
    </div>
  );
}
