"use client";

import { useState } from "react";
import { libraryItem } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, type MapItemDto } from "@/lib/map-items/types";
import { mapItemsCopy } from "../copy/mapItems";
import { EntityFormDialog } from "../EntityFormDialog";
import type { MapItemsApi } from "./map-items-api";
import { settleMapItem } from "./map-items-state";

const copy = mapItemsCopy.reset;

/** The confirm text. Props only, so the markup can be tested without effects. */
export function ResetMapItemBody({ item }: { item: MapItemDto }) {
  const lib = libraryItem(item.builtinKey);
  if (!lib) return null;
  const images = MAP_ITEM_DIRS.filter((d) => item.art[d].hasImage).length;
  const sizeChanges = lib.w !== item.w || lib.h !== item.h;
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-on-surface">
      <p>{copy.intro(item.name)}</p>
      <ul className="list-disc pl-5">
        <li>{copy.name(lib.name)}</li>
        <li>{copy.group(lib.group)}</li>
        <li>{copy.size(`${lib.w} × ${lib.h}`)}</li>
        <li>{copy.shown}</li>
      </ul>
      <p>
        {images > 0 ? `${copy.images(images)} ` : ""}
        {copy.sprites}
      </p>
      {sizeChanges && <p className="text-on-surface-variant">{copy.inUseNote}</p>}
    </div>
  );
}

/** Confirms, then resets the item. Closes itself through `onDone`. */
export function ResetMapItemDialog({
  item,
  api,
  onClose,
  onDone,
}: {
  item: MapItemDto;
  api: MapItemsApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const settled = settleMapItem(await api.reset(item.builtinKey));
    setSubmitting(false);
    if (settled.kind === "done") return onDone();
    setError(settled.message);
  }

  return (
    <EntityFormDialog
      open
      title={copy.title}
      submitLabel={copy.confirm}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <ResetMapItemBody item={item} />
    </EntityFormDialog>
  );
}
