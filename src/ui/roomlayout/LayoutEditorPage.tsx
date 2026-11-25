"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
import { roomDetailHref } from "@/lib/nav";
import type { MapView } from "@/lib/sprites/map-view";
import { useApiFetch } from "../auth/api-fetch-context";
import { roomlayoutCopy } from "../copy/roomlayout";
import { createRoomsApi } from "../rooms/rooms-api";
import { useRooms } from "../rooms/useRooms";
import { resolveRoom } from "../seats/seat-view";
import { createSeatsApi } from "../seats/seats-api";
import { useRoomLayout } from "../seats/useRoomLayout";
import { useSession } from "../session";
import { editorGate } from "./editor-page";
import { EditorGateView } from "./EditorViews";
import { LayoutEditor } from "./LayoutEditor";
import { useCatalogImages } from "./useCatalogImages";

const DESKTOP = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Null on the server and before hydration. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => null,
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-h2 font-extrabold text-on-surface">{roomlayoutCopy.editor.title}</h1>
      {children}
    </div>
  );
}

/** Mounted for admins on a wide screen only, so nobody else fetches rooms or a layout. */
function AdminEditor({ roomCode, backHref }: { roomCode: string; backHref: string }) {
  const apiFetch = useApiFetch();
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const rooms = useRooms(roomsApi);
  const resolution = resolveRoom(rooms, roomCode);
  const roomId = resolution.kind === "found" ? resolution.room.id : null;
  const map = useRoomLayout(seatsApi, roomId);
  const catalogImages = useCatalogImages(map.state.view?.seatDevices);
  const gate = editorGate({
    tier: "admin",
    isDesktop: true,
    resolution,
    load: roomId === null ? null : map.state,
  });

  // A new view object (first load, Reload) remounts the editor so the draft is rebuilt.
  const seen = useRef<{ view: MapView | null; n: number }>({ view: null, n: 0 });
  if (seen.current.view !== map.state.view) {
    seen.current = { view: map.state.view, n: seen.current.n + 1 };
  }

  if (gate === "ready" && map.state.view !== null && roomId !== null) {
    return (
      <LayoutEditor
        key={seen.current.n}
        view={map.state.view}
        roomId={roomId}
        roomCode={roomCode}
        seatsApi={seatsApi}
        catalogImages={catalogImages}
        onReload={() => void map.reload()}
      />
    );
  }
  if (gate === "ready") return null;
  return (
    <EditorGateView
      gate={gate}
      backHref={gate === "missing" ? "/rooms" : backHref}
      onRetry={() => {
        if (resolution.kind === "error") void rooms.reload();
        else void map.reload();
      }}
    />
  );
}

/** `/rooms/<code>/edit`: the layout editor for admins; every other case shows a short state. */
export function LayoutEditorPage({ roomCode }: { roomCode: string }) {
  const tier = useSession()?.tier;
  const isDesktop = useIsDesktop();
  const backHref = roomDetailHref(roomCode) ?? "/rooms";
  const early = editorGate({ tier, isDesktop, resolution: null, load: null });
  return (
    <Shell>
      {early === "loading" ? (
        <AdminEditor roomCode={roomCode} backHref={backHref} />
      ) : (
        <EditorGateView gate={early as Exclude<typeof early, "ready">} backHref={backHref} />
      )}
    </Shell>
  );
}
