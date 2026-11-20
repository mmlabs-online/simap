"use client";

import { useMemo, useState } from "react";
import type { RoomDto } from "@/lib/rooms/types";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { DeleteRoomDialog } from "./DeleteRoomDialog";
import { RoomFormDialog } from "./RoomFormDialog";
import { RoomsView } from "./RoomsView";
import { createRoomsApi } from "./rooms-api";
import { useRooms } from "./useRooms";

type Dialog =
  | { kind: "none" }
  | { kind: "form"; room: RoomDto | null }
  | { kind: "delete"; room: RoomDto };

/** Rooms page: loads rooms, offers create/edit/delete to Admins. Renders only below `AuthGate`. */
export function RoomsPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const session = useSession();
  const canManage = session ? atLeastTier(session.tier, "admin") : false;
  const { status, rooms, errorCode, reload } = useRooms(api);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const done = () => {
    close();
    void reload();
  };

  return (
    <>
      <RoomsView
        status={status}
        rooms={rooms}
        errorCode={errorCode}
        canManage={canManage}
        onRetry={() => void reload()}
        onNew={() => setDialog({ kind: "form", room: null })}
        onEdit={(room) => setDialog({ kind: "form", room })}
        onDelete={(room) => setDialog({ kind: "delete", room })}
      />
      <RoomFormDialog
        open={dialog.kind === "form"}
        room={dialog.kind === "form" ? dialog.room : null}
        api={api}
        onClose={close}
        onDone={done}
      />
      <DeleteRoomDialog
        room={dialog.kind === "delete" ? dialog.room : null}
        api={api}
        onClose={close}
        onDone={done}
      />
    </>
  );
}
