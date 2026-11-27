"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useList } from "../groups/useList";
import { useAtlas } from "../roomlayout/useAtlas";
import { useSession } from "../session";
import { MapItemEditor } from "./MapItemEditor";
import { MapItemsView } from "./MapItemsView";
import { createMapItemsApi } from "./map-items-api";
import { findArtItem, thumbDir } from "./map-item-art";
import { canManageMapItems } from "./map-items-state";
import { useMapItemImages } from "./useMapItemImages";

type Dialog = { kind: "none" } | { kind: "editor"; key: string };

const NO_LIST = { status: "ready", items: [], errorCode: null } as const;
const noop = () => {};

/** Map items page. Below Admin it shows the no-access message and mounts no data hook. */
export function MapItemsPage() {
  const session = useSession();
  if (!canManageMapItems(session?.tier)) {
    return <MapItemsView access="forbidden" items={NO_LIST} onEdit={noop} onRetry={noop} />;
  }
  return <MapItemsLoaded />;
}

function MapItemsLoaded() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createMapItemsApi(apiFetch), [apiFetch]);
  const items = useList(api.list);
  const imageUrl = useMapItemImages(api, items.items);
  const { atlas, failed } = useAtlas();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const gone = () => {
    close();
    void items.reload();
  };

  const editing = dialog.kind === "editor" ? findArtItem(items.items, dialog.key) : undefined;

  useEffect(() => {
    if (dialog.kind === "editor" && !editing) setDialog({ kind: "none" });
  }, [dialog, editing]);

  return (
    <>
      <MapItemsView
        access="ok"
        items={items}
        onEdit={(item) => setDialog({ kind: "editor", key: item.builtinKey })}
        thumbUrl={(item) => {
          const dir = thumbDir(item);
          return dir ? imageUrl(item, dir) : null;
        }}
        atlas={atlas}
        onRetry={() => void items.reload()}
      />
      {dialog.kind === "editor" && editing && (
        <MapItemEditor
          key={dialog.key}
          item={editing}
          groups={[...new Set(items.items.map((i) => i.group))]}
          api={api}
          imageUrl={imageUrl}
          atlas={atlas}
          atlasFailed={failed}
          onReload={items.reload}
          onClose={close}
          onGone={gone}
        />
      )}
    </>
  );
}
