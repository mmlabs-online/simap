"use client";

import { useMemo, useState } from "react";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { useAtlas } from "../roomlayout/useAtlas";
import { useApiFetch } from "../auth/api-fetch-context";
import { useList } from "../groups/useList";
import { useSession } from "../session";
import { DeleteDeviceTypeDialog } from "./DeleteDeviceTypeDialog";
import { DeviceTypeFormDialog } from "./DeviceTypeFormDialog";
import { DeviceTypesView } from "./DeviceTypesView";
import { createDeviceTypesApi } from "./device-types-api";
import { useDeviceTypeImages } from "./useDeviceTypeImages";
import { canManageDeviceTypes } from "./device-types-state";

type Dialog =
  | { kind: "none" }
  | { kind: "form"; item: DeviceTypeDto | null }
  | { kind: "delete"; item: DeviceTypeDto };

const NO_LIST = { status: "ready", items: [], errorCode: null } as const;
const noop = () => {};
const NO_ITEMS: DeviceTypeDto[] = [];

/** Device types page. Below Admin it shows the no-access message and mounts no data hook. */
export function DeviceTypesPage() {
  const session = useSession();
  if (!canManageDeviceTypes(session?.tier)) {
    return (
      <DeviceTypesView
        access="forbidden"
        types={NO_LIST}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
        onRetry={noop}
        imageUrl={() => null}
      />
    );
  }
  return <DeviceTypesLoaded />;
}

function DeviceTypesLoaded() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDeviceTypesApi(apiFetch), [apiFetch]);
  const types = useList(api.list);
  const { atlas } = useAtlas();
  const imageUrl = useDeviceTypeImages(api, types.status === "ready" ? types.items : NO_ITEMS);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const done = () => {
    close();
    void types.reload();
  };

  return (
    <>
      <DeviceTypesView
        access="ok"
        types={types}
        onNew={() => setDialog({ kind: "form", item: null })}
        onEdit={(item) => setDialog({ kind: "form", item })}
        onDelete={(item) => setDialog({ kind: "delete", item })}
        onRetry={() => void types.reload()}
        imageUrl={imageUrl}
      />
      {dialog.kind === "form" && (
        <DeviceTypeFormDialog
          item={dialog.item}
          api={api}
          imageUrl={imageUrl}
          atlas={atlas}
          onClose={close}
          onDone={done}
        />
      )}
      {dialog.kind === "delete" && (
        <DeleteDeviceTypeDialog item={dialog.item} api={api} onClose={close} onDone={done} />
      )}
    </>
  );
}
