"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { useList } from "../groups/useList";
import { useSession } from "../session";
import { MapItemArtDialog } from "./MapItemArtDialog";
import { MapItemFormDialog } from "./MapItemFormDialog";
import { MapItemsView } from "./MapItemsView";
import { ResetMapItemDialog } from "./ResetMapItemDialog";
import { createMapItemsApi } from "./map-items-api";
import { findArtItem, thumbDir } from "./map-item-art";
import { canManageMapItems } from "./map-items-state";
import { useMapItemImages } from "./useMapItemImages";

type Dialog =
  | { kind: "none" }
  | { kind: "edit"; item: MapItemDto }
  | { kind: "reset"; item: MapItemDto }
  | { kind: "art"; key: string };

const NO_LIST = { status: "ready", items: [], errorCode: null } as const;
const noop = () => {};

/** Map items page. Below Admin it shows the no-access message and mounts no data hook. */
export function MapItemsPage() {
  const session = useSession();
  if (!canManageMapItems(session?.tier)) {
    return (
      <MapItemsView access="forbidden" items={NO_LIST} onEdit={noop} onArt={noop} onRetry={noop} />
    );
  }
  return <MapItemsLoaded />;
}

function MapItemsLoaded() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createMapItemsApi(apiFetch), [apiFetch]);
  const items = useList(api.list);
  const imageUrl = useMapItemImages(api, items.items);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const done = () => {
    close();
    void items.reload();
  };

  const artItem = dialog.kind === "art" ? findArtItem(items.items, dialog.key) : undefined;

  useEffect(() => {
    if (dialog.kind === "art" && !artItem) setDialog({ kind: "none" });
  }, [dialog, artItem]);

  return (
    <>
      <MapItemsView
        access="ok"
        items={items}
        onEdit={(item) => setDialog({ kind: "edit", item })}
        onArt={(item) => setDialog({ kind: "art", key: item.builtinKey })}
        thumbUrl={(item) => {
          const dir = thumbDir(item);
          return dir ? imageUrl(item, dir) : null;
        }}
        onRetry={() => void items.reload()}
      />
      {dialog.kind === "edit" && (
        <MapItemFormDialog
          item={dialog.item}
          groups={[...new Set(items.items.map((i) => i.group))]}
          api={api}
          onClose={close}
          onDone={done}
          onReset={() => setDialog({ kind: "reset", item: dialog.item })}
        />
      )}
      {dialog.kind === "art" && artItem && (
        <MapItemArtDialog
          item={artItem}
          api={api}
          imageUrl={imageUrl}
          onReload={items.reload}
          onClose={close}
          onGone={done}
        />
      )}
      {dialog.kind === "reset" && (
        <ResetMapItemDialog item={dialog.item} api={api} onClose={close} onDone={done} />
      )}
    </>
  );
}
