"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Zoom } from "@/lib/sprites/layout";
import type { MapLoadState } from "@/lib/sprites/map-view";
import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import { Button } from "../Button";
import { Card } from "../Card";
import { apiErrorMessage } from "../copy/api";
import { roomlayoutCopy } from "../copy/roomlayout";
import type { CatalogImages } from "./catalog-images";
import { RoomMap, RoomMapStatus, type PresenceMapProps } from "./RoomMap";

type Props = {
  state: MapLoadState;
  onRetry: () => void;
  onSelect: (seatCode: string) => void;
  /** The editor link; given to admins only. */
  editHref?: string;
  catalogImages?: CatalogImages;
  /** The check-in presence view (PRE-06); the room page passes none. */
  presenceView?: PresenceMapProps;
  /** Shown under the map, e.g. a move error. */
  notice?: ReactNode;
};

/** The map card of the room page. A layout failure never hides the seat table. */
export function RoomMapSection({
  state,
  onRetry,
  onSelect,
  editHref,
  catalogImages,
  presenceView,
  notice,
}: Props) {
  const [zoom, setZoom] = useState<Zoom>(2);
  const { view } = state;
  const failure =
    state.status === "error" ? (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm font-semibold text-error">
          {apiErrorMessage(state.errorCode ?? "internal")}
        </p>
        <Button variant="tonal" size="sm" onClick={onRetry}>
          {roomlayoutCopy.retry}
        </Button>
      </div>
    ) : null;

  let body;
  if (view === null) {
    body = state.status === "error" ? null : <RoomMapStatus status="loading" />;
  } else if (view.empty) {
    body = <p className="text-sm font-medium text-on-surface-variant">{roomlayoutCopy.emptyMap}</p>;
  } else {
    body = (
      <RoomMap
        layout={view.layout}
        seatViews={view.seatViews}
        seatDevices={view.seatDevices}
        items={view.items}
        zoom={zoom}
        onZoom={setZoom}
        onSelect={onSelect}
        catalogImages={catalogImages}
        presenceView={presenceView}
      />
    );
  }

  return (
    <Card as="section" className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-on-surface">{roomlayoutCopy.heading}</h2>
          <p className="text-sm font-medium text-on-surface-variant">{roomlayoutCopy.panHint}</p>
        </div>
        {editHref && !view?.truncated && (
          <Link
            href={editHref}
            className="state-layer shrink-0 rounded-full border border-outline-variant bg-surface px-4 py-2 text-[13px] font-bold text-on-surface hover:border-outline"
          >
            {roomlayoutCopy.editLayout}
          </Link>
        )}
      </div>
      {failure}
      {body}
      {notice}
      {view?.truncated && (
        <p role="status" className="text-sm font-semibold text-on-surface-variant">
          {roomlayoutCopy.truncated(LAYOUT_LIMITS.seats)}
        </p>
      )}
      {view && view.unplaced.length > 0 && (
        <p role="status" className="text-sm font-semibold text-on-surface-variant">
          {roomlayoutCopy.unplacedNote(view.unplaced.length)}
        </p>
      )}
    </Card>
  );
}
