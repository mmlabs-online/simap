"use client";

import { useMemo, useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { useList } from "../groups/useList";
import { useSession } from "../session";
import { MapItemFormDialog } from "./MapItemFormDialog";
import { MapItemsView } from "./MapItemsView";
import { ResetMapItemDialog } from "./ResetMapItemDialog";
import { createMapItemsApi } from "./map-items-api";
import { canManageMapItems } from "./map-items-state";

type Dialog =
  | { kind: "none" }
  | { kind: "edit"; item: MapItemDto }
  | { kind: "reset"; item: MapItemDto };

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
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const done = () => {
    close();
    void items.reload();
  };

  return (
    <>
      <MapItemsView
        access="ok"
        items={items}
        onEdit={(item) => setDialog({ kind: "edit", item })}
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
      {dialog.kind === "reset" && (
        <ResetMapItemDialog item={dialog.item} api={api} onClose={close} onDone={done} />
      )}
    </>
  );
}
