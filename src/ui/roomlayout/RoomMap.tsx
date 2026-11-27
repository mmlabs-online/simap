"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { catalogFootprints } from "@/lib/map-items/footprints";
import type { SeatPresence } from "@/lib/presence/seat-presence";
import {
  ZOOM_LEVELS,
  type LayoutItem,
  type RoomLayout,
  type SeatDevice,
  type SeatView,
  type Zoom,
} from "@/lib/sprites/layout";
import { buildDrawList } from "@/lib/sprites/placement";
import { drawPresence } from "@/lib/sprites/walk";
import { walkGrid } from "@/lib/sprites/walk-path";
import { allowedZooms, clampZoom } from "@/lib/sprites/zoom";
import { registryFootprints } from "@/lib/validate/layout";
import { roomlayoutCopy } from "../copy/roomlayout";
import type { CatalogImages } from "./catalog-images";
import { paintRoom } from "./paint";
import { SeatOverlay } from "./SeatOverlay";
import { useAtlas } from "./useAtlas";
import { useReducedMotion } from "./useReducedMotion";
import { useWalks } from "./useWalks";
import { WalkLayer } from "./WalkLayer";
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

/** The presence view of the map (PRE-06): present/away, always-visible tags, open tags and a seat to focus. */
export type PresenceMapProps = {
  /** The room shown; a change of room starts a new baseline for the walk animations (PRE-07). */
  roomId: string;
  /** Undefined until the first room answer: the map draws as today, with tags always on. */
  presence?: Readonly<Record<string, SeatPresence>>;
  /** Seat ids that show an open tag. */
  openTags: readonly string[];
  onOpenTag: (seatId: string) => void;
  busy: boolean;
  /** Focus this seat's button and scroll it into view when `n` changes. */
  focusSeat: { code: string; n: number } | null;
};

type Props = {
  layout: RoomLayout;
  seatViews: Record<string, SeatView>;
  seatDevices?: Record<string, SeatDevice[]>;
  zoom: number;
  /** Shows the zoom buttons when given. */
  onZoom?: (zoom: Zoom) => void;
  onSelect?: (seatCode: string) => void;
  /** Catalog device images from `useCatalogImages`; without it every catalog image draws as the placeholder. */
  catalogImages?: CatalogImages;
  /** The layout's catalog rows (`LayoutResponse.items`); without them every item draws its built-in frame. */
  items?: readonly LayoutItem[];
  /** The check-in presence view; without it the map is as on the room page. */
  presenceView?: PresenceMapProps;
};

/** Canvas art plus an HTML seat overlay. Loads `/sprites/office.png|json`; a bad atlas shows an error view. */
export function RoomMap({
  layout,
  seatViews,
  seatDevices,
  zoom,
  onZoom,
  onSelect,
  catalogImages,
  items,
  presenceView,
}: Props) {
  const { atlas, failed, setFailed } = useAtlas();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const presence = presenceView?.presence;
  const focusSeat = presenceView?.focusSeat ?? null;

  const reduced = useReducedMotion();
  const grid = useMemo(
    () =>
      presenceView ? walkGrid(layout, catalogFootprints(items ?? [], registryFootprints)) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, items, presenceView !== undefined],
  );
  const { walks, hidden, finish } = useWalks({
    roomId: presenceView?.roomId ?? "",
    presence,
    seatViews,
    grid,
    reduced,
  });
  // The static layer shows a character walking in as away until it has sat down.
  const drawn = useMemo(() => drawPresence(presence, hidden), [presence, hidden]);

  const list = useMemo(
    () =>
      atlas
        ? buildDrawList(layout, seatViews, atlas.manifest, seatDevices, catalogImages?.ready, {
            items,
            image: catalogImages?.itemSize,
            presence: drawn,
          })
        : null,
    [atlas, layout, seatViews, seatDevices, items, drawn, catalogImages?.version],
  );

  const allowed = useMemo(() => (list ? allowedZooms(list.bounds) : []), [list]);
  const effective = clampZoom(zoom, allowed);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!atlas || !list || !canvas || effective === null) return;
    if (!paintRoom(canvas, atlas, list, effective, undefined, catalogImages?.source)) {
      setFailed(true);
    }
  }, [atlas, list, effective, setFailed, catalogImages]);

  const focusN = focusSeat?.n;
  const focusCode = focusSeat?.code;
  const shown = list !== null && effective !== null;
  useEffect(() => {
    if (focusCode === undefined || !shown) return;
    const el = stageRef.current?.querySelector<HTMLElement>(
      `[data-map-seat="${CSS.escape(focusCode)}"]`,
    );
    el?.focus();
    el?.scrollIntoView({ block: "center", inline: "center" });
    // Only a new request (n) moves focus, not a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusN]);

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
        <div ref={stageRef} className="relative" style={{ width, height }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="block"
            style={{ width, height, imageRendering: "pixelated" }}
          />
          {walks.length > 0 && (
            <WalkLayer
              atlas={atlas}
              walks={walks}
              bounds={list.bounds}
              zoom={effective}
              onDone={finish}
            />
          )}
          <SeatOverlay
            list={list}
            views={seatViews}
            zoom={effective}
            onSelect={onSelect}
            {...(presenceView
              ? {
                  tags: "always" as const,
                  presence,
                  openTags: presenceView.openTags,
                  onOpenTag: presenceView.onOpenTag,
                  openTagsBusy: presenceView.busy,
                }
              : {})}
          />
        </div>
      </div>
    </div>
  );
}
