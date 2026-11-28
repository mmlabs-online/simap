import type { Box } from "@/lib/layout-editor/pointer-gesture";
import type { Zoom } from "@/lib/sprites/layout";
import { TILE, type Rect } from "@/lib/sprites/placement";

type Props = {
  bounds: Rect;
  zoom: Zoom;
  /** The drop ghost of a drag, or null. */
  drag: { ok: boolean; boxes: Box[] } | null;
  /** The marquee rectangle and the items it would select, or null. */
  marquee: { box: Box; items: Box[] } | null;
};

/** Drag ghost and marquee over the click layer, in screen pixels. Presentational and inert. */
export function GestureOverlay({ bounds, zoom, drag, marquee }: Props) {
  const style = (b: Box) => ({
    left: (b.x * TILE - bounds.x) * zoom,
    top: (b.y * TILE - bounds.y) * zoom,
    width: b.w * TILE * zoom,
    height: b.h * TILE * zoom,
  });
  return (
    <>
      {drag?.boxes.map((b, n) => (
        <div
          key={n}
          data-testid="drag-ghost"
          className={`pointer-events-none absolute border-2 ${drag.ok ? "border-text-primary bg-text-primary/20" : "border-dashed border-danger bg-danger/20"}`}
          style={style(b)}
        />
      ))}
      {marquee && (
        <>
          <div
            data-testid="marquee"
            className="pointer-events-none absolute border border-dashed border-text-primary bg-text-primary/10"
            style={style(marquee.box)}
          />
          {marquee.items.map((b, n) => (
            <div
              key={n}
              data-testid="marquee-item"
              className="pointer-events-none absolute border border-text-primary"
              style={style(b)}
            />
          ))}
        </>
      )}
    </>
  );
}
